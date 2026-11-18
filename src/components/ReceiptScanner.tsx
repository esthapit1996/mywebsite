import { useState, useRef, useEffect, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import api from '../services/api';

const API_BASE = import.meta.env.PROD
  ? 'https://gopherdebt-api.fly.dev/api'
  : 'http://localhost:8080/api';

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptResult {
  items: ReceiptItem[];
  total: number | null;
  rawText: string;
  storeName: string | null;
  // 'ai' totals are reliable; on-device OCR often picks the wrong "total" line
  source: 'ai' | 'ocr';
}

// Backend limit (handlers/receipt.go MaxReceiptBytes)
const MAX_UPLOAD_BYTES = 14 * 1024 * 1024;
// Photos above this are shrunk in the browser first (saves mobile data, stays far below the limit)
const SHRINK_ABOVE_BYTES = 4 * 1024 * 1024;
const SHRINK_MAX_SIDE = 2400;

/**
 * Amount to prefill from a scan. The AI is told to leave discounts/coupons out of the items, so a
 * total *below* the item sum means a discount: use the total and report the difference (negative).
 * A total above the item sum (e.g. tax added on top) keeps the item sum, as before.
 */
export function receiptAmount(result: ReceiptResult): { amount: number | null; discount: number } {
  const item_sum = Math.round(result.items.reduce((s, it) => s + it.price, 0) * 100) / 100;
  if (result.items.length === 0) return { amount: result.total, discount: 0 };
  if (result.source === 'ai' && result.total !== null && result.total > 0 && result.total < item_sum - 0.005) {
    return { amount: result.total, discount: Math.round((result.total - item_sum) * 100) / 100 };
  }
  return { amount: item_sum, discount: 0 };
}

class ScanError extends Error {
  // true when on-device OCR should be tried instead (AI busy, down or unreachable)
  fallbackToOcr: boolean;
  constructor(message: string, fallbackToOcr: boolean) {
    super(message);
    this.fallbackToOcr = fallbackToOcr;
  }
}

// Formats the AI (OpenAI) can read. Anything else, e.g. iPhone HEIC, is converted to JPEG first.
const AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Re-encode big photos, and formats the AI can't read (HEIC), as a JPEG before upload. Falls back
 * to the original file when the browser can't decode it (e.g. HEIC outside Safari); the backend
 * then answers 415 with a clear message.
 */
function shrinkForUpload(file: File): Promise<Blob> {
  if (file.size <= SHRINK_ABOVE_BYTES && AI_IMAGE_TYPES.includes(file.type)) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, SHRINK_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob && blob.size < file.size ? blob : file), 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

interface ReceiptScannerProps {
  onResult: (result: ReceiptResult) => void;
}

/**
 * Read the receipt with the backend's AI (OpenAI). The API key stays server-side.
 */
async function scanWithAI(file: File, signal: AbortSignal): Promise<ReceiptResult> {
  const t = i18n.t.bind(i18n);
  const upload = await shrinkForUpload(file);
  if (upload.size > MAX_UPLOAD_BYTES) {
    throw new ScanError(t('receipt.tooLarge'), false);
  }

  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', upload, upload === file ? file.name : 'receipt.jpg');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/receipt/scan`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ScanError(t('receipt.unreachable'), true);
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Same as every other API call: an expired session logs out
      api.clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new ScanError(t('receipt.failedScan'), false);
    }
    if (response.status === 413) throw new ScanError(t('receipt.tooLarge'), false);
    if (response.status === 415) throw new ScanError(t('receipt.notImage'), false);
    // Busy (429) or AI/server trouble (5xx): the on-device scanner can still read it
    const fallback = response.status === 429 || response.status >= 500;
    let message = t('receipt.failedScan');
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error page
    }
    throw new ScanError(message, fallback);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Receipt scan failed');
  }

  const text = result.data?.text || '';

  // Extract JSON from response (may be wrapped in ```json ... ```)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI returned no valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const items: ReceiptItem[] = (parsed.items || [])
    .filter((item: any) => item.name && typeof item.price === 'number' && item.price > 0)
    .map((item: any) => ({ name: String(item.name), price: Number(item.price) }));

  let total: number | null = parsed.total != null ? Number(parsed.total) : null;
  if (total !== null && (isNaN(total) || total <= 0)) total = null;

  // If no total, sum items
  if (total === null && items.length > 0) {
    total = Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
  }

  return {
    items,
    total,
    rawText: text,
    storeName: parsed.store_name || null,
    source: 'ai',
  };
}

