import { useState, useEffect, useRef, useCallback } from 'react'

interface GlobalVariablesPanelProps {
  isOpen: boolean
  onClose: () => void
  globalVariables: Record<string, unknown>
  onSave: (name: string, value: unknown) => void
  onDelete: (name: string) => void
}

// Validate variable name (must be valid JavaScript identifier)
function isValidVariableName(name: string): boolean {
  if (!name || name.trim() === '') return false
  // JavaScript identifier: starts with letter, underscore, or $, followed by letters, digits, underscores, or $
  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
  return validIdentifier.test(name)
}

// Parse value string into appropriate type
function parseValue(valueStr: string): { value: unknown; error?: string } {
  const trimmed = valueStr.trim()

  if (trimmed === '') {
    return { value: undefined, error: 'Value cannot be empty' }
  }

  // Try to parse as JSON first (handles numbers, booleans, null, arrays, objects)
  try {
    const parsed = JSON.parse(trimmed)
    return { value: parsed }
  } catch {
    // Not valid JSON, treat as string if it's quoted, or try as number
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      // It's a quoted string, extract the content
      return { value: trimmed.slice(1, -1) }
    }

    // Try parsing as a number
    const num = Number(trimmed)
    if (!isNaN(num)) {
      return { value: num }
    }

    // Check for boolean strings
    if (trimmed.toLowerCase() === 'true') return { value: true }
    if (trimmed.toLowerCase() === 'false') return { value: false }
    if (trimmed.toLowerCase() === 'null') return { value: null }

    // Treat as plain string
    return { value: trimmed }
  }
}

// Format value for display
function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

// Globe icon for the header button
export function GlobeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export default function GlobalVariablesPanel({
  isOpen,
  onClose,
  globalVariables,
  onSave,
  onDelete,
}: GlobalVariablesPanelProps) {
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Focus name input when panel opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [isOpen])

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Add listener with a slight delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingKey) {
          setEditingKey(null)
          setEditValue('')
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, editingKey])

  const handleAdd = useCallback(() => {
    setError(null)

    if (!isValidVariableName(newName)) {
      setError('Invalid variable name. Use letters, numbers, underscores, or $ (cannot start with number)')
      return
    }

    const { value, error: parseError } = parseValue(newValue)
    if (parseError) {
      setError(parseError)
      return
    }

    onSave(newName, value)
    setNewName('')
    setNewValue('')
    nameInputRef.current?.focus()
  }, [newName, newValue, onSave])

  const handleStartEdit = useCallback((key: string) => {
    setEditingKey(key)
    setEditValue(formatValue(globalVariables[key]))
    setError(null)
  }, [globalVariables])

  const handleSaveEdit = useCallback(() => {
    if (!editingKey) return

    setError(null)
    const { value, error: parseError } = parseValue(editValue)
    if (parseError) {
      setError(parseError)
      return
    }

    onSave(editingKey, value)
    setEditingKey(null)
    setEditValue('')
  }, [editingKey, editValue, onSave])

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null)
    setEditValue('')
    setError(null)
  }, [])

  const handleDelete = useCallback((key: string) => {
    onDelete(key)
    if (editingKey === key) {
      setEditingKey(null)
      setEditValue('')
    }
  }, [onDelete, editingKey])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, action: 'add' | 'edit') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (action === 'add') {
        handleAdd()
      } else {
        handleSaveEdit()
      }
    }
  }, [handleAdd, handleSaveEdit])

  if (!isOpen) return null

  const sortedKeys = Object.keys(globalVariables).sort()

  return (
    <div className="global-variables-overlay">
      <div className="global-variables-panel" ref={panelRef}>
        <div className="global-variables-panel__header">
          <h2 className="global-variables-panel__title">Global Constants</h2>
          <button
            className="global-variables-panel__close"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="global-variables-panel__description">
          Global constants are available in all tabs. Use SCREAMING_SNAKE_CASE by convention.
        </p>

        {error && (
          <div className="global-variables-panel__error">
            {error}
          </div>
        )}

        <div className="global-variables-panel__add">
          <input
            ref={nameInputRef}
            type="text"
            className="global-variables-panel__input global-variables-panel__input--name"
            placeholder="NAME"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
          />
          <span className="global-variables-panel__equals">=</span>
          <input
            type="text"
            className="global-variables-panel__input global-variables-panel__input--value"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
          />
          <button
            className="global-variables-panel__btn global-variables-panel__btn--add"
            onClick={handleAdd}
          >
            Add
          </button>
        </div>

        <div className="global-variables-panel__list">
          {sortedKeys.length === 0 ? (
            <p className="global-variables-panel__empty">
              No global constants defined yet.
            </p>
          ) : (
            sortedKeys.map((key) => (
              <div key={key} className="global-variables-panel__item">
                {editingKey === key ? (
                  <>
                    <span className="global-variables-panel__item-name">{key}</span>
                    <span className="global-variables-panel__equals">=</span>
                    <input
                      type="text"
                      className="global-variables-panel__input global-variables-panel__input--edit"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 'edit')}
                      autoFocus
                    />
                    <button
                      className="global-variables-panel__btn global-variables-panel__btn--save"
                      onClick={handleSaveEdit}
                    >
                      Save
                    </button>
                    <button
                      className="global-variables-panel__btn global-variables-panel__btn--cancel"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="global-variables-panel__item-name">{key}</span>
                    <span className="global-variables-panel__equals">=</span>
                    <span className="global-variables-panel__item-value">
                      {formatValue(globalVariables[key])}
                    </span>
                    <button
                      className="global-variables-panel__btn global-variables-panel__btn--edit"
                      onClick={() => handleStartEdit(key)}
                    >
                      Edit
                    </button>
                    <button
                      className="global-variables-panel__btn global-variables-panel__btn--delete"
                      onClick={() => handleDelete(key)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
