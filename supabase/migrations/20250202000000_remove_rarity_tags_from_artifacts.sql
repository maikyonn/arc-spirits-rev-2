-- Remove rarity tags from artifacts and delete rarity tags from artifact_tags table
-- This migration removes the concept of rarity from artifacts

-- First, remove rarity tags from all artifacts' tags arrays
UPDATE "arc-spirits-rev2".artifacts
SET tags = array_remove(tags, 'Rare')
WHERE 'Rare' = ANY(tags);

UPDATE "arc-spirits-rev2".artifacts
SET tags = array_remove(tags, 'Epic')
WHERE 'Epic' = ANY(tags);

UPDATE "arc-spirits-rev2".artifacts
SET tags = array_remove(tags, 'Legendary')
WHERE 'Legendary' = ANY(tags);

-- Set tags to NULL if the array becomes empty
UPDATE "arc-spirits-rev2".artifacts
SET tags = NULL
WHERE tags = '{}'::text[];

-- Delete rarity tags from artifact_tags table
DELETE FROM "arc-spirits-rev2".artifact_tags
WHERE name IN ('Rare', 'Epic', 'Legendary');

