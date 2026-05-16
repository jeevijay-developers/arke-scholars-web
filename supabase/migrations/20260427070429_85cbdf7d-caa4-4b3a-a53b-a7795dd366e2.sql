
-- =============================
-- TESTS ENGINE
-- =============================

CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  test_type text NOT NULL DEFAULT 'mock',
  exam_pattern text NOT NULL DEFAULT 'jee-main',
  subjects text[] DEFAULT '{}',
  duration_minutes int NOT NULL DEFAULT 180,
  correct_marks numeric NOT NULL DEFAULT 4,
  wrong_marks numeric NOT NULL DEFAULT -1,
  total_questions int NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public',
  course_id uuid,
  is_published boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tests_published ON public.tests(is_published, test_type);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view published tests"
ON public.tests FOR SELECT TO authenticated
USING (is_published = true OR created_by = auth.uid() OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Creators manage own tests"
ON public.tests FOR ALL TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Staff manage all tests"
ON public.tests FOR ALL TO authenticated
USING (has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_tests_updated_at BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  subject text,
  topic text,
  question_text text NOT NULL,
  question_image_url text,
  question_type text NOT NULL DEFAULT 'mcq-single',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb NOT NULL,
  explanation text,
  difficulty text DEFAULT 'medium',
  marks_correct numeric DEFAULT 4,
  marks_wrong numeric DEFAULT -1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_questions_test ON public.test_questions(test_id, position);

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View questions of accessible tests"
ON public.test_questions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_questions.test_id
    AND (t.is_published = true OR t.created_by = auth.uid()
         OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)))
);

CREATE POLICY "Creators manage own test questions"
ON public.test_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_questions.test_id AND t.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_questions.test_id AND t.created_by = auth.uid()));

