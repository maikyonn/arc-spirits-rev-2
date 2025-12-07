-- Add icon_path column to runes table
ALTER TABLE "arc-spirits-rev2".runes
ADD COLUMN IF NOT EXISTS icon_path text;

