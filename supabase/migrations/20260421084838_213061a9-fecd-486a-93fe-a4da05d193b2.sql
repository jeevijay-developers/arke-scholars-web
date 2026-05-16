-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Replace old permissive policies on educator_applications
DROP POLICY IF EXISTS "Read educator applications" ON public.educator_applications;
DROP POLICY IF EXISTS "Update educator application status" ON public.educator_applications;

-- Public can still submit (existing INSERT policy stays)
-- Only staff/admin can read
CREATE POLICY "Staff can read educator applications"
  ON public.educator_applications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin')
  );

-- Only staff/admin can update
CREATE POLICY "Staff can update educator applications"
  ON public.educator_applications FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin')
  );