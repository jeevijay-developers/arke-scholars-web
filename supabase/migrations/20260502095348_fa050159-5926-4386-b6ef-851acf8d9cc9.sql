
-- Helper: notify all admins/super_admins
CREATE OR REPLACE FUNCTION public.notify_admins(_title text, _body text, _type text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT ur.user_id, _title, _body, _type, _link
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role);
END;
$$;

-- =============================================================
-- Course published → notify matching students
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_course_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR (OLD.is_published IS DISTINCT FROM true)) THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT
      p.user_id,
      'New course: ' || NEW.name,
      COALESCE(NEW.educator_name, 'A new course') || ' just launched a course matching your goal.',
      'course',
      '/courses/' || NEW.slug
    FROM public.profiles p
    WHERE NEW.target_exam IS NOT NULL
      AND p.target_exam = NEW.target_exam
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_course_published ON public.courses;
CREATE TRIGGER trg_notify_course_published
  AFTER INSERT OR UPDATE OF is_published ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.notify_course_published();

-- =============================================================
-- Live class scheduled → notify matching students
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_live_class_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'scheduled' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT
      p.user_id,
      'New live class: ' || NEW.title,
      COALESCE(NEW.educator_name, 'An educator') || ' scheduled a ' || NEW.subject || ' class for ' ||
        to_char(NEW.starts_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI UTC'),
      'live_class',
      '/my-live-classes'
    FROM public.profiles p
    WHERE NEW.target_exam IS NOT NULL
      AND p.target_exam = NEW.target_exam
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_live_class_scheduled ON public.live_classes;
CREATE TRIGGER trg_notify_live_class_scheduled
  AFTER INSERT ON public.live_classes
  FOR EACH ROW EXECUTE FUNCTION public.notify_live_class_scheduled();

-- =============================================================
-- Test published → notify students of matching exam pattern
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_test_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR (OLD.is_published IS DISTINCT FROM true)) THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    SELECT
      p.user_id,
      'New test available: ' || NEW.title,
      'A new ' || COALESCE(NEW.exam_pattern, 'practice') || ' test is ready. ' ||
        COALESCE(NEW.total_questions::text || ' questions, ', '') ||
        COALESCE(NEW.duration_minutes::text || ' min.', ''),
      'test',
      '/my-tests'
    FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'student'::app_role)
      AND (
        NEW.exam_pattern IS NULL
        OR p.target_exam IS NULL
        OR lower(replace(p.target_exam, ' ', '-')) LIKE '%' || lower(NEW.exam_pattern) || '%'
        OR lower(NEW.exam_pattern) = 'custom'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_test_published ON public.tests;
CREATE TRIGGER trg_notify_test_published
  AFTER INSERT OR UPDATE OF is_published ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.notify_test_published();

-- =============================================================
-- Doubt assigned to teacher → notify the teacher
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_doubt_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_teacher_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_teacher_id IS DISTINCT FROM NEW.assigned_teacher_id) THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.assigned_teacher_id,
      'New doubt assigned',
      'A new ' || NEW.subject || ' doubt was routed to you.',
      'doubt',
      '/teacher/doubts'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_doubt_assigned ON public.doubts;
CREATE TRIGGER trg_notify_doubt_assigned
  AFTER INSERT OR UPDATE OF assigned_teacher_id ON public.doubts
  FOR EACH ROW EXECUTE FUNCTION public.notify_doubt_assigned();

-- =============================================================
-- Report filed → notify reported teacher + all admins
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_report_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notify reported user (if known and not the reporter)
  IF NEW.reported_user_id IS NOT NULL AND NEW.reported_user_id <> NEW.reporter_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.reported_user_id,
      'A report was filed',
      'A student reported you under category "' || NEW.category || '". Our team is reviewing.',
      'report',
      '/notifications'
    );
  END IF;

  -- Notify admins
  PERFORM public.notify_admins(
    'New moderation report',
    NEW.reported_name || ' (' || NEW.reported_role || ') was reported: ' || NEW.subject,
    'report',
    '/admin/moderation'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_report_created ON public.reports;
CREATE TRIGGER trg_notify_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_created();

-- =============================================================
-- Educator application submitted → notify admins
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_educator_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'New educator application',
    NEW.candidate_name || ' applied to teach ' || NEW.subject || '.',
    'educator_application',
    '/admin/educator-applications'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_educator_application ON public.educator_applications;
CREATE TRIGGER trg_notify_educator_application
  AFTER INSERT ON public.educator_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_educator_application();

-- =============================================================
-- Enquiry submitted → notify admins
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_enquiry_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_admins(
    'New enquiry from ' || NEW.name,
    'Source: ' || NEW.source || COALESCE(' · ' || NEW.region, '') || ' — ' ||
      left(COALESCE(NEW.message, ''), 140),
    'enquiry',
    '/admin/enquiries'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_enquiry_submitted ON public.enquiries;
CREATE TRIGGER trg_notify_enquiry_submitted
  AFTER INSERT ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_enquiry_submitted();

-- =============================================================
-- Mentor-student assignment → notify both
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_mentor_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentor_name text;
  student_name text;
BEGIN
  IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, 'A mentor') INTO mentor_name FROM public.profiles WHERE user_id = NEW.mentor_id;
  SELECT COALESCE(full_name, 'a new student') INTO student_name FROM public.profiles WHERE user_id = NEW.student_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    NEW.mentor_id,
    'New student assigned',
    student_name || ' is now part of your mentorship group.',
    'mentor',
    '/mentor/students'
  );

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    NEW.student_id,
    'You have a mentor!',
    mentor_name || ' has been assigned as your mentor. Say hello in your chat.',
    'mentor',
    '/mentor-chat'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mentor_assignment ON public.mentor_student_assignments;
CREATE TRIGGER trg_notify_mentor_assignment
  AFTER INSERT ON public.mentor_student_assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_assignment();

-- =============================================================
-- Mentor direct message → notify recipient
-- =============================================================
CREATE OR REPLACE FUNCTION public.notify_mentor_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  is_recipient_mentor boolean;
  link_path text;
BEGIN
  IF NEW.conversation_type <> 'direct' OR NEW.recipient_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, 'Someone') INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.recipient_id AND role = 'mentor'::app_role
  ) INTO is_recipient_mentor;

  link_path := CASE WHEN is_recipient_mentor THEN '/mentor/chats' ELSE '/mentor-chat' END;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    NEW.recipient_id,
    'New message from ' || sender_name,
    left(COALESCE(NEW.content, '[attachment]'), 140),
    'mentor_message',
    link_path
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mentor_direct_message ON public.mentor_messages;
CREATE TRIGGER trg_notify_mentor_direct_message
  AFTER INSERT ON public.mentor_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_direct_message();
