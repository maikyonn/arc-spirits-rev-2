-- ============================================
-- Central Icon Pool Refactor Migration
-- ============================================
-- This migration transforms icon_pool into a true central registry
-- where ALL icon sources sync via database triggers.
--
-- Before: icon_pool only had origin/class/custom icons
-- After: icon_pool contains ALL icons (origin, class, custom, rune, dice_side, uploaded)
-- ============================================

-- 1. Add new columns to icon_pool
ALTER TABLE "arc-spirits-rev2".icon_pool
ADD COLUMN IF NOT EXISTS source_table TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Update source_type check constraint to include new types
ALTER TABLE "arc-spirits-rev2".icon_pool
DROP CONSTRAINT IF EXISTS icon_pool_source_type_check;

ALTER TABLE "arc-spirits-rev2".icon_pool
ADD CONSTRAINT icon_pool_source_type_check
CHECK (source_type IN ('origin', 'class', 'custom', 'rune', 'dice_side', 'uploaded'));

-- 3. Add unique constraint on source reference (prevents duplicate syncs)
-- First, we need to handle potential duplicates before adding constraint
-- Delete any existing duplicates, keeping the oldest one
DELETE FROM "arc-spirits-rev2".icon_pool a
USING "arc-spirits-rev2".icon_pool b
WHERE a.source_type = b.source_type
  AND a.source_id = b.source_id
  AND a.source_id IS NOT NULL
  AND a.created_at > b.created_at;

ALTER TABLE "arc-spirits-rev2".icon_pool
DROP CONSTRAINT IF EXISTS unique_source_reference;

ALTER TABLE "arc-spirits-rev2".icon_pool
ADD CONSTRAINT unique_source_reference UNIQUE (source_type, source_id);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_icon_pool_source_type ON "arc-spirits-rev2".icon_pool(source_type);
CREATE INDEX IF NOT EXISTS idx_icon_pool_source_id ON "arc-spirits-rev2".icon_pool(source_id);
CREATE INDEX IF NOT EXISTS idx_icon_pool_export ON "arc-spirits-rev2".icon_pool(export_as_token) WHERE export_as_token = TRUE;

-- ============================================
-- SYNC TRIGGERS
-- ============================================

-- 5. Origin Icon Sync Trigger
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".sync_origin_icon()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.icon_png IS NOT NULL THEN
            INSERT INTO "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            VALUES
                (NEW.name, 'origin', NEW.id, 'origins', NEW.icon_png,
                 jsonb_build_object('color', NEW.color, 'position', NEW.position),
                 NOW())
            ON CONFLICT (source_type, source_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' AND OLD.icon_png IS NOT NULL AND NEW.icon_png IS NULL THEN
            DELETE FROM "arc-spirits-rev2".icon_pool
            WHERE source_type = 'origin' AND source_id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM "arc-spirits-rev2".icon_pool
        WHERE source_type = 'origin' AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS origin_icon_sync ON "arc-spirits-rev2".origins;
CREATE TRIGGER origin_icon_sync
AFTER INSERT OR UPDATE OR DELETE ON "arc-spirits-rev2".origins
FOR EACH ROW EXECUTE FUNCTION "arc-spirits-rev2".sync_origin_icon();

-- 6. Class Icon Sync Trigger
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".sync_class_icon()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.icon_png IS NOT NULL THEN
            INSERT INTO "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            VALUES
                (NEW.name, 'class', NEW.id, 'classes', NEW.icon_png,
                 jsonb_build_object('color', NEW.color, 'position', NEW.position),
                 NOW())
            ON CONFLICT (source_type, source_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' AND OLD.icon_png IS NOT NULL AND NEW.icon_png IS NULL THEN
            DELETE FROM "arc-spirits-rev2".icon_pool
            WHERE source_type = 'class' AND source_id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM "arc-spirits-rev2".icon_pool
        WHERE source_type = 'class' AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS class_icon_sync ON "arc-spirits-rev2".classes;
CREATE TRIGGER class_icon_sync
AFTER INSERT OR UPDATE OR DELETE ON "arc-spirits-rev2".classes
FOR EACH ROW EXECUTE FUNCTION "arc-spirits-rev2".sync_class_icon();

-- 7. Rune Icon Sync Trigger
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".sync_rune_icon()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.icon_path IS NOT NULL THEN
            INSERT INTO "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            VALUES
                ('Rune: ' || NEW.name, 'rune', NEW.id, 'runes', NEW.icon_path,
                 jsonb_build_object('origin_id', NEW.origin_id, 'class_id', NEW.class_id),
                 NOW())
            ON CONFLICT (source_type, source_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' AND OLD.icon_path IS NOT NULL AND NEW.icon_path IS NULL THEN
            DELETE FROM "arc-spirits-rev2".icon_pool
            WHERE source_type = 'rune' AND source_id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM "arc-spirits-rev2".icon_pool
        WHERE source_type = 'rune' AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rune_icon_sync ON "arc-spirits-rev2".runes;
CREATE TRIGGER rune_icon_sync
AFTER INSERT OR UPDATE OR DELETE ON "arc-spirits-rev2".runes
FOR EACH ROW EXECUTE FUNCTION "arc-spirits-rev2".sync_rune_icon();

-- 8. Dice Side Icon Sync Trigger
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".sync_dice_side_icon()
RETURNS TRIGGER AS $$
DECLARE
    dice_name TEXT;
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.image_path IS NOT NULL THEN
            SELECT name INTO dice_name
            FROM "arc-spirits-rev2".custom_dice
            WHERE id = NEW.dice_id;

            INSERT INTO "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            VALUES
                (COALESCE(dice_name, 'Dice') || ' - Side ' || NEW.side_number,
                 'dice_side', NEW.id, 'dice_sides', NEW.image_path,
                 jsonb_build_object('dice_id', NEW.dice_id, 'side_number', NEW.side_number),
                 NOW())
            ON CONFLICT (source_type, source_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' AND OLD.image_path IS NOT NULL AND NEW.image_path IS NULL THEN
            DELETE FROM "arc-spirits-rev2".icon_pool
            WHERE source_type = 'dice_side' AND source_id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        DELETE FROM "arc-spirits-rev2".icon_pool
        WHERE source_type = 'dice_side' AND source_id = OLD.id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dice_side_icon_sync ON "arc-spirits-rev2".dice_sides;
CREATE TRIGGER dice_side_icon_sync
AFTER INSERT OR UPDATE OR DELETE ON "arc-spirits-rev2".dice_sides
FOR EACH ROW EXECUTE FUNCTION "arc-spirits-rev2".sync_dice_side_icon();

-- 9. Uploaded Icon Sync Trigger (misc_assets with category='icon')
CREATE OR REPLACE FUNCTION "arc-spirits-rev2".sync_uploaded_icon()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.category = 'icon' AND NEW.file_path IS NOT NULL THEN
            INSERT INTO "arc-spirits-rev2".icon_pool
                (name, source_type, source_id, source_table, file_path, metadata, updated_at)
            VALUES
                (NEW.name, 'uploaded', NEW.id, 'misc_assets', NEW.file_path,
                 jsonb_build_object('file_type', NEW.file_type, 'file_size', NEW.file_size),
                 NOW())
            ON CONFLICT (source_type, source_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                file_path = EXCLUDED.file_path,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' THEN
            -- Category changed from 'icon' to something else, or file_path removed
            IF (OLD.category = 'icon' AND (NEW.category != 'icon' OR NEW.file_path IS NULL)) THEN
                DELETE FROM "arc-spirits-rev2".icon_pool
                WHERE source_type = 'uploaded' AND source_id = NEW.id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.category = 'icon' THEN
            DELETE FROM "arc-spirits-rev2".icon_pool
            WHERE source_type = 'uploaded' AND source_id = OLD.id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS uploaded_icon_sync ON "arc-spirits-rev2".misc_assets;
CREATE TRIGGER uploaded_icon_sync
AFTER INSERT OR UPDATE OR DELETE ON "arc-spirits-rev2".misc_assets
FOR EACH ROW EXECUTE FUNCTION "arc-spirits-rev2".sync_uploaded_icon();

-- ============================================
-- BACKFILL EXISTING DATA
-- ============================================

-- 10. Update existing origin/class entries with source_table
UPDATE "arc-spirits-rev2".icon_pool
SET source_table = 'origins'
WHERE source_type = 'origin' AND source_table IS NULL;

UPDATE "arc-spirits-rev2".icon_pool
SET source_table = 'classes'
WHERE source_type = 'class' AND source_table IS NULL;

-- 11. Backfill runes (with icon_path)
INSERT INTO "arc-spirits-rev2".icon_pool (name, source_type, source_id, source_table, file_path, metadata)
SELECT
    'Rune: ' || r.name,
    'rune',
    r.id,
    'runes',
    r.icon_path,
    jsonb_build_object('origin_id', r.origin_id, 'class_id', r.class_id)
FROM "arc-spirits-rev2".runes r
WHERE r.icon_path IS NOT NULL
ON CONFLICT (source_type, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    file_path = EXCLUDED.file_path,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 12. Backfill dice sides (with image_path)
INSERT INTO "arc-spirits-rev2".icon_pool (name, source_type, source_id, source_table, file_path, metadata)
SELECT
    COALESCE(cd.name, 'Dice') || ' - Side ' || ds.side_number,
    'dice_side',
    ds.id,
    'dice_sides',
    ds.image_path,
    jsonb_build_object('dice_id', ds.dice_id, 'side_number', ds.side_number)
FROM "arc-spirits-rev2".dice_sides ds
LEFT JOIN "arc-spirits-rev2".custom_dice cd ON ds.dice_id = cd.id
WHERE ds.image_path IS NOT NULL
ON CONFLICT (source_type, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    file_path = EXCLUDED.file_path,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 13. Backfill uploaded icons from misc_assets (category='icon')
INSERT INTO "arc-spirits-rev2".icon_pool (name, source_type, source_id, source_table, file_path, metadata)
SELECT
    ma.name,
    'uploaded',
    ma.id,
    'misc_assets',
    ma.file_path,
    jsonb_build_object('file_type', ma.file_type, 'file_size', ma.file_size)
FROM "arc-spirits-rev2".misc_assets ma
WHERE ma.category = 'icon' AND ma.file_path IS NOT NULL
ON CONFLICT (source_type, source_id) DO UPDATE SET
    name = EXCLUDED.name,
    file_path = EXCLUDED.file_path,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- 14. Add comment to document the new structure
COMMENT ON TABLE "arc-spirits-rev2".icon_pool IS
'Central icon registry. All icon sources (origins, classes, runes, dice_sides, misc_assets)
sync to this table via database triggers. Use this as the single source of truth for icons.

source_type: origin | class | custom | rune | dice_side | uploaded
source_table: origins | classes | runes | dice_sides | misc_assets | null (for custom)
source_id: FK to source table row (null for custom icons)
metadata: JSONB with source-specific data (color, position, origin_id, dice_id, etc.)';
