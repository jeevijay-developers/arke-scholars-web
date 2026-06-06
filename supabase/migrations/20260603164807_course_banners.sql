-- Course banners: admin-managed promotional banners shown on the landing page.
-- Mirrors the exams table pattern (RLS + has_role admin/super_admin management).
CREATE TABLE IF NOT EXISTS public.course_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_label text,
  cta_link text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_banners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_banners' AND policyname = 'Anyone can view active banners'
  ) THEN
    CREATE POLICY "Anyone can view active banners"
      ON public.course_banners FOR SELECT
      USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_banners' AND policyname = 'Admins manage banners'
  ) THEN
    CREATE POLICY "Admins manage banners"
      ON public.course_banners FOR ALL
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
  END IF;
END $$;

DROP TRIGGER IF EXISTS course_banners_updated_at ON public.course_banners;
CREATE TRIGGER course_banners_updated_at
  BEFORE UPDATE ON public.course_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
