# Project Dashboard Schema

Status: active
Last updated: 2026-06-04

This file documents how top-level Project Tracker cards get their content and
what agents must keep current when they finish a project iteration.

The dashboard treats each project folder as the primary source of truth. Agents
should fill structured frontmatter in `NORTH_STAR.md` first. The older
`Dashboard Card Schema` markdown section remains supported while projects are
migrated, but frontmatter is the preferred contract because it is harder for
agents to partially follow without being detected.

## Source Order

1. `docs/projects/<slug>/NORTH_STAR.md` YAML frontmatter.
2. `docs/projects/<slug>/TRACKER.md` YAML frontmatter, only if the North Star
   frontmatter is missing a field.
3. `docs/projects/<slug>/NORTH_STAR.md` section named
   `Dashboard Card Schema`.
4. `docs/projects/<slug>/TRACKER.md` section named
   `Dashboard Card Schema`, only if the North Star section is missing a field.
5. `docs/projects/<slug>/PROJECT_CARD.json`, if present for older projects or
   exact override needs.
6. `docs/projects/<slug>/NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`
   inferred fields.
7. `docs/projects/PROJECT_TRACKER.md`, as a fallback for older projects.
8. Folder-derived placeholder text, only when the project is incomplete.

## Preferred YAML Frontmatter Schema

Add this block at the top of `NORTH_STAR.md` and update it in place every
iteration.

```yaml
---
schema_version: 1
project: Readable Project Name
slug: readable-project-name
category: Feature/UI Projects
main_category: Interface & Experience
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-04
confidence: medium
evidence: docs/projects/readable-project-name
gap_signal: "3 open gaps"
protocol: living project doc set
next_step: Define the next concrete handoff action.
agent_comments: "Optional note outside the normal flow; keep empty when not needed."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-04
workflow_gaps_reviewed: 2026-06-04
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: no
---
```

`agent_comments` is reserved for things that do not fit the default flow. Use
it for a brief agent note about workflow friction, unusual assumptions, or a
specific warning for the next agent. If the note is a reusable workflow problem,
also register or `+1` it in
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.

`required_docs` should list the full canonical living-project surface, including
supporting docs. If a supporting doc is not relevant for a project yet, the
agent should keep it listed and explain "not needed this iteration" in the final
report instead of forgetting the file exists.

`optional_docs` is for project-specific extras such as task slices, migration
notes, architecture notes, generated proof summaries, or domain-specific docs.
The point is awareness: agents should scan whether these exist or are named by
the tracker before claiming the project docs are current.

## Required `Dashboard Card Schema` Section

This markdown section is still supported for projects that have not migrated to
frontmatter yet.

```markdown
## Dashboard Card Schema

Project: Readable Project Name
Slug: readable-project-name
Category: Feature/UI Projects
Status: active
Last updated: 2026-06-04
Confidence: medium
Evidence: docs/projects/readable-project-name
Gap signal: 3 open gaps
Protocol: living project doc set
Next step: Define the next concrete handoff action.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-04
Workflow gaps reviewed: 2026-06-04
Agent comments: Optional note outside the normal flow; keep empty when not needed.
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs: tasks/, architecture notes, migration notes
Compaction status: not_needed
```

Field meanings:

| Field | Purpose |
|---|---|
| Project | Human-readable project card title. |
| Slug | Folder slug. This should match `docs/projects/<slug>`. |
| Category | Dashboard grouping/filter label. |
| Main category | Broad dashboard bucket from `PROJECT_CATEGORY_TAXONOMY.md`. |
| Subcategory | More granular bucket inside the main category. |
| Status | Current project state: `active`, `planned`, `blocked`, `partial`, `done`, or a clearly explained local status. |
| Last updated | Date the project docs were last intentionally refreshed. Prefer the North Star `Last updated` date. |
| Confidence | Low/medium/high confidence in the current handoff state. |
| Evidence | Primary durable source path for the card. |
| Gap signal | Compact summary from `GAPS.md`; do not hide open gaps. |
| Protocol | Whether the living-project protocol is implemented and current. |
| Next step | One concrete action for the next agent. |
| Required verification | Comma-separated verification types from `PROJECT_VERIFICATION_SCHEMA.md`. |
| Completed verification | Comma-separated verification types completed for the current active slice. |
| Last proof | Date of the most recent durable proof update. |
| Workflow gaps reviewed | Date the agent checked `WORKFLOW_GAPS.md`. |
| Agent comments | Brief note for unusual workflow friction, assumptions, or out-of-flow concerns. |
| Required docs | Canonical living-project docs the agent must account for. |
| Optional docs | Project-specific extras the agent must be aware of when present. |
| Compaction status | Whether anti-bloat cleanup was `not_needed`, `done`, or `needed`. |
| Lifecycle status | Dispatch/retention state such as `active`, `reference-only`, `merge-candidate`, or `archive-candidate`. |
| Deprecation confidence | `none`, `weak`, `medium`, or `strong`; evidence quality for archive/merge review. |
| Deprecation reason | Compact reason such as `duplicate_owner`, `stale_pointer`, `task_not_project`, `reference_only`, `corrupted_surface`, or `superseded_by`. |
| Canonical owner | Project that should own the work if this card is merged or archived. |
| Human decision required | `yes` when merge/archive could lose intent. |

## Optional `PROJECT_CARD.json` Fields

```json
{
  "project": "Readable Project Name",
  "category": "Feature/UI Projects",
  "status": "active",
  "lastUpdated": "2026-06-04",
  "confidence": "medium",
  "evidence": "docs/projects/readable-project-name",
  "gapSignal": "3 open gaps",
  "protocol": "living project doc set",
  "nextStep": "Define the next concrete handoff action.",
  "requiredVerification": ["scoped_tests", "docs_consistency"],
  "completedVerification": ["docs_consistency"],
  "lastProof": "2026-06-04",
  "workflowGapsReviewed": "2026-06-04",
  "agentComments": "Optional out-of-flow note.",
  "requiredDocs": ["NORTH_STAR.md", "TRACKER.md", "GAPS.md", "COLD_START_AGENT_PROMPT.md", "DECISIONS.md", "AUDIT_OR_PROOF.md", "RUNBOOK.md"],
  "optionalDocs": ["tasks/", "architecture notes", "migration notes"],
  "compactionStatus": "not_needed",
  "lifecycleStatus": "active",
  "deprecationConfidence": "none",
  "deprecationReason": "",
  "canonicalOwner": "",
  "humanDecisionRequired": "no"
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

## Dashboard Output Diagnostics

The dashboard may add generated diagnostics that agents do not manually edit:

| Output field | Meaning |
|---|---|
| `schemaStatus` | `valid`, `partial`, or `inferred`. |
| `missingSchemaFields` | Required schema fields absent from the project docs. |
| `missingDeclaredDocs` | Required docs listed by schema but missing from the folder. |
| `canonicalDocCoverageStatus` | `complete` or `missing_required`. |
| `schemaWarnings` | Non-blocking but unsafe-dispatch warnings such as missing frontmatter or dirty date values. |

## Why This Is Not SQL

The project cards describe durable documentation, not fast-changing runtime
state. A small schema inside each project keeps the source visible to agents,
syncs through GitHub, and avoids a separate database that can drift from the
actual project files.

A generated cache can be added later if the dashboard becomes slow, but the
cache should still be generated from the project folders rather than becoming a
second manual source of truth.
