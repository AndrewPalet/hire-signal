# hire-signal

Automated job board monitor that polls Greenhouse, Ashby, and Lever career pages, scores listings with Claude AI, and sends interactive Discord notifications for high-fit engineering roles. Runs autonomously on GitHub Actions with Turso as the cloud database.

## Architecture

```
GitHub Actions (cron schedule + manual dispatch)

  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ monitor  │ → │  score   │ → │  notify  │
  │ (ingest) │   │ (Claude) │   │(Discord) │
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │               │              │
       ▼               ▼              ▼
  ┌─────────────────────────┐  ┌──────────────────────┐
  │   Turso (hosted SQLite) │  │ Discord Bot API      │
  │   (local SQLite in dev) │  │ #job-alerts (bot)    │
  └─────────────────────────┘  │ #pipeline-errors (wh)│
                               └──────────────────────┘
                                        ▲
                               ┌────────┴─────────┐
                               │ Cloudflare Worker │
                               │ (button handler)  │
                               └──────────────────┘
```

## Pipeline Steps

| Step | Description |
|------|-------------|
| **Monitor** | Poll Greenhouse/Ashby/Lever APIs, keyword filter, staleness filter (skip jobs >14 days old), prune stale data, store new jobs in SQLite/Turso |
| **Score** | Score unscored jobs via Claude API on role fit, location, stack, and comp |
| **Notify** | Send Discord embeds with age badges and interactive "Seen" buttons for jobs scoring 7+ |
| **Alert** | Post to `#pipeline-errors` via webhook if any step fails (used by CI) |

### Schedule

Runs on GitHub Actions cron:
- **Mon-Wed:** 8 AM and 1 PM CT
- **Thu-Fri:** 8 AM CT
- **Sunday:** 6 PM CT
- Plus manual dispatch via `workflow_dispatch`

## Discord Integration

Job notifications are sent via a **Discord Bot** (not webhooks) to support interactive "Seen" buttons. Each message includes one button per company — clicking it marks all jobs for that company as seen (checkmark prefix on embed fields, button disappears).

A **Cloudflare Worker** handles button interactions: verifies Discord's ed25519 signature, updates Turso (`seen_at` timestamp), and edits the original message.

Error alerts use a separate **webhook** to `#pipeline-errors` — no bot or interactivity needed.

## Monitored Companies

446 companies across three ATS platforms:

- **Greenhouse (265):** Stripe, Coinbase, Airbnb, Figma, Discord, Robinhood, Anthropic, DoorDash, Pinterest, Databricks, and [255 more](config/companies.json)
- **Ashby (148):** Notion, Ramp, Linear, OpenAI, Cursor, Docker, Snowflake, Plaid, 1Password, Vanta, and [138 more](config/companies.json)
- **Lever (33):** Metabase, Crypto.com, Palantir, Match Group, Quizlet, WHOOP, Outreach, and [26 more](config/companies.json)

See [`config/companies.json`](config/companies.json) for the full list. Companies are tagged with optional `sector` metadata (e.g., `ai`, `saas`, `infrastructure`, `consumer-finance`).

## Adding a New Company

1. **Find the board slug and ATS platform** (see [CLAUDE.md](CLAUDE.md) for detailed steps):
   - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
   - Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`
   - Lever: `https://jobs.lever.co/v0/postings/{slug}?mode=json`

2. **Add to `config/companies.json`:**
   ```json
   { "name": "Rocket Money", "id": "truebill", "seed": false, "source": "greenhouse", "sector": "consumer-finance" }
   ```
   - `seed: false` — scores all current jobs <14 days old on first run (recommended for new companies)
   - `seed: true` — seeds existing jobs silently on first run (use for companies you already watch)
   - `source` — which ATS platform the company uses (`"greenhouse"`, `"ashby"`, or `"lever"`)
   - `sector` — optional category tag (e.g., `"ai"`, `"saas"`, `"infrastructure"`, `"consumer-finance"`)

   Either way, subsequent runs automatically only process new postings — no manual changes needed.

3. **Commit and push** — the next GitHub Actions run will pick it up automatically. Or trigger a manual run via `workflow_dispatch`.

## How It Works

**Seed vs. evaluate:** Companies marked `seed: true` get their existing catalog silently ingested on first run (`is_seed = 1`) — those jobs are never scored or notified. Use this for companies you already watch. Companies with `seed: false` get all matching fresh jobs (<14 days) scored on first run. Either way, after the first run the system is self-managing: `jobExists` dedup ensures only genuinely new postings flow through the pipeline.

**Keyword filtering:** Job titles are matched against include keywords (e.g. `software engineer`, `frontend`, `react`, `typescript`) and exclude keywords (e.g. `manager`, `data scientist`, `intern`). Exclude takes priority.

**Staleness filter:** Jobs posted more than 14 days ago are skipped (not scored) since response rates drop significantly after the first two weeks. They are still tracked in the database for deduplication.

**DB pruning:** Runs automatically at the start of each monitor cycle. Job descriptions are nulled after 30 days (reclaims storage) and jobs are soft-archived after 90 days (excluded from scoring and notifications, but still used for dedup). Thresholds are configurable via `STALENESS_THRESHOLD_DAYS`, `DESCRIPTION_PRUNE_DAYS`, and `ARCHIVE_DAYS` in `config.ts`.

