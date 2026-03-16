import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { SCORING_MODEL, SCORING_BRIEF_PATH } from '../shared/config.js';
import { truncateDescription } from '../shared/utils.js';
import type { JobRow, ScoreResult } from '../shared/types.js';

const SYSTEM_PROMPT = `You are a job-fit scoring engine. You evaluate job postings against a candidate's profile and return structured scores.

Read the FULL job description carefully. Do not score based on title alone. Pay close attention to required qualifications, day-to-day responsibilities, and tech stack listed in the description.

## Scoring Dimensions

1. **Role Fit (weight: 35%)** — Score 1-10
   How well the role's day-to-day responsibilities and requirements match the candidate's archetype and experience level.
   - 10: Core archetype match (frontend-leaning fullstack, product engineering, growth engineering). Seniority aligns perfectly.
   - 8-9: Strong match with minor gaps. Senior role with slight stretch on one dimension.
   - 6-7: Moderate match. Role leans in a direction the candidate can do but isn't strongest at, OR seniority is a stretch (e.g., Staff title).
   - 4-5: Weak match. Role is primarily backend infrastructure, distributed systems, or ML/AI research. Or requires 2+ years more experience than the candidate has.
   - 1-3: Fundamental mismatch. Role requires expertise the candidate does not have (e.g., Go/Rust/Java as primary language, ML model training, native-only mobile).

   Key signals to check:
   - Is this frontend-heavy, backend-heavy, or balanced? The candidate is frontend-leaning.
   - Does it require distributed systems architecture at scale? The candidate's backend experience is service-level.
   - Is this Staff level? Staff is a stretch — requires multi-team technical direction the candidate hasn't demonstrated.
   - Does it require ML/LLM research vs application-level AI? The candidate has only application-level AI experience.
   - Are required languages ones the candidate knows? Go, Rust, Java, C++, Solidity are NOT in the candidate's stack.

2. **Location (weight: 25%)** — Score 1-10
   - 10: Remote US, or Dallas TX
   - 7-9: Remote with minor caveats (hybrid-optional, occasional travel)
   - 4-6: Hybrid required but in a reasonable city
   - 1-3: On-site only, or non-US location

3. **Stack (weight: 20%)** — Score 1-10
   - 10: Core stack match (React, TypeScript, React Native, Node.js)
   - 7-9: Strong overlap with listed technologies
   - 4-6: Adjacent stack, transferable skills
   - 1-3: Completely different stack (Java, C++, Go, Rust, etc.)

4. **Comp (weight: 20%)** — Score 1-10
   - 10: Explicitly lists $175K-$220K+ base or "competitive" at a known high-paying company
   - 7-9: Likely in range based on company/title/level
   - 4-6: Unclear or possibly below range
   - 1-3: Clearly below range or entry-level comp

## Overall Score
Weighted average: (role_fit * 0.35) + (location * 0.25) + (stack * 0.20) + (comp * 0.20), rounded to the nearest integer.

IMPORTANT: Be rigorous. A score of 8+ should mean you would confidently recommend the candidate apply. Do not round up generously. If there are real gaps between the candidate's experience and the role requirements, reflect that in the score.

## Dealbreakers
These override the weighted calculation. If any dealbreaker fires, note it in the reasoning.

- **Non-remote:** If the role requires on-site or hybrid in a city other than Dallas/DFW with no remote option → location_score = 1, overall score cannot exceed 3
- **Clearance required:** If the role requires US security clearance → overall score cannot exceed 2
- **Non-US location:** If the role is based outside the US with no US-remote option → location_score = 1, overall score cannot exceed 2
- **Primary language mismatch:** If the role requires Go, Rust, Java, C++, or Solidity as the primary language → role_fit_score cannot exceed 4

## Response Format
Return ONLY valid JSON with no markdown fences, no explanation outside the JSON:
{
  "role_fit_score": <1-10>,
  "role_fit_reasoning": "<2-3 sentences explaining archetype match, seniority fit, and any gaps>",
  "location_score": <1-10>,
  "location_reasoning": "<1-2 sentences>",
  "stack_score": <1-10>,
  "stack_reasoning": "<1-2 sentences>",
  "comp_score": <1-10>,
  "comp_reasoning": "<1-2 sentences>",
  "overall_score": <1-10>,
  "overall_reasoning": "<2-3 sentence summary including the strongest fit signal and the biggest concern>",
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
  const description = job.description
    ? truncateDescription(job.description)
    : 'No description available.';

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

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

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
