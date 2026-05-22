-- Update handle_new_user to also insert a 'student' role for every new signup.
-- Teachers, admins etc. get their roles assigned separately via provisioning flows;
-- the default for self-signup is always 'student'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (
    user_id, full_name, phone, avatar_url,
    target_exam, class_level, city, country
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'target_exam',
    NEW.raw_user_meta_data ->> 'class_level',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'country'
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Assign default 'student' role (admins/teachers get roles via separate provisioning)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: give 'student' role to every user who has a profile but no role at all.
-- This fixes all existing signups that were created before this migration.
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'student'::public.app_role
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
)
ON CONFLICT (user_id, role) DO NOTHING;
