// localStorage wrapper for note persistence

const STORAGE_KEY = 'flownote_note'

export interface StoredNote {
  content: string
  updatedAt: number
}

export function saveNote(content: string): void {
  const note: StoredNote = {
    content,
    updatedAt: Date.now(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(note))
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('Failed to save note:', e)
  }
}

export function loadNote(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  try {
    const note: StoredNote = JSON.parse(stored)
    return note.content
  } catch {
    return null
  }
}

export function clearNote(): void {
  localStorage.removeItem(STORAGE_KEY)
}
