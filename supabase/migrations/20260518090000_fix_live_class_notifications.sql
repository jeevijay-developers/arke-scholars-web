-- Notify students for course-specific live classes based on enrollments.
CREATE OR REPLACE FUNCTION public.notify_live_class_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'scheduled' THEN
    IF NEW.course_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      SELECT
        e.user_id,
        'New live class: ' || NEW.title,
        COALESCE(NEW.educator_name, 'An educator') || ' scheduled a ' || NEW.subject || ' class for ' ||
          to_char(NEW.starts_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI UTC'),
        'live_class',
        '/my-live-classes'
      FROM public.enrollments e
      WHERE e.course_id = NEW.course_id
        AND e.is_active = true;
    ELSIF NEW.target_exam IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, link)
      SELECT
        p.user_id,
        'New live class: ' || NEW.title,
        COALESCE(NEW.educator_name, 'An educator') || ' scheduled a ' || NEW.subject || ' class for ' ||
          to_char(NEW.starts_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI UTC'),
        'live_class',
        '/my-live-classes'
      FROM public.profiles p
      WHERE p.target_exam = NEW.target_exam
        AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
