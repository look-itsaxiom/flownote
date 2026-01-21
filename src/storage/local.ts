// localStorage wrapper for note persistence with multi-tab support

const STORAGE_KEY = 'flownote_data'

export interface Tab {
  id: string
  name: string
  content: string
  updatedAt: number
}

export interface StoredData {
  tabs: Tab[]
  activeTabId: string
  globalVariables: Record<string, unknown>
}

// Generate unique ID for tabs
function generateId(): string {
  return crypto.randomUUID()
}

// Default example content for new tabs
const EXAMPLE_CONTENT = `Planning trip to Seattle

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

// Create default data structure
function createDefaultData(): StoredData {
  const defaultTab: Tab = {
    id: generateId(),
    name: 'Note 1',
    content: EXAMPLE_CONTENT,
    updatedAt: Date.now(),
  }
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,
    globalVariables: {},
  }
}

// Load all data from localStorage
export function loadData(): StoredData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return createDefaultData()
  }

  try {
    const data: StoredData = JSON.parse(stored)
    // Validate data structure
    if (!data.tabs || !Array.isArray(data.tabs) || data.tabs.length === 0) {
      return createDefaultData()
    }
    // Ensure activeTabId is valid
    if (!data.tabs.find(tab => tab.id === data.activeTabId)) {
      data.activeTabId = data.tabs[0].id
    }
    return data
  } catch {
    return createDefaultData()
  }
}

// Save all data to localStorage
export function saveData(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save data:', e)
  }
}

// Save tabs and active tab ID
export function saveTabs(tabs: Tab[], activeTabId: string): void {
  const data = loadData()
  data.tabs = tabs
  data.activeTabId = activeTabId
  saveData(data)
}

// Load tabs from storage
export function loadTabs(): { tabs: Tab[]; activeTabId: string } {
  const data = loadData()
  return { tabs: data.tabs, activeTabId: data.activeTabId }
}

// Create a new tab
export function createTab(name?: string): Tab {
  const data = loadData()
  const tabNumber = data.tabs.length + 1
  const newTab: Tab = {
    id: generateId(),
    name: name || `Note ${tabNumber}`,
    content: '',
    updatedAt: Date.now(),
  }
  return newTab
}

// Delete a tab by ID (returns updated tabs array, or null if last tab)
export function deleteTab(tabId: string): { tabs: Tab[]; activeTabId: string } | null {
  const data = loadData()
  if (data.tabs.length <= 1) {
    return null // Cannot delete the last tab
  }

  const tabIndex = data.tabs.findIndex(tab => tab.id === tabId)
  if (tabIndex === -1) {
    return { tabs: data.tabs, activeTabId: data.activeTabId }
  }

  const newTabs = data.tabs.filter(tab => tab.id !== tabId)
  let newActiveTabId = data.activeTabId

  // If we're deleting the active tab, switch to an adjacent one
  if (data.activeTabId === tabId) {
    // Prefer the tab to the left, or the first tab if we're deleting index 0
    const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0
    newActiveTabId = newTabs[newActiveIndex].id
  }

  data.tabs = newTabs
  data.activeTabId = newActiveTabId
  saveData(data)

  return { tabs: newTabs, activeTabId: newActiveTabId }
}

// Rename a tab
export function renameTab(tabId: string, newName: string): Tab[] {
  const data = loadData()
  const tab = data.tabs.find(t => t.id === tabId)
  if (tab) {
    tab.name = newName
    tab.updatedAt = Date.now()
    saveData(data)
  }
  return data.tabs
}

// Update tab content
export function updateTabContent(tabId: string, content: string): void {
  const data = loadData()
  const tab = data.tabs.find(t => t.id === tabId)
  if (tab) {
    tab.content = content
    tab.updatedAt = Date.now()
    saveData(data)
  }
}

// Set active tab
export function setActiveTab(tabId: string): void {
  const data = loadData()
  if (data.tabs.find(t => t.id === tabId)) {
    data.activeTabId = tabId
    saveData(data)
  }
}

// Legacy support - these functions work with the old single-note format
// and can be removed once migration is complete

export interface StoredNote {
  content: string
  updatedAt: number
}

export function saveNote(content: string): void {
  // Now saves to the active tab
  const data = loadData()
  const tab = data.tabs.find(t => t.id === data.activeTabId)
  if (tab) {
    tab.content = content
    tab.updatedAt = Date.now()
    saveData(data)
  }
}

export function loadNote(): string | null {
  // Now loads from the active tab
  const data = loadData()
  const tab = data.tabs.find(t => t.id === data.activeTabId)
  return tab ? tab.content : null
}

export function clearNote(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// Global Variables (Constants) Management

/**
 * Load all global variables from storage
 */
export function loadGlobalVariables(): Record<string, unknown> {
  const data = loadData()
  return data.globalVariables || {}
}

/**
 * Save all global variables to storage
 */
export function saveGlobalVariables(vars: Record<string, unknown>): void {
  const data = loadData()
  data.globalVariables = vars
  saveData(data)
}

/**
 * Set a single global variable
 */
export function setGlobalVariable(name: string, value: unknown): void {
  const vars = loadGlobalVariables()
  vars[name] = value
  saveGlobalVariables(vars)
}

/**
 * Delete a single global variable
 */
export function deleteGlobalVariable(name: string): void {
  const vars = loadGlobalVariables()
  delete vars[name]
  saveGlobalVariables(vars)
}
