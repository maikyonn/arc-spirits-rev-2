-- Enable RLS on artifacts table if not already enabled
ALTER TABLE "arc-spirits-rev2".artifacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow all operations on artifacts" ON "arc-spirits-rev2".artifacts;
DROP POLICY IF EXISTS "Public read access for artifacts" ON "arc-spirits-rev2".artifacts;
DROP POLICY IF EXISTS "Public insert for artifacts" ON "arc-spirits-rev2".artifacts;
DROP POLICY IF EXISTS "Public update for artifacts" ON "arc-spirits-rev2".artifacts;
DROP POLICY IF EXISTS "Public delete for artifacts" ON "arc-spirits-rev2".artifacts;

-- Create policies for artifacts table
-- Allow all operations (SELECT, INSERT, UPDATE, DELETE) for all users
-- This is appropriate for a game data management interface
CREATE POLICY "Allow all operations on artifacts"
ON "arc-spirits-rev2".artifacts
FOR ALL
USING (true)
WITH CHECK (true);

