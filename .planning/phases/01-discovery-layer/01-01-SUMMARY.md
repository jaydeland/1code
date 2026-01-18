---
phase: 01-discovery-layer
plan: 01
subsystem: api
tags: [trpc, yaml, gray-matter, filesystem, claude-code]

# Dependency graph
requires: []
provides:
  - workflows tRPC router for discovering agents, commands, and skills
  - filesystem scanning utilities with YAML frontmatter parsing
  - config directory resolution with customConfigDir support
affects: [visualization-layer, dependency-tree]

# Tech tracking
tech-stack:
  added: []
  patterns: [filesystem scanning, YAML frontmatter parsing, path validation]

key-files:
  created: [src/main/lib/trpc/routers/workflows.ts]
  modified: [src/main/lib/trpc/routers/index.ts]

key-decisions:
  - "Reuse existing gray-matter dependency from skills router"
  - "Use async/await for all filesystem operations"
  - "Validate paths to prevent directory traversal attacks"

patterns-established:
  - "Scanning pattern: read dir, validate entry, parse file, return metadata"
  - "Error handling: log and skip invalid entries, don't fail entire scan"
  - "Security: validate filenames don't contain path traversal sequences"

issues-created: []

# Metrics
duration: 15min
completed: 2026-01-18
---

# Plan 01-01: Workflows Router Summary

**tRPC router for discovering Claude Code workflows (agents, commands, skills) with YAML frontmatter parsing from filesystem**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-18T14:37:00Z
- **Completed:** 2026-01-18T14:52:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created workflows tRPC router with three procedures: listAgents, listCommands, listSkills
- Each procedure scans the appropriate directory (agents/, commands/, skills/)
- Parses YAML frontmatter using existing gray-matter dependency
- Respects customConfigDir from claudeCodeSettings table
- Router registered in main tRPC index and accessible via client

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflows tRPC router** - `c7d82e8` (feat)
2. **Task 2: Fix JSDoc syntax and register workflows router** - `b7b5b79` (fix)

## Files Created/Modified

- `src/main/lib/trpc/routers/workflows.ts` - New router with listAgents, listCommands, listSkills procedures
- `src/main/lib/trpc/routers/index.ts` - Added workflowsRouter import and registration

## Decisions Made

- **Reused gray-matter dependency**: Already installed for skills router, consistent parsing approach
- **Path validation**: Each scanner validates filenames don't contain "..", "/", or "\\" to prevent path traversal
- **Graceful degradation**: If directory doesn't exist, return empty array rather than error
- **Config directory resolution**: Read customConfigDir from database, fallback to ~/.claude/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed JSDoc syntax error in workflows.ts**
- **Found during:** Task 2 (Build verification)
- **Issue:** esbuild interpreted `*/*` pattern in JSDoc comment as multiplication operator
- **Fix:** Changed `~/.claude/skills/*/SKILL.md` to `~/.claude/skills/[dirname]/SKILL.md`
- **Files modified:** src/main/lib/trpc/routers/workflows.ts
- **Verification:** `bun run build` passes successfully
- **Committed in:** b7b5b79 (combined with router registration)

---

**Total deviations:** 1 auto-fixed (1 blocking), 0 deferred
**Impact on plan:** Fix was necessary for build to pass. No scope creep.

## Issues Encountered

- esbuild parser error with shell glob patterns in JSDoc comments - resolved by rewriting comment to avoid `*/*`

## Next Phase Readiness

- workflows router complete and ready for consumption by UI layer
- Data pipeline established for reading Claude Code workflow definitions
- Ready for plan 01-02: UI components for browsing discovered workflows

---
*Plan: 01-01*
*Completed: 2026-01-18*
