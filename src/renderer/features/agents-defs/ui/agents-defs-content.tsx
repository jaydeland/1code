"use client"

import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { selectedAgentDefCategoryAtom } from "../atoms"
import { AgentFileList } from "./agent-file-list"
import { AgentDetail } from "./agent-detail"

/**
 * Main agents definition content area
 * Shows file list sidebar on left and detail panel on right
 * Displayed when "agents" category is selected from the sidebar
 */
export function AgentsDefsContent() {
  const selectedCategory = useAtomValue(selectedAgentDefCategoryAtom)

  // Debug logging
  useEffect(() => {
    console.log("[agents-defs-content] Component mounted, category:", selectedCategory)
  }, [selectedCategory])

  // Safety check
  if (!selectedCategory) {
    console.warn("[agents-defs-content] Rendered with no category selected")
    return null
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Debug indicator */}
      <div className="absolute top-4 right-4 z-50 px-3 py-1 bg-blue-500 text-white text-xs rounded">
        Agents: {selectedCategory}
      </div>

      {/* File List Sidebar */}
      <div className="w-[280px] border-r overflow-hidden bg-background flex-shrink-0">
        <AgentFileList />
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-hidden bg-background">
        <AgentDetail />
      </div>
    </div>
  )
}
