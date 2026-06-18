-- Add rich-text detailed description field to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS detailed_description text;
