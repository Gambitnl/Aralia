# Aralia — domain glossary

This file is a glossary. It holds terms and their meanings. It holds no
implementation detail, no plan, and no decision record. Decisions live in
`docs/adr/`.

## Ground and terrain

**Ground scar**
A change to the ground made by an actor rather than by generation. A spell, a
siege engine, or a dug pit all make one. A scar has a shape, a depth, a cause,
and a day of birth. A scar heals over time. See **Scar mark**.

**Scar mark**
What remains after a ground scar heals. The mark records that the soil was
disturbed and what disturbed it. A mark does not change the height of the
ground. It changes what grows there and how the ground reads. A mark does not
expire.

**Scar cause**
Why a ground scar exists. Fire, blast, excavation, and flood are causes. The
cause decides how the scar heals and what its mark looks like afterward. Two
scars of the same shape and different causes grow back differently.

**Heal**
The process by which a ground scar loses depth. A scar heals toward the height
the generator produced. When a scar reaches zero depth, the scar record ends
and its mark begins. Heal is a verb only. Do not use it for creature hit
points in ground terminology.

**Terrain sim**
The system that advances ground scars through time. The terrain sim owns one
local window. It holds the last day it simulated, and it catches up when the
player loads that window. It mirrors the town sim, which solved the same
problem for town life.

**Local window**
The generated square of ground the player occupies. The world generates one
per atlas cell on demand. It is the unit the terrain sim owns.

## Terms this project does NOT use

**Wound** — say **ground scar**. A wound implies full recovery, and a scar
leaves a mark.

**Material** (of a tile) — this term is taken. `BattleMapTile.material` means
the substance of an object for magic penetration and durability. It does not
describe the ground. Do not overload it.
