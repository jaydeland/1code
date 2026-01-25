/**
 * Claude Code Versions tRPC router
 *
 * Provides endpoints for managing Claude Code binary versions:
 * - List available/downloaded versions
 * - Download specific versions
 * - Activate versions
 * - Delete downloaded versions
 */

import { z } from "zod"
import { observable } from "@trpc/server/observable"
import { publicProcedure, router } from "../index"
import {
  discoverAvailableVersions,
  downloadClaudeVersion,
  listVersions,
  getCurrentVersionInfo,
  activateVersion,
  deleteVersion,
  resetToBundled,
  getBundledVersion,
  ensureBundledVersionRegistered,
  clearVersionCache,
  type DownloadProgress,
  type VersionInfo,
} from "../../claude/version-manager"

export const claudeVersionsRouter = router({
  /**
   * Get information about the currently active version
   */
  getCurrentVersion: publicProcedure.query(async (): Promise<VersionInfo | null> => {
    // Ensure bundled version is registered on first call
    ensureBundledVersionRegistered()
    return getCurrentVersionInfo()
  }),

  /**
   * List all versions (downloaded + available for download)
   */
  listVersions: publicProcedure.query(async (): Promise<VersionInfo[]> => {
    // Ensure bundled version is registered
    ensureBundledVersionRegistered()
    return listVersions()
  }),

  /**
   * Check for newer versions available from distribution server
   * Returns versions newer than the current active version
   */
  checkForUpdates: publicProcedure.query(async () => {
    const current = getCurrentVersionInfo()
    const currentVersion = current?.id || "0.0.0"

    // Get available versions (already sorted newest first)
    const available = await discoverAvailableVersions()

    // Filter to versions newer than current
    const newerVersions = available.filter((version) => {
      const [cMaj, cMin, cPat] = currentVersion.split(".").map(Number)
      const [vMaj, vMin, vPat] = version.split(".").map(Number)

      if (vMaj > cMaj) return true
      if (vMaj === cMaj && vMin > cMin) return true
      if (vMaj === cMaj && vMin === cMin && vPat > cPat) return true
      return false
    })

    return {
      currentVersion,
      latestVersion: available[0] || null,
      hasUpdate: newerVersions.length > 0,
      newerVersions,
    }
  }),

  /**
   * Download a specific version (returns progress via subscription)
   */
  downloadVersion: publicProcedure
    .input(z.object({ version: z.string() }))
    .subscription(({ input }) => {
      return observable<DownloadProgress>((emit) => {
        let completed = false

        downloadClaudeVersion(input.version, (progress) => {
          emit.next(progress)
          if (progress.type === "complete" || progress.type === "error") {
            completed = true
            emit.complete()
          }
        }).catch((error) => {
          if (!completed) {
            emit.next({
              type: "error",
              message: error.message || "Download failed",
            })
            emit.complete()
          }
        })

        return () => {
          // Cleanup - download will continue but we stop emitting
          completed = true
        }
      })
    }),

  /**
   * Activate a downloaded version (restarts background session)
   */
  activateVersion: publicProcedure
    .input(z.object({ version: z.string() }))
    .mutation(async ({ input }) => {
      await activateVersion(input.version)
      return { success: true, version: input.version }
    }),

  /**
   * Delete a downloaded version
   */
  deleteVersion: publicProcedure
    .input(z.object({ version: z.string() }))
    .mutation(async ({ input }) => {
      await deleteVersion(input.version)
      return { success: true, version: input.version }
    }),

  /**
   * Reset to bundled version
   */
  resetToBundled: publicProcedure.mutation(async () => {
    await resetToBundled()
    return { success: true, version: getBundledVersion() }
  }),

  /**
   * Clear the version discovery cache (forces re-fetch from server)
   */
  clearCache: publicProcedure.mutation(() => {
    clearVersionCache()
    return { success: true }
  }),

  /**
   * Get bundled version info
   */
  getBundledVersion: publicProcedure.query(() => {
    return {
      version: getBundledVersion(),
    }
  }),
})
