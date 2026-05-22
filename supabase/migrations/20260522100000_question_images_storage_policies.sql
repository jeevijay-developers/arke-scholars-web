-- Ensure bucket exists (idempotent — safe if already created manually)
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow admins/super_admins to upload images
CREATE POLICY "Admins can upload question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND is_admin_or_super(auth.uid())
);

-- Allow everyone to read (questions are shown to all users including students)
CREATE POLICY "Public can read question images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');

-- Allow admins/super_admins to delete (for cleanup/replacement)
CREATE POLICY "Admins can delete question images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND is_admin_or_super(auth.uid())
);
