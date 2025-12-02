- [x] Plan Completed

# Plan: Improve Point Buy UI in Character Creation

## 1. Purpose

The goal of this improvement is to enhance the user experience of the `AbilityScoreAllocation.tsx` component. The current UI, which relies solely on increment/decrement buttons, is functional but can be tedious for players who already know their target ability scores.

This plan will introduce a dropdown menu next to each ability score, allowing users to directly select a target value (e.g., 15). The component will then automatically calculate the point cost difference and update the state. The increment/decrement buttons will be retained for fine-tuning.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Update the Component UI and State Handling

-   [ ] **Modify File**: `src/components/CharacterCreator/AbilityScoreAllocation.tsx`
-   **Code Direction**:
    1.  **Add Dropdown Element**: In the JSX for each ability score, add a `<select>` element next to the existing `<span>` that displays the score.
    2.  **Populate Dropdown**: The dropdown options should range from `POINT_BUY_MIN_SCORE` (8) to `POINT_BUY_MAX_SCORE` (15).
    3.  **Create New Handler**: Implement a new handler function, `handleScoreSelect`, that will be triggered by the `onChange` event of the dropdown.

-   **Envisioned Code Change in `AbilityScoreAllocation.tsx`**:
    ```tsx
    // src/components/CharacterCreator/AbilityScoreAllocation.tsx
    // ... imports ...

    const AbilityScoreAllocation: React.FC<AbilityScoreAllocationProps> = ({ /* ... props ... */ }) => {
      // ... existing state and hooks ...

      // New handler for the dropdown selection
      const handleScoreSelect = (abilityName: AbilityScoreName, newScoreValue: number) => {
        const currentScore = baseScores[abilityName];
        if (newScoreValue === currentScore) return; // No change

        const oldCostForAbility = ABILITY_SCORE_COST[currentScore];
        const newCostForAbility = ABILITY_SCORE_COST[newScoreValue];
        const costDifference = newCostForAbility - oldCostForAbility;

        // Check if the change is affordable
        if (pointsRemaining >= costDifference) {
          setBaseScores(prev => ({ ...prev, [abilityName]: newScoreValue }));
        } else {
          // Optional: Provide feedback to the user that they can't afford this score.
          // For example, by briefly flashing the "Points Remaining" display red.
          // For now, we can just prevent the state update.
          alert(`You do not have enough points to set ${abilityName} to ${newScoreValue}.`);
        }
      };

      // ... existing JSX ...
      // Inside the .map loop for ABILITY_SCORE_NAMES:
      return (
        <div key={abilityName} className="p-3 ...">
          <h4 className="text-lg ...">{abilityName}</h4>

          <div className="flex items-center justify-center space-x-2 my-1">
            <button onClick={() => handleScoreChange(abilityName, -1)} /* ... */>-</button>

            {/* The span is replaced or augmented with a select */}
            <select
              value={currentBaseScore}
              onChange={(e) => handleScoreSelect(abilityName, parseInt(e.target.value, 10))}
              className="text-2xl font-bold text-sky-300 bg-gray-800 border border-gray-600 rounded-md focus:ring-sky-500 focus:border-sky-500"
              aria-label={`Select score for ${abilityName}`}
            >
              {Object.keys(ABILITY_SCORE_COST).map(score => (
                <option key={score} value={score}>{score}</option>
              ))}
            </select>

            <button onClick={() => handleScoreChange(abilityName, 1)} /* ... */>+</button>
          </div>
          {/* ... rest of the JSX for cost, bonus, final score ... */}
        </div>
      );
    };
    ```

### Phase 2: Refine UI and UX

-   [ ] **Modify File**: `src/components/CharacterCreator/AbilityScoreAllocation.tsx`
-   **Code Direction**:
    1.  **Styling**: Apply appropriate Tailwind CSS classes to the new `<select>` element to ensure it matches the application's dark, thematic aesthetic.
    2.  **Disable Options**: The options in the dropdown should be dynamically disabled if selecting them would exceed the `pointsRemaining`. This provides immediate feedback to the user about which scores are affordable.
    3.  **Layout Adjustment**: The layout for each ability score block may need to be adjusted (e.g., using Flexbox or Grid) to neatly accommodate the new dropdown alongside the existing increment/decrement buttons. The buttons could be made smaller to flank the new, more prominent dropdown selector.

-   **Envisioned Dropdown Option Logic**:
    ```jsx
    // Inside the dropdown's .map loop
    <option
      key={score}
      value={score}
      disabled={(ABILITY_SCORE_COST[parseInt(score)] - ABILITY_SCORE_COST[currentBaseScore]) > pointsRemaining}
    >
      {score}
    </option>
    ```

### Phase 3: Verification

-   [ ] **Test Functionality**:
    -   Verify that selecting a score from the dropdown correctly updates the base score, final score, and `pointsRemaining`.
    -   Verify that unaffordable options in the dropdown are disabled.
    -   Verify that the increment/decrement buttons still work correctly in conjunction with the dropdown.
    -   Test edge cases, such as trying to select the same score, or switching between abilities.
-   [ ] **Visual Polish**: Ensure the new layout looks clean, is responsive, and is intuitive to use.