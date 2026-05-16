-- Add attachment metadata to mentor messages
ALTER TABLE public.mentor_messages
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_mime text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

-- Create a new combined bucket for any chat attachment (kept private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-chat-files', 'mentor-chat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for the new bucket
DROP POLICY IF EXISTS "mentor chat files read authenticated" ON storage.objects;
CREATE POLICY "mentor chat files read authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mentor-chat-files');

DROP POLICY IF EXISTS "mentor chat files upload own folder" ON storage.objects;
CREATE POLICY "mentor chat files upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mentor-chat-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "mentor chat files delete own" ON storage.objects;
CREATE POLICY "mentor chat files delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mentor-chat-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);