"use client"

import { useMemo, useState, useEffect } from "react"
import { useAtomValue } from "jotai"
import { createHighlighter, type Highlighter } from "shiki"
import { selectedAgentDefAtom } from "../atoms"
import { trpc } from "../../../lib/trpc"
import { Loader2 } from "lucide-react"

/**
 * Markdown view for agent files
 * Shows raw markdown content with syntax highlighting
 */
export function AgentMarkdownView() {
  const selectedAgent = useAtomValue(selectedAgentDefAtom)
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  // Initialize Shiki highlighter
  useEffect(() => {
    let mounted = true

    async function initHighlighter() {
      try {
        const h = await createHighlighter({
          themes: ["dark-plus"],
          langs: ["markdown"],
        })

        if (mounted) {
          setHighlighter(h)
        }
      } catch (err) {
        console.error("[agent-markdown] Failed to initialize Shiki:", err)
      }
    }

    initHighlighter()

    return () => {
      mounted = false
    }
  }, [])

  // Fetch file content
  const { data: fileContent, isLoading, error } = trpc.agents.readFileContent.useQuery(
    { path: selectedAgent?.path || "" },
    { enabled: !!selectedAgent?.path }
  )

  // Syntax highlighted markdown
  const highlightedHtml = useMemo(() => {
    if (!fileContent || !highlighter) return null

    try {
      return highlighter.codeToHtml(fileContent, {
        lang: "markdown",
        theme: "dark-plus",
      })
    } catch (err) {
      console.error("[agent-markdown] Failed to highlight code:", err)
      return null
    }
  }, [fileContent, highlighter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-destructive">
          Failed to load file: {error.message}
        </p>
      </div>
    )
  }

  if (!fileContent) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Failed to load file</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-4">
        {/* Syntax Highlighted Markdown Content */}
        <div className="border rounded-lg bg-[#1e1e1e] overflow-hidden">
          {highlightedHtml ? (
            <div
              className="shiki-container overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="p-4 overflow-x-auto text-xs font-mono text-gray-300">
              <code>{fileContent}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
