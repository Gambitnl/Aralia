# Submap Decisions

Status: active
Last updated: 2026-06-10

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

### D-005: UI-Independent Action Contract Module

Date: 2026-06-10

Decision: Centralize quick-travel and inspect payload assembly in
`src/utils/spatial/submapActionContracts.ts` with focused Vitest proof.

Rationale:

- `SubmapPane` payload rules were embedded in click handlers, making future
  navigation surfaces re-derive semantics from UI code.
- Handler clamping and inspect storage-key format are now testable without
  mounting React components.
- SubmapPane wiring is deferred to G7 so this pass stays additive and safe.

### D-006: Replacement Surface Named — Azgaar-Continuation Proc-Gen Submap System (G5)

Date: 2026-06-10

Decision: Decided by Remy (project owner) in the 2026-06-10 batched decision
session. The replacement surface for local navigation is the **new
Azgaar-continuation proc-gen submap system** from the June 2026 campaign:
Azgaar-based generation extended below Azgaar's deepest zoom replaces the
Submap, continuing into a 3D ground-level mode. The in-flight extraction
contracts — G7/G8, `src/utils/spatial/submapActionContracts.ts`, and
`docs/projects/submap/DEPENDENCY_CONTRACT.md` — are the inventory the new
system must honor.

Rationale:

- The June 2026 campaign (2026-06-10 → 2026-06-22) builds a unified procedural
  world pipeline with Azgaar as canonical; a proc-gen submap continuation of
  that pipeline is the natural local-navigation owner. See the
  "Context: the June 2026 campaign" section of
  `docs/projects/DECISION_BLITZ_2026-06-10.md` (master record, D3).
- Naming the replacement unblocks the final deprecation architecture question
  (G5) without short-circuiting safety: extraction work continues, and
  component deprecation still requires proof that the replacement honors the
  inventoried contracts.
- This resolves the review gate kept open by D-001 through D-004: the
  "preserve before replacement" posture stands until the replacement proves
  contract coverage.
