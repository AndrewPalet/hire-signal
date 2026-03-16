import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { SCORING_MODEL, SCORING_BRIEF_PATH } from './config.js';
import { truncateDescription } from './utils.js';
import type { JobRow, ScoreResult } from './db.js';

const SYSTEM_PROMPT = `You are a job-fit scoring engine. You evaluate job postings against a candidate's profile and return structured scores.

## Scoring Dimensions

1. **Location (weight: 50%)** — Score 1-10
   - 10: Remote US, or Dallas TX
   - 7-9: Remote with minor caveats (hybrid-optional, occasional travel)
   - 4-6: Hybrid required but in a reasonable city
   - 1-3: On-site only, or non-US location

2. **Stack (weight: 25%)** — Score 1-10
   - 10: Core stack match (React, TypeScript, React Native, Node.js)
   - 7-9: Strong overlap with listed technologies
   - 4-6: Adjacent stack, transferable skills
   - 1-3: Completely different stack (Java, C++, etc.)

3. **Comp (weight: 25%)** — Score 1-10
   - 10: Explicitly lists $175K-$220K+ base or "competitive" at a known high-paying company
   - 7-9: Likely in range based on company/title/level
   - 4-6: Unclear or possibly below range
   - 1-3: Clearly below range or entry-level comp

## Overall Score
Weighted average: (location * 0.50) + (stack * 0.25) + (comp * 0.25), rounded to the nearest integer.

## Dealbreakers
These override the weighted calculation. If any dealbreaker fires, note it in the reasoning.

- **Non-remote:** If the role requires on-site or hybrid in a city other than Dallas/DFW with no remote option → location_score = 1, overall score cannot exceed 3
- **Clearance required:** If the role requires US security clearance → overall score cannot exceed 2
- **Non-US location:** If the role is based outside the US with no US-remote option → location_score = 1, overall score cannot exceed 2

## Response Format
Return ONLY valid JSON with no markdown fences, no explanation outside the JSON:
{
  "location_score": <1-10>,
  "location_reasoning": "<1-2 sentences>",
  "stack_score": <1-10>,
  "stack_reasoning": "<1-2 sentences>",
  "comp_score": <1-10>,
  "comp_reasoning": "<1-2 sentences>",
  "overall_score": <1-10>,
  "overall_reasoning": "<1-2 sentence summary>",
  "dealbreaker": "<reason string or null>"
}`;

function loadScoringBrief(): string {
  if (process.env.SCORING_BRIEF_B64) {
    return Buffer.from(process.env.SCORING_BRIEF_B64, 'base64').toString('utf-8');
  }
  if (existsSync(SCORING_BRIEF_PATH)) {
    return readFileSync(SCORING_BRIEF_PATH, 'utf-8');
  }
  throw new Error(
    `Scoring brief not found. Either set SCORING_BRIEF_B64 env var or create ${SCORING_BRIEF_PATH}`,
  );
}

export function buildScoringPrompt(job: JobRow): { system: string; user: string } {
  const brief = loadScoringBrief();
  const description = job.description ? truncateDescription(job.description) : 'No description available.';

  const user = `## Candidate Profile
${brief}

## Job Posting
**Company:** ${job.company_name}
**Title:** ${job.title}
**Location:** ${job.location ?? 'Not specified'}
**URL:** ${job.url}

**Description:**
${description}

Score this job against the candidate profile. Return ONLY valid JSON.`;

  return { system: SYSTEM_PROMPT, user };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scoreJob(client: Anthropic, job: JobRow): Promise<ScoreResult> {
  const { system, user } = buildScoringPrompt(job);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: SCORING_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const parsed = JSON.parse(text) as ScoreResult;

      // Validate required fields
      const required: (keyof ScoreResult)[] = [
        'location_score',
        'location_reasoning',
        'stack_score',
        'stack_reasoning',
        'comp_score',
        'comp_reasoning',
        'overall_score',
        'overall_reasoning',
      ];
      for (const field of required) {
        if (parsed[field] === undefined || parsed[field] === null) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Normalize dealbreaker to null if not present
      if (!parsed.dealbreaker) {
        parsed.dealbreaker = null;
      }

      return parsed;
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof Anthropic.APIError && (err.status === 429 || err.status >= 500);
      if (isRetryable && attempt === 0) {
        await sleep(2000);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}
