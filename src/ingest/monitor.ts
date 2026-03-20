import 'dotenv/config';
import pLimit from 'p-limit';
import { COMPANIES, type Company } from '../shared/config.js';
import { createDatabase, type DatabaseAdapter } from '../shared/db.js';
import { passesFilter } from './filter.js';
import { getFetcher } from './fetcher.js';

const CONCURRENCY = 15;

interface MatchInfo {
  title: string;
  location: string;
  postedAt: string;
  url: string;
  company: string;
}

interface CompanyResult {
  company: Company;
  listings: number;
  alreadySeen: number;
  newFiltered: number;
  newMatched: number;
  seeded: number;
  isSeedRun: boolean;
  matches: MatchInfo[];
  error: string | null;
}

async function processCompany(company: Company, db: DatabaseAdapter): Promise<CompanyResult> {
  const result: CompanyResult = {
    company,
    listings: 0,
    alreadySeen: 0,
    newFiltered: 0,
    newMatched: 0,
    seeded: 0,
    isSeedRun: false,
    matches: [],
    error: null,
  };

  try {
    const fetcher = getFetcher(company.source);
    result.isSeedRun = company.seed && !(await db.companyHasJobs(company.id));
    const [listings, knownIds] = await Promise.all([
      fetcher.fetchListings(company.id),
      db.getJobIdsByCompany(company.id),
    ]);
    result.listings = listings.length;

    for (const listing of listings) {
      const id = `${company.source}_${company.id}_${listing.externalId}`;

      if (knownIds.has(id)) {
        result.alreadySeen++;
        continue;
      }

      const passes = passesFilter(listing.title);

      await db.insertJob({
        id,
        external_id: listing.externalId,
        company_name: company.name,
        company_id: company.id,
        title: listing.title,
        location: listing.location,
        url: listing.url,
        description: null,
        posted_at: listing.postedAt,
        passed_filter: passes ? 1 : 0,
        is_seed: result.isSeedRun ? 1 : 0,
      });

      if (passes) {
        result.newMatched++;
        const description =
          listing.description ?? (await fetcher.fetchDescription(company.id, listing.externalId));
        if (description) {
          await db.updateJobDescription(id, description);
        }

        if (!result.isSeedRun) {
          result.matches.push({
            title: listing.title,
            location: listing.location ?? '',
            postedAt: listing.postedAt ?? '',
            url: listing.url,
            company: company.name,
          });
        }
      } else {
        result.newFiltered++;
      }

      if (result.isSeedRun) {
        result.seeded++;
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

async function main() {
  const db = await createDatabase();
  const limit = pLimit(CONCURRENCY);

  const runTime = new Date().toISOString();
  console.log('====================================================');
  console.log(`  Hire-Signal - Job Monitor Run: ${runTime}`);
  console.log(`  Concurrency: ${CONCURRENCY} companies in parallel`);
  console.log('====================================================\n');

  const results = await Promise.all(
    COMPANIES.map((company) => limit(() => processCompany(company, db))),
  );

  let totalSeeded = 0;
  let totalAlreadySeen = 0;
  let totalNewFiltered = 0;
  let totalNewMatched = 0;
  let seedCompanyCount = 0;
  const allMatches: MatchInfo[] = [];

  for (const r of results) {
    const seedLabel = r.isSeedRun ? ' — seed run' : '';
    const errorLabel = r.error ? ` ⚠ ERROR: ${r.error}` : '';
    console.log(`→ ${r.company.name} (${r.company.id})${seedLabel}${errorLabel}`);
    console.log(`  Found ${r.listings} total listings`);

    if (r.isSeedRun) {
      console.log(`  ✓ Seeded ${r.seeded} jobs (skipping scoring)`);
      totalSeeded += r.seeded;
      seedCompanyCount++;
    } else {
      console.log(`  ✓ ${r.newMatched} new match, ${r.newFiltered} filtered out`);
      totalNewMatched += r.newMatched;
      totalNewFiltered += r.newFiltered;
    }

    totalAlreadySeen += r.alreadySeen;
    allMatches.push(...r.matches);
    console.log('');
  }

  console.log('────────────────────────────────────────────────────\n');

  if (allMatches.length > 0) {
    console.log(`🎯 Found ${allMatches.length} new job(s) matching your filters:\n`);
    for (let i = 0; i < allMatches.length; i++) {
      const m = allMatches[i];
      console.log(`  [${i + 1}] ${m.company} — ${m.title}`);
      console.log(`      Location: ${m.location}`);
      console.log(`      Posted:   ${m.postedAt}`);
      console.log(`      URL:      ${m.url}`);
      console.log('');
    }
  } else if (totalSeeded > 0) {
    console.log(`😴 No new matching jobs since last run.`);
    console.log(`   (First run seeded ${seedCompanyCount} visited companies)\n`);
  } else {
    console.log('😴 No new matching jobs since last run.\n');
  }

  const stats = await db.getStats();

  console.log('────────────────────────────────────────────────────');
  if (totalSeeded > 0) {
    console.log(`  Seeded:             ${totalSeeded} jobs (visited companies, first run)`);
  }
  console.log(`  Already seen:       ${totalAlreadySeen}`);
  console.log(`  New (filtered out): ${totalNewFiltered}`);
  console.log(`  New (matched):      ${totalNewMatched}`);
  console.log(`  DB total:           ${stats.total} jobs tracked`);
  console.log(
    `  DB filtered:        ${stats.filtered} passed filter${totalSeeded > 0 ? ' (all seeded)' : ''}`,
  );
  console.log('====================================================');

  await db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
