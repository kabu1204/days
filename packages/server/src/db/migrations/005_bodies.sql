-- Members now also choose a body; existing members keep the body of their slot.
ALTER TABLE member ADD COLUMN body_id TEXT;
UPDATE member SET body_id = CASE slot WHEN 1 THEN 'cream' ELSE 'peach' END;
