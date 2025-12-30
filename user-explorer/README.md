# User Explorer (CDP-lite)

Lightweight, static CDP-style user explorer. A Node.js build pipeline generates JSON per user and a searchable index, and a static HTML app loads those files for search, filtering, sorting, and detail drill-down.

## Quick Start

```bash
cd user-explorer
make install
make build
make serve
```

Open: `http://127.0.0.1:8080/app/index.html`

## Repo Layout

- `inputs/` source exports (activity + profiles)
- `scripts/` build pipeline (adapters, enrichments, utils)
- `data/` build outputs (index, facets, dashboards, per-user JSON)
- `app/` static UI (index.html, app.js, styles.css)

## Data Inputs

- `inputs/activity.csv` or `inputs/activity.json`
  - required: `email`, `date`, `login`, `total_views`, `unique_views`
  - optional: `dashboard_name`
- `inputs/user_profiles.json`
  - required: `email`
  - optional: `name`, `department`, `geo`, `title`, `manager_email`, `skip_level_email`

Emails are normalized (lowercase + trim). Weekly activity starts at 2025-06-01 with Monday week starts.

## Build Outputs

- `data/users/u_<sha1>.json` full user records
- `data/index.json` search index
- `data/facets.json` facet counts
- `data/dashboards.json` dashboard -> users mapping

Activity score is normalized per metric and used for sorting, filters, and segments.

## Customize For Real Data

1. Replace files in `inputs/` with your real exports.
2. Update adapters if field names or formats differ:
   - `scripts/adapters/activity.js`
   - `scripts/adapters/profiles.js`
3. Update enrichments if needed:
   - `scripts/enrichments/score.js`
   - `scripts/enrichments/segments.js`
4. Run `make build` and validate `data/` outputs.

## UI Notes

- Search via MiniSearch (CDN)
- Charts via Chart.js (CDN)
- Filters + querystring sharing are handled in `app/app.js`

If your environment requires offline usage, host the JS libraries locally.

## LLM Handoff / Packaging

For another LLM to extend this project with your data:

1. Share this repo plus the guidance in `AGENTS.md`.
2. Include the Codex skill in `skills/cdp-lite-adapter/`.
3. (Optional) Package the skill as a `.skill` file:

```bash
python3 /Users/scottsecord/.codex/skills/.system/skill-creator/scripts/package_skill.py user-explorer/skills/cdp-lite-adapter
```

The skill contains the exact workflow and file references needed to adapt new data sources.
