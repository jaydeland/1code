/**
 * Background Claude Session for Utility Tasks
 *
 * A persistent background Claude session that runs when the app starts for utility tasks:
 * - Querying MCP servers for their available tools
 * - Generating chat titles from first messages
 * - Other utility AI tasks without user-visible session
 *
 * The session is initialized on app startup, kept alive in the background,
 * reused for multiple requests, and cleaned up on app shutdown.
 */

import { app } from "electron"
import * as path from "path"
import * as os from "os"
import { buildClaudeEnv, getBundledClaudeBinaryPath } from "./env"
import { getDatabase, claudeCodeCredentials } from "../db"
import { eq } from "drizzle-orm"
import { safeStorage } from "electron"

// Types for session state tracking
export interface BackgroundSessionState {
  status: "idle" | "initializing" | "ready" | "error" | "closed"
  sessionId: string | null
  model: string
  requestCount: number
  lastUsedTime: Date | null
  errorMessage: string | null
  initTime: Date | null
}

// Session configuration
interface BackgroundSessionConfig {
  apiKey?: string
  model?: string
  cwd?: string
}

// Cached SDK query function
let cachedClaudeQuery: typeof import("@anthropic-ai/claude-agent-sdk").query | null = null

// Background session state
let sessionState: BackgroundSessionState = {
  status: "idle",
  sessionId: null,
  model: "haiku", // Fast, cheap for utility tasks
  requestCount: 0,
  lastUsedTime: null,
  errorMessage: null,
  initTime: null,
}

// Active abort controller for the background session
let backgroundAbortController: AbortController | null = null

// Config directory for background session
let backgroundConfigDir: string | null = null

/**
 * Get the cached Claude SDK query function
 */
async function getClaudeQuery() {
  if (cachedClaudeQuery) {
    return cachedClaudeQuery
  }
  const sdk = await import("@anthropic-ai/claude-agent-sdk")
  cachedClaudeQuery = sdk.query
  return cachedClaudeQuery
}

/**
 * Decrypt token using Electron's safeStorage
 */
function decryptToken(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, "base64").toString("utf-8")
  }
  const buffer = Buffer.from(encrypted, "base64")
  return safeStorage.decryptString(buffer)
}

/**
 * Get Claude Code OAuth token from local SQLite
 * Returns null if not connected
 */
function getClaudeCodeToken(): string | null {
  try {
    const db = getDatabase()
    const cred = db
      .select()
      .from(claudeCodeCredentials)
      .where(eq(claudeCodeCredentials.id, "default"))
      .get()

    if (!cred?.oauthToken) {
      return null
    }

    return decryptToken(cred.oauthToken)
  } catch (error) {
    console.error("[background-session] Error getting Claude Code token:", error)
    return null
  }
}

/**
 * Initialize the background Claude session
 *
 * Creates a new background session that can be used for utility tasks.
 * The session uses a fast, cheap model (haiku) by default.
 *
 * @param config - Optional configuration overrides
 * @returns The background session state
 */
