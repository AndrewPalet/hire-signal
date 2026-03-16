export interface Company {
  name: string;
  boardId: string;
  source: 'greenhouse';
  visited: boolean;
}

export const COMPANIES: Company[] = [
  { name: 'Stripe', boardId: 'stripe', source: 'greenhouse', visited: true },
  { name: 'Cloudflare', boardId: 'cloudflare', source: 'greenhouse', visited: true },
  { name: 'Figma', boardId: 'figma', source: 'greenhouse', visited: true },
  { name: 'Vercel', boardId: 'vercel', source: 'greenhouse', visited: true },
  { name: 'Datadog', boardId: 'datadog', source: 'greenhouse', visited: true },
];

export const INCLUDE_KEYWORDS: string[] = [
  'software engineer',
  'senior software',
  'staff engineer',
  'frontend engineer',
  'front-end engineer',
  'backend engineer',
  'back-end engineer',
  'fullstack engineer',
  'full-stack engineer',
  'full stack engineer',
  'web engineer',
  'platform engineer',
  'product engineer',
  'senior engineer',
  'typescript',
];

export const EXCLUDE_KEYWORDS: string[] = [
  'manager',
  'director',
  'intern',
  'co-op',
  'junior',
  'new grad',
  'machine learning',
  'ml engineer',
  'data scientist',
  'data engineer',
  'devops',
  'sre',
  'site reliability',
  'security engineer',
  'hardware',
  'embedded',
  'vp ',
  'principal',
];

export const GREENHOUSE_BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';
export const DELAY_BETWEEN_COMPANIES_MS = 1000;
export const DB_PATH = 'data/jobs.db';
