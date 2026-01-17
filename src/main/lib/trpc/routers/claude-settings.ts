import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { z } from "zod"
import { router, publicProcedure } from "../index"
import { getDatabase, claudeCodeSettings } from "../../db"
import { eq } from "drizzle-orm"

/**
 * Parse JSON safely with fallback
 */
function parseJsonSafely<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export const claudeSettingsRouter = router({
  /**
   * Get Claude Code settings (always returns a record, creates default if missing)
   */
  getSettings: publicProcedure.query(() => {
    const db = getDatabase()
    let settings = db
      .select()
      .from(claudeCodeSettings)
      .where(eq(claudeCodeSettings.id, "default"))
      .get()

    // Create default settings if not exist
    if (!settings) {
      db.insert(claudeCodeSettings)
        .values({
          id: "default",
          customBinaryPath: null,
          customEnvVars: "{}",
          customConfigDir: null,
          mcpServerSettings: "{}",
        })
        .run()
      settings = {
        id: "default",
        customBinaryPath: null,
        customEnvVars: "{}",
        customConfigDir: null,
        mcpServerSettings: "{}",
        updatedAt: new Date(),
      }
    }

    return {
      customBinaryPath: settings.customBinaryPath,
      customEnvVars: parseJsonSafely<Record<string, string>>(
        settings.customEnvVars,
        {}
      ),
      customConfigDir: settings.customConfigDir,
      mcpServerSettings: parseJsonSafely<Record<string, { enabled: boolean }>>(
        settings.mcpServerSettings ?? "{}",
        {}
      ),
    }
  }),

  /**
   * Update Claude Code settings
   */
  updateSettings: publicProcedure
    .input(
      z.object({
        customBinaryPath: z.string().nullable().optional(),
        customEnvVars: z.record(z.string()).optional(),
        customConfigDir: z.string().nullable().optional(),
        mcpServerSettings: z.record(z.object({ enabled: z.boolean() })).optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDatabase()

      // Check if settings exist
      const existing = db
        .select()
        .from(claudeCodeSettings)
        .where(eq(claudeCodeSettings.id, "default"))
        .get()

      if (existing) {
        // Update existing
        db.update(claudeCodeSettings)
          .set({
            ...(input.customBinaryPath !== undefined && {
              customBinaryPath: input.customBinaryPath,
            }),
            ...(input.customEnvVars !== undefined && {
              customEnvVars: JSON.stringify(input.customEnvVars),
            }),
            ...(input.customConfigDir !== undefined && {
              customConfigDir: input.customConfigDir,
            }),
            ...(input.mcpServerSettings !== undefined && {
              mcpServerSettings: JSON.stringify(input.mcpServerSettings),
            }),
            updatedAt: new Date(),
          })
          .where(eq(claudeCodeSettings.id, "default"))
          .run()
      } else {
        // Insert new
        db.insert(claudeCodeSettings)
          .values({
            id: "default",
            customBinaryPath: input.customBinaryPath ?? null,
            customEnvVars: JSON.stringify(input.customEnvVars ?? {}),
            customConfigDir: input.customConfigDir ?? null,
            mcpServerSettings: JSON.stringify(input.mcpServerSettings ?? {}),
            updatedAt: new Date(),
          })
          .run()
      }

      return { success: true }
    }),

  /**
   * List available MCP servers from ~/.claude/
   * Scans for MCP server directories and reads their package.json for metadata
   */
  listMcpServers: publicProcedure.query(async () => {
    const claudeDir = path.join(os.homedir(), ".claude")
    const servers: Array<{
      id: string
      name: string
      description: string
      enabled: boolean
    }> = []

    try {
      const entries = await fs.readdir(claudeDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith("mcp-") && !entry.name.includes("-mcp")) {
          continue
        }

        const pkgPath = path.join(claudeDir, entry.name, "package.json")
        try {
          const pkgContent = await fs.readFile(pkgPath, "utf-8")
          const pkg = JSON.parse(pkgContent)

          servers.push({
            id: entry.name,
            name: pkg.displayName || pkg.name || entry.name,
            description: pkg.description || "",
            enabled: false, // Will be overridden by settings
          })
        } catch {
          // No package.json, add basic entry
          servers.push({
            id: entry.name,
            name: entry.name,
            description: "",
            enabled: false,
          })
        }
      }
    } catch (error) {
      console.error("[claude-settings] Failed to list MCP servers:", error)
    }

    // Get user's enabled servers from settings
    const db = getDatabase()
    const settings = db
      .select()
      .from(claudeCodeSettings)
      .where(eq(claudeCodeSettings.id, "default"))
      .get()

    const enabledServers = settings?.mcpServerSettings
      ? JSON.parse(settings.mcpServerSettings)
      : {}

    // Mark enabled servers
    for (const server of servers) {
      if (enabledServers[server.id]?.enabled) {
        server.enabled = true
      }
    }

    return { servers }
  }),
})
