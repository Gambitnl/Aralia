# Project Card Schema

This file documents how top-level Project Tracker cards get their content.

The dashboard should treat each project folder as the primary source of truth. A
project folder can optionally include `PROJECT_CARD.json` when it needs exact
card wording that cannot be cleanly inferred from `NORTH_STAR.md`,
`TRACKER.md`, or `GAPS.md`.

## Source Order

1. `docs/projects/<slug>/PROJECT_CARD.json`, if present.
2. `docs/projects/<slug>/NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`.
3. `docs/projects/PROJECT_TRACKER.md`, as a fallback for older projects.
4. Folder-derived placeholder text, only when the project is incomplete.

## Optional `PROJECT_CARD.json` Fields

```json
{
  "project": "Readable Project Name",
  "category": "Feature/UI Projects",
  "status": "active",
  "confidence": "medium",
  "evidence": "docs/projects/readable-project-name",
  "gapSignal": "3 open gaps",
  "protocol": "living project doc set",
  "nextStep": "Define the next concrete handoff action."
}
```

All fields are optional. The API fills missing fields from the project markdown
files before falling back to the registry row.

## Why This Is Not SQL

The project cards describe durable documentation, not fast-changing runtime
state. A small schema beside each project keeps the source visible to agents,
syncs through GitHub, and avoids a separate database that can drift from the
actual project files.

A generated cache can be added later if the dashboard becomes slow, but the
cache should still be generated from the project folders rather than becoming a
second manual source of truth.
