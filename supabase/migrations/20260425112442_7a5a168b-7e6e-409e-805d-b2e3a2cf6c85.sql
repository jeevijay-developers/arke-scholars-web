-- ========== NOTIFICATIONS ==========
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'system',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ========== STUDY SESSIONS ==========
CREATE TABLE public.study_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  minutes_studied INT NOT NULL DEFAULT 0,
  questions_attempted INT NOT NULL DEFAULT 0,
  questions_correct INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own study sessions"
  ON public.study_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tg_study_sessions_updated_at
  BEFORE UPDATE ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== LIVE CLASSES ==========
CREATE TABLE public.live_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  educator_name TEXT NOT NULL,
  educator_avatar TEXT,
  target_exam TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_classes_starts_at ON public.live_classes(starts_at);
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live classes viewable by authenticated"
  ON public.live_classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can manage live classes"
  ON public.live_classes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_live_classes_updated_at
  BEFORE UPDATE ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.live_class_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, class_id)
);
ALTER TABLE public.live_class_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own attendance"
  ON public.live_class_attendance FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff view all attendance"
  ON public.live_class_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ========== EDUCATOR FOLLOWS ==========
CREATE TABLE public.educator_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  educator_name TEXT NOT NULL,
  educator_subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, educator_name)
);
ALTER TABLE public.educator_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own follows"
  ON public.educator_follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== TEST ATTEMPTS ==========
CREATE TABLE public.test_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  test_name TEXT NOT NULL,
  subject TEXT,
  score NUMERIC NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  correct_answers INT NOT NULL DEFAULT 0,
  percentile NUMERIC,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id, attempted_at DESC);
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own test attempts"
  ON public.test_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff view all test attempts"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ========== STREAK RPC ==========
CREATE OR REPLACE FUNCTION public.get_user_streak(_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  streak INT := 0;
  check_date DATE := CURRENT_DATE;
  has_session BOOLEAN;
BEGIN
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.study_sessions
      WHERE user_id = _user_id AND session_date = check_date
    ) INTO has_session;
    IF NOT has_session THEN
      -- Allow today's gap (count from yesterday) only on the first iteration
      IF streak = 0 AND check_date = CURRENT_DATE THEN
        check_date := check_date - 1;
        CONTINUE;
      END IF;
      EXIT;
    END IF;
    streak := streak + 1;
    check_date := check_date - 1;
  END LOOP;
  RETURN streak;
END;
$$;

-- ========== AVATARS BUCKET ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);