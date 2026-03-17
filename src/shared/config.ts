export type AtsSource = 'greenhouse' | 'ashby' | 'lever';

export interface Company {
  name: string;
  id: string;
  seed: boolean;
  source: AtsSource;
}

export const COMPANIES: Company[] = [
  { name: 'Figma', id: 'figma', seed: true, source: 'greenhouse' },
  { name: 'Airbnb', id: 'airbnb', seed: true, source: 'greenhouse' },
  { name: 'Toast', id: 'toast', seed: true, source: 'greenhouse' },
  { name: 'Headway', id: 'headway', seed: true, source: 'greenhouse' },
  { name: 'Calendly', id: 'calendly', seed: true, source: 'greenhouse' },
  { name: 'tvScientific', id: 'tvscientificpoweredbypinterest', seed: true, source: 'greenhouse' },
  { name: 'OpenTable', id: 'opentable', seed: true, source: 'greenhouse' },
  { name: 'Twilio', id: 'twilio', seed: true, source: 'greenhouse' },
  { name: 'Alvys', id: 'alvys', seed: true, source: 'greenhouse' },
  { name: 'Rocket Money', id: 'truebill', seed: false, source: 'greenhouse' },
  { name: 'Stripe', id: 'stripe', seed: false, source: 'greenhouse' },
  { name: 'Coinbase', id: 'coinbase', seed: false, source: 'greenhouse' },
  { name: 'Mercury', id: 'mercury', seed: false, source: 'greenhouse' },
  { name: 'Kalshi', id: 'kalshi', seed: false, source: 'greenhouse' },
  { name: 'Webflow', id: 'webflow', seed: false, source: 'greenhouse' },
  { name: 'Descript', id: 'descript', seed: false, source: 'greenhouse' },
  { name: 'Gusto', id: 'gusto', seed: false, source: 'greenhouse' },
  { name: 'Postman', id: 'postman', seed: false, source: 'greenhouse' },
  { name: 'Metronome', id: 'metronome', seed: false, source: 'greenhouse' },
  { name: 'PagerDuty', id: 'pagerduty', seed: false, source: 'greenhouse' },
  { name: 'Notion', id: 'notion', seed: false, source: 'ashby' },
  { name: 'Ramp', id: 'ramp', seed: false, source: 'ashby' },
  { name: 'Linear', id: 'linear', seed: false, source: 'ashby' },
  { name: 'Plaid', id: 'plaid', seed: false, source: 'ashby' },
  { name: 'Metabase', id: 'metabase', seed: false, source: 'lever' },
];

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
export const DELAY_BETWEEN_COMPANIES_MS = 1000;
export const DB_PATH = 'data/jobs.db';

export const SCORING_MODEL = 'claude-sonnet-4-20250514';
export const SCORING_THRESHOLD = 7;
export const SCORING_BRIEF_PATH = 'profile/scoring-brief.md';

export const NOTIFICATION_THRESHOLD = 7;

export const DISCORD_ERROR_WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL ?? '';

export const DB_BACKEND = (process.env.DB_BACKEND ?? 'local') as 'local' | 'turso';
export const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? '';
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';
