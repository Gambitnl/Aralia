# Project Dashboard Schema

Status: active
Last updated: 2026-06-22

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
gap_signal: "3 open gaps; short source-backed summary"
protocol: living project doc set
next_step: Define the next concrete handoff action.
project_mode: single
subproject_tracker: ""
subproject_count: 0
subproject_signal: ""
agent_comments: "Optional note outside the normal flow; keep empty when not needed."
active_agent: ""
agent_pass_status: not_started
agent_pass_started_at: ""
agent_pass_ended_at: ""
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

`active_agent`, `agent_pass_status`, `agent_pass_started_at`, and
`agent_pass_ended_at` are pass-ownership telemetry for the project dashboard.
At the start of an iteration, after the agent has read enough handoff metadata
to identify the project files but before deeper project reading or task
selection, the agent should write its identity, set `agent_pass_status:
in_progress`, set `agent_pass_started_at` to the local start timestamp, and
clear `agent_pass_ended_at`. At closeout, keep the active agent and start time,
then set `agent_pass_status` to the real final pass state and set
`agent_pass_ended_at`.

`required_docs` should list the full canonical living-project surface, including
supporting docs. If a supporting doc is not relevant for a project yet, the
agent should keep it listed and explain "not needed this iteration" in the final
report instead of forgetting the file exists.

`optional_docs` is for project-specific extras such as task slices, migration
notes, architecture notes, generated proof summaries, or domain-specific docs.
The point is awareness: agents should scan whether these exist or are named by
the tracker before claiming the project docs are current.

## Project-With-Subprojects Extension

Most projects stay in `project_mode: single`. Broad parent projects can opt into
`project_mode: parent_with_subprojects` when the owner needs durable lanes under
one project without promoting each lane to a separate top-level project.

When `project_mode` is `parent_with_subprojects`:

- Add `SUBPROJECTS.md` to `required_docs`.
- Set `subproject_tracker` to `docs/projects/<slug>/SUBPROJECTS.md`.
- Set `subproject_count` to the number of active rows in the registry.
- Use `subproject_signal` for the dashboard-sized summary, such as
  `8 lanes tracked; 3 existing project/task rows route under this parent`.
- Set `highest_priority` in `SUBPROJECTS.md` frontmatter when one registry lane
  should be surfaced as the recommended next executable child packet.
- Set `proof_freshness` in `SUBPROJECTS.md` frontmatter when the parent
  dashboard should show whether the registry's proof/routing evidence is
  current, stale, mixed, or unknown.
- Keep actionable implementation gaps in `GAPS.md`; use `SUBPROJECTS.md` for
  routing, ownership, and proof boundaries.
- Do not treat the parent project as one implementation pass. The parent page
  should render a scoped subproject dashboard with filters, sort options, and
  project-row-style cards for each child lane. The child subproject packet owns
  iteration/pass telemetry; the parent owns routing, registry health, and
  boundary decisions.

`SUBPROJECTS.md` uses this table shape:

```markdown
| Subproject ID | Project setup | Status | Relationship | Scope | Existing project/task evidence | Current gap IDs | Next high-impact slice | Proof boundary | Notes |
|---|---|---|---|---|---|---|---|---|---|
```

Relationship values should be plain language:

- `owned lane`: belongs under the parent project and should route future work
  through the parent docs.
- `linked support`: helps the parent, but stays owned by another project.
- `adjacent dependency`: affects the parent, but is not a child lane.

During schema migration, any real project-specific document that is not part of
the canonical living-project surface belongs in `optional_docs` first. If the
same kind of artifact appears across multiple projects and agents need a stable
dashboard field for it, promote that artifact into this schema instead of
leaving it as an unnamed one-off.

Schema-fit decisions for project-specific artifacts are tracked in
`docs/projects/PROJECT_SCHEMA_MIGRATION_NOTES.md`.

## Project Gap Registry Frontmatter Schema

Add this block at the top of `GAPS.md` and keep the existing Markdown gap log
below it. The frontmatter gives the dashboard and audit a stable count/index;
the Markdown table remains the source-backed working registry agents edit.

```yaml
---
schema_version: 1
gap_schema: project_gap_registry
project: Readable Project Name
slug: readable-project-name
status: active
status_note: ""
registry_mode: canonical
last_updated: 2026-06-04
gap_count: 3
open_gap_count: 2
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/readable-project-name/NORTH_STAR.md
tracker: docs/projects/readable-project-name/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
```

