-- Phase 3: comments, stickers, the quiet marker for new items, and key dates.

CREATE TABLE comment (
  id INTEGER PRIMARY KEY,
  memory_id INTEGER NOT NULL REFERENCES memory (id),
  author_id INTEGER NOT NULL REFERENCES member (id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX comment_memory ON comment (memory_id, created_at);

-- Reactions have no position; decorative stickers have a position on the cover (0-1).
CREATE TABLE sticker (
  id INTEGER PRIMARY KEY,
  memory_id INTEGER NOT NULL REFERENCES memory (id),
  sticker_key TEXT NOT NULL,
  placed_by INTEGER NOT NULL REFERENCES member (id),
  x REAL CHECK (x IS NULL OR x BETWEEN 0 AND 1),
  y REAL CHECK (y IS NULL OR y BETWEEN 0 AND 1),
  created_at TEXT NOT NULL,
  CHECK ((x IS NULL) = (y IS NULL))
);
CREATE INDEX sticker_memory ON sticker (memory_id);
-- At most one reaction of each kind per member.
CREATE UNIQUE INDEX sticker_reaction ON sticker (memory_id, sticker_key, placed_by) WHERE x IS NULL;

-- When each member last opened each memory.
CREATE TABLE memory_seen (
  member_id INTEGER NOT NULL REFERENCES member (id),
  memory_id INTEGER NOT NULL REFERENCES memory (id),
  seen_at TEXT NOT NULL,
  PRIMARY KEY (member_id, memory_id)
);

-- Items older than this are never marked as new for the member: everything
-- that existed when the member joined, or when this migration ran.
ALTER TABLE member ADD COLUMN seen_since TEXT;
UPDATE member SET seen_since = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- The member who saved the memory's text fields last.
ALTER TABLE memory ADD COLUMN updated_by INTEGER REFERENCES member (id);

CREATE TABLE key_date (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL
);
