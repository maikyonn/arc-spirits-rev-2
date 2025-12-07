-- Add class_id column to runes table
ALTER TABLE "arc-spirits-rev2".runes
ADD COLUMN class_id UUID REFERENCES "arc-spirits-rev2".classes(id) ON DELETE SET NULL;

-- Add comment explaining the relationship
COMMENT ON COLUMN "arc-spirits-rev2".runes.class_id IS 'Optional class reference. A rune can be linked to either an origin OR a class.';
COMMENT ON COLUMN "arc-spirits-rev2".runes.origin_id IS 'Optional origin reference. A rune can be linked to either an origin OR a class.';
