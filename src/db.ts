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

export function getStats(db: Database.Database): {
  total: number;
  filtered: number;
  seeded: number;
} {
  const total = (db.prepare('SELECT count(*) as c FROM jobs').get() as { c: number }).c;
  const filtered = (
    db.prepare('SELECT count(*) as c FROM jobs WHERE passed_filter = 1').get() as { c: number }
  ).c;
  const seeded = (
    db.prepare('SELECT count(*) as c FROM jobs WHERE is_seed = 1').get() as { c: number }
  ).c;
  return { total, filtered, seeded };
}