export async function initBackgroundSession(
  config?: BackgroundSessionConfig
): Promise<BackgroundSessionState> {
  // Don't reinitialize if already ready
  if (sessionState.status === "ready" || sessionState.status === "initializing") {
    console.log("[background-session] Already initialized or initializing")
    return sessionState
  }

  sessionState.status = "initializing"
  sessionState.initTime = new Date()
  sessionState.errorMessage = null

  console.log("[background-session] Initializing...")

  try {
    // Create isolated config directory for background session
    backgroundConfigDir = path.join(
      app.getPath("userData"),
      "claude-sessions",
      "background-utility"
    )

    // Get Claude SDK
    const claudeQuery = await getClaudeQuery()

    // Build environment
    const claudeCodeToken = getClaudeCodeToken()
    const claudeEnv = buildClaudeEnv()

    const finalEnv: Record<string, string> = {
      ...claudeEnv,
      ...(claudeCodeToken && {
        CLAUDE_CODE_OAUTH_TOKEN: claudeCodeToken,
      }),
      ...(backgroundConfigDir && {
        CLAUDE_CONFIG_DIR: backgroundConfigDir,
      }),
    }

    // Get bundled Claude binary path
    const claudeBinaryPath = getBundledClaudeBinaryPath()

    // Create abort controller for this session
    backgroundAbortController = new AbortController()

    // Resolve model and working directory
    const model = config?.model || "haiku"
    const cwd = config?.cwd || app.getPath("userData")

    sessionState.model = model

    // Initialize with a simple ping to verify the session works
    const queryOptions = {
      prompt: "ping",
      options: {
        abortController: backgroundAbortController,
        cwd,
        systemPrompt: {
          type: "preset" as const,
          preset: "claude_code" as const,
        },
        env: finalEnv,
        permissionMode: "bypassPermissions" as const,
        allowDangerouslySkipPermissions: true,
        pathToClaudeCodeExecutable: claudeBinaryPath,
        continue: true,
        model,
      },
    }

    // Run a quick query to initialize the session
    const stream = claudeQuery(queryOptions)
    let gotInit = false

    for await (const msg of stream) {
      const msgAny = msg as any

      // Track sessionId from any message
      if (msgAny.session_id && !sessionState.sessionId) {
        sessionState.sessionId = msgAny.session_id
      }

      // Check for init message
      if (msgAny.type === "system" && msgAny.subtype === "init") {
        gotInit = true
        console.log("[background-session] Received init message")
        break
      }

      // Also check for result message (means session is working)
      if (msgAny.type === "result") {
        gotInit = true
        break
      }
    }

    if (gotInit) {
      sessionState.status = "ready"
      sessionState.requestCount = 1
      sessionState.lastUsedTime = new Date()
      console.log(
        `[background-session] Initialized successfully (session: ${sessionState.sessionId?.slice(0, 8)}...)`
      )
    } else {
      sessionState.status = "error"
      sessionState.errorMessage = "Did not receive init message"
      console.error("[background-session] Did not receive init message")
    }

    return sessionState
  } catch (error) {
    sessionState.status = "error"
    sessionState.errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[background-session] Initialization failed:", error)
    return sessionState
  }
}

/**
 * Get the current background session state
 *
 * @returns The current session state or null if not initialized
 */
export function getBackgroundSessionState(): BackgroundSessionState {
  return { ...sessionState }
}

/**
 * Check if the background session is ready for use
 */
export function isBackgroundSessionReady(): boolean {
  return sessionState.status === "ready"
}

/**
 * Execute a query using the background session
 *
 * @param prompt - The prompt to send
 * @param options - Optional overrides
 * @returns The response text
 */
