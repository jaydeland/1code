"use client"

import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { selectedCommandCategoryAtom } from "../atoms"
import { CommandFileList } from "./command-file-list"
import { CommandDetail } from "./command-detail"

/**
 * Main commands content area
 * Shows file list sidebar on left and detail panel on right
 * Displayed when the commands category is selected
 */
export function CommandsContent() {
  const selectedCategory = useAtomValue(selectedCommandCategoryAtom)

  // Debug logging
  useEffect(() => {
    console.log("[commands-content] Component mounted, category:", selectedCategory)
  }, [selectedCategory])

  // Safety check
  if (!selectedCategory) {
    console.warn("[commands-content] Rendered with no category selected")
    return null
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Debug indicator */}
      <div className="absolute top-4 right-4 z-50 px-3 py-1 bg-orange-500 text-white text-xs rounded">
        Commands: {selectedCategory}
      </div>

      {/* File List Sidebar */}
      <div className="w-[280px] border-r overflow-hidden bg-background flex-shrink-0">
        <CommandFileList />
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-hidden bg-background">
        <CommandDetail />
      </div>
    </div>
  )
}
