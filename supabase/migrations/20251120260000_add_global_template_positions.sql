-- Add global template positions to dice_templates table
-- Store positions as JSON: { "1": { "x": 100, "y": 200 }, "2": { "x": 300, "y": 200 }, ... }
ALTER TABLE "arc-spirits-rev2".dice_templates
ADD COLUMN IF NOT EXISTS template_positions JSONB DEFAULT '{}'::jsonb;

-- Note: We'll keep template_x and template_y on dice_sides for now but won't use them
-- They can be removed later if needed

