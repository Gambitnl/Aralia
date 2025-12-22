# Character Creator

## Purpose

The Character Creator provides a step-by-step wizard for generating new player characters. It guides players through race selection, class selection, ability score allocation, skill selection, feat selection, and final naming/review.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/CharacterCreator/CharacterCreator.tsx` | Main wizard component (25KB) |
| `src/hooks/useCharacterAssembly.ts` | Character assembly logic |
| `src/components/CharacterCreator/state/` | Creator state management |

## Subcomponents

- **Race Selection**: `Race/` directory - Race and subrace selection (~18 files)
- **Class Selection**: `Class/` directory - Class and subclass selection (~11 files)
- **Ability Scores**: `AbilityScoreAllocation.tsx` - Point buy / standard array
- **Skills**: `SkillSelection.tsx` - Skill proficiency selection
- **Background**: `BackgroundSelection.tsx` - Background selection
- **Feats**: `FeatSelection.tsx`, `FeatSpellPicker.tsx` - Feat and feat-granted spells
- **Visuals**: `VisualsSelection.tsx` - Character appearance
- **Age**: `AgeSelection.tsx` - Character age selection
- **Weapons**: `WeaponMasterySelection.tsx` - Weapon mastery selection
- **Review**: `NameAndReview.tsx` - Final review and naming
- **Sidebar**: `CreationSidebar.tsx` - Progress tracking sidebar

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/CharacterCreator/*.tsx` | Directory | All creator components |
| `src/components/CharacterCreator/Race/*.tsx` | Directory | Race selection |
| `src/components/CharacterCreator/Class/*.tsx` | Directory | Class selection |
| `src/components/CharacterCreator/state/*.ts` | Directory | State management |
| `src/components/CharacterCreator/hooks/*.ts` | Directory | Creator-specific hooks |
| `src/components/CharacterCreator/config/*.ts` | Directory | Configuration |
| `src/hooks/useCharacterAssembly.ts` | Hook | Character assembly |
| `src/data/races/*.ts` | Data | Race definitions |
| `src/data/classes/*.ts` | Data | Class definitions |
| `src/data/backgrounds.ts` | Data | Background definitions |
| `src/data/feats/*.ts` | Data | Feat definitions |


## Dependencies

### Depends On

- **[Spells](./spells.md)**: Spell selection for spellcasting classes
- **[Glossary](./glossary.md)**: Links to race/class/feat information
- **[Character Sheet](./character-sheet.md)**: Validation of created character

### Used By

- **App.tsx**: Renders character creator modal
- **Main Menu**: Entry point for new game

## Boundaries / Constraints

- Creator should produce valid characters that pass `characterValidation.ts`
- All race/class data should come from `src/data/` - not hardcoded
- Creator state is isolated - does not affect game state until completion
- Step transitions should validate current step before proceeding

## Open Questions / TODOs

- [ ] Document step flow and validation requirements
- [ ] Clarify relationship between Race/ and src/data/races/
- [ ] Map feat prerequisite validation

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx` | Unit test |
| `src/data/__tests__/planes.test.ts` | Unit test |
