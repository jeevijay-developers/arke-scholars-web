CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'super_admin'::app_role)
  )
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS doubt_preference text NOT NULL DEFAULT 'teacher'
    CHECK (doubt_preference IN ('ai', 'teacher'));

ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS routed_to text NOT NULL DEFAULT 'teacher'
    CHECK (routed_to IN ('ai', 'teacher')),
  ADD COLUMN IF NOT EXISTS ai_escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_type text
    CHECK (resolution_type IN ('ai', 'teacher', 'ai_then_teacher'));

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid;
ALTER TABLE public.live_classes ADD COLUMN IF NOT EXISTS scheduled_by uuid;

CREATE TABLE IF NOT EXISTS public.mentor_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors view own group" ON public.mentor_groups FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());
CREATE POLICY "Admins manage all mentor groups" ON public.mentor_groups FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER update_mentor_groups_updated_at
  BEFORE UPDATE ON public.mentor_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.mentor_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.mentor_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, student_id)
);
ALTER TABLE public.mentor_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student views own membership" ON public.mentor_group_members FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Mentor views own group members" ON public.mentor_group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mentor_groups g WHERE g.id = mentor_group_members.group_id AND g.mentor_id = auth.uid()));
CREATE POLICY "Admins manage memberships" ON public.mentor_group_members FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Members view their group" ON public.mentor_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mentor_group_members m WHERE m.group_id = mentor_groups.id AND m.student_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.mentor_student_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE(mentor_id, student_id)
);
ALTER TABLE public.mentor_student_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentor views own assignments" ON public.mentor_student_assignments FOR SELECT TO authenticated
  USING (mentor_id = auth.uid());
CREATE POLICY "Student views own assignment" ON public.mentor_student_assignments FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Admins manage all assignments" ON public.mentor_student_assignments FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type text NOT NULL CHECK (conversation_type IN ('direct', 'group')),
  group_id uuid REFERENCES public.mentor_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  content text,
  image_url text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_target CHECK (
    (conversation_type = 'direct' AND recipient_id IS NOT NULL AND group_id IS NULL) OR
    (conversation_type = 'group'  AND group_id IS NOT NULL AND recipient_id IS NULL)
  ),
  CONSTRAINT has_payload CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_group_created
  ON public.mentor_messages (group_id, created_at DESC) WHERE conversation_type = 'group';
CREATE INDEX IF NOT EXISTS idx_mentor_messages_direct_pair
  ON public.mentor_messages (sender_id, recipient_id, created_at DESC) WHERE conversation_type = 'direct';

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_messages REPLICA IDENTITY FULL;

CREATE POLICY "Read accessible messages" ON public.mentor_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR (conversation_type = 'direct' AND recipient_id = auth.uid())
    OR (conversation_type = 'group' AND EXISTS (
      SELECT 1 FROM public.mentor_group_members mgm
      WHERE mgm.group_id = mentor_messages.group_id
        AND mgm.student_id = auth.uid()
        AND mentor_messages.created_at >= mgm.joined_at
    ))
    OR (conversation_type = 'group' AND EXISTS (
      SELECT 1 FROM public.mentor_groups g
      WHERE g.id = mentor_messages.group_id AND g.mentor_id = auth.uid()
    ))
    OR public.is_admin_or_super(auth.uid())
  );

CREATE POLICY "Send accessible messages" ON public.mentor_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (conversation_type = 'direct' AND public.has_role(auth.uid(), 'mentor'::app_role) AND EXISTS (
        SELECT 1 FROM public.mentor_student_assignments a
        WHERE a.mentor_id = auth.uid() AND a.student_id = mentor_messages.recipient_id AND a.removed_at IS NULL
      ))
      OR (conversation_type = 'direct' AND EXISTS (
        SELECT 1 FROM public.mentor_student_assignments a
        WHERE a.student_id = auth.uid() AND a.mentor_id = mentor_messages.recipient_id AND a.removed_at IS NULL
      ))
      OR (conversation_type = 'group' AND EXISTS (
        SELECT 1 FROM public.mentor_groups g
        WHERE g.id = mentor_messages.group_id AND g.mentor_id = auth.uid()
      ))
      OR (conversation_type = 'group' AND EXISTS (
        SELECT 1 FROM public.mentor_group_members m
        WHERE m.group_id = mentor_messages.group_id AND m.student_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Sender can soft-delete own messages" ON public.mentor_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_messages;

CREATE OR REPLACE FUNCTION public.ensure_mentor_group_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE grp_id uuid; mentor_name text;
BEGIN
  IF NEW.removed_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT id INTO grp_id FROM public.mentor_groups WHERE mentor_id = NEW.mentor_id;
  IF grp_id IS NULL THEN
    SELECT COALESCE(full_name, 'Mentor') INTO mentor_name FROM public.profiles WHERE user_id = NEW.mentor_id;
    INSERT INTO public.mentor_groups (mentor_id, name) VALUES (NEW.mentor_id, COALESCE(mentor_name, 'Mentor') || ' Group') RETURNING id INTO grp_id;
  END IF;
  INSERT INTO public.mentor_group_members (group_id, student_id) VALUES (grp_id, NEW.student_id) ON CONFLICT (group_id, student_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_creates_group
  AFTER INSERT ON public.mentor_student_assignments
  FOR EACH ROW EXECUTE FUNCTION public.ensure_mentor_group_membership();

CREATE OR REPLACE FUNCTION public.remove_mentor_group_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
    DELETE FROM public.mentor_group_members m USING public.mentor_groups g
      WHERE g.mentor_id = NEW.mentor_id AND m.group_id = g.id AND m.student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_removes_membership
  AFTER UPDATE ON public.mentor_student_assignments
  FOR EACH ROW EXECUTE FUNCTION public.remove_mentor_group_membership();