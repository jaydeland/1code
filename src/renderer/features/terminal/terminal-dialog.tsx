import { useEffect, useCallback, useMemo, useRef, useState } from "react"
import { useAtom, useAtomValue } from "jotai"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { useTheme } from "next-themes"
import { X } from "lucide-react"
import { fullThemeDataAtom, selectedProjectAtom } from "@/lib/atoms"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { Terminal } from "./terminal"
import { TerminalTabs } from "./terminal-tabs"
import { getDefaultTerminalBg } from "./helpers"
import {
  terminalDialogOpenAtom,
  dialogTerminalsAtom,
  dialogActiveTerminalIdAtom,
  terminalCwdAtom,
} from "./atoms"
import { trpc } from "@/lib/trpc"
import type { TerminalInstance } from "./types"

// Dialog ID prefix for terminal dialog terminals
const DIALOG_PREFIX = "dialog"

/**
 * Generate a unique terminal ID
 */
function generateTerminalId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/**
 * Generate a paneId for TerminalManager (dialog terminals)
 */
function generatePaneId(terminalId: string): string {
  return `${DIALOG_PREFIX}:term:${terminalId}`
}

/**
 * Get the next terminal name based on existing terminals
 */
function getNextTerminalName(terminals: TerminalInstance[]): string {
  const existingNumbers = terminals
    .map((t) => {
      const match = t.name.match(/^Terminal (\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    .filter((n) => n > 0)

  const maxNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0
  return `Terminal ${maxNumber + 1}`
}

export function TerminalDialog() {
  const [isOpen, setIsOpen] = useAtom(terminalDialogOpenAtom)
  const [terminals, setTerminals] = useAtom(dialogTerminalsAtom)
  const [activeTerminalId, setActiveTerminalId] = useAtom(
    dialogActiveTerminalIdAtom,
  )
  const terminalCwds = useAtomValue(terminalCwdAtom)
  const selectedProject = useAtomValue(selectedProjectAtom)

  // Get cwd from selected project
  const cwd = useMemo(() => {
    // Use selected project path, fallback to home directory placeholder
    // The actual home directory will be resolved by the terminal backend
    return selectedProject?.path || "~"
  }, [selectedProject])

  // Portal target
  const [mounted, setMounted] = useState(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setMounted(true)
    if (typeof document !== "undefined") {
      setPortalTarget(document.body)
    }
  }, [])

  // Theme detection for terminal background
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const fullThemeData = useAtomValue(fullThemeDataAtom)

  const terminalBg = useMemo(() => {
    if (fullThemeData?.colors?.["terminal.background"]) {
      return fullThemeData.colors["terminal.background"]
    }
    if (fullThemeData?.colors?.["editor.background"]) {
      return fullThemeData.colors["editor.background"]
    }
    return getDefaultTerminalBg(isDark)
  }, [isDark, fullThemeData])

  // Get the active terminal instance
  const activeTerminal = useMemo(
    () => terminals.find((t) => t.id === activeTerminalId) || null,
    [terminals, activeTerminalId],
  )

  // tRPC mutation for killing terminal sessions
  const killMutation = trpc.terminal.kill.useMutation()

  // Refs to avoid callback recreation
  const terminalsRef = useRef(terminals)
  terminalsRef.current = terminals
  const activeTerminalIdRef = useRef(activeTerminalId)
  activeTerminalIdRef.current = activeTerminalId

  // Create a new terminal
  const createTerminal = useCallback(() => {
    const currentTerminals = terminalsRef.current

    const id = generateTerminalId()
    const paneId = generatePaneId(id)
    const name = getNextTerminalName(currentTerminals)

    const newTerminal: TerminalInstance = {
      id,
      paneId,
      name,
      createdAt: Date.now(),
    }

    setTerminals((prev) => [...prev, newTerminal])
    setActiveTerminalId(id)
  }, [setTerminals, setActiveTerminalId])

  // Select a terminal
  const selectTerminal = useCallback(
    (id: string) => {
      setActiveTerminalId(id)
    },
    [setActiveTerminalId],
  )

  // Close a terminal
  const closeTerminal = useCallback(
    (id: string) => {
      const currentTerminals = terminalsRef.current
      const currentActiveId = activeTerminalIdRef.current

      const terminal = currentTerminals.find((t) => t.id === id)
      if (!terminal) return

      // Kill the session on the backend
      killMutation.mutate({ paneId: terminal.paneId })

      // Remove from state
      const newTerminals = currentTerminals.filter((t) => t.id !== id)
      setTerminals(newTerminals)

      // If we closed the active terminal, switch to another
      if (currentActiveId === id) {
        const newActive = newTerminals[newTerminals.length - 1]?.id || null
        setActiveTerminalId(newActive)
      }
    },
    [setTerminals, setActiveTerminalId, killMutation],
  )

  // Rename a terminal
  const renameTerminal = useCallback(
    (id: string, name: string) => {
      setTerminals((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name } : t)),
      )
    },
    [setTerminals],
  )

  // Close other terminals
  const closeOtherTerminals = useCallback(
    (id: string) => {
      const currentTerminals = terminalsRef.current

      // Kill all terminals except the one with the given id
      currentTerminals.forEach((terminal) => {
        if (terminal.id !== id) {
          killMutation.mutate({ paneId: terminal.paneId })
        }
      })

      // Keep only the terminal with the given id
      const remainingTerminal = currentTerminals.find((t) => t.id === id)
      setTerminals(remainingTerminal ? [remainingTerminal] : [])
      setActiveTerminalId(id)
    },
    [setTerminals, setActiveTerminalId, killMutation],
  )

  // Close terminals to the right
  const closeTerminalsToRight = useCallback(
    (id: string) => {
      const currentTerminals = terminalsRef.current

      const index = currentTerminals.findIndex((t) => t.id === id)
      if (index === -1) return

      // Kill terminals to the right
      const terminalsToClose = currentTerminals.slice(index + 1)
      terminalsToClose.forEach((terminal) => {
        killMutation.mutate({ paneId: terminal.paneId })
      })

      // Keep only terminals up to and including the one with the given id
      const remainingTerminals = currentTerminals.slice(0, index + 1)
      setTerminals(remainingTerminals)

      // If active terminal was closed, switch to the last remaining one
      const currentActiveId = activeTerminalIdRef.current
      if (
        currentActiveId &&
        !remainingTerminals.find((t) => t.id === currentActiveId)
      ) {
        setActiveTerminalId(
          remainingTerminals[remainingTerminals.length - 1]?.id || null,
        )
      }
    },
    [setTerminals, setActiveTerminalId, killMutation],
  )

  // Close dialog
  const closeDialog = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  // Delay terminal rendering until dialog animation completes
  const [canRenderTerminal, setCanRenderTerminal] = useState(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Dialog just opened - delay terminal render
      setCanRenderTerminal(false)
      const timer = setTimeout(() => {
        setCanRenderTerminal(true)
      }, 250) // Animation duration + buffer
      wasOpenRef.current = true
      return () => clearTimeout(timer)
    } else if (!isOpen) {
      wasOpenRef.current = false
      setCanRenderTerminal(false)
    }
  }, [isOpen])

  // Auto-create first terminal when dialog opens and no terminals exist
  useEffect(() => {
    if (isOpen && terminals.length === 0) {
      createTerminal()
    }
  }, [isOpen, terminals.length, createTerminal])

  // Keyboard shortcut: Cmd+` to toggle terminal dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+` (backtick)
      if (
        e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        e.code === "Backquote"
      ) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen((prev) => !prev)
      }
      // Also handle Escape to close when open
      if (isOpen && e.key === "Escape") {
        e.preventDefault()
        closeDialog()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [setIsOpen, isOpen, closeDialog])

  if (!mounted || !portalTarget) return null

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/25"
            onClick={closeDialog}
            style={{ pointerEvents: isOpen ? "auto" : "none" }}
            data-modal="terminal-dialog"
          />

          {/* Terminal Dialog */}
          <div className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-[45]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-[90vw] h-[70vh] max-w-[1000px] max-h-[600px] flex flex-col rounded-xl border border-border/50 shadow-2xl overflow-hidden select-none"
              style={{ backgroundColor: terminalBg }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="terminal-dialog-title"
              data-modal="terminal-dialog"
              data-canvas-dialog
            >
              <h2 id="terminal-dialog-title" className="sr-only">
                Terminal
              </h2>

              {/* Header with tabs */}
              <div
                className="flex items-center gap-1 pl-2 pr-2 py-1.5 flex-shrink-0 border-b border-border/30"
                style={{ backgroundColor: terminalBg }}
              >
                {/* Terminal Tabs */}
                {terminals.length > 0 && (
                  <TerminalTabs
                    terminals={terminals}
                    activeTerminalId={activeTerminalId}
                    cwds={terminalCwds}
                    initialCwd={cwd}
                    terminalBg={terminalBg}
                    onSelectTerminal={selectTerminal}
                    onCloseTerminal={closeTerminal}
                    onCloseOtherTerminals={closeOtherTerminals}
                    onCloseTerminalsToRight={closeTerminalsToRight}
                    onCreateTerminal={createTerminal}
                    onRenameTerminal={renameTerminal}
                  />
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Close button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={closeDialog}
                      className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground flex-shrink-0 rounded-md"
                      aria-label="Close terminal"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Close
                    <Kbd>`</Kbd>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Terminal Content */}
              <div
                className="flex-1 min-h-0 min-w-0 overflow-hidden"
                style={{ backgroundColor: terminalBg }}
              >
                {activeTerminal && canRenderTerminal ? (
                  <motion.div
                    key={activeTerminal.paneId}
                    className="h-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0 }}
                  >
                    <Terminal
                      paneId={activeTerminal.paneId}
                      cwd={cwd}
                      workspaceId={DIALOG_PREFIX}
                      initialCwd={cwd}
                    />
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    {!canRenderTerminal ? "" : "No terminal open"}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    portalTarget,
  )
}
