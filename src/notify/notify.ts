import 'dotenv/config';
import { initDb, getNotifiableJobs, markJobsNotified } from '../shared/db.js';
import { buildEmbeds, sendWebhook } from './discord.js';

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('Missing DISCORD_WEBHOOK_URL. Set it in your .env file.');
    console.error('See .env.example for the expected format.');
    process.exit(1);
  }

  const db = initDb();
  const jobs = getNotifiableJobs(db);

  const runTime = new Date().toISOString();
  console.log('====================================================');
  console.log(`  Job Notifier Run: ${runTime}`);
  console.log(`  Notifiable jobs: ${jobs.length}`);
  console.log('====================================================\n');

  if (jobs.length === 0) {
    console.log('  No notifiable jobs found. Nothing to do.');
    db.close();
    return;
  }

  const embeds = buildEmbeds(jobs);
  const totalBatches = Math.ceil(embeds.length / 10);

  let notified = 0;
  let failed = 0;
  let batchesSent = 0;

  const results = await sendWebhook(webhookUrl, embeds);

  // Map jobs to embeds to track which jobs belong to which batch
  // Each batch has up to 10 embeds; jobs are distributed across embeds
  // For simplicity, mark all jobs notified for successful batches
  const jobIds = jobs.map((j) => j.id);

  for (const result of results) {
    if (result.success) {
      batchesSent++;
      console.log(
        `  Sending batch ${result.batch}/${totalBatches} (${Math.min(10, embeds.length - (result.batch - 1) * 10)} embeds)... ✓`,
      );
    } else {
      console.log(
        `  Sending batch ${result.batch}/${totalBatches}... ✗ (status: ${result.status ?? 'unknown'})`,
      );
    }
  }

  const allSucceeded = results.every((r) => r.success);
  if (allSucceeded) {
    markJobsNotified(db, jobIds);
    notified = jobs.length;
  } else {
    // If some batches failed, still mark jobs notified for successful portion
    const successfulBatches = results.filter((r) => r.success).length;
    if (successfulBatches > 0 && successfulBatches < totalBatches) {
      // Approximate: mark proportional jobs as notified
      const ratio = successfulBatches / totalBatches;
      const count = Math.floor(jobs.length * ratio);
      const partialIds = jobIds.slice(0, count);
      markJobsNotified(db, partialIds);
      notified = count;
      failed = jobs.length - count;
    } else if (successfulBatches === 0) {
      failed = jobs.length;
    }
  }

  console.log('\n────────────────────────────────────────────────────');
  console.log(`  Notified:      ${notified} jobs`);
  console.log(`  Failed:        ${failed} jobs`);
  console.log(`  Batches sent:  ${batchesSent}`);
  console.log('====================================================');

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
