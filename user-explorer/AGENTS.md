# User Explorer: LLM Handoff

## Mission
Adapt this prototype to real data sources while preserving the build outputs and UI behaviors.

## Project Map

- `inputs/` raw exports (activity + profiles)
- `scripts/adapters/` source parsing + normalization
- `scripts/enrichments/` derived metrics + segments
- `scripts/build.js` orchestration + output writers
- `data/` generated JSON (index, facets, dashboards, per-user)
- `app/` static UI

## Required Contracts

- Primary key: email (normalize lowercase + trim)
- Weekly activity must include every week from 2025-06-01 to today (Monday week start)
- Output files and schemas must match `data/index.json`, `data/facets.json`, `data/dashboards.json`, and `data/users/u_<sha1>.json`

## Where To Adapt

1. **Profiles**: `scripts/adapters/profiles.js`
   - Map your profile schema to: email, name, department, geo, title, manager_email, skip_level_email
2. **Activity**: `scripts/adapters/activity.js`
   - Map your activity fields to: email, date, login, total_views, unique_views, dashboard_name (optional)
3. **Derived**: `scripts/enrichments/score.js`, `scripts/enrichments/segments.js`
   - Update scoring or segment rules if needed

## UI Expectations

- Search on name/email/title/department
- Filters: segments, activity_score_bucket, geo, department, title, manager_email, skip_level_email
- Dashboard selector filters users by dashboard usage
- Querystring reflects filters/sort/dashboard/compact/view
- Users view + Breakdown view (tabs)

## Verification Checklist

- `make build` produces files in `data/`
- `data/index.json` fields align with UI search and filters
- Weekly activity shows full timeline with zero-filled weeks
- Dashboard list reflects real dashboard names

## Helpful Command

```bash
make build
```
