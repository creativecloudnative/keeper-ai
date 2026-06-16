export const CREATE_INCIDENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS incidents (
    id          TEXT PRIMARY KEY,
    service_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK(severity IN ('low','moderate','high','critical')),
    status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    resolved_at TEXT,
    metadata    TEXT
  )
`;

export const CREATE_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS runs (
    id           TEXT PRIMARY KEY,
    service_id   TEXT NOT NULL,
    agent_type   TEXT NOT NULL,
    status       TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
    triggered_by TEXT NOT NULL,
    started_at   TEXT NOT NULL,
    completed_at TEXT,
    result       TEXT
  )
`;

export const CREATE_RUN_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS run_events (
    id         TEXT PRIMARY KEY,
    run_id     TEXT NOT NULL REFERENCES runs(id),
    type       TEXT NOT NULL,
    data       TEXT NOT NULL,
    seq        INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )
`;

export const CREATE_RUN_EVENTS_IDX = `
  CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id, seq)
`;

export const CREATE_SIGNALS_TABLE = `
  CREATE TABLE IF NOT EXISTS signals (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    source      TEXT NOT NULL,
    service_id  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processed_at TEXT
  )
`;
