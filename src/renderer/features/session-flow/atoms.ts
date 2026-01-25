import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { messageIdsAtom, messageAtomFamily } from "../agents/stores/message-store"

export const sessionFlowSidebarOpenAtom = atomWithStorage<boolean>(
  "session-flow-sidebar-open",
  false,
  undefined,
  { getOnInit: true },
)

export const sessionFlowSidebarWidthAtom = atomWithStorage<number>(
  "session-flow-sidebar-width",
  320,
  undefined,
  { getOnInit: true },
)

// Vertical split position (percentage for top panel, 0-100)
// Default 60% diagram / 40% todos
export const sessionFlowTodosSplitAtom = atomWithStorage<number>(
  "session-flow-todos-split",
  60,
  undefined,
  { getOnInit: true },
)

// Todo item type from TodoWrite tool
export interface SessionTodoItem {
  content: string
  status: "pending" | "in_progress" | "completed"
  activeForm?: string
}

// Extracted todos from messages with message context for navigation
export interface ExtractedTodos {
  todos: SessionTodoItem[]
  messageId: string | null
  partIndex: number | null
}

// Derive current todos from messages
// Finds the latest TodoWrite tool call and extracts its todos
export const sessionFlowTodosAtom = atom<ExtractedTodos>((get) => {
  const messageIds = get(messageIdsAtom)

  // Search from most recent messages backwards to find latest TodoWrite
  for (let i = messageIds.length - 1; i >= 0; i--) {
    const msgId = messageIds[i]
    if (!msgId) continue

    const message = get(messageAtomFamily(msgId))
    if (!message || !message.parts) continue

    // Search parts backwards to find the most recent TodoWrite in this message
    for (let partIdx = message.parts.length - 1; partIdx >= 0; partIdx--) {
      const part = message.parts[partIdx]
      if (!part) continue

      // Check if this is a TodoWrite tool call
      if (
        part.type === "tool-TodoWrite" ||
        (part.type === "tool-invocation" && part.toolName === "TodoWrite")
      ) {
        // Extract todos from input or output
        const todos = part.input?.todos || part.output?.newTodos || []
        if (todos.length > 0) {
          return {
            todos,
            messageId: msgId,
            partIndex: partIdx,
          }
        }
      }
    }
  }

  return { todos: [], messageId: null, partIndex: null }
})
