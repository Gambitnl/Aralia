- [ ] Plan Completed

# Plan: Remove Obsolete Files

## 1. Purpose

The goal of this improvement is to perform a thorough cleanup of the codebase by identifying and deleting obsolete files. Over the course of development and refactoring, several components and documentation files have become deprecated or unused. Removing them will:
-   Reduce the overall size of the project.
-   Eliminate confusion for developers by removing dead code.
-   Improve maintainability by ensuring the codebase only contains relevant, active files.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including the specific files and folders to be deleted.
-   A verification step is included to ensure no active code is accidentally removed.

---

## 3. Implementation Plan

### Phase 1: Identification of Obsolete Files

-   [ ] **Review and Confirm**: Based on the project's evolution, the following files have been identified as obsolete and are targeted for deletion.

    *   **Components**:
        -   `src/components/PlayerPane.tsx` (Superseded by `PartyPane.tsx` and `CharacterSheetModal.tsx`)
        -   `src/components/StartScreen.tsx` (Functionality replaced by `MainMenu.tsx`)
        -   `src/components/Spellbook.tsx` (Superseded by `SpellbookOverlay.tsx`)
        -   `src/battleMapDemo.tsx` (Superseded by `src/components/BattleMapDemo.tsx`)
        -   `src/components/CharacterCreator/Race/FlexibleAsiSelection.tsx` (Logic merged into `AbilityScoreAllocation.tsx`)

    *   **Hooks**:
        -   `src/hooks/OLD_useGameActions.ts` (A backup from a major refactor, no longer needed)

    *   **Documentation**:
        -   `src/components/PlayerPane.README.md`
        -   `src/components/Spellbook.README.md`
        -   `src/components/CharacterCreator/Race/FlexibleAsiSelection.README.md`

### Phase 2: Verification (Pre-Deletion Check)

-   [ ] **Perform Global Search**: Before deleting any file, perform a project-wide search for its filename to ensure there are no remaining import statements or references to it in active code.
    -   For example, search for `import PlayerPane from` across all files.
    -   Search for `FlexibleAsiSelection` in `CharacterCreator.tsx` and `characterCreatorState.ts` to confirm it has been fully removed from the creation steps.
    -   This step is a crucial safeguard against breaking the application.

### Phase 3: Deletion of Files

-   [ ] **Delete Component Files**:
    -   Delete `src/components/PlayerPane.tsx`
    -   Delete `src/components/StartScreen.tsx`
    -   Delete `src/components/Spellbook.tsx`
    -   Delete `src/battleMapDemo.tsx`
    -   Delete `src/components/CharacterCreator/Race/FlexibleAsiSelection.tsx`
-   [ ] **Delete Hook Files**:
    -   Delete `src/hooks/OLD_useGameActions.ts`
-   [ ] **Delete Documentation Files**:
    -   Delete `src/components/PlayerPane.README.md`
    -   Delete `src/components/Spellbook.README.md`
    -   Delete `src/components/CharacterCreator/Race/FlexibleAsiSelection.README.md`

### Phase 4: Update Documentation Index

-   [ ] **Modify Index**: `docs/@README-INDEX.md`
-   **Code Direction**:
    1.  Open the documentation index file.
    2.  Carefully review the list and remove the lines corresponding to the deleted README files (`PLAYER_PANE.README.md`, `SPELLBOOK.README.md`, `FLEXIBLE_ASI_SELECTION.README.md`).
    3.  Ensure the remaining list is correctly formatted.

### Phase 5: Final Verification

-   [ ] **Test the Application**:
    -   Reload the application and perform a quick run-through of its core features:
        -   Start a new game and proceed through character creation.
        -   Load a saved game.
        -   Navigate the game world.
        -   Open and interact with the Party Overlay, Character Sheet, and Spellbook Overlay.
    -   This final check ensures that the file deletions did not have any unforeseen side effects on the application's runtime behavior.