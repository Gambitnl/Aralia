# Item Icons North Star

Status: complete
Last updated: 2026-06-25

## Purpose and Scope

Create a living docs surface for item icon execution so agents can resume work quickly and consistently without re-discovering process.
This project stays scoped to `docs/tasks/item-icons` planning docs and item SVG assets.

## Project State

- Project is registered as planned in `docs/projects/PROJECT_TRACKER.md`.
- The folder currently contains:
  - `JULES_ACCEPTANCE_CRITERIA.md`
  - `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`
- The old `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md` backlog files were validated as still-relevant work, migrated into the gap/tracker record, executed, and deleted on 2026-06-25.
- `public/assets/icons/items` now contains 810 generated item SVGs, one per checklist item.

## File Map

- `NORTH_STAR.md`: project summary, scope, and execution resume path.
- `TRACKER.md`: completed queue, task posture, and gap routing.
- `GAPS.md`: completed gap record and remaining routing notes.
- `JULES_ACCEPTANCE_CRITERIA.md`: source of output constraints for SVG generation.
- `scripts/generateItemIconSvgs.mjs`: deterministic generator used for the 2026-06-25 SVG pass.

## Implemented vs Planned

Implemented:
- Registry-linked scaffolding files exist for this project.
- Canonical execution split into 41 batches was completed and retired.
- 810 item SVG assets exist under `public/assets/icons/items/{item_id}.svg`.

Planned:
- Future art-direction passes may replace individual generated SVGs with more bespoke art if product quality requires it.

## Integrations / Runtime Touchpoints

- `scripts/generateItemRegistry.ts` switches a generated item icon to `/assets/icons/items/{id}.svg` when the matching SVG exists.
- `src/utils/visuals/visualUtils.ts` already renders item icons that are path-like strings.
- `public/assets/icons/general/*` remains the curated general icon surface for older armor/weapon fallbacks.

## Gaps / Uncertainties

- The item icon pass uses deterministic type/name-based SVG generation, not final bespoke art direction.
- Broader item taxonomy questions remain owned by `docs/projects/item_categorization/GAPS.md`.

## Next Checks

- If product quality requires hand-authored art, replace icons in place without restoring the old batch checklist backlog.
- Regenerate `src/data/items/generatedGlossaryItems.ts` after icon changes when a runtime proof needs the item registry to point at newly present SVGs.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/item-icons/NORTH_STAR.md","sha256WithoutMarker":"5e7ac0d071feadabfc66c985aea41158d6fcdc69762340fd3b4e4630364518a8","markedAtUtc":"2026-06-25T22:29:38.309Z"} -->
