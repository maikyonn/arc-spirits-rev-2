-- Add image_path column to dice_sides table
ALTER TABLE "arc-spirits-rev2".dice_sides
ADD COLUMN IF NOT EXISTS image_path TEXT;

