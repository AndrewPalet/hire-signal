import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './config.js';

export interface JobRow {
  id: string;
  greenhouse_id: number;
  company: string;
  board_id: string;
  title: string;
  location: string;
  url: string;
  description: string | null;
  posted_at: string;
  first_seen_at: string;
  source: string;
  passed_filter: number;
  is_seed: number;
  score: number | null;
}

export function initDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      greenhouse_id INTEGER NOT NULL,
      company TEXT NOT NULL,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      posted_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      source TEXT NOT NULL,
      passed_filter INTEGER NOT NULL DEFAULT 0,
      is_seed INTEGER NOT NULL DEFAULT 0,
      score REAL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
    CREATE INDEX IF NOT EXISTS idx_jobs_passed_filter ON jobs(passed_filter);
    CREATE INDEX IF NOT EXISTS idx_jobs_is_seed ON jobs(is_seed);
  `);

  return db;
}

export function jobExists(db: Database.Database, id: string): boolean {
  const row = db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
  return row !== undefined;
}

export function companyHasJobs(db: Database.Database, boardId: string): boolean {
  const row = db.prepare('SELECT 1 FROM jobs WHERE board_id = ?').get(boardId);
  return row !== undefined;
}

export function insertJob(db: Database.Database, job: JobRow): void {
  db.prepare(
    `
    INSERT OR IGNORE INTO jobs (
      id, greenhouse_id, company, board_id, title, location, url,
      description, posted_at, first_seen_at, source, passed_filter, is_seed, score
    ) VALUES (
      @id, @greenhouse_id, @company, @board_id, @title, @location, @url,
      @description, @posted_at, @first_seen_at, @source, @passed_filter, @is_seed, @score
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
