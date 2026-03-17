export interface Company {
  name: string;
  id: string;
  seed: boolean;
}

export const COMPANIES: Company[] = [
  { name: 'Figma', id: 'figma', seed: true },
  { name: 'Airbnb', id: 'airbnb', seed: true },
  { name: 'Toast', id: 'toast', seed: true },
  { name: 'Headway', id: 'headway', seed: true },
  { name: 'Calendly', id: 'calendly', seed: true },
  { name: 'tvScientific', id: 'tvscientificpoweredbypinterest', seed: true },
  { name: 'OpenTable', id: 'opentable', seed: true },
  { name: 'Twilio', id: 'twilio', seed: true },
  { name: 'Alvys', id: 'alvys', seed: true },
  { name: 'Rocket Money', id: 'truebill', seed: false },
  { name: 'Stripe', id: 'stripe', seed: false },
  { name: 'Coinbase', id: 'coinbase', seed: false },
  { name: 'Mercury', id: 'mercury', seed: false },
  { name: 'Kalshi', id: 'kalshi', seed: false },
  { name: 'Webflow', id: 'webflow', seed: false },
  { name: 'Descript', id: 'descript', seed: false },
  { name: 'Gusto', id: 'gusto', seed: false },
  { name: 'Postman', id: 'postman', seed: false },
  { name: 'Metronome', id: 'metronome', seed: false },
  { name: 'PagerDuty', id: 'pagerduty', seed: false },
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
