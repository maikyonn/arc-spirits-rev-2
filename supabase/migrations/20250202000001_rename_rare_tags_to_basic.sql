-- Rename all 'Rare' tags to 'Basic' in artifacts
-- This updates the tags array in all artifacts that contain 'Rare'

UPDATE "arc-spirits-rev2".artifacts
SET tags = array(
    SELECT CASE 
        WHEN tag = 'Rare' THEN 'Basic'
        ELSE tag
    END
    FROM unnest(tags) AS tag
)
WHERE 'Rare' = ANY(tags);

