# Path 2.E: Create Glossary Template System (Task 1.3-1.4)

## MISSION
Implement a template-based glossary system to dynamically link spell terms (like "Acid Damage") to glossary definitions.

## REQUIRED READING
*   `src/context/GlossaryContext.tsx`
*   `src/types/spells.ts`

## EXECUTION STEPS
1.  **Data**: Create `public/data/glossary/spell-terms-template.json`.
    *   Add common terms: "Acid Damage", "Saving Throw", "Concentration", "Ritual".
2.  **Type Definition**: Update the Spell interface in `src/types/spells.ts` to include an optional `glossaryTerms: string[]` array.
3.  **Component**: Update `GlossaryDisplay.tsx` (or relevant component) to support a "Lazy Link" mechanism:
    *   When a user clicks a highlighted term in a spell description.
    *   Look up the term in `spell-terms-template.json`.
    *   Display the definition in a tooltip or modal.
4.  **Integration**: Ensure the Glossary Context can load/merge these new spell terms.

## CONSTRAINTS
*   **Performance**: Ensure loading the template doesn't block the main thread.

## DELIVERABLE
A Pull Request with the new JSON template, updated Types, and updated React components.