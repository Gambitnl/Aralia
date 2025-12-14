# Feat Selection Implementation Guide

**Last Updated:** 2025-12-14

This guide provides step-by-step instructions for implementing the feat selection UI improvements in the Aralia RPG character creator.

## Overview

The feat selection UI in Aralia RPG needs to be enhanced to support all feat choice types:
- Ability score selection (Resilient, Tavern Brawler, Slasher, Elemental Adept)
- Skill selection (Skilled, Skill Expert)
- Damage type selection (Elemental Adept)
- Spell selection (Magic Initiate, Fey-Touched, Shadow-Touched, Spell Sniper)

## Prerequisites

Before starting the implementation, ensure you have:
- Familiarity with React and TypeScript
- Understanding of the existing character creation flow
- Access to the feat data model in `src/data/feats/featsData.ts`
- Knowledge of the character creation state management in `src/components/CharacterCreator/state/characterCreatorState.ts`

## Implementation Steps

### 1. Understanding the Existing FeatSelection Component

The existing `FeatSelection.tsx` component already supports some feat choice types:
- Ability score selection for feats with `selectableAbilityScores`
- Spell selection for feats with `spellBenefits`
- Damage type selection for feats with `selectableDamageTypes`

However, it needs enhancements to fully support all feat choice types.

### 2. Implementing Skill Selection UI

**File:** `src/components/CharacterCreator/FeatSelection.tsx`

**Task:** Add UI for skill selection for feats with `selectableSkillCount`

**Steps:**
1. Identify feats with `selectableSkillCount` in the `FEATS_DATA` array
2. Add a new section in the FeatSelection component for skill selection
3. Display a multi-select interface allowing the player to choose the required number of skills
4. Store the selected skills in the feat choices state

**Example Implementation:**

```tsx
{selectedFeat?.benefits?.selectableSkillCount && (
  <div className="mt-3">
    <label className="block text-sm text-gray-300 mb-2">
      Select {selectedFeat.benefits.selectableSkillCount} Skills:
    </label>
    <SkillMultiSelect
      maxSelections={selectedFeat.benefits.selectableSkillCount}
      selectedSkills={selectedSkills}
      onSelectionChange={handleSkillSelectionChange}
    />
    {selectedSkills.length < selectedFeat.benefits.selectableSkillCount && (
      <p className="text-xs text-amber-300 mt-2">
        Please select {selectedFeat.benefits.selectableSkillCount} skills.
      </p>
    )}
  </div>
)}
```

### 3. Enhancing Ability Score Selection

**File:** `src/components/CharacterCreator/FeatSelection.tsx`

**Task:** Ensure ability score selection works for all relevant feats

**Steps:**
1. Verify that the existing ability score selection UI works for all feats with `selectableAbilityScores`
2. Add validation to ensure the selected ability is stored in feat choices
3. Display appropriate labels for different feat types

### 4. Enhancing Damage Type Selection

**File:** `src/components/CharacterCreator/FeatSelection.tsx`

**Task:** Ensure damage type selection works for Elemental Adept feat

**Steps:**
1. Verify that the existing damage type selection UI works for Elemental Adept
2. Add validation to ensure the selected damage type is stored in feat choices
3. Display appropriate labels and descriptions

### 5. Updating Character Creation State

**File:** `src/components/CharacterCreator/state/characterCreatorState.ts`

**Task:** Ensure feat choices are properly stored in the character creation state

**Steps:**
1. Verify that the `featChoices` object in `CharacterCreationState` can store all required feat choice types
2. Add any additional fields if needed for specific feat choices
3. Ensure the `SET_FEAT_CHOICE` action properly updates the state

### 6. Implementing Character Assembly Logic

**File:** `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`

**Task:** Update character assembly to apply feat benefits based on selected choices

**Steps:**
1. Modify the character assembly logic to check for feat choices when applying feat benefits
2. Implement logic to apply ability score increases from feats
3. Implement logic to apply skill proficiencies from feats
4. Implement logic to apply saving throw proficiencies from feats (e.g., Resilient)
5. Implement logic to apply damage type benefits from feats (e.g., Elemental Adept)

### 7. Implementing Combat Mechanics

**Files:** 
- `src/hooks/useCombatSystem.ts`
- `src/utils/combatUtils.ts`

**Task:** Implement combat mechanics for Slasher and Elemental Adept feats

**Steps for Slasher Feat:**
1. Implement speed reduction mechanic (10 feet) when dealing slashing damage
2. Implement disadvantage on attacks mechanic for critical hits

**Steps for Elemental Adept Feat:**
1. Implement logic to ignore resistance to selected damage type
2. Implement logic to treat 1s as 2s on damage dice of selected type

### 8. Adding Validation

**File:** `src/components/CharacterCreator/FeatSelection.tsx`

**Task:** Add validation to ensure all required feat choices are made

**Steps:**
1. Add validation logic to check if all required feat choices are made
2. Disable the Continue button if validation fails
3. Display appropriate error messages to guide the player

### 9. Testing

**Tasks:**
1. Test each feat individually to ensure the UI works correctly
2. Test combinations of feats to ensure no conflicts
3. Test character assembly to ensure feat benefits are applied correctly
4. Test combat mechanics to ensure feat effects work in combat

