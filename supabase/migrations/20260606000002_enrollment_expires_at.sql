-- Add optional expiry date to enrollments.
-- NULL means the enrollment never expires (existing behaviour preserved).
alter table enrollments
  add column if not exists expires_at timestamptz default null;
