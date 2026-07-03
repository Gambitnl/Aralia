# Sub-spec: Edge = escape

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** specced, not built.

## Decision
No invisible walls. Crossing the patch boundary means leaving the fight: fleeing NPCs despawn into the world sim (their relationship state remembers the fight); the player crossing is a party-level retreat attempt. No dynamic arena re-anchoring — revisit only if chase fights prove the need.

## Open
- Retreat resolution (free? opportunity attacks? pursued into travel state?).
- What "the sim remembers" concretely records for a fled hostile (returns later? reports the player?).
