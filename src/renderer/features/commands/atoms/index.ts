import { atom } from "jotai"

/**
 * State management for commands content view
 * These atoms control the category selection and command selection state
 */

// ============================================
// COMMAND CATEGORY SELECTION
// ============================================

/**
 * Selected command category
 * null = show normal chat interface
 * "commands" = show command file browser
 */
export const selectedCommandCategoryAtom = atom<"commands" | null>(null)

// ============================================
// COMMAND NODE SELECTION
// ============================================

/**
 * Represents a selected command node for the detail panel
 */
export interface CommandNode {
  id: string
  name: string
  description: string
  source: "user" | "project" | "custom"
  sourcePath: string
}

/**
 * Currently selected command node for detail panel
 * null = no command selected
 */
export const selectedCommandNodeAtom = atom<CommandNode | null>(null)
