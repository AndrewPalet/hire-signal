import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type AtsSource = 'greenhouse' | 'ashby' | 'lever';

export interface Company {
  name: string;
  id: string;
  seed: boolean;
  source: AtsSource;
  sector?: string;
}

const COMPANIES_PATH = resolve(import.meta.dirname ?? '.', '../../config/companies.json');

export const COMPANIES: Company[] = JSON.parse(readFileSync(COMPANIES_PATH, 'utf-8'));

export const INCLUDE_KEYWORDS: string[] = [
  'software engineer',
  'senior software',
  'staff engineer',
  'senior engineer',
  'frontend',
  'front-end',
  'front end',
  'full stack',
  'fullstack',
  'full-stack',
  'product engineer',
  'mobile engineer',
  'react',
  'typescript',
  'node',
  'platform engineer',
  'ui engineer',
  'web engineer',
];

export const EXCLUDE_KEYWORDS: string[] = [
  'data scientist',
  'data engineer',
  'ml engineer',
  'machine learning',
  'qa',
  'quality assurance',
  'sdet',
  'test engineer',
  'manager',
  'director',
  'vp ',
  'head of',
  'designer',
  'devops',
  'sre',
  'site reliability',
  'intern',
  'internship',
  'apprentice',
  'new grad',
  'early career',
];

export const GREENHOUSE_BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';
export const ASHBY_BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';
export const LEVER_BASE_URL = 'https://jobs.lever.co/v0/postings';
export const DB_PATH = 'data/jobs.db';

export const SCORING_MODEL = 'claude-sonnet-4-20250514';
export const SCORING_THRESHOLD = 7;
export const SCORING_BRIEF_PATH = 'profile/scoring-brief.md';

export const NOTIFICATION_THRESHOLD = 7;

export const STALENESS_THRESHOLD_DAYS = 14;
export const DESCRIPTION_PRUNE_DAYS = 30;
export const ARCHIVE_DAYS = 90;

export const DISCORD_ERROR_WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL ?? '';
export const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? '';
export const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID ?? '';

export const DB_BACKEND = (process.env.DB_BACKEND ?? 'local') as 'local' | 'turso';
export const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? '';
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';