CREATE POLICY "Staff manage all test questions"
ON public.test_questions FOR ALL TO authenticated
USING (has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- Extend test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS test_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_spent_seconds int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS question_statuses jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_test_attempts_test ON public.test_attempts(test_id, status);

-- Server-side scoring + percentile RPC
CREATE OR REPLACE FUNCTION public.submit_test_attempt(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt RECORD;
  q RECORD;
  user_ans jsonb;
  selected jsonb;
  is_correct boolean;
  total_score numeric := 0;
  correct_count int := 0;
  total_count int := 0;
  attempted_count int := 0;
  subject_data jsonb := '{}'::jsonb;
  subj_key text;
  pct numeric;
  lower_count int;
  total_attempts int;
BEGIN
  SELECT * INTO attempt FROM public.test_attempts WHERE id = _attempt_id;
  IF attempt.user_id <> auth.uid() AND NOT (has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR q IN SELECT * FROM public.test_questions WHERE test_id = attempt.test_id ORDER BY position LOOP
    total_count := total_count + 1;
    user_ans := COALESCE(attempt.answers -> q.id::text, NULL);
    selected := user_ans -> 'selected';
    is_correct := false;

    IF selected IS NOT NULL AND selected <> 'null'::jsonb THEN
      attempted_count := attempted_count + 1;
      -- Compare correct_answer to selected (works for index, indices array, numeric)
      IF q.correct_answer = selected THEN
        is_correct := true;
        total_score := total_score + COALESCE(q.marks_correct, 4);
        correct_count := correct_count + 1;
      ELSE
        total_score := total_score + COALESCE(q.marks_wrong, -1);
      END IF;
    END IF;

    -- Subject-wise breakdown
    subj_key := COALESCE(q.subject, 'General');
    subject_data := jsonb_set(
      subject_data,
      ARRAY[subj_key],
      COALESCE(subject_data -> subj_key, '{"total":0,"correct":0,"attempted":0,"score":0}'::jsonb)
        || jsonb_build_object(
          'total', COALESCE((subject_data -> subj_key ->> 'total')::int, 0) + 1,
          'correct', COALESCE((subject_data -> subj_key ->> 'correct')::int, 0) + (CASE WHEN is_correct THEN 1 ELSE 0 END),
          'attempted', COALESCE((subject_data -> subj_key ->> 'attempted')::int, 0) + (CASE WHEN selected IS NOT NULL AND selected <> 'null'::jsonb THEN 1 ELSE 0 END),
          'score', COALESCE((subject_data -> subj_key ->> 'score')::numeric, 0)
                   + (CASE WHEN is_correct THEN COALESCE(q.marks_correct, 4)
                           WHEN selected IS NOT NULL AND selected <> 'null'::jsonb THEN COALESCE(q.marks_wrong, -1)
                           ELSE 0 END)
        ),
      true
    );
  END LOOP;

  -- Percentile: % of OTHER attempts with strictly lower score
  SELECT COUNT(*) INTO total_attempts FROM public.test_attempts
    WHERE test_id = attempt.test_id AND status IN ('submitted','auto_submitted') AND id <> _attempt_id;
  SELECT COUNT(*) INTO lower_count FROM public.test_attempts
    WHERE test_id = attempt.test_id AND status IN ('submitted','auto_submitted')
    AND id <> _attempt_id AND score < total_score;
  pct := CASE WHEN total_attempts = 0 THEN 100 ELSE ROUND(lower_count::numeric * 100.0 / total_attempts, 1) END;

  UPDATE public.test_attempts
  SET score = total_score,
      correct_answers = correct_count,
      total_questions = total_count,
      percentile = pct,
      status = 'submitted',
      submitted_at = now()
  WHERE id = _attempt_id;

  RETURN jsonb_build_object(
    'score', total_score,
    'correct', correct_count,
    'total', total_count,
    'attempted', attempted_count,
    'percentile', pct,
    'subjects', subject_data
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_test_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid) TO authenticated;

-- =============================
-- LIVE CLASSES
-- =============================

ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS course_id uuid,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS max_participants int,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE TABLE IF NOT EXISTS public.live_class_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  is_teacher boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_messages_class ON public.live_class_messages(class_id, created_at);

ALTER TABLE public.live_class_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read class messages"
ON public.live_class_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users send own messages"
ON public.live_class_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_classes;

-- Teachers manage own live classes
CREATE POLICY "Teachers manage own live classes"
ON public.live_classes FOR ALL TO authenticated
USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- =============================
-- DOUBTS
-- =============================

CREATE TABLE IF NOT EXISTS public.doubts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  topic text,
  question_text text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'pending',
  ai_answer text,
  assigned_teacher_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doubts_user ON public.doubts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doubts_status ON public.doubts(status);

ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own doubts"
ON public.doubts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers and staff view all doubts"
ON public.doubts FOR SELECT TO authenticated
USING (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Teachers and staff update doubts"
ON public.doubts FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_doubts_updated_at BEFORE UPDATE ON public.doubts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.doubt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL,
  responder_role text NOT NULL,
  answer_text text NOT NULL,
  image_url text,
  helpful_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doubt_answers_doubt ON public.doubt_answers(doubt_id, created_at);

ALTER TABLE public.doubt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doubt owner views answers"
ON public.doubt_answers FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.doubts d WHERE d.id = doubt_answers.doubt_id AND d.user_id = auth.uid())
  OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Teachers staff and AI insert answers"
ON public.doubt_answers FOR INSERT TO authenticated
WITH CHECK (
  responder_id = auth.uid() AND
  (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role))
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.doubts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubt_answers;

-- Trigger: notify student when teacher answers their doubt
CREATE OR REPLACE FUNCTION public.notify_doubt_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doubt_owner uuid;
  doubt_subject text;
BEGIN
  SELECT user_id, subject INTO doubt_owner, doubt_subject FROM public.doubts WHERE id = NEW.doubt_id;
  IF doubt_owner IS NOT NULL AND doubt_owner <> NEW.responder_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      doubt_owner,
      'Your doubt was answered',
      'A new ' || NEW.responder_role || ' answer is ready for your ' || doubt_subject || ' doubt.',
      'doubt',
      '/doubts'
    );
    UPDATE public.doubts SET status = 'answered', updated_at = now() WHERE id = NEW.doubt_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doubt_answer_notify ON public.doubt_answers;
CREATE TRIGGER doubt_answer_notify
AFTER INSERT ON public.doubt_answers
FOR EACH ROW EXECUTE FUNCTION public.notify_doubt_answer();
