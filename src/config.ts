export interface Company {
  name: string;
  id: string;
  visited: boolean;
}

export const COMPANIES: Company[] = [
  { name: 'Figma', id: 'figma', visited: true },
  { name: 'Airbnb', id: 'airbnb', visited: true },
  { name: 'Toast', id: 'toast', visited: true },
  { name: 'Headway', id: 'headway', visited: true },
  { name: 'Calendly', id: 'calendly', visited: true },
  { name: 'tvScientific', id: 'tvscientificpoweredbypinterest', visited: true },
  { name: 'OpenTable', id: 'opentable', visited: true },
  { name: 'Twilio', id: 'twilio', visited: true },
  { name: 'Alvys', id: 'alvys', visited: true },
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
