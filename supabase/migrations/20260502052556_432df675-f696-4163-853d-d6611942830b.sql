-- Courses: teachers can no longer manage their own courses
DROP POLICY IF EXISTS "Teachers can manage their own courses" ON public.courses;

-- Chapters: drop teacher-managed-own-courses rule
DROP POLICY IF EXISTS "Teachers manage chapters of own courses" ON public.chapters;

-- Lessons: drop teacher-managed-own-courses rule
DROP POLICY IF EXISTS "Teachers manage lessons of own courses" ON public.lessons;

-- Course PDFs: drop teacher rule
DROP POLICY IF EXISTS "Teachers manage pdfs of own courses" ON public.course_pdfs;

-- Course resources: drop teacher rule
DROP POLICY IF EXISTS "Teachers manage resources of own courses" ON public.course_resources;

-- Question bank: drop teacher write/insert/select; only admin/super_admin manage going forward
DROP POLICY IF EXISTS "Teachers can add questions" ON public.question_bank;
DROP POLICY IF EXISTS "Owners and staff can update questions" ON public.question_bank;
DROP POLICY IF EXISTS "Owners and staff can delete questions" ON public.question_bank;
DROP POLICY IF EXISTS "Teachers and staff can view question bank" ON public.question_bank;

CREATE POLICY "Admins manage question bank"
ON public.question_bank
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Test questions: drop teacher-as-creator rule (admins manage all via existing policy)
DROP POLICY IF EXISTS "Creators manage own test questions" ON public.test_questions;