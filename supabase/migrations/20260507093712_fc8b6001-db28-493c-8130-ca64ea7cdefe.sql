CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exams"
  ON public.exams FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins manage exams"
  ON public.exams FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.exams (name, code, description, sort_order) VALUES
  ('JEE Main', 'jee-main', 'Joint Entrance Examination — Main', 10),
  ('JEE Advanced', 'jee-advanced', 'Joint Entrance Examination — Advanced', 20),
  ('NEET', 'neet', 'National Eligibility cum Entrance Test', 30),
  ('Boards', 'boards', 'CBSE / State board exams', 40),
  ('Foundation', 'foundation', 'Class 9 & 10 Foundation', 50)
ON CONFLICT (name) DO NOTHING;