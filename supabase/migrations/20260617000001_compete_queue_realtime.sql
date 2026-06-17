-- Enable Realtime on compete_queue so clients can subscribe to match_id being set
-- when an opponent claims them, eliminating the 3s poll loop at scale.
ALTER PUBLICATION supabase_realtime ADD TABLE compete_queue;
