# Agent Prompt 07 - Show Feat-Based Spell Access in Spell Glossary Cards

Repo: `AraliaV4/Aralia`

Goal: In the glossary spell card UI, show which feats can grant access to the spell.

This includes:
- Feats that grant a specific spell automatically (direct grants).
- Feats that allow choosing the spell (conditional access), including when the feat restricts by:
  - spell level
  - school
  - "requires attack roll"
  - selected spell source/class list (e.g. Magic Initiate)

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Data sources
- Feats catalogue: `src/data/feats/featsData.ts` (`FEATS_DATA`)
  - Spell-related structure is in `FeatSpellBenefits` (`src/types/character.ts`):
    - `grantedSpells`: explicit spell IDs
    - `spellChoices`: constraints for player-selected spells
    - `selectableSpellSource`: e.g. Magic Initiate uses class lists
- Base class spell lists (for feats like Magic Initiate):
  - `src/data/classes/index.ts` spell list arrays (`*_SPELL_LIST`)

## Tasks

### 1) Build an index: spellId -> feats that can grant it
Compute two categories:
1) Direct grants:
   - any feat where `benefits.spellBenefits.grantedSpells` includes `spellId`
2) Conditional selection:
   - any feat where `benefits.spellBenefits.spellChoices` could allow selecting the spell

Selection qualification rules (minimum viable):
- Spell level must match `FeatSpellRequirement.level`
- If `schools` is present, spell.school must be in that list
- If `requiresAttack` is true, the spell must require an attack roll
  - Prefer: infer from spell JSON effects (a `DAMAGE` effect with `condition.type: "hit"`), rather than relying on optional `attackType`
- If `selectableSpellSource` is present (Magic Initiate):
  - determine which base class spell lists contain the spell ID
  - only count it as accessible if the spell appears in at least one selectable source list
  - in the UI, show which sources apply (e.g. "Magic Initiate (Wizard list)")

Output options:
- Option A (recommended): build-time JSON index:
  - `public/data/spell_access/feats.json`
- Option B: compute at runtime from `FEATS_DATA` + loaded spell JSON (bundle cost).

### 2) Update spell glossary card UI
Update `src/components/Glossary/SpellCardTemplate.tsx` to display a new section, e.g.:
- "Feat Access"

Display requirements:
- If no feats grant access, hide the section.
- Group the display:
  - "Granted by feats" (direct grants)
  - "Selectable via feats" (conditional)
- For conditional feats, show the constraint summary:
  - e.g. "Fey-Touched: 1st-level Divination/Enchantment (plus Misty Step)"
  - e.g. "Magic Initiate: choose from Wizard/Bard list"
- Handle potentially large lists:
  - show top N and a "Show more" expander
  - or provide a simple filter by feat name

### 3) Ensure this stays correct as spell data changes
If you choose a build-time index, integrate generation into existing workflows:
- `scripts/regenerate-manifest.ts`
- `scripts/generateGlossaryIndex.js`

Recommended: add `scripts/generateSpellAccessIndex.ts` and call it from the same workflow(s), or document that it must be run alongside.

### 4) Report duplicated mechanics
If you find multiple competing ways the codebase determines "spell requires an attack roll", list them and recommend a SSOT rule (do not refactor unless requested).

## Fixtures / manual verification
Verify at least:
- a spell directly granted by a feat (e.g., Misty Step via Fey-Touched)
- a spell selectable by school constraint (Fey-Touched)
- an attack cantrip selectable by Spell Sniper
- a spell selectable via Magic Initiate with at least one source list

## Commands
- `npm run validate`
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`

## Deliverable
- A reliable mapping from spellId -> feat access (direct + conditional).
- Spell glossary cards display "Feat Access" with scalable UI for large lists.
- A rollout plan for expanding/maintaining the feat mapping as feat/spell data grows.

## After completion (required)
Append to this file:
- "Completion Notes"
- "Detected TODOs (Out of Scope)"
See `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.
