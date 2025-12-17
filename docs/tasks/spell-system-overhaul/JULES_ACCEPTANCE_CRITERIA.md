# Jules Acceptance Criteria & Protocol

**Target Audience**: Jules (AI Agent)
**Purpose**: Define strict "Definition of Done" for spell migration tasks and provide a protocol for flagging system gaps.

---

## 1. Definition of Done (The "Iron Rules")

### Cantrip Migration Hard Rules (Level 0)
- Files **must** live under `public/data/spells/level-0/{id}.json` (never flat `public/data/spells/{id}.json`).
- `level: 0`, `ritual: false`, `castingTime.combatCost.type` present; Title Case enums (schools, damage types, classes) and plural `validTargets`.
- Every effect carries `trigger` + `condition`; use current schema fields (e.g., `on_attack_hit`, `controlOptions`, `taunt`, `forcedMovement`, `Square/height` AoE) where applicable.
- Perform the Field Comparison Check against any legacy flat file **before** deleting it.

You are NOT done with a spell until **ALL** of the following are true.

### A. Required Reference Material (Source of Truth)
- [ ] **Examples Used**: You have read and followed `docs/spells/SPELL_JSON_EXAMPLES.md`.
- [ ] **Level-Aware Examples Reviewed**: Inspect at least one complete leveled spell pair (JSON + glossary) such as:
  - `public/data/spells/level-2/web.json` and `public/data/glossary/entries/spells/level-2/web.md`
  - `public/data/spells/level-2/moonbeam.json` and `public/data/glossary/entries/spells/level-2/moonbeam.md`
  - `public/data/spells/level-1/thunderwave.json` and `public/data/glossary/entries/spells/level-1/thunderwave.md`

### B. Deliverables
<!-- TODO: Make `source` and `legacy` fields part of Deliverables to enforce 2024 PHB alignment and legacy tagging. -->
- [ ] **JSON File Created**: `public/data/spells/level-{N}/{id}.json` exists (always nested by level; no flattened `public/data/spells/{id}.json` files).
- [ ] **Glossary Entry Created**: `public/data/glossary/entries/spells/level-{N}/{id}.md` exists (frontmatter `filePath` must match the level-aware path). Remove any stale flat glossary copies if present.
- [ ] **Class Spell Lists Updated**: If the spell is new, add its ID to the appropriate class spell list(s) in `src/data/classes/index.ts` (e.g., `DRUID_SPELL_LIST`, `WIZARD_SPELL_LIST`). The `classes` array in the JSON must match the lists the spell is added to.
- [ ] **Field Comparison Check (CRITICAL)**: If an old file exists at `public/data/spells/{id}.json`:
    1. **Read the old file FIRST** — It may contain fields not in the new template
    2. **Check these commonly-missed fields** exist in your new file:
       - `ritual` (boolean, required for all spells)
       - `castingTime.combatCost` (object with `type`, required)
       - `tags` (array, if present in old file)
       - `arbitrationType` (if present in old file)
    3. **Verify format correctness**:
       - `validTargets` uses plural: `"creatures"`, NOT `"creature"`
       - `damageType` array uses Title Case: `"Bludgeoning"`, NOT `"bludgeoning"`
    4. **Copy any valuable fields** from old file that aren't in new file
- [ ] **Old JSON Removed**: Delete `public/data/spells/{id}.json` **ONLY after** completing Field Comparison Check above.

### C. JSON Content Compliance
- [ ] **BaseEffect Fields**: Every single effect object **MUST** contain:
    - `trigger`: (e.g., `{ "type": "immediate" }`)
    - `condition`: (e.g., `{ "type": "hit" }` or `{ "type": "save" }`)
- [ ] **Strict Enums (Case-Sensitive)**:
    - **Effect Types**: UPPERCASE → `DAMAGE`, `HEALING`, `DEFENSIVE`, `STATUS_CONDITION`, `UTILITY`, `MOVEMENT`, `SUMMONING`, `TERRAIN`
    - **Schools**: Title Case → `Abjuration`, `Conjuration`, `Divination`, `Enchantment`, `Evocation`, `Illusion`, `Necromancy`, `Transmutation`
    - **Damage Types**: Title Case → `Acid`, `Bludgeoning`, `Cold`, `Fire`, `Force`, `Lightning`, `Necrotic`, `Piercing`, `Poison`, `Psychic`, `Radiant`, `Slashing`, `Thunder`
    - **Classes**: Title Case → `Artificer`, `Bard`, `Cleric`, `Druid`, `Paladin`, `Ranger`, `Sorcerer`, `Warlock`, `Wizard` (and subclasses in the same format, e.g., `Warlock - Fiend Patron`)
    - **validTargets**: Exact values only → `"creatures"`, `"objects"`, `"allies"`, `"enemies"`, `"self"`, `"point"`, `"ground"` (NOT singular like `"creature"`)
    - **STATUS_CONDITION names**: Must be valid D&D 5e conditions → `Blinded`, `Charmed`, `Deafened`, `Exhaustion`, `Frightened`, `Grappled`, `Incapacitated`, `Invisible`, `Paralyzed`, `Petrified`, `Poisoned`, `Prone`, `Restrained`, `Stunned`, `Unconscious`
