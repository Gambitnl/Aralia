# Depthcrawler's Journal

## 2025-05-22 - Initial Descent
**Learning:** The Underdark is currently a gap in the system. While `src/types/underdark.ts` exists, there is no dedicated service or logic driving deep-earth specific mechanics like light tracking or madness.
**Action:** I will begin by examining `src/types/underdark.ts` to see what structures are already defined, then implement the missing logic.

## 2025-05-22 - Light in the Darkness
**Learning:** Implemented a core "Light as Resource" mechanic. Light levels now decay over time (via `ADVANCE_TIME`), and darkness directly degrades Sanity.
**Insight:** By coupling Sanity loss to Light Level, we create a natural tension. Players must burn resources (torches, spells) to preserve their minds. This is a foundational "Terror Mechanic" as requested in the Vision.
**Action:** Future iterations should add visual overlays for darkness levels and specific "Madness" effects when sanity drops below thresholds.
