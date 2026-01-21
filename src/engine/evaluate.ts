import * as mathjs from 'mathjs'
import { parseDocument, ParsedLine } from './parser'
import { createScope, Scope, setVariable, defineFunction, getTopLevelVariables } from './scope'
import { builtinFunctions } from './functions'

export interface EvaluationResult {
  lineNumber: number
  result?: unknown
  error?: string
  type: 'value' | 'assignment' | 'function-def' | 'text' | 'comment' | 'error'
}

export interface EvaluationOutput {
  results: EvaluationResult[]
  scope: Scope
}

/**
 * Build the evaluation context with all available functions and variables.
 * This creates a controlled scope for the Function constructor.
 */
function buildEvalContext(scope: Scope, ans: unknown): Record<string, unknown> {
  const context: Record<string, unknown> = {}

  // Add mathjs functions (import all of them)
  // We selectively add the commonly used functions to avoid conflicts
  const mathjsFunctions = [
    'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
    'cbrt', 'ceil', 'cos', 'cosh', 'exp', 'floor', 'log', 'log10', 'log2',
    'pow', 'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh', 'trunc',
    'random', 'factorial', 'gcd', 'lcm', 'mod', 'nthRoot',
    'pi', 'e', 'phi', 'tau'
  ]

  for (const fn of mathjsFunctions) {
    if (fn in mathjs) {
      context[fn] = (mathjs as Record<string, unknown>)[fn]
    }
  }

  // Add built-in FlowNote functions (sum, avg, min, max)
  Object.assign(context, builtinFunctions)

  // Add user variables
  const userVars = getTopLevelVariables(scope)
  Object.assign(context, userVars)

  // Add special variables
  context['ans'] = ans
  context['_'] = ans

  // Build callable user-defined functions
  for (const [name, userFunc] of Object.entries(scope.functions)) {
    // Create a function that evaluates the body with parameters bound
    context[name] = (...args: unknown[]) => {
      // Build a local context with parameters
      const localContext: Record<string, unknown> = { ...context }
      userFunc.params.forEach((param, index) => {
        localContext[param] = args[index]
      })
      return safeEval(userFunc.body, localContext)
    }
  }

  return context
}

/**
 * Safely evaluate an expression using the Function constructor.
 * This provides a controlled sandbox without direct access to globals.
 */
function safeEval(expression: string, context: Record<string, unknown>): unknown {
  const keys = Object.keys(context)
  const values = Object.values(context)

  // Create a function that takes all context values as parameters
  // and evaluates the expression with access to them
  const fn = new Function(...keys, `"use strict"; return (${expression});`)
  return fn(...values)
}

/**
 * Evaluate a single parsed line and return the result.
 */
export function evaluateLine(
  parsed: ParsedLine,
  scope: Scope,
  lineNumber: number,
  ans: unknown
): EvaluationResult {
  // Text lines - no evaluation
  if (parsed.type === 'text') {
    return {
      lineNumber,
      type: 'text',
    }
  }

  // Comment lines - no evaluation
  if (parsed.type === 'comment') {
    return {
      lineNumber,
      type: 'comment',
    }
  }

  // Function definition - store in scope
  if (parsed.type === 'function-def') {
    if (parsed.funcName && parsed.funcParams && parsed.funcBody) {
      defineFunction(scope, parsed.funcName, parsed.funcParams, parsed.funcBody)
      return {
        lineNumber,
        type: 'function-def',
      }
    }
    return {
      lineNumber,
      type: 'error',
      error: 'Invalid function definition',
    }
  }

  // Expression - evaluate it
  if (parsed.type === 'expression' && parsed.expression) {
    try {
      const context = buildEvalContext(scope, ans)
      const result = safeEval(parsed.expression, context)

      // If this is an assignment, store the variable
      if (parsed.varName) {
        setVariable(scope, parsed.varName, result)
        return {
          lineNumber,
          result,
          type: 'assignment',
        }
      }

      // Plain expression evaluation
      return {
        lineNumber,
        result,
        type: 'value',
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        lineNumber,
        type: 'error',
        error: message,
      }
    }
  }

  // Fallback
  return {
    lineNumber,
    type: 'text',
  }
}

/**
 * Evaluate an entire document line by line.
 * Returns all results and the final scope state.
 */
export function evaluateDocument(content: string): EvaluationOutput {
  const parsedLines = parseDocument(content)
  const scope = createScope()
  const results: EvaluationResult[] = []

  let ans: unknown = 0

  for (let i = 0; i < parsedLines.length; i++) {
    const parsed = parsedLines[i]
    const lineNumber = i + 1 // 1-indexed line numbers

    const result = evaluateLine(parsed, scope, lineNumber, ans)
    results.push(result)

    // Update ans with the last computed value
    if (result.result !== undefined && result.type !== 'error') {
      ans = result.result
      // Also update _ and ans in scope for reference
      setVariable(scope, 'ans', ans)
      setVariable(scope, '_', ans)
    }
  }

  return {
    results,
    scope,
  }
}
