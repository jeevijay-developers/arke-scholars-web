-- Add Zoom meeting credentials to live_classes
ALTER TABLE live_classes
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_meeting_password TEXT;

-- Drop custom live chat (replaced by Zoom's built-in chat)
DROP TABLE IF EXISTS live_class_messages;
