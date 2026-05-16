CREATE POLICY "Teachers can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'teacher'::public.app_role));