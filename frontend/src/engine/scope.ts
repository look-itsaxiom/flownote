// Variable and function scope management

// User-defined function stored with its body string for later evaluation
export interface UserFunction {
  params: string[]
  body: string
}

export interface Scope {
  variables: Record<string, unknown>
  functions: Record<string, UserFunction>
}

export function createScope(): Scope {
  return {
    variables: {},
    functions: {},
  }
}

/**
 * Set a variable value, supporting dot notation.
 * e.g., setVariable(scope, "hotel.perNight", 180)
 * creates { hotel: { perNight: 180 } }
 */
export function setVariable(scope: Scope, path: string, value: unknown): void {
  const parts = path.split('.')

  if (parts.length === 1) {
    // Simple variable
    scope.variables[path] = value
    return
  }

  // Dot notation: traverse/create nested structure
  let current: Record<string, unknown> = scope.variables

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] === undefined || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  // Set the final value
  const lastPart = parts[parts.length - 1]
  current[lastPart] = value
}

/**
 * Get a variable value, supporting dot notation.
 * e.g., getVariable(scope, "hotel.perNight") returns 180
 */
export function getVariable(scope: Scope, path: string): unknown {
  const parts = path.split('.')

  let current: unknown = scope.variables

  for (const part of parts) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Define a user function that can be called later.
 */
export function defineFunction(
  scope: Scope,
  name: string,
  params: string[],
  body: string
): void {
  scope.functions[name] = { params, body }
}

/**
 * Get all variable names at the top level (for building evaluation scope).
 */
export function getTopLevelVariables(scope: Scope): Record<string, unknown> {
  return { ...scope.variables }
}
