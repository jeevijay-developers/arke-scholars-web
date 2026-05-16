ALTER TYPE public.app_role RENAME VALUE 'admin' TO 'super_admin';
ALTER TYPE public.app_role RENAME VALUE 'staff' TO 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'mentor';