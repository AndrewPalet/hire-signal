import 'dotenv/config';
import { COMPANIES, DELAY_BETWEEN_COMPANIES_MS } from '../shared/config.js';
import { createDatabase } from '../shared/db.js';
import { passesFilter } from './filter.js';
import { fetchJobs, fetchJobDetail } from './greenhouse.js';
import { stripHtml } from '../shared/utils.js';

interface MatchInfo {
  title: string;
  location: string;
  postedAt: string;
  url: string;
  company: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const db = await createDatabase();
  const newMatches: MatchInfo[] = [];

  const runTime = new Date().toISOString();
  console.log('====================================================');
  console.log(`  Hire-Signal - Job Monitor Run: ${runTime}`);
  console.log('====================================================\n');

  let totalSeeded = 0;
  let totalAlreadySeen = 0;
  let totalNewFiltered = 0;
  let totalNewMatched = 0;
  let seedCompanyCount = 0;

  for (let i = 0; i < COMPANIES.length; i++) {
    const company = COMPANIES[i];

    if (i > 0) {
      await sleep(DELAY_BETWEEN_COMPANIES_MS);
    }

    const isSeedRun = company.visited && !(await db.companyHasJobs(company.id));
    const jobs = await fetchJobs(company.id);

    const seedLabel = isSeedRun ? ' — seed run' : '';
    console.log(`→ ${company.name} (${company.id}) [visited${seedLabel}]`);
    console.log(`  Found ${jobs.length} total listings`);

    let newCount = 0;
    let matchCount = 0;
    let alreadySeen = 0;

    for (const job of jobs) {
      const id = `greenhouse_${company.id}_${job.id}`;

      if (await db.jobExists(id)) {
        alreadySeen++;
        continue;
      }

      const passes = passesFilter(job.title);
      newCount++;
      if (passes) matchCount++;

      await db.insertJob({
        id,
        external_id: job.id,
        company_name: company.name,
        company_id: company.id,
        title: job.title,
        location: job.location.name,
        url: job.absolute_url,
        description: null,
        posted_at: job.updated_at,
        passed_filter: passes ? 1 : 0,
        is_seed: isSeedRun ? 1 : 0,
      });

      if (passes) {
        const detail = await fetchJobDetail(company.id, job.id);
        if (detail?.content) {
          const stripped = stripHtml(detail.content);
          await db.updateJobDescription(id, stripped);
        }

        if (!isSeedRun) {
          newMatches.push({
            title: job.title,
            location: job.location.name,
            postedAt: job.updated_at,
            url: job.absolute_url,
            company: company.name,
          });
        }
      }
    }

    if (isSeedRun) {
      console.log(`  ✓ Seeded ${newCount} jobs (skipping scoring)`);
      totalSeeded += newCount;
      seedCompanyCount++;
    } else {
      console.log(`  ✓ ${matchCount} new match, ${newCount - matchCount} filtered out`);
      totalNewMatched += matchCount;
      totalNewFiltered += newCount - matchCount;
    }

    totalAlreadySeen += alreadySeen;
    console.log('');
  }

  console.log('────────────────────────────────────────────────────\n');

  if (newMatches.length > 0) {
    console.log(`🎯 Found ${newMatches.length} new job(s) matching your filters:\n`);
    for (let i = 0; i < newMatches.length; i++) {
      const m = newMatches[i];
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
