# Crafting UI Gaps

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker | docs/projects/crafting/ (adjacent) and systems/crafting owners | docs/projects/crafting-ui/NORTH_STAR.md update | Align UI skill/crafter model with systems ownership | `src/components/Crafting/GatheringPanel.tsx`, `src/components/Crafting/CreatureHarvestPanel.tsx` use mocked crafter derivation instead of shared character integration | Move mocked roll/proficiency inputs into shared crafter state contracts before adding new interactions | Verify both flows use same crafter source and party skill model |
| G2 | active | in_scope_now | Worker | src/state/actionTypes.ts / src/state/reducers/craftingReducer.ts | docs/projects/crafting-ui/NORTH_STAR.md update | Tighten crafting action payload typing to typed quality/category unions | Reducer expects strict behavior while action type uses `quality: string`, `category: string` | Add typed action payloads in action types and align reducer callers in panels | Build passes for typecheck or bounded type-focused compile run |
| G3 | active | support_needed_now | Worker | src/systems/crafting (upstream) | docs/projects/crafting-ui/NORTH_STAR.md update | Resolve experimental damage handling contract | `src/components/Crafting/ExperimentPanel.tsx` only logs damage text | Decide whether damage should call shared HP actions and what resistance path to use | Add contract note in systems tracker or this project's gap when decision is made |
| G4 | active | adjacent_follow_up | Worker | docs/projects/crafting/ | docs/projects/crafting-ui/NORTH_STAR.md update | Reconcile UI windowing patterns | Only Alchemy bench uses `WindowFrame`; gathering and creature harvest use custom overlays | Decide if window pattern should be standardized for UX consistency | Add a follow-up in systems UI review if this remains intentional |
| G5 | active | adjacent_follow_up | Worker | src/systems/crafting | runtime scan | Add durable test coverage for panel flows and reducer contracts | No focused tests found in scan of component and system coupling points | Keep this for next implementation slice; no code changes now | Add test filenames in next tracker row with pass criteria |

## Classification Guide

- `in_scope_now`: blocks reliable continuation if left unresolved.
- `support_needed_now`: required so implementation decisions are safe.
- `adjacent_follow_up`: real gap, but not needed to finish the current docs-only pass.

## Routing note

- This project stays focused on UI surface continuity and contract gaps.
- Cross-project ownership of core mechanics remains in `docs/projects/PROJECT_TRACKER.md` under `Crafting System`.
- If a gap is fully accepted by systems owners, import or route it there and keep this project's status aligned.