`gap_count` is the number of rows in the `Gap Log` table.
`open_gap_count` counts rows whose status is still actionable:
`open`, `active`, `pending`, `blocked`, `not_started`, `in_progress`,
`waiting`, `needs_validation`, `untriaged`, `routed`, or `review-required`.
`registry_mode` records whether the file is already `canonical`, still
`compact`, a `routed_reference`, or a `merged_reference`. Do not flatten
compact/reference registries until a migration pass can preserve routed
ownership, decision provenance, proof freshness, and visual proof needs.

Canonical migration target for `Gap Log` rows:

```markdown
| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
```

Minimum row contract before full migration:

```markdown
| Gap ID | Status | Classification | Gap | Evidence/source | Next action |
|---|---|---|---|---|---|
```

Allowed optional body sections exist because the current project gap files use
real supporting structures: resolved-gap logs, global/import routing notes,
required-review briefs, decision visualizations, current-state readouts, and
appendices. Preserve those sections unless their content is explicitly migrated
into canonical columns.

## Required `Dashboard Card Schema` Section

This markdown section is still supported for projects that have not migrated to
frontmatter yet.

```markdown
## Dashboard Card Schema

Project: Readable Project Name
Slug: readable-project-name
Category: Feature/UI Projects
Main category: Interface & Experience
Subcategory: Player UI Surfaces
Status: active
Last updated: 2026-06-04
Confidence: medium
Evidence: docs/projects/readable-project-name
Gap signal: 3 open gaps; short source-backed summary
Protocol: living project doc set
Next step: Define the next concrete handoff action.
Project mode: single
Subproject tracker:
Subproject count: 0
Subproject signal:
Agent comments: Optional note outside the normal flow; keep empty when not needed.
Active agent:
Agent pass status: not_started
Agent pass started at:
Agent pass ended at:
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-04
Workflow gaps reviewed: 2026-06-04
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs: tasks/, architecture notes, migration notes
Compaction status: not_needed
Lifecycle status: active
Deprecation confidence: none
Deprecation reason:
Canonical owner:
Human decision required: no
```

For any project marked `review-required`, `human-review-required`,
`policy-review-required`, or blocked by a human decision, the handling agent
must add a `Required Review Brief` section to `NORTH_STAR.md`, `TRACKER.md`, or
`GAPS.md`. The project detail page renders this as a visual decision panel.

```markdown
## Required Review Brief

Title: Short decision name
Question: What exactly must be decided?
Issue: What source-backed problem created the review gate?
Current behavior: What happens in the app or workflow today?
Why blocked: Why forward agents must stop instead of continuing implementation.
Option A: One valid decision path.
Option B: Another valid decision path.
Evidence: Source files, project gaps, or proof docs that show the issue.
Decision owner: Human/product owner, policy owner, or named subsystem owner.
Proof after decision: Test, visual check, or doc update required once a choice is made.
```

Field meanings:

