## 2025-12-22 - Deferred Task: Immersive Character Creation Text

**Context:**
A plan was initiated to improve the immersion of the Character Creation UI by replacing technical terms with high-fantasy alternatives. This task was deferred to prioritize other work, but the proposed changes are documented here for future implementation.

**Proposed Changes:**
1.  **AbilityScoreAllocation.tsx**:
    *   Rename "Set Recommended Stats for {Class}" -> "Channel {Class} Archetype".
    *   Rename "Stat Recommendation for {Class}" -> "Archetype Guidance: {Class}".
    *   Rename "Confirm Scores" -> "Confirm Attributes".
    *   Rename "Consider focusing on:" -> "Prioritize:".
2.  **RaceDetailModal.tsx**:
    *   Rename "Racial Stats" -> "Ancestral Traits".

**Rationale:**
These changes aim to maintain the "High Fantasy, Immersive" tone mandated by the system instructions. Terms like "Stats" and "Recommendation" feel too mechanical (developer-speak), whereas "Archetype", "Channel", and "Ancestral Traits" fit the diegetic world of Aralia.

**Implementation Notes:**
*   The changes are purely textual and located in the JSX render methods.
*   Unit tests in `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` verified that these changes do not break functionality.
*   Frontend verification (Playwright) encountered issues with the test environment (skipping the main menu), which need to be resolved before visual verification can be automated for this flow.

**Status:**
Pending. Ready to be picked up when content polish is the primary focus.
