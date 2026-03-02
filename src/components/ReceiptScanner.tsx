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
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
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
    // Match total lines
    const totalMatch = line.match(/(?:total|totaal|gesamt|summe|sum|grand\s*total|subtotal|sub\s*total|amount\s*due|te\s*betalen)\s*[:\s]*[€$£¥₹]?\s*([\d.,]+)/i);
    if (totalMatch) {
      const val = parseFloat(totalMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        total = val;
      }
      continue;
    }

    // Skip non-item lines (payment method, change, etc.)
    if (/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal)\b/i.test(line)) {
      continue;
    }

    // Match item lines: "item name ... price" or "item name  1.99"
    // Patterns: text followed by a price at the end
    const itemMatch = line.match(/^(.+?)\s{2,}[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*$/);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1 && !/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal)\b/i.test(name)) {
        items.push({ name, price });
        continue;
      }
    }

    // Alternative: price at end of line with any spacing
    const altMatch = line.match(/^(.{2,}?)\s+[€$£¥₹]?\s*([\d]+[.,]\d{2})\s*[A-Z]?\s*$/);
    if (altMatch) {
      const name = altMatch[1].trim();
      const price = parseFloat(altMatch[2].replace(',', '.'));
      if (!isNaN(price) && price > 0 && name.length > 1) {
        // Skip if name looks like a date or time
        if (!/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(name) && !/^\d{1,2}:\d{2}/.test(name) && !/^\s*(?:cash|change|wissel|wechselgeld|bargeld|monnaie|contant|pin|card|creditcard|debit|visa|mastercard|betaald?|paid|payment|betaling|tax|btw|vat|tva|mwst|qty|quantity|aantal)\b/i.test(name)) {
          items.push({ name, price });
        }
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
      const result = await Tesseract.recognize(file, 'eng+nld+deu+fra', {
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
