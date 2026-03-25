import type { JobRow } from '../shared/types.js';

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

export interface DiscordButton {
  type: 2;
  style: number;
  label: string;
  custom_id: string;
  disabled?: boolean;
}

export interface DiscordActionRow {
  type: 1;
  components: DiscordButton[];
}

export interface SendResult {
  batch: number;
  success: boolean;
  status?: number;
  retryAfter?: number;
  messageId?: string;
  jobIds?: string[];
}

const COLOR_GREEN = 0x27ae60;
const COLOR_TEAL = 0x2f80ed;
const COLOR_YELLOW = 0xf2c94c;

const MAX_FIELD_VALUE = 1024;
const MAX_EMBED_CHARS = 6000;
const MAX_WEBHOOK_CHARS = 6000;
const MAX_BUTTONS_PER_ROW = 5;
const MAX_ACTION_ROWS = 5;
const MAX_BUTTONS_PER_MESSAGE = MAX_BUTTONS_PER_ROW * MAX_ACTION_ROWS; // 25
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

export function buildComponents(jobs: JobRow[]): DiscordActionRow[] {
  // One button per unique company
  const seen = new Set<string>();
  const buttons: DiscordButton[] = [];
  for (const job of jobs) {
    if (seen.has(job.company_id)) continue;
    seen.add(job.company_id);
    if (buttons.length >= MAX_BUTTONS_PER_MESSAGE) break;
    buttons.push({
      type: 2,
      style: 2, // SECONDARY (grey)
      label: truncate(`👁 ${job.company_name}`, 80),
      custom_id: `seen_company:${job.company_id}`,
    });
  }

  const rows: DiscordActionRow[] = [];
  for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
    rows.push({
      type: 1,
      components: buttons.slice(i, i + MAX_BUTTONS_PER_ROW),
    });
  }
  return rows;
}

function embedCharCount(embed: DiscordEmbed): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendBotMessage(
  token: string,
  channelId: string,
  embeds: DiscordEmbed[],
  components: DiscordActionRow[],
): Promise<{ success: boolean; status?: number; messageId?: string; retryAfter?: number }> {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({ embeds, components }),
  });

  if (res.status === 429) {
    const body = (await res.json()) as { retry_after?: number };
    return { success: false, status: 429, retryAfter: body.retry_after ?? 0 };
  }

  if (!res.ok) {
    const body = await res.text();
    console.log(`  Discord error body: ${body}`);
    return { success: false, status: res.status };
  }

  const data = (await res.json()) as { id: string };
  return { success: true, status: res.status, messageId: data.id };
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
    if (
      currentChunk.length > 0 &&
      (currentChunk.length >= 10 || currentChars + embedChars > MAX_WEBHOOK_CHARS)
    ) {
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

interface BatchGroup {
  embeds: DiscordEmbed[];
  components: DiscordActionRow[];
  jobIds: string[];
}

export function buildBatches(jobs: JobRow[]): BatchGroup[] {
  const embeds = buildEmbeds(jobs);
  const batches: BatchGroup[] = [];

  // We need to respect three limits per message:
  // 1. Max 10 embeds
  // 2. Max 6000 total embed chars
  // 3. Max 25 buttons (5 action rows × 5 buttons)
  // We track which jobs belong to each batch for discord_message_id mapping

  let currentEmbeds: DiscordEmbed[] = [];
  let currentJobs: JobRow[] = [];
  let currentCompanies = new Set<string>();
  let currentChars = 0;

  // Map embeds back to jobs by matching field names to job titles
  const jobsByTitle = new Map<string, JobRow>();
  for (const job of jobs) {
    jobsByTitle.set(job.title, job);
    jobsByTitle.set(`${job.company_name} — ${job.title}`, job);
  }

  function flushBatch() {
    if (currentEmbeds.length === 0) return;
    const components = buildComponents(currentJobs);
    batches.push({
      embeds: currentEmbeds,
      components,
      jobIds: currentJobs.map((j) => j.id),
    });
    currentEmbeds = [];
    currentJobs = [];
    currentCompanies = new Set();
    currentChars = 0;
  }

  for (const embed of embeds) {
    const chars = embedCharCount(embed);
    // Extract jobs from this embed's fields
    const embedJobs: JobRow[] = [];
    for (const field of embed.fields) {
      const job = jobsByTitle.get(field.name);
      if (job) embedJobs.push(job);
    }

    const newCompanies = new Set(embedJobs.map((j) => j.company_id));
    const mergedCompanyCount = new Set([...currentCompanies, ...newCompanies]).size;

    const wouldExceedEmbeds = currentEmbeds.length >= 10;
    const wouldExceedChars = currentChars + chars > MAX_WEBHOOK_CHARS;
    const wouldExceedButtons = mergedCompanyCount > MAX_BUTTONS_PER_MESSAGE;

    if (currentEmbeds.length > 0 && (wouldExceedEmbeds || wouldExceedChars || wouldExceedButtons)) {
      flushBatch();
    }

    currentEmbeds.push(embed);
    currentJobs.push(...embedJobs);
    for (const c of newCompanies) currentCompanies.add(c);
    currentChars += chars;
  }

  flushBatch();
  return batches;
}

export async function sendBotBatches(
  token: string,
  channelId: string,
  batches: BatchGroup[],
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      await sleep(2000);
    }

    const batch = batches[i];
    try {
      const result = await sendBotMessage(token, channelId, batch.embeds, batch.components);

      if (result.retryAfter !== undefined && result.status === 429) {
        console.log(`  Rate limited. retry_after: ${result.retryAfter}s. Stopping.`);
        results.push({
          batch: i + 1,
          success: false,
          status: 429,
          retryAfter: result.retryAfter,
          jobIds: batch.jobIds,
        });
        break;
      }

      results.push({
        batch: i + 1,
        success: result.success,
        status: result.status,
        messageId: result.messageId,
        jobIds: batch.jobIds,
      });
    } catch (err) {
      console.log(`  Batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ batch: i + 1, success: false, jobIds: batch.jobIds });
    }
  }

  return results;
}
