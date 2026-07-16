# Absorbed: Memory System (docs/projects/memory)

Status: active reference — absorbed into planmap topic `npc-memory-reconciliation` on 2026-07-16.
The living-project folder was deleted (git history is the archive). This doc keeps the NPC
memory file map, the settled ownership decisions, and the two still-open gaps' context.

## What this lane is

The live social state layer behind NPC interaction, suspicion, gossip, and goal effects:
memory model ownership in runtime state, memory mutation/action dispatch paths, world-side
memory evolution (gossip, residue, rest effects), AI memory context in dialogue, and the
save/load migration behavior tied to memory fields. Out of scope: combat outcome semantics
and any full social/relationship schema redesign.

## Settled decisions (G1 + G2, resolved 2026-07-09 — do not relitigate)

- Canonical shape = the live `NpcMemory` in `src/types/world.ts`. `KnownFact` gained
  optional `factKey`/`confidence`/`significance` and a widened `source` union;
  `interactions: Interaction[]`, `attitude: number`, `discussedTopics: Record<string,number>`
  were tightened. `NPCMemory` (`src/types/memory.ts`) is now an alias of the canonical type.
- Runtime owner = the `npcReducer` lane. The orphaned `src/systems/memory/MemorySystem.ts`
  (zero live callers) and its test were deleted; the richer helpers in
  `src/utils/world/memoryUtils.ts` were repointed onto the canonical shape. Save/load
  backfills the new optional fields from `strength`.
- Proof at resolution: tsc 635 baseline (no regression), 28/28 memory/npc/gemini tests green.
  Full narrative: `docs/superpowers/plans/2026-07-09-npc-memory-reconciliation-handover.md`.

## File map (evidence-verified 2026-06-12)

- `src/types/world.ts` — canonical `NpcMemory` for `GameState.npcMemory` and
  `REGISTER_GENERATED_NPC` payloads; `src/types/memory.ts` — alias only.
- `src/state/initialState.ts` — static NPC memory init; `src/state/appState.ts` —
  startup/load paths, migration of legacy `knownFacts` string arrays;
  `src/state/reducers/npcReducer.ts` — all memory mutations (root reducer delegates here).
- Action producers: `handleWorldEvents.ts` (gossip spread, residue, long-rest maintenance),
  `handleResourceActions.ts` (long-rest batch updates), `handleMovement.ts` (travel-boundary
  gossip), `handleNpcInteraction.ts` (talk flow + first-contact met fact + recency stamp),
  `handleGeminiCustom.ts` (social-check outcome, targeted prompt fact/recency, goals,
  suspicion, disposition). Memory actions: `UPDATE_NPC_DISPOSITION`, `ADD_NPC_KNOWN_FACT`,
  `UPDATE_NPC_GOAL_STATUS`, `PROCESS_GOSSIP_UPDATES`, `UPDATE_NPC_INTERACTION_TIMESTAMP`,
  `BATCH_UPDATE_NPC_MEMORY`, `REGISTER_GENERATED_NPC`.
- AI context readers: `handleNpcInteraction.ts` (`generateNPCResponse`),
  `handleGeminiCustom.ts` (`generateSocialCheckOutcome`), `src/services/gemini/items.ts`
  (`formatMemoryForAI`).

## Gaps carried onto the planmap topic (G3 + G4 context)

- G3 (serialization): load migration only handles legacy `knownFacts` string arrays; no
  schema checksum or unknown-field normalization. Next: explicit migration policy +
  invariants for memory fields (disposition, suspicion, disposition timestamps, goals),
  proven by a migration fixture test in the memory-relevant save/load path.
- G4 (coverage): not all social-producing pathways emit memory actions. Covered with proof:
  direct social-check recency, first-contact recency, targeted custom-prompt recency,
  egregious witness-gossip recency. NOT yet mapped: combat and ritual branches. Next: build
  the explicit action-to-memory mapping matrix before adding social mechanics; prove one
  representative combat path and one ritual path.
