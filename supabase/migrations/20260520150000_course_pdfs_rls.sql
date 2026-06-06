-- Add enrollment-gated RLS for course_pdfs and course_resources
-- Prevents unenrolled users from accessing file_url of course materials

-- Drop permissive policy and recreate with published course check only
DROP POLICY IF EXISTS "View pdfs of published courses" ON public.course_pdfs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_pdfs' AND policyname = 'course_pdfs_select'
  ) THEN
    CREATE POLICY "course_pdfs_select"
    ON public.course_pdfs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_pdfs.course_id AND c.is_published = true
      )
    );
  END IF;
END $$;

-- Add enrollment-gated RLS for course_resources (if not already present)
CREATE POLICY IF NOT EXISTS "course_resources_enrolled_select"
ON public.course_resources FOR SELECT
USING (
  is_published = true AND (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_resources.course_id
        AND e.user_id = auth.uid()
        AND e.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','super_admin','teacher')
    )
  )
);
