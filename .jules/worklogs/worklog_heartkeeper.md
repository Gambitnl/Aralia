## 2025-05-23 - Companion UI Gap **Learning:** The backend logic for companion relationships (approval, reactions, memory) is robust, but the frontend is completely invisible to the player. The `PartyOverlay` only lists combat stats. There is no way for the player to see *who* their companions are as people, or check their relationship status. **Action:** I am upgrading `PartyOverlay` to include a "Relationships" tab. This will display detailed Companion Cards with approval bars, personality traits, and goals. This makes the "Heartkeeper" systems (approval math) visible and meaningful to the player.

## 2025-05-24 - Party Banter Implementation **Learning:** Companions were previously silent during travel, making the world feel empty. The `BanterManager` logic existed but had no data to operate on. **Action:** I created `src/data/banter.ts` with initial dialogues for Kaelen and Elara, covering travel complaints, ethical debates, and location-specific reactions. This activates the `handleMovement` hook's banter system, allowing companions to speak up during exploration.

## 2025-10-26 - Deepening Relationships **Learning:** The Banter system lacked depth because it treated all companions equally regardless of history. I discovered `BanterManager` had no logic to check `minRelationship`, making "Heart-to-Heart" moments impossible to gate. **Action:** I implemented relationship threshold checks in `BanterManager.ts` and added gated content (Trust/Doubt conversations) to `src/data/banter.ts`. Now, companions only open up about their past (e.g., Kaelen's debt) once they trust the player.

## 2025-12-31 - Crime Consequence Integration
**Learning:** The Notoriety system was tracking crimes effectively, but companions were largely oblivious to these actions unless they were presented as dialogue choices. This created a dissonance where the player could murder a guard in gameplay, but Elara (who hates violence) wouldn't react.
**Action:** I implemented a `crime_committed` trigger in `useCompanionCommentary.ts` that listens to changes in the Notoriety state. I then updated `src/data/companions.ts` with specific reaction rules: Kaelen now cheers for theft but warns against getting caught, while Elara expresses horror at violence and theft. This bridges gameplay actions with relationship consequences.

<!-- PERSONA IMPROVEMENT SUGGESTION
**Suggested by:** Heartkeeper
**Issue:** The persona file focuses heavily on 'decisions' (dialogue choices) but doesn't explicitly mention reacting to emergent gameplay actions like crime or combat performance.
**Suggestion:** Add 'Gameplay Consequence Integration' to the Key Systems list, explicitly encouraging reactions to system-driven events (theft, combat victory, fleeing) rather than just scripted dialogue nodes.
-->