## Code Examples

### Skill Multi-Select Component

```tsx
interface SkillMultiSelectProps {
  maxSelections: number;
  selectedSkills: string[];
  onSelectionChange: (skills: string[]) => void;
}

const SkillMultiSelect: React.FC<SkillMultiSelectProps> = ({
  maxSelections,
  selectedSkills,
  onSelectionChange
}) => {
  const allSkills = useContext(SkillContext);
  
  const handleSkillToggle = (skillId: string) => {
    if (selectedSkills.includes(skillId)) {
      onSelectionChange(selectedSkills.filter(id => id !== skillId));
    } else if (selectedSkills.length < maxSelections) {
      onSelectionChange([...selectedSkills, skillId]);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
      {allSkills.map(skill => (
        <button
          key={skill.id}
          onClick={() => handleSkillToggle(skill.id)}
          className={`
            px-3 py-2 rounded border text-sm transition-colors text-left
            ${selectedSkills.includes(skill.id)
              ? 'bg-blue-600 border-blue-400 text-white'
              : selectedSkills.length >= maxSelections
                ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }
          `}
          disabled={selectedSkills.length >= maxSelections && !selectedSkills.includes(skill.id)}
        >
          {skill.name}
        </button>
      ))}
    </div>
  );
};
```

### Character Assembly Enhancement

```tsx
// In useCharacterAssembly.ts
const applyFeatBenefits = (
  character: PlayerCharacter,
  selectedFeatId: string | null,
  featChoices: Record<string, any>
) => {
  if (!selectedFeatId) return character;

  const feat = FEATS_DATA.find(f => f.id === selectedFeatId);
  if (!feat || !feat.benefits) return character;

  const updatedCharacter = { ...character };

  // Apply ability score increases
  if (feat.benefits.abilityScoreIncrease) {
    Object.entries(feat.benefits.abilityScoreIncrease).forEach(([ability, increase]) => {
      if (updatedCharacter.finalAbilityScores) {
        updatedCharacter.finalAbilityScores[ability as AbilityScoreName] += increase;
      }
    });
  }

  // Apply selectable ability score increase
  const featChoice = featChoices[selectedFeatId];
  if (feat.benefits.selectableAbilityScores && featChoice?.selectedAbilityScore) {
    if (updatedCharacter.finalAbilityScores) {
      updatedCharacter.finalAbilityScores[featChoice.selectedAbilityScore] += 1;
    }
    
    // Apply saving throw proficiency for Resilient feat
    if (feat.id === 'resilient' && feat.benefits.savingThrowLinkedToAbility) {
      if (!updatedCharacter.savingThrowProficiencies) {
        updatedCharacter.savingThrowProficiencies = [];
      }
      if (!updatedCharacter.savingThrowProficiencies.includes(featChoice.selectedAbilityScore)) {
        updatedCharacter.savingThrowProficiencies.push(featChoice.selectedAbilityScore);
      }
    }
  }

  // Apply skill proficiencies
  if (feat.benefits.skillProficiencies && feat.benefits.skillProficiencies.length > 0) {
    // Fixed skills
    const skillObjects = feat.benefits.skillProficiencies
      .map(skillId => SKILLS_DATA[skillId])
      .filter(Boolean);
    updatedCharacter.skills = [...updatedCharacter.skills, ...skillObjects];
  } else if (feat.benefits.selectableSkillCount && featChoice?.selectedSkills) {
    // Selectable skills
    const skillObjects = featChoice.selectedSkills
      .map((skillId: string) => SKILLS_DATA[skillId])
      .filter(Boolean);
    updatedCharacter.skills = [...updatedCharacter.skills, ...skillObjects];
  }

  // Store feat ID
  if (!updatedCharacter.feats) {
    updatedCharacter.feats = [];
  }
  updatedCharacter.feats.push(selectedFeatId);

  return updatedCharacter;
};
```

## Best Practices

1. **Consistent UI:** Maintain a consistent look and feel across all feat choice interfaces
2. **Clear Labels:** Use clear, descriptive labels for all choices
3. **Validation:** Provide immediate feedback when choices are invalid or incomplete
4. **Accessibility:** Ensure all UI elements are accessible via keyboard and screen readers
5. **Performance:** Optimize rendering for large lists of skills or spells
6. **Error Handling:** Gracefully handle cases where data is missing or invalid

## Troubleshooting

### Common Issues

1. **Feat choices not saving:** Check that the `SET_FEAT_CHOICE` action is properly dispatched and handled
2. **Feat benefits not applying:** Verify that the character assembly logic correctly checks for feat choices
3. **UI not updating:** Ensure all state changes trigger re-renders by using immutable updates

### Debugging Tips

1. Use browser developer tools to inspect the character creation state
2. Add console.log statements to trace the flow of feat choices through the system
3. Test with different feat combinations to identify conflicts

## Conclusion

By following this guide, you should be able to implement the feat selection UI improvements for all feat choice types in Aralia RPG. Remember to test thoroughly and follow the project's coding standards and documentation guidelines.