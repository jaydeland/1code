"use client"

import { useAtomValue } from "jotai"
import { selectedAgentDefAtom } from "../atoms"
import { AgentDetailHeader } from "./agent-detail-header"
import { AgentMarkdownView } from "./agent-markdown-view"

/**
 * Detail panel for viewing agent file content
 * Shows header with agent info and markdown view of the file
 */
export function AgentDetail() {
  const selectedAgent = useAtomValue(selectedAgentDefAtom)

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Select an agent to view details
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <AgentDetailHeader />
      <AgentMarkdownView />
    </div>
  )
}
