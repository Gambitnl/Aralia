# Submap Gap Registry

Status: active
Last updated: 2026-05-31

Use this file for durable unresolved findings that genuinely belong to Submap
UI and component ownership. Route generation-internal gaps to
`docs/projects/submap-generation/GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/TRACKER.md` | protocol refresh | UI contract for generated output was implicit and required formalization. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Prevents UI from inventing assumptions about generated tile semantics. | Split into G2 and G3 with explicit payload/render ownership questions. | Confirm G2 and G3 tracked in `TRACKER.md`. |
| G2 | not_started | adjacent_follow_up | future agent | `docs/projects/submap/TRACKER.md` | integration review | Formalize quick-travel payload contract between Submap UI and action handler pipeline. | `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts` | Avoids regressions in path duration, encounter timing, and step delay behavior. | Define canonical fields/units and validation expectations. | Compare dispatch payload with handler assumptions during a travel repro. |
| G3 | not_started | adjacent_follow_up | future agent | `docs/projects/submap/TRACKER.md` | renderer review | Determine authoritative renderer path for submap visuals. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/painters` | Reduces risk of duplicated rendering behavior and maintenance drift. | Document decision: active renderer, compatibility constraints, and migration if needed. | Validate map and path rendering parity against existing screenshots or playtest. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.
