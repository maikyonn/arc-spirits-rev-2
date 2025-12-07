-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for rune_backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for rune_backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Public update for rune_backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for rune_backgrounds" ON storage.objects;

-- Create policies for rune_backgrounds bucket
-- Public read access
CREATE POLICY "Public read access for rune_backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'rune_backgrounds');

-- Allow anonymous/authenticated uploads
CREATE POLICY "Public upload for rune_backgrounds"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rune_backgrounds');

-- Allow updates
CREATE POLICY "Public update for rune_backgrounds"
ON storage.objects FOR UPDATE
USING (bucket_id = 'rune_backgrounds')
WITH CHECK (bucket_id = 'rune_backgrounds');

-- Allow deletes
CREATE POLICY "Public delete for rune_backgrounds"
ON storage.objects FOR DELETE
USING (bucket_id = 'rune_backgrounds');

