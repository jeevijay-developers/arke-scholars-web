-- Educator applications table
CREATE TABLE public.educator_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  email TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  contact_no TEXT NOT NULL,
  alt_contact_no TEXT,
  subject TEXT NOT NULL,
  highest_qualification TEXT NOT NULL,
  other_qualification TEXT,
  current_organization TEXT,
  previous_organization TEXT,
  total_experience NUMERIC NOT NULL,
  current_ctc NUMERIC,
  expected_ctc NUMERIC NOT NULL,
  photo_url TEXT,
  resume_url TEXT,
  demo_video_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.educator_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can submit an application
CREATE POLICY "Anyone can submit educator application"
ON public.educator_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- No public read; only future admin role would read. For now, deny SELECT to anon.
-- (No SELECT policy means RLS blocks reads.)

-- Updated-at trigger function (shared)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_educator_applications_updated_at
BEFORE UPDATE ON public.educator_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for educator uploads (public so photos/resumes can be viewed by admins via URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('educator-uploads', 'educator-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can upload to this bucket; anyone can read (public bucket)
CREATE POLICY "Public read educator uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'educator-uploads');

CREATE POLICY "Anyone can upload educator files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'educator-uploads');