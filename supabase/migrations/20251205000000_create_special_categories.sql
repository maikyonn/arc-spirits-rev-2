-- Create special_categories table for grouping classes into a single card with 3 slots
CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".special_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#8b5cf6',
    icon_emoji TEXT DEFAULT '⚡',
    position INTEGER NOT NULL DEFAULT 0,
    slot_1_class_ids UUID[] NOT NULL DEFAULT '{}',
    slot_2_class_ids UUID[] NOT NULL DEFAULT '{}',
    slot_3_class_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "arc-spirits-rev2".special_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on special_categories"
    ON "arc-spirits-rev2".special_categories FOR SELECT
    TO public
    USING (true);

-- Also allow anon for local development
CREATE POLICY "Allow anon insert on special_categories"
    ON "arc-spirits-rev2".special_categories FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anon update on special_categories"
    ON "arc-spirits-rev2".special_categories FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow anon delete on special_categories"
    ON "arc-spirits-rev2".special_categories FOR DELETE
    TO anon
    USING (true);
