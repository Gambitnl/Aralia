---
name: glossary-modal-editor
description: Efficiently update the Glossary modal UI, hooks, and data so the in-app glossary stays polished, searchable, and accurate for every term.
---

# Glossary Modal Editor

Use this skill when you need to:

- change the Glossary modal layout, focus behavior, keyboard shortcuts, or resizing logic in `src/components/Glossary/Glossary.tsx` and its sub-components.
- adjust how external UI elements (GameModals, ActionPane buttons, character sheets, tooltips) trigger or navigate within the glossary.
- add, edit, or reorganize glossary content files so the modal renders new information.

## Workflow

1. **Verify the data surface**: Start by handling glossary JSON entries under `public/data/glossary/entries/`, obeying the `id`, `category`, `filePath`, and markdown rules. Reference `references/data-editing.md` for file structure, tooltip markup, table styling, and index-generation reminders before touching the modal.
2. **Update the UI**: Use `references/component-architecture.md` to trace how `Glossary` composes `GlossaryHeader`, `GlossarySidebar`, `GlossaryEntryPanel`, `GlossaryFooter`, and `GlossaryResizeHandles` inside `WindowFrame`, how it uses `useGlossaryModal`, `useGlossarySearch`, and the surrounding `GlossaryContext`, and which higher-level modules (e.g., `GameModals.tsx`, `App.tsx`, tooltips, `SingleGlossaryEntryModal`) rely on it.
3. **Validate end-to-end**: Run `node scripts/generateGlossaryIndex.js`, confirm no duplicate IDs or missing categories, and trigger the glossary in-app (Open the modal, use tooltips, or open a single entry modal) to ensure the new data appears and navigation callbacks still work.

## References

- `references/component-architecture.md`
- `references/data-editing.md`

## Completion Criteria

Before concluding any glossary modal task, you must satisfy the following checklist:

1. **Schema Validation:** Confirm that any modified or new glossary entry conforms to the required markdown structure, and that the ID and category keys match.
2. **Index Generation:** Run `node scripts/generateGlossaryIndex.js` and verify it runs successfully with no duplicate keys or missing metadata.
3. **No Overflows:** Verify that the UI layout handles rendering correctly inside the modal window, and that text/data resizing works without spilling or breaking layout constraints.
4. **Link/Search Integrity:** Confirm that searching works and that external links (from traits, spells, or tooltips) target the correct entry ID.
5. **No TS Warnings:** Verify that TypeScript typechecks compile without errors.
