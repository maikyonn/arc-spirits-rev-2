-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for artifact-cards" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for artifact-cards" ON storage.objects;
DROP POLICY IF EXISTS "Public update for artifact-cards" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for artifact-cards" ON storage.objects;

-- Create policies for artifact-cards bucket
-- Public read access
CREATE POLICY "Public read access for artifact-cards"
ON storage.objects FOR SELECT
USING (bucket_id = 'artifact-cards');

-- Allow anonymous/authenticated uploads
CREATE POLICY "Public upload for artifact-cards"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'artifact-cards');

-- Allow updates
CREATE POLICY "Public update for artifact-cards"
ON storage.objects FOR UPDATE
USING (bucket_id = 'artifact-cards')
WITH CHECK (bucket_id = 'artifact-cards');

-- Allow deletes
CREATE POLICY "Public delete for artifact-cards"
ON storage.objects FOR DELETE
USING (bucket_id = 'artifact-cards');

