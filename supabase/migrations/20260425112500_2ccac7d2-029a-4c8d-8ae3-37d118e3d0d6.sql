-- Drop overly broad public listing on avatars; replace with owner-scoped listing
DROP POLICY IF EXISTS "Avatar images publicly readable" ON storage.objects;

CREATE POLICY "Users can list own avatar files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can read avatar files"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'avatars');