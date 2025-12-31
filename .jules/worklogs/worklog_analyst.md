## 2025-12-29 - Gap Analysis: NPC Memory for Spell Consequences

**Learning:** I discovered that while `NPC` and `NPCMemory` types exist, there was no active system to record memories. Specifically, spells like `Charm Person` have post-effect consequences ("Creature knows it was charmed") that had no mechanical way to be tracked.

**Action:** Created `MemorySystem` (stateless service) and added `'magical_manipulation'` to `MemoryInteractionType`.

**Future:** This system needs to be wired into `SpellSystem` or `StatusConditionCommand` to automatically trigger when specific conditions (like Charmed) expire.

## 2025-12-30 - Gap Analysis: Planar Interaction Rules

**Learning:** Spells like *Blink* and *Etherealness* require characters to exist on different planes simultaneously during combat. The existing `CombatState` had a map-wide `currentPlane`, but individual characters lacked a "phase" state to determine if they were on the Material or Ethereal plane relative to each other.

**Action:** Implemented `planarPhase` and `planarVision` properties on `ActiveEffect` mechanics. Created `src/utils/planarTargeting.ts` to centralize `canInteract` and `canSeeTarget` logic, enforcing 5e rules (Ethereal sees Material but cannot interact; Material cannot see Ethereal).

**Future:** The *Blink* spell still needs a turn-end trigger system to handle the d20 roll automatically. Currently, the system only handles the state *if* the effect is applied.
