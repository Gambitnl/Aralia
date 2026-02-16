# 1C: Roadmap Visualizer Implementation Plan

**Status**: Active / Rebased (Feb 16, 2026)  
**Goal**: Deliver the "Elastic Knowledge Tree" target state from `1B-...HANDOVER.md`, with deterministic data and zero "Jerry-work."

## Confirmed Decisions (Locked)
- This file is the canonical implementation plan for the roadmap initiative.
- `1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md` is authoritative for target state when docs conflict.
- Runtime context: single owner workflow, but app is accessed from other PCs over local network during dev.
- Networking rule: roadmap read/write calls must be same-origin and host-relative (no hardcoded IP assumptions).
- Roadmap data/artifacts are internal-only and must live in a gitignored location (not synced to GitHub).
- Internal roadmap workspace path is `.agent/roadmap-local/`.
- P0 blockers are:
  - Deterministic node IDs.
  - File-backed layout persistence with deterministic IDs (no random suffixing).
- Terminal-first visual design is mandatory.
- Roadmap is currently visualizer-only; markdown edit/write-back from UI is out of scope for this phase.
- Mining should start with source-of-truth docs after a categorization pass.
- Processing cadence is one document at a time (no bulk "scan 24 at once" review output).
- Layout persistence mode: file-only (no primary browser fallback).
- "Open in VS Code" action is approved for this phase.
- Dependency cross-links are visual-only (no physics coupling).
- `RALPH` insight mode uses hybrid behavior: pre-index during doc processing, live re-scan on source change or manual refresh.

## Phase 0: Determinism Guardrails (P0)
- [ ] Replace random ID suffix logic in `scripts/roadmap-server-logic.ts` with deterministic ID generation.
- [ ] Add hard validation for task-number collisions (generation must fail with explicit error).
- [ ] Add failure messaging in `/api/roadmap/data` path so bad registry data is obvious and actionable.

## Phase 1: Layout Persistence (P0)
- [ ] Create gitignored roadmap workspace `.agent/roadmap-local/` as canonical store.
- [ ] Create `layout.json` in that internal workspace as canonical layout store.
- [ ] Add layout merge on read in `scripts/roadmap-server-logic.ts`.
- [ ] Add save endpoint (`/api/roadmap/layout`) in `vite.config.ts` to write `layout.json`.
- [ ] Update `RoadmapVisualizer.tsx` Save flow to POST layout data to server with file-only persistence.
- [ ] Ensure roadmap API URLs are host-relative/same-origin so changing LAN IPs does not require config edits.

## Phase 2: Visualizer Alignment (No Editing)
- [ ] Set Terminal theme as default (neon green/black/scanline language).
- [ ] Keep Arcane as optional theme toggle (not default).
- [ ] Model hierarchy as Feature -> Sub-feature -> Components, not workflow-document chains.
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
- [ ] Attach features to pillars, and sub-features to features, while preserving dependency links.
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

## Deferred Scope (Intentional)
- Status/progress/priority/domain editing from side panel.
- `/api/roadmap/update` markdown write-back endpoint.
- Multi-user conflict resolution strategy (not needed while visualizer remains single-user and read-only).

## Open Decisions for User Clearance
- Confirm exact per-feature "open tasks" file naming/location convention.
- Confirm which Vision artifact is canonical when `docs/VISION.md` is stale during ingestion.

## Pilot Scope (Initial Iteration)
- [ ] Run first pilot on 5 documents, processed sequentially one-by-one with review after each.
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
4. Validate Terminal-first defaults render on load.
5. Confirm no write-back/edit controls are exposed in visualizer UI.

### Session Hygiene
After verification completes, execute `/session-ritual` to:
- Sync modified file dependencies via the Codebase Visualizer.
- Extract terminal learnings discovered during this task.
- Review and propose inline TODOs for future work.
