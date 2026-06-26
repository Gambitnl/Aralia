---
schema_version: 1
project: Spells
project_name: Spells
slug: spells
project_slug: spells
category: Game & Simulation
main_category: Game & Simulation
subcategory: Spell Runtime And Data
tracker_group: Spells
status: active
last_updated: 2026-06-25
iteration: 0
confidence: medium
evidence: docs/projects/spells
gap_signal: "Parent imports 5 active spell-domain gaps after lane ownership is chosen; child packets own execution proof."
protocol: living project doc set
next_step: "Choose the highest-impact child lane from SUBPROJECTS.md, run the executable pass in that child packet, then import only parent-visible routing or product gaps back here."
project_mode: parent_with_subprojects
subproject_tracker: docs/projects/spells/SUBPROJECTS.md
subproject_count: 8
subproject_signal: "8 tracked child lanes; 7 owned Spells lanes plus 1 linked support project"
agent_comments: "Parent is a scoped routing dashboard, not one executable spell-work iteration."
active_agent: ""
agent_pass_status: ""
agent_pass_started_at: ""
agent_pass_ended_at: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - SUBPROJECTS.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - subprojects/
  - docs/tasks/spells/
  - linked support project docs
required_verification:
  - docs_consistency
  - rendered_parent_dashboard_check
completed_verification:
  - docs_consistency
  - rendered_parent_dashboard_check
last_proof: 2026-06-25
workflow_gaps_reviewed: 2026-06-22
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: docs/projects/spells/NORTH_STAR.md
human_decision_required: no
source_path: docs/projects/spells/NORTH_STAR.md
---
# Spells Parent North Star

status: active
Last updated: 2026-06-25

## Why This Project Exists

Spells is a parent scoped-dashboard project. It preserves the broad spell-system map while runtime execution, corpus completeness, UI flows, validation, data taxonomy, documentation, and mechanics discovery proceed through smaller child lanes.

The parent does not represent one executable implementation pass and it should not increment a single parent iteration counter for child work. The parent owns routing, lane boundaries, imported gap visibility, and the durable map of which child packet should carry each spell-system slice.

## Parent Routing Contract

Use this parent project when the work is about spell-domain ownership, lane selection, gap import policy, or dashboard discoverability. Once a concrete implementation/audit slice is chosen, move into the matching child packet listed in `SUBPROJECTS.md` and let that child own its pass status, active agent, proof, tracker updates, and local gap log.

The parent should answer four questions for a cold-start agent:

1. Which spell lane owns this work?
2. Is the lane owned by Spells, linked support, adjacent dependency, or out of scope?
3. Which parent-visible gaps need to be imported upward?
4. What dashboard evidence helps the next agent route without rediscovering the project map?

## Current Parent Objective

Keep the spell project family coherent while the spell runtime, data corpus, validation rules, UI behavior, and supporting audits expand in parallel. Preserve broad spell-system intent without turning the parent into a catch-all execution packet.

## Current State

- The Spells project is already a `parent_with_subprojects` routing surface.
- The parent registry is `docs/projects/spells/SUBPROJECTS.md`.
- The current registry tracks seven owned Spells lanes and one linked support project.
- The highest-priority parent route is the created-object / persistent-structure mechanics stream, which belongs to the Mechanics Discovery Packages child lane until a narrower runtime/data owner is selected.
- The rendered parent dashboard now surfaces that route as a recommended lane with registry proof freshness, in-place lane details, setup-packet links, and copyable/previewable child-lane handoffs.
- Parent gaps are import/routing signals only. Child packets own executable work, proof, pass telemetry, and lane-local gap detail.

## Parent Scope

In scope:
- Maintain the umbrella purpose, child-lane registry, parent gap imports, and ownership decisions for spell-domain work.
- Route implementation, audit, UI, validation, data taxonomy, documentation, and mechanics-discovery slices into the correct child packet.
- Keep linked support and adjacent dependencies visible without absorbing their ownership.
- Preserve the parent/subproject dashboard fields from `docs/projects/PROJECT_CARD_SCHEMA.md`.

Out of scope:
- Treating the parent as one executable spell-work iteration.
- Copying every child TODO, Jules receipt, Symphony state, or raw audit finding into the parent.
- Promoting linked support projects into owned Spells child lanes without an explicit ownership decision.
- Running runtime or UI implementation directly from this parent packet after a child lane has been identified.

## Child Lane Registry

The authoritative registry is `docs/projects/spells/SUBPROJECTS.md`.

| Lane | Relationship | Purpose |
|---|---|---|
| Structured Spell Execution | owned lane | Runtime execution, validation, commands, targeting, effects, and player-facing behavior. |
| Spell Completeness Audit | owned lane | Corpus completeness, source-vs-JSON audits, and imported product gap decisions. |
| Spell UI And Choice Flows | owned lane | Spellcasting panels, choice prompts, summaries, and rendered interaction proof. |
| Spell Data Taxonomy | owned lane | Tags, buckets, canonical metadata, schema fields, and corpus consistency. |
| Spell Automation And Validation | owned lane | Validators, scripts, gates, and repeatable integrity checks. |
| Spell Documentation And Handoffs | owned lane | Living docs, cold-start prompts, task packets, and routing summaries. |
| Mechanics Discovery Packages | owned lane | New spell-mechanic discovery packs that are not yet ready for runtime implementation. |
| Runtime Template Audit | linked support | Supporting audit of runtime templates; import findings only when they change spell-domain product behavior. |

## Parent Gap Policy

`GAPS.md` is a parent intake surface, not the only place spell gaps may live. Child packet gaps stay in the child packet until one of these is true:

