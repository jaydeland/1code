/**
 * State management for agents definition view
 * These atoms control the category selection, file list, and detail panel views
 */
import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// ============================================
// AGENT DEF CATEGORY SELECTION
// ============================================

/**
 * Selected agent definition category
 * null = show normal chat interface
 * "agents" = show agent file browser
 */
export const selectedAgentDefCategoryAtom = atom<"agents" | null>(null)

// ============================================
// AGENT DEF SELECTION
// ============================================

/**
 * Represents a selected agent definition for detail view
 */
export interface SelectedAgentDef {
  name: string
  path: string
  source: "user" | "project" | "custom"
  description?: string
  model?: string
}

/**
 * Currently selected agent definition for detail panel
 * null = no agent selected
 */
export const selectedAgentDefAtom = atom<SelectedAgentDef | null>(null)

// ============================================
// FILE LIST SIDEBAR
// ============================================

/**
 * Search query for filtering agent file list
 * Filters by name or description
 */
export const agentDefFileListSearchAtom = atom<string>("")

/**
 * Width of the file list sidebar in pixels
 * Persisted to localStorage as "agents-defs:file-list-width"
 */
export const agentDefFileListWidthAtom = atomWithStorage<number>(
  "agents-defs:file-list-width",
  280,
  undefined,
  { getOnInit: true }
)
