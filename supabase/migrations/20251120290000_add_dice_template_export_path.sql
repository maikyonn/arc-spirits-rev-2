-- Add exported template path to custom_dice table
-- This links each dice to its exported template prefab image
ALTER TABLE "arc-spirits-rev2".custom_dice
ADD COLUMN IF NOT EXISTS exported_template_path TEXT;

