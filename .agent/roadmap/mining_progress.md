# Ralph Deep Mining Progress

## Current Status: Rebased (Categorization First)
- Total Files Discovered: 1,686 (from `docs/@ALL-MD-FILES.md`, generated Feb 12, 2026)
- Current Pointer: 0
- Milestones Created: 0
- Active Strategy: Start with source-of-truth docs, then expand outward.
- Processing Mode: One document at a time (sequential human-readable outputs).
- Pilot Mode: First pass is a 5-document sequential pilot.
- Internal Workspace: `.agent/roadmap-local/` (gitignored).

## Phase 0: Categorization Pass (Before Mining)
- [ ] Define source-of-truth buckets (registry + task docs + roadmap control docs).
- [ ] Define secondary/support buckets.
- [ ] Define generated/low-signal buckets (`dist/`, tool/vendor caches, etc.).
- [ ] Produce a categorized manifest for batch planning.

## Phase 1: Registry Refactor
- [ ] Convert `@ALL-MD-FILES.md` from a static dump into tracked processing manifests.
- [ ] Add explicit processed-state tracking per document (machine-readable).

## Phase 2: Source-of-Truth Mining Batches
- [ ] Batch 1 (Files 1-50)
- [ ] Batch 2 (Files 51-100)
...

## Pilot Queue (Approved)
- [ ] `docs/tasks/roadmap/1B-ROADMAP-VISUALIZER-EVOLUTION-HANDOVER.md`
- [ ] `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md`
- [ ] `docs/@DOC-REGISTRY.md`
- [ ] `docs/VISION.md`
- [ ] `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md`

## Per-Document Extraction Contract
- [ ] Mark document processing state (`queued`, `indexed`, `verified`).
- [ ] Assign document to a feature pillar.
- [ ] Capture feature completion state.
- [ ] Capture discovered sub-features and their completion states.
- [ ] Before creating nodes, check branch-to-trunk for existing feature/sub-feature matches.
- [ ] Add unresolved TODOs as sub-feature nodes under the correct feature parent.
- [ ] Move processed docs to feature-oriented location and preserve provenance reference.
- [ ] Update roadmap links to moved canonical paths.
- [ ] Remove processed docs from `docs/@ALL-MD-FILES.md`.
- [ ] Store traceable links so roadmap can explain where each feature signal came from.

## Phase 3: Obsolescence Gate
- [ ] Define the exact condition that allows archive/deletion of static mining queues.
- [ ] Archive or delete obsolete static lists once dynamic indexing coverage is verified.
