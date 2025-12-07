-- Add rank column to artifact_tags
ALTER TABLE "arc-spirits-rev2".artifact_tags ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0;

-- Update rank for existing rarity tags
UPDATE "arc-spirits-rev2".artifact_tags SET rank = 1 WHERE name = 'Rare';
UPDATE "arc-spirits-rev2".artifact_tags SET rank = 2 WHERE name = 'Epic';
UPDATE "arc-spirits-rev2".artifact_tags SET rank = 3 WHERE name = 'Legendary';

-- Create function to validate tags
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".validate_artifact_tags()
RETURNS TRIGGER AS $$
DECLARE
    tag TEXT;
    valid_tag BOOLEAN;
BEGIN
    IF NEW.tags IS NOT NULL THEN
        FOREACH tag IN ARRAY NEW.tags
        LOOP
            SELECT EXISTS(SELECT 1 FROM "arc-spirits-rev2".artifact_tags WHERE name = tag) INTO valid_tag;
            IF NOT valid_tag THEN
                RAISE EXCEPTION 'Invalid tag: %', tag;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate tags on insert or update
DROP TRIGGER IF EXISTS trigger_validate_artifact_tags ON "arc-spirits-rev2".artifacts;
CREATE TRIGGER trigger_validate_artifact_tags
BEFORE INSERT OR UPDATE ON "arc-spirits-rev2".artifacts
FOR EACH ROW
EXECUTE FUNCTION "arc-spirits-rev2".validate_artifact_tags();
