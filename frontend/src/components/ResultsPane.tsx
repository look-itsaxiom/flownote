import { EvaluationResult } from '../engine/evaluate'
import ResultLine from './ResultLine'

interface ResultsPaneProps {
  results: EvaluationResult[]
  lineCount: number
}

export default function ResultsPane({ results, lineCount }: ResultsPaneProps) {
  // Create a map of line number to result for quick lookup
  const resultMap = new Map<number, EvaluationResult>()
  for (const result of results) {
    resultMap.set(result.lineNumber, result)
  }

  // Generate result lines for each line in the document
  const lines: React.ReactNode[] = []
  for (let i = 1; i <= lineCount; i++) {
    const result = resultMap.get(i)
    let value: unknown = undefined

    if (result) {
      if (result.type === 'error' && result.error) {
        value = new Error(result.error)
      } else if (result.type === 'value' || result.type === 'assignment') {
        value = result.result
      }
      // text, comment, and function-def types don't show results
    }

    lines.push(
      <div key={i} className="results-pane__line">
        <ResultLine value={value} />
      </div>
    )
  }

  return <div className="results-pane">{lines}</div>
}
