-- Add enrollment-based access control for course-linked live classes
-- Students can only see classes if: (1) no course_id (standalone), or (2) they're enrolled in the course

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Live classes viewable by authenticated" ON live_classes;

-- Create a new policy that enforces course enrollment
CREATE POLICY "Live classes viewable by authenticated" ON live_classes
FOR SELECT USING (
  -- Standalone class (no course) — visible to all authenticated users
  course_id IS NULL
  -- Course-linked class — only enrolled students (is_active = true)
  OR EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.user_id = auth.uid()
      AND e.course_id = live_classes.course_id
      AND e.is_active = true
  )
  -- Admin / staff always see everything
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'staff')
  -- Teacher sees their own classes
  OR created_by = auth.uid()
);
