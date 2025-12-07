-- Create a global dice template table (one template for all dice)
CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".dice_templates (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	template_image_path TEXT,
	created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default row if it doesn't exist
INSERT INTO "arc-spirits-rev2".dice_templates (id, template_image_path)
SELECT gen_random_uuid(), NULL
WHERE NOT EXISTS (SELECT 1 FROM "arc-spirits-rev2".dice_templates);

-- Remove template_image_path from custom_dice (migrate existing data if needed)
-- Note: We'll keep the column for now but won't use it
-- ALTER TABLE "arc-spirits-rev2".custom_dice DROP COLUMN IF EXISTS template_image_path;

