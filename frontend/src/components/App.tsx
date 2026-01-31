import { useState, useCallback, useRef, useEffect } from 'react'
import Editor from './Editor'
import ResultsPane from './ResultsPane'
import VariableBar from './VariableBar'
import TabBar from './TabBar'
import GlobalVariablesPanel, { GlobeIcon } from './GlobalVariablesPanel'
import { LoginButton, UserMenu } from './auth'
import { AdBanner } from './ads'
import { evaluateDocument, EvaluationResult } from '../engine/evaluate'
import { Scope } from '../engine/scope'
import {
  Tab,
  loadTabs,
  saveTabs,
  createTab,
  updateTabContent,
  loadGlobalVariables,
  setGlobalVariable,
  deleteGlobalVariable,
} from '../storage/local'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

// Sun icon for light mode (click to switch to dark)
function SunIcon() {
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
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

// Moon icon for dark mode (click to switch to light)
function MoonIcon() {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// Load initial data from localStorage
function getInitialData(): { tabs: Tab[]; activeTabId: string } {
  return loadTabs()
}

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => getInitialData().tabs)
  const [activeTabId, setActiveTabId] = useState<string>(() => getInitialData().activeTabId)
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [scope, setScope] = useState<Scope>({ variables: {}, functions: {} })
  const [globalVariables, setGlobalVariables] = useState<Record<string, unknown>>(() => loadGlobalVariables())
  const [isGlobalPanelOpen, setIsGlobalPanelOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { user, loading: authLoading, loginWithGoogle, loginWithGithub, logout } = useAuth()

  // Get the active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0]
  const lineCount = activeTab ? activeTab.content.split('\n').length : 0

  // Refs for scroll sync
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  // Debounce timer refs
  const evalDebounceRef = useRef<number | null>(null)
  const saveDebounceRef = useRef<number | null>(null)

  // Evaluate on content change (debounced)
  const handleContentChange = useCallback(
    (newContent: string) => {
      // Update the active tab's content in state
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, content: newContent, updatedAt: Date.now() }
            : tab
        )
      )

      // Debounce evaluation (150ms)
      if (evalDebounceRef.current) {
        clearTimeout(evalDebounceRef.current)
      }
      evalDebounceRef.current = window.setTimeout(() => {
        const output = evaluateDocument(newContent, globalVariables)
        setResults(output.results)
        setScope(output.scope)
      }, 150)

      // Debounce save (500ms - slightly longer to reduce writes)
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      saveDebounceRef.current = window.setTimeout(() => {
        updateTabContent(activeTabId, newContent)
      }, 500)
    },
    [activeTabId, globalVariables]
  )

  // Handle tab selection
  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    // Save the active tab change to localStorage
    setTabs((prevTabs) => {
      saveTabs(prevTabs, tabId)
      return prevTabs
    })
  }, [])

  // Handle adding a new tab
  const handleTabAdd = useCallback(() => {
    const newTab = createTab()
    setTabs((prevTabs) => {
      const newTabs = [...prevTabs, newTab]
      saveTabs(newTabs, newTab.id)
      return newTabs
    })
    setActiveTabId(newTab.id)
  }, [])

  // Handle closing a tab
  const handleTabClose = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) {
        return // Cannot close the last tab
      }

      const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
      const newTabs = tabs.filter((tab) => tab.id !== tabId)

      let newActiveTabId = activeTabId
      // If closing the active tab, switch to an adjacent one
      if (activeTabId === tabId) {
        const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0
        newActiveTabId = newTabs[newActiveIndex].id
      }

      setTabs(newTabs)
      setActiveTabId(newActiveTabId)
      saveTabs(newTabs, newActiveTabId)
    },
    [tabs, activeTabId]
  )

  // Handle renaming a tab
  const handleTabRename = useCallback(
    (tabId: string, newName: string) => {
      setTabs((prevTabs) => {
        const newTabs = prevTabs.map((tab) =>
          tab.id === tabId ? { ...tab, name: newName, updatedAt: Date.now() } : tab
        )
        saveTabs(newTabs, activeTabId)
        return newTabs
      })
    },
    [activeTabId]
  )

  // Initial evaluation when active tab changes or global variables change
  useEffect(() => {
    if (activeTab) {
      const output = evaluateDocument(activeTab.content, globalVariables)
      setResults(output.results)
      setScope(output.scope)
    }
  }, [activeTabId, globalVariables])

  // Global variables handlers
  const handleGlobalPanelOpen = useCallback(() => {
    setIsGlobalPanelOpen(true)
  }, [])

  const handleGlobalPanelClose = useCallback(() => {
    setIsGlobalPanelOpen(false)
  }, [])

  const handleGlobalVariableSave = useCallback((name: string, value: unknown) => {
    setGlobalVariable(name, value)
    setGlobalVariables(loadGlobalVariables())
  }, [])

  const handleGlobalVariableDelete = useCallback((name: string) => {
    deleteGlobalVariable(name)
    setGlobalVariables(loadGlobalVariables())
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
  }, [activeTabId])

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">FlowNote</h1>
        <div className="app-header__actions">
          <button
            className="app-header__settings"
            aria-label="Global constants"
            title="Global constants"
            onClick={handleGlobalPanelOpen}
          >
            <GlobeIcon />
          </button>
          <button
            className="app-header__settings"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          {/* Auth UI */}
          {!authLoading && (
            user ? (
              <UserMenu user={user} onLogout={logout} />
            ) : (
              <LoginButton
                onLoginGoogle={loginWithGoogle}
                onLoginGithub={loginWithGithub}
              />
            )
          )}
        </div>
      </header>

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabAdd={handleTabAdd}
        onTabClose={handleTabClose}
        onTabRename={handleTabRename}
      />

      <main className="app-main">
        <div className="editor-results-container">
          <div ref={editorContainerRef} className="editor-wrapper">
            <Editor
              key={activeTabId}
              initialValue={activeTab?.content || ''}
              onChange={handleContentChange}
              tabId={activeTabId}
              theme={theme}
            />
          </div>
          <div ref={resultsContainerRef} className="results-wrapper">
            <ResultsPane results={results} lineCount={lineCount} />
          </div>
        </div>
      </main>

      <VariableBar variables={scope.variables} />

      {/* Ad Banner - only shown for free tier logged-in users */}
      <AdBanner userTier={user?.tier} showFallback />

      <GlobalVariablesPanel
        isOpen={isGlobalPanelOpen}
        onClose={handleGlobalPanelClose}
        globalVariables={globalVariables}
        onSave={handleGlobalVariableSave}
        onDelete={handleGlobalVariableDelete}
      />
    </div>
  )
}