1. The gap affects multiple child lanes.
2. The gap changes parent routing, ownership, or priority.
3. The gap is imported from a linked support project and needs Spells-domain visibility.
4. The gap is a product-behavior issue that the parent must expose on the dashboard.

Do not copy every child TODO upward. The parent should stay useful as a routing dashboard.

## Highest-Impact Resume Path

Start with `SUBPROJECTS.md`, then choose the child lane that owns the next concrete work. As of this parent refresh, the highest-impact imported lane is the created-object / persistent-structure mechanics stream currently represented by parent gap G15 and the Mechanics Discovery Packages lane.

A normal resume should be:

1. Read this file for parent scope.
2. Read `SUBPROJECTS.md` for lane ownership and priority.
3. In the rendered project tracker, use the recommended-lane callout or child-lane details to inspect the chosen lane before launching work.
4. Open or copy the dashboard handoff for the chosen child packet and run the executable pass there.
5. Update parent `GAPS.md`, `TRACKER.md`, or `DECISIONS.md` only when ownership, routing, imported gaps, or dashboard-visible status changes.

## Supporting Files

| File | Purpose |
|---|---|
| `SUBPROJECTS.md` | Parent dashboard registry and child lane routing table. |
| `TRACKER.md` | Parent-level routing, registry, and dashboard maintenance tasks only. |
| `GAPS.md` | Parent-visible imported gaps only; lane-local gaps belong in child packets. |
| `COLD_START_AGENT_PROMPT.md` | Handoff prompt that routes agents to child packets before coding. |
| `DECISIONS.md` | Durable parent routing, ownership, and import decisions. |
| `AUDIT_OR_PROOF.md` | Concise parent proof summaries plus imported child-proof references. |
| `RUNBOOK.md` | Repeatable parent onboarding and maintenance checks. |

## What Must Not Be Lost

- Spells is an expansion-first game system area; parent routing should preserve future spell mechanics rather than narrowing to the easiest current check.
- The parent is a routing dashboard. It should remain legible to agents and humans who need to choose a lane before changing behavior.
- Child packets are the executable units. Their trackers, gaps, proof notes, and cold-start prompts must stay authoritative for lane-local work.
- Linked support and adjacent dependencies matter, but they should not be silently re-owned by Spells just because they affect spell behavior.

## Evidence And Proof

| Evidence | What it proves |
|---|---|
| `docs/projects/PROJECT_CARD_SCHEMA.md` | Parent-with-subprojects dashboard schema and required `SUBPROJECTS.md` table contract. |
| `docs/agent-workflows/living-project-task-protocol/PARENT_PROJECT_WITH_SUBPROJECTS.md` | Parent ownership model, child packet setup, read order, and verification expectations. |
| `docs/projects/spells/SUBPROJECTS.md` | Current Spells child-lane registry, linked support row, adjacent dependency routing, and highest-priority lane. |
| `docs/projects/spells/subprojects/*/NORTH_STAR.md` | Child packets that own executable pass scope and proof. |
| `docs/tasks/spells/` | Historical Spell Phase package and mechanics-discovery evidence that feeds the Mechanics Discovery Packages child lane. |
| `docs/projects/scripts-spell-runtime-template-audit/NORTH_STAR.md` | Linked support ownership for runtime-template audit work that should not be absorbed by the Spells parent. |
| Browser annotation on `misc/project_tracker.html` | User feedback that the Spells parent page should follow the parent-project layout and structure. |

## Active Parent Tasks

| ID | Status | Task | Owner | Last updated | Acceptance criteria | Next action | Next proof |
|---|---|---|---|---|---|---|---|
| SP-PARENT-T1 | done | Keep the Spells parent aligned with the parent-with-subprojects layout. | Codex | 2026-06-25 | Parent `NORTH_STAR.md` has template-aligned sections; `SUBPROJECTS.md` uses canonical count keys; `misc/project_tracker.html` and `misc/project_tracker.js` now render the parent scoped child-lane dashboard inside the project detail overlay. | Keep this current when the parent template or project detail overlay changes. | Rendered `misc/project_tracker.html`, filtered to `spells`, opened the Spells parent, and observed the `Subproject Dashboard`, 8 child lanes, 7 active lanes, 7 owned lanes, 1 linked support lane, scoped filters, and all child setup packet rows. |
| SP-PARENT-T2 | active | Route the next executable pass through the highest-impact child lane. | Codex | 2026-06-25 | The chosen child packet owns pass telemetry, tracker updates, gap detail, and proof. Parent updates only routing/imported gap summary if needed. Mechanics Discovery Packages is selected by the dashboard recommended-lane callout, and Package 19 PR #1145 is the active created-object/structure pass. | Continue from the Mechanics Discovery Packages child packet and PR #1145; use the rendered handoff preview/copy action before launching another agent, and do not relaunch the same slice from the parent. | Rendered parent dashboard shows one recommended lane, registry proof freshness, in-place lane details, setup-packet link, handoff preview/copy parity, and child tracker/proof update only after child work changes parent-visible state. |

## Resume Path

1. Read this North Star, then `SUBPROJECTS.md`.
2. Choose the lane named by the user or the `highest_priority` row in `SUBPROJECTS.md`.
3. Read that child's `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md`.
4. Do executable work inside the child packet, not the parent.
5. After the child pass, update this parent only if routing, counts, ownership, imported gaps, or dashboard-visible status changed.

## Boundary

The parent may summarize runtime and audit proof, but it should not become the proof owner for child implementation work. Keep detailed validation output in the child project or the relevant task packet; import concise proof here only when it explains a parent routing decision.
