# Submap Decisions

Status: review-required
Last updated: 2026-06-09

## Decision Log

### D-001: Preserve Before Replacement

Date: 2026-06-09

Decision: Keep the current DOM/tile Submap as the live gameplay surface while
renderer authority is unresolved.

Rationale:

- `SubmapPane` is still the source of quick-travel, inspect, hover/path preview,
  tooltip, and click-routing behavior.
- `src/components/Submap/painters` may contain reusable visual assumptions, but
  it is not documented as the authoritative replacement path.
- The safe phase-out path is dependency extraction first, then a human/product
  renderer decision, then proof-backed migration.

### D-002: Review Gate Remains Active

Date: 2026-06-09

Decision: Keep Submap `review-required` and do not assign forward implementation
work until the renderer authority decision in `NORTH_STAR.md` is resolved.

Rationale:

- A future renderer could preserve, move, or replace visual logic, but the
  project cannot safely choose that direction without losing behavior.
- The current dependency contract narrows the decision by naming the preserved
  gameplay and state contracts.
