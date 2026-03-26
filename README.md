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
| **Monitor** | Poll Greenhouse/Ashby/Lever APIs, keyword filter, store new jobs in SQLite/Turso |
| **Score** | Score unscored jobs via Claude API on role fit, location, stack, and comp |
| **Notify** | Send Discord embeds with interactive "Seen" buttons for jobs scoring 7+ |
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

197 companies across three ATS platforms:

- **Greenhouse (125):** Stripe, Coinbase, Airbnb, Figma, Discord, Robinhood, Duolingo, GitLab, Anduril, Scale AI, and [115 more](src/shared/config.ts)
- **Ashby (51):** Notion, Ramp, Linear, Plaid, 1Password, Zapier, Vanta, WorkOS, Sentry, Redis, and [41 more](src/shared/config.ts)
- **Lever (21):** Metabase, Crypto.com, Wealthfront, WHOOP, Outreach, and [16 more](src/shared/config.ts)

See [`src/shared/config.ts`](src/shared/config.ts) for the full list.

## Adding a New Company

1. **Find the board slug and ATS platform** (see [CLAUDE.md](CLAUDE.md) for detailed steps):
   - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
   - Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}`
   - Lever: `https://jobs.lever.co/v0/postings/{slug}?mode=json`

2. **Add to `src/shared/config.ts`:**
   ```typescript
   { name: 'Rocket Money', id: 'truebill', seed: false, source: 'greenhouse' },
   { name: 'Notion', id: 'notion', seed: false, source: 'ashby' },
   ```
   - `seed: false` — scores ALL current jobs on first run (use when you want to evaluate a company's full catalog)
   - `seed: true` — seeds existing jobs silently on first run (use for companies you already watch)
   - `source` — which ATS platform the company uses (`'greenhouse'`, `'ashby'`, or `'lever'`)

   Either way, subsequent runs automatically only process new postings — no manual changes needed.

3. **Commit and push** — the next GitHub Actions run will pick it up automatically. Or trigger a manual run via `workflow_dispatch`.

## How It Works

**Seed vs. evaluate:** Companies marked `seed: true` get their existing catalog silently ingested on first run (`is_seed = 1`) — those jobs are never scored or notified. Use this for companies you already watch. Companies with `seed: false` get all matching jobs scored on first run. Either way, after the first run the system is self-managing: `jobExists` dedup ensures only genuinely new postings flow through the pipeline.

**Keyword filtering:** Job titles are matched against include keywords (e.g. `software engineer`, `frontend`, `react`, `typescript`) and exclude keywords (e.g. `manager`, `data scientist`, `intern`). Exclude takes priority.

## Setup

```bash
# Install dependencies
yarn install

# Run the monitor (seeds on first run)
yarn monitor

# Score unscored jobs
yarn score

# Send Discord notifications for 7+ scored jobs
yarn notify

# Run the full pipeline (monitor → score → notify)
yarn run-all
```

### Prerequisites

- Node.js 24+ (managed via [Volta](https://volta.sh))
- Yarn 1.x

### Environment Variables

See [`.env.example`](.env.example) for all required variables:

- `ANTHROPIC_API_KEY` — Claude API key for scoring
- `DISCORD_BOT_TOKEN` / `DISCORD_CHANNEL_ID` — Bot credentials for notifications
- `DISCORD_ERROR_WEBHOOK_URL` — Webhook for pipeline error alerts
- `DB_BACKEND` / `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — Database config

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
| Claude API (Sonnet 4) | ~$5-15 |
| **Total** | **~$5-15/month** |
