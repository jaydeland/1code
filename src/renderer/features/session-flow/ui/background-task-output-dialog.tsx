"use client"

import { memo, useCallback, useState, useEffect, useRef, useMemo } from "react"
import { useAtom, useAtomValue } from "jotai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Download, CheckIcon, AlertCircle, Terminal, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  selectedBackgroundTaskAtom,
  backgroundTaskOutputDialogOpenAtom,
  sessionFlowBackgroundTasksAtom,
} from "../atoms"

interface BackgroundTaskOutputDialogProps {
  /** Chat ID - dialog closes when this changes */
  chatId?: string
}

// Format duration in human-readable format
function formatDuration(ms?: number): string {
  if (!ms || ms < 1000) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (remainingSeconds === 0) return `${minutes}m`
  return `${minutes}m ${remainingSeconds}s`
}

// Calculate elapsed time from start
function calculateElapsedTime(startTime: number): number {
  return Date.now() - startTime
}

export const BackgroundTaskOutputDialog = memo(function BackgroundTaskOutputDialog({
  chatId,
}: BackgroundTaskOutputDialogProps) {
  const [open, setOpen] = useAtom(backgroundTaskOutputDialogOpenAtom)
  const [selectedTask, setSelectedTask] = useAtom(selectedBackgroundTaskAtom)
  const [copied, setCopied] = useState(false)
  const prevChatIdRef = useRef(chatId)
  const outputEndRef = useRef<HTMLDivElement>(null)

  // For running tasks, track elapsed time
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  // Subscribe to the live task data from the derived atom
  // This ensures we get real-time updates as the task output streams in
  const allTasks = useAtomValue(sessionFlowBackgroundTasksAtom)

  // Find the current task in the live data
  const liveTask = useMemo(() => {
    if (!selectedTask) return null
    return allTasks.find(t => t.taskId === selectedTask.taskId) || selectedTask
  }, [allTasks, selectedTask])

  // Update elapsed time for running tasks
  useEffect(() => {
    if (!liveTask || liveTask.status !== "running") {
      return
    }

    // Update immediately
    setElapsedTime(calculateElapsedTime(liveTask.startTime))

    // Then update every second
    const interval = setInterval(() => {
      setElapsedTime(calculateElapsedTime(liveTask.startTime))
    }, 1000)

    return () => clearInterval(interval)
  }, [liveTask?.taskId, liveTask?.status, liveTask?.startTime])

  // Auto-scroll to bottom when output updates (for streaming)
  useEffect(() => {
    if (liveTask?.status === "running" && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [liveTask?.output, liveTask?.status])

  // Close dialog when chat changes to prevent showing stale data
  useEffect(() => {
    if (prevChatIdRef.current !== chatId && open) {
      setOpen(false)
      setSelectedTask(null)
    }
    prevChatIdRef.current = chatId
  }, [chatId, open, setOpen, setSelectedTask])

  const handleClose = useCallback(() => {
    setOpen(false)
    // Clear selection after dialog closes
    setTimeout(() => setSelectedTask(null), 200)
  }, [setOpen, setSelectedTask])

  const handleCopy = useCallback(async () => {
    if (!liveTask) return

    const content = liveTask.error || liveTask.output || ""
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }, [liveTask])

  const handleDownload = useCallback(() => {
    if (!liveTask) return

    const content = liveTask.error || liveTask.output || ""
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    link.download = `background-task-${liveTask.taskId}-${timestamp}.txt`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, [liveTask])

  // Compute display values (with fallbacks for when liveTask is null)
  const hasError = !!liveTask?.error
  const isRunning = liveTask?.status === "running"
  const rawContent = liveTask?.error || liveTask?.output || (isRunning ? "Waiting for output..." : "No output available")

  // Try to parse and pretty-print JSON for better readability
  const content = useMemo(() => {
    try {
      const parsed = JSON.parse(rawContent)
      return JSON.stringify(parsed, null, 2)
    } catch {
      // Not JSON, return as-is
      return rawContent
    }
  }, [rawContent])

  // Use live duration for completed tasks, elapsed time for running tasks
  const duration = isRunning
    ? formatDuration(elapsedTime)
    : formatDuration(liveTask?.duration)

  // Status badge variant
  const statusVariant = hasError
    ? "destructive"
    : liveTask?.status === "completed"
      ? "default"
      : "secondary"

  // Always render Dialog to ensure it can open when state changes
  // The Dialog's open prop controls visibility - don't use early return
  return (
    <Dialog open={open && !!selectedTask} onOpenChange={(newOpen) => {
      setOpen(newOpen)
      if (!newOpen) {
        // Clear selection after dialog closes
        setTimeout(() => setSelectedTask(null), 200)
      }
    }}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
        {liveTask && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {hasError && (
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="truncate">{liveTask.description}</span>
                {isRunning && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                )}
              </DialogTitle>
              <DialogDescription>
                Background task execution details
              </DialogDescription>
              {/* Metadata badges - moved outside DialogDescription to fix HTML nesting */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {liveTask.taskId}
                </Badge>
                <Badge
                  variant={statusVariant}
                  className={cn(
                    "text-[10px] capitalize",
                    isRunning && "animate-pulse"
                  )}
                >
                  {isRunning && (
                    <span className="mr-1 w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  )}
                  {liveTask.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Type: {liveTask.type}
                </span>
                {duration && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Duration: {duration}
                  </span>
                )}
                {liveTask.exitCode !== undefined && (
                  <span className={cn(
                    "text-xs tabular-nums",
                    liveTask.exitCode === 0 ? "text-green-600" : "text-red-600"
                  )}>
                    Exit: {liveTask.exitCode}
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* Command (if available) */}
            {liveTask.command && (
              <div className="border rounded-md bg-muted/30 px-3 py-2 flex-shrink-0">
                <div className="text-[10px] text-muted-foreground mb-1">Command</div>
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  <span className="text-amber-600 dark:text-amber-400">$ </span>
                  {liveTask.command.length > 500
                    ? liveTask.command.slice(0, 500) + "..."
                    : liveTask.command}
                </pre>
              </div>
            )}

            {/* Output content */}
            <div className={cn(
              "flex-1 overflow-y-auto border rounded-md bg-muted/30",
              isRunning && "border-primary/30"
            )}>
              <div className="relative">
                {isRunning && (
                  <div className="sticky top-0 right-0 float-right flex items-center gap-1.5 text-xs text-primary bg-background/90 px-2 py-1 rounded m-2 border border-primary/20">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Streaming...</span>
                  </div>
                )}
                <pre className="text-xs font-mono p-4 whitespace-pre-wrap break-words">
                  {content}
                </pre>
                <div ref={outputEndRef} />
              </div>
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={copied || (!liveTask.output && !liveTask.error)}
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Output
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!liveTask.output && !liveTask.error}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
              <Button variant="default" size="sm" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})
