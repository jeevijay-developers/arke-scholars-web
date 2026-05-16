CREATE OR REPLACE FUNCTION public.educator_application_exists(_email text, _contact_no text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.educator_applications
    WHERE lower(email) = lower(_email) OR contact_no = _contact_no
  )
$$;

GRANT EXECUTE ON FUNCTION public.educator_application_exists(text, text) TO anon, authenticated;