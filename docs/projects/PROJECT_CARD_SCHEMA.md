# Project Dashboard Schema

Status: active
Last updated: 2026-06-04

This file documents how top-level Project Tracker cards get their content and
what agents must keep current when they finish a project iteration.

The dashboard treats each project folder as the primary source of truth. Agents
should fill the `Dashboard Card Schema` section in `NORTH_STAR.md` so the
dashboard reads explicit project state instead of guessing from prose.

## Source Order

1. `docs/projects/<slug>/NORTH_STAR.md` section named
   `Dashboard Card Schema`.
2. `docs/projects/<slug>/TRACKER.md` section named
   `Dashboard Card Schema`, only if the North Star section is missing a field.
3. `docs/projects/<slug>/PROJECT_CARD.json`, if present for older projects or
   exact override needs.
4. `docs/projects/<slug>/NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`
   inferred fields.
5. `docs/projects/PROJECT_TRACKER.md`, as a fallback for older projects.
6. Folder-derived placeholder text, only when the project is incomplete.

## Required `Dashboard Card Schema` Section

Add this section to `NORTH_STAR.md` and update it in place every iteration.

```markdown
## Dashboard Card Schema

Project: Readable Project Name
Slug: readable-project-name
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/readable-project-name
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Define the next concrete handoff action.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-04
Workflow gaps reviewed: 2026-06-04
```

Field meanings:

| Field | Purpose |
|---|---|
| Project | Human-readable project card title. |
| Slug | Folder slug. This should match `docs/projects/<slug>`. |
| Category | Dashboard grouping/filter label. |
| Status | Current project state: `active`, `planned`, `blocked`, `partial`, `done`, or a clearly explained local status. |
| Confidence | Low/medium/high confidence in the current handoff state. |
| Evidence | Primary durable source path for the card. |
| Gap signal | Compact summary from `GAPS.md`; do not hide open gaps. |
| Protocol | Whether the living-project protocol is implemented and current. |
| Next step | One concrete action for the next agent. |
| Required verification | Comma-separated verification types from `PROJECT_VERIFICATION_SCHEMA.md`. |
| Completed verification | Comma-separated verification types completed for the current active slice. |
| Last proof | Date of the most recent durable proof update. |
| Workflow gaps reviewed | Date the agent checked `WORKFLOW_GAPS.md`. |

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
  "nextStep": "Define the next concrete handoff action.",
  "requiredVerification": ["scoped_tests", "docs_consistency"],
  "completedVerification": ["docs_consistency"],
  "lastProof": "2026-06-04",
  "workflowGapsReviewed": "2026-06-04"
}
```

All JSON fields are optional. The API fills missing fields from the project
markdown files before falling back to the registry row. Prefer the markdown
section unless there is a clear reason to keep a separate JSON override.

## Anti-Bloat Rule

Project docs must be updated in place. Do not append a full new narrative every
iteration.

Use these limits:

1. `NORTH_STAR.md`: keep the current state, active task, scope boundaries, and
   resume path concise enough for cold start. Replace stale state instead of
   stacking old summaries.
2. `TRACKER.md`: update task rows and keep only useful active/deferred/closed
   state. Do not add duplicate rows for the same task.
3. `GAPS.md`: one durable row per gap. Add dated notes or status changes inside
   the same gap entry instead of reopening duplicates.
4. `COLD_START_AGENT_PROMPT.md`: keep only the latest handoff between the
   markers. It is not a transcript archive.
5. `AUDIT_OR_PROOF.md`: preserve concise proof summaries. Raw logs, full test
   output, and repetitive screenshots stay external unless a small excerpt is
   needed.
6. After roughly ten iterations, an agent must compress stale handoff/progress
   detail into a short "historical summary" and keep only current resume data
   in the main files.

## Why This Is Not SQL

The project cards describe durable documentation, not fast-changing runtime
state. A small schema inside each project keeps the source visible to agents,
syncs through GitHub, and avoids a separate database that can drift from the
actual project files.

A generated cache can be added later if the dashboard becomes slow, but the
cache should still be generated from the project folders rather than becoming a
second manual source of truth.
