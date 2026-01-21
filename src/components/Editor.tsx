import { useEffect, useRef, useCallback } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import type { Theme } from '../hooks/useTheme'
import { flownoteLanguage } from '../editor/flownote-language'
import { lightSyntaxHighlighting, darkSyntaxHighlighting } from '../editor/flownote-theme'

interface EditorProps {
  initialValue: string
  onChange: (value: string) => void
  tabId?: string // Used to detect tab switches
  theme?: Theme
}

// Light theme colors
const lightTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#ffffff',
  },
  '.cm-scroller': {
    fontFamily:
      "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', Consolas, monospace",
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '1rem 0',
    caretColor: '#333',
  },
  '.cm-line': {
    padding: '0 1rem',
  },
  '.cm-gutters': {
    backgroundColor: '#fafafa',
    borderRight: '1px solid #e0e0e0',
    color: '#999',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f0f0f0',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#333',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#d7e8fc',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#d7e8fc',
  },
})

// Dark theme colors matching the CSS variables
const darkTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#1a1a2e',
  },
  '.cm-scroller': {
    fontFamily:
      "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', Consolas, monospace",
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '1rem 0',
    caretColor: '#e4e4e7',
  },
  '.cm-line': {
    padding: '0 1rem',
  },
  '.cm-gutters': {
    backgroundColor: '#16213e',
    borderRight: '1px solid #2a2a4a',
    color: '#71717a',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#252545',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#e4e4e7',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#3b4a6b',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#3b4a6b',
  },
})

export default function Editor({ initialValue, onChange, tabId, theme = 'light' }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartmentRef = useRef<Compartment>(new Compartment())
  const highlightCompartmentRef = useRef<Compartment>(new Compartment())

  // Memoize the onChange handler
  const handleChange = useCallback(
    (value: string) => {
      onChange(value)
    },
    [onChange]
  )

  // Update theme and syntax highlighting when theme changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: [
          themeCompartmentRef.current.reconfigure(
            theme === 'dark' ? darkTheme : lightTheme
          ),
          highlightCompartmentRef.current.reconfigure(
            theme === 'dark' ? darkSyntaxHighlighting : lightSyntaxHighlighting
          ),
        ],
      })
    }
  }, [theme])

  useEffect(() => {
    if (!editorRef.current) return

    // Create the editor state
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        flownoteLanguage,
        highlightCompartmentRef.current.of(
          theme === 'dark' ? darkSyntaxHighlighting : lightSyntaxHighlighting
        ),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
        }),
        themeCompartmentRef.current.of(theme === 'dark' ? darkTheme : lightTheme),
      ],
    })

    // Create the editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    // Cleanup
    return () => {
      view.destroy()
    }
  }, [tabId]) // Re-create editor when tabId changes

  return <div ref={editorRef} className="editor" />
}
