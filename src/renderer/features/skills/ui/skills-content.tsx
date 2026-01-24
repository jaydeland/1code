"use client"

import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { selectedSkillCategoryAtom } from "../atoms"
import { SkillFileList } from "./skill-file-list"
import { SkillDetail } from "./skill-detail"

/**
 * Main skills content area
 * Shows file list sidebar on left and detail panel on right
 * Displayed when a skill category is selected
 */
export function SkillsContent() {
  const selectedCategory = useAtomValue(selectedSkillCategoryAtom)

  // Debug logging
  useEffect(() => {
    console.log("[skills-content] Component mounted, category:", selectedCategory)
  }, [selectedCategory])

  // Safety check
  if (!selectedCategory) {
    console.warn("[skills-content] Rendered with no category selected")
    return null
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Debug indicator */}
      <div className="absolute top-4 right-4 z-50 px-3 py-1 bg-emerald-500 text-white text-xs rounded">
        Skills
      </div>

      {/* File List Sidebar */}
      <div className="w-[280px] border-r overflow-hidden bg-background flex-shrink-0">
        <SkillFileList />
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-hidden bg-background">
        <SkillDetail />
      </div>
    </div>
  )
}
