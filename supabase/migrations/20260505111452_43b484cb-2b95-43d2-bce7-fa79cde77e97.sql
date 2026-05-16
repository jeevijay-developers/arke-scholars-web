CREATE OR REPLACE FUNCTION public.submit_test_attempt(_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF attempt IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF attempt.user_id <> auth.uid()
     AND NOT (has_role(auth.uid(),'admin'::app_role)
              OR has_role(auth.uid(),'super_admin'::app_role)
              OR has_role(auth.uid(),'teacher'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR q IN SELECT * FROM public.test_questions WHERE test_id = attempt.test_id ORDER BY position LOOP
    total_count := total_count + 1;
    user_ans := COALESCE(attempt.answers -> q.id::text, NULL);
    selected := user_ans -> 'selected';
    is_correct := false;

    IF selected IS NOT NULL AND selected <> 'null'::jsonb THEN
      attempted_count := attempted_count + 1;
      IF q.correct_answer = selected THEN
        is_correct := true;
        total_score := total_score + COALESCE(q.marks_correct, 4);
        correct_count := correct_count + 1;
      ELSE
        total_score := total_score + COALESCE(q.marks_wrong, -1);
      END IF;
    END IF;

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
      submitted_at = COALESCE(submitted_at, now())
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
$function$;

-- Backfill: re-run scoring for any submitted attempts that may have been left at score 0 due to the previous error
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.test_attempts
           WHERE status IN ('submitted','auto_submitted')
             AND (score IS NULL OR score = 0)
             AND answers IS NOT NULL
             AND answers <> '{}'::jsonb
  LOOP
    BEGIN
      UPDATE public.test_attempts
      SET score = sub.total_score,
          correct_answers = sub.correct_count,
          total_questions = sub.total_count
      FROM (
        SELECT
          SUM(CASE WHEN tq.correct_answer = (ta.answers -> tq.id::text -> 'selected')
                   THEN COALESCE(tq.marks_correct, 4)
                   WHEN (ta.answers -> tq.id::text -> 'selected') IS NOT NULL
                        AND (ta.answers -> tq.id::text -> 'selected') <> 'null'::jsonb
                   THEN COALESCE(tq.marks_wrong, -1)
                   ELSE 0 END) AS total_score,
          SUM(CASE WHEN tq.correct_answer = (ta.answers -> tq.id::text -> 'selected') THEN 1 ELSE 0 END)::int AS correct_count,
          COUNT(*)::int AS total_count
        FROM public.test_attempts ta
        JOIN public.test_questions tq ON tq.test_id = ta.test_id
        WHERE ta.id = r.id
      ) sub
      WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;