## 2024-05-24 - Elemental Cancellation **Learning:** Simple neutralization rules (like Fire + Cold = null) are surprisingly effective at preventing nonsensical states (e.g. "Burning Ice") without requiring complex new states or status conditions. **Action:** Prefer null/cancellation over creating new "Mixed" states when elements are diametrically opposed.
## 2024-05-24 - State Lifecycles **Learning:** Defining removal conditions (like Fire burning away Poison, or Water washing it off) turns static debuffs into dynamic puzzles, giving players agency over their status effects. **Action:** Ensure every negative state has a counter-element interaction.
## 2025-02-18 - Chemical Interactions **Learning:** Chemical states like 'Acid' function similarly to elemental ones but primarily act as negators (dissolving webs, neutralizing oil) rather than transforming into new states. **Action:** Use `null` interactions for chemical neutralization.

## 2025-12-29 - Decision: Acid Dilution

**Context:** Implementing the interaction between Acid and Water.
**Options considered:**
- Option A: `Acid` + `Wet` -> `null` (Neutralization/Dilution).
- Option B: `Acid` + `Wet` -> `Acidic Water` (New state).
- Option C: `Acid` + `Wet` -> `Wet` (Water washes away acid, leaving target wet).
**Chosen:** Option C (`Wet`).
**Rationale:** Simulates dilution and washing away. Option A implies the target is perfectly dry after washing, which is unrealistic. Option B requires a new state tag which violates the constraint of using existing tags unless necessary. `Wet` is the most physically accurate representation of "washed off with water".
