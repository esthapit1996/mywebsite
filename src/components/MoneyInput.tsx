interface MoneyInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

// Parses an amount typed the German or the English way. Returns 0 for an empty field and
// null for something that is not a valid non-negative amount.
//   "4000,50" -> 4000.5   "4.000,50" -> 4000.5   "4,000.50" -> 4000.5   "4000.5" -> 4000.5
//   "4.000"   -> 4000     (a dot followed by exactly 3 digits is a thousands separator,
//                          money never has 3 decimals)
export function parseMoney(raw: string): number | null {
  const s = raw.replace(/\s/g, '');
  if (s === '') return 0;

  let normalized: string;
  if (s.includes(',') && s.includes('.')) {
    // The last separator is the decimal one, the other is a thousands separator
    normalized = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    normalized = s.replace(',', '.');
  } else if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, '');
  } else {
    normalized = s;
  }

  if ((normalized.match(/\./g) || []).length > 1) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// A text input for amounts: type="number" is locale-fragile with German commas, so this keeps
// the typed text as is, only allows digits, dots and commas, and leaves parsing to parseMoney.
export default function MoneyInput({ id, value, onChange, placeholder = '0', ariaLabel }: MoneyInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="form-input"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={14}
      onChange={e => {
        if (/^[0-9.,\s]*$/.test(e.target.value)) onChange(e.target.value);
      }}
    />
  );
}
