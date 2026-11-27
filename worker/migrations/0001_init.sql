-- QSLforge initial schema (D1 / SQLite)
-- Conventions:
--   * ids are TEXT (crypto.randomUUID())
--   * timestamps are TEXT in ISO 8601 UTC, e.g. 2026-11-27T10:15:00Z
--   * every user-owned table has owner_id so multi-user needs no migration later
--   * the Worker filters every query on owner_id; the frontend never does
--   * D1 enforces foreign keys by default, no PRAGMA needed

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  call        TEXT NOT NULL,
  name        TEXT,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  disabled_at TEXT
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));
CREATE UNIQUE INDEX ux_users_call ON users (upper(call));

-- ---------------------------------------------------------------- stations
CREATE TABLE stations (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users (id),
  call        TEXT NOT NULL,                 -- ON3VZ, ON3VZ/P
  rig         TEXT,
  antenna     TEXT,
  power_w     REAL,
  power_label TEXT DEFAULT '5W QRP',          -- used in comment fields
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_stations_owner ON stations (owner_id);

-- ---------------------------------------------------------------- programs
-- Configuration, not code. owner_id NULL = system program available to everyone.
CREATE TABLE programs (
  code          TEXT PRIMARY KEY,             -- POTA, WWFF, SOTA, BOTA, COTA
  owner_id      TEXT REFERENCES users (id),
  name          TEXT NOT NULL,
  ref_regex     TEXT,                         -- validation of the reference format
  adif_my_field TEXT,                         -- e.g. MY_POTA_REF; NULL = use MY_SIG/MY_SIG_INFO
  adif_sig      TEXT,                         -- value of MY_SIG when adif_my_field is NULL
  adif_their_field TEXT,                      -- e.g. POTA_REF for P2P
  hashtags      TEXT NOT NULL DEFAULT '[]',   -- JSON array
  dupe_window   TEXT NOT NULL DEFAULT 'utc_day' CHECK (dupe_window IN ('utc_day', 'activation')),
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);

-- ---------------------------------------------------------------- qsl_templates
-- Every change creates a new version row; sent cards always point to an exact version.
CREATE TABLE qsl_templates (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  template_key  TEXT NOT NULL,                -- stable id shared by all versions
  name          TEXT NOT NULL,
  version       INTEGER NOT NULL CHECK (version >= 1),
  format        TEXT NOT NULL DEFAULT 'qsl_140x90' CHECK (format IN ('qsl_140x90', 'square')),
  design        TEXT NOT NULL,                -- JSON
  background_key TEXT,                        -- R2 key
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX ux_qsl_templates_version ON qsl_templates (owner_id, template_key, version);

-- ---------------------------------------------------------------- activations
CREATE TABLE activations (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  station_id    TEXT REFERENCES stations (id),
  default_template_id TEXT REFERENCES qsl_templates (id),
  title         TEXT,
  start_utc     TEXT NOT NULL,
  end_utc       TEXT,
  grid          TEXT,
  lat           REAL,
  lon           REAL,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'published')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  CHECK (end_utc IS NULL OR end_utc >= start_utc)
);
CREATE INDEX ix_activations_owner_start ON activations (owner_id, start_utc DESC);

CREATE TABLE activation_refs (
  activation_id TEXT NOT NULL REFERENCES activations (id) ON DELETE CASCADE,
  program_code  TEXT NOT NULL REFERENCES programs (code),
  reference     TEXT NOT NULL,                -- e.g. ONFF-0599, BE-0001
  ref_name      TEXT,
  PRIMARY KEY (activation_id, program_code, reference)
);
CREATE INDEX ix_activation_refs_ref ON activation_refs (program_code, reference);

-- ---------------------------------------------------------------- log_files
CREATE TABLE log_files (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  activation_id TEXT NOT NULL REFERENCES activations (id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  format        TEXT NOT NULL CHECK (format IN ('ADIF', 'CABRILLO')),
  sha256        TEXT NOT NULL,
  r2_key        TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  qso_count     INTEGER NOT NULL DEFAULT 0,
  dupe_count    INTEGER NOT NULL DEFAULT 0,
  uploaded_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX ux_log_files_hash ON log_files (activation_id, sha256);

-- ---------------------------------------------------------------- qsos
CREATE TABLE qsos (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  activation_id TEXT NOT NULL REFERENCES activations (id) ON DELETE CASCADE,
  log_file_id   TEXT REFERENCES log_files (id) ON DELETE SET NULL,
  template_id   TEXT REFERENCES qsl_templates (id),   -- overrides activation default
  call          TEXT NOT NULL,
  qso_utc       TEXT NOT NULL,                -- ISO 8601, from QSO_DATE + TIME_ON
  band          TEXT NOT NULL,                -- ADIF band, e.g. 40m
  freq_mhz      REAL,
  mode          TEXT NOT NULL,                -- ADIF mode, e.g. SSB, CW, FT8
  submode       TEXT,
  rst_sent      TEXT,
  rst_rcvd      TEXT,
  gridsquare    TEXT,
  their_ref     TEXT,                         -- P2P / S2S reference
  name          TEXT,
  country       TEXT,
  dxcc          INTEGER,
  lat           REAL,
  lon           REAL,
  distance_km   REAL,
  is_dupe       INTEGER NOT NULL DEFAULT 0 CHECK (is_dupe IN (0, 1)),
  extra_fields  TEXT NOT NULL DEFAULT '{}',   -- JSON: other ADIF fields, kept for export
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX ux_qsos_identity ON qsos (owner_id, upper(call), qso_utc, band, mode);
CREATE INDEX ix_qsos_activation ON qsos (activation_id, qso_utc);
CREATE INDEX ix_qsos_owner_call ON qsos (owner_id, call);
CREATE INDEX ix_qsos_owner_utc ON qsos (owner_id, qso_utc DESC);

-- ---------------------------------------------------------------- contacts
-- One record per call per owner (no copy per QSO). Addresses are personal data:
-- deleted after the retention period, the per-QSO mail status stays.
CREATE TABLE contacts (
  owner_id      TEXT NOT NULL REFERENCES users (id),
  call          TEXT NOT NULL,
  email         TEXT,
  source        TEXT CHECK (source IN ('qrz', 'hamqth', 'manual', 'none')),
  fetched_at    TEXT,
  last_qso_utc  TEXT,                         -- drives the retention period
  PRIMARY KEY (owner_id, call)
);
CREATE INDEX ix_contacts_last_qso ON contacts (last_qso_utc);

-- Global suppression list. Deliberately WITHOUT owner_id: a call that unsubscribed
-- never receives mail from QSLforge again, whichever user sends.
CREATE TABLE suppressions (
  call          TEXT PRIMARY KEY,
  reason        TEXT NOT NULL DEFAULT 'unsubscribe' CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------- qsl_cards
CREATE TABLE qsl_cards (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  qso_id        TEXT NOT NULL REFERENCES qsos (id) ON DELETE CASCADE,
  template_id   TEXT NOT NULL REFERENCES qsl_templates (id),  -- exact version
  verify_code   TEXT NOT NULL,                -- HMAC-SHA256, 12 chars base32
  r2_key        TEXT,
  generated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX ux_qsl_cards_qso ON qsl_cards (qso_id);
CREATE UNIQUE INDEX ux_qsl_cards_code ON qsl_cards (verify_code);

-- ---------------------------------------------------------------- photos
CREATE TABLE photos (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  activation_id TEXT NOT NULL REFERENCES activations (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL CHECK (position IN (1, 2)),
  r2_key        TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  focus_x       REAL,                         -- 0..1
  focus_y       REAL,                         -- 0..1
  exif_stripped INTEGER NOT NULL DEFAULT 0 CHECK (exif_stripped IN (0, 1)),
  uploaded_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX ux_photos_position ON photos (activation_id, position);

-- ---------------------------------------------------------------- social_posts
CREATE TABLE social_posts (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  activation_id TEXT NOT NULL REFERENCES activations (id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'x', 'mastodon')),
  language      TEXT NOT NULL DEFAULT 'nl' CHECK (language IN ('nl', 'en')),
  body          TEXT NOT NULL,
  image_key     TEXT,
  generated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_social_posts_activation ON social_posts (activation_id, generated_at DESC);

-- ---------------------------------------------------------------- mail
CREATE TABLE mail_jobs (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  activation_id TEXT NOT NULL REFERENCES activations (id),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sending', 'done', 'cancelled')),
  total         INTEGER NOT NULL DEFAULT 0,
  sent          INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_mail_jobs_owner ON mail_jobs (owner_id, created_at DESC);

CREATE TABLE mail_messages (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES users (id),
  mail_job_id   TEXT NOT NULL REFERENCES mail_jobs (id) ON DELETE CASCADE,
  qso_id        TEXT NOT NULL REFERENCES qsos (id),
  email         TEXT,                         -- cleared after retention period
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'bounced', 'failed')),
  unsubscribe_token TEXT NOT NULL,
  provider_message_id TEXT,
  sent_at       TEXT,
  error         TEXT
);
CREATE UNIQUE INDEX ux_mail_messages_job_qso ON mail_messages (mail_job_id, qso_id);
CREATE UNIQUE INDEX ux_mail_messages_unsub ON mail_messages (unsubscribe_token);
CREATE INDEX ix_mail_messages_qso ON mail_messages (qso_id);
CREATE INDEX ix_mail_messages_status ON mail_messages (status);
CREATE INDEX ix_mail_messages_provider ON mail_messages (provider_message_id);

-- ---------------------------------------------------------------- audit_log
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT REFERENCES users (id),
  action        TEXT NOT NULL,                -- e.g. user.bootstrap, mailjob.start, export.adif
  object_type   TEXT,
  object_id     TEXT,
  ip_hash       TEXT,                         -- SHA-256 of IP + secret salt, never the raw IP
  at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX ix_audit_log_user_at ON audit_log (user_id, at DESC);
