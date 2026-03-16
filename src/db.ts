import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './config.js';

export interface JobRow {
  id: string;
  external_id: number;
  company_name: string;
  company_id: string;
  title: string;
  location: string | null;
  url: string;
  description: string | null;
  posted_at: string | null;
  first_seen_at?: string;
  passed_filter: number;
  is_seed: number;
  applied: number;
  notified: number;
  location_score?: number | null;
  location_reasoning?: string | null;
  stack_score?: number | null;
  stack_reasoning?: string | null;
  comp_score?: number | null;
  comp_reasoning?: string | null;
  overall_score?: number | null;
  overall_reasoning?: string | null;
  dealbreaker?: string | null;
  scored_at?: string | null;
}

export interface ScoreResult {
  location_score: number;
  location_reasoning: string;
  stack_score: number;
  stack_reasoning: string;
  comp_score: number;
  comp_reasoning: string;
  overall_score: number;
  overall_reasoning: string;
  dealbreaker: string | null;
}

const SCORING_COLUMNS = [
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
];

function runScoringMigration(db: Database.Database): void {
  const existing = db
    .prepare('PRAGMA table_info(jobs)')
    .all()
    .map((col) => (col as { name: string }).name);

  for (const colDef of SCORING_COLUMNS) {
    const colName = colDef.split(' ')[0];
    if (!existing.includes(colName)) {
      db.exec(`ALTER TABLE jobs ADD COLUMN ${colDef}`);
    }
  }
}

export function initDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      external_id INTEGER NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_passed_filter ON jobs(passed_filter);
    CREATE INDEX IF NOT EXISTS idx_jobs_is_seed ON jobs(is_seed);
  `);

  runScoringMigration(db);

  return db;
}

export function jobExists(db: Database.Database, id: string): boolean {
  const row = db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
  return row !== undefined;
}

export function companyHasJobs(db: Database.Database, companyId: string): boolean {
  const row = db.prepare('SELECT 1 FROM jobs WHERE company_id = ?').get(companyId);
  return row !== undefined;
}

export function insertJob(
  db: Database.Database,
  job: Omit<JobRow, 'first_seen_at' | 'applied' | 'notified'>,
): void {
  db.prepare(
    `
    INSERT OR IGNORE INTO jobs (
      id, external_id, company_name, company_id, title, location, url,
      description, posted_at, passed_filter, is_seed
    ) VALUES (
      @id, @external_id, @company_name, @company_id, @title, @location, @url,
      @description, @posted_at, @passed_filter, @is_seed
    )
  `,
  ).run(job);
}

export function updateJobDescription(db: Database.Database, id: string, description: string): void {
  db.prepare('UPDATE jobs SET description = ? WHERE id = ?').run(description, id);
}

export function getUnscoredJobs(db: Database.Database, limit = 50): JobRow[] {
  return db
    .prepare(
      `SELECT * FROM jobs
       WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL
       LIMIT ?`,
    )
    .all(limit) as JobRow[];
}

export function saveJobScore(db: Database.Database, jobId: string, score: ScoreResult): void {
  db.prepare(
    `UPDATE jobs SET
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
  ).run({ ...score, id: jobId });
}

export function getNotifiableJobs(db: Database.Database): JobRow[] {
  return db
    .prepare(
      `SELECT * FROM jobs
       WHERE overall_score >= 7 AND notified = 0
       ORDER BY company_name, overall_score DESC`,
    )
    .all() as JobRow[];
}

export function markJobsNotified(db: Database.Database, jobIds: string[]): void {
  if (jobIds.length === 0) return;
  const placeholders = jobIds.map(() => '?').join(', ');
  db.prepare(`UPDATE jobs SET notified = 1 WHERE id IN (${placeholders})`).run(...jobIds);
}

export function getStats(db: Database.Database): {
  total: number;
  filtered: number;
  seeded: number;
  scored: number;
} {
  const total = (db.prepare('SELECT count(*) as c FROM jobs').get() as { c: number }).c;
  const filtered = (
    db.prepare('SELECT count(*) as c FROM jobs WHERE passed_filter = 1').get() as { c: number }
  ).c;
  const seeded = (
    db.prepare('SELECT count(*) as c FROM jobs WHERE is_seed = 1').get() as { c: number }
  ).c;
  const scored = (
    db.prepare('SELECT count(*) as c FROM jobs WHERE scored_at IS NOT NULL').get() as { c: number }
  ).c;
  return { total, filtered, seeded, scored };
}
