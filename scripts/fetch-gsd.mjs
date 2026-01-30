#!/usr/bin/env node

/**
 * Fetch GSD (Get Shit Done) repository for bundling with the app.
 *
 * This script downloads the latest release from GitHub and extracts it
 * to resources/gsd/ for bundling with the Electron app.
 *
 * Usage: node scripts/fetch-gsd.mjs [--force]
 *
 * Options:
 *   --force   Force re-download even if resources/gsd/ already exists
 */

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import https from "https"
import { createWriteStream } from "fs"
import { createGunzip } from "zlib"
import { pipeline } from "stream/promises"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, "..")
const GSD_DIR = path.join(ROOT_DIR, "resources", "gsd")
const GSD_REPO = "glittercowboy/get-shit-done"
const GSD_GITHUB_URL = `https://api.github.com/repos/${GSD_REPO}/releases/latest`

/**
 * Fetch JSON from a URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Claw-Desktop-App",
        Accept: "application/vnd.github.v3+json",
      },
    }

    https
      .get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchJson(res.headers.location).then(resolve).catch(reject)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        let data = ""
        res.on("data", (chunk) => (data += chunk))
        res.on("end", () => {
          try {
            resolve(JSON.parse(data))
          } catch (err) {
            reject(err)
          }
        })
      })
      .on("error", reject)
  })
}

/**
 * Download a file from URL to destination
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "Claw-Desktop-App",
      },
    }

    https
      .get(url, options, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadFile(res.headers.location, dest).then(resolve).catch(reject)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        const file = createWriteStream(dest)
        res.pipe(file)
        file.on("finish", () => {
          file.close()
          resolve()
        })
        file.on("error", (err) => {
          fs.unlink(dest).catch(() => {})
          reject(err)
        })
      })
      .on("error", reject)
  })
}

/**
 * Extract tarball to destination directory
 */
async function extractTarball(tarballPath, destDir) {
  // Use tar command for extraction (available on macOS/Linux)
  await execAsync(`tar -xzf "${tarballPath}" -C "${destDir}" --strip-components=1`)
}

/**
 * Get current bundled version if exists
 */
async function getCurrentVersion() {
  try {
    const packageJsonPath = path.join(GSD_DIR, "package.json")
    const content = await fs.readFile(packageJsonPath, "utf-8")
    const pkg = JSON.parse(content)
    return pkg.version
  } catch {
    return null
  }
}

/**
 * Main function
 */
async function main() {
  const force = process.argv.includes("--force")

  console.log("Fetching GSD (Get Shit Done) repository...")
  console.log(`Repository: ${GSD_REPO}`)
  console.log(`Destination: ${GSD_DIR}`)
  console.log("")

  // Check if GSD already exists
  const currentVersion = await getCurrentVersion()
  if (currentVersion && !force) {
    console.log(`GSD v${currentVersion} is already bundled.`)
    console.log("Use --force to re-download.")
    return
  }

  // Fetch latest release info
  console.log("Fetching latest release info from GitHub...")
  const release = await fetchJson(GSD_GITHUB_URL)
  const latestVersion = release.tag_name.replace(/^v/, "")
  const tarballUrl = release.tarball_url

  console.log(`Latest version: v${latestVersion}`)

  if (currentVersion === latestVersion && !force) {
    console.log("Already up to date.")
    return
  }

  // Create temp directory for download
  const tempDir = path.join(ROOT_DIR, ".gsd-temp")
  const tarballPath = path.join(tempDir, "gsd.tar.gz")

  try {
    // Clean up existing temp and gsd directories
    await fs.rm(tempDir, { recursive: true, force: true })
    await fs.mkdir(tempDir, { recursive: true })

    // Download tarball
    console.log(`Downloading tarball from ${tarballUrl}...`)
    await downloadFile(tarballUrl, tarballPath)
    console.log("Download complete.")

    // Remove existing GSD directory
    await fs.rm(GSD_DIR, { recursive: true, force: true })
    await fs.mkdir(GSD_DIR, { recursive: true })

    // Extract tarball
    console.log("Extracting...")
    await extractTarball(tarballPath, GSD_DIR)
    console.log("Extraction complete.")

    // Verify extraction
    const newVersion = await getCurrentVersion()
    if (!newVersion) {
      throw new Error("Failed to extract GSD - package.json not found")
    }

    console.log("")
    console.log(`Successfully installed GSD v${newVersion}`)

    // List key directories
    const entries = await fs.readdir(GSD_DIR)
    console.log("\nBundled contents:")
    for (const entry of entries.slice(0, 10)) {
      console.log(`  - ${entry}`)
    }
    if (entries.length > 10) {
      console.log(`  ... and ${entries.length - 10} more`)
    }
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
