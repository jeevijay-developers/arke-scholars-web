-- Update notify_course_published trigger to also filter by class_level.
-- Students with class_level set only receive notifications for matching course class.
-- Students with class_level NULL receive notifications for all classes in their target exam.

CREATE OR REPLACE FUNCTION public.notify_course_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM true) THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT
      p.user_id,
      'New course: ' || NEW.name,
      'A new course just launched matching your goal.',
      'course',
      '/courses/' || NEW.slug
    FROM public.profiles p
    WHERE p.target_exam = NEW.target
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role
      )
      AND (p.class_level IS NULL OR p.class_level = NEW.class);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_course_published ON public.courses;
CREATE TRIGGER trg_notify_course_published
  AFTER INSERT OR UPDATE OF is_active ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.notify_course_published();
