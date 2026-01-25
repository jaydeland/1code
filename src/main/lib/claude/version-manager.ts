/**
 * Claude Code Version Manager
 *
 * Handles downloading, verifying, and switching between Claude Code binary versions.
 * Downloaded binaries are stored in {userData}/claude-binaries/{version}/
 */

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { app } from "electron"
import { eq } from "drizzle-orm"
import { getDatabase, claudeBinaryVersions } from "../db"
import { getBundledClaudeBinaryPath } from "./env"
import { resetBackgroundSession } from "./background-session"

// Claude Code distribution base URL
const DIST_BASE =
  "https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases"

// Platform mappings
const PLATFORMS: Record<string, { dir: string; binary: string }> = {
  "darwin-arm64": { dir: "darwin-arm64", binary: "claude" },
  "darwin-x64": { dir: "darwin-x64", binary: "claude" },
  "linux-arm64": { dir: "linux-arm64", binary: "claude" },
  "linux-x64": { dir: "linux-x64", binary: "claude" },
  "win32-x64": { dir: "win32-x64", binary: "claude.exe" },
}

// Current platform key
const CURRENT_PLATFORM = `${process.platform}-${process.arch}`

// Download progress callback type
export interface DownloadProgress {
  type: "progress" | "verifying" | "complete" | "error"
  percent?: number
  bytesDownloaded?: number
  totalBytes?: number
  message?: string
}

// Version info returned by list functions
export interface VersionInfo {
  id: string
  platform: string
  path: string | null
  checksum: string | null
  size: number | null
  downloadedAt: Date | null
  isActive: boolean
  isBundled: boolean
  isDownloaded: boolean
  isAvailable: boolean // Available for download from server
}

// Manifest structure from distribution server
interface PlatformManifest {
  checksum: string
  size: number
}

interface VersionManifest {
  version: string
  platforms: Record<string, PlatformManifest>
}

// Cache for discovered versions
let discoveredVersionsCache: string[] | null = null
let discoveredVersionsCacheTime: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get the directory where downloaded binaries are stored
 */
export function getBinariesDir(): string {
  return path.join(app.getPath("userData"), "claude-binaries")
}

/**
 * Get the path for a specific downloaded version
 */
export function getVersionPath(version: string): string {
  const platform = PLATFORMS[CURRENT_PLATFORM]
  if (!platform) {
    throw new Error(`Unsupported platform: ${CURRENT_PLATFORM}`)
  }
  return path.join(getBinariesDir(), version, platform.binary)
}

/**
 * Fetch JSON from URL with redirect handling
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

/**
 * Check if a version exists on the distribution server
 */
async function versionExists(version: string): Promise<boolean> {
  try {
    const response = await fetch(`${DIST_BASE}/${version}/manifest.json`, {
      method: "HEAD",
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get the latest version from the install script
 */
async function getLatestVersionFromInstallScript(): Promise<string | null> {
  try {
    const response = await fetch("https://claude.ai/install.sh")
    const script = await response.text()
    const versionMatch = script.match(/CLAUDE_CODE_VERSION="([^"]+)"/)
    return versionMatch ? versionMatch[1] : null
  } catch (error) {
    console.error("[version-manager] Failed to fetch install script:", error)
    return null
  }
}

/**
 * Discover available versions by probing the distribution server
 * Returns versions in descending order (newest first)
 */
export async function discoverAvailableVersions(): Promise<string[]> {
  // Check cache
  const now = Date.now()
  if (discoveredVersionsCache && now - discoveredVersionsCacheTime < CACHE_TTL_MS) {
    return discoveredVersionsCache
  }

  const versions: Set<string> = new Set()

  // 1. Get latest from install script
  const latestVersion = await getLatestVersionFromInstallScript()
  if (latestVersion) {
    versions.add(latestVersion)
  }

  // 2. Parse version components
  const [major, minor, patch] = (latestVersion || "2.1.5").split(".").map(Number)

  // 3. Probe backwards for ~10 versions
  const probePromises: Promise<void>[] = []
  for (let p = patch; p >= Math.max(0, patch - 15); p--) {
    const version = `${major}.${minor}.${p}`
    probePromises.push(
      versionExists(version).then((exists) => {
        if (exists) versions.add(version)
      })
    )
  }

  // Also probe previous minor version
  if (minor > 0) {
    for (let p = 20; p >= 0; p--) {
      const version = `${major}.${minor - 1}.${p}`
      probePromises.push(
        versionExists(version).then((exists) => {
          if (exists) versions.add(version)
        })
      )
    }
  }

  await Promise.all(probePromises)

  // Sort versions in descending order
  const sortedVersions = Array.from(versions).sort((a, b) => {
    const [aMaj, aMin, aPat] = a.split(".").map(Number)
    const [bMaj, bMin, bPat] = b.split(".").map(Number)
    if (aMaj !== bMaj) return bMaj - aMaj
    if (aMin !== bMin) return bMin - aMin
    return bPat - aPat
  })

  // Cache results
  discoveredVersionsCache = sortedVersions
  discoveredVersionsCacheTime = now

  console.log(`[version-manager] Discovered ${sortedVersions.length} versions:`, sortedVersions)
  return sortedVersions
}

/**
 * Get manifest for a specific version
 */
export async function getVersionManifest(version: string): Promise<VersionManifest> {
  const manifestUrl = `${DIST_BASE}/${version}/manifest.json`
  return fetchJson<VersionManifest>(manifestUrl)
}

/**
 * Calculate SHA256 hash of a file
 */
function calculateSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256")
    const stream = fs.createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolve(hash.digest("hex")))
    stream.on("error", reject)
  })
}

