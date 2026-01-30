interface ResultLineProps {
  value: unknown;
}

/**
 * Formats a number for display.
 * - Maximum 6 decimal places
 * - Uses locale formatting for thousands separators
 */
function formatNumber(num: number): string {
  // Handle special cases
  if (!Number.isFinite(num)) {
    return String(num);
  }

  // Round to max 6 decimal places
  const rounded = Math.round(num * 1_000_000) / 1_000_000;

  // Use locale formatting for nice thousands separators
  return rounded.toLocaleString('en-US', {
    maximumFractionDigits: 6,
  });
}

/**
 * Formats a value for display in the result indicator.
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number') {
    return formatNumber(value);
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object') {
    return '{...}';
  }
  return String(value);
}

/**
 * ResultLine displays an evaluation result with an arrow indicator.
 * Returns null for empty/undefined values (text lines, comments).
 */
export default function ResultLine({ value }: ResultLineProps) {
  // Don't render anything for empty/undefined values
  // These represent text lines or comments that don't produce results
  if (value === undefined) {
    return null;
  }

  const isError = value instanceof Error;
  const displayValue = isError ? value.message : formatValue(value);

  return (
    <span className={`result-line ${isError ? 'result-line--error' : ''}`}>
      <span className="result-line__arrow">&rarr;</span>
      <span className="result-line__value">{displayValue}</span>
    </span>
  );
}
