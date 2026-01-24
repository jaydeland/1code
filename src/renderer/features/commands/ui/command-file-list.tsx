"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useAtom, useAtomValue } from "jotai"
import { Search, Loader2, Terminal } from "lucide-react"
import { trpc } from "../../../lib/trpc"
import { selectedCommandNodeAtom, type CommandNode } from "../atoms"
import { selectedProjectAtom } from "../../agents/atoms"
import { cn } from "../../../lib/utils"
import { Input } from "../../../components/ui/input"

/**
 * Badge component to show the source of a command
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
        "text-[10px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide",
        colors[source],
      )}
    >
      {source}
    </span>
  )
}

/**
 * File list sidebar for commands
 * Shows filtered list of commands with search capability
 */
export function CommandFileList() {
  const [selectedNode, setSelectedNode] = useAtom(selectedCommandNodeAtom)
  const selectedProject = useAtomValue(selectedProjectAtom)
  const [searchQuery, setSearchQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch commands using tRPC
  const { data: commands, isLoading, error } = trpc.commands.list.useQuery(
    { projectPath: selectedProject?.path },
    {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  )

  // Debug logging
  useEffect(() => {
    console.log("[command-file-list] Component mounted")
    console.log("[command-file-list] isLoading:", isLoading, "hasData:", !!commands, "error:", error)
    if (commands) {
      console.log("[command-file-list] Commands count:", commands.length)
    }
  }, [isLoading, commands, error])

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!commands) return []
    if (!searchQuery.trim()) return commands

    const query = searchQuery.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query)
    )
  }, [commands, searchQuery])

  // Group commands by namespace (prefix before colon)
  const groupedCommands = useMemo(() => {
    const groups: Record<string, typeof filteredCommands> = {}

    for (const cmd of filteredCommands) {
      const colonIndex = cmd.name.indexOf(":")
      const namespace = colonIndex > 0 ? cmd.name.slice(0, colonIndex) : "General"

      if (!groups[namespace]) {
        groups[namespace] = []
      }
      groups[namespace].push(cmd)
    }

    return groups
  }, [filteredCommands])

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

  const handleCommandClick = (cmd: typeof commands[number]) => {
    setSelectedNode({
      id: cmd.name,
      name: cmd.name,
      description: cmd.description || "",
      source: cmd.source,
      sourcePath: cmd.path,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="p-3 border-b space-y-3">
        <h3 className="text-sm font-semibold">Commands</h3>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Command List */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4 text-center text-sm text-destructive">
            Error loading commands: {error.message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? "No results found" : "No commands found"}
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(groupedCommands).map(([namespace, cmds]) => (
              <div key={namespace} className="mb-3">
                <div className="flex items-center h-6 mb-1 px-3">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    {namespace}
                  </h4>
                </div>
                {cmds.map((cmd) => (
                  <button
                    key={cmd.path}
                    onClick={() => handleCommandClick(cmd)}
                    className={cn(
                      "flex flex-col items-start w-full px-3 py-2 text-left transition-colors",
                      selectedNode?.sourcePath === cmd.path
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Terminal className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate flex-1">
                        /{cmd.name}
                      </span>
                      <SourceBadge source={cmd.source} />
                    </div>
                    {cmd.description && (
                      <div className="text-xs text-muted-foreground truncate w-full mt-0.5 pl-6">
                        {cmd.description}
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
