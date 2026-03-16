import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { SCORING_MODEL, SCORING_THRESHOLD } from '../shared/config.js';
import { createDatabase } from '../shared/db.js';
import { scoreJob } from './claude.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY. Set it in your .env file.');
    console.error('See .env.example for the expected format.');
    process.exit(1);
  }

  const client = new Anthropic();
  const db = await createDatabase();
  const jobs = await db.getUnscoredJobs();

  const runTime = new Date().toISOString();
  console.log('====================================================');
  console.log(`  Job Scorer Run: ${runTime}`);
  console.log(`  Model: ${SCORING_MODEL}`);
  console.log(`  Unscored jobs: ${jobs.length}`);
  console.log('====================================================\n');

  if (jobs.length === 0) {
    console.log('  No unscored jobs found. Nothing to do.');
    await db.close();
    return;
  }

  let scored = 0;
  let highScoreCount = 0;
  let dealbreakers = 0;
  let errors = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    if (i > 0) {
      await sleep(1000);
    }

    try {
      const result = await scoreJob(client, job);
      await db.saveJobScore(job.id, result);
      scored++;

      if (result.overall_score >= SCORING_THRESHOLD) highScoreCount++;
      if (result.dealbreaker) dealbreakers++;

      console.log(`  [${i + 1}] ${job.company_name} — ${job.title}`);
      console.log(
        `      Fit: ${result.role_fit_score}  |  Location: ${result.location_score}  |  Stack: ${result.stack_score}  |  Comp: ${result.comp_score}  |  Overall: ${result.overall_score}`,
      );
      if (result.dealbreaker) {
        console.log(`      ⚠ DEALBREAKER: ${result.dealbreaker}`);
      } else {
        console.log(`      "${result.overall_reasoning}"`);
      }
      console.log('');
    } catch (err) {
      errors++;
      console.log(`  [${i + 1}] ${job.company_name} — ${job.title}`);
      console.log(`      ✗ ERROR: ${err instanceof Error ? err.message : String(err)}`);
      console.log('');
    }
  }

  const stats = await db.getStats();

  console.log('────────────────────────────────────────────────────');
  console.log(`  Scored:        ${scored} jobs`);
  console.log(`  Score ${SCORING_THRESHOLD}+:       ${highScoreCount} jobs (notification-ready)`);
  console.log(`  Dealbreakers:  ${dealbreakers} jobs`);
  console.log(`  Skipped (err): ${errors} jobs`);
  console.log(`  DB total scored: ${stats.scored}`);
  console.log('====================================================');

  await db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
