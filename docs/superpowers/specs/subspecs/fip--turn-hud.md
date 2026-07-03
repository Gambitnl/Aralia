# Sub-spec: In-scene turn HUD

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** parked.

## Scope
The combat UI (initiative order, action economy, ability bar, movement remaining in feet) rendered inside the streamed-world scene during in-place fights. First slice may reuse the existing battle-map HUD components wholesale; the presentation-parity matrix governs what must be legible before the battle-map fallback retires.

## Open
- Which existing CombatView components port unchanged vs need a world-overlay variant.
- Where damage/status labels render (3D HTML labels exist in the battle map — port).
