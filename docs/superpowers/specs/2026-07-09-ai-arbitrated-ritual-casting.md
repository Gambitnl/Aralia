# Spec: AI-arbitrated, state-aware ritual casting

**Status:** design captured 2026-07-09 from Remy. Not yet built. Needs a brainstorm pass to fill gaps, then a phased build. The background ritual clock already exists (start/advance/interrupt/complete) — see the existing ritual engine. This spec replaces the earlier "tabletop progress-bar" framing with a background, AI-arbitrated, social-and-environmental drama.

## The core idea

A ritual is not a foreground bar the player watches. It is a background narrative process. The drama comes from **who is around the player** and **what is happening around them**, arbitrated by personality and awareness. Most of the time the player does not micromanage it — the game rolls it in the background and only surfaces a moment when something meaningful happens.

## The player's current state sets the mode

The handling depends on where the player is — specifically the **threat level** of the place.

### Safe place → a quiet background roll
In a safe place the ritual runs as a narrative dice roll in the background, largely without the player's knowledge. Interruptions come from the **social situation**, not from monsters:

- The game must know **who is around** the player right now (party members, nearby NPCs).
- A companion who does not understand magic, or who is not yet aware the player is mid-ritual, may cause a **distraction event** — a light, in-character moment. The player is then prompted to **roll for concentration**.
- Interruption likelihood is **personality-driven**. A quiet or shy companion is less likely to interrupt. A comedian, or someone not too bright, is more likely to.
- A companion who **knows the player and knows what they are doing** may step in to head off the disruptor before it breaks focus — but only if there is more than one companion present. If the would-be disruptor is the player's only companion, no one intervenes.

### Higher threat level → an environmental danger roll
In a more dangerous place the ritual is threatened by the world:

- The player may simply be **waylaid by enemies** mid-cast.
- Or the surroundings emit **signals** — sounds or sights — that the player may catch via **passive perception**. When they do, the game surfaces a line such as "You hear …" or "You see …", and the player may choose to **abort** the ritual.
- Companions also roll passive perception. Because there is no flexible per-event difficulty system yet, model this as a **background difficulty check** that decides, for each present character, whether they automatically notice or miss the signal.
- A character who notices a danger then **chooses a reaction driven by personality**: actively investigate it, sound the alarm, or privately dismiss it as nothing. A paranoid trait pushes toward investigate/alarm; a careless trait pushes toward dismissal even after noticing.

## What this needs (dependencies and gaps)

1. **An awareness model** — who is physically near the player, and who among them knows the player is ritual-casting. Ties into the NPC/party presence data and NPC memory ([[npc-memory-reconciliation]] — a companion "knows what the player is doing" is a memory fact).
2. **Personality-driven behavior** — interruption and reaction probabilities keyed off NPC personality traits (quiet/shy, comedian, low-intelligence, paranoid, careless). Needs the NPC personality system to expose these traits to the ritual arbiter.
3. **A flexible event-difficulty mechanism** — currently missing. Passive-perception-vs-arbitrary-signal needs a way to set a difficulty per event and roll each present character against it. This is a reusable mechanic beyond rituals; flag it as its own gap.
4. **AI arbitration (Ollama-gated)** — generate the narrative flavor: the distraction moment, the "you hear/see X" signal, and each NPC's reaction line, grounded in personality and situation. This is the "heavily AI-arbitrated" part. It must respect the no-fallback / provider-config direction ([[llm-provider-config]]).
5. **Player-facing prompts only when they matter** — a concentration roll or an abort choice surfaces to the player; the routine background rolls do not.
6. **Reuse the existing ritual engine** — the second-based background clock, interrupt records, and the "player is busy during a ritual" hook already exist. The completion payoff (actually casting the finished effect) and the backlash-on-failure calculation are still stubs and must be built.

## Suggested build phases (to refine in brainstorming)

1. **Awareness + state read** — determine threat level of the current place and the set of present characters + whether each knows about the ritual.
2. **Background roll loop** — advance the ritual quietly; decide per-tick whether a social or environmental event fires, based on state.
3. **Event-difficulty mechanic** — the reusable per-event DC + per-character pass/fail roll (also unblocks other systems).
4. **Personality-driven arbitration** — map traits to interruption/reaction probabilities; pick the acting NPC.
5. **AI narration layer** — Ollama-arbitrated flavor for distractions, signals, and NPC reactions.
6. **Player moments** — surface concentration rolls and abort choices; wire the real completion effect and backlash.

## Open questions for the brainstorm
- How is "threat level of a place" sourced today (biome danger, encounter tables, the travel danger tiers just shipped)?
- Where do NPC personality traits live, and are quiet/comedian/paranoid/careless already modeled or do they need adding?
- Should aborting cost anything (partial backlash, wasted components, time)?
- How does this interact with combat (a ritual interrupted into a fight)?
