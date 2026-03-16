# hire-signal

Automated job board monitor that polls Greenhouse career pages, scores listings with Claude AI, and sends Discord notifications for high-fit engineering roles. Runs autonomously on GitHub Actions with Turso as the cloud database.

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
  │   Turso (hosted SQLite) │  │ Discord webhooks     │
  │   (local SQLite in dev) │  │ #job-alerts           │
  └─────────────────────────┘  │ #pipeline-errors      │
                               └──────────────────────┘
```

## Pipeline Steps

| Step | Ticket | Description | Status |
|------|--------|-------------|--------|
| 1. Ingestion | [PAL-1](https://linear.app/weill-cornell-medicine/issue/PAL-1) | Poll Greenhouse APIs, keyword filter, store in SQLite | Done |
| 2. AI Scoring | [PAL-2](https://linear.app/weill-cornell-medicine/issue/PAL-2) | Score unscored jobs via Claude API (Sonnet 4) on location/stack/comp fit | Done |
| 3. Notifications | [PAL-3](https://linear.app/weill-cornell-medicine/issue/PAL-3) | Rich Discord embeds for 7+ scored jobs | Done |
| 4a. Turso Migration | [PAL-8](https://linear.app/weill-cornell-medicine/issue/PAL-8) | DatabaseAdapter refactor, Turso cloud DB | Done |
| 4b. CI/CD | [PAL-9](https://linear.app/weill-cornell-medicine/issue/PAL-9) | GitHub Actions cron + error alerting | Done |
| 5. Notion Sync | [PAL-6](https://linear.app/weill-cornell-medicine/issue/PAL-6) | Auto-create Notion rows for application tracking | Backlog |
| Weekly Digest | [PAL-4](https://linear.app/weill-cornell-medicine/issue/PAL-4) | Weekly summary notification mode | Backlog |
| More Sources | [PAL-7](https://linear.app/weill-cornell-medicine/issue/PAL-7) | Ashby/Lever pipelines + deferred Greenhouse companies | Backlog |

## Monitored Companies

### Greenhouse (active)

Figma, Airbnb, Toast, Headway, Calendly, tvScientific, OpenTable, Twilio, Alvys

### Deferred (PAL-7)

- **Greenhouse:** Stripe, Cloudflare, Vercel, Datadog
- **Ashby:** Notion, Ramp, Linear, Retool, Plaid
- **Lever:** Metabase

## How It Works

**Visited vs. unvisited companies:** Companies marked `visited: true` get their existing catalog "seeded" on first run (`is_seed = 1`) so those jobs are never scored or notified. Only net-new postings flow through the pipeline. Unvisited companies (added later) get all jobs scored on first ingestion.

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
- **Notifications:** Discord webhooks
- **Tracking:** Notion API (planned)
- **CI/CD:** GitHub Actions (cron schedule + error alerting)

## Estimated Cost

| Service | Monthly |
|---------|---------|
| GitHub Actions | $0 (public repo) |
| Turso | $0 (free tier) |
| Discord webhooks | $0 |
| Notion API | $0 |
| Claude API (Sonnet 4) | ~$5-15 |
| **Total** | **~$5-15/month** |
