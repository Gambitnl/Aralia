# Memory System Decisions

Status: active
Last updated: 2026-06-09

This file records stable Memory System decisions that should survive cold starts.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | Active AI memory formatting should import the canonical world helper at `src/utils/world/memoryUtils.ts`. | recorded | `src/services/gemini/items.ts`, `src/utils/world/memoryUtils.ts`, `src/utils/world/__tests__/memoryUtils.test.ts` | The old `src/utils/memoryUtils.ts` bridge remains only for legacy compatibility and must not receive new active callsites. |
| D-02 | The memory wrapper should be fenced, not deleted, until external or stale imports are proven gone. | recorded | `src/utils/memoryUtils.ts`, `docs/projects/memory/GAPS.md` | Preserves compatibility and follows the project rule against deleting systems during stale-system cleanup. |
| D-03 | Direct social-check outcomes should refresh NPC interaction recency in addition to disposition and fact writes. | recorded | `src/hooks/actions/handleGeminiCustom.ts`, `src/hooks/actions/__tests__/handleGeminiCustom.test.ts`, `docs/projects/memory/NORTH_STAR.md` | Keeps the long-rest drift mechanic honest for a direct social branch that otherwise looked like a pure dialogue side effect. |
| D-04 | Targeted custom-prompt outcomes that attach to an NPC should also refresh interaction recency when they write a direct fact. | recorded | `src/hooks/actions/handleGeminiCustom.ts`, `src/hooks/actions/__tests__/handleGeminiCustom.test.ts`, `docs/projects/memory/TRACKER.md` | Keeps prompt-based direct interactions aligned with the talk and social-check lanes without expanding the handler into a new memory system. |
| D-05 | Egregious custom-prompt outcomes that trigger witness gossip should refresh witness interaction recency after gossip lands. | recorded | `src/hooks/actions/handleGeminiCustom.ts`, `src/hooks/actions/__tests__/handleGeminiCustom.test.ts`, `docs/projects/memory/AUDIT_OR_PROOF.md` | Keeps gossip-spread social touchpoints from aging out as stale the moment they are created, without changing combat semantics or the reducer ownership model. |
| D-06 | First contact with a newly generated NPC should refresh interaction recency when the met fact is written. | recorded | `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/__tests__/handleNpcInteraction.test.ts`, `docs/projects/memory/NORTH_STAR.md` | Keeps the "meeting" moment aligned with the met fact so long-rest drift and AI memory context treat initial contact as a real social touchpoint. |

## Open Follow-Ups

- G1 still needs a canonical gameplay memory schema decision between the `NpcMemory` and `NPCMemory` shapes.
- G2 still needs an ownership decision for `src/systems/memory/MemorySystem.ts` versus reducer/action-handler memory lanes.
- G4 still needs the remaining combat and ritual coverage branches or a prerequisite reroute if schema work blocks them.
