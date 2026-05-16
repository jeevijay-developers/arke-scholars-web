-- Schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  city text,
  country text,
  board text,
  contact_person text,
  contact_email text,
  contact_phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage schools" ON public.schools FOR ALL TO authenticated
  USING (is_admin_or_super(auth.uid())) WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated read schools" ON public.schools FOR SELECT TO authenticated
  USING (is_active = true OR is_admin_or_super(auth.uid()));

CREATE TRIGGER schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_associated_to_school boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

CREATE OR REPLACE FUNCTION public.sync_profile_school_flag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_associated_to_school := NEW.school_id IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_school_flag ON public.profiles;
CREATE TRIGGER profiles_sync_school_flag BEFORE INSERT OR UPDATE OF school_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_school_flag();