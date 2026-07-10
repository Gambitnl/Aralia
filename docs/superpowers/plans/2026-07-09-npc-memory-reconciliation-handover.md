# Handover: determine whether the two NPC-memory systems should merge or stay separate

**Status:** ready to pick up. Written 2026-07-09. Remy wants a deeper determination before any code changes: are these two similar systems that need merging, or genuinely separate systems serving different purposes?

## The prompt to hand the agent

> You are investigating Aralia's two NPC-memory systems (F:\Repos\Aralia, master) to answer ONE question for Remy: **are these the same system that got forked and should be merged, or two purpose-built systems that should stay separate?** Do NOT change code until that question is answered and Remy has decided. Deliver a clear recommendation with evidence.
>
> **The two systems:**
> 1. **World-state memory** — `NpcMemory` in `src/types/world.ts:173`. The LIVE one. Per-townsperson record: disposition (like/dislike), suspicion, plain-text known facts, goals. Filled by real play (talking, haggling, crime, gossip, long-rest decay) via `src/state/reducers/npcReducer.ts` and the action handlers under `src/hooks/actions/`. Read back by recruitment, the dossier UI, haggling. ~20 live consumers. State holds it as `npcMemory: Record<string, NpcMemory>` (`src/types/state.ts:350`).
> 2. **Social-cognition memory** — `NPCMemory` in `src/types/memory.ts:87`. DORMANT. Richer model: timestamped interactions, emotional tone, per-fact confidence, importance, automatic decay/forgetting. Toolkit in `src/systems/memory/MemorySystem.ts` (self-labeled orphan, no live callers) and `src/utils/world/memoryUtils.ts`. Filled only in its own unit tests. One dead read path via `src/services/gemini/items.ts` (the guide-AI formatter) that never runs live.
>
> **What to determine:**
> 1. **Same-or-different intent.** Read the git history / comments / any design docs for both. Is `memory.ts` an intended upgrade of `world.ts` memory (there's a "replace with structured NPCMemory when the models merge" TODO in `src/services/npcGenerator.ts`), or was it built for a different purpose (e.g. a specific AI-companion or dialogue subsystem) that legitimately wants a different shape?
> 2. **What each is FOR.** Characterize the purpose each serves. The live one drives town social state (disposition/suspicion/recruitment/prices). What was the dormant one meant to drive — richer dialogue, an AI guide, long-term relationship arcs, the living-world sim? Find the design intent, don't guess.
> 3. **The fact-shape conflict.** The one genuine data-modeling difference is the "fact" type: the live `KnownFact` (`world.ts:138`: text, public flag, strength, lifespan, source direct/gossip) vs the richer `Fact` (`memory.ts:68`: id, learned-date, confidence, importance, wider sources). Lay both out side by side and propose what a single canonical fact should carry IF merging — or explain why they shouldn't be one shape.
> 4. **Note the half-merge already present:** `world.ts`'s live type has been quietly extended with optional fields from the richer one (interactions, attitude, discussedTopics, lastInteractionDate), and seeded objects carry both. Assess whether that's a deliberate migration in progress or accidental drift.
>
> **Deliver:** a recommendation — MERGE (with the canonical shape + a migration sketch + consumer count), or KEEP SEPARATE (with the distinct purpose each serves and how they should relate, e.g. the richer one layered on top for specific features). Plain-English (GOV.UK style, US spelling). Evidence with file:line. Then Remy decides and a follow-up packet executes.
>
> **Relevant future consumer:** the AI-arbitrated ritual feature ([[ai-arbitrated-ritual-casting]]) needs to know whether a companion "knows the player is ritual-casting" — that is a memory fact, so the canonical memory shape affects it.

## Why this is decision-gated
The fact shapes conflict semantically, and "merge vs keep separate" depends on the *original intent* of the richer system — which is a design question, not a mechanical one. Getting it wrong means either rewriting ~20 live consumers for no reason, or deleting a system that was meant for a feature not yet built.
