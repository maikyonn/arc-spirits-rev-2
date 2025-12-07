-- Add card_image_path column to artifacts table
ALTER TABLE "arc-spirits-rev2".artifacts
ADD COLUMN IF NOT EXISTS card_image_path text;

