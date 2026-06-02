-- When a mentor sends a message to a group, automatically fan it out as a
-- direct message to every student currently assigned to that mentor.
-- Students never see the group chat; they receive group messages in their
-- personal DM thread with the mentor.

CREATE OR REPLACE FUNCTION public.broadcast_group_message_to_students()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act on group messages
  IF NEW.conversation_type <> 'group' OR NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mentor_messages (
    conversation_type,
    group_id,
    sender_id,
    recipient_id,
    content,
    image_url,
    file_url,
    file_path,
    file_name,
    file_mime,
    file_size_bytes
  )
  SELECT
    'direct',
    NULL,
    NEW.sender_id,
    msa.student_id,
    NEW.content,
    NEW.image_url,
    NEW.file_url,
    NEW.file_path,
    NEW.file_name,
    NEW.file_mime,
    NEW.file_size_bytes
  FROM public.mentor_groups mg
  JOIN public.mentor_student_assignments msa
    ON msa.mentor_id = mg.mentor_id
    AND msa.removed_at IS NULL
  WHERE mg.id = NEW.group_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_group_message_to_students ON public.mentor_messages;
CREATE TRIGGER trg_broadcast_group_message_to_students
  AFTER INSERT ON public.mentor_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_group_message_to_students();
