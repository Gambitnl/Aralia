# Cantrip Migration Project Knowledge

**Created:** 2025-12-08
**Context:** Consolidation of conversations, findings, and status regarding the migration of Level 0 Spells (Cantrips) to the new JSON system.

---

## 1. Project Status Summary

The project is broken down into 9 batches (approx. 5 spells each).

<!-- TODO: Update batch status table. Batch 2 and 3 show outdated info (e.g., Batch 2 shows `guidance` missing, but PR #56 added it; Batch 3 shows "Pending" but per-spell checklist in 1K is marked complete). Sync this table with actual batch file completions. -->

| Batch | Status | Spells | Notes |
| :--- | :--- | :--- | :--- |
| **Batch 1** | ✅ Complete | `acid-splash`, `blade-ward`, `booming-blade`, `chill-touch`, `create-bonfire` | Gaps identified (see below). |
| **Batch 2** | 🔄 In Progress | `fire-bolt`, `eldritch-blast`, `dancing-lights`, `druidcraft`, `guidance` | `guidance` is missing and needs creation. Others migrated. |
| **Batch 3** | ⏳ Pending | `light`, `mind-sliver`, `mold-earth`, `primal-savagery`, `sapping-sting` | Assigned to Jules (Task `1K`). |
| **Batch 4** | ⏳ Pending | `shape-water`, `sword-burst`, `friends`, `frostbite`, `mage-hand` | Assigned to Jules (Task `1L`). |
| **Batch 5-9** | ⏳ Pending | Remaining cantrips | Tasks `1M` through `1Q` prepared. |

**Tracking File:** `docs/spells/STATUS_LEVEL_0.md`

---

## 2. Identified Schema & System Gaps

The following gaps were identified during the processing of **Batch 1**. These represent mechanics that the current system cannot fully support yet.

### A. Conditional Triggers (Secondary Damage)
*   **Trigger:** "If target willingly moves..."
*   **Affected Spells:** `booming-blade`
*   **Current Limitations:** `trigger.type` only supports `immediate`, `turn_start`, etc. No support for reactive triggers based on target action.
*   **Workaround:** Documented in `description`.
*   **Recommendation:** Add `on_target_action` trigger type.

### B. Area Entry Triggers
*   **Trigger:** "When a creature moves into the bonfire's space..."
*   **Affected Spells:** `create-bonfire`
*   **Current Limitations:** `trigger.type` supports `turn_start` (ends turn in area) but not `on_enter`.
*   **Workaround:** Used `turn_start` which is incomplete.
*   **Recommendation:** Add `on_enter_area` trigger type (Priority: High).

### C. Target Filtering (Conditions)
*   **Condition:** "If you hit an undead target..."
*   **Affected Spells:** `chill-touch`
*   **Current Limitations:** `condition` object cannot filter by creature type, size, or alignment.
*   **Workaround:** Condition text in description.
*   **Recommendation:** Add `targetFilter` object to `EffectCondition`.

### D. Duplicate/Orphaned Files
*   **Issue:** Jules initially created files in `public/data/spells/` (root) instead of `public/data/spells/level-0/`.
*   **Resolution:** Root files were deleted. `spells_manifest.json` correctly points to `level-0`.
*   **Protocol:** Always check for and remove old root-level files after migration.

---

## 3. Protocols & "Iron Rules"

**Source of Truth:** [JULES_ACCEPTANCE_CRITERIA.md](../JULES_ACCEPTANCE_CRITERIA.md)

### Hierarchy of Needs for Jules
1.  **Reference:** Read `SPELL_JSON_EXAMPLES.md` first.
2.  **Field Check:** Compare OLD file (if exists) vs NEW file. Do not lose tags or custom fields.
3.  **Strict Enums:** Verify uppercase/title-case for `damageType`, `school`, `classes`.
4.  **Manifest:** Always regenerate manifest after adding files.
5.  **Validation:** Run `npm run validate` and ensure 0 errors.

### Protocol for Gaps
1.  **Best Effort:** Implement closest valid logic (e.g., `UTILITY` type).
2.  **Fallback:** Describe complex logic in `description`.
3.  **Log:** Record the gap in the Batch File under `## System Gaps & Follow-up`.

---

## 4. Key Conversations

*   **Coordinate Jules Cantrip Migration** (`947f062d`): Established the batch workflow, assigned Jules to tasks, and defined the initial scope.
*   **Spell Audit Project Setup** (`43c66fa4`): Formalized the acceptance criteria and created the `BATCH-CREATION-GUIDE.md`.
*   **Read Spell System Prompt** (`c4b9afa3`): Initial context loading for the spell system overhaul.

## 5. Relevant File Index

*   **Batch Files:** `docs/tasks/spell-system-overhaul/1I-MIGRATE-CANTRIPS-BATCH-1.md` (and similar `1J`...`1Q`)
*   **Gap Log (Master):** `docs/tasks/spell-system-overhaul/gaps/LEVEL-1-GAPS.md` (Includes Cantrip Batch 1 gaps)
*   **Criteria:** `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`
*   **Status:** `docs/spells/STATUS_LEVEL_0.md`
