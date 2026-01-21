import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from './Editor'
import ResultsPane from './ResultsPane'
import VariableBar from './VariableBar'
import { evaluateDocument, EvaluationResult } from '../engine/evaluate'
import { Scope } from '../engine/scope'
import { loadNote, saveNote } from '../storage/local'

const EXAMPLE_NOTE = `Planning trip to Seattle

flights = 450
hotel.perNight = 180
hotel.nights = 4
hotel.total = hotel.perNight * hotel.nights

food.budget = 75 * hotel.nights
activities = 200

total = sum(flights, hotel.total, food.budget, activities)

// Define a tip calculator function
tip(amount, pct) = amount * pct / 100

dinner = 85
tip(dinner, 20)

// Use mathjs functions
sqrt(16) + pow(2, 3)
`

// Load initial content from localStorage or use example
function getInitialContent(): string {
  const stored = loadNote()
  return stored !== null ? stored : EXAMPLE_NOTE
}

export default function App() {
  const [content, setContent] = useState(getInitialContent)
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [scope, setScope] = useState<Scope>({ variables: {}, functions: {} })
  const [lineCount, setLineCount] = useState(() => getInitialContent().split('\n').length)

  // Refs for scroll sync
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Debounce timer refs
  const evalDebounceRef = useRef<number | null>(null)
  const saveDebounceRef = useRef<number | null>(null)

  // Evaluate on content change (debounced)
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setLineCount(newContent.split('\n').length)

    // Debounce evaluation (150ms)
    if (evalDebounceRef.current) {
      clearTimeout(evalDebounceRef.current)
    }
    evalDebounceRef.current = window.setTimeout(() => {
      const output = evaluateDocument(newContent)
      setResults(output.results)
      setScope(output.scope)
    }, 150)

    // Debounce save (500ms - slightly longer to reduce writes)
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current)
    }
    saveDebounceRef.current = window.setTimeout(() => {
      saveNote(newContent)
    }, 500)
  }, [])

  // Initial evaluation
  useEffect(() => {
    const output = evaluateDocument(content)
    setResults(output.results)
    setScope(output.scope)
  }, [])

  // Sync scroll between editor and results
  useEffect(() => {
    const editorContainer = editorContainerRef.current
    const resultsContainer = resultsContainerRef.current

    if (!editorContainer || !resultsContainer) return

    const handleEditorScroll = () => {
      // Find the CodeMirror scroller inside the editor container
      const cmScroller = editorContainer.querySelector('.cm-scroller')
      if (cmScroller) {
        resultsContainer.scrollTop = cmScroller.scrollTop
      }
    }

    // We need to attach to the CodeMirror scroller, not our container
    // Use MutationObserver to wait for CodeMirror to mount
    const observer = new MutationObserver(() => {
      const cmScroller = editorContainer.querySelector('.cm-scroller')
      if (cmScroller) {
        cmScroller.addEventListener('scroll', handleEditorScroll)
        observer.disconnect()
      }
    })

    observer.observe(editorContainer, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      const cmScroller = editorContainer.querySelector('.cm-scroller')
      if (cmScroller) {
        cmScroller.removeEventListener('scroll', handleEditorScroll)
      }
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">FlowNote</h1>
        <button className="app-header__settings" aria-label="Settings">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="10" cy="10" r="3" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.5 1.5M15 15l1.5 1.5M3.5 16.5l1.5-1.5M15 5l1.5-1.5" />
          </svg>
        </button>
      </header>

      <main className="app-main">
        <div className="editor-results-container">
          <div ref={editorContainerRef} className="editor-wrapper">
            <Editor initialValue={content} onChange={handleContentChange} />
          </div>
          <div ref={resultsContainerRef} className="results-wrapper">
            <ResultsPane results={results} lineCount={lineCount} />
          </div>
        </div>
      </main>

      <VariableBar variables={scope.variables} />
    </div>
  )
}
