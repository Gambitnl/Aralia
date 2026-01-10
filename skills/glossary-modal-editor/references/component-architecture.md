# Glossary Modal Architecture

- **Root modal**: `src/components/Glossary/Glossary.tsx` wraps the entire modal inside `WindowFrame`, wires the `GlossaryContext` data, and maintains selection/search state. Any UI change (layout, focus, toggling behavior) happens here or via the sub-components it renders.
- **Data source**: `GlossaryContext` (`src/context/GlossaryContext.tsx`) fetches the index files generated under `public/data/glossary/index/`. The fetched `GlossaryEntry[]` is the single source of truth for the modal.
- **Sub-components**:
  - `GlossaryHeader` handles the title, close action, search input, and toolbar actions. It sends callbacks back to the parent.
  - `GlossarySidebar` renders categories, collapsible parents, and the selected entry tree. Updates here must stay in sync with the search/expansion hooks.
  - `GlossaryEntryPanel` houses entry breadcrumbs, a `FullEntryDisplay`, and numeric navigation; it is the primary place to show entry content.
  - `GlossaryFooter` shows last-generated timestamps and keyboard hints; update it when you add new shortcuts or state indicators.
  - `GlossaryResizeHandles` manages drag handles for resizing columns/widths, and must stay connected to `useGlossaryModal`.
- **Hooks**:
  - `useGlossaryModal` (modal sizing/position, dragging/resizing, window reset/maximize) lives in `src/components/Glossary/hooks/useGlossaryModal.ts`.
  - `useGlossarySearch` controls filtering, category sorting, and expansion state.
  - `useGlossaryKeyboardNav` wires arrow/key navigation across the flattened entry list.
- **Content rendering**: `FullEntryDisplay` and `GlossaryEntryTemplate` render entry markdown via `GlossaryContentRenderer`, and `GlossaryTraitTable` / `GlossarySummaryTable` display structured data. Spells reuse `SpellCardTemplate.tsx` data pulled through `useSpellGateChecks`.
- **Integration points**:
  - `GameModals` (`src/components/layout/GameModals.tsx`) lazy-loads `Glossary` and passes `isOpen`, `onClose`, and navigation callbacks. Update `GameModals` when you add props or change how the modal is toggled.
  - `App.tsx`, `ActionPane/SystemMenu`, and other UI elements trigger `TOGGLE_GLOSSARY_VISIBILITY` and `SET_GLOSSARY_TERM_FOR_MODAL`; `uiReducer.ts` stores visibility/term data.
  - `SingleGlossaryEntryModal` is used by the CharacterSheet, Race Detail, and Spellbook overlays to show a single term outside the main modal; keep its props in sync when changing navigation hooks.
