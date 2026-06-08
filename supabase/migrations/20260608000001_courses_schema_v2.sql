-- Courses schema v2: new pricing model, target/class fields, folders, content_items
-- Migration order:
-- 1. Add new columns (nullable first)
-- 2. Backfill + apply NOT NULL constraints
-- 3. Replace discount_percent with generated column
-- 4. Rename is_published → is_active
-- 5. Drop removed columns
-- 6. Create folders table
-- 7. Create content_items table
-- 8. Update RLS policies

-- ============================================================
-- Step 1: Add new columns (all nullable initially)
-- ============================================================
alter table public.courses
  add column if not exists internal_name       text,
  add column if not exists course_end_date     date,
  add column if not exists target              text,
  add column if not exists "class"             text,
  add column if not exists language            text not null default 'Hindi',
  add column if not exists mrp                 numeric(10,2) not null default 0,
  add column if not exists sale_price          numeric(10,2) not null default 0,
  add column if not exists show_price_with_gst boolean not null default false,
  add column if not exists is_course_free      boolean not null default false,
  add column if not exists max_usage_days      integer,
  add column if not exists priority            integer not null default 0;

-- ============================================================
-- Step 2: Backfill data so NOT NULL constraints can be applied
-- ============================================================
update public.courses set internal_name = name   where internal_name is null;
update public.courses set target        = 'IIT-JEE' where target is null;
update public.courses set "class"       = '11'   where "class" is null;

-- ============================================================
-- Step 3: Apply NOT NULL and check constraints
-- ============================================================
alter table public.courses
  alter column internal_name set not null,
  alter column target        set not null,
  alter column "class"       set not null;

alter table public.courses
  add constraint courses_target_check   check (target   in ('IIT-JEE', 'NEET', 'Foundation')),
  add constraint courses_class_check    check ("class"  in ('8', '9', '10', '11', '12', '12th_pass')),
  add constraint courses_language_check check (language in ('Hindi', 'English')),
  add constraint courses_free_price_check check (
    not is_course_free or (mrp = 0 and sale_price = 0)
  );

-- ============================================================
-- Step 4: Replace discount_percent (plain int) with generated column
-- ============================================================
alter table public.courses drop column if exists discount_percent;

alter table public.courses
  add column discount_percent numeric(5,2) generated always as (
    case when mrp > 0
      then round(((mrp - sale_price) / mrp) * 100, 2)
      else 0
    end
  ) stored;

-- ============================================================
-- Step 5: Rename is_published → is_active
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses' and column_name = 'is_published'
  ) then
    alter table public.courses rename column is_published to is_active;
  end if;
end;
$$;

-- ============================================================
-- Step 6: Drop removed columns
-- ============================================================
alter table public.courses
  drop column if exists subject,
  drop column if exists educator_name,
  drop column if exists original_price,
  drop column if exists price,
  drop column if exists total_enrolled,
  drop column if exists total_lessons,
  drop column if exists duration_hours,
  drop column if exists level,
  drop column if exists target_exam;

-- ============================================================
-- Step 7: Create folders table
-- ============================================================
create table if not exists public.folders (
  id         uuid        not null default gen_random_uuid(),
  course_id  uuid        not null references public.courses(id) on delete cascade,
  parent_id  uuid                 references public.folders(id) on delete cascade,
  name       text        not null,
  "order"    integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_pkey primary key (id)
);

create index if not exists folders_course_id_idx on public.folders(course_id);
create index if not exists folders_parent_id_idx on public.folders(parent_id);

drop trigger if exists update_folders_updated_at on public.folders;
create trigger update_folders_updated_at
  before update on public.folders
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Step 8: Create content_items table
-- ============================================================
create table if not exists public.content_items (
  id              uuid        not null default gen_random_uuid(),
  course_id       uuid        not null references public.courses(id) on delete cascade,
  folder_id       uuid        not null references public.folders(id) on delete cascade,
  type            text        not null check (type in ('live_class', 'pdf', 'recorded_lecture', 'video', 'test')),
  title           text        not null,
  description     text,
  -- PDF and recorded lectures (S3)
  file_url        text,
  -- Video: YouTube or S3
  video_url       text,
  video_source    text        check (video_source in ('s3', 'youtube')),
  -- Live class
  zoom_link       text,
  scheduled_at    timestamptz,
  -- Test
  test_id         uuid        references public.tests(id) on delete set null,
  -- Meta
  "order"         integer     not null default 0,
  is_free_preview boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint content_items_pkey primary key (id)
);

create index if not exists content_items_course_id_idx  on public.content_items(course_id);
create index if not exists content_items_folder_id_idx  on public.content_items(folder_id);
create index if not exists content_items_type_idx       on public.content_items(type);
create index if not exists content_items_scheduled_idx  on public.content_items(scheduled_at) where type = 'live_class';

drop trigger if exists update_content_items_updated_at on public.content_items;
create trigger update_content_items_updated_at
  before update on public.content_items
  for each row execute function public.update_updated_at_column();

-- ============================================================
-- Step 9: Update RLS policies
-- ============================================================

-- courses: fix public read policy (is_published → is_active)
drop policy if exists "Published courses are viewable by everyone" on public.courses;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'courses'
      and policyname = 'Active courses are viewable by everyone'
  ) then
    execute $policy$
      create policy "Active courses are viewable by everyone"
        on public.courses for select
        using (is_active = true)
    $policy$;
  end if;
end;
$$;

-- folders RLS
alter table public.folders enable row level security;

drop policy if exists "Enrolled users and staff can read folders" on public.folders;
create policy "Enrolled users and staff can read folders"
  on public.folders for select to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or exists (
      select 1 from public.enrollments e
      where e.user_id    = auth.uid()
        and e.course_id  = folders.course_id
        and e.is_active  = true
    )
  );

drop policy if exists "Staff can manage folders" on public.folders;
create policy "Staff can manage folders"
  on public.folders for all to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
  with check (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  );

-- content_items RLS
alter table public.content_items enable row level security;

drop policy if exists "Enrolled users, free-preview, and staff can read content_items" on public.content_items;
create policy "Enrolled users, free-preview, and staff can read content_items"
  on public.content_items for select to authenticated
  using (
    is_free_preview = true
    or has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
    or exists (
      select 1 from public.enrollments e
      where e.user_id   = auth.uid()
        and e.course_id = content_items.course_id
        and e.is_active = true
    )
  );

drop policy if exists "Staff can manage content_items" on public.content_items;
create policy "Staff can manage content_items"
  on public.content_items for all to authenticated
  using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  )
  with check (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  );
