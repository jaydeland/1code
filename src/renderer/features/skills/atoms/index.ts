/**
 * State management for skills content view
 * These atoms control the category selection and skill selection
 */
import { atom } from "jotai"

// ============================================
// SKILLS CATEGORY SELECTION
// ============================================

/**
 * Selected skills category
 * null = show normal interface
 * "skills" = show skills file browser
 */
export const selectedSkillCategoryAtom = atom<"skills" | null>(null)

// ============================================
// SKILL SELECTION
// ============================================

/**
 * Currently selected skill for detail view
 * Stores the full skill path (e.g., /Users/.../.claude/skills/my-skill/SKILL.md)
 */
export const selectedSkillAtom = atom<string | null>(null)

/**
 * Search query for filtering skill list
 */
export const skillFileListSearchAtom = atom<string>("")
