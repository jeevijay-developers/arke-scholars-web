
-- ============================================================
-- PART A: Admin User Management additions to profiles + role RPC
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'Free';

-- Allow staff/admin to update profiles (suspend, change plan, etc.)
DROP POLICY IF EXISTS "Staff can update all profiles" ON public.profiles;
CREATE POLICY "Staff can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Staff can view all user_roles (so admin table can show current roles)
DROP POLICY IF EXISTS "Staff can view all user_roles" ON public.user_roles;
CREATE POLICY "Staff can view all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Security definer RPC to set/replace a user's role (admin-only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Replace existing roles for this user with the chosen role
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;

-- ============================================================
-- PART B: Course curriculum schema
-- ============================================================

-- Track which teacher created the course (nullable for legacy rows)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Allow teachers to manage their own courses
DROP POLICY IF EXISTS "Teachers can manage their own courses" ON public.courses;
CREATE POLICY "Teachers can manage their own courses"
ON public.courses
FOR ALL
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chapters_course ON public.chapters(course_id, position);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chapters of published courses"
ON public.chapters
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.is_published = true)
);

CREATE POLICY "Staff can manage all chapters"
ON public.chapters
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage chapters of own courses"
ON public.chapters
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = chapters.course_id AND c.created_by = auth.uid()));

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  video_url TEXT,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'video',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON public.lessons(chapter_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON public.lessons(course_id, position);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lessons of published courses"
ON public.lessons
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.is_published = true)
);

CREATE POLICY "Staff can manage all lessons"
ON public.lessons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage lessons of own courses"
ON public.lessons
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.created_by = auth.uid()));

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lesson notes (private notes per user per lesson)
CREATE TABLE IF NOT EXISTS public.lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lesson notes"
ON public.lesson_notes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_lesson_notes_updated_at
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
