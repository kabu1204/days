-- Phase 4: badges, the wish list for the date decision tools, and the treasure chest.

-- Unlocks are permanent: deleting data never removes a badge.
CREATE TABLE badge_unlock (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  badge_key TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  UNIQUE (space_id, badge_key)
);

CREATE TABLE wish_item (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  kind TEXT NOT NULL CHECK (kind IN ('destination', 'food')),
  text TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL,
  -- The memory made from this wish; set once, when the wish is granted.
  done_memory_id INTEGER REFERENCES memory (id),
  done_at TEXT
);
CREATE INDEX wish_item_space ON wish_item (space_id, kind);

-- When each member last opened the album; later unlocks carry the quiet marker.
ALTER TABLE member ADD COLUMN badges_seen_at TEXT;
-- The memories the treasure chest showed this member most recently (JSON array of ids).
ALTER TABLE member ADD COLUMN flashback_recent TEXT NOT NULL DEFAULT '[]';
