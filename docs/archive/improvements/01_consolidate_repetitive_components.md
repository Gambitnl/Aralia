- [x] Plan Completed

# Plan: Consolidate Repetitive Components

## 1. Purpose

The goal of this improvement is to refactor the numerous, nearly identical racial spellcasting ability selection components currently located in `src/components/CharacterCreator/Race/` into a single, reusable, and configurable component. This will significantly reduce code duplication, enhance maintainability, and simplify the process of adding new races that require a similar choice from the player.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Create the Reusable Component

-   [x] **Create New File**: `src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx`
-   **File and Folder Structure**: The new component will reside alongside the other race-specific selection components.
-   **Envisioned Code Content**:
    ```tsx
    // src/components/CharacterCreator/Race/RacialSpellAbilitySelection.tsx
    /**
     * @file RacialSpellAbilitySelection.tsx
     * A reusable component for any race that needs to select a spellcasting ability
     * (Intelligence, Wisdom, or Charisma) for one of its racial traits.
     *
     * DEPENDS ON:
     * - ../../../types (for AbilityScoreName)
     * - ../../../constants (for RELEVANT_SPELLCASTING_ABILITIES)
     *
     * USED BY:
     * - ../CharacterCreator.tsx (as a generic step for multiple races)
     */
    import React, { useState } from 'react';
    import { motion } from 'framer-motion';
    import { AbilityScoreName } from '../../../types';
    import { RELEVANT_SPELLCASTING_ABILITIES } from '../../../constants';

    interface RacialSpellAbilitySelectionProps {
      // The name of the race for display purposes (e.g., "Aarakocra")
      raceName: string;
      // The name of the racial trait that grants the spellcasting choice (e.g., "Wind Caller")
      traitName: string;
      // A description of the trait and the choice the player is making.
      traitDescription: string;
      // Callback to the parent component (CharacterCreator) to confirm the selection.
      onAbilitySelect: (ability: AbilityScoreName) => void;
      // Callback to navigate back to the previous step in character creation.
      onBack: () => void;
    }

    const RacialSpellAbilitySelection: React.FC<RacialSpellAbilitySelectionProps> = ({
      raceName,
      traitName,
      traitDescription,
      onAbilitySelect,
      onBack
    }) => {
      const [selectedAbility, setSelectedAbility] = useState<AbilityScoreName | null>(null);

      const handleSubmit = () => {
        if (selectedAbility) {
          onAbilitySelect(selectedAbility);
        }
      };

      // The JSX structure will be virtually identical to the existing components,
      // but will use the props to display dynamic text.
      return (
        <motion.div /* animation props */>
          <h2 className="text-2xl text-sky-300 mb-4 text-center">{raceName} Trait: {traitName}</h2>
          <p className="text-sm text-gray-400 mb-6 text-center">
            {traitDescription}
          </p>
          {/* ... UI for selecting an ability from RELEVANT_SPELLCASTING_ABILITIES ... */}
          <div className="flex gap-4 mt-8">
            <button onClick={onBack} /* ... */>Back to Race</button>
            <button onClick={handleSubmit} disabled={!selectedAbility} /* ... */>Confirm Ability</button>
          </div>
        </motion.div>
      );
    };

    export default RacialSpellAbilitySelection;
    ```

### Phase 2: Refactor Character Creator Logic

-   [x] **Modify State Management**: `src/components/CharacterCreator/state/characterCreatorState.ts`
    -   **Code Direction**:
        1.  **Consolidate Enums**: Combine the multiple `CreationStep` enum members (e.g., `AarakocraSpellcastingAbility`, `AirGenasiSpellcastingAbility`, `DeepGnomeSpellcastingAbility`, `DuergarMagicSpellcastingAbility`) into a single, generic enum: `RacialSpellAbilityChoice`.
        2.  **Add Context to State**: Add a new property to the `CharacterCreationState` interface to hold the context needed by the generic component.
            ```typescript
            // In CharacterCreationState interface
            racialSpellChoiceContext: {
              raceName: string;
              traitName: string;
              traitDescription: string;
              // A new action type to dispatch upon selection, which tells the reducer
              // which specific state field to update (e.g., 'aarakocraSpellcastingAbility').
              dispatchActionType: string;
            } | null;
            ```
        3.  **Update Reducer**: Modify the `characterCreatorReducer`. In the `SELECT_RACE` action handler, update the `determineNextStepAfterRace` logic. For races that need this choice, it should now return `CreationStep.RacialSpellAbilityChoice` and populate the new `racialSpellChoiceContext` state field with the appropriate details.

-   [x] **Modify Main Component**: `src/components/CharacterCreator/CharacterCreator.tsx`
    -   **Code Direction**:
        1.  **Update Imports**: Remove the imports for all the old, individual components and import the new `RacialSpellAbilitySelection`.
        2.  **Update `renderStep()`**: Consolidate the multiple `case` statements into one for `CreationStep.RacialSpellAbilityChoice`. This case will render the new generic component, passing the context from the state and a generic `handleRacialAbilitySelect` callback.
        3.  **Create Generic Callback**: Implement `handleRacialAbilitySelect` which will dispatch an action using the `dispatchActionType` from the context, ensuring the correct property in the main state is updated (e.g., `dispatch({ type: context.dispatchActionType, payload: selectedAbility })`).

### Phase 3: Cleanup

-   [x] **Identify and Deprecate Obsolete Files**: The following components are made obsolete by the new generic `RacialSpellAbilitySelection.tsx` component. A deprecation notice should be added to the top of each file before its eventual deletion.
    -   `src/components/CharacterCreator/Race/AarakocraSpellcastingAbilitySelection.tsx`
    -   `src/components/CharacterCreator/Race/AirGenasiSpellcastingAbilitySelection.tsx`
    -   `src/components/CharacterCreator/Race/DeepGnomeSpellcastingAbilitySelection.tsx`
    -   `src/components/CharacterCreator/Race/DuergarMagicSpellcastingAbilitySelection.tsx`
-   [ ] **Delete Obsolete Files**: Once the new system is confirmed to be working, remove the deprecated component files from `src/components/CharacterCreator/Race/`.
-   [ ] **Delete Obsolete Documentation**: Remove the corresponding `[ComponentName].README.md` files for the deleted components.
-   [ ] **Update Index**: Ensure `src/data/races/index.ts` no longer references any deleted components if it does for any reason.