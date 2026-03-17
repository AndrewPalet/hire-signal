import type { JobRow } from '../shared/types.js';

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

export interface SendResult {
  batch: number;
  success: boolean;
  status?: number;
  retryAfter?: number;
}

const COLOR_GREEN = 0x27ae60;
const COLOR_TEAL = 0x2f80ed;
const COLOR_YELLOW = 0xf2c94c;

const MAX_FIELD_VALUE = 1024;
const MAX_EMBED_CHARS = 6000;
const MAX_WEBHOOK_CHARS = 6000;
const FOOTER_TEXT = 'Job Monitor — Scored with Claude Sonnet 4';

function scoreColor(score: number): number {
  if (score >= 9) return COLOR_GREEN;
  if (score >= 8) return COLOR_TEAL;
  return COLOR_YELLOW;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

function buildJobField(job: JobRow): { name: string; value: string } {
  const lines = [
    job.location ? `📍 ${job.location}` : null,
    `Fit: ${job.role_fit_score ?? '?'} | Loc: ${job.location_score ?? '?'} | Stack: ${job.stack_score ?? '?'} | Comp: ${job.comp_score ?? '?'} | **Overall: ${job.overall_score ?? '?'}**`,
    job.overall_reasoning ? `> ${job.overall_reasoning}` : null,
    `[Apply →](${job.url})`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    name: job.title,
    value: truncate(lines, MAX_FIELD_VALUE),
  };
}

function truncateEmbed(embed: DiscordEmbed): DiscordEmbed {
  let total = (embed.title?.length ?? 0) + (embed.footer?.text.length ?? 0);

  const truncatedFields: typeof embed.fields = [];
  for (const field of embed.fields) {
    const fieldChars = field.name.length + field.value.length;
    if (total + fieldChars > MAX_EMBED_CHARS) {
      const remaining = MAX_EMBED_CHARS - total - field.name.length;
      if (remaining > 50) {
        truncatedFields.push({
          ...field,
          value: truncate(field.value, remaining),
        });
      }
      break;
    }
    total += fieldChars;
    truncatedFields.push(field);
  }

  return { ...embed, fields: truncatedFields };
}

export function buildEmbeds(jobs: JobRow[]): DiscordEmbed[] {
  const byCompany = new Map<string, JobRow[]>();
  for (const job of jobs) {
    const group = byCompany.get(job.company_name) ?? [];
    group.push(job);
    byCompany.set(job.company_name, group);
  }

  const embeds: DiscordEmbed[] = [];
  const miscJobs: JobRow[] = [];

  for (const [company, companyJobs] of byCompany) {
    if (companyJobs.length >= 3) {
      const topScore = Math.max(...companyJobs.map((j) => j.overall_score ?? 0));
      embeds.push(
        truncateEmbed({
          title: company,
          color: scoreColor(topScore),
          fields: companyJobs.map(buildJobField),
          footer: { text: FOOTER_TEXT },
        }),
      );
    } else {
      miscJobs.push(...companyJobs);
    }
  }

  if (miscJobs.length > 0) {
    const topScore = Math.max(...miscJobs.map((j) => j.overall_score ?? 0));
    embeds.push(
      truncateEmbed({
        title: 'New Job Matches',
        color: scoreColor(topScore),
        fields: miscJobs.map((job) => {
          const field = buildJobField(job);
          return { ...field, name: `${job.company_name} — ${field.name}` };
        }),
        footer: { text: FOOTER_TEXT },
      }),
    );
  }

  return embeds;
}

function embedCharCount(embed: DiscordEmbed): number {
  return (embed.title?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWebhook(
  webhookUrl: string,
  embeds: DiscordEmbed[],
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  const chunks: DiscordEmbed[][] = [];

  let currentChunk: DiscordEmbed[] = [];
  let currentChars = 0;
  for (const embed of embeds) {
    const embedChars = embedCharCount(embed);
    if (currentChunk.length > 0 && (currentChunk.length >= 10 || currentChars + embedChars > MAX_WEBHOOK_CHARS)) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }
    currentChunk.push(embed);
    currentChars += embedChars;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await sleep(2000);
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: chunks[i] }),
      });

      if (res.status === 429) {
        const body = (await res.json()) as { retry_after?: number };
        const retryAfter = body.retry_after ?? 0;
        console.log(`  Rate limited. retry_after: ${retryAfter}s. Stopping.`);
        results.push({ batch: i + 1, success: false, status: 429, retryAfter });
        break;
      }

      if (!res.ok) {
        const body = await res.text();
        console.log(`  Discord error body: ${body}`);
      }
      results.push({ batch: i + 1, success: res.ok, status: res.status });
    } catch (err) {
      console.log(`  Batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ batch: i + 1, success: false });
    }
  }

  return results;
}
