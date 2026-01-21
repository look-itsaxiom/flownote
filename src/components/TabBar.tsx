import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Tab } from '../storage/local'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onTabSelect: (tabId: string) => void
  onTabAdd: () => void
  onTabClose: (tabId: string) => void
  onTabRename: (tabId: string, newName: string) => void
}

export default function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabAdd,
  onTabClose,
  onTabRename,
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const handleDoubleClick = (tab: Tab) => {
    setEditingTabId(tab.id)
    setEditingName(tab.name)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value)
  }

  const handleInputBlur = () => {
    if (editingTabId && editingName.trim()) {
      onTabRename(editingTabId, editingName.trim())
    }
    setEditingTabId(null)
    setEditingName('')
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur()
    } else if (e.key === 'Escape') {
      setEditingTabId(null)
      setEditingName('')
    }
  }

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    onTabClose(tabId)
  }

  const canClose = tabs.length > 1

  return (
    <div className="tab-bar">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-bar__tab ${tab.id === activeTabId ? 'tab-bar__tab--active' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
          >
            {editingTabId === tab.id ? (
              <input
                ref={inputRef}
                type="text"
                className="tab-bar__input"
                value={editingName}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tab-bar__tab-name">{tab.name}</span>
            )}
            {canClose && (
              <button
                className="tab-bar__close"
                onClick={(e) => handleCloseClick(e, tab.id)}
                aria-label={`Close ${tab.name}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="tab-bar__add"
        onClick={onTabAdd}
        aria-label="Add new tab"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
      </button>
    </div>
  )
}
