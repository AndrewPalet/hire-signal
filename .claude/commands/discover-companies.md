# Discover New Companies

Run the discovery script to scan ATS slug lists for new companies to add to the monitored company list.

## Steps

### 1. Run the discovery scan

Run `yarn discover --us-only` and wait for it to complete. This scans ~15K ATS slugs across Greenhouse, Ashby, and Lever, filtered to companies with US/remote engineering jobs. It takes ~20-30 minutes.

### 2. Analyze results

Read `data/discovery-results.json`. Filter to companies with **5+ US matching jobs** (`usMatchingJobs >= 5`). Write the filtered set to `data/discovery-filtered.json` for analysis.

Report the summary stats:
- Total companies in results
- Companies with 5+ US matches
- Breakdown by platform (greenhouse/ashby/lever)

### 3. Curate the list

Go through the filtered companies and select which ones to add to `config/companies.json`.

**INCLUDE:**
- Well-known tech companies (SaaS, fintech, consumer tech, developer tools, AI/ML)
- Mid-to-large startups with real engineering teams
- Companies likely to pay $175K+ for senior engineers
- Companies with frontend, fullstack, or product engineer roles

**EXCLUDE:**
- Recruiting agencies / staffing firms / job aggregators
- Defense contractors / military / government
- Companies primarily hiring for non-JS/TS stacks (Go, Rust, Java, C++ as primary)
- Companies that are primarily non-US (most jobs overseas)
- Healthcare systems / hospitals (healthtech startups ARE fine)
- Consulting firms / agencies
- Hardware-only companies with no software product

### 4. Add to config

For each curated company, add a JSON entry to `config/companies.json`:

```json
{
  "name": "Human-Readable Name",
  "id": "ats-slug-from-discovery",
  "seed": false,
  "source": "greenhouse|ashby|lever",
  "sector": "ai|saas|infrastructure|payments|crypto|consumer-finance|consumer-marketplace|design-productivity|health-tech|real-estate|predictions|other"
}
```

Important:
- Set `seed: false` so current fresh postings (<14 days) get scored on first run
- Deduplicate against existing entries in `config/companies.json`
- Use proper capitalization for the `name` field (e.g., "DoorDash" not "doordashusa")
- Pick the most appropriate `sector` value
- The `id` can contain spaces (e.g. `"the browser company"` for Ashby) — Node's `fetch` auto-encodes the URL path, so store the slug verbatim

### 5. Verify

- Run `npx tsc --noEmit` to type check
- Run `yarn lint` to lint
- Report the final count: how many new companies added, total company count

### 6. Commit

Do NOT commit automatically. Report the results and let the user decide when to commit.
