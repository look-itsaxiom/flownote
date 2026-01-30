import { StreamLanguage } from '@codemirror/language'

/**
 * FlowNote language definition for CodeMirror
 *
 * This defines a simple tokenizer that highlights:
 * - Comments (# or //)
 * - Numbers (integers and decimals)
 * - Operators (+, -, *, /, etc.)
 * - Function calls (identifiers followed by parentheses)
 * - Variable names (identifiers)
 * - Parentheses
 */
export const flownoteLanguage = StreamLanguage.define({
  token(stream) {
    // Skip whitespace
    if (stream.eatSpace()) {
      return null
    }

    // Comments: # or // to end of line
    if (stream.match(/^(#|\/\/).*$/)) {
      return 'comment'
    }

    // Strings: double or single quoted
    if (stream.match(/^"[^"]*"/)) {
      return 'string'
    }
    if (stream.match(/^'[^']*'/)) {
      return 'string'
    }

    // Numbers: integers, decimals, and scientific notation
    // Also handles negative numbers when preceded by operator or start
    if (stream.match(/^-?\d+\.?\d*([eE][+-]?\d+)?/)) {
      return 'number'
    }

    // Operators: arithmetic, comparison, assignment
    if (stream.match(/^[+\-*/%^=<>!&|]+/)) {
      return 'operator'
    }

    // Function calls: identifier followed by opening parenthesis
    // Uses lookahead to not consume the parenthesis
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/)) {
      return 'function'
    }

    // Variable names / identifiers
    // Can include dots for property access (e.g., math.pi)
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_.]*/)) {
      return 'variableName'
    }

    // Parentheses and brackets
    if (stream.match(/^[()[\]{}]/)) {
      return 'paren'
    }

    // Comma separator
    if (stream.match(/^,/)) {
      return 'punctuation'
    }

    // If nothing matched, consume one character and move on
    stream.next()
    return null
  },
})
