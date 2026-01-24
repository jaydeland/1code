"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Search, Loader2 } from "lucide-react"
import { trpc } from "../../../lib/trpc"
import {
  selectedAgentDefCategoryAtom,
  selectedAgentDefAtom,
  agentDefFileListSearchAtom,
  type SelectedAgentDef,
} from "../atoms"
import { selectedProjectAtom } from "../../agents/atoms"
import { cn } from "../../../lib/utils"
import { Input } from "../../../components/ui/input"

/**
 * Badge component to show the source of an agent
 */
function SourceBadge({ source }: { source: "user" | "project" | "custom" }) {
  const colors = {
    project: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    user: "bg-green-500/10 text-green-600 dark:text-green-400",
    custom: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  }

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide flex-shrink-0",
        colors[source],
      )}
    >
      {source}
    </span>
  )
}

/**
 * File list sidebar for agent definitions
 * Shows list of agents grouped by source (project/user/custom)
 */
export function AgentFileList() {
  const selectedCategory = useAtomValue(selectedAgentDefCategoryAtom)
  const [selectedAgent, setSelectedAgent] = useAtom(selectedAgentDefAtom)
  const [searchQuery, setSearchQuery] = useAtom(agentDefFileListSearchAtom)
  const selectedProject = useAtomValue(selectedProjectAtom)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch agents using tRPC
  const { data: agents, isLoading, error } = trpc.agents.list.useQuery(
    { cwd: selectedProject?.path },
    {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  )

  // Debug logging
  useEffect(() => {
    console.log("[agent-file-list] Component mounted, category:", selectedCategory)
    console.log("[agent-file-list] isLoading:", isLoading, "hasData:", !!agents, "error:", error)
    if (agents) {
      console.log("[agent-file-list] Agent count:", agents.length)
    }
  }, [selectedCategory, isLoading, agents, error])

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!agents) return []
    if (!searchQuery.trim()) return agents

    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
    )
  }, [agents, searchQuery])

  // Group agents by source
  const groupedAgents = useMemo(() => {
    const groups: Record<string, typeof filteredAgents> = {
      project: [],
      user: [],
      custom: [],
    }

    for (const agent of filteredAgents) {
      groups[agent.source].push(agent)
    }

    return groups
  }, [filteredAgents])

  const sourceLabels: Record<string, string> = {
    project: "Project Agents",
    user: "User Agents",
    custom: "Custom Agents",
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Clear search when category changes
  useEffect(() => {
    setSearchQuery("")
  }, [selectedCategory, setSearchQuery])

  const handleAgentClick = (agent: typeof filteredAgents[0]) => {
    setSelectedAgent({
      name: agent.name,
      path: agent.path,
      source: agent.source,
      description: agent.description,
      model: agent.model,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="p-3 border-b space-y-3">
        <h3 className="text-sm font-semibold">
          Agents
        </h3>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-sm text-destructive">
            Error loading agents: {error.message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No results found" : "No agents found"}
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(groupedAgents)
              .filter(([_, agentList]) => agentList.length > 0)
              .map(([source, agentList]) => (
                <div key={source} className="mb-2">
                  {/* Group Header */}
                  <div className="px-3 py-1">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {sourceLabels[source]}
                    </h4>
                  </div>

                  {/* Agent Items */}
                  {agentList.map(agent => (
                    <button
                      key={agent.path}
                      onClick={() => handleAgentClick(agent)}
                      className={cn(
                        "flex flex-col items-start w-full px-3 py-2 text-left transition-colors",
                        selectedAgent?.path === agent.path
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="text-sm font-medium truncate flex-1">
                          {agent.name}
                        </div>
                        <SourceBadge source={agent.source} />
                      </div>
                      {agent.description && (
                        <div className="text-xs text-muted-foreground truncate w-full mt-0.5">
                          {agent.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
