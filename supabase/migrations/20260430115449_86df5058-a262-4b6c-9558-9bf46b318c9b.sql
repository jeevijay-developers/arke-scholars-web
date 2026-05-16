-- Realtime reliability for doubts
ALTER TABLE public.doubts REPLICA IDENTITY FULL;
ALTER TABLE public.doubt_answers REPLICA IDENTITY FULL;

-- Helper: pick a teacher with the fewest open doubts
CREATE OR REPLACE FUNCTION public.pick_teacher_for_doubt()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  LEFT JOIN public.doubts d
    ON d.assigned_teacher_id = ur.user_id AND d.status <> 'answered'
  WHERE ur.role = 'teacher'
  GROUP BY ur.user_id
  ORDER BY COUNT(d.id) ASC, random()
  LIMIT 1;
$$;

-- Auto-assign on insert
CREATE OR REPLACE FUNCTION public.assign_doubt_to_teacher()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_teacher_id IS NULL THEN
    NEW.assigned_teacher_id := public.pick_teacher_for_doubt();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS doubts_assign_teacher ON public.doubts;
CREATE TRIGGER doubts_assign_teacher
BEFORE INSERT ON public.doubts
FOR EACH ROW EXECUTE FUNCTION public.assign_doubt_to_teacher();

-- Backfill existing unassigned doubts
UPDATE public.doubts SET assigned_teacher_id = public.pick_teacher_for_doubt()
WHERE assigned_teacher_id IS NULL;

-- Replace teacher SELECT/UPDATE policies on doubts
DROP POLICY IF EXISTS "Teachers and staff view all doubts" ON public.doubts;
DROP POLICY IF EXISTS "Teachers and staff update doubts" ON public.doubts;

CREATE POLICY "Assigned teacher views own doubts" ON public.doubts
FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(),'teacher'::app_role) AND assigned_teacher_id = auth.uid())
  OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Assigned teacher updates own doubts" ON public.doubts
FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(),'teacher'::app_role) AND assigned_teacher_id = auth.uid())
  OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  (has_role(auth.uid(),'teacher'::app_role) AND assigned_teacher_id = auth.uid())
  OR has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)
);

-- doubt_answers: teachers can answer only assigned doubts
DROP POLICY IF EXISTS "Teachers staff and AI insert answers" ON public.doubt_answers;
CREATE POLICY "Teachers answer only assigned doubts" ON public.doubt_answers
FOR INSERT TO authenticated
WITH CHECK (
  responder_id = auth.uid() AND (
    has_role(auth.uid(),'staff'::app_role) OR has_role(auth.uid(),'admin'::app_role)
    OR (has_role(auth.uid(),'teacher'::app_role) AND EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = doubt_id AND d.assigned_teacher_id = auth.uid()
    ))
  )
);