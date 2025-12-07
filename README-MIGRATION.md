# Storage Bucket Migration

This script migrates all files from the old storage buckets (`class_icons`, `origin_icons`, `hex_spirit_images`, `rune_backgrounds`) to the consolidated `game_assets` bucket.

## Prerequisites

You need your Supabase **service_role** key (not the anon key). You can find it in:
- Supabase Dashboard → Settings → API → `service_role` key

⚠️ **Warning**: The service_role key has admin privileges. Never commit it to version control or expose it publicly.

## Setup

1. Set your service role key as an environment variable:

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Or add it to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Run Migration

```bash
node scripts/migrate-storage-buckets.mjs
```

## What It Does

1. **Copies files** from old buckets to `game_assets` with folder prefixes:
   - `class_icons/` → `game_assets/class_icons/`
   - `origin_icons/` → `game_assets/origin_icons/`
   - `hex_spirit_images/` → `game_assets/hex_spirits/`
   - `rune_backgrounds/` → `game_assets/rune_backgrounds/`

2. **Updates database paths** in:
   - `classes.icon`
   - `origins.icon`
   - `hex_spirits.game_print_image_path`

3. **Deletes files** from old buckets after successful migration

4. **Deletes empty buckets** after all files are migrated

## Notes

- The script is idempotent - you can run it multiple times safely
- Files are uploaded with `upsert: true` to avoid duplicates
- Database updates only happen if the table and column are specified
- Old buckets are only deleted if they're empty
