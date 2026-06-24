-- 寰语星球 · SQLite 表结构（PRD §12）。用 Node 内置 node:sqlite 执行。
-- M1/M2 暂不写入；M5 起真正使用（对话记录、能力分、学情等）。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT CHECK(role IN ('student','teacher')) DEFAULT 'student',
  country TEXT,
  native_lang TEXT,
  hsk_level INTEGER DEFAULT 3,
  credits INTEGER DEFAULT 100,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  name TEXT,
  enabled_modules_json TEXT,
  hsk_default INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id TEXT,
  user_id TEXT,
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT,
  lang TEXT,
  country TEXT,
  city TEXT,
  topic TEXT,
  tags_json TEXT,
  embedding_blob BLOB,
  source TEXT
);

CREATE TABLE IF NOT EXISTS hanzi_items (
  id TEXT PRIMARY KEY,
  char TEXT,
  pinyin TEXT,
  strokes INTEGER,
  radical TEXT,
  hsk INTEGER,
  story_zh TEXT,
  story_native TEXT,
  words_json TEXT
);

CREATE TABLE IF NOT EXISTS hsk_vocab (
  level INTEGER,
  word TEXT,
  pinyin TEXT
);

CREATE TABLE IF NOT EXISTS taboo (
  country TEXT,
  topic TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  context_ids_json TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content_zh TEXT,
  content_native TEXT,
  level_check_json TEXT,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS learning_records (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  module TEXT,
  item_id TEXT,
  score REAL,
  metrics_json TEXT,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS ability_scores (
  user_id TEXT,
  dim TEXT CHECK(dim IN ('listen','speak','read','write','hanzi','culture','hskk')),
  score REAL,
  updated_at INTEGER,
  PRIMARY KEY (user_id, dim)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  level TEXT,
  badge_type TEXT,
  issued_at INTEGER
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  task_type TEXT,
  topic TEXT,
  md_zh TEXT,
  md_native TEXT,
  ppt_url TEXT,
  docx_url TEXT,
  pdf_url TEXT,
  trace_json TEXT,
  ts INTEGER
);
