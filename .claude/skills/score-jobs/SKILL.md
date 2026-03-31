---
name: score-jobs
description: Manually score unscored jobs using Claude Code instead of the Anthropic API. Reads job titles, locations, and descriptions from Turso DB, applies the scoring rubric, writes scores back via SQL, then runs yarn notify.
---

# Score Jobs Locally

Score all unscored jobs (or a specific company) without calling the Anthropic API. You are the scoring engine.

**Company filter:** $ARGUMENTS (if blank, score ALL unscored jobs)

## References

Before scoring, read these files for context:
- [Candidate profile](../../../profile/scoring-brief.md) — who the candidate is, target role, stack, preferences, anti-patterns
- [Scoring rubric](../../../src/score/claude.ts) — lines 7-73 contain the full scoring prompt with dimensions, weights, and dealbreakers

## Step 1: Query unscored jobs

```sql
-- If a company was specified:
SELECT id, title, location, company_name, substr(description, 1, 3000)
FROM jobs
WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL
  AND company_name = '{company}'
ORDER BY company_name, title;

-- If no company specified, get all:
SELECT id, title, location, company_name
FROM jobs
WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL
ORDER BY company_name, title;
```

Run via `turso db shell job-monitor "..."`.

If there are 0 unscored jobs, stop and tell the user.

## Step 2: Triage jobs by scorability

Many jobs can be **quick-scored from title + location alone** when dealbreakers are obvious:

- **Non-US location** (e.g., "Bengaluru", "Remote - Canada", "London", "Singapore") → location=1, overall=2, dealbreaker="Non-US location with no US-remote option"
- **On-site/hybrid in non-Dallas US city** (e.g., "San Francisco, CA", "New York, NY") → location=1, overall capped at 3, dealbreaker="On-site/hybrid required in non-Dallas US city, no remote option"
- **Backend-only roles** at companies known for Go/Java backend → role_fit=3, stack=3
- **Senior Staff / Principal titles** → role_fit=2-3 (well beyond candidate seniority)
- **ML/AI research, security, Salesforce, native-only mobile** → role_fit=2-3

**⚠️ AMBIGUOUS LOCATIONS:** Do NOT auto-dealbreak locations that are ambiguous. Instead, **automatically fetch the job description or posting URL** to determine the actual location policy before scoring. Ambiguous locations include:
- "Remote" (without a country), "Remote - Global", "Global"
- "Georgia" (could be US state or country)
- Any location that could plausibly include US-remote candidates

Only auto-dealbreak locations that are **unambiguously** non-US (e.g., "Bengaluru", "Dublin, Ireland", "Shanghai") or unambiguously on-site in a specific non-Dallas US city (e.g., "San Francisco, CA", "New York, NY").

For jobs that COULD score well (frontend, fullstack, growth, product eng, remote US), fetch their descriptions:
```sql
SELECT substr(description, 1, 3000) FROM jobs WHERE id = '{id}';
```

## Step 3: Score and write to DB

### Scoring dimensions (from rubric)
- **Role Fit (35%):** Archetype match (frontend-leaning fullstack, product eng, growth eng), seniority, language fit
- **Location (25%):** Remote US=10, hybrid-optional=7-9, hybrid required=4-6, on-site/non-US=1-3
- **Stack (20%):** React/TS/Node=10, strong overlap=7-9, adjacent=4-6, different=1-3
- **Comp (20%):** $175K-220K+=10, likely in range=7-9, unclear=4-6, below=1-3
- **Overall:** Weighted average rounded to nearest integer

### Dealbreakers (override overall)
- Non-remote (not Dallas) → location=1, overall cannot exceed 3
- Clearance required → overall cannot exceed 2
- Non-US with no US-remote → location=1, overall cannot exceed 2
- Primary language Go/Rust/Java/C++/Solidity → role_fit cannot exceed 4

### Writing scores

Batch jobs with identical scoring patterns into single UPDATE statements using WHERE id IN (...):

```sql
UPDATE jobs SET
  role_fit_score = {n}, role_fit_reasoning = '{text}',
  location_score = {n}, location_reasoning = '{text}',
  stack_score = {n}, stack_reasoning = '{text}',
  comp_score = {n}, comp_reasoning = '{text}',
  overall_score = {n}, overall_reasoning = '{text}',
  dealbreaker = {NULL or 'reason'},
  scored_at = datetime('now')
WHERE id IN ('id1', 'id2', ...);
```

Run via `turso db shell job-monitor "..."`. Escape single quotes in reasoning with ''.

### Efficiency tips
- Group non-US dealbreakers into 1-2 bulk UPDATEs (backend vs frontend reasoning)
- Group on-site US dealbreakers similarly
- Group backend Remote-USA roles by company (same comp score)
- Score promising Remote-USA frontend/fullstack jobs individually with specific reasoning

## Step 4: Verify after each batch

```sql
SELECT count(*) FROM jobs WHERE scored_at IS NOT NULL AND company_name = '{company}';
```

## Step 5: Final verification

```sql
SELECT count(*) FROM jobs WHERE passed_filter = 1 AND is_seed = 0 AND scored_at IS NULL;
```

Should return 0.

## Step 6: Review notifiable jobs

```sql
SELECT company_name, title, overall_score, location
FROM jobs WHERE overall_score >= 7 AND notified = 0
ORDER BY overall_score DESC, company_name;
```

Show this list to the user and ask for confirmation before notifying.

## Step 7: Notify

```bash
yarn notify
```

Report the results (how many notified, any failures).
