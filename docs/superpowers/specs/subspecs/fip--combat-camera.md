# Sub-spec: Combat camera (tactical orbit + free toggle)

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** specced, not built.

## Decision
On initiative start the camera pulls up into a BG3-style tactical orbit: rotate/zoom, centered on the combat area, focus snapping to the active actor each turn (fulfills the worldforge spec's original tactical-orbit ambition). One key breaks into free camera at any time and back. Free-roam position dispatches and the agent clock freeze during combat.

## Open
- Orbit constraints (min/max pitch, collision with buildings/roofs in tight streets).
- Focus-snap behavior on enemy turns (follow vs stay).
