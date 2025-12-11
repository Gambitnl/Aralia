# Character Creator Styling Audit

**Status**: Audit Complete
**Created**: 2025-12-11
**Last Updated**: 2025-12-11

---

## Overview

This document tracks styling consistency across Character Creation step components. The goal is to ensure a cohesive visual experience throughout the character creation flow.

---

## Standard Styling Patterns (Reference)

Based on [RaceSelection.tsx](../../src/components/CharacterCreator/Race/RaceSelection.tsx) and [ClassSelection.tsx](../../src/components/CharacterCreator/ClassSelection.tsx), these are the established patterns:

### Headers
```
text-2xl text-sky-300 mb-6 text-center
```

### Cards (Selectable Items)
```
bg-gray-700 p-4 rounded-lg shadow
```

### Card Titles
```
text-xl font-semibold text-amber-400 mb-2
```

### Card Descriptions
```
text-sm text-gray-400
```

### Grid Layout
```
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4
```

### Button Styles
| Type | Class |
|------|-------|
| Back/Cancel | `bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg` |
| Confirm/Submit | `bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-lg` |
| Action/Highlight | `bg-sky-700 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg` |
| Disabled | `disabled:bg-gray-500 disabled:cursor-not-allowed` |

### Selected State (Interactive Cards)
```
bg-sky-600 ring-2 ring-sky-400
```

---

## Component Audit Results

### Consistent Components

| Component | Notes |
|-----------|-------|
| [RaceSelection.tsx](../../src/components/CharacterCreator/Race/RaceSelection.tsx) | Reference standard |
| [ClassSelection.tsx](../../src/components/CharacterCreator/ClassSelection.tsx) | Reference standard |
| [NameAndReview.tsx](../../src/components/CharacterCreator/NameAndReview.tsx) | Matches standard |

### Minor Inconsistencies (Acceptable)

| Component | Issue | Reason |
|-----------|-------|--------|
| [AbilityScoreAllocation.tsx](../../src/components/CharacterCreator/AbilityScoreAllocation.tsx) | Header `mb-2` vs `mb-6` | Intentional - subtitle text follows header |
| [SkillSelection.tsx](../../src/components/CharacterCreator/SkillSelection.tsx) | Header `mb-2` vs `mb-6` | Intentional - subtitle text follows header |

### Major Inconsistencies (Should Fix)

| Component | Issues | Priority |
|-----------|--------|----------|
| [BackgroundSelection.tsx](../../src/components/CharacterCreator/BackgroundSelection.tsx) | Header `text-3xl text-gray-100` (vs `text-2xl text-sky-300`), Blue color scheme (vs sky), Container wrapper pattern | Medium |
| [AgeSelection.tsx](../../src/components/CharacterCreator/AgeSelection.tsx) | Header `text-3xl text-gray-100` (vs `text-2xl text-sky-300`), Blue color scheme (vs sky), Container wrapper pattern | Medium |
| [FeatSelection.tsx](../../src/components/CharacterCreator/FeatSelection.tsx) | Card bg `gray-800` (vs `gray-700`), Header `mb-4` (vs `mb-6`) | Low |

---

## Detailed Findings

### BackgroundSelection.tsx / AgeSelection.tsx

These two components share a significantly different visual style:

**Current Style:**
- Header: `text-3xl font-bold text-gray-100 mb-6 text-center`
- Primary Button: `bg-blue-600 hover:bg-blue-700`
- Selected State: `border-blue-500 bg-blue-900 bg-opacity-30`
- Container: Wrapped in `bg-gray-700 rounded-lg shadow-lg p-8 border border-gray-600`
- Info Panels: `bg-blue-900 bg-opacity-30 border border-blue-800`

**Standard Style (should be):**
- Header: `text-2xl text-sky-300 mb-6 text-center`
- Primary Button: `bg-green-600 hover:bg-green-500` (confirm) or `bg-sky-700 hover:bg-sky-600` (action)
- Selected State: `bg-sky-600 ring-2 ring-sky-400` or similar
- Container: No outer wrapper (content flows directly)
- Info Panels: Could use `bg-sky-900/30 border border-sky-700/50` for consistency

### FeatSelection.tsx

Minor differences but intentionally designed differently for feat selection UX:

**Current:**
- Cards: `bg-gray-800 border-gray-700` (darker)
- Selected: `bg-amber-900/40 border-amber-500` (amber accent - intentional for feats)
- Header margin: `mb-4`

**Note:** The amber accent for feat selection is deliberate to highlight the "special" nature of feats. This is acceptable.

---

## Recommendations

### High Priority
1. **BackgroundSelection.tsx** and **AgeSelection.tsx** should be refactored to match the standard styling patterns
   - Update header to `text-2xl text-sky-300`
   - Remove container wrapper or make it transparent
   - Change blue accents to sky accents
   - Update primary button to green (confirm) pattern

### Low Priority
2. **FeatSelection.tsx** header margin could be `mb-6` for consistency, but current design is acceptable

### Future Consideration
3. Create a shared `characterCreatorStyles.ts` file with reusable class name constants to enforce consistency across all components

---

## Related Files

### Character Creation Steps (in order)
1. [RaceSelection.tsx](../../src/components/CharacterCreator/Race/RaceSelection.tsx)
2. [ClassSelection.tsx](../../src/components/CharacterCreator/ClassSelection.tsx)
3. [AbilityScoreAllocation.tsx](../../src/components/CharacterCreator/AbilityScoreAllocation.tsx)
4. [SkillSelection.tsx](../../src/components/CharacterCreator/SkillSelection.tsx)
5. [FeatSelection.tsx](../../src/components/CharacterCreator/FeatSelection.tsx)
6. [AgeSelection.tsx](../../src/components/CharacterCreator/AgeSelection.tsx)
7. [BackgroundSelection.tsx](../../src/components/CharacterCreator/BackgroundSelection.tsx)
8. [NameAndReview.tsx](../../src/components/CharacterCreator/NameAndReview.tsx)

### Shared Styles
- [buttonStyles.ts](../../src/styles/buttonStyles.ts) - Button style constants

---

## TODO Comments Added

The following files have TODO comments added for future reference:

- `BackgroundSelection.tsx` - Major styling audit TODO
- `AgeSelection.tsx` - Major styling audit TODO
- `FeatSelection.tsx` - Minor styling audit TODO
- `AbilityScoreAllocation.tsx` - Minor styling note (acceptable)
- `SkillSelection.tsx` - Minor styling note (acceptable)

---

**Next Steps:**
1. Create a task for refactoring BackgroundSelection.tsx and AgeSelection.tsx
2. Consider creating a shared styles module for character creator components
