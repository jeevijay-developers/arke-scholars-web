
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_mentor_message BOOLEAN NOT NULL DEFAULT true,
  email_doubt_answered BOOLEAN NOT NULL DEFAULT true,
  email_live_class_reminder BOOLEAN NOT NULL DEFAULT true,
  email_payment_receipt BOOLEAN NOT NULL DEFAULT true,
  email_system BOOLEAN NOT NULL DEFAULT true,
  inapp_mentor_message BOOLEAN NOT NULL DEFAULT true,
  inapp_doubt_answered BOOLEAN NOT NULL DEFAULT true,
  inapp_live_class_reminder BOOLEAN NOT NULL DEFAULT true,
  inapp_payment_receipt BOOLEAN NOT NULL DEFAULT true,
  inapp_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification preferences"
ON public.notification_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notification preferences"
ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notification preferences"
ON public.notification_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all notification preferences"
ON public.notification_preferences FOR SELECT TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedule live class reminders: send 15 minutes before start.
-- We add a scheduling helper RPC the cron-driven sender can call.
CREATE OR REPLACE FUNCTION public.upcoming_live_class_reminders(_lookahead_minutes INT DEFAULT 20)
RETURNS TABLE (
  class_id UUID,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  class_title TEXT,
  educator_name TEXT,
  subject TEXT,
  starts_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    lc.id,
    a.user_id,
    au.email::text,
    p.full_name,
    lc.title,
    lc.educator_name,
    lc.subject,
    lc.starts_at
  FROM public.live_classes lc
  JOIN public.live_class_attendance a ON a.class_id = lc.id
  JOIN auth.users au ON au.id = a.user_id
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE lc.status = 'scheduled'
    AND lc.starts_at BETWEEN now() AND now() + make_interval(mins => _lookahead_minutes)
    AND au.email IS NOT NULL;
$$;
