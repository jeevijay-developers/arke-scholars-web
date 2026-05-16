ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notifications_user_archived ON public.notifications(user_id, archived_at);