import Database from 'better-sqlite3';
import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH, DB_BACKEND, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } from './config.js';
import type { JobRow, ScoreResult, JobInput, DbStats } from './types.js';

export type { JobRow, ScoreResult, JobInput, DbStats };

export interface DatabaseAdapter {
  init(): Promise<void>;
  jobExists(id: string): Promise<boolean>;
  getJobIdsByCompany(companyId: string): Promise<Set<string>>;
  companyHasJobs(companyId: string): Promise<boolean>;
  insertJob(job: JobInput): Promise<void>;
  updateJobDescription(id: string, description: string): Promise<void>;
  getUnscoredJobs(limit?: number): Promise<JobRow[]>;
  saveJobScore(id: string, score: ScoreResult): Promise<void>;
  getNotifiableJobs(): Promise<JobRow[]>;
  markJobsNotified(ids: string[]): Promise<void>;
  markJobSeen(id: string): Promise<boolean>;
  setDiscordMessageId(jobIds: string[], messageId: string): Promise<void>;
  getStats(): Promise<DbStats>;
  close(): Promise<void>;
}

// ── Shared SQL ──────────────────────────────────────────────────────────

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    url TEXT NOT NULL,
    description TEXT,
    posted_at TEXT,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    passed_filter INTEGER NOT NULL DEFAULT 0,
    is_seed INTEGER NOT NULL DEFAULT 0,
    applied INTEGER DEFAULT 0,
    notified INTEGER DEFAULT 0
  );
`;

const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_passed_filter ON jobs(passed_filter);
  CREATE INDEX IF NOT EXISTS idx_jobs_is_seed ON jobs(is_seed);
`;

const SCORING_COLUMNS = [
  'role_fit_score INTEGER',
  'role_fit_reasoning TEXT',
  'location_score INTEGER',
  'location_reasoning TEXT',
  'stack_score INTEGER',
  'stack_reasoning TEXT',
  'comp_score INTEGER',
  'comp_reasoning TEXT',
  'overall_score INTEGER',
  'overall_reasoning TEXT',
  'dealbreaker TEXT',
  'scored_at TEXT',
  'seen_at TEXT',
  'discord_message_id TEXT',
];

// ── LocalDatabase (better-sqlite3) ─────────────────────────────────────

class LocalDatabase implements DatabaseAdapter {
  private db!: Database.Database;

  async init(): Promise<void> {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(CREATE_TABLE);
    this.db.exec(CREATE_INDEXES);
    this.runScoringMigration();
  }

  private runScoringMigration(): void {
    const existing = this.db
      .prepare('PRAGMA table_info(jobs)')
      .all()
      .map((col) => (col as { name: string }).name);

    for (const colDef of SCORING_COLUMNS) {
      const colName = colDef.split(' ')[0];
      if (!existing.includes(colName)) {
        this.db.exec(`ALTER TABLE jobs ADD COLUMN ${colDef}`);
      }
    }
  }

  async jobExists(id: string): Promise<boolean> {
    return this.db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id) !== undefined;
  }

  async getJobIdsByCompany(companyId: string): Promise<Set<string>> {
    const rows = this.db.prepare('SELECT id FROM jobs WHERE company_id = ?').all(companyId) as {
      id: string;
    }[];
    return new Set(rows.map((r) => r.id));
  }

  async companyHasJobs(companyId: string): Promise<boolean> {
    return this.db.prepare('SELECT 1 FROM jobs WHERE company_id = ?').get(companyId) !== undefined;
  }

  async insertJob(job: JobInput): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO jobs (
        id, external_id, company_name, company_id, title, location, url,
        description, posted_at, passed_filter, is_seed
      ) VALUES (
        @id, @external_id, @company_name, @company_id, @title, @location, @url,
        @description, @posted_at, @passed_filter, @is_seed
      )`,
      )
      .run(job);
  }

  async updateJobDescription(id: string, description: string): Promise<void> {
    this.db.prepare('UPDATE jobs SET description = ? WHERE id = ?').run(description, id);
  }

  async getUnscoredJobs(limit = 50): Promise<JobRow[]> {
    return this.db
      .prepare(
        `SELECT * FROM jobs
       WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL
       LIMIT ?`,
      )
      .all(limit) as JobRow[];
  }

  async saveJobScore(id: string, score: ScoreResult): Promise<void> {
    this.db
      .prepare(
        `UPDATE jobs SET
        role_fit_score = @role_fit_score,
        role_fit_reasoning = @role_fit_reasoning,
        location_score = @location_score,
        location_reasoning = @location_reasoning,
        stack_score = @stack_score,
        stack_reasoning = @stack_reasoning,
        comp_score = @comp_score,
        comp_reasoning = @comp_reasoning,
        overall_score = @overall_score,
        overall_reasoning = @overall_reasoning,
        dealbreaker = @dealbreaker,
        scored_at = datetime('now')
      WHERE id = @id`,
      )
      .run({ ...score, id });
  }

  async getNotifiableJobs(): Promise<JobRow[]> {
    return this.db
      .prepare(
        `SELECT * FROM jobs
       WHERE overall_score >= 7 AND notified = 0
       ORDER BY company_name, overall_score DESC`,
      )
      .all() as JobRow[];
  }

  async markJobsNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    this.db.prepare(`UPDATE jobs SET notified = 1 WHERE id IN (${placeholders})`).run(...ids);
  }

  async markJobSeen(id: string): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE jobs SET seen_at = datetime('now') WHERE id = ? AND seen_at IS NULL")
      .run(id);
    return result.changes > 0;
  }

  async setDiscordMessageId(jobIds: string[], messageId: string): Promise<void> {
    if (jobIds.length === 0) return;
    const placeholders = jobIds.map(() => '?').join(', ');
    this.db
      .prepare(`UPDATE jobs SET discord_message_id = ? WHERE id IN (${placeholders})`)
      .run(messageId, ...jobIds);
  }

  async getStats(): Promise<DbStats> {
    const total = (this.db.prepare('SELECT count(*) as c FROM jobs').get() as { c: number }).c;
    const filtered = (
      this.db.prepare('SELECT count(*) as c FROM jobs WHERE passed_filter = 1').get() as {
        c: number;
      }
    ).c;
    const seeded = (
      this.db.prepare('SELECT count(*) as c FROM jobs WHERE is_seed = 1').get() as { c: number }
    ).c;
    const scored = (
      this.db.prepare('SELECT count(*) as c FROM jobs WHERE scored_at IS NOT NULL').get() as {
        c: number;
      }
    ).c;
    return { total, filtered, seeded, scored };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// ── TursoDatabase (@libsql/client) ─────────────────────────────────────

class TursoDatabase implements DatabaseAdapter {
  private client!: Client;

  async init(): Promise<void> {
    if (!TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL is required when DB_BACKEND=turso');
    }
    this.client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN || undefined,
    });
    await this.client.executeMultiple(`${CREATE_TABLE}\n${CREATE_INDEXES}`);
    await this.runScoringMigration();
  }

  private async runScoringMigration(): Promise<void> {
    const result = await this.client.execute('PRAGMA table_info(jobs)');
    const existing = result.rows.map((row) => String(row.name));

    for (const colDef of SCORING_COLUMNS) {
      const colName = colDef.split(' ')[0];
      if (!existing.includes(colName)) {
        await this.client.execute(`ALTER TABLE jobs ADD COLUMN ${colDef}`);
      }
    }
  }

  async jobExists(id: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: 'SELECT 1 FROM jobs WHERE id = ?',
      args: [id],
    });
    return result.rows.length > 0;
  }

  async getJobIdsByCompany(companyId: string): Promise<Set<string>> {
    const result = await this.client.execute({
      sql: 'SELECT id FROM jobs WHERE company_id = ?',
      args: [companyId],
    });
    return new Set(result.rows.map((r) => String(r.id)));
  }

  async companyHasJobs(companyId: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: 'SELECT 1 FROM jobs WHERE company_id = ?',
      args: [companyId],
    });
    return result.rows.length > 0;
  }

  async insertJob(job: JobInput): Promise<void> {
    await this.client.execute({
      sql: `INSERT OR IGNORE INTO jobs (
        id, external_id, company_name, company_id, title, location, url,
        description, posted_at, passed_filter, is_seed
      ) VALUES (
        :id, :external_id, :company_name, :company_id, :title, :location, :url,
        :description, :posted_at, :passed_filter, :is_seed
      )`,
      args: {
        id: job.id,
        external_id: job.external_id,
        company_name: job.company_name,
        company_id: job.company_id,
        title: job.title,
        location: job.location,
        url: job.url,
        description: job.description,
        posted_at: job.posted_at,
        passed_filter: job.passed_filter,
        is_seed: job.is_seed,
      },
    });
  }

  async updateJobDescription(id: string, description: string): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE jobs SET description = ? WHERE id = ?',
      args: [description, id],
    });
  }

  async getUnscoredJobs(limit = 50): Promise<JobRow[]> {
    const result = await this.client.execute({
      sql: `SELECT * FROM jobs
       WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL
       LIMIT ?`,
      args: [limit],
    });
    return result.rows.map(rowToJobRow);
  }

  async saveJobScore(id: string, score: ScoreResult): Promise<void> {
    await this.client.execute({
      sql: `UPDATE jobs SET
        role_fit_score = :role_fit_score,
        role_fit_reasoning = :role_fit_reasoning,
        location_score = :location_score,
        location_reasoning = :location_reasoning,
        stack_score = :stack_score,
        stack_reasoning = :stack_reasoning,
        comp_score = :comp_score,
        comp_reasoning = :comp_reasoning,
        overall_score = :overall_score,
        overall_reasoning = :overall_reasoning,
        dealbreaker = :dealbreaker,
        scored_at = datetime('now')
      WHERE id = :id`,
      args: {
        id,
        role_fit_score: score.role_fit_score,
        role_fit_reasoning: score.role_fit_reasoning,
        location_score: score.location_score,
        location_reasoning: score.location_reasoning,
        stack_score: score.stack_score,
        stack_reasoning: score.stack_reasoning,
        comp_score: score.comp_score,
        comp_reasoning: score.comp_reasoning,
        overall_score: score.overall_score,
        overall_reasoning: score.overall_reasoning,
        dealbreaker: score.dealbreaker,
      },
    });
  }

  async getNotifiableJobs(): Promise<JobRow[]> {
    const result = await this.client.execute(
      `SELECT * FROM jobs
       WHERE overall_score >= 7 AND notified = 0
       ORDER BY company_name, overall_score DESC`,
    );
    return result.rows.map(rowToJobRow);
  }

  async markJobsNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    await this.client.execute({
      sql: `UPDATE jobs SET notified = 1 WHERE id IN (${placeholders})`,
      args: ids,
    });
  }

  async markJobSeen(id: string): Promise<boolean> {
    const result = await this.client.execute({
      sql: "UPDATE jobs SET seen_at = datetime('now') WHERE id = ? AND seen_at IS NULL",
      args: [id],
    });
    return result.rowsAffected > 0;
  }

  async setDiscordMessageId(jobIds: string[], messageId: string): Promise<void> {
    if (jobIds.length === 0) return;
    const placeholders = jobIds.map(() => '?').join(', ');
    await this.client.execute({
      sql: `UPDATE jobs SET discord_message_id = ? WHERE id IN (${placeholders})`,
      args: [messageId, ...jobIds],
    });
  }

  async getStats(): Promise<DbStats> {
    const [totalR, filteredR, seededR, scoredR] = await Promise.all([
      this.client.execute('SELECT count(*) as c FROM jobs'),
      this.client.execute('SELECT count(*) as c FROM jobs WHERE passed_filter = 1'),
      this.client.execute('SELECT count(*) as c FROM jobs WHERE is_seed = 1'),
      this.client.execute('SELECT count(*) as c FROM jobs WHERE scored_at IS NOT NULL'),
    ]);
    return {
      total: Number(totalR.rows[0].c),
      filtered: Number(filteredR.rows[0].c),
      seeded: Number(seededR.rows[0].c),
      scored: Number(scoredR.rows[0].c),
    };
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

// ── Row mapping helper ─────────────────────────────────────────────────

function rowToJobRow(row: Record<string, unknown>): JobRow {
  return {
    id: String(row.id),
    external_id: String(row.external_id),
    company_name: String(row.company_name),
    company_id: String(row.company_id),
    title: String(row.title),
    location: row.location == null ? null : String(row.location),
    url: String(row.url),
    description: row.description == null ? null : String(row.description),
    posted_at: row.posted_at == null ? null : String(row.posted_at),
    first_seen_at: row.first_seen_at == null ? undefined : String(row.first_seen_at),
    passed_filter: Number(row.passed_filter),
    is_seed: Number(row.is_seed),
    applied: Number(row.applied),
    notified: Number(row.notified),
    role_fit_score: row.role_fit_score == null ? null : Number(row.role_fit_score),
    role_fit_reasoning: row.role_fit_reasoning == null ? null : String(row.role_fit_reasoning),
    location_score: row.location_score == null ? null : Number(row.location_score),
    location_reasoning: row.location_reasoning == null ? null : String(row.location_reasoning),
    stack_score: row.stack_score == null ? null : Number(row.stack_score),
    stack_reasoning: row.stack_reasoning == null ? null : String(row.stack_reasoning),
    comp_score: row.comp_score == null ? null : Number(row.comp_score),
    comp_reasoning: row.comp_reasoning == null ? null : String(row.comp_reasoning),
    overall_score: row.overall_score == null ? null : Number(row.overall_score),
    overall_reasoning: row.overall_reasoning == null ? null : String(row.overall_reasoning),
    dealbreaker: row.dealbreaker == null ? null : String(row.dealbreaker),
    scored_at: row.scored_at == null ? null : String(row.scored_at),
    seen_at: row.seen_at == null ? null : String(row.seen_at),
    discord_message_id: row.discord_message_id == null ? null : String(row.discord_message_id),
  };
}

// ── Factory ────────────────────────────────────────────────────────────

export async function createDatabase(): Promise<DatabaseAdapter> {
  const db = DB_BACKEND === 'turso' ? new TursoDatabase() : new LocalDatabase();
  await db.init();
  return db;
}
