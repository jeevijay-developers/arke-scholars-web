-- Read receipts for direct mentor_messages
ALTER TABLE public.mentor_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mentor_messages_recipient_unread
  ON public.mentor_messages (recipient_id, read_at)
  WHERE conversation_type = 'direct' AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mentor_messages_group_created
  ON public.mentor_messages (group_id, created_at)
  WHERE conversation_type = 'group';

-- Allow recipient to update read_at on direct messages addressed to them
DROP POLICY IF EXISTS "Recipient marks direct messages as read" ON public.mentor_messages;
CREATE POLICY "Recipient marks direct messages as read"
ON public.mentor_messages
FOR UPDATE
TO authenticated
USING (conversation_type = 'direct' AND recipient_id = auth.uid())
WITH CHECK (conversation_type = 'direct' AND recipient_id = auth.uid());

-- Per-user last-read tracker for group conversations
CREATE TABLE IF NOT EXISTS public.mentor_group_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.mentor_group_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own group reads" ON public.mentor_group_reads;
CREATE POLICY "User manages own group reads"
ON public.mentor_group_reads
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_mentor_group_reads_updated_at ON public.mentor_group_reads;
CREATE TRIGGER update_mentor_group_reads_updated_at
BEFORE UPDATE ON public.mentor_group_reads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();