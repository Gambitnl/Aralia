# 1C: Roadmap Visualizer Implementation Plan

**Status**: Active / Rebased + Modularization Baseline (Feb 20, 2026)  
**Goal**: Deliver the "Elastic Knowledge Tree" target state from `1B-...HANDOVER.md`, with deterministic data and zero "Jerry-work."

## Current High-Level State (Feb 20, 2026)
- Pillar-first master tree is active with 10 canonical game-ingredient top-level nodes.
- Visualizer now starts fully collapsed and expands branch-by-branch.
- Node cards now show descendant depth counts (for example `L1/L2/L3`) to make branch size explicit.
- Canvas layout is grid-snapped, and grid rendering now zooms/pans with the roadmap layer.
- Theme now defaults to dark while preserving user toggle preference.
- 3D branch normalization pass is active:
  - non-feature context headings are filtered from feature branches,
  - operational/checklist sentence nodes are being remapped into capability-style feature names.
- Legacy/noisy child nodes are now being removed and replaced through curated branch passes (delete/replace, not hide).
- Node detail descriptions are being normalized to layman summaries with canonical-doc links.
- Core roadmap code modularization baseline is now active:
  - server generation entrypoint is split into `scripts/roadmap-engine/` with compatibility bridge at `scripts/roadmap-server-logic.ts`,
  - server modules now include `manifest`, `feature-mapping`, `pillar-inference`, `text`, `collision`, and shared `constants`,
  - visualizer UI is split into `src/components/debug/roadmap/` modules (`RoadmapVisualizer`, `graph`, `tree`, `utils`, `constants`, `types`) with compatibility bridge at `src/components/debug/RoadmapVisualizer.tsx`.
- Remaining focus areas:
  - crosslink rendering (thin dotted lines + toggle),
  - deterministic collision fail-fast in generation path,
  - continued feature-label normalization across processed docs,
  - iterative section-by-section curation with user approval.

## Confirmed Decisions (Locked)
- This file is the canonical implementation plan for the roadmap initiative.
- `1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md` is authoritative for target state when docs conflict.
- Runtime context: single owner workflow, but app is accessed from other PCs over local network during dev.
- Networking rule: roadmap read/write calls must be same-origin and host-relative (no hardcoded IP assumptions).
- Roadmap data/artifacts are internal-only and must live in a gitignored location (not synced to GitHub).
- Internal roadmap workspace path is `.agent/roadmap-local/`.
- P0 blockers are:
  - Deterministic node IDs.
  - File-backed layout persistence with deterministic IDs (no suffix fallback on collisions).
- Roadmap is currently visualizer-only; markdown edit/write-back from UI is out of scope for this phase.
- Roadmap documentation updates should capture general design decisions; avoid overfitting plan docs to temporary per-node specifics.
- Mining should start with source-of-truth docs after a categorization pass.
- Processing cadence is one document at a time (no bulk "scan 24 at once" review output).
- Layout persistence mode: file-only (no primary browser fallback).
- "Open in VS Code" action is approved for this phase.
- Dependency cross-links are visual-only (no physics coupling).
- Dependency cross-link visibility defaults to ON (user can toggle OFF).
- Parent drag behavior moves the full descendant branch (all child depths), not only direct children.
- `RALPH` insight mode uses hybrid behavior: pre-index during doc processing, live re-scan on source change or manual refresh.
- Per-feature open-task files live at `.agent/roadmap-local/features/<feature-slug>/open_tasks.md`.
- Node descriptions should stay layman-readable and link to canonical current docs instead of historical source-line copy.
- Legacy child/subfeature noise should be pruned and replaced with curated branches, not hidden via view-mode toggles.
- Vision conflict policy: when `docs/VISION.md` conflicts with processed feature docs, escalate to user for adjudication before applying canonical updates.
- Obsolescence gate: entries are only eligible for removal after user roadmap review confirms coverage.
- Agent CLI smoke baseline completed on February 16, 2026 for `gemini`, `claude`, `kilo`, and `cline` (with `minimax/minimax-m2.5` validated for Cline act-mode reads/completions).
- `cline` and `kilo` CLI behavior is time-sensitive due rapid upstream updates; re-run smoke checks before each new doc-processing batch.

## Phase 0: Determinism Guardrails (P0)
- [x] Replace suffix fallback logic with strict deterministic ID registration (collisions fail generation).
- [ ] Add hard validation for task-number collisions (generation must fail with explicit error).
- [x] Add failure messaging in `/api/roadmap/data` path so bad registry data is obvious and actionable.

## Phase 1: Layout Persistence (P0)
- [ ] Create gitignored roadmap workspace `.agent/roadmap-local/` as canonical store.
- [ ] Create `layout.json` in that internal workspace as canonical layout store.
- [ ] Add layout merge on read in `scripts/roadmap-server-logic.ts`.
- [ ] Add save endpoint (`/api/roadmap/layout`) in `vite.config.ts` to write `layout.json`.
- [ ] Update `RoadmapVisualizer.tsx` Save flow to POST layout data to server with file-only persistence.
- [ ] Ensure roadmap API URLs are host-relative/same-origin so changing LAN IPs does not require config edits.

## Phase 2: Visualizer Alignment (No Editing)
- [x] Default to dark theme while preserving user toggle control.
- [x] Model hierarchy as Feature -> Sub-feature -> Components, not workflow-document chains.
- [x] Default to collapsed branch view and allow granular expansion down the tree.
- [x] Show per-node descendant counters by level (`L1/L2/L3/...`) for auditability.
- [x] Align node positioning to grid-snapped layout and keep grid synced to zoom/pan transforms.
- [ ] Represent dependencies as cross-links between feature branches where required.
- [ ] Parent-child drag behavior: pulling a parent moves its attached sub-features/components with it.
- [ ] Keep dependency cross-links visual-only; only hierarchy links participate in drag motion.
- [ ] Implement "Open in VS Code" for linked roadmap docs (dev-only).
- [ ] Implement hybrid `RALPH` insights pipeline (pre-indexed store + on-demand refresh).

## Phase 3: Mining Pipeline and Obsolescence
- [ ] Run categorization pass over markdown inventory to separate:
  - Source-of-truth docs.
  - Secondary/support docs.
  - Generated/low-signal docs.
- [ ] Mine source-of-truth bucket first and track processed state in a machine-readable manifest.
- [ ] During each document pass, extract and map:
  - Feature pillar ownership.
  - Feature completion state.
  - Sub-features discovered from the document.
  - Sub-feature completion state.
- [ ] Define explicit obsolescence gate for `docs/@ALL-MD-FILES.md` archival/deletion based on verified indexing coverage.

## Phase 4: Feature-Centric Roadmap Modeling
- [ ] Build roadmap around game pillars (from Vision docs) as top-level branches.
- [x] Lock top-level game-ingredient pillars as canonical master nodes (initial taxonomy pass completed Feb 18, 2026):
  - `UI & Player Surfaces`
  - `Character Systems`
  - `World Exploration`
  - `Combat Systems`
  - `Social & Party Systems`
  - `Narrative & Quest Systems`
  - `Economy & Progression`
  - `Content Reference (Glossary/Compendium)`
  - `Data, Persistence & Determinism`
  - `Technical Foundation & Tooling`
- [ ] Attach features to pillars, and sub-features to features, while preserving dependency links.
- [ ] Add crosslink rendering mode for shared subfeatures (thin dotted lines + toggle on/off).
- [x] Start remapping 3D exploration operational/checklist branches into capability-oriented feature nodes.
- [x] Filter context-only pseudo-features from `docs/tasks/3d-exploration/implementation_plan.md` branch derivations.
- [x] Start curated replacement pass for legacy/noisy child nodes (delete/replace policy).
- [ ] Before creating a new node, walk the branch toward the trunk and reuse existing matching feature/sub-feature nodes.
- [ ] Allow deeper branch growth where needed (no hard depth lock in this phase).
- [ ] Ensure each processed doc contributes to feature/sub-feature state updates, not just "processed" flags.

