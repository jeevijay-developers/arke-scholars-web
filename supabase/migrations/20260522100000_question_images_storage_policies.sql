-- Ensure bucket exists (idempotent — safe if already created manually)
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can upload question images'
  ) THEN
    CREATE POLICY "Admins can upload question images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'question-images'
      AND is_admin_or_super(auth.uid())
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public can read question images'
  ) THEN
    CREATE POLICY "Public can read question images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'question-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can delete question images'
  ) THEN
    CREATE POLICY "Admins can delete question images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'question-images'
      AND is_admin_or_super(auth.uid())
    );
  END IF;
END $$;
