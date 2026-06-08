CREATE TABLE IF NOT EXISTS focus_session_tags (
  session_id UUID NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (session_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_focus_session_tags_tag ON focus_session_tags(tag);
