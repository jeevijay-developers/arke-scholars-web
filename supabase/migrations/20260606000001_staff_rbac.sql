-- Staff RBAC: custom staff roles with page-level permission matrix.
-- New staff members still get app_role = 'admin' so existing guards pass;
-- the permission matrix is a UI-layer filter on top.

create table if not exists staff_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists staff_role_permissions (
  id             uuid primary key default gen_random_uuid(),
  staff_role_id  uuid not null references staff_roles(id) on delete cascade,
  page_key       text not null,
  can_view       boolean not null default false,
  can_edit       boolean not null default false,
  can_delete     boolean not null default false,
  can_approve    boolean not null default false,
  can_export     boolean not null default false,
  unique (staff_role_id, page_key)
);

create table if not exists staff_role_assignments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  staff_role_id  uuid not null references staff_roles(id) on delete cascade,
  assigned_by    uuid references auth.users(id) on delete set null,
  assigned_at    timestamptz not null default now(),
  unique (user_id, staff_role_id)
);

-- RLS
alter table staff_roles enable row level security;
alter table staff_role_permissions enable row level security;
alter table staff_role_assignments enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_roles' AND policyname = 'super_admin_all_staff_roles') THEN
    CREATE POLICY "super_admin_all_staff_roles"
      ON staff_roles FOR ALL
      USING (public.has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_roles' AND policyname = 'staff_read_staff_roles') THEN
    CREATE POLICY "staff_read_staff_roles"
      ON staff_roles FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_role_permissions' AND policyname = 'super_admin_all_staff_role_permissions') THEN
    CREATE POLICY "super_admin_all_staff_role_permissions"
      ON staff_role_permissions FOR ALL
      USING (public.has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_role_permissions' AND policyname = 'staff_read_own_permissions') THEN
    CREATE POLICY "staff_read_own_permissions"
      ON staff_role_permissions FOR SELECT
      USING (
        staff_role_id IN (
          SELECT staff_role_id FROM staff_role_assignments WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_role_assignments' AND policyname = 'super_admin_all_staff_role_assignments') THEN
    CREATE POLICY "super_admin_all_staff_role_assignments"
      ON staff_role_assignments FOR ALL
      USING (public.has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_role_assignments' AND policyname = 'staff_read_own_assignment') THEN
    CREATE POLICY "staff_read_own_assignment"
      ON staff_role_assignments FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;