- [ ] **Required Top-Level Fields (All Spells)**:
    - `id`, `name`, `level`, `school`, `classes`, `description` (always required)
    - `ritual`: **MUST be present** (use `false` for cantrips, `true`/`false` for other spells)
    - `castingTime.combatCost`: **MUST include** `{ "type": "action" | "bonus_action" | "reaction" }`
- [ ] **Level 0 (Cantrip) Rules**:
    - `level`: `0`
    - `ritual`: `false`
    - `scaling`: `{ "type": "character_level", ... }`

### D. Validation
- [ ] **Manifest Updated**: You have run `npx tsx scripts/regenerate-manifest.ts`.
- [ ] **Manifest Paths Correct**: Generated manifest paths are nested (`/data/spells/level-{N}/{id}.json`); fix any flattened paths before commit.
- [ ] **Validation Passed**: You have run `npm run validate` and it reports **0 errors** for your files.
- [ ] **Integrity Passed**: You have run `npx tsx scripts/check-spell-integrity.ts` and resolved any errors.

### E. Logging
- [ ] **Batch File Updated**: Mark completion in the level roll-up batch doc (e.g., `docs/tasks/spell-system-overhaul/LEVEL-1-BATCHES.md` or `LEVEL-2-BATCHES.md`) and add new issues to the matching gaps doc (e.g., `gaps/LEVEL-1-GAPS.md`).
- [ ] **No Side Effects**: You have **NOT** edited shared status files (like `STATUS_LEVEL_0.md`/`STATUS_LEVEL_1.md`).

---

## 2. Protocol: Handling Missing Components (Gap Analysis)

During migration, you may encounter spell mechanics that the current system (Typescript types/JSON schema) cannot support.

**DO NOT** invent new types or fields.
**DO NOT** skip the spell (unless it's impossible to represent even partially).

### Procedure for Gaps:
1.  **Check "Solved Gaps" First**: See if the feature is now supported (below).
2.  **Best Effort Implementation**: If truly unsupported, implement the spell using `UTILITY` or the closest valid type.
3.  **Description Fallback**: Put the complex mechanic in the `description` field.
4.  **Flag for Follow-up**: You **MUST** log this gap in the Batch File.

### Solved Gaps (Use These Features!)
*   **"Willingly Moves"**: Use `trigger: { type: "on_target_move" }`.
*   **"Enters Area"**: Use `trigger: { type: "on_enter_area", frequency: "first_per_turn" }`.
*   **"Undead Target"**: Use `condition: { targetFilter: { creatureType: ["Undead"] } }`.
*   **"On Hit" Rider**: Use `trigger: { type: "on_attack_hit" }` with `consumption` (e.g., `unlimited` for Hunter's Mark, `first_hit` for Smites).

### How to Log Gaps
Append a section titled `## System Gaps & Follow-up` to the bottom of your Batch File if it doesn't exist, and add an entry. For consolidated level docs, append to the corresponding `gaps/LEVEL-{N}-GAPS.md`.

**Format for Batch File Log:**
```markdown
## System Gaps & Follow-up
- [ ] **{Spell Name}**: {Brief description of missing feature}
    - *Context*: {What logic is missing? e.g., "No support for 'teleport' effect type"}
    - *Recommendation*: {What needs to be added? e.g., "Add TELEPORT effect type to BaseEffect"}
```

---

## 3. Self-Correction Checklist
Before finishing your turn, ask yourself:
1. Did I use `damage` (lowercase) instead of `DAMAGE` (uppercase)? -> **Fix it.**
2. Did I forget the `trigger` field because the example didn't have it? -> **Check SPELL_JSON_EXAMPLES.md again, they ALL have it.**
3. Did I invent a `buff` type? -> **Change to DEFENSIVE or STATUS_CONDITION.**
