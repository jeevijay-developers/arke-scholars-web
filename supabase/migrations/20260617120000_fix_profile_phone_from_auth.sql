-- Fix phone-OTP signups creating "Unnamed" profiles with NULL phone.
--
-- Root cause: handle_new_user read phone from raw_user_meta_data->>'phone' (always
-- empty in the phone-OTP flow, which passes no options.data) instead of from
-- auth.users.phone (the actual verified/pending number). So every phone signup's
-- profile was born with phone = NULL until the user finished the profile-setup step.

-- 1) handle_new_user: copy the real phone from auth.users.phone.
--    auth stores it without a leading '+' (e.g. 917428730894); the app stores
--    +91XXXXXXXXXX, so normalise with a leading '+'. Fall back to metadata phone
--    (used by admin-created / email signups).
--    Guard against profiles_phone_norm_unique: if the number already belongs to
--    another profile (a duplicate / re-attempt signup), insert NULL instead — a
--    raised exception here would abort the auth.users insert and break signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := COALESCE(
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN '+' || NEW.phone END,
    NEW.raw_user_meta_data ->> 'phone'
  );

  IF v_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE right(regexp_replace(phone, '\D', '', 'g'), 10)
        = right(regexp_replace(v_phone, '\D', '', 'g'), 10)
  ) THEN
    v_phone := NULL;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, phone, avatar_url,
    target_exam, class_level, city, country
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    v_phone,
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'target_exam',
    NEW.raw_user_meta_data ->> 'class_level',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'country'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Backfill: populate phone for existing profiles that have a real auth phone,
--    skipping any number already claimed by another profile (duplicate accounts).
UPDATE public.profiles p
SET phone = '+' || u.phone
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.phone IS NULL OR p.phone = '')
  AND u.phone IS NOT NULL AND u.phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.user_id <> p.user_id
      AND right(regexp_replace(p2.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(u.phone, '\D', '', 'g'), 10)
  );
