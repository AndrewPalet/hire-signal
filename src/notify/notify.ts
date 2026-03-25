import 'dotenv/config';
import { createDatabase } from '../shared/db.js';
import { buildBatches, sendBotBatches } from './discord.js';

async function main() {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!botToken || !channelId) {
    console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID. Set them in your .env file.');
    console.error('See .env.example for the expected format.');
    process.exit(1);
  }

  const db = await createDatabase();
  const jobs = await db.getNotifiableJobs();

  const runTime = new Date().toISOString();
  console.log('====================================================');
  console.log(`  Job Notifier Run: ${runTime}`);
  console.log(`  Notifiable jobs: ${jobs.length}`);
  console.log('====================================================\n');

  if (jobs.length === 0) {
    console.log('  No notifiable jobs found. Nothing to do.');
    await db.close();
    return;
  }

  const batches = buildBatches(jobs);
  const results = await sendBotBatches(botToken, channelId, batches);
  const totalBatches = results.length;

  let notified = 0;
  let failed = 0;
  let batchesSent = 0;

  for (const result of results) {
    if (result.success) {
      batchesSent++;
      console.log(`  Sending batch ${result.batch}/${totalBatches}... ✓`);
      // Store discord message ID for all jobs in this batch
      if (result.messageId && result.jobIds) {
        await db.setDiscordMessageId(result.jobIds, result.messageId);
      }
      // Mark jobs as notified
      if (result.jobIds) {
        await db.markJobsNotified(result.jobIds);
        notified += result.jobIds.length;
      }
    } else {
      console.log(
        `  Sending batch ${result.batch}/${totalBatches}... ✗ (status: ${result.status ?? 'unknown'})`,
      );
      failed += result.jobIds?.length ?? 0;
    }
  }

  console.log('\n────────────────────────────────────────────────────');
  console.log(`  Notified:      ${notified} jobs`);
  console.log(`  Failed:        ${failed} jobs`);
  console.log(`  Batches sent:  ${batchesSent}`);
  console.log('====================================================');

  await db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
