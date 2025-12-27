-- Add new column for game prints without icons
-- Existing game_print_image_path data is preserved (already contains final prints)
ALTER TABLE "arc-spirits-rev2".hex_spirits
  ADD COLUMN IF NOT EXISTS game_print_no_icons TEXT;
