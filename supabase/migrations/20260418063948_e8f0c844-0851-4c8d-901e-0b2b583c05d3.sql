-- Allow read + update for admin review (no auth wired yet — mirrors other admin mock pages).
-- NOTE: When real auth/roles land, replace `true` with a has_role(auth.uid(),'admin') check.
CREATE POLICY "Read educator applications"
ON public.educator_applications
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Update educator application status"
ON public.educator_applications
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);