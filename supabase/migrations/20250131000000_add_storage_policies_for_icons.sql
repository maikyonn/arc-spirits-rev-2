-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for class_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for class_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public update for class_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for class_icons" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for origin_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for origin_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public update for origin_icons" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for origin_icons" ON storage.objects;

-- Create policies for class_icons bucket
-- Public read access
CREATE POLICY "Public read access for class_icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'class_icons');

-- Allow anonymous/authenticated uploads
CREATE POLICY "Public upload for class_icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'class_icons');

-- Allow updates
CREATE POLICY "Public update for class_icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'class_icons')
WITH CHECK (bucket_id = 'class_icons');

-- Allow deletes
CREATE POLICY "Public delete for class_icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'class_icons');

-- Create policies for origin_icons bucket
-- Public read access
CREATE POLICY "Public read access for origin_icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'origin_icons');

-- Allow anonymous/authenticated uploads
CREATE POLICY "Public upload for origin_icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'origin_icons');

-- Allow updates
CREATE POLICY "Public update for origin_icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'origin_icons')
WITH CHECK (bucket_id = 'origin_icons');

-- Allow deletes
CREATE POLICY "Public delete for origin_icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'origin_icons');

