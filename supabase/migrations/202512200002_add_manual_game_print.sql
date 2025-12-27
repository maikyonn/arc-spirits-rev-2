-- Add column to mark spirits with manually uploaded game prints
-- These spirits will be skipped during icon placer generation
ALTER TABLE "arc-spirits-rev2".hex_spirits
  ADD COLUMN IF NOT EXISTS manual_game_print BOOLEAN DEFAULT FALSE;
