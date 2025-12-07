-- Add card_image_path to monsters table
ALTER TABLE "arc-spirits-rev2".monsters
ADD COLUMN IF NOT EXISTS card_image_path TEXT;

