# Agent Prompt 05 - Material Components: Implement Required vs Consumed (with costs) as Structured SSOT + Migrate Dataset

Repo: `AraliaV4/Aralia`

Goal: Represent material components in spell JSON in a way that supports mechanics enforcement and clean glossary rendering when a spell requires both:
- non-consumed costly focus/material(s), and
- consumed material(s) (possibly also costly)

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Current limitation
Current schema supports only:
- `components.materialDescription?: string`
- `components.materialCost?: number`
- `components.isConsumed?: boolean`

This cannot represent mixed requirements like:
- "A worth 250 gp (not consumed) AND four strips worth 50 gp each (consumed)"

## Scope facts
- ~242 spells have `components.material: true` currently.

## Known tricky spells (must handle correctly)
Multiple cost mentions:
- `leomunds-secret-chest`, `legend-lore`, `clone`, `astral-projection`

Mixed consumed/non-consumed candidates:
- `find-familiar`, `protection-from-evil-and-good`, `magic-mouth`, `glyph-of-warding`, `magic-circle`, `hallow`, `create-homunculus`, `astral-projection`

## Task
### 1) Propose schema options (at least 2) and recommend one
Examples:
- Option A (two buckets):
  - `components.materialRequired: { description: string; costGP?: number } | null`
  - `components.materialConsumed: { description: string; costGP?: number } | null`
- Option B (itemized list):
  - `components.materialItems: Array<{ description: string; costGP?: number; consumed: boolean; quantity?: number }>`

Criteria:
- Mechanics enforceability
- Minimal migration pain
- Clear glossary rendering

### 2) Implement chosen option end-to-end
Update:
- Schema: `src/systems/spells/validation/spellValidator.ts`, `src/systems/spells/schema/spell.schema.json`
- Types: `src/types/spells.ts`
- Reference-to-JSON mapping: `scripts/update-spell-json-from-references.ts`
- Glossary rendering: `src/components/Glossary/SpellCardTemplate.tsx`

### 3) Migrate existing spells
Create a migration script that updates all spells with `components.material: true` to the new structure.
The migration should preserve existing data and put it into the correct bucket(s) when possible.

### 4) Update validation rules
Current material validation attempts to infer costs from prose. Replace/adjust it to validate the new structured fields directly.
Ensure tricky spells validate correctly.

### 5) Regenerate and validate
Run:
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`
- `npm run validate`

## Deliverable
- New structured material component model in schema and dataset.
- Migration completed for all spells.
- Glossary display is clear for required vs consumed components.
- Validation is green.
- A rollout plan after fixture verification that covers:
  - how to update all reference files (if needed) to populate the new structure
  - how to handle ambiguous multi-item component phrasing
  - checkpoints to confirm behavior with the user before mass edits

## After completion (required)
Append to this file:
- "Completion Notes"
- "Detected TODOs (Out of Scope)"
See `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.
