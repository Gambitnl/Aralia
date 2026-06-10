# Memory System Runbook

Status: active
Last updated: 2026-06-09

This runbook gives the next agent the shortest safe path for Memory System work.

## Routine Checks

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md`.
2. Review `DECISIONS.md` and `AUDIT_OR_PROOF.md` before changing memory ownership or proof claims.
3. Check active formatter imports with `rg -n "formatMemoryForAI" src`.
4. Run the focused handler tests when touching social-check or first-contact memory coverage:
   `npm test -- --run src/hooks/actions/__tests__/handleGeminiCustom.test.ts src/hooks/actions/__tests__/handleNpcInteraction.test.ts`
5. Run the focused memory utility test when touching formatter behavior:
   `npm test -- --run src/utils/world/__tests__/memoryUtils.test.ts`
6. Run the living-project docs audit before accepting a worker pass:
   `node scripts/audit-living-project-docs.cjs`

## Current Work

- G5 is done: active AI formatter usage now points at `src/utils/world/memoryUtils.ts`.
- G4 now has a source-backed partial closure: direct social-check outcomes, first-contact dialogue, targeted custom-prompt outcomes that attach to an NPC, and egregious witness-gossip outcomes all stamp interaction recency.
- G1-G4 remain open.
- G4 is still the next likely implementation slice unless G1 schema normalization is required first; the remaining open branches are combat and ritual mapping.

## Resume Notes

- Do not delete `src/utils/memoryUtils.ts`; it is a compatibility bridge.
- Do not route new active imports through the bridge.
- If G1 or G2 turns into a product/ownership decision rather than implementation work, add a Required Review Brief before assigning more forward workers.
