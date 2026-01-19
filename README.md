# 1Code

[1Code.dev](https://1code.dev)

Best UI for Claude Code with local and remote agent execution.

By [21st.dev](https://21st.dev) team

## Features

- **Plan & Agent Modes** - Read-only analysis or full code execution permissions
- **Project Management** - Link local folders with automatic Git remote detection
- **Real-time Tool Execution** - See bash commands, file edits, and web searches as they happen
- **Git Worktree Isolation** - Each chat session runs in its own isolated worktree
- **Integrated Terminal** - Full terminal access within the app
- **Change Tracking** - Visual diffs and PR management

## Installation

### Prerequisites

- **Flox** - For reproducible development environment ([install instructions](https://flox.dev/docs))
- **Devyard environment** - 1code inherits TypeScript tooling from the devyard Flox environment (must be accessible via symlink at `./devyard`)
- **Python 3** - For native module compilation (inherited from devyard)
- **Xcode Command Line Tools** (macOS) - Run `xcode-select --install`

### Option 1: Build from source (free)

```bash
# 1. Activate Flox environment (manages bun, electron, inherits from devyard)
cd /path/to/1code
flox activate

# 2. Install JavaScript dependencies
bun install

# 3. Download Claude binary (required for agent functionality)
bun run claude:download

# 4. Build and package
bun run build
bun run package:mac  # or package:win, package:linux
```

> **Important:** The Flox environment provides bun, electron, and inherits TypeScript LSP from devyard. The `claude:download` step downloads the Claude CLI binary which is required for agent chat functionality.

### Option 2: Subscribe to 1code.dev (recommended)

Get pre-built releases + background agents support by subscribing at [1code.dev](https://1code.dev).

Your subscription helps us maintain and improve 1Code.

## Development

```bash
# First time setup
flox activate
bun install
bun run claude:download  # First time only

# Daily workflow
flox activate  # Once per terminal session
bun run dev
```

## Feedback & Community

Join our [Discord](https://discord.gg/8ektTZGnj4) for support and discussions.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
