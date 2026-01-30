// Line type detection
export type LineType = 'expression' | 'comment' | 'text' | 'function-def'

export interface ParsedLine {
  type: LineType
  raw: string
  // For assignments: variable name and expression
  varName?: string
  expression?: string
  // For function definitions
  funcName?: string
  funcParams?: string[]
  funcBody?: string
}

// Pattern for function definitions: name(args) = expression
const FUNCTION_DEF_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*=\s*(.+)$/

// Pattern for assignments: varName = expression (supports dot notation)
const ASSIGNMENT_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*(.+)$/

// Check if a line looks like an expression (has operators, function calls, etc.)
function looksLikeExpression(line: string): boolean {
  // Has arithmetic operators (but not just a single = which is assignment)
  if (/[+\-*/%^]/.test(line)) return true
  // Has function call pattern: identifier followed by parentheses
  if (/[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(line)) return true
  // Has comparison operators
  if (/[<>]=?|[!=]=/.test(line)) return true
  // Has assignment operator
  if (/=/.test(line)) return true
  // Is a number (possibly with decimal)
  if (/^\s*-?\d+\.?\d*\s*$/.test(line)) return true
  // Has variable reference (identifier)
  if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(line.trim())) return true
  return false
}

export function parseLine(line: string): ParsedLine {
  const trimmed = line.trim()

  // Empty lines are text
  if (trimmed === '') {
    return { type: 'text', raw: line }
  }

  // Comments: starts with # or //
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return { type: 'comment', raw: line }
  }

  // Function definition: name(args) = expression
  const funcMatch = trimmed.match(FUNCTION_DEF_PATTERN)
  if (funcMatch) {
    const [, funcName, paramsStr, funcBody] = funcMatch
    const funcParams = paramsStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '')
    return {
      type: 'function-def',
      raw: line,
      funcName,
      funcParams,
      funcBody,
    }
  }

  // Assignment: varName = expression (but not comparison like ==)
  // Make sure we don't match == or != as assignments
  const assignmentMatch = trimmed.match(ASSIGNMENT_PATTERN)
  if (assignmentMatch) {
    const [, varName, expression] = assignmentMatch
    // Make sure the = is not part of == or !=
    const eqIndex = trimmed.indexOf('=')
    if (
      eqIndex > 0 &&
      trimmed[eqIndex - 1] !== '!' &&
      trimmed[eqIndex - 1] !== '=' &&
      trimmed[eqIndex + 1] !== '='
    ) {
      return {
        type: 'expression',
        raw: line,
        varName,
        expression,
      }
    }
  }

  // Check if it looks like an expression without assignment
  if (looksLikeExpression(trimmed)) {
    return {
      type: 'expression',
      raw: line,
      expression: trimmed,
    }
  }

  // Everything else is text
  return { type: 'text', raw: line }
}

export function parseDocument(content: string): ParsedLine[] {
  const lines = content.split('\n')
  return lines.map((line) => parseLine(line))
}
