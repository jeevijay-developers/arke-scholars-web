-- ============ Announcements ============
CREATE TABLE public.mentor_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  title text NOT NULL,
  agenda text,
  meeting_url text,
  meeting_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled',
  recurrence text NOT NULL DEFAULT 'one_off',
  recurrence_interval_days integer,
  recurrence_active boolean NOT NULL DEFAULT true,
  parent_template_id uuid REFERENCES public.mentor_announcements(id) ON DELETE SET NULL,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentor_ann_mentor ON public.mentor_announcements(mentor_id);
CREATE INDEX idx_mentor_ann_meeting_at ON public.mentor_announcements(meeting_at);

CREATE TABLE public.mentor_announcement_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.mentor_announcements(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  response text NOT NULL DEFAULT 'no_response',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, student_id)
);

-- ============ Backup pool + handovers ============
CREATE TABLE public.mentor_backup_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_mentor_id uuid NOT NULL,
  backup_mentor_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (primary_mentor_id, backup_mentor_id),
  CHECK (primary_mentor_id <> backup_mentor_id)
);

CREATE TABLE public.mentor_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_mentor_id uuid NOT NULL,
  backup_mentor_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  ended_early_at timestamptz,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentor_handovers_active ON public.mentor_handovers(primary_mentor_id, backup_mentor_id, started_at, ends_at);

-- ============ Helper functions ============
CREATE OR REPLACE FUNCTION public.is_active_backup_for_student(_mentor uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mentor_handovers h
    JOIN public.mentor_student_assignments a
      ON a.mentor_id = h.primary_mentor_id AND a.student_id = _student AND a.removed_at IS NULL
    WHERE h.backup_mentor_id = _mentor
      AND now() BETWEEN h.started_at AND COALESCE(h.ended_early_at, h.ends_at)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_backup_for_mentor(_backup uuid, _primary uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentor_handovers h
    WHERE h.backup_mentor_id = _backup
      AND h.primary_mentor_id = _primary
      AND now() BETWEEN h.started_at AND COALESCE(h.ended_early_at, h.ends_at)
  );
$$;

-- ============ RLS ============
ALTER TABLE public.mentor_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_announcement_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_backup_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_handovers ENABLE ROW LEVEL SECURITY;

-- announcements
CREATE POLICY "Mentor manages own announcements"
ON public.mentor_announcements FOR ALL TO authenticated
USING (mentor_id = auth.uid() OR is_admin_or_super(auth.uid()))
WITH CHECK (mentor_id = auth.uid() OR is_admin_or_super(auth.uid()));

CREATE POLICY "Assigned students view announcements"
ON public.mentor_announcements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_student_assignments a
    WHERE a.mentor_id = mentor_announcements.mentor_id
      AND a.student_id = auth.uid()
      AND a.removed_at IS NULL
  )
);

CREATE POLICY "Active backup views announcements"
ON public.mentor_announcements FOR SELECT TO authenticated
USING (is_active_backup_for_mentor(auth.uid(), mentor_id));

-- rsvps
CREATE POLICY "Student manages own rsvp"
ON public.mentor_announcement_rsvps FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Mentor reads rsvps for own announcements"
ON public.mentor_announcement_rsvps FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_announcements ma
    WHERE ma.id = mentor_announcement_rsvps.announcement_id
      AND (ma.mentor_id = auth.uid() OR is_active_backup_for_mentor(auth.uid(), ma.mentor_id) OR is_admin_or_super(auth.uid()))
  )
);

-- backup pool
CREATE POLICY "Admins manage backup pool"
ON public.mentor_backup_pool FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Mentors view their pool entries"
ON public.mentor_backup_pool FOR SELECT TO authenticated
USING (primary_mentor_id = auth.uid() OR backup_mentor_id = auth.uid());

-- handovers
CREATE POLICY "Admins manage handovers"
ON public.mentor_handovers FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Involved mentors view handovers"
ON public.mentor_handovers FOR SELECT TO authenticated
USING (primary_mentor_id = auth.uid() OR backup_mentor_id = auth.uid());

-- ============ Extend existing RLS for backup access ============
-- mentor_student_assignments: backup mentor sees primary's assignments during active handover
CREATE POLICY "Active backup views assignments"
ON public.mentor_student_assignments FOR SELECT TO authenticated
USING (is_active_backup_for_mentor(auth.uid(), mentor_id));

-- mentor_messages: backup can read & send direct messages with covered students
CREATE POLICY "Active backup reads direct messages"
ON public.mentor_messages FOR SELECT TO authenticated
USING (
  conversation_type = 'direct'
  AND (
    (sender_id IN (SELECT a.student_id FROM public.mentor_student_assignments a
                   WHERE a.mentor_id IN (SELECT h.primary_mentor_id FROM public.mentor_handovers h
                                         WHERE h.backup_mentor_id = auth.uid()
                                           AND now() BETWEEN h.started_at AND COALESCE(h.ended_early_at, h.ends_at))
                     AND a.removed_at IS NULL)
     AND recipient_id IN (SELECT h.primary_mentor_id FROM public.mentor_handovers h
                          WHERE h.backup_mentor_id = auth.uid()
                            AND now() BETWEEN h.started_at AND COALESCE(h.ended_early_at, h.ends_at)))
    OR
    (recipient_id IN (SELECT a.student_id FROM public.mentor_student_assignments a
                      WHERE a.mentor_id IN (SELECT h.primary_mentor_id FROM public.mentor_handovers h
                                            WHERE h.backup_mentor_id = auth.uid()
                                              AND now() BETWEEN h.started_at AND COALESCE(h.ended_early_at, h.ends_at))
                        AND a.removed_at IS NULL))
  )
);

CREATE POLICY "Active backup sends direct messages"
ON public.mentor_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND conversation_type = 'direct'
  AND recipient_id IS NOT NULL
  AND is_active_backup_for_student(auth.uid(), recipient_id)
);

-- ============ Notification trigger ============
CREATE OR REPLACE FUNCTION public.notify_mentor_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mentor_name text;
BEGIN
  SELECT COALESCE(full_name, 'Your mentor') INTO mentor_name
    FROM public.profiles WHERE user_id = NEW.mentor_id;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT
    a.student_id,
    mentor_name || ' scheduled a meeting',
    NEW.title || ' · ' || to_char(NEW.meeting_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI UTC'),
    'mentor_meeting',
    '/dashboard'
  FROM public.mentor_student_assignments a
  WHERE a.mentor_id = NEW.mentor_id AND a.removed_at IS NULL;

  -- pre-create rsvp rows
  INSERT INTO public.mentor_announcement_rsvps (announcement_id, student_id)
  SELECT NEW.id, a.student_id
  FROM public.mentor_student_assignments a
  WHERE a.mentor_id = NEW.mentor_id AND a.removed_at IS NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_mentor_announcement
AFTER INSERT ON public.mentor_announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_announcement();

CREATE TRIGGER trg_mentor_announcements_updated_at
BEFORE UPDATE ON public.mentor_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();