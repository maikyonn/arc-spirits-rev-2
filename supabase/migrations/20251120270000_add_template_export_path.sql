-- Add exported template image path to dice_templates table
ALTER TABLE "arc-spirits-rev2".dice_templates
ADD COLUMN IF NOT EXISTS exported_template_path TEXT;

