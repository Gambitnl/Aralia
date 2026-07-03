# Sub-spec: Relationship × courage bystander disposition

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** specced, not built.

## Decision
Every NPC caught in a combat area reacts per a two-axis disposition: RELATIONSHIP to each side (the NPC combatants AND the player + party) × COURAGE. Allies/friends may join, aid, or shelter the wounded; kin/faction of the enemy side may join against the player; guards side per law; neutral strangers flee home/indoors (the town sim knows every occupant's house — reuse commuter motion) or cower/watch by courage. Input data: the living-world sim's existing relationship graph.

## Open
- Courage: new per-NPC stat or derived from existing traits/occupation.
- Guard identification + law model (what makes the town side against the player).
- Threshold tuning: how close "caught in the area" is.
