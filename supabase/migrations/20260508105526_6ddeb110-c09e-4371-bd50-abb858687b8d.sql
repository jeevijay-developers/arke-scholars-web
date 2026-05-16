-- Re-create missing trigger so profiles row is automatically created when an auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profile rows for any admin/super_admin missing one
INSERT INTO public.profiles (user_id, full_name, phone, avatar_url)
SELECT u.id,
       COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
       u.raw_user_meta_data ->> 'phone',
       u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.role IN ('admin','super_admin')
ON CONFLICT (user_id) DO NOTHING;