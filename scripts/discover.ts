/**
 * Discovery Script — Scan ATS slug lists and find companies with matching job titles.
 *
 * Reads slug JSONs from data/ats-slugs/, fetches each company's job board,
 * applies the existing title keyword filter, and outputs a ranked list of
 * companies worth adding to config.ts.
 *
 * Usage:
 *   npx tsx scripts/discover.ts                    # scan all platforms
 *   npx tsx scripts/discover.ts --platform ashby   # scan one platform
 *   npx tsx scripts/discover.ts --limit 500        # limit slugs per platform
 *   npx tsx scripts/discover.ts --us-only          # only companies with US/remote jobs
 *
 * Output: data/discovery-results.json + console summary
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pLimit from 'p-limit';
import { COMPANIES } from '../src/shared/config.js';
import { getFetcher } from '../src/ingest/fetcher.js';
import { passesFilter, isFreshEnough } from '../src/ingest/filter.js';
import type { AtsSource } from '../src/shared/config.js';

const CONCURRENCY = 20;
const SLUG_DIR = resolve('data/ats-slugs');
const OUTPUT_PATH = resolve('data/discovery-results.json');

// US location signals — if any of these appear in the location string, it's a US/remote job
const US_LOCATION_PATTERNS = [
  'remote',
  'united states',
  'usa',
  'u.s.',
  // States
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new hampshire',
  'new jersey',
  'new mexico',
  'new york',
  'north carolina',
  'north dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode island',
  'south carolina',
  'south dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west virginia',
  'wisconsin',
  'wyoming',
  // State abbreviations (with comma or space before to avoid false matches like "Main St")
  ', al',
  ', ak',
  ', az',
  ', ar',
  ', ca',
  ', co',
  ', ct',
  ', de',
  ', fl',
  ', ga',
  ', hi',
  ', id',
  ', il',
  ', in',
  ', ia',
  ', ks',
  ', ky',
  ', la',
  ', me',
  ', md',
  ', ma',
  ', mi',
  ', mn',
  ', ms',
  ', mo',
  ', mt',
  ', ne',
  ', nv',
  ', nh',
  ', nj',
  ', nm',
  ', ny',
  ', nc',
  ', nd',
  ', oh',
  ', ok',
  ', or',
  ', pa',
  ', ri',
  ', sc',
  ', sd',
  ', tn',
  ', tx',
  ', ut',
  ', vt',
  ', va',
  ', wa',
  ', wv',
  ', wi',
  ', wy',
  // Major US cities
  'san francisco',
  'new york city',
  'nyc',
  'los angeles',
  'chicago',
  'seattle',
  'austin',
  'boston',
  'denver',
  'dallas',
  'houston',
  'atlanta',
  'miami',
  'portland',
  'phoenix',
  'philadelphia',
  'san diego',
  'san jose',
  'minneapolis',
  'nashville',
  'raleigh',
  'salt lake',
  'pittsburgh',
  'charlotte',
  'detroit',
  'columbus',
  'indianapolis',
  'tampa',
  'orlando',
  'brooklyn',
  'manhattan',
  'palo alto',
  'mountain view',
  'menlo park',
  'sunnyvale',
  'cupertino',
  'redwood city',
  'santa monica',
  'venice',
  'arlington',
  'bethesda',
  'cambridge',
  'sf office',
  'sf, ca',
  'la office',
  'la, ca',
  'dc office',
  'nyc office',
];

function isUSLocation(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return US_LOCATION_PATTERNS.some((pattern) => lower.includes(pattern));
}

interface DiscoveryResult {
  slug: string;
  platform: AtsSource;
  totalJobs: number;
  matchingJobs: number;
  freshMatchingJobs: number;
  usMatchingJobs: number;
  matchingTitles: string[];
  error: string | null;
}

function loadSlugs(platform: AtsSource): string[] {
  const path = resolve(SLUG_DIR, `${platform}_companies.json`);
  return JSON.parse(readFileSync(path, 'utf-8')) as string[];
}

function getExistingSlugs(): Map<string, AtsSource> {
  const map = new Map<string, AtsSource>();
  for (const c of COMPANIES) {
    map.set(`${c.source}:${c.id}`, c.source);
  }
  return map;
}

async function scanCompany(slug: string, platform: AtsSource): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    slug,
    platform,
    totalJobs: 0,
    matchingJobs: 0,
    freshMatchingJobs: 0,
    usMatchingJobs: 0,
    matchingTitles: [],
    error: null,
  };

  try {
    const fetcher = getFetcher(platform);
    const listings = await fetcher.fetchListings(slug);
    result.totalJobs = listings.length;

    for (const listing of listings) {
      if (passesFilter(listing.title)) {
        result.matchingJobs++;
        const usJob = isUSLocation(listing.location);
        if (usJob) result.usMatchingJobs++;
        if (isFreshEnough(listing.postedAt)) {
          result.freshMatchingJobs++;
        }
        if (result.matchingTitles.length < 5) {
          const location = listing.location ? ` (${listing.location})` : '';
          result.matchingTitles.push(`${listing.title}${location}`);
        }
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const platformFlag = args.indexOf('--platform');
  const limitFlag = args.indexOf('--limit');
  const usOnly = args.includes('--us-only');

  const platforms: AtsSource[] =
    platformFlag !== -1 ? [args[platformFlag + 1] as AtsSource] : ['greenhouse', 'ashby', 'lever'];
  const slugLimit = limitFlag !== -1 ? parseInt(args[limitFlag + 1], 10) : Infinity;

  const existing = getExistingSlugs();
  const limit = pLimit(CONCURRENCY);

  console.log('====================================================');
  console.log('  Hire-Signal — Company Discovery Scan');
  console.log(`  Platforms: ${platforms.join(', ')}`);
  console.log(`  Slug limit per platform: ${slugLimit === Infinity ? 'none' : slugLimit}`);
  console.log(`  US/Remote only: ${usOnly}`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log('====================================================\n');

  const allResults: DiscoveryResult[] = [];

  for (const platform of platforms) {
    let slugs = loadSlugs(platform);

    // Exclude companies already in config
    const before = slugs.length;
    slugs = slugs.filter((s) => !existing.has(`${platform}:${s}`));
    const excluded = before - slugs.length;

    if (slugLimit < slugs.length) {
      slugs = slugs.slice(0, slugLimit);
    }

    console.log(
      `Scanning ${platform}: ${slugs.length} new slugs (${excluded} already in config, ${before} total)\n`,
    );

    let completed = 0;
    const results = await Promise.all(
      slugs.map((slug) =>
        limit(async () => {
          const r = await scanCompany(slug, platform);
          completed++;
          if (completed % 100 === 0) {
            console.log(`  ... ${completed}/${slugs.length} scanned`);
          }
          return r;
        }),
      ),
    );

    allResults.push(...results);

    const withMatches = results.filter((r) => r.matchingJobs > 0);
    const errors = results.filter((r) => r.error !== null);
    const empty = results.filter((r) => r.totalJobs === 0 && !r.error);
    console.log(
      `  Done: ${withMatches.length} with matches, ${empty.length} empty, ${errors.length} errors\n`,
    );
  }

  // Filter to companies that have at least 1 matching job
  const hits = allResults
    .filter((r) => {
      if (r.matchingJobs === 0) return false;
      if (usOnly && r.usMatchingJobs === 0) return false;
      return true;
    })
    .sort(
      (a, b) =>
        b.freshMatchingJobs - a.freshMatchingJobs ||
        b.usMatchingJobs - a.usMatchingJobs ||
        b.matchingJobs - a.matchingJobs,
    );

  // Write full results
  writeFileSync(OUTPUT_PATH, JSON.stringify(hits, null, 2));
  console.log(`\nWrote ${hits.length} results to ${OUTPUT_PATH}\n`);

  // Console summary — top 50
  console.log('════════════════════════════════════════════════════');
  console.log('  TOP DISCOVERIES (ranked by fresh matching jobs)');
  console.log('════════════════════════════════════════════════════\n');

  const top = hits.slice(0, 50);
  for (let i = 0; i < top.length; i++) {
    const r = top[i];
    console.log(
      `  [${i + 1}] ${r.slug} (${r.platform}) — ${r.freshMatchingJobs} fresh / ${r.usMatchingJobs} US / ${r.matchingJobs} matching / ${r.totalJobs} total`,
    );
    for (const title of r.matchingTitles) {
      console.log(`      • ${title}`);
    }
    console.log('');
  }

  console.log('════════════════════════════════════════════════════');
  console.log(`  Total companies scanned: ${allResults.length}`);
  console.log(`  Companies with matching jobs: ${hits.length}`);
  console.log(`  Companies with US/remote matches: ${hits.filter((r) => r.usMatchingJobs > 0).length}`);
  console.log(`  Companies with fresh matches: ${hits.filter((r) => r.freshMatchingJobs > 0).length}`);
  console.log('════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
