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

## What a spell leaves behind

Three kinds of thing. They look alike on screen and behave differently. Do not
merge them.

**Ground scar**
See above. The earth itself changes shape. It heals and leaves a scar mark.

**Conjured structure**
An object a spell puts into the world. Wall of Stone, Wall of Thorns, and Spike
Growth make one. The earth below it does not change. Remove the structure and
the ground is as it was.

A conjured structure has a lifetime that the caster can change. Wall of Stone
is the clear case. Hold concentration for the full duration and the structure
becomes permanent. Drop it early and the structure ends.

**Structure graduation**
The moment a conjured structure becomes permanent. After it graduates, the
structure is a normal world object. It is no longer a spell effect, and the
spell system stops owning it.

**Surface treatment**
A change to the top of the ground only. Grease, ice, and a scorch mark are
surface treatments. Nothing is built and nothing is dug.

## Judgment and review

**Judgment surface**
A place built to carry one visual decision. It shows the subject at the
distance the decision needs, beside whatever the subject must be judged
against. A screenshot in a chat is not a judgment surface, because it carries
no context and nobody can return to it.

**Verdict**
The answer a person gives on a judgment surface. A verdict names the subject,
the decision, the person, the day, and the version of the subject that was
judged. A verdict lives next to the subject, not in a conversation.

**Surface staleness**
The state of a judgment surface that no longer shows what it claims to show.
The subject changed and the surface did not follow. A stale surface is worse
than a missing one, because a reader trusts it.

**Verdict drift**
The state of a verdict that no longer covers its subject. The subject changed
after the verdict was given. The verdict still reads as approval, and it
approves something that no longer exists.

## Terms this project does NOT use

**Wound** — say **ground scar**. A wound implies full recovery, and a scar
leaves a mark.

**Material** (of a tile) — this term is taken. `BattleMapTile.material` means
the substance of an object for magic penetration and durability. It does not
describe the ground. Do not overload it.
