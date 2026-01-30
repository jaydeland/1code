export interface PrContext {
  branch: string
  baseBranch: string
  uncommittedCount: number
  hasUpstream: boolean
}

/**
 * Generates a message for Claude to create a PR
 */
export function generatePrMessage(context: PrContext): string {
  const { branch, baseBranch, uncommittedCount, hasUpstream } = context

  const lines = [
    uncommittedCount > 0
      ? `There are ${uncommittedCount} uncommitted changes.`
      : "All changes are committed.",
    `The current branch is ${branch}.`,
    `The target branch is origin/${baseBranch}.`,
    hasUpstream
      ? "The branch is already pushed to remote."
      : "There is no upstream branch yet.",
    "The user requested a PR.",
    "",
    "Follow these exact steps to create a PR:",
    "",
  ]

  const steps: string[] = []

  if (uncommittedCount > 0) {
    steps.push("Run git diff to review uncommitted changes")
    steps.push("Commit them. Write a clear, concise commit message.")
  }

  if (!hasUpstream) {
    steps.push("Push to origin")
  }

  steps.push(`Use git diff origin/${baseBranch}... to review the PR diff`)
  steps.push(
    `Use gh pr create --base ${baseBranch} to create a PR. Keep the title under 80 characters and description under five sentences.`
  )
  steps.push("If any of these steps fail, ask the user for help.")

  // Add numbered steps
  steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`)
  })

  return lines.join("\n")
}

/**
 * Generates a message for Claude to commit and push changes to an existing PR
 */
export function generateCommitToPrMessage(context: PrContext): string {
  const { branch, baseBranch, uncommittedCount } = context

  if (uncommittedCount === 0) {
    return `All changes are already committed. The branch ${branch} is up to date.`
  }

  return `There are ${uncommittedCount} uncommitted changes on branch ${branch}.
The PR already exists and targets origin/${baseBranch}.

Please commit and push these changes to update the PR:

1. Run git diff to review uncommitted changes
2. Commit them with a clear, concise commit message
3. Push to origin to update the PR
4. If any of these steps fail, ask the user for help.`
}

/**
 * Generates a message for Claude to perform a code review
 */
export function generateReviewMessage(context: PrContext): string {
  const { branch, baseBranch } = context

  return `You are performing a code review on the changes in the current branch.

The current branch is ${branch}, and the target branch is origin/${baseBranch}.

## Code Review Instructions

When reviewing the diff:
1. **Focus on logic and correctness** - Check for bugs, edge cases, and potential issues.
2. **Consider readability** - Is the code clear and maintainable?
3. **Evaluate performance** - Are there obvious performance concerns?
4. **Assess test coverage** - Are there adequate tests for these changes?

## Getting the Diff

Run \`git diff origin/${baseBranch}...\` to get the changes.

## Output Format

Provide:
1. A brief summary of what the changes do
2. A table of issues found with columns: severity (🔴 high, 🟡 medium, 🟢 low), file:line, issue, suggestion
3. If no issues found, state that the code looks good

Keep the review concise and actionable.`
}

export interface MergeContext {
  sourceBranch: string
  targetBranch: string
  uncommittedCount: number
  targetWorktreePath: string | null
  targetHasUncommittedChanges: boolean
  currentWorktreePath: string
}

/**
 * Generates a message for Claude to perform a local merge
 * Provides step-by-step instructions similar to PR creation
 */
export function generateMergeMessage(context: MergeContext): string {
  const {
    sourceBranch,
    targetBranch,
    uncommittedCount,
    targetWorktreePath,
    targetHasUncommittedChanges,
  } = context

  const lines = [
    `The user wants to merge branch '${sourceBranch}' into '${targetBranch}'.`,
    uncommittedCount > 0
      ? `There are ${uncommittedCount} uncommitted changes on '${sourceBranch}'.`
      : `All changes are committed on '${sourceBranch}'.`,
    targetWorktreePath
      ? `The target branch '${targetBranch}' is checked out in worktree at: ${targetWorktreePath}`
      : `The target branch '${targetBranch}' is not currently checked out in any worktree.`,
    targetHasUncommittedChanges ? `WARNING: The target branch has uncommitted changes.` : "",
    "",
    "Follow these exact steps to merge:",
    "",
  ].filter(Boolean)

  const steps: string[] = []

  // Handle uncommitted changes on source
  if (uncommittedCount > 0) {
    steps.push(
      "Review uncommitted changes on the source branch with git diff",
      "Commit them with a clear message, OR stash them if they shouldn't be included",
    )
  }

  // Handle dual-worktree scenario
  if (targetWorktreePath) {
    if (targetHasUncommittedChanges) {
      steps.push(
        `Switch to target worktree: cd ${targetWorktreePath}`,
        "Review uncommitted changes with git diff",
        "Either commit or stash these changes before proceeding",
      )
    }
    steps.push(
      `Ensure you're in the target worktree: cd ${targetWorktreePath}`,
      `Run: git merge ${sourceBranch} --no-edit`,
      "If merge conflicts occur, list them with: git status",
      "For each conflict, examine the file and resolve the conflict markers",
      "After resolving conflicts, stage with: git add <file>",
      "Complete the merge with: git commit --no-edit",
    )
  } else {
    // Single worktree scenario
    steps.push(
      `Switch to target branch: git checkout ${targetBranch}`,
      `Run: git merge ${sourceBranch} --no-edit`,
      "If merge conflicts occur, list them with: git status",
      "For each conflict, examine the file and resolve the conflict markers",
      "After resolving conflicts, stage with: git add <file>",
      "Complete the merge with: git commit --no-edit",
      `Return to source branch: git checkout ${sourceBranch}`,
    )
  }

  steps.push("If any step fails, explain the error to the user and ask for guidance.")

  steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step}`)
  })

  return lines.join("\n")
}
