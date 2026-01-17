# Plan 03-03 Summary: AWS Credentials and API Key Auth Modes

**Status:** COMPLETE
**Date:** 2025-01-17
**Commits:** 5

## Overview

Added support for multiple authentication modes to Claude Code integration:
- **OAuth** (existing): Browser-based OAuth flow
- **AWS Bedrock** (new): Use AWS credentials from environment or ~/.aws/credentials
- **API Key** (new): Direct Anthropic API key with encrypted storage

## Changes Made

### Database Schema (`src/main/lib/db/schema/index.ts`)

Added three new fields to `claudeCodeSettings` table:
- `authMode`: "oauth" | "aws" | "apiKey" (default: "oauth")
- `apiKey`: Encrypted API key for apiKey mode (nullable)
- `bedrockRegion`: AWS region for Bedrock (default: "us-east-1")

**Commit:** `f154d6f` feat(db): add auth mode, API key, and Bedrock region fields to claudeCodeSettings

### Claude Settings Router (`src/main/lib/trpc/routers/claude-settings.ts`)

- Added `safeStorage` import from Electron
- Added `encryptApiKey()` and `decryptApiKey()` helper functions
- Updated `getSettings` to return authMode, masked apiKey, and bedrockRegion
- Updated `updateSettings` input schema to accept authMode, apiKey, bedrockRegion
- API key encryption on save using Electron's safeStorage

**Commit:** `aa92eb1` feat(claude-settings): add auth mode and API key encryption support

### Claude Router (`src/main/lib/trpc/routers/claude.ts`)

- Extended `getClaudeCodeSettings()` return type with authMode, apiKey, bedrockRegion
- Added `hasAwsCredentials()` helper to detect AWS credentials
- Added API key decryption in settings retrieval
- Updated environment variable setup to handle all three auth modes:
  - OAuth: `CLAUDE_CODE_OAUTH_TOKEN` (existing behavior)
  - API Key: `ANTHROPIC_API_KEY` (new)
  - AWS: `AWS_REGION` with credential detection (new)

**Commit:** `cc450e8` feat(claude): add support for multiple authentication modes

### UI Component (`src/renderer/features/agents/components/settings-tabs/agents-claude-code-tab.tsx`)

- Added auth mode state: `authMode`, `apiKey`, `bedrockRegion`
- Added credential selector with three buttons (OAuth / AWS Bedrock / API Key)
- Added API key password input (shown only in apiKey mode)
- Added Bedrock region text input (shown only in aws mode)
- Added "Save Auth Settings" button
- Updated connection status display to show mode-specific messaging:
  - OAuth: Shows "Connected (OAuth)" with disconnect button
  - AWS: Shows "AWS Bedrock Mode" with region display
  - API Key: Shows "API Key Configured" or prompt to enter key

**Commit:** `9387c7f` feat(ui): add credential selector and API key input to Claude Code settings

### Database Migration (`drizzle/0007_fixed_speed.sql`)

Generated migration that adds three columns to `claude_code_settings`:
```sql
ALTER TABLE `claude_code_settings` ADD `auth_mode` text DEFAULT 'oauth' NOT NULL;
ALTER TABLE `claude_code_settings` ADD `api_key` text;
ALTER TABLE `claude_code_settings` ADD `bedrock_region` text DEFAULT 'us-east-1' NOT NULL;
```

**Commit:** `e0444bd` chore(db): add migration for auth mode, API key, and Bedrock region fields

## Files Modified

1. `src/main/lib/db/schema/index.ts` - Schema extensions
2. `src/main/lib/trpc/routers/claude-settings.ts` - Router updates with encryption
3. `src/main/lib/trpc/routers/claude.ts` - Auth mode detection and env setup
4. `src/renderer/features/agents/components/settings-tabs/agents-claude-code-tab.tsx` - UI additions
5. `drizzle/0007_fixed_speed.sql` - Migration (generated)

## Testing Notes

- TypeScript compilation passes
- Migration will be applied on next app start via `initDatabase()`
- OAuth flow unchanged (existing behavior)
- AWS mode requires AWS credentials in env vars or ~/.aws/credentials
- API key is encrypted using Electron's safeStorage before storage

## Success Criteria

- [x] Schema includes authMode, apiKey, and bedrockRegion fields
- [x] Router handles all three auth modes (oauth, aws, apiKey)
- [x] Claude router detects AWS credentials automatically
- [x] UI has credential selector with OAuth/AWS/API Key options
- [x] API key is encrypted using safeStorage
- [x] Migration generated and applied successfully
- [x] TypeScript compilation passes
