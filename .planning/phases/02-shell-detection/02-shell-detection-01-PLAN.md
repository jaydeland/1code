---
phase: 02-shell-detection
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/main/lib/terminal/env.ts
  - src/main/lib/claude/env.ts
  - src/main/lib/terminal/session.ts
autonomous: true
---

<objective>
Consolidate shell detection logic to consistently use the user's system default shell across terminal and Claude Code CLI execution.

Purpose: Currently, terminal and Claude environments use different shell detection methods. Terminal has robust cascading detection (SHELL env → passwd file → fallback), while Claude env has simpler detection (SHELL env → hardcoded /bin/zsh). This consolidates to a single, consistent approach.

Output: Unified shell detection using `getDefaultShell()` from terminal/env.ts in both terminal and Claude environments, with improved documentation.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/main/lib/terminal/env.ts
@src/main/lib/terminal/session.ts
@src/main/lib/claude/env.ts
@.planning/phases/01-remove-auth/01-remove-auth-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Export getDefaultShell from terminal/env.ts</name>
  <files>src/main/lib/terminal/env.ts</files>
  <action>The `getDefaultShell()` function already exists in src/main/lib/terminal/env.ts with proper cascading detection:
1. On Windows: process.env.COMSPEC || "powershell.exe"
2. On Unix: process.env.SHELL (user's actual default)
3. Fallback: Reads from /etc/passwd using getent/dscl
4. Final fallback: /bin/zsh

Ensure it's already exported (it should be). If not, add to exports.

No changes needed to the function logic - it already respects the user's system default via process.env.SHELL.</action>
  <verify>grep "export.*getDefaultShell" src/main/lib/terminal/env.ts shows the export</verify>
  <done>getDefaultShell is exported from terminal/env.ts</done>
</task>

<task type="auto">
  <name>Task 2: Update Claude env to use getDefaultShell</name>
  <files>src/main/lib/claude/env.ts</files>
  <action>Update src/main/lib/claude/env.ts to use the shared shell detection:

1. Add import at top: `import { getDefaultShell } from "../terminal/env"`

2. In `getClaudeShellEnvironment()` function (line ~101), replace:
   `const shell = process.env.SHELL || "/bin/zsh"`

   With:
   `const shell = getDefaultShell()`

3. In fallback env object (line ~152), replace:
   `SHELL: process.env.SHELL || "/bin/zsh"`

   With:
   `SHELL: getDefaultShell()`

4. In `buildClaudeEnv()` function (line ~195), replace:
   `if (!env.SHELL) env.SHELL = "/bin/zsh"`

   With:
   `if (!env.SHELL) env.SHELL = getDefaultShell()`

This ensures Claude Code CLI execution uses the same shell detection as terminals.</action>
  <verify>grep "getDefaultShell" src/main/lib/claude/env.ts shows 3 usages (getClaudeShellEnvironment, fallback, buildClaudeEnv)</verify>
  <done>Claude env uses consolidated getDefaultShell() for consistent shell detection</done>
</task>

<task type="auto">
  <name>Task 3: Add JSDoc documentation to getDefaultShell</name>
  <files>src/main/lib/terminal/env.ts</files>
  <action>Add comprehensive JSDoc documentation to the `getDefaultShell()` function explaining:
1. It respects the user's system default shell via process.env.SHELL
2. process.env.SHELL is set by the OS based on user account configuration
3. The fallback hierarchy (passwd file, hardcoded fallback)
4. Why /bin/zsh is the final fallback (macOS default since Catalina)

Add this JSDoc above the function:

/**
 * Get the user's default shell.
 *
 * On Unix systems, this respects `process.env.SHELL` which is set by the OS
 * based on the user's account configuration in /etc/passwd or directory services.
 * This IS the user's system default shell - not an app-specific choice.
 *
 * Fallback hierarchy:
 * 1. process.env.SHELL (user's configured default)
 * 2. Read from /etc/passwd or dscl (macOS)
 * 3. /bin/zsh (macOS default since Catalina, widely available)
 *
 * On Windows:
 * 1. process.env.COMSPEC (cmd.exe or system default)
 * 2. powershell.exe
 *
 * @returns The absolute path to the user's default shell executable
 */</action>
  <verify>grep -A 20 "Get the user's default shell" src/main/lib/terminal/env.ts shows the JSDoc comment</verify>
  <done>getDefaultShell has clear documentation explaining it respects user's system default</done>
</task>

<task type="auto">
  <name>Task 4: Verify shell detection works across platforms</name>
  <files>src/main/lib/terminal/env.ts,src/main/lib/claude/env.ts</files>
  <action>Run TypeScript type check to ensure no import/export issues:

1. Run: `bun run ts:check`
2. Verify no type errors related to the imports
3. Build should complete successfully

This confirms the shared import works correctly between modules.</action>
  <verify>bun run ts:check completes with no errors</verify>
  <done>TypeScript compilation succeeds, imports are valid</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] TypeScript check passes: bun run ts:check
- [ ] getDefaultShell is imported and used in claude/env.ts
- [ ] JSDoc documentation added to getDefaultShell
- [ ] No hardcoded "/bin/zsh" fallback remains in claude/env.ts
</verification>

<success_criteria>

- Shell detection uses unified getDefaultShell() in both terminal and Claude environments
- User's system default shell (process.env.SHELL) is respected as primary method
- Code has clear documentation explaining the shell detection behavior
- No regression in shell detection for macOS/Linux/Windows
  </success_criteria>

<output>
After completion, create `.planning/phases/02-shell-detection/02-shell-detection-01-SUMMARY.md` with:
- Confirmation that code already uses user's system default (process.env.SHELL)
- Changes made to consolidate detection logic
- Documentation added
- Verification that terminals and Claude CLI both use system default shell
</output>
