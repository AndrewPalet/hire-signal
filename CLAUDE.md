# Hire Signal

## Finding a Company's Board ID

When adding a new company, you need to find the correct board slug and ATS platform. The pipeline supports **Greenhouse**, **Ashby**, and **Lever**. Follow these steps in order:

### Step 1: Try the obvious slug

Hit the ATS APIs directly with the most likely slug (lowercase company name, no spaces):

**Greenhouse:**
```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
```

**Ashby:**
```
https://api.ashbyhq.com/posting-api/job-board/{slug}
```

**Lever:**
```
https://jobs.lever.co/v0/postings/{slug}?mode=json
```

Common patterns to try:
- Company name as-is: `stripe`, `figma`, `airbnb`
- With suffix: `toastinc`, `metabaseinc`
- Domain-style: `toasttab` (from toasttab.com)

If you get a 200 with a `jobs` array, that's the correct slug and ATS.

### Step 2: Check the company's careers page

If Step 1 fails, fetch the company's careers/jobs page and inspect the HTML for:
- Greenhouse embed scripts: `<script src="https://boards.greenhouse.io/embed/job_board/js?for={SLUG}">`
- Greenhouse iframe: `<iframe src="https://boards.greenhouse.io/embed/job_board?for={SLUG}">`
- Ashby links: `jobs.ashbyhq.com/{slug}`
- Lever links: `jobs.lever.co/{slug}`
- Lever initialization: `window.leverJobsOptions = {accountName: "..."}`
- Gem links: `jobs.gem.com/{slug}`

This tells you which ATS platform the company uses. If it's not Greenhouse, Ashby, or Lever, note the platform for future support.

### Step 3: Web search as fallback

Search for: `site:boards.greenhouse.io {company name}`

This surfaces any public Greenhouse board pages indexed by search engines.

### Lessons learned

- **Toast**: The board slug is `toast`, not `toasttab` (their domain). The obvious company name was correct.
- **Metabase**: Does not use Greenhouse at all — they use **Lever** (`jobs.lever.co/metabase`). Always verify the ATS platform before assuming Greenhouse.
- **Retool**: Does not use Ashby — they use **Gem** (`jobs.gem.com/retool`). The Ashby API returns 0 jobs for them.

## Inline Scripts

When running inline TypeScript with `npx tsx -e`, import dotenv at the top instead of sourcing `.env` in the shell. This ensures the command matches the allowed permission pattern `Bash(npx tsx -e:*)`.

```bash
# Do this:
npx tsx -e "
import 'dotenv/config';
async function main() {
  const { createDatabase } = await import('./src/shared/db.js');
  const db = await createDatabase();
  // ...
}
main();
"

# NOT this (breaks permission matching):
set -a && source .env && set +a && npx tsx -e "..."
```

## Project Commands

- `yarn monitor` — run the job monitor
- `yarn score` — run AI fit scoring on unscored jobs
- `yarn notify` — send Discord notifications for high-scoring jobs
- `yarn run-all` — run monitor, score, and notify in sequence
- `yarn alert` — send pipeline error alert to Discord (used by CI)
- `yarn format` — format with prettier
- `yarn lint` — lint with eslint
- `npx tsc --noEmit` — type check
