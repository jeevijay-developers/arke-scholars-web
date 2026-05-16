-- Storage bucket for mentor chat image attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mentor-chat-images', 'mentor-chat-images', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload into their own folder (path starts with their auth uid)
DROP POLICY IF EXISTS "mentor chat upload own folder" ON storage.objects;
CREATE POLICY "mentor chat upload own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mentor-chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can read mentor-chat-images they have a row referencing
-- (we keep it simple: any authenticated user may read; URLs are unguessable uuids,
-- and access is gated through mentor_messages SELECT policy in the app).
DROP POLICY IF EXISTS "mentor chat read authenticated" ON storage.objects;
CREATE POLICY "mentor chat read authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mentor-chat-images');

-- Senders can delete their own uploads (soft-delete in app, but allow cleanup)
DROP POLICY IF EXISTS "mentor chat delete own" ON storage.objects;
CREATE POLICY "mentor chat delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'mentor-chat-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Realtime: full row payloads + add to publication
ALTER TABLE public.mentor_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mentor_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_messages';
  END IF;
END $$;