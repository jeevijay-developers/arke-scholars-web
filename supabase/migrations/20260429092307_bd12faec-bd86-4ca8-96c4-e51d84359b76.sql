-- Clear stale must_change_password flags for teachers who have already
-- updated their password (auth.users.updated_at is well after created_at)
-- but the clear-password-flag edge function failed to clear it previously.
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'must_change_password'
where raw_app_meta_data ? 'must_change_password'
  and (raw_app_meta_data->>'must_change_password')::text = 'true'
  and updated_at - created_at > interval '60 seconds';