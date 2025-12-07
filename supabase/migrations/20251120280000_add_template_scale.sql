-- Add template scale to dice_templates table
ALTER TABLE "arc-spirits-rev2".dice_templates
ADD COLUMN IF NOT EXISTS template_scale INTEGER DEFAULT 100;

