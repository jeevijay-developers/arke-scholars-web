-- Fix sync_enrollment_progress to only count lessons that actually exist in the course.
-- This prevents completed count or progress percentage exceeding 100% when lessons are deleted or renamed.

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

  -- Join with public.lessons to only count active course lessons
  SELECT COUNT(*) INTO v_count
  FROM public.lesson_progress lp
  JOIN public.lessons l ON l.course_id = lp.course_id AND l.slug = lp.lesson_slug
  WHERE lp.user_id = v_user AND lp.course_id = v_course AND lp.is_completed = true;

  SELECT total_lessons INTO v_total FROM public.courses WHERE id = v_course;

  UPDATE public.enrollments
  SET completed_lessons = v_count,
      progress_percent = LEAST(100, CASE WHEN COALESCE(v_total,0) = 0 THEN 0 ELSE ROUND(v_count::numeric / v_total * 100) END)
  WHERE user_id = v_user AND course_id = v_course;

  RETURN NULL;
END;
$$;
