export type AtsSource = 'greenhouse' | 'ashby' | 'lever';

export interface Company {
  name: string;
  id: string;
  seed: boolean;
  source: AtsSource;
}

export const COMPANIES: Company[] = [
  // Crypto / Web3
  { name: 'Coinbase', id: 'coinbase', seed: false, source: 'greenhouse' },
  { name: 'CoinTracker', id: 'cointracker', seed: false, source: 'ashby' },
  { name: 'MetaMask', id: 'consensys', seed: true, source: 'greenhouse' },
  { name: 'Phantom', id: 'phantom', seed: false, source: 'ashby' },
  { name: 'Alchemy', id: 'alchemy', seed: false, source: 'greenhouse' },
  { name: 'BitGo', id: 'bitgo', seed: false, source: 'greenhouse' },
  { name: 'Chainalysis', id: 'chainalysis-careers', seed: false, source: 'ashby' },
  { name: 'Fireblocks', id: 'fireblocks', seed: false, source: 'greenhouse' },
  { name: 'Blockchain.com', id: 'blockchain', seed: false, source: 'greenhouse' },
  { name: 'Messari', id: 'messari', seed: false, source: 'greenhouse' },
  { name: 'LayerZero Labs', id: 'layerzerolabs', seed: false, source: 'greenhouse' },
  { name: 'Kraken', id: 'kraken.com', seed: false, source: 'ashby' },
  { name: 'Uniswap Labs', id: 'uniswap', seed: false, source: 'ashby' },
  { name: 'Backpack', id: 'backpack', seed: false, source: 'ashby' },
  { name: 'Trust Wallet', id: 'trust-wallet', seed: false, source: 'ashby' },
  { name: 'Rain', id: 'rain', seed: false, source: 'ashby' },
  { name: 'Crypto.com', id: 'crypto', seed: false, source: 'lever' },
  { name: 'Offchain Labs', id: 'offchainlabs', seed: false, source: 'lever' },

  // Payments / Banking
  { name: 'Stripe', id: 'stripe', seed: false, source: 'greenhouse' },
  { name: 'Mercury', id: 'mercury', seed: false, source: 'greenhouse' },
  { name: 'Ramp', id: 'ramp', seed: false, source: 'ashby' },
  { name: 'Brex', id: 'brex', seed: false, source: 'greenhouse' },
  { name: 'Plaid', id: 'plaid', seed: false, source: 'ashby' },
  { name: 'Finix', id: 'finix', seed: false, source: 'lever' },
  { name: 'Stytch', id: 'stytch', seed: false, source: 'ashby' },

  // Consumer Finance
  { name: 'Robinhood', id: 'robinhood', seed: false, source: 'greenhouse' },
  { name: 'Betterment', id: 'betterment', seed: false, source: 'greenhouse' },
  { name: 'Wealthfront', id: 'wealthfront', seed: false, source: 'lever' },
  { name: 'Affirm', id: 'affirm', seed: false, source: 'greenhouse' },
  { name: 'Rocket Money', id: 'truebill', seed: false, source: 'greenhouse' },
  { name: 'Greenlight', id: 'greenlight', seed: false, source: 'lever' },
  { name: 'NerdWallet', id: 'nerdwallet', seed: false, source: 'ashby' },
  { name: 'OnePay', id: 'oneapp', seed: false, source: 'ashby' },

  // Real Estate / PropTech
  { name: 'Baselane', id: 'baselane', seed: false, source: 'lever' },
  { name: 'Wealth.com', id: 'wealth-com', seed: false, source: 'ashby' },

  // Predictions / Gambling
  { name: 'Kalshi', id: 'kalshi', seed: false, source: 'greenhouse' },
  { name: 'Polymarket', id: 'polymarket', seed: false, source: 'ashby' },
  { name: 'FanDuel', id: 'fanduel', seed: false, source: 'greenhouse' },
  { name: 'PrizePicks', id: 'prizepicks', seed: false, source: 'greenhouse' },
  { name: 'Underdog Fantasy', id: 'underdogfantasy', seed: false, source: 'greenhouse' },
  { name: 'Sleeper', id: 'sleeper', seed: false, source: 'ashby' },
  { name: 'Fliff', id: 'Fliff', seed: false, source: 'lever' },

  // Design / Productivity
  { name: 'Figma', id: 'figma', seed: true, source: 'greenhouse' },
  { name: 'Notion', id: 'notion', seed: false, source: 'ashby' },
  { name: 'Linear', id: 'linear', seed: false, source: 'ashby' },
  { name: 'Webflow', id: 'webflow', seed: false, source: 'greenhouse' },
  { name: 'Descript', id: 'descript', seed: false, source: 'greenhouse' },
  { name: 'Calendly', id: 'calendly', seed: true, source: 'greenhouse' },
  { name: 'Metabase', id: 'metabase', seed: false, source: 'lever' },

  // Consumer / Marketplace
  { name: 'Airbnb', id: 'airbnb', seed: true, source: 'greenhouse' },
  { name: 'OpenTable', id: 'opentable', seed: true, source: 'greenhouse' },
  { name: 'Toast', id: 'toast', seed: true, source: 'greenhouse' },
  { name: 'Postman', id: 'postman', seed: false, source: 'greenhouse' },

  // Infrastructure / Platform
  { name: '1Password', id: '1password', seed: false, source: 'ashby' },
  { name: 'Twilio', id: 'twilio', seed: true, source: 'greenhouse' },
  { name: 'PagerDuty', id: 'pagerduty', seed: false, source: 'greenhouse' },
  { name: 'Deepgram', id: 'deepgram', seed: false, source: 'ashby' },
  { name: 'Gusto', id: 'gusto', seed: false, source: 'greenhouse' },
  { name: 'Headway', id: 'headway', seed: true, source: 'greenhouse' },
  { name: 'Metronome', id: 'metronome', seed: false, source: 'greenhouse' },
  { name: 'Lattice', id: 'lattice', seed: false, source: 'greenhouse' },

  // Other
  { name: 'tvScientific', id: 'tvscientificpoweredbypinterest', seed: true, source: 'greenhouse' },
  { name: 'Alvys', id: 'alvys', seed: true, source: 'greenhouse' },
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
export const DB_PATH = 'data/jobs.db';

export const SCORING_MODEL = 'claude-sonnet-4-20250514';
export const SCORING_THRESHOLD = 7;
export const SCORING_BRIEF_PATH = 'profile/scoring-brief.md';

export const NOTIFICATION_THRESHOLD = 7;

export const DISCORD_ERROR_WEBHOOK_URL = process.env.DISCORD_ERROR_WEBHOOK_URL ?? '';

export const DB_BACKEND = (process.env.DB_BACKEND ?? 'local') as 'local' | 'turso';
export const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? '';
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';
