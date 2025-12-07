-- Migration: Add flexible reward_rows system to monsters
-- This replaces the old reward_icons array and reward_header_type columns
-- with a more flexible JSONB array that supports multiple reward rows

-- Add new reward_rows column
ALTER TABLE "arc-spirits-rev2".monsters 
ADD COLUMN IF NOT EXISTS reward_rows JSONB DEFAULT '[]'::jsonb;

-- Migrate existing data from reward_icons and reward_header_type to reward_rows
-- Map 'default' to 'all_in_combat', keep 'tournament' as is
UPDATE "arc-spirits-rev2".monsters
SET reward_rows = CASE
  WHEN reward_icons IS NOT NULL AND array_length(reward_icons, 1) > 0 THEN
    jsonb_build_array(
      jsonb_build_object(
        'type', CASE 
          WHEN reward_header_type = 'tournament' THEN 'tournament'
          ELSE 'all_in_combat'
        END,
        'icon_ids', to_jsonb(reward_icons)
      )
    )
  ELSE '[]'::jsonb
END
WHERE reward_rows IS NULL OR reward_rows = '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN "arc-spirits-rev2".monsters.reward_rows IS 
'Array of reward row objects. Each row has:
- type: "all_in_combat" | "all_losers" | "all_winners" | "tournament"
- icon_ids: string[] of misc_asset IDs
- label: optional custom label override

Type mappings:
- "all_in_combat" displays "ALL IN COMBAT GAIN" (amber)
- "all_losers" displays "ALL LOSERS GAIN" (red)
- "all_winners" displays "ALL WINNERS GAIN" (green)
- "tournament" displays 1ST/2ND/3RD+ placement headers (amber)

Example: [{"type": "all_in_combat", "icon_ids": ["uuid1", "uuid2"]}, {"type": "all_winners", "icon_ids": ["uuid3"]}]';

-- Note: We keep the old columns for now to allow rollback if needed
-- They can be removed in a future migration after verifying the new system works

