CREATE OR REPLACE FUNCTION public.sync_enrollment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_course uuid;
  v_count int;
  v_total int;
BEGIN
  v_user := COALESCE(NEW.user_id, OLD.user_id);
  v_course := COALESCE(NEW.course_id, OLD.course_id);

  SELECT COUNT(*) INTO v_count
  FROM public.lesson_progress
  WHERE user_id = v_user AND course_id = v_course AND is_completed = true;

  SELECT total_lessons INTO v_total FROM public.courses WHERE id = v_course;

  UPDATE public.enrollments
  SET completed_lessons = v_count,
      progress_percent = LEAST(100, CASE WHEN COALESCE(v_total,0) = 0 THEN 0 ELSE ROUND(v_count::numeric / v_total * 100) END)
  WHERE user_id = v_user AND course_id = v_course;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_progress ON public.lesson_progress;
CREATE TRIGGER trg_sync_enrollment_progress
AFTER INSERT OR UPDATE OR DELETE ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_enrollment_progress();