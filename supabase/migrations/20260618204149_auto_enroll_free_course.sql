-- When a free course becomes active, auto-enroll all matching students
-- (target_exam + class_level match). Students with no class_level set are
-- enrolled into all matching-exam free courses (graceful fallback).
-- Existing enrollments are left untouched (ON CONFLICT DO NOTHING).

CREATE OR REPLACE FUNCTION public.auto_enroll_free_course()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND NEW.is_course_free = true
    AND (
      TG_OP = 'INSERT'
      OR OLD.is_active IS DISTINCT FROM true
      OR OLD.is_course_free IS DISTINCT FROM true
    )
  THEN
    INSERT INTO public.enrollments (user_id, course_id, is_active)
    SELECT
      p.user_id,
      NEW.id,
      true
    FROM public.profiles p
    WHERE p.target_exam = NEW.target
      AND (p.class_level IS NULL OR p.class_level = NEW.class)
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role
      )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_enroll_free_course ON public.courses;
CREATE TRIGGER trg_auto_enroll_free_course
  AFTER INSERT OR UPDATE OF is_active, is_course_free ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.auto_enroll_free_course();
