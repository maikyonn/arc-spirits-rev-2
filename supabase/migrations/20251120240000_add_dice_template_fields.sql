-- Add template_image_path to custom_dice table
ALTER TABLE "arc-spirits-rev2".custom_dice
ADD COLUMN IF NOT EXISTS template_image_path TEXT;

-- Add template position fields to dice_sides table
ALTER TABLE "arc-spirits-rev2".dice_sides
ADD COLUMN IF NOT EXISTS template_x INTEGER;
ALTER TABLE "arc-spirits-rev2".dice_sides
ADD COLUMN IF NOT EXISTS template_y INTEGER;

