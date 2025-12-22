# Architect's Journal

## 2024-05-23 - Separating Dev Controls **Learning:** Complex components often accumulate development tools that persist in production code, bloating the file. Extracting these into a dedicated component with a clear interface simplifies the main component and makes the dev tools easier to maintain or toggle. **Action:** When identifying God components, look for conditional rendering blocks like `isDevMode` or `isDummy` as primary candidates for extraction.

## 2024-05-24 - Decomposing Tabbed Interfaces **Learning:** Large components like `CharacterSheetModal` often contain massive render functions for each tab (e.g., `renderOverviewTab`). This pattern leads to "God Components" that are hard to read and maintain. Extracting these tabs into dedicated sub-components (e.g., `CharacterOverview`) and moving their specific logic (like proficiency calculations) into custom hooks greatly improves separation of concerns. **Action:** Identify components with `renderTabName` functions and extract them into standalone components in a subdirectory.
## 2025-02-17 - QuestLog Refactor **Learning:** Decomposing components like 'QuestLog' into sub-components ('QuestCard', 'QuestHistoryRow') significantly improves readability and testability. Using a dedicated directory with an index.ts file simplifies imports while keeping the file structure clean. **Action:** Continue this pattern for other modal-based components.

## 2025-02-17 - PartyPane Refactor Strategy (TODO) **Learning:** The `PartyPane` component has grown to include embedded logic for individual character buttons and missing-choice validation. To improve maintainability and testability, this should be refactored into a directory structure. **Action:**
1. Create `src/components/PartyPane/` directory.
2. Extract the button logic into `PartyCharacterButton.tsx`.
3. Move the main list logic to `PartyPane.tsx` and export via `index.ts`.
4. Integrate `validateCharacterChoices` (from `src/utils/characterValidation.ts`) into the button component to show warnings for missing selections.
5. Ensure `MissingChoice` type is exported from `src/types`.
6. Update tests to reflect the new structure.
(Note: This refactor was prototyped but reverted to ensure a clean slate.)