export async function queryBackgroundSession(
  prompt: string,
  options?: {
    model?: string
    maxTokens?: number
  }
): Promise<{ text: string; success: boolean; error?: string }> {
  if (sessionState.status !== "ready") {
    return {
      text: "",
      success: false,
      error: `Background session not ready (status: ${sessionState.status})`,
    }
  }

  try {
    const claudeQuery = await getClaudeQuery()
    const claudeCodeToken = getClaudeCodeToken()
    const claudeEnv = buildClaudeEnv()

    const finalEnv: Record<string, string> = {
      ...claudeEnv,
      ...(claudeCodeToken && {
        CLAUDE_CODE_OAUTH_TOKEN: claudeCodeToken,
      }),
      ...(backgroundConfigDir && {
        CLAUDE_CONFIG_DIR: backgroundConfigDir,
      }),
    }

    const claudeBinaryPath = getBundledClaudeBinaryPath()
    const model = options?.model || sessionState.model

    // Create new abort controller for this query
    const queryAbortController = new AbortController()

    const queryOptions = {
      prompt,
      options: {
        abortController: queryAbortController,
        cwd: app.getPath("userData"),
        systemPrompt: {
          type: "preset" as const,
          preset: "claude_code" as const,
        },
        env: finalEnv,
        permissionMode: "bypassPermissions" as const,
        allowDangerouslySkipPermissions: true,
        pathToClaudeCodeExecutable: claudeBinaryPath,
        resume: sessionState.sessionId || undefined,
        continue: true,
        model,
      },
    }

    const stream = claudeQuery(queryOptions)
    let responseText = ""

    for await (const msg of stream) {
      const msgAny = msg as any

      // Update sessionId if we get a new one
      if (msgAny.session_id) {
        sessionState.sessionId = msgAny.session_id
      }

      // Collect text content
      if (msgAny.type === "assistant" && msgAny.message?.content) {
        for (const block of msgAny.message.content) {
          if (block.type === "text") {
            responseText += block.text
          }
        }
      }

      // Check for result message
      if (msgAny.type === "result") {
        if (msgAny.result) {
          responseText = msgAny.result
        }
        break
      }
    }

    sessionState.requestCount++
    sessionState.lastUsedTime = new Date()

    return { text: responseText, success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[background-session] Query failed:", errorMessage)
    return { text: "", success: false, error: errorMessage }
  }
}

/**
 * Generate a chat title from the first message
 *
 * @param firstMessage - The first message in the conversation
 * @returns The generated title or null if generation fails
 */
export async function generateChatTitle(firstMessage: string): Promise<string | null> {
  if (!isBackgroundSessionReady()) {
    console.log("[background-session] Not ready for title generation, using fallback")
    return fallbackTitleGeneration(firstMessage)
  }

  try {
    const prompt = `Generate a short title (5-8 words max) for a conversation that starts with this message. Return ONLY the title, no quotes, no explanation:

${firstMessage.slice(0, 500)}`

    const result = await queryBackgroundSession(prompt, { model: "haiku" })

    if (result.success && result.text) {
      // Clean up the title (remove quotes, trim)
      const title = result.text
        .replace(/^["']|["']$/g, "")
        .trim()
        .slice(0, 100)
      return title
    }

    return fallbackTitleGeneration(firstMessage)
  } catch (error) {
    console.error("[background-session] Title generation failed:", error)
    return fallbackTitleGeneration(firstMessage)
  }
}

/**
 * Fallback title generation (no AI)
 * Used when background session is not available
 */
function fallbackTitleGeneration(message: string): string {
  // Take first 50 chars, remove newlines, trim
  const cleaned = message.replace(/\n/g, " ").trim()
  if (cleaned.length <= 50) {
    return cleaned
  }
  // Find last space before 50 chars to avoid cutting words
  const lastSpace = cleaned.lastIndexOf(" ", 50)
  if (lastSpace > 20) {
    return cleaned.slice(0, lastSpace) + "..."
  }
  return cleaned.slice(0, 50) + "..."
}

/**
 * Close the background session
 *
 * Should be called when the app is shutting down.
 */
export async function closeBackgroundSession(): Promise<void> {
  if (sessionState.status === "closed") {
    return
  }

  console.log("[background-session] Closing...")

  // Abort any active queries
  if (backgroundAbortController) {
    backgroundAbortController.abort()
    backgroundAbortController = null
  }

  sessionState.status = "closed"
  sessionState.sessionId = null

  console.log("[background-session] Closed")
}

/**
 * Reset the background session (for debugging/testing)
 *
 * Closes the current session and resets state to allow re-initialization.
 */
export async function resetBackgroundSession(): Promise<void> {
  await closeBackgroundSession()

  sessionState = {
    status: "idle",
    sessionId: null,
    model: "haiku",
    requestCount: 0,
    lastUsedTime: null,
    errorMessage: null,
    initTime: null,
  }

  backgroundConfigDir = null
  console.log("[background-session] Reset complete")
}
