# Feat UI Implementation Plan

**Last Updated:** 2025-12-14

This document outlines the implementation plan for the feat UI improvements in Aralia RPG, focusing on the UI components and character integration needed to support all feat choice types.

## Overview

The feat system in Aralia RPG currently has the data model in place but lacks full UI implementation for many feat choice types. This plan addresses the implementation of UI components and character integration for the following feats:

1. Resilient - Ability selection and logic to apply matching save proficiency
2. Skilled - Selecting 3 skills from the full skill list
3. Tavern Brawler - Ability selection and improvised weapon/unarmed strike mechanics
4. Elemental Adept - Damage type selection and combat logic for ignoring resistance/treating 1s as 2s
5. Slasher - Ability selection and combat mechanics for speed reduction/crit effect

## Implementation Steps

### 1. Enhance FeatSelection Component

**File:** `src/components/CharacterCreator/FeatSelection.tsx`

**Tasks:**
- Implement UI for ability score selection for feats with `selectableAbilityScores`
- Implement UI for skill selection for feats with `selectableSkillCount`
- Implement UI for damage type selection for feats with `selectableDamageTypes`
- Ensure all feat choices are properly stored in character creation state
- Add validation to ensure all required feat choices are made

### 2. Update PlayerCharacter Type

**File:** `src/types.ts`

**Tasks:**
- Add `feats` array to `PlayerCharacter` interface to store selected feat IDs
- Add any additional fields needed for feat-specific choices (e.g., selected ability scores, skills, damage types)

### 3. Update Character Assembly Logic

**File:** `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`

**Tasks:**
- Modify character assembly to apply feat benefits based on selected feats and choices
- Implement logic to apply ability score increases from feats
- Implement logic to apply skill proficiencies from feats
- Implement logic to apply saving throw proficiencies from feats (e.g., Resilient)
- Implement logic to apply damage type benefits from feats (e.g., Elemental Adept)

### 4. Implement Combat Mechanics

**Files:** `src/hooks/useCombatSystem.ts`, `src/utils/combatUtils.ts`

**Tasks:**
- Implement speed reduction mechanic for Slasher feat
- Implement disadvantage on attacks mechanic for Slasher feat on critical hits
- Implement resistance ignoring mechanic for Elemental Adept feat
- Implement damage dice rerolling mechanic for Elemental Adept feat

## Detailed Implementation by Feat

### Resilient Feat

**Data Model:** Already implemented with `selectableAbilityScores` and `savingThrowLinkedToAbility`

**UI Implementation:**
- Add ability selection dropdown in FeatSelection component
- Store selected ability in feat choices
- Display validation message if no ability is selected

**Character Integration:**
- Apply +1 to selected ability score
- Add proficiency in saving throws using the selected ability

### Skilled Feat

**Data Model:** Already implemented with `selectableSkillCount`

**UI Implementation:**
- Add skill selection interface allowing selection of 3 skills
- Display full list of available skills
- Store selected skills in feat choices
- Display validation message if not enough skills are selected

**Character Integration:**
- Add selected skills to character's skill proficiencies

### Tavern Brawler Feat

**Data Model:** Already implemented with `selectableAbilityScores`

**UI Implementation:**
- Add ability selection dropdown (STR or CON only)
- Store selected ability in feat choices
- Display validation message if no ability is selected

**Character Integration:**
- Apply +1 to selected ability score
- Add proficiency with improvised weapons (implementation needed)
- Improve unarmed strikes (implementation needed)

### Elemental Adept Feat

**Data Model:** Already implemented with `selectableAbilityScores` and `selectableDamageTypes`

**UI Implementation:**
- Add ability selection dropdown (INT, WIS, or CHA only)
- Add damage type selection dropdown (Acid, Cold, Fire, Lightning, Thunder)
- Store both selections in feat choices
- Display validation message if selections are missing

**Character Integration:**
- Apply +1 to selected ability score
- Implement logic to ignore resistance to selected damage type
- Implement logic to treat 1s as 2s on damage dice of selected type

### Slasher Feat

**Data Model:** Already implemented with `selectableAbilityScores`

**UI Implementation:**
- Add ability selection dropdown (STR or DEX only)
- Store selected ability in feat choices
- Display validation message if no ability is selected

**Character Integration:**
- Apply +1 to selected ability score
- Implement speed reduction mechanic (10 feet) when dealing slashing damage
- Implement disadvantage on attacks mechanic for critical hits

## Testing Plan

1. Unit tests for character assembly logic with various feat combinations
2. Integration tests for feat selection UI components
3. Combat system tests for feat-specific mechanics
4. End-to-end tests for character creation with feats

## Dependencies

- Existing feat data model in `src/data/feats/featsData.ts`
- Existing FeatSelection component in `src/components/CharacterCreator/FeatSelection.tsx`
- Character creation state management in `src/components/CharacterCreator/state/characterCreatorState.ts`
- Character assembly logic in `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`

## Timeline

This implementation should be completed in phases:

1. **Phase 1:** Enhance FeatSelection UI (2-3 days)
2. **Phase 2:** Update PlayerCharacter type and character assembly (2 days)
3. **Phase 3:** Implement combat mechanics (3-4 days)
4. **Phase 4:** Testing and refinement (2-3 days)

Total estimated time: 9-12 days