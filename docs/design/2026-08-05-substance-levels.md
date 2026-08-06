# Substance: what each level buys and costs

Date: 2026-08-05

## The word first

Remy asked about "strata". Strata means layers of rock. It names one part of
what he described.

He listed four things: physics, volume, interactability, and the ground. The
word that covers all four is **substance**. A world with substance is one where
things are made of something, all the way through, and answer when you act on
them.

Substance splits into four parts, and they can be bought separately:

- **Layers** — what a solid is made of, going down. This is strata, narrowly.
- **Volume** — a solid occupies space and has an inside.
- **Resistance** — a solid has mass and pushes back.
- **Consequence** — an act on a solid leaves a result.

This document prices three levels.

## How the world works today

**There is no physics engine.** No Rapier, no Cannon, no Ammo, no Jolt. The
dependency list has none.

**Movement is a table lookup.** A tile carries `blocksMovement`. A wall stops
you because a flag says so.

**Combat is honest about this and locked it deliberately.** Fight-in-place
carries two locked decisions: an invisible 5 ft referee, and gridless
presentation. Every in-scene click resolves through a 5 ft tile lattice, so
combat rules stay bit-identical to the 2D board. That is a good decision and
this document does not propose reversing it.

**Free roam plants the avatar on the terrain height.** It samples the surface at
the destination. It does not collide with anything.

So the world today has none of the four parts. It consults a table and reports a
verdict.

---

## Level 1: layers and cutting

The ground is made of something and shows it when cut. Movement stays a table
lookup.

**Buys**

- Ground scars look right. A pit shows soil over rock rather than nothing.
- Passwall, Stone Shape and Mold Earth read correctly.
- The terrain underside stops being void.
- Cut faces work on terrain, dungeon rock and built walls alike.

**Costs**

- A layer list per solid, and a producer per subject kind.
- Cut-face geometry where a cut happens.
- Terrain shell closure.

**Breaks**

- Nothing. No existing system changes behavior. Movement, combat and streaming
  are untouched.

**Does not buy**

- You still walk through a wall if a flag says you may.
- Debris does not exist. A crater produces no spoil.
- A dropped object does not land. It is placed.

---

## Level 2: real collision, no simulation

Things collide with real geometry. A wall stops you because it is there.

**Buys**

- The world resists you. This is the part that reads as "solid" more than any
  visual change.
- Movement stops depending on an authored flag, so a spell-made wall blocks
  immediately without anybody remembering to set a boolean.
- Line of sight can resolve against geometry, which is what BG3 does and what
  the gridless decision already points toward.
- Cover becomes a fact about the world rather than a stored conclusion.

**Costs**

- A collision representation for terrain, buildings, walls and props. Usually a
  simplified mesh, not the render mesh.
- It must stream. Chunks load and unload, and their colliders must follow.
- A query layer: ray casts, capsule sweeps, ground probes.

**Breaks**

- `blocksMovement` becomes a second source of truth. Either it goes, or it must
  be derived from the colliders.
- The 5 ft referee must agree with the colliders. If geometry says you can pass
  and the referee says you cannot, combat and free roam disagree. This is the
  real integration risk, and it lands on a locked decision.
- Every authored flag in `battleMapGenerator` and `groundProps` needs a story.

**Does not buy**

- Nothing falls. Nothing tumbles. A cut wall does not collapse.

---

## Level 3: real physics

A library owns mass, forces and contacts. Objects fall, tumble and settle.

**Buys**

- Consequence. A spell that shatters a wall makes rubble that lands and stays.
- Spoil from a crater becomes a mound beside it.
- Objects can be thrown, dropped and stacked.
- Structures can collapse, which is the Red Faction Guerrilla quality.

**Costs**

- A physics library and its whole discipline: fixed timesteps, sleeping bodies,
  budget management.
- Determinism becomes a problem. Aralia regenerates the world from a seed plus
  deltas. A physics simulation does not reproduce exactly across machines or
  frame rates. Anything a physics result feeds must either be recorded or
  accepted as non-reproducible.
- Debris must persist or vanish, and both choices need a rule. Persisting it
  grows the delta layer with objects nobody named.
- Combat is turn-based. Physics is continuous. The bridge between them needs
  designing, not just wiring.

**Breaks**

- Reproducibility, unless every physics outcome is recorded as a delta.
- The turn structure, at the seams where a physical event resolves during a
  turn that has rules about timing.
- Performance budgets that were set for a world with no simulation.

---

## What each level is really for

Level 1 makes the world **look** made of something.

Level 2 makes the world **feel** made of something. This is the one that
matches the question Remy asked, because resistance is what a player reads as
solidity.

Level 3 makes the world **remember what you did to it physically**. It is the
Teardown quality, and it is a different class of project.

## The honest sequencing

Level 1 does not depend on level 2. Level 2 does not depend on level 3.

Level 2 without level 1 is possible and would feel odd: a world you cannot walk
through but which shows nothing when cut.

Level 1 without level 2 is what we already specced, and it serves the spells.

The strongest argument for level 2 is not the feel. It is that the gridless
decision already points there. Combat resolves clicks against a lattice today
because there is nothing else to resolve against. Give it geometry and the
lattice becomes a rules device rather than a physical stand-in.

## The one thing worth deciding first

Level 2 lands on a locked decision. The 5 ft referee and real colliders must
agree, or free roam and combat disagree about where a creature may stand.

That agreement is the hard part of level 2. It is not a rendering question and
it is not solved by picking a library.
