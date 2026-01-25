# Worktree Location Migration - Implementation Summary

## Overview

Implemented a migration system to update existing projects from old worktree location pattern to the new sibling directory pattern.

## Changes Made

### 1. Database Schema Updates

**File**: `src/main/lib/db/schema/index.ts`

- Added `appSettings` table to track migration versions
- Fields:
  - `id` (primary key, always "default")
  - `lastMigrationVersion` (text, tracks last applied migration)
  - `updatedAt` (timestamp)

**Migration**: `drizzle/0019_broad_zuras.sql`
- Creates `app_settings` table

### 2. Migration Logic

**File**: `src/main/lib/migrations/worktree-location-migration.ts`

- Scans all chats with worktree paths
- Identifies old pattern: `/.21st/worktrees/`
- Clears old paths (sets to `null`)
- Preserves branch information
- Returns count of migrated chats
- Idempotent (safe to run multiple times)

**File**: `src/main/lib/migrations/index.ts`
- Exports all migration functions

### 3. App Initialization Integration

**File**: `src/main/index.ts`

Added migration runner after database initialization:
1. Checks/creates app_settings record
2. Compares current version vs. last migration version
3. Runs migration if needed
4. Updates migration version
5. Logs progress

### 4. Documentation

**File**: `src/main/lib/migrations/README.md`
- Comprehensive guide for creating data migrations
- Best practices
- Testing guidelines
- Version scheme documentation

### 5. Tests

**File**: `src/main/lib/migrations/__tests__/worktree-location-migration.test.ts`
- Tests migration of old paths
- Tests preservation of new paths
- Tests idempotency
- Tests edge cases (null paths, no worktrees)

## Migration Behavior

### What Gets Migrated

Chats with worktree paths containing `/.21st/worktrees/`:
- ✅ `~/.21st/worktrees/abc123/`
- ✅ `/Users/user/.21st/worktrees/xyz789/`

### What Stays Unchanged

- ✅ New worktree paths (sibling directories)
- ✅ Chats without worktrees
- ✅ Branch names (always preserved)
- ✅ Custom worktree locations

### After Migration

Old worktree chats:
- `worktreePath` → `null`
- `branch` → preserved
- Next worktree creation will use new default location

## Version Tracking

**Migration Version**: `0.1.0`

Stored in `app_settings.lastMigrationVersion`

## Testing

Build successful:
```bash
bun run build
# ✓ built in 625ms (main)
# ✓ built in 14ms (preload)
# ✓ built in 7.47s (renderer)
```

## Future Migrations

To add new data migrations:
1. Create migration file in `src/main/lib/migrations/`
2. Export from `index.ts`
3. Add version check in `src/main/index.ts`
4. Bump version number (semantic versioning)
5. Add tests

See `src/main/lib/migrations/README.md` for detailed guide.

## Expected Behavior on App Start

### First Launch After Update

```
[DB] Initializing database at: ...
[DB] Running migrations from: ...
[DB] Migrations completed
[App] Running worktree location migration...
[migration] Migrated chat abc123: ~/.21st/worktrees/abc123/
[migration] Migrated chat xyz789: ~/.21st/worktrees/xyz789/
[migration] Migrated 2 worktree paths to new default
[App] Worktree migration complete (2 chats updated)
```

### Subsequent Launches

```
[DB] Initializing database at: ...
[DB] Migrations completed
[App] Worktree migration already applied, skipping
```

## Files Created/Modified

### Created
- `src/main/lib/migrations/worktree-location-migration.ts`
- `src/main/lib/migrations/index.ts`
- `src/main/lib/migrations/README.md`
- `src/main/lib/migrations/__tests__/worktree-location-migration.test.ts`
- `drizzle/0019_broad_zuras.sql`
- `MIGRATION-SUMMARY.md` (this file)

### Modified
- `src/main/lib/db/schema/index.ts` - Added appSettings table
- `src/main/index.ts` - Added migration runner

## Rollback Strategy

If migration issues occur:

1. **Database Level**: Restore from backup
   ```bash
   cp ~/Library/Application\ Support/Agents\ Dev/data/agents.db.backup \
      ~/Library/Application\ Support/Agents\ Dev/data/agents.db
   ```

2. **Manual Fix**: Reset migration version
   ```sql
   UPDATE app_settings SET last_migration_version = NULL;
   ```

3. **Code Level**: Revert changes and release patch

## Safety Features

✅ **Idempotent**: Safe to run multiple times
✅ **Non-destructive**: Only clears paths, doesn't delete data
✅ **Preserves branches**: Worktree history maintained
✅ **Selective**: Only migrates old pattern paths
✅ **Logged**: All actions logged for debugging
✅ **Tracked**: Version tracking prevents re-running
✅ **Error handling**: Catches and logs failures

## Next Steps

1. ✅ Test in development environment
2. ✅ Verify build succeeds
3. ⏳ Test with real data
4. ⏳ Update CHANGELOG.md
5. ⏳ Include in next release (v0.1.0)
6. ⏳ Monitor logs after deployment
