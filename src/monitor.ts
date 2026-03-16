import { COMPANIES, DELAY_BETWEEN_COMPANIES_MS } from './config.js';
import {
  initDb,
  jobExists,
  companyHasJobs,
  insertJob,
  updateJobDescription,
  getStats,
} from './db.js';
import { passesFilter } from './filter.js';
import { fetchJobs, fetchJobDetail } from './greenhouse.js';
import { stripHtml } from './utils.js';

interface MatchInfo {
  title: string;
  location: string;
  url: string;
  company: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const db = initDb();
  const newMatches: MatchInfo[] = [];

  console.log('====================================================');
  console.log(`  Hire Signal — Job Monitor`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('====================================================\n');

  let totalNew = 0;
  let totalFiltered = 0;

  for (let i = 0; i < COMPANIES.length; i++) {
    const company = COMPANIES[i];

    if (i > 0) {
      await sleep(DELAY_BETWEEN_COMPANIES_MS);
    }

    const isSeedRun = company.visited && !companyHasJobs(db, company.boardId);
    const jobs = await fetchJobs(company.boardId);

    let newCount = 0;
    let matchCount = 0;

    for (const job of jobs) {
      const id = `greenhouse_${company.boardId}_${job.id}`;

      if (jobExists(db, id)) continue;

      const passes = passesFilter(job.title);
      newCount++;
      if (passes) matchCount++;

      insertJob(db, {
        id,
        greenhouse_id: job.id,
        company: company.name,
        board_id: company.boardId,
        title: job.title,
        location: job.location.name,
        url: job.absolute_url,
        description: null,
        posted_at: job.updated_at,
        first_seen_at: new Date().toISOString(),
        source: company.source,
        passed_filter: passes ? 1 : 0,
        is_seed: isSeedRun ? 1 : 0,
        score: null,
      });

      if (passes) {
        const detail = await fetchJobDetail(company.boardId, job.id);
        if (detail?.content) {
          const stripped = stripHtml(detail.content);
          updateJobDescription(db, id, stripped);
        }

        if (!isSeedRun) {
          newMatches.push({
            title: job.title,
            location: job.location.name,
            url: job.absolute_url,
            company: company.name,
          });
        }
      }
    }

    totalNew += newCount;
    totalFiltered += matchCount;

    const seedLabel = isSeedRun ? ' ✓ seed' : '';
    console.log(
      `  → ${company.name}: ${jobs.length} listed, ${newCount} new, ${matchCount} matched${seedLabel}`,
    );
  }

  console.log('');

  if (newMatches.length > 0) {
    console.log('────────────────────────────────────────────────────');
    console.log(`  🎯 New Matches (${newMatches.length})`);
    console.log('────────────────────────────────────────────────────');
    for (const m of newMatches) {
      console.log(`  ${m.company} — ${m.title}`);
      console.log(`    📍 ${m.location}`);
      console.log(`    🔗 ${m.url}`);
      console.log('');
    }
  } else {
    console.log('  😴 No new matches this run.');
    console.log('');
  }

  const stats = getStats(db);
  console.log('────────────────────────────────────────────────────');
  console.log(
    `  Total jobs: ${stats.total} | Matched: ${stats.filtered} | Seeded: ${stats.seeded}`,
  );
  console.log(`  This run: ${totalNew} new, ${totalFiltered} matched`);
  console.log('====================================================');

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