/**
 * Download a file with progress reporting
 */
async function downloadFile(
  url: string,
  destPath: string,
  expectedSize: number,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  // Ensure directory exists
  fs.mkdirSync(path.dirname(destPath), { recursive: true })

  const response = await fetch(url, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("No response body")
  }

  const chunks: Uint8Array[] = []
  let downloaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunks.push(value)
    downloaded += value.length

    const percent = Math.floor((downloaded / expectedSize) * 100)
    onProgress({
      type: "progress",
      percent,
      bytesDownloaded: downloaded,
      totalBytes: expectedSize,
    })
  }

  // Write to file
  const buffer = Buffer.concat(chunks)
  fs.writeFileSync(destPath, buffer)
}

/**
 * Download a specific Claude Code version
 */
export async function downloadClaudeVersion(
  version: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<string> {
  const platform = PLATFORMS[CURRENT_PLATFORM]
  if (!platform) {
    throw new Error(`Unsupported platform: ${CURRENT_PLATFORM}`)
  }

  const destDir = path.join(getBinariesDir(), version)
  const destPath = path.join(destDir, platform.binary)

  console.log(`[version-manager] Downloading version ${version} to ${destPath}`)

  // 1. Fetch manifest
  const manifest = await getVersionManifest(version)
  const platformManifest = manifest.platforms[platform.dir]
  if (!platformManifest) {
    throw new Error(`No manifest entry for platform ${platform.dir}`)
  }

  const { checksum: expectedChecksum, size: expectedSize } = platformManifest

  // 2. Check if already downloaded and valid
  if (fs.existsSync(destPath)) {
    const existingChecksum = await calculateSha256(destPath)
    if (existingChecksum === expectedChecksum) {
      console.log(`[version-manager] Version ${version} already downloaded and verified`)
      onProgress({ type: "complete", message: "Already downloaded" })

      // Update database
      const db = getDatabase()
      db.insert(claudeBinaryVersions)
        .values({
          id: version,
          platform: CURRENT_PLATFORM,
          path: destPath,
          checksum: expectedChecksum,
          size: expectedSize,
          isActive: false,
          isBundled: false,
        })
        .onConflictDoUpdate({
          target: claudeBinaryVersions.id,
          set: {
            path: destPath,
            checksum: expectedChecksum,
            size: expectedSize,
          },
        })
        .run()

      return destPath
    }
    console.log(`[version-manager] Existing file has wrong checksum, re-downloading`)
  }

  // 3. Download
  const downloadUrl = `${DIST_BASE}/${version}/${platform.dir}/${platform.binary}`
  console.log(`[version-manager] Downloading from ${downloadUrl}`)

  await downloadFile(downloadUrl, destPath, expectedSize, onProgress)

  // 4. Verify checksum
  onProgress({ type: "verifying", message: "Verifying checksum..." })
  const actualChecksum = await calculateSha256(destPath)
  if (actualChecksum !== expectedChecksum) {
    fs.unlinkSync(destPath)
    throw new Error(`Checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`)
  }

  // 5. Make executable (Unix)
  if (process.platform !== "win32") {
    fs.chmodSync(destPath, 0o755)
  }

  // 6. Update database
  const db = getDatabase()
  db.insert(claudeBinaryVersions)
    .values({
      id: version,
      platform: CURRENT_PLATFORM,
      path: destPath,
      checksum: actualChecksum,
      size: expectedSize,
      isActive: false,
      isBundled: false,
    })
    .onConflictDoUpdate({
      target: claudeBinaryVersions.id,
      set: {
        path: destPath,
        checksum: actualChecksum,
        size: expectedSize,
        downloadedAt: new Date(),
      },
    })
    .run()

  onProgress({ type: "complete", message: "Download complete" })
  console.log(`[version-manager] Successfully downloaded version ${version}`)

  return destPath
}

/**
 * Get the bundled version string by reading VERSION file or executing binary
 */
export function getBundledVersion(): string {
  const bundledPath = getBundledClaudeBinaryPath()
  const versionFilePath = path.join(path.dirname(bundledPath), "..", "VERSION")

  // Try reading VERSION file first
  if (fs.existsSync(versionFilePath)) {
    try {
      const content = fs.readFileSync(versionFilePath, "utf-8")
      const version = content.split("\n")[0].trim()
      if (version) return version
    } catch {
      // Fall through to binary execution
    }
  }

  // Try executing binary to get version
  try {
    const { execSync } = require("node:child_process")
    const output = execSync(`"${bundledPath}" --version`, {
      encoding: "utf-8",
      timeout: 5000,
    })
    const match = output.trim().match(/claude\s+(\S+)/)
    return match ? match[1] : "unknown"
  } catch {
    return "unknown"
  }
}

/**
 * Ensure bundled version is registered in database
 */
export function ensureBundledVersionRegistered(): void {
  const db = getDatabase()
  const bundledPath = getBundledClaudeBinaryPath()
  const bundledVersion = getBundledVersion()

  if (bundledVersion === "unknown" || !fs.existsSync(bundledPath)) {
    console.warn("[version-manager] Bundled binary not found or version unknown")
    return
  }

  // Check if any version is active
  const activeVersion = db
    .select()
    .from(claudeBinaryVersions)
    .where(eq(claudeBinaryVersions.isActive, true))
    .get()

  // Register bundled version
  db.insert(claudeBinaryVersions)
    .values({
      id: bundledVersion,
      platform: CURRENT_PLATFORM,
      path: bundledPath,
      checksum: null,
      size: null,
      isActive: !activeVersion, // Active by default if no other active version
      isBundled: true,
    })
    .onConflictDoUpdate({
      target: claudeBinaryVersions.id,
      set: {
        path: bundledPath,
        isBundled: true,
      },
    })
    .run()

  console.log(`[version-manager] Registered bundled version ${bundledVersion}`)
}

/**
 * Get the currently active Claude binary path
 * Returns downloaded version if active, otherwise bundled version
 */
export function getActiveClaudeBinaryPath(): string {
  try {
    const db = getDatabase()
    const activeVersion = db
      .select()
      .from(claudeBinaryVersions)
      .where(eq(claudeBinaryVersions.isActive, true))
      .get()

    if (activeVersion && activeVersion.path && fs.existsSync(activeVersion.path)) {
      return activeVersion.path
    }
  } catch (error) {
    console.error("[version-manager] Error getting active version:", error)
  }

  // Fall back to bundled binary
  return getBundledClaudeBinaryPath()
}

/**
 * Get information about the currently active version
 */
export function getCurrentVersionInfo(): VersionInfo | null {
  try {
    const db = getDatabase()
    const activeVersion = db
      .select()
      .from(claudeBinaryVersions)
      .where(eq(claudeBinaryVersions.isActive, true))
      .get()

    if (activeVersion) {
      return {
        ...activeVersion,
        isDownloaded: true,
        isAvailable: true,
        downloadedAt: activeVersion.downloadedAt,
      }
    }

    // Return bundled as fallback
    const bundledVersion = getBundledVersion()
    const bundledPath = getBundledClaudeBinaryPath()
    return {
      id: bundledVersion,
      platform: CURRENT_PLATFORM,
      path: bundledPath,
      checksum: null,
      size: null,
      downloadedAt: null,
      isActive: true,
      isBundled: true,
      isDownloaded: fs.existsSync(bundledPath),
      isAvailable: true,
    }
  } catch (error) {
    console.error("[version-manager] Error getting current version info:", error)
    return null
  }
}

/**
 * List all versions (downloaded + available)
 */
export async function listVersions(): Promise<VersionInfo[]> {
  const db = getDatabase()

  // Get downloaded versions from database
  const downloadedVersions = db.select().from(claudeBinaryVersions).all()
  const downloadedMap = new Map(downloadedVersions.map((v) => [v.id, v]))

  // Get available versions from server
  const availableVersions = await discoverAvailableVersions()

  // Merge into unified list
  const versions: VersionInfo[] = []
  const seenVersions = new Set<string>()

  // Add available versions (in order)
  for (const version of availableVersions) {
    const downloaded = downloadedMap.get(version)
    seenVersions.add(version)

    versions.push({
      id: version,
      platform: CURRENT_PLATFORM,
      path: downloaded?.path || null,
      checksum: downloaded?.checksum || null,
      size: downloaded?.size || null,
      downloadedAt: downloaded?.downloadedAt || null,
      isActive: downloaded?.isActive || false,
      isBundled: downloaded?.isBundled || false,
      isDownloaded: !!downloaded,
      isAvailable: true,
    })
  }

  // Add any downloaded versions not in available list
  for (const downloaded of downloadedVersions) {
    if (!seenVersions.has(downloaded.id)) {
      versions.push({
        ...downloaded,
        isDownloaded: true,
        isAvailable: false,
        downloadedAt: downloaded.downloadedAt,
      })
    }
  }

  return versions
}

/**
 * Activate a specific version
 */
export async function activateVersion(version: string): Promise<void> {
  const db = getDatabase()

  // Check version exists in database
  const versionRecord = db
    .select()
    .from(claudeBinaryVersions)
    .where(eq(claudeBinaryVersions.id, version))
    .get()

  if (!versionRecord) {
    throw new Error(`Version ${version} not found. Download it first.`)
  }

  if (!versionRecord.path || !fs.existsSync(versionRecord.path)) {
    throw new Error(`Binary for version ${version} not found at path: ${versionRecord.path}`)
  }

  console.log(`[version-manager] Activating version ${version}`)

  // Deactivate all versions
  db.update(claudeBinaryVersions).set({ isActive: false }).run()

  // Activate selected version
  db.update(claudeBinaryVersions)
    .set({ isActive: true })
    .where(eq(claudeBinaryVersions.id, version))
    .run()

  // Restart background session to use new binary
  console.log(`[version-manager] Restarting background session with new binary`)
  await resetBackgroundSession()

  console.log(`[version-manager] Successfully activated version ${version}`)
}

/**
 * Delete a downloaded version
 */
export async function deleteVersion(version: string): Promise<void> {
  const db = getDatabase()

  const versionRecord = db
    .select()
    .from(claudeBinaryVersions)
    .where(eq(claudeBinaryVersions.id, version))
    .get()

  if (!versionRecord) {
    throw new Error(`Version ${version} not found`)
  }

  if (versionRecord.isBundled) {
    throw new Error(`Cannot delete bundled version`)
  }

  if (versionRecord.isActive) {
    throw new Error(`Cannot delete active version. Switch to another version first.`)
  }

  console.log(`[version-manager] Deleting version ${version}`)

  // Delete binary file
  if (versionRecord.path && fs.existsSync(versionRecord.path)) {
    fs.unlinkSync(versionRecord.path)

    // Try to remove parent directory if empty
    const parentDir = path.dirname(versionRecord.path)
    try {
      fs.rmdirSync(parentDir)
    } catch {
      // Directory not empty, that's fine
    }
  }

  // Remove from database
  db.delete(claudeBinaryVersions).where(eq(claudeBinaryVersions.id, version)).run()

  console.log(`[version-manager] Successfully deleted version ${version}`)
}

/**
 * Reset to bundled version
 */
export async function resetToBundled(): Promise<void> {
  const bundledVersion = getBundledVersion()
  if (bundledVersion === "unknown") {
    throw new Error("Bundled version not available")
  }

  // Ensure bundled is registered
  ensureBundledVersionRegistered()

  // Activate bundled version
  await activateVersion(bundledVersion)
}

/**
 * Clear the version discovery cache
 */
export function clearVersionCache(): void {
  discoveredVersionsCache = null
  discoveredVersionsCacheTime = 0
}
