CREATE TABLE public.course_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  file_url text NOT NULL,
  size_bytes bigint,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_pdfs_course_id ON public.course_pdfs(course_id);

ALTER TABLE public.course_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pdfs of published courses"
ON public.course_pdfs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_pdfs.course_id AND c.is_published = true
));

CREATE POLICY "Staff manage all course pdfs"
ON public.course_pdfs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage pdfs of own courses"
ON public.course_pdfs
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_pdfs.course_id AND c.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.courses c
  WHERE c.id = course_pdfs.course_id AND c.created_by = auth.uid()
));

CREATE TRIGGER update_course_pdfs_updated_at
BEFORE UPDATE ON public.course_pdfs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();