import 'dotenv/config';

interface DiscordEmbed {
  title: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

const COLOR_RED = 0xe74c3c;

const webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL ?? '';
if (!webhookUrl) {
  console.error('DISCORD_ERROR_WEBHOOK_URL is not set');
  process.exit(1);
}

const [monitorOutcome, scoreOutcome, notifyOutcome] = process.argv.slice(2);

const statusEmoji = (outcome: string | undefined): string =>
  outcome === 'success' ? ':white_check_mark:' : ':x:';

const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
const repo = process.env.GITHUB_REPOSITORY ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';
const eventName = process.env.GITHUB_EVENT_NAME ?? 'manual';

const runUrl = repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : 'N/A (local run)';

const embed: DiscordEmbed = {
  title: 'Pipeline Failure',
  color: COLOR_RED,
  fields: [
    {
      name: 'Monitor',
      value: `${statusEmoji(monitorOutcome)} ${monitorOutcome ?? 'unknown'}`,
      inline: true,
    },
    {
      name: 'Score',
      value: `${statusEmoji(scoreOutcome)} ${scoreOutcome ?? 'unknown'}`,
      inline: true,
    },
    {
      name: 'Notify',
      value: `${statusEmoji(notifyOutcome)} ${notifyOutcome ?? 'unknown'}`,
      inline: true,
    },
    { name: 'Trigger', value: eventName, inline: true },
    { name: 'Run', value: `[View logs](${runUrl})` },
  ],
  footer: { text: 'Job Monitor — Error Alert' },
};

const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ embeds: [embed] }),
});

if (!res.ok) {
  console.error(`Discord POST failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

console.log('Error alert sent to #pipeline-errors');