// On-device OCR languages (Tesseract.js). Each is downloaded on first use, then cached by the browser.
const OCR_LANGUAGES = 'eng+nld+deu+fra+ita';

// Words that start a non-item line in English, Dutch, German, French and Italian: payment and change,
// tax, discounts (OCR can't tell them from items; the AI path handles discounts), headers and footers.
// Whole words only, so items like "Orata", "Barilla" or "Datteri" aren't caught by "ora", "bar", "data".
const NON_ITEM_LINE = new RegExp('^\\s*(?:' + [
  // payment / change
  'cash', 'change', 'card', 'credit\\s*card', 'creditcard', 'debit', 'visa', 'mastercard', 'paid', 'payment',
  'wissel', 'contant', 'pin', 'betaald?', 'betaling',
  'bar', 'bargeld', 'wechselgeld', 'rückgeld', 'ec[\\s-]*karte', 'kartenzahlung', 'gegeben',
  'monnaie', 'espèces', 'rendu',
  'contant[ei]', 'resto', 'bancomat', 'pagamento', 'pagato', 'carta\\s+di\\s+credito', 'carta\\s+(?:credito|debito)',
  // tax
  'tax', 'vat', 'btw', 'tva', 'mwst', 'ust', 'iva', 'p\\.?\\s*iva',
  // discounts
  'discount', 'korting', 'rabatt', 'remise', 'sconto', 'coupon',
  // headers / footers
  'qty', 'quantity', 'aantal', 'date', 'datum', 'data', 'time', 'tijd', 'ora', 'receipt', 'bon', 'invoice', 'factuur',
  'scontrino', 'documento', 'thank', 'dank', 'grazie', 'welcome', 'welkom', 'tel', 'phone', 'telefono', 'address', 'adres',
].join('|') + ')\\b', 'i');

// Total lines, incl. "TOTALE COMPLESSIVO 14,78", "TOTALE EURO 14,78", "SUMME EUR 3,18", "IMPORTO PAGATO 9,50"
const TOTAL_LINE = /(?:grand\s*total|sub\s*total|subtotal|totale(?:\s*complessivo)?|total|totaal|t[o0]tal|gesamt(?:betrag)?|summe|sum|amount\s*due|te\s*betalen|net\s*amount|balance\s*due|you\s*(?:owe|pay)|importo(?:\s*pagato)?|da\s*pagare|[àa]\s*payer)\s*[:\s]*(?:eur(?:o)?\s*)?[€$£¥₹]?\s*([\d.,]+)/i;

function parseReceiptText(text: string): ReceiptResult {
  // Clean up OCR artifacts common in phone photos
  const cleanedText = text
    .replace(/[|}{[\]\\]/g, '')     // Remove brackets/pipes mistaken for chars
    .replace(/(\r\n|\r)/g, '\n')    // Normalize line endings
    .replace(/[ \t]{3,}/g, '  ')    // Normalize excessive spaces to double-space (preserve as delimiter)
    .replace(/[''`]/g, "'")         // Normalize quotes
    .replace(/[""]/g, '"');

  const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items: ReceiptItem[] = [];
  let total: number | null = null;
  let storeName: string | null = null;

  // Try to get store name from first non-empty line
  if (lines.length > 0) {
    const firstLine = lines[0];
    if (firstLine.length > 2 && firstLine.length < 50 && !/\d{2,}/.test(firstLine)) {
      storeName = firstLine;
    }
  }

  for (const line of lines) {
    // Match total lines (expanded patterns for OCR misreads)
    const totalMatch = line.match(TOTAL_LINE);
    if (totalMatch) {
      const val = parseFloat(totalMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        total = val;
      }
      continue;
    }

    // Skip non-item lines (payment method, change, headers, etc.)
    if (NON_ITEM_LINE.test(line)) {
      continue;
    }

    // Skip lines that are just numbers or dates
    if (/^[\d\s/.,:-]+$/.test(line)) continue;

    // Pattern 1: "item name ... price" with 2+ spaces
    const itemMatch = line.match(/^(.+?)\s{2,}[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*$/);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1 && !NON_ITEM_LINE.test(name)) {
        items.push({ name, price });
        continue;
      }
    }

    // Pattern 2: price at end of line with any spacing
    const altMatch = line.match(/^(.{2,}?)\s+[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*[A-Z]?\s*$/);
    if (altMatch) {
      const name = altMatch[1].trim();
      const price = parseFloat(altMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1) {
        if (!/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(name) && !/^\d{1,2}:\d{2}/.test(name) && !NON_ITEM_LINE.test(name)) {
          items.push({ name, price });
          continue;
        }
      }
    }

    // Pattern 3: "qty x item price" — e.g. "2 x Coffee 5.00" or "2x Coffee 5.00"
    const qtyMatch = line.match(/^\d+\s*[xX×]\s*(.{2,}?)\s+[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*$/);
    if (qtyMatch) {
      const name = qtyMatch[1].trim();
      const price = parseFloat(qtyMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1) {
        items.push({ name, price });
        continue;
      }
    }

    // Pattern 4: currency symbol directly before price — "Item €3.50" or "Item $3.50"
    const currMatch = line.match(/^(.{2,}?)\s+[€$£¥₹]([\d]+[.,]\d{2})\s*$/);
    if (currMatch) {
      const name = currMatch[1].trim();
      const price = parseFloat(currMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1) {
        items.push({ name, price });
      }
    }
  }

  // If no total found, sum up items
  if (total === null && items.length > 0) {
    total = items.reduce((sum, item) => sum + item.price, 0);
    total = Math.round(total * 100) / 100;
  }

  return { items, total, rawText: text, storeName, source: 'ocr' };
}

/**
 * Preprocess an image for better OCR results, especially from phone photos.
 * Applies: resize → grayscale → contrast enhancement → adaptive thresholding → sharpening.
 * Returns a Blob ready for Tesseract.
 */
function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        // 1. Resize — OCR works best around 2000-3000px wide
        const MAX_WIDTH = 2800;
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.round(height * scale);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Get pixel data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // 3. Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          data[i] = data[i + 1] = data[i + 2] = gray;
        }

        // 4. Auto-contrast: stretch histogram to full 0-255 range
        let minVal = 255, maxVal = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < minVal) minVal = data[i];
          if (data[i] > maxVal) maxVal = data[i];
        }
        const range = maxVal - minVal || 1;
        for (let i = 0; i < data.length; i += 4) {
          const stretched = ((data[i] - minVal) / range) * 255;
          data[i] = data[i + 1] = data[i + 2] = stretched;
        }

        // 5. Adaptive thresholding (local mean) for binarization
        //    This handles uneven lighting from phone photos.
        const blockSize = 31; // neighborhood size (must be odd)
        const C = 12; // constant subtracted from mean
        const half = Math.floor(blockSize / 2);

        // Build integral image for fast local mean computation
        const integral = new Float64Array(width * height);
        for (let y = 0; y < height; y++) {
          let rowSum = 0;
          for (let x = 0; x < width; x++) {
            rowSum += data[(y * width + x) * 4];
            integral[y * width + x] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
          }
        }

        const thresholded = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - half);
            const y1 = Math.max(0, y - half);
            const x2 = Math.min(width - 1, x + half);
            const y2 = Math.min(height - 1, y + half);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            let sum = integral[y2 * width + x2];
            if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
            if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
            if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];

            const localMean = sum / count;
            thresholded[y * width + x] = data[(y * width + x) * 4] > (localMean - C) ? 255 : 0;
          }
        }

        // Write thresholded values back
        for (let i = 0; i < thresholded.length; i++) {
          data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = thresholded[i];
        }

        // 6. Light sharpening via unsharp mask
        ctx.putImageData(imageData, 0, 0);
        // Draw a slightly blurred version and subtract
        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d')!;
        ctx2.filter = 'blur(1px)';
        ctx2.drawImage(canvas, 0, 0);
        const blurred = ctx2.getImageData(0, 0, width, height);

        const sharpened = ctx.getImageData(0, 0, width, height);
        const sd = sharpened.data;
        const bd = blurred.data;
        const amount = 0.5;
        for (let i = 0; i < sd.length; i += 4) {
          const diff = sd[i] - bd[i];
          const val = Math.min(255, Math.max(0, sd[i] + diff * amount));
          sd[i] = sd[i + 1] = sd[i + 2] = val;
        }
        ctx.putImageData(sharpened, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to process image'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
}

export default function ReceiptScanner({ onResult }: ReceiptScannerProps): JSX.Element {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [backendAiAvailable, setBackendAiAvailable] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanMethod, setScanMethod] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A scan can outlive the form (user presses Cancel mid-scan). Its result must not land in a
  // later, unrelated form, so it's dropped once this scanner is unmounted, and the upload aborted.
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Query backend to see whether AI receipt scanning is enabled
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/receipt/config`, { headers });
        if (!res.ok) {
          setBackendAiAvailable(false);
          return;
        }
        const data = await res.json();
        setBackendAiAvailable(Boolean(data.data?.enabled));
      } catch (err) {
        setBackendAiAvailable(false);
      }
    })();
    return () => {
      // preview is a data URL from FileReader, no revoke needed
    };
  }, []);

  const processImage = async (file: File) => {
    setError(null);
    setScanning(true);
    setProgress(0);
    setScanMethod('');

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const scanWithOcr = async (): Promise<ReceiptResult> => {
      setScanMethod('OCR');
      setProgress(0);
      const processed = await preprocessImage(file);
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.default.recognize(processed, OCR_LANGUAGES, {
        logger: (m) => {
          if (m.status === 'recognizing text' && aliveRef.current) {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      return parseReceiptText(result.data.text);
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let result: ReceiptResult;
      // Use AI when the backend has it; fall back to on-device OCR if it's busy, down or unreachable
      if (backendAiAvailable !== false) {
        setScanMethod('AI');
        setProgress(30);
        try {
          result = await scanWithAI(file, controller.signal);
        } catch (err) {
          if (!(err instanceof ScanError && err.fallbackToOcr) || !aliveRef.current) throw err;
          result = await scanWithOcr();
        }
      } else {
        result = await scanWithOcr();
      }
      if (!aliveRef.current) return;
      setProgress(100);
      onResult(result);
    } catch (err: any) {
      if (!aliveRef.current) return;
      setError(err.message || t('receipt.failedScan'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (aliveRef.current) {
        setScanning(false);
        setProgress(0);
        setScanMethod('');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      setPreview(null);
      setError(t('receipt.notImage'));
      return;
    }
    processImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  };

  const reset = () => {
    setPreview(null);
    setError(null);
    setScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!preview && !scanning && !error ? (
        <div>
          {/* Single scan area — method chosen automatically (AI if available, otherwise OCR) */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: 'var(--bg)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {backendAiAvailable === null && 'Checking scan method...'}
            {backendAiAvailable === true && 'Using AI for scanning'}
            {backendAiAvailable === false && 'Using OCR for scanning'}
          </div>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{t('receipt.scanOrUpload')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('receipt.takePhoto')}
          </div>
        </div>
        </div>
      ) : (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '12px',
          background: 'var(--bg)',
        }}>
          {preview && (
            <div style={{ marginBottom: '10px', textAlign: 'center' }}>
              <img
                src={preview}
                alt="Receipt"
                style={{
                  maxWidth: '100%',
                  maxHeight: '150px',
                  borderRadius: '8px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {scanning ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                height: '6px',
                background: 'var(--border)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '8px',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--primary)',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }} />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {scanMethod === 'AI' ? '🤖' : '🔍'} {scanMethod ? t('receipt.scanning', { method: scanMethod, progress }) : t('receipt.scanningSimple')}
              </div>
            </div>
          ) : error ? (
            <div>
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '8px' }}>
                ⚠️ {error}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
                {t('receipt.tryAgain')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
                {t('receipt.clear')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()}
                style={{ background: 'var(--secondary)' }}>
                {t('receipt.rescan')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
