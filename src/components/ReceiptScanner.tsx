import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptResult {
  items: ReceiptItem[];
  total: number | null;
  rawText: string;
  storeName: string | null;
}

interface ReceiptScannerProps {
  onResult: (result: ReceiptResult) => void;
}

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
    const totalMatch = line.match(/(?:total|totaal|gesamt|summe|sum|grand\s*total|subtotal|sub\s*total|amount\s*due|te\s*betalen|t[o0]tal|net\s*amount|balance\s*due|you\s*(?:owe|pay))\s*[:\s]*[€$£¥₹]?\s*([\d.,]+)/i);
    if (totalMatch) {
      const val = parseFloat(totalMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        total = val;
      }
      continue;
    }

    // Skip non-item lines (payment method, change, headers, etc.)
    if (/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal|date|datum|time|tijd|receipt|bon|invoice|factuur|thank|dank|welcome|welkom|tel|phone|address|adres)\b/i.test(line)) {
      continue;
    }

    // Skip lines that are just numbers or dates
    if (/^[\d\s/.,:-]+$/.test(line)) continue;

    // Pattern 1: "item name ... price" with 2+ spaces
    const itemMatch = line.match(/^(.+?)\s{2,}[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*$/);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1 && !/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal)\b/i.test(name)) {
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
        if (!/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(name) && !/^\d{1,2}:\d{2}/.test(name) && !/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal)\b/i.test(name)) {
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

  return { items, total, rawText: text, storeName };
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
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function ReceiptScanner({ onResult }: ReceiptScannerProps): JSX.Element {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setError(null);
    setScanning(true);
    setProgress(0);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // Preprocess for better OCR (especially phone photos)
      const processed = await preprocessImage(file);

      const result = await Tesseract.recognize(processed, 'eng+nld+deu+fra', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const parsed = parseReceiptText(result.data.text);
      onResult(parsed);
    } catch (err: any) {
      setError(err.message || 'Failed to scan receipt');
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
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

      {!preview && !scanning ? (
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
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>Scan or upload a receipt</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Take a photo or drag & drop an image
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
                🔍 Scanning receipt... {progress}%
              </div>
            </div>
          ) : error ? (
            <div>
              <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '8px' }}>
                ⚠️ {error}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
                Try again
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
                ✕ Clear
              </button>
              <button type="button" className="btn btn-sm" onClick={() => fileInputRef.current?.click()}
                style={{ background: 'var(--secondary)' }}>
                📸 Rescan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
