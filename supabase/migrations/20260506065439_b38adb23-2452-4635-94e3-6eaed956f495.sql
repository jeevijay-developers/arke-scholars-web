CREATE POLICY "Mentors can view assigned student profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_student_assignments msa
    WHERE msa.mentor_id = auth.uid()
      AND msa.student_id = profiles.user_id
      AND msa.removed_at IS NULL
  )
);

CREATE POLICY "Students can view their assigned mentor profile"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_student_assignments msa
    WHERE msa.student_id = auth.uid()
      AND msa.mentor_id = profiles.user_id
      AND msa.removed_at IS NULL
  )
);