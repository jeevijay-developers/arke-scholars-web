ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reported_role_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reported_role_check CHECK (reported_role = ANY (ARRAY['teacher'::text, 'mentor'::text, 'staff'::text, 'student'::text, 'other'::text]));
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;