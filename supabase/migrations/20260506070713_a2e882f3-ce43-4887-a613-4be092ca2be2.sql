CREATE OR REPLACE FUNCTION public.is_mentor_of_group(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mentor_groups g WHERE g.id = _group_id AND g.mentor_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_group(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mentor_group_members m WHERE m.group_id = _group_id AND m.student_id = _user_id)
$$;

DROP POLICY IF EXISTS "Members view their group" ON public.mentor_groups;
CREATE POLICY "Members view their group" ON public.mentor_groups
  FOR SELECT TO authenticated
  USING (public.is_member_of_group(id, auth.uid()));

DROP POLICY IF EXISTS "Mentor views own group members" ON public.mentor_group_members;
CREATE POLICY "Mentor views own group members" ON public.mentor_group_members
  FOR SELECT TO authenticated
  USING (public.is_mentor_of_group(group_id, auth.uid()));