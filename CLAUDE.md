# Hire Signal

## Finding a Company's Greenhouse Board ID

When adding a new company, you need to find the correct Greenhouse board slug. Follow these steps in order:

### Step 1: Try the obvious slug

Hit the Greenhouse boards API directly with the most likely slug (lowercase company name, no spaces):

```
https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
```

Common patterns to try:
- Company name as-is: `stripe`, `figma`, `airbnb`
- With suffix: `toastinc`, `metabaseinc`
- Domain-style: `toasttab` (from toasttab.com)

If you get a 200 with a `jobs` array, that's the correct slug.

### Step 2: Check the company's careers page

If Step 1 fails, fetch the company's careers/jobs page and inspect the HTML for:
- Greenhouse embed scripts: `<script src="https://boards.greenhouse.io/embed/job_board/js?for={SLUG}">`
- Greenhouse iframe: `<iframe src="https://boards.greenhouse.io/embed/job_board?for={SLUG}">`
- Lever initialization: `window.leverJobsOptions = {accountName: "..."}`
- Links to `boards.greenhouse.io/{slug}` or `jobs.lever.co/{slug}` or `jobs.ashbyhq.com/{slug}`

This also tells you which ATS platform the company uses. If it's not Greenhouse, note the platform for future support.

### Step 3: Web search as fallback

Search for: `site:boards.greenhouse.io {company name}`

This surfaces any public Greenhouse board pages indexed by search engines.

### Lessons learned

- **Toast**: The board slug is `toast`, not `toasttab` (their domain). The obvious company name was correct.
- **Metabase**: Does not use Greenhouse at all — they use **Lever** (`jobs.lever.co/metabase`). Always verify the ATS platform before assuming Greenhouse.

## Project Commands

- `yarn monitor` — run the job monitor
- `yarn score` — run AI fit scoring on unscored jobs
- `yarn notify` — send Discord notifications for high-scoring jobs
- `yarn run-all` — run monitor, score, and notify in sequence
- `yarn alert` — send pipeline error alert to Discord (used by CI)
- `yarn format` — format with prettier
- `yarn lint` — lint with eslint
- `npx tsc --noEmit` — type check
