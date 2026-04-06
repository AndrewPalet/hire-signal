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

  const runTime = new Date().toISOString();
  const MAX_ROUNDS = 10;
  let totalNotified = 0;
  let totalFailed = 0;
  let totalBatchesSent = 0;
  let round = 0;

  // Drain loop: keep sending until all notifiable jobs are delivered
  while (round < MAX_ROUNDS) {
    round++;
    const jobs = await db.getNotifiableJobs();

    if (round === 1) {
      console.log('====================================================');
      console.log(`  Job Notifier Run: ${runTime}`);
      console.log(`  Notifiable jobs: ${jobs.length}`);
      console.log('====================================================\n');
    }

    if (jobs.length === 0) {
      if (round === 1) {
        console.log('  No notifiable jobs found. Nothing to do.');
      }
      break;
    }

    if (round > 1) {
      console.log(`\n  Round ${round}: ${jobs.length} remaining jobs...\n`);
    }

    const batches = buildBatches(jobs);
    const results = await sendBotBatches(botToken, channelId, batches);
    const totalBatches = results.length;

    let roundNotified = 0;
    for (const result of results) {
      if (result.success) {
        totalBatchesSent++;
        console.log(`  Sending batch ${result.batch}/${totalBatches}... ✓`);
        if (result.messageId && result.jobIds) {
          await db.setDiscordMessageId(result.jobIds, result.messageId);
        }
        if (result.jobIds) {
          await db.markJobsNotified(result.jobIds);
          totalNotified += result.jobIds.length;
          roundNotified += result.jobIds.length;
        }
      } else {
        console.log(
          `  Sending batch ${result.batch}/${totalBatches}... ✗ (status: ${result.status ?? 'unknown'})`,
        );
        totalFailed += result.jobIds?.length ?? 0;
      }
    }

    // If nothing was sent this round, stop to avoid infinite loop
    if (roundNotified === 0) break;
  }

  console.log('\n────────────────────────────────────────────────────');
  console.log(`  Notified:      ${totalNotified} jobs`);
  console.log(`  Failed:        ${totalFailed} jobs`);
  console.log(`  Batches sent:  ${totalBatchesSent}`);
  if (round > 1) console.log(`  Rounds:        ${round}`);
  console.log('====================================================');

  await db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
