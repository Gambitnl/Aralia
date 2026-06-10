# Memory System Audit Or Proof

Status: active
Last updated: 2026-06-09

This file keeps the current proof trail for Memory System dashboard claims.

## Latest Proof

| Date | Scope | Proof | Result | Notes |
|---|---|---|---|---|
| 2026-06-09 | G4 first-contact recency slice | `npm test -- --run src/hooks/actions/__tests__/handleNpcInteraction.test.ts` | passed | Proves first contact with a new NPC now refreshes interaction recency when the met fact is written. |
| 2026-06-09 | G4 egregious witness-gossip recency slice | `npm test -- --run src/hooks/actions/__tests__/handleGeminiCustom.test.ts` | passed | Proves egregious custom prompts now refresh witness interaction timestamps after gossip lands, in addition to the direct target fact recency already covered. |
| 2026-06-09 | G4 social-check and targeted prompt recency slices | `npm test -- --run src/hooks/actions/__tests__/handleGeminiCustom.test.ts` | passed | Proves the direct social-check branch and the targeted custom-prompt branch now both dispatch `UPDATE_NPC_INTERACTION_TIMESTAMP` alongside direct memory fact writes. |
| 2026-06-09 | G5 canonical formatter route | `npm test -- --run src/utils/world/__tests__/memoryUtils.test.ts` | passed | Proves the canonical world memory helper formats disposition, interactions, and known facts for AI context. |
| 2026-06-09 | Living-project doc shape | `node scripts/audit-living-project-docs.cjs` | passed | Memory now has valid dashboard front matter, all required living-project docs, and one current handoff marker. |

## Current Audit Notes

- G5 is closed in source and docs.
- G1-G4 remain open, with G4 in progress but partially advanced by the direct social-check, first-contact, targeted custom-prompt, and egregious witness-gossip recency slices.
- No Required Review Brief is needed yet because the current blockers are implementation/schema work, not a human decision gate.