| Field | Purpose |
|---|---|
| Project | Human-readable project card title. |
| Slug | Folder slug. This should match `docs/projects/<slug>`. |
| Category | Dashboard grouping/filter label. |
| Main category | Broad dashboard bucket from `PROJECT_CATEGORY_TAXONOMY.md`. |
| Subcategory | More granular bucket inside the main category. |
| Status | Current project state: `active`, `idle`, `planned`, `blocked`, `partial`, `done`, or a clearly explained local status. Use `idle` when the project is alive but the latest required read scan and active edge-case sweep found no actionable project, global, or workflow gap; do not dispatch another forward iteration until a new gap or operator task appears. |
| Last updated | Date the project docs were last intentionally refreshed. Prefer the North Star `Last updated` date. |
| Confidence | Low/medium/high confidence in the current handoff state. |
| Evidence | Primary durable source path for the card. |
| Gap signal | Dashboard-readable summary from `GAPS.md`; do not hide open gaps. Start with a parseable open-gap count such as `0 open gaps`, `1 open gap`, or `5 open gaps`, then add short context after a semicolon if useful. `0 open gaps` is not a claim that adjacent code was tested unless the current handoff or proof file also names the active edge-case/chaos probe vectors used. If the project is reference-only, archived, or merged but still has unresolved historical gaps, keep the count honest and explain the lifecycle state after the count. |
| Protocol | Whether the living-project protocol is implemented and current. |
| Next step | One concrete action for the next agent. |
| Project mode | `single` for ordinary projects; `parent_with_subprojects` when the project uses `SUBPROJECTS.md` for child-lane routing. |
| Subproject tracker | Path to `SUBPROJECTS.md` when project mode is `parent_with_subprojects`; empty otherwise. |
| Subproject count | Number of active rows in `SUBPROJECTS.md`; `0` for ordinary projects. |
| Subproject signal | Dashboard-sized summary of lane count, owned child work, linked support, or adjacent dependencies. |
| Highest priority subproject | API field derived from `highest_priority` in `SUBPROJECTS.md` frontmatter. The parent dashboard uses it to choose one recommended next lane and one recommended handoff packet. |
| Subproject proof freshness | API field derived from `proof_freshness` in `SUBPROJECTS.md` frontmatter. Use it for parent-registry proof freshness, not child runtime proof. |
| Required verification | Comma-separated verification types from `PROJECT_VERIFICATION_SCHEMA.md`. |
| Completed verification | Comma-separated verification types completed for the current active slice. |
| Last proof | Date of the most recent durable proof update. |
| Workflow gaps reviewed | Date the agent checked `WORKFLOW_GAPS.md`. |
| Agent comments | Brief note for unusual workflow friction, assumptions, or out-of-flow concerns. |
| Active agent | Agent/model currently owning or most recently owning the project iteration pass. Set this at pass start before deeper project reading or task selection. |
| Agent pass status | Current pass state: `not_started`, `in_progress`, `blocked`, `finished`, `waiting`, `review_required`, `idle`, or a clearly explained local status. |
| Agent pass started at | Local timestamp for when the active agent began the pass. Prefer an ISO-like value with timezone. |
| Agent pass ended at | Local timestamp for when the active pass finished, blocked, paused, or handed off. Leave empty while the pass is in progress. |
| Required docs | Canonical living-project docs the agent must account for. |
| Optional docs | Project-specific extras the agent must be aware of when present. |
| Compaction status | Whether anti-bloat cleanup was `not_needed`, `done`, or `needed`. |
| Lifecycle status | Dispatch/retention state such as `active`, `reference-only`, `merge-candidate`, or `archive-candidate`. |
| Deprecation confidence | `none`, `weak`, `medium`, or `strong`; evidence quality for archive/merge review. |
| Deprecation reason | Compact reason such as `duplicate_owner`, `stale_pointer`, `task_not_project`, `reference_only`, `corrupted_surface`, or `superseded_by`. |
| Canonical owner | Project that should own the work if this card is merged or archived. |
| Human decision required | `yes` when merge/archive could lose intent. |

For `parent_with_subprojects` projects, the four agent/pass fields above are
allowed to stay empty at the parent level. They should be maintained inside the
relevant child lane's full project setup under
`docs/projects/<parent>/subprojects/<subproject>/` instead. This prevents the
parent card from implying a fake "iteration 1" when no single parent-level pass
can advance all child lanes at once.

## Optional `PROJECT_CARD.json` Fields

```json
{
  "project": "Readable Project Name",
  "category": "Feature/UI Projects",
  "mainCategory": "Interface & Experience",
  "subcategory": "Player UI Surfaces",
  "status": "active",
  "lastUpdated": "2026-06-04",
  "confidence": "medium",
  "evidence": "docs/projects/readable-project-name",
  "gapSignal": "3 open gaps; short source-backed summary",
  "protocol": "living project doc set",
  "nextStep": "Define the next concrete handoff action.",
  "requiredVerification": ["scoped_tests", "docs_consistency"],
  "completedVerification": ["docs_consistency"],
  "lastProof": "2026-06-04",
  "workflowGapsReviewed": "2026-06-04",
  "agentComments": "Optional out-of-flow note.",
  "activeAgent": "Codex application agent",
  "agentPassStatus": "in_progress",
  "agentPassStartedAt": "2026-06-15T01:21:09+02:00",
  "agentPassEndedAt": "",
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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/projects/PROJECT_CARD_SCHEMA.md","sha256WithoutMarker":"c1c52158caa79fc09b8efa57dddfb84723c0d219eb656e108a9f20a6fe04c461","markedAtUtc":"2026-06-25T23:08:44.605Z"} -->
