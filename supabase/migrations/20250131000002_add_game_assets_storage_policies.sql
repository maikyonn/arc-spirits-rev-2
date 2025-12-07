-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for game_assets" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for game_assets" ON storage.objects;
DROP POLICY IF EXISTS "Public update for game_assets" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for game_assets" ON storage.objects;

-- Create policies for game_assets bucket
-- Public read access
CREATE POLICY "Public read access for game_assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'game_assets');

-- Allow anonymous/authenticated uploads
CREATE POLICY "Public upload for game_assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game_assets');

-- Allow updates
CREATE POLICY "Public update for game_assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'game_assets')
WITH CHECK (bucket_id = 'game_assets');

-- Allow deletes
CREATE POLICY "Public delete for game_assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'game_assets');

