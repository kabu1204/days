-- Phase 2: Places. A Place is shared by all memories at that location.
CREATE TABLE place (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  name TEXT NOT NULL,
  -- WGS-84, the same system as photo metadata.
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  city TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'pin',
  created_by INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One Place per memory, optional.
ALTER TABLE memory ADD COLUMN place_id INTEGER REFERENCES place (id);
CREATE INDEX memory_place ON memory (place_id);
