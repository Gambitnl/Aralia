# Submap Generation Decisions

Status: merged-reference
Last updated: 2026-06-09

## Decision Log

- D1 - The canonical source-backed generation contract is documented from the
  hook and its consumers, not from `src/features/SubmapGeneration` alone.
  `src/features/SubmapGeneration` remains an evidence surface.
- D2 - Superseded 2026-06-09. User direction deprecated sub-map work, so this
  project is no longer assignable for forward implementation.
- D3 - The durable contract note should keep generation ownership in the hook
  and visual projection in the consumers. This pass does not reassign the
  renderer or world runtime.
- D4 - Keep Submap Generation reference-only until the replacement
  map/navigation owner is named. The preserved CA/WFC/path/seeded-feature and
  biome-blend semantics are migration evidence, not an implementation queue.
- D5 - Supersedes D4 routing only: after user clarification, Submap Generation
  remains evidence, but active generation extraction is assigned through
  `docs/projects/submap/` G4 instead of this project.

## Decision Boundary

Forward implementation for generation extraction now belongs to
`docs/projects/submap/` G4. Do not assign this project separately.
