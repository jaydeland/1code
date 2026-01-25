import { useCallback, useState, useRef } from "react"
import { useAtom } from "jotai"
import { ResizableSidebar } from "@/components/ui/resizable-sidebar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { IconDoubleChevronRight } from "@/components/ui/icons"
import { SessionFlowPanel } from "./session-flow-panel"
import { SessionFlowTodos } from "./session-flow-todos"
import {
  sessionFlowSidebarOpenAtom,
  sessionFlowSidebarWidthAtom,
  sessionFlowTodosSplitAtom,
} from "../atoms"

interface SessionFlowSidebarProps {
  onScrollToMessage: (messageId: string, partIndex?: number) => void
}

const MIN_PANEL_PERCENT = 20 // Minimum 20% for either panel
const MAX_PANEL_PERCENT = 80 // Maximum 80% for either panel

export function SessionFlowSidebar({ onScrollToMessage }: SessionFlowSidebarProps) {
  const [isOpen, setIsOpen] = useAtom(sessionFlowSidebarOpenAtom)
  const [splitPercent, setSplitPercent] = useAtom(sessionFlowTodosSplitAtom)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const closeSidebar = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  // Handle vertical resize
  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      event.preventDefault()
      event.stopPropagation()

      const container = containerRef.current
      if (!container) return

      const startY = event.clientY
      const containerRect = container.getBoundingClientRect()
      const containerHeight = containerRect.height
      const startPercent = splitPercent
      const pointerId = event.pointerId

      const handleElement = event.currentTarget as HTMLElement
      handleElement.setPointerCapture?.(pointerId)
      setIsResizing(true)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startY
        const deltaPercent = (deltaY / containerHeight) * 100
        const newPercent = Math.min(
          MAX_PANEL_PERCENT,
          Math.max(MIN_PANEL_PERCENT, startPercent + deltaPercent)
        )
        setSplitPercent(newPercent)
      }

      const handlePointerUp = () => {
        if (handleElement.hasPointerCapture?.(pointerId)) {
          handleElement.releasePointerCapture(pointerId)
        }
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
        document.removeEventListener("pointercancel", handlePointerUp)
        setIsResizing(false)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp, { once: true })
      document.addEventListener("pointercancel", handlePointerUp, { once: true })
    },
    [splitPercent, setSplitPercent]
  )

  return (
    <ResizableSidebar
      isOpen={isOpen}
      onClose={closeSidebar}
      widthAtom={sessionFlowSidebarWidthAtom}
      side="right"
      minWidth={280}
      maxWidth={500}
      animationDuration={0}
      initialWidth={0}
      exitWidth={0}
      showResizeTooltip={true}
      className="bg-background border-l"
      style={{ borderLeftWidth: "0.5px", overflow: "hidden" }}
    >
      <div className="flex flex-col h-full min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-1.5 flex-shrink-0 border-b border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSidebar}
                className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground flex-shrink-0 rounded-md"
                aria-label="Close session flow"
              >
                <IconDoubleChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close session flow</TooltipContent>
          </Tooltip>
          <span className="text-sm font-medium ml-1">Session Flow</span>
        </div>

        {/* Split Panel Container */}
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Panel - Flow Diagram */}
          <div
            className="min-h-0 overflow-hidden"
            style={{ height: `${splitPercent}%` }}
          >
            <SessionFlowPanel onScrollToMessage={onScrollToMessage} />
          </div>

          {/* Resize Handle */}
          <div
            className="h-1 flex-shrink-0 cursor-row-resize relative group"
            onPointerDown={handleResizePointerDown}
          >
            {/* Visual indicator */}
            <div
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] transition-colors ${
                isResizing
                  ? "bg-foreground/40"
                  : "bg-border group-hover:bg-foreground/30"
              }`}
            />
            {/* Extended hit area */}
            <div className="absolute inset-x-0 -top-1 -bottom-1" />
          </div>

          {/* Bottom Panel - Todos */}
          <div
            className="min-h-0 overflow-hidden border-t border-border/50"
            style={{ height: `${100 - splitPercent}%` }}
          >
            <SessionFlowTodos onScrollToMessage={onScrollToMessage} />
          </div>
        </div>
      </div>
    </ResizableSidebar>
  )
}
