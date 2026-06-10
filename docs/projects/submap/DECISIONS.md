# Submap Decisions

Status: active
Last updated: 2026-06-09

## Decision Log

### D-001: Preserve Before Replacement

Date: 2026-06-09

Decision: Preserve the current DOM/tile Submap in place while renderer and
replacement ownership are unresolved.

Rationale:

- `SubmapPane` is still the source of quick-travel, inspect, hover/path preview,
  tooltip, and click-routing behavior.
- `src/components/Submap/painters` may contain reusable visual assumptions, but
  it is not documented as the authoritative replacement path.
- The safe phase-out path is dependency extraction first, then a human/product
  renderer decision, then proof-backed migration.

### D-002: Review Gate Remains Active

Date: 2026-06-09

Decision: Superseded by D-003. The earlier renderer-authority review gate is
now folded into the broader deprecated replacement-owner review gate.

Rationale:

- A future renderer or navigation surface could preserve, move, or replace
  visual logic, but the project cannot safely choose that direction without
  losing behavior.
- The current dependency contract narrows the decision by naming the preserved
  gameplay and state contracts.

### D-003: Superseded Immediate Deprecation Framing

Date: 2026-06-09

Decision: Superseded by D-004. This briefly marked Submap
deprecated/reference-only after explicit user direction, but the later
clarification keeps Submap active for extraction before component deprecation.

Rationale:

- The current Submap surface is being phased out, but it still contains
  quick-travel, inspect, tooltip, hit-testing, timing, and painter assumptions.
- Deleting or replacing the system without a migration owner would risk losing
  gameplay behavior.
- The safe path is dependency extraction and reviewer-facing migration
  decisions, not more implementation in the deprecated project.

### D-004: Pre-Deprecation Extraction Scope

Date: 2026-06-09

Decision: Clarified by user: Submap should not become a dead reference-only
project yet. It should become the active extraction/modularization project that
identifies all dependent systems and lifts retained functions before component
deprecation.

Rationale:

- The action menu, compass, movement/observation handlers, Minimap, material
  lookup, generation hooks, painter path, town/village generation overlap,
  puzzle TODOs, save/map compatibility, and design/tooling references still
  depend on Submap concepts.
- Removing or freezing the project too early would hide the actual work:
  extracting still-relevant behavior and deciding what replaces the surface.
- Sub-agents may work on extraction/inventory/proof slices, but must not delete
  systems or replace the UI components until proof and owner decisions exist.