## Phase 5: Per-Document Processing Workflow (One at a Time)
- [ ] Fully read a single target document.
- [ ] Fact-check each major claim against code reality and current implementation.
- [ ] Update stale/incorrect sections in the document.
- [ ] If a document spans multiple features, split it physically by feature.
- [ ] Move processed document(s) into feature-oriented storage structure with provenance reference to original path.
- [ ] Update roadmap links to new canonical path(s).
- [ ] Remove processed entry from `docs/@ALL-MD-FILES.md`.
- [ ] Add any open TODOs as sub-feature nodes under correct feature parent after "branch exists" checks.
- [ ] Append/refresh a per-feature open-task file for unresolved follow-ups.
- [ ] Run relevance check so processing does not inject irrelevant roadmap noise.
## Phase 6: Vision Document Freshness
- [ ] Add a post-feature-run checklist to refresh `docs/VISION.md` (or successor vision source) with:
  - New feature/sub-feature outcomes.
  - Updated completion state.
  - Changes to pillar-level priorities.
- [ ] Log every vision refresh event in roadmap processing artifacts for auditability.

## Phase 7: One-Doc-at-a-Time Agent Orchestration (High-Level)
- Contract reference: `docs/tasks/roadmap/1D-ROADMAP-ORCHESTRATION-CONTRACT.md`
- Orchestration must be artifact-driven (approved run packets), not changed-file inference from a dirty tree.
- [ ] Run one document job at a time from a queue manifest.
- [ ] For each job, run one external agent execution in non-interactive mode (auto-shutdown on completion).
- [ ] Require the agent to output only staged artifacts to `.agent/roadmap-local/runs/<doc-id>/`:
  - `report.json` (feature/sub-feature extraction + stale claims + proposed TODO nodes).
  - `doc.patch.md` (proposed doc update content only).
  - `move_plan.json` (if split/move is proposed, include provenance mapping).
- [ ] Do not allow external agents to directly modify canonical docs.
- [ ] After agent completion, Codex performs:
  - Schema validation of staged artifacts.
  - Claim spot-check against code/docs.
  - Dedupe checks against branch-to-trunk node path.
  - Final integration into end-product docs (registry, feature docs, roadmap links, open task files).
- [ ] Mark the source doc as processed only after integration finishes.
- [ ] Run session-close apply step for accepted packets:
  - `npm run roadmap:session-close -- --session <session-id>`
  - Use `--dry-run` before apply for verification.

## Model Sufficiency Snapshot (Feb 16, 2026)
- `claude`:
  - `sonnet`: suitable for canonical doc-processing runs (best precision in this benchmark set).
  - `opus`: suitable, but higher overhead for similar extraction quality.
- `gemini`:
  - `gemini-2.5-pro`: suitable as a secondary worker/reviewer, but output normalization is required.
  - `gemini-2.5-flash`: acceptable for triage/summarization; not preferred for final canonical extraction.
- Operational note: Gemini CLI emits extension/bootstrap logs before model output; orchestration must strip logs and parse JSON defensively.

## Failure Modes to Control in Orchestration
- Output-parse failure: agent returns prose/log noise instead of strict JSON.
- Silent drift: model update changes extraction behavior between runs.
- Hallucinated fact-checking: agent asserts code/doc state that does not exist.
- Duplicate node inflation: same feature/sub-feature created with variant naming.
- Bad split/move proposal: document moved without stable provenance mapping.
- Premature processed-marking: queue marks a doc complete before integration/verification.
- Cross-run contamination: stale session context leaks between documents.
- Path safety issues: agent writes outside staging scope.
- Same-doc race: two runs process the same source doc concurrently.
- Regression by integration: approved patch degrades existing canonical feature docs.

## Deferred Scope (Intentional)
- Status/progress/priority/domain editing from side panel.
- `/api/roadmap/update` markdown write-back endpoint.
- Multi-user conflict resolution strategy (not needed while visualizer remains single-user and read-only).

## Open Decisions for User Clearance
- No open theme-preference decision (default theme bias removed by request).

## Pilot Scope (Initial Iteration)
- [x] Run first pilot on 5 documents, processed sequentially one-by-one with review after each (completed Feb 16, 2026).
- [ ] Pilot queue:
  - `docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md`
  - `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`
  - `docs/@DOC-REGISTRY.md`
  - `docs/VISION.md`
  - `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md`

## Verification Plan
1. Generate roadmap data with known-good registry and confirm deterministic IDs remain stable across runs.
2. Introduce a deliberate task-number collision and verify generation fails with clear diagnostics.
3. Save node layout, reload, and confirm coordinates restore from `.agent/roadmap-local/layout.json`.
4. Validate configured default theme renders on load.
5. Confirm no write-back/edit controls are exposed in visualizer UI.

### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.
