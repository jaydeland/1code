"use client"

import { useAtomValue } from "jotai"
import { ChevronRight, RefreshCw, Bot, Cpu } from "lucide-react"
import { selectedAgentDefAtom, selectedAgentDefCategoryAtom } from "../atoms"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"

/**
 * Badge component to show the source of an agent
 */
function SourceBadge({ source }: { source: "user" | "project" | "custom" }) {
  const colors = {
    project: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    user: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    custom: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  }

  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-md font-medium uppercase tracking-wide border",
        colors[source],
      )}
    >
      {source}
    </span>
  )
}

/**
 * Header for agent detail panel
 * Shows breadcrumb, source badge, and model info
 */
export function AgentDetailHeader() {
  const selectedAgent = useAtomValue(selectedAgentDefAtom)
  const selectedCategory = useAtomValue(selectedAgentDefCategoryAtom)
  const utils = trpc.useUtils()

  const handleRefresh = async () => {
    await utils.agents.list.invalidate()
    console.log("[agents-defs] Refreshed agents list")
  }

  if (!selectedAgent) return null

  return (
    <div className="border-b bg-background p-4 space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="h-3 w-3" />
        <span>Agents</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{selectedAgent.name}</span>
      </div>

      {/* Agent Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SourceBadge source={selectedAgent.source} />

          {selectedAgent.model && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Cpu className="h-3 w-3" />
              <span>{selectedAgent.model}</span>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          title="Refresh agents list"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Description */}
      {selectedAgent.description && (
        <p className="text-sm text-muted-foreground">
          {selectedAgent.description}
        </p>
      )}

      {/* File Path */}
      <div className="text-xs font-mono text-muted-foreground/60 truncate">
        {selectedAgent.path}
      </div>
    </div>
  )
}
