REVOKE EXECUTE ON FUNCTION public.upcoming_live_class_reminders(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upcoming_live_class_reminders(INT) TO service_role;