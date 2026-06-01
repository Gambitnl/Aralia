# Item Icons North Star

Status: active  
Last updated: 2026-05-31

## Purpose and Scope

Create a living docs surface for item icon execution so agents can resume work quickly and consistently without re-discovering process.  
This project stays scoped to `docs/tasks/item-icons` planning docs and does not request code changes.

## Project State

- Project is registered as planned in `docs/projects/PROJECT_TRACKER.md`.
- The folder currently contains:
  - `JULES_ACCEPTANCE_CRITERIA.md`
  - `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md`
  - `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`
- Batch checklists are present but no items are checked complete in the batch files currently reviewed.
- There is currently only one observed item icon asset in `public/assets/icons/items` and it is not tied to a completed batch in docs.

## File Map

- `NORTH_STAR.md`: project summary, scope, and execution resume path.
- `TRACKER.md`: active queue, task posture, and gap routing.
- `GAPS.md`: preserved open questions and blockers.
- `JULES_ACCEPTANCE_CRITERIA.md`: source of output constraints for SVG generation.
- `BATCH-01-ITEMS.md` to `BATCH-41-ITEMS.md`: execution slices (20 items per batch except final batch of 10).

## Implemented vs Planned

Implemented:
- Registry-linked scaffolding files exist for this project.
- Canonical execution split into 41 batches is documented.

Planned:
- Generate SVG assets under `public/assets/icons/items/{item_id}.svg` for each listed item.
- Keep execution in-bounds to documentation-defined acceptance rules and asset-only output.
- Keep `TRACKER.md`/`GAPS.md` updated as batches advance.

## Integrations / Runtime Touchpoints

- Item glossary definitions mostly carry symbolic icon tokens in source docs (`src/data/items/generatedGlossaryItems.ts`) and are not fully expressed as direct `/assets/icons/items/*.svg` paths.
- `public/assets/icons/general/*` contains existing general icons, but not the full item icon set under this project.
- Direct item icon adoption flow is partially unknown until generation + consumption checks confirm.

## Gaps / Uncertainties

- Canonical icon taxonomy is not discoverable in the current item-icons evidence.
- The project currently has a potential gap between symbolic icon identifiers and file-path-based icon use.
- There is no evidence of batch-level completion checkpoints tied to UI rendering verification.

## Next Checks

- After each batch: verify all listed icon files exist and are valid SVG (`viewBox 0 0 24 24`, no non-file edits).
- Confirm the runtime lookup path for item icon rendering and whether symbolic IDs require a mapping step.
- Review updated batch state for any mismatch between batch list IDs and glossary entry IDs.