## Getting Started

### Prerequisites

- [Node.js 24+](https://nodejs.org/) (managed via [Volta](https://volta.sh))
- [Yarn 1.x](https://classic.yarnpkg.com/)

### 1. Fork, clone, and install

```bash
git clone https://github.com/YOUR_USERNAME/hire-signal.git
cd hire-signal
yarn install
```

### 2. Customize your scoring profile

Edit [`profile/scoring-brief.md`](profile/scoring-brief.md) with your own details:

- Role target (title, seniority, location preference)
- Target comp range
- Tech stack (strongest to familiar)
- Experience and domains
- Preferences and anti-patterns

The AI scorer uses this file as context when evaluating every job. Be specific — the more detail you provide, the more accurate scoring will be.

### 3. Customize your companies and keywords

Edit [`config/companies.json`](config/companies.json) to set your target companies (see [Adding a New Company](#adding-a-new-company)).

Edit [`src/shared/config.ts`](src/shared/config.ts) to adjust keywords:

- **`INCLUDE_KEYWORDS`** — title keywords to match (e.g., `software engineer`, `frontend`)
- **`EXCLUDE_KEYWORDS`** — title keywords to filter out (e.g., `manager`, `intern`)

### 4. Set up external services (all free tier)

**Anthropic (required for scoring):**
- Sign up at [console.anthropic.com](https://console.anthropic.com)
- Create an API key → `ANTHROPIC_API_KEY`

**Discord Bot (required for notifications):**
1. Create an app at [discord.com/developers/applications](https://discord.com/developers/applications)
2. Create a Bot, copy the token → `DISCORD_BOT_TOKEN`
3. Note the Application ID → `DISCORD_APP_ID` and Public Key → `DISCORD_PUBLIC_KEY`
4. Invite the bot to your server: `https://discord.com/api/oauth2/authorize?client_id={APP_ID}&permissions=83968&scope=bot`
5. Copy the channel ID for notifications → `DISCORD_CHANNEL_ID`

**Discord Webhook (required for error alerts):**
- In your Discord server, create a webhook in a `#pipeline-errors` channel → `DISCORD_ERROR_WEBHOOK_URL`

**Turso (required for cloud/CI deployment):**
1. Sign up at [turso.tech](https://turso.tech)
2. Create a database: `turso db create job-monitor`
3. Get the URL: `turso db show job-monitor --url` → `TURSO_DATABASE_URL`
4. Create a token: `turso db tokens create job-monitor` → `TURSO_AUTH_TOKEN`

### 5. Configure environment

```bash
cp .env.example .env
# Fill in your credentials
```

For local development, set `DB_BACKEND=local` (uses SQLite, no Turso needed).

### 6. Run locally

```bash
# Run the full pipeline
yarn monitor    # Ingest jobs from all company boards
yarn score      # Score unscored jobs with Claude AI
yarn notify     # Send Discord notifications for jobs scoring 7+

# Or run all three in sequence
yarn run-all
```

### 7. Deploy to GitHub Actions

Add these secrets to your repo (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_CHANNEL_ID` | Discord channel for notifications |
| `DISCORD_WEBHOOK_URL` | Discord webhook (legacy, kept for compatibility) |
| `DISCORD_ERROR_WEBHOOK_URL` | Discord webhook for error alerts |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `SCORING_BRIEF_B64` | Base64-encoded scoring brief (`cat profile/scoring-brief.md \| base64`) |

Push to `main` — the pipeline runs automatically on the cron schedule or via manual dispatch.

### 8. Deploy Cloudflare Worker (optional — enables "Seen" buttons)

```bash
cd worker
yarn install
npx wrangler login
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler deploy
```

Copy the deployed URL and set it as the **Interactions Endpoint URL** in Discord Developer Portal → General Information.

Without the worker, notifications still work — you just won't have interactive "Seen" buttons.

## Discovering New Companies

A discovery script scans 15K+ ATS slugs (from `data/ats-slugs/`) and identifies companies with matching engineering roles:

```bash
yarn discover --us-only             # scan all platforms, US/remote only
yarn discover --platform ashby      # scan one platform
yarn discover --limit 500           # cap slugs per platform
```

Results are saved to `data/discovery-results.json`. Review the output and add selected companies to `config/companies.json`. The slug lists are sourced from [job-board-aggregator](https://github.com/Feashliaa/job-board-aggregator).

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
yarn lint

# Format
yarn format
```

## Tech Stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js via `tsx` (no build step)
- **Database:** SQLite via `better-sqlite3` (local) / Turso via `@libsql/client` (cloud)
- **AI:** Claude API — Sonnet 4 via `@anthropic-ai/sdk`
- **Notifications:** Discord Bot API (interactive messages with buttons)
- **Error Alerts:** Discord webhooks
- **Interaction Handler:** Cloudflare Worker (ed25519 verification, Turso HTTP API)
- **CI/CD:** GitHub Actions (cron schedule + error alerting)

## Estimated Cost

| Service | Monthly |
|---------|---------|
| GitHub Actions | $0 (public repo) |
| Turso | $0 (free tier) |
| Cloudflare Worker | $0 (free tier, ~100 req/day) |
| Discord Bot | $0 |
| Claude API (Sonnet 4) | ~$10-30 |
| **Total** | **~$10-30/month** |
