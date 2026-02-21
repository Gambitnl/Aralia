# 1D: Roadmap Orchestration Contract

**Status**: Active / Rebased (Feb 18, 2026)  
**Scope**: One-document-at-a-time roadmap processing for feature-truth updates.

## Purpose
- Keep the roadmap honest about the actual game feature state.
- Convert each processed doc into verified feature/sub-feature outcomes.
- Prevent stale docs and workflow noise from polluting roadmap structure.

## Feb 18 Rebase Alignment
- Master tree is pillar-first (game-ingredient top-level branches), not doc-bucket-first.
- Node labels should be capability-style ("what this part of the game does"), not raw checklist prose.
- Context-only headings (for example objective/layman/policy wrappers) must not be emitted as feature nodes.
- Run outputs must preserve enough structure for branch-depth audit counters (`L1/L2/L3/...`) in the visualizer.

## Roadmap-First Principles
- The roadmap models **feature intent and completion state**, not commit activity.
- A processed doc must produce:
  - feature mapping
  - completion-state evidence
  - stale-claim corrections
  - unresolved TODOs linked to the correct feature branch
- Git changed-file lists are **not** a reliable source of truth in multi-agent dirty trees.
- Session close is artifact-driven: only approved run packets are applied.
- Classification discipline:
  - `feature capability` content maps into gameplay/engineering branches.
  - `delivery/history/hardening` content may remain visible, but must be labeled as capability groups and never masquerade as generic doc headings.

## Shared Rules (Both Sides)
- Process exactly one source doc per run.
- Stage all outputs under `.agent/roadmap-local/runs/<run-id>/`.
- Worker cannot edit canonical docs directly.
- Orchestrator is the only actor allowed to apply canonical updates.
- Each run ends with a terminal status: `blocked`, `completed`, or `failed`.

## Part A: Orchestrator Contract (Controller)

### Core Responsibility
- Turn approved run packets into canonical roadmap/documentation updates that reflect real feature truth.

### Required Inputs
- Source doc path from manifest.
- Current feature tree context (pillars, features, sub-features).
- Prior adjudications/clarifications for that doc.
- Existing provenance records for moved/split docs.

### Required Flow
1. Select one `queued` doc.
2. Launch one non-interactive worker run.
3. If `blocked`, stop and gather clarifications.
4. If `completed`, validate output schema and safety guards.
5. Fact-check sampled claims against code/docs.
6. Resolve dedupe against existing branch-to-trunk nodes.
7. Integrate accepted changes into end-product docs.
8. Mark doc `processed` only after successful integration.
9. Append audit trail for the run.

### Orchestrator Hard Guards
- Reject packets with invalid schema.
- Reject packets that write outside run staging.
- Reject packets that modify canonical files directly.
- Reject split/move results without provenance mapping.
- Reject packets that fail minimum evidence checks for claimed completion state.

### Canonical Outputs Orchestrator Must Update
- `docs/@DOC-REGISTRY.md`
- feature canonical docs in organized target location
- per-feature open task files
- roadmap link targets
- processing state manifest
- run audit record

### Session-Close Behavior
- Apply only run packets where:
  - `review_result = accepted`
  - `roadmap_applied = false`
- After application, set `roadmap_applied = true`.
- Never infer roadmap updates from `git status` or combined changed-file sets.
- Session-close execution command:
  - `npm run roadmap:session-close -- --session <session-id>`
  - optional dry run: `npm run roadmap:session-close -- --session <session-id> --dry-run`

## Part B: Orchestratee Contract (Worker Agent)

### Core Responsibility
- Convert one source doc into a reviewable evidence packet for feature-truth updates.

### Required Work
- Read source doc fully.
- Extract feature/sub-feature claims and current stated completion.
- Identify stale or unverifiable statements.
- Produce proposed corrections and TODO mappings.
- Propose split/move only when the doc mixes multiple feature domains.
- Normalize proposed node labels to concise capability names.
- Tag extracted nodes with a branch class:
  - `feature_capability`
  - `delivery_pipeline`
  - `delivered_capability`
  - `hardening_backlog`
  - `constraints_or_quality_gate`

### Required Packet Files
- `run_manifest.json`
  - `run_id`
  - `session_id`
  - `doc_id`
  - `source_doc`
  - `worker_model`
  - `status`
  - `started_at`
  - `finished_at`
- `report.json`
  - extracted features/sub-features
  - branch class per extracted node
  - completion-state claims with evidence pointers
  - stale-claim list
  - unresolved TODO proposals mapped to feature branches
  - optional `crosslink_candidates` for nodes that belong to multiple branches
  - `depth_summary` (counts by level for generated branch candidates)
- `doc.patch.md`
  - proposed canonical text updates for this doc scope
- `move_plan.json` (only if split/move needed)
  - new location(s)
  - source-to-target provenance map

### Required Schemas
- `docs/tasks/roadmap/schemas/run_manifest.schema.json`
- `docs/tasks/roadmap/schemas/report.schema.json`
- `docs/tasks/roadmap/schemas/move_plan.schema.json`
- Orchestrator must validate packet files against these schemas before review.
- Validation command: `npm run roadmap:validate-packet -- --run .agent/roadmap-local/runs/<run-id>`

### Preflight Question Gate
- Allowed once before work proceeds.
- If clarification is required, worker must return:
  - `status: "blocked"`
  - `why_blocked`
  - `questions: []`
- Worker exits immediately after returning blocked packet.

### Worker Hard Guards
- Do not mark docs processed.
- Do not alter registry or feature canonical docs directly.
- Do not invent factual completion claims.
- Mark uncertain claims explicitly as uncertain.
- Emit strict machine-parseable output where requested.
- Do not emit context-only heading wrappers as feature nodes (examples: objective, layman clarifications, execution discipline boilerplate).

## Data Source Priority (When Conflicts Exist)
1. Authoritative strategic intent docs (per active plan policy).
2. Current code reality.
3. Processed canonical feature docs.
4. Legacy/older docs.
5. Commit metadata (supporting evidence only).

## Failure Modes and Controls
- **Workflow-over-feature drift**: reject outputs that describe only implementation steps without feature outcomes.
- **Dirty-tree confusion**: do not use changed-file inference; use approved packets only.
- **Duplicate node inflation**: normalize names and dedupe against branch path before adding nodes.
- **Completion hallucination**: require evidence pointers and perform spot-check before acceptance.
- **Stale document recycling**: block processed-marking until canonical doc + roadmap + task files are all updated.
- **Question loops**: `max_question_rounds = 1` per run.

## Versioning
- Contract version: `v0.3`
- Any contract change must update this file and referenced plan sections.
