"use client"

import React from "react"
import { useAtomValue } from "jotai"
import { Terminal, ChevronRight, RefreshCw } from "lucide-react"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import { selectedCommandNodeAtom } from "../atoms"
import { CommandMarkdownView } from "./command-markdown-view"

/**
 * Badge component to show the source of a command
 */
function SourceBadge({ source }: { source: "user" | "project" | "custom" }) {
  const colors = {
    project: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    user: "bg-green-500/10 text-green-600 dark:text-green-400",
    custom: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }

  const labels = {
    project: "Project",
    user: "User",
    custom: "Custom",
  }

  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-full font-medium",
        colors[source],
      )}
    >
      {labels[source]}
    </span>
  )
}

/**
 * Header for command detail panel
 * Shows breadcrumb and actions
 */
function CommandDetailHeader() {
  const selectedNode = useAtomValue(selectedCommandNodeAtom)
  const utils = trpc.useUtils()

  const handleRefresh = async () => {
    await utils.commands.list.invalidate()
    console.log("[commands] Refreshed commands list")
  }

  if (!selectedNode) return null

  return (
    <div className="border-b bg-background p-4 space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Commands</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">/{selectedNode.name}</span>
      </div>

      {/* Header with info and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Terminal className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">/{selectedNode.name}</h2>
            {selectedNode.description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedNode.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceBadge source={selectedNode.source} />
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="Refresh commands list"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}

export function CommandDetail() {
  const selectedNode = useAtomValue(selectedCommandNodeAtom)

  if (!selectedNode) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <Terminal className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">Select a command to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <CommandDetailHeader />
      <CommandMarkdownView />
    </div>
  )
}
