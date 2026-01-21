// Built-in functions for FlowNote

/**
 * Flatten all numeric values from a mix of numbers and objects.
 * Recursively extracts numbers from nested objects.
 */
function flattenValues(args: unknown[]): number[] {
  const result: number[] = []
  for (const arg of args) {
    if (typeof arg === 'number' && !isNaN(arg)) {
      result.push(arg)
    } else if (typeof arg === 'object' && arg !== null) {
      result.push(...flattenValues(Object.values(arg)))
    }
  }
  return result
}

/**
 * Sum all values. Works with individual numbers or objects (sums all properties).
 * Example: sum(1, 2, 3) => 6
 * Example: sum(hotel) where hotel = {perNight: 180, nights: 4, total: 720} => 904
 */
export function sum(...args: unknown[]): number {
  const values = flattenValues(args)
  return values.reduce((acc, val) => acc + val, 0)
}

/**
 * Average of all values. Works with individual numbers or objects.
 * Example: avg(1, 2, 3, 4) => 2.5
 * Example: avg(groceries) where groceries = {apples: 3, bananas: 5} => 4
 */
export function avg(...args: unknown[]): number {
  const values = flattenValues(args)
  return values.length > 0 ? sum(...values) / values.length : 0
}

/**
 * Minimum of all values. Works with individual numbers or objects.
 * Example: min(5, 2, 8) => 2
 */
export function min(...args: unknown[]): number {
  const values = flattenValues(args)
  if (values.length === 0) return Infinity
  return Math.min(...values)
}

/**
 * Maximum of all values. Works with individual numbers or objects.
 * Example: max(5, 2, 8) => 8
 */
export function max(...args: unknown[]): number {
  const values = flattenValues(args)
  if (values.length === 0) return -Infinity
  return Math.max(...values)
}

/**
 * All built-in functions exported as a single object for injection into eval scope.
 */
export const builtinFunctions = {
  sum,
  avg,
  min,
  max,
}
