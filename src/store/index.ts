import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  CREATE_INCIDENTS_TABLE,
  CREATE_RUNS_TABLE,
  CREATE_RUN_EVENTS_TABLE,
  CREATE_RUN_EVENTS_IDX,
  CREATE_SIGNALS_TABLE,
  CREATE_VULNERABILITIES_TABLE,
  CREATE_VULNERABILITIES_IDX,
  CREATE_SUPPRESSIONS_TABLE,
  CREATE_SUPPRESSIONS_IDX,
} from './schema';
import type { Incident, Run, RunEvent, AgentResult, AgentType, Vulnerability, VulnStatus, Suppression, SuppressionType } from '../shared/types';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.resolve(process.env.KEEPER_DB_PATH ?? './keeper.db');
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.exec(CREATE_INCIDENTS_TABLE);
    _db.exec(CREATE_RUNS_TABLE);
    _db.exec(CREATE_RUN_EVENTS_TABLE);
    _db.exec(CREATE_RUN_EVENTS_IDX);
    _db.exec(CREATE_SIGNALS_TABLE);
    _db.exec(CREATE_VULNERABILITIES_TABLE);
    _db.exec(CREATE_VULNERABILITIES_IDX);
    _db.exec(CREATE_SUPPRESSIONS_TABLE);
    _db.exec(CREATE_SUPPRESSIONS_IDX);
  }
  return _db;
}

export const store = {
  // ── Incidents ─────────────────────────────────────────────────────────────

  createIncident(params: Omit<Incident, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Incident {
    const now = new Date().toISOString();
    const incident: Incident = { id: randomUUID(), status: 'open', createdAt: now, updatedAt: now, ...params };
    getDb()
      .prepare(
        `INSERT INTO incidents (id, service_id, title, description, severity, status, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        incident.id, incident.serviceId, incident.title, incident.description,
        incident.severity, incident.status, incident.createdAt, incident.updatedAt,
        incident.metadata ? JSON.stringify(incident.metadata) : null
      );
    return incident;
  },

  getOpenIncidents(serviceId: string): Incident[] {
    return (
      getDb()
        .prepare(`SELECT * FROM incidents WHERE service_id = ? AND status != 'resolved' ORDER BY created_at DESC`)
        .all(serviceId) as Record<string, unknown>[]
    ).map(rowToIncident);
  },

  listIncidents(options: { serviceId?: string; includeResolved?: boolean } = {}): Incident[] {
    let sql = 'SELECT * FROM incidents';
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (options.serviceId) { clauses.push('service_id = ?'); params.push(options.serviceId); }
    if (!options.includeResolved) { clauses.push("status != 'resolved'"); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToIncident);
  },

  resolveIncident(id: string): void {
    const now = new Date().toISOString();
    getDb()
      .prepare(`UPDATE incidents SET status = 'resolved', resolved_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, id);
  },

  // ── Runs ──────────────────────────────────────────────────────────────────

  startRun(params: Pick<Run, 'serviceId' | 'agentType' | 'triggeredBy'>): Run {
    const run: Run = { id: randomUUID(), status: 'running', startedAt: new Date().toISOString(), ...params };
    getDb()
      .prepare(
        `INSERT INTO runs (id, service_id, agent_type, status, triggered_by, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(run.id, run.serviceId, run.agentType, run.status, run.triggeredBy, run.startedAt);
    return run;
  },

  completeRun(id: string, result: AgentResult): void {
    getDb()
      .prepare(`UPDATE runs SET status = ?, completed_at = ?, result = ? WHERE id = ?`)
      .run(result.success ? 'completed' : 'failed', new Date().toISOString(), JSON.stringify(result), id);
  },

  listRuns(options: { limit?: number; serviceId?: string } = {}): Run[] {
    let sql = 'SELECT * FROM runs';
    const params: unknown[] = [];
    if (options.serviceId) { sql += ' WHERE service_id = ?'; params.push(options.serviceId); }
    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(options.limit ?? 20);
    return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToRun);
  },

  getRunById(id: string): Run | null {
    const row = getDb().prepare('SELECT * FROM runs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToRun(row) : null;
  },

  getLatestRun(serviceId: string, agentType: AgentType): Run | null {
    const row = getDb()
      .prepare('SELECT * FROM runs WHERE service_id = ? AND agent_type = ? ORDER BY started_at DESC LIMIT 1')
      .get(serviceId, agentType) as Record<string, unknown> | undefined;
    return row ? rowToRun(row) : null;
  },

  // ── Run Events ─────────────────────────────────────────────────────────────

  appendRunEvent(event: Omit<RunEvent, 'id' | 'createdAt'>): RunEvent {
    const full: RunEvent = { id: randomUUID(), createdAt: new Date().toISOString(), ...event };
    getDb()
      .prepare(`INSERT INTO run_events (id, run_id, type, data, seq, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(full.id, full.runId, full.type, JSON.stringify(full.data), full.seq, full.createdAt);
    return full;
  },

  getRunEvents(runId: string): RunEvent[] {
    return (
      getDb()
        .prepare('SELECT * FROM run_events WHERE run_id = ? ORDER BY seq ASC')
        .all(runId) as Record<string, unknown>[]
    ).map(rowToRunEvent);
  },

  // ── Vulnerabilities ───────────────────────────────────────────────────────────

  upsertVulnerabilities(
    serviceId: string,
    findings: Pick<Vulnerability, 'vulnId' | 'packageName' | 'severity' | 'title' | 'url'>[],
  ): { newIds: Set<string>; knownCount: number } {
    const now = new Date().toISOString();
    const newIds = new Set<string>();
    let knownCount = 0;

    for (const f of findings) {
      const existing = getDb()
        .prepare('SELECT id, status FROM vulnerabilities WHERE service_id = ? AND vuln_id = ?')
        .get(serviceId, f.vulnId) as { id: string; status: string } | undefined;

      if (existing) {
        getDb()
          .prepare(
            `UPDATE vulnerabilities
             SET last_seen_at = ?, status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
                 resolved_at = CASE WHEN status = 'resolved' THEN NULL ELSE resolved_at END,
                 severity = ?, title = ?
             WHERE id = ?`,
          )
          .run(now, f.severity, f.title, existing.id);
        knownCount++;
      } else {
        getDb()
          .prepare(
            `INSERT INTO vulnerabilities
             (id, service_id, vuln_id, package_name, severity, title, url, status, first_seen_at, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
          )
          .run(randomUUID(), serviceId, f.vulnId, f.packageName, f.severity, f.title, f.url, now, now);
        newIds.add(f.vulnId);
      }
    }

    // Mark previously-open vulns absent from this scan as resolved
    if (findings.length > 0) {
      const presentIds = findings.map((f) => f.vulnId);
      const placeholders = presentIds.map(() => '?').join(',');
      getDb()
        .prepare(
          `UPDATE vulnerabilities SET status = 'resolved', resolved_at = ?
           WHERE service_id = ? AND status != 'resolved' AND vuln_id NOT IN (${placeholders})`,
        )
        .run(now, serviceId, ...presentIds);
    } else {
      getDb()
        .prepare(
          `UPDATE vulnerabilities SET status = 'resolved', resolved_at = ?
           WHERE service_id = ? AND status != 'resolved'`,
        )
        .run(now, serviceId);
    }

    return { newIds, knownCount };
  },

  markVulnerabilityPRCreated(serviceId: string, vulnId: string, prUrl: string): void {
    getDb()
      .prepare(
        `UPDATE vulnerabilities SET status = 'pr_created', pr_url = ? WHERE service_id = ? AND vuln_id = ?`,
      )
      .run(prUrl, serviceId, vulnId);
  },

  listVulnerabilities(options: { serviceId?: string; status?: VulnStatus } = {}): Vulnerability[] {
    let sql = 'SELECT * FROM vulnerabilities';
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (options.serviceId) { clauses.push('service_id = ?'); params.push(options.serviceId); }
    if (options.status) { clauses.push('status = ?'); params.push(options.status); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY first_seen_at DESC';
    return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToVuln);
  },

  // ── Suppressions ──────────────────────────────────────────────────────────────

  createSuppression(params: Omit<Suppression, 'id' | 'createdAt'>): Suppression {
    const s: Suppression = { id: randomUUID(), createdAt: new Date().toISOString(), ...params };
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO suppressions (id, service_id, type, key, reason, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(s.id, s.serviceId, s.type, s.key, s.reason, s.expiresAt ?? null, s.createdAt);
    return s;
  },

  deleteSuppression(id: string): void {
    getDb().prepare('DELETE FROM suppressions WHERE id = ?').run(id);
  },

  isSuppressed(serviceId: string, type: SuppressionType, key: string): boolean {
    const now = new Date().toISOString();
    const row = getDb()
      .prepare(
        `SELECT id FROM suppressions
         WHERE service_id = ? AND type = ? AND key = ?
         AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(serviceId, type, key, now);
    return !!row;
  },

  listSuppressions(options: { serviceId?: string; type?: SuppressionType } = {}): Suppression[] {
    let sql = 'SELECT * FROM suppressions';
    const params: unknown[] = [];
    const clauses: string[] = [];
    if (options.serviceId) { clauses.push('service_id = ?'); params.push(options.serviceId); }
    if (options.type) { clauses.push('type = ?'); params.push(options.type); }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToSuppression);
  },

};

// ── Row mappers ────────────────────────────────────────────────────────────────

function rowToIncident(row: Record<string, unknown>): Incident {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    title: row.title as string,
    description: row.description as string,
    severity: row.severity as Incident['severity'],
    status: row.status as Incident['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
  };
}

function rowToRun(row: Record<string, unknown>): Run {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    agentType: row.agent_type as AgentType,
    status: row.status as Run['status'],
    triggeredBy: row.triggered_by as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? undefined,
    result: row.result ? JSON.parse(row.result as string) : undefined,
  };
}

function rowToRunEvent(row: Record<string, unknown>): RunEvent {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    type: row.type as RunEvent['type'],
    data: JSON.parse(row.data as string),
    seq: row.seq as number,
    createdAt: row.created_at as string,
  };
}

function rowToVuln(row: Record<string, unknown>): Vulnerability {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    vulnId: row.vuln_id as string,
    packageName: row.package_name as string,
    severity: row.severity as Vulnerability['severity'],
    title: row.title as string,
    url: row.url as string,
    status: row.status as VulnStatus,
    prUrl: (row.pr_url as string | null) ?? undefined,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? undefined,
  };
}

function rowToSuppression(row: Record<string, unknown>): Suppression {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    type: row.type as SuppressionType,
    key: row.key as string,
    reason: row.reason as string,
    expiresAt: (row.expires_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}
