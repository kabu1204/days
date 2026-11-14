-- One shared space, exactly two members at most.
CREATE TABLE space (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  created_at TEXT NOT NULL
);

CREATE TABLE member (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  -- The two-member limit is enforced here, not only in the interface.
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sprite_id TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'zh-CN' CHECK (lang IN ('zh-CN', 'en')),
  created_at TEXT NOT NULL,
  UNIQUE (space_id, slot)
);

CREATE TABLE invitation (
  token_hash TEXT PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  created_by INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL,
  used_at TEXT,
  used_by INTEGER REFERENCES member (id)
);

CREATE TABLE session (
  token_hash TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE memory (
  id INTEGER PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES space (id),
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT,
  date_precision TEXT NOT NULL DEFAULT 'day' CHECK (date_precision IN ('day', 'month')),
  category TEXT NOT NULL DEFAULT 'daily',
  created_by INTEGER NOT NULL REFERENCES member (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX memory_start_date ON memory (start_date);
CREATE INDEX memory_deleted_at ON memory (deleted_at);

CREATE TABLE photo (
  id INTEGER PRIMARY KEY,
  memory_id INTEGER NOT NULL REFERENCES memory (id),
  uploaded_by INTEGER NOT NULL REFERENCES member (id),
  original_path TEXT NOT NULL,
  medium_path TEXT NOT NULL,
  thumb_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  taken_at TEXT,
  latitude REAL,
  longitude REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX photo_memory ON photo (memory_id, sort_order);
