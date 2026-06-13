# Submap Generation Gap Registry

Status: merged-reference
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | routed | adjacent_follow_up | Submap G4 | `docs/projects/submap/GAPS.md` | source evidence pass | `SubmapPane` computes adjacent biome IDs but does not currently pass them into `useSubmapProceduralData`, so the optional blend context stays at the hook default in the main consumer. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx` | The `biomeBlendContext` contract exists and should be considered during Submap generation extraction. | Route to Submap G4. | Submap G4 records retained/extracted/retired status. |
| G5 | routed | blocked_human_decision | Submap G5 | `docs/projects/submap/GAPS.md` | user-clarified extraction pass | Replacement owner for submap generation semantics is not named. | `src/hooks/useSubmapProceduralData.ts`; `docs/projects/submap-generation/AUDIT_OR_PROOF.md`; `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Final replacement decisions should wait for extraction evidence. | Route to Submap G5. | Submap G5 records replacement owner and carried-forward semantics. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
