-- Randomly assign one of the three standard badges to every active course
UPDATE courses
SET badge = (ARRAY['Bestseller', 'Hot', 'New Launch'])[floor(random() * 3 + 1)::int]
WHERE is_active = true;
