"use client"

import { Archive } from "lucide-react"
import { cn } from "../../../lib/utils"

interface HistoryTabContentProps {
  className?: string
  isMobileFullscreen?: boolean
}

export function HistoryTabContent({ className }: HistoryTabContentProps) {
  return (
    <div className={cn("flex flex-col h-full items-center justify-center p-4", className)}>
      <Archive className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <span className="text-sm text-muted-foreground text-center">
        Chat History
      </span>
      <span className="text-xs text-muted-foreground/70 text-center mt-1">
        Archived chats will appear here
      </span>
    </div>
  )
}
