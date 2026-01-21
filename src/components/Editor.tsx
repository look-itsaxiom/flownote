import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

interface EditorProps {
  initialValue: string
  onChange: (value: string) => void
}

export default function Editor({ initialValue, onChange }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Memoize the onChange handler
  const handleChange = useCallback(
    (value: string) => {
      onChange(value)
    },
    [onChange]
  )

  useEffect(() => {
    if (!editorRef.current) return

    // Create the editor state
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '15px',
          },
          '.cm-scroller': {
            fontFamily:
              "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', Consolas, monospace",
            lineHeight: '1.6',
          },
          '.cm-content': {
            padding: '1rem 0',
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
          '&.cm-focused .cm-cursor': {
            borderLeftColor: '#333',
          },
          '&.cm-focused .cm-selectionBackground, ::selection': {
            backgroundColor: '#d7e8fc',
          },
        }),
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
  }, []) // Only run once on mount

  return <div ref={editorRef} className="editor" />
}
