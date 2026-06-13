# Submap Generation Living Tracker

Status: merged-reference
Last updated: 2026-06-09

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T4 | routed | Decide whether the optional biome blend input should be threaded through extracted generation logic. | Submap G4 | 2026-06-09 | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `docs/projects/submap/GAPS.md` | Route through Submap G4; do not assign this project separately. | Submap G4 records whether adjacency is retained, extracted, or retired. |
| T5 | routed | Name the replacement owner for preserved generation semantics. | Submap G5 | 2026-06-09 | `src/hooks/useSubmapProceduralData.ts`; `docs/projects/submap-generation/AUDIT_OR_PROOF.md`; `docs/projects/submap/DEPENDENCY_CONTRACT.md`; `docs/projects/submap/GAPS.md` | Route final replacement questions through Submap G5 after extraction evidence is ready. | Submap G5 records replacement owner and carried-forward semantics. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | routed | adjacent_follow_up | Submap G4 | `docs/projects/submap/GAPS.md` | source evidence pass | `SubmapPane` computes adjacent biome IDs but does not currently pass them into `useSubmapProceduralData`, so the optional blend context stays at the hook default in the main consumer. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx` | The `biomeBlendContext` contract exists and should be considered during Submap generation extraction. | Route to Submap G4. | Submap G4 records retained/extracted/retired status. |
| G5 | routed | blocked_human_decision | Submap G5 | `docs/projects/submap/GAPS.md` | user-clarified extraction pass | Replacement owner for submap generation semantics is not named. | `src/hooks/useSubmapProceduralData.ts`; `docs/projects/submap-generation/AUDIT_OR_PROOF.md`; `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Final replacement decisions should wait for extraction evidence. | Route to Submap G5. | Submap G5 records replacement owner and carried-forward semantics. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
