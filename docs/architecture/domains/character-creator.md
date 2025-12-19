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
| `src/components/CharacterCreator/` | Directory | All creator components |
| `src/components/CharacterCreator/CharacterCreator.tsx` | Component | Main wizard |
| `src/components/CharacterCreator/Race/` | Directory | Race selection (~18 files) |
| `src/components/CharacterCreator/Class/` | Directory | Class selection (~11 files) |
| `src/components/CharacterCreator/AbilityScoreAllocation.tsx` | Component | Ability scores |
| `src/components/CharacterCreator/SkillSelection.tsx` | Component | Skills |
| `src/components/CharacterCreator/BackgroundSelection.tsx` | Component | Background |
| `src/components/CharacterCreator/FeatSelection.tsx` | Component | Feats |
| `src/components/CharacterCreator/FeatSpellPicker.tsx` | Component | Feat spells |
| `src/components/CharacterCreator/VisualsSelection.tsx` | Component | Appearance |
| `src/components/CharacterCreator/AgeSelection.tsx` | Component | Age |
| `src/components/CharacterCreator/WeaponMasterySelection.tsx` | Component | Weapons |
| `src/components/CharacterCreator/NameAndReview.tsx` | Component | Final review |
| `src/components/CharacterCreator/CreationSidebar.tsx` | Component | Progress sidebar |
| `src/components/CharacterCreator/SpellSourceSelector.tsx` | Component | Spell source |
| `src/components/CharacterCreator/state/` | Directory | State management |
| `src/components/CharacterCreator/hooks/` | Directory | Creator-specific hooks |
| `src/components/CharacterCreator/config/` | Directory | Configuration |
| `src/hooks/useCharacterAssembly.ts` | Hook | Character assembly |
| `src/data/races/` | Data | Race definitions (~37 files) |
| `src/data/classes/` | Data | Class definitions |
| `src/data/backgrounds.ts` | Data | Background definitions |
| `src/data/feats/` | Data | Feat definitions |

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
