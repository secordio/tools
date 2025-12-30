# Data Contract (Inputs -> Outputs)

## Inputs

### Adobe activity (CSV or JSON)
Required (or derivable) fields:
- `email`
- `date` (ISO date string)
- `login`
- `total_views`
- `unique_views`

Optional:
- `dashboard_name`

### Profiles (JSON)
Fields:
- `email`
- `name`
- `department`
- `geo`
- `title`
- `manager_email`
- `skip_level_email`

## Outputs

### Per-user file
Path: `data/users/u_<sha1>.json`
Key fields:
- `attributes` (profile fields)
- `activity_summary` (login_total, total_views, unique_views, last_active_date)
- `weekly_activity` (all weeks from 2025-06-01, Monday start)
- `dashboard_activity` (optional)
- `derived.activity_score`
- `derived.segments`

### Index
Path: `data/index.json`
Includes flat fields for search/filter/sort plus `path` to per-user JSON.

### Facets
Path: `data/facets.json`
Counts for: department, geo, title, manager_email, skip_level_email, segments, activity_score_bucket.

### Dashboards
Path: `data/dashboards.json`
Array of dashboards with `{ name, count, users }` (users = list of user ids).
