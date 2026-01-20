---
created: 2026-01-20T13:33
title: Allow workspaces without git repos
area: projects
files:
  - src/renderer/features/agents/main/new-chat-form.tsx
  - src/main/lib/trpc/routers/projects.ts
  - src/renderer/features/onboarding/
---

## Problem

Currently, the app requires workspaces to be tied to git repositories. This limits general usage where users want to:
- Use the app for general AI assistance without version control
- Start quickly without navigating to a git project
- Work with files in their home directory or other non-repo folders

The default chat pane should support non-git workspaces and default to the user's $HOME directory on first start, making the app immediately useful for general purposes.

## Solution

TBD - Design needed for:

1. **Workspace types:**
   - Git-based workspace (current behavior)
   - Folder-based workspace (no git required)
   - Default to $HOME for new users

2. **Onboarding flow updates:**
   - Don't require git repo selection on first start
   - Allow "Skip" or "Use Home Directory" option
   - Update project creation to support both types

3. **UI changes:**
   - Update new chat form to handle non-git workspaces
   - Show different indicators for git vs folder workspaces
   - Update project selector to show workspace type

4. **Implementation considerations:**
   - Git operations should gracefully degrade for non-git workspaces
   - Worktree features only available for git workspaces
   - File operations work the same regardless of git status

## Context

This was identified during workflow visualization improvements (2026-01-20) as a usability enhancement to make the app more accessible for general-purpose use, not just code projects.
