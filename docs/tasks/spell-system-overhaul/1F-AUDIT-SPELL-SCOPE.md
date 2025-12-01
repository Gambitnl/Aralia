# Path 2.C: Audit Spell Scope - PHB 2024 (Task 0.3)

## MISSION
Compare the existing JSON spell files against the D&D 2024 Player's Handbook (PHB) Cantrip list to create a migration priority list.

## REQUIRED READING
*   `public/data/spells/` (The existing spell files)
*   `docs/spells/SPELL_JSON_EXAMPLES.md` (To identify Old vs New format)

## EXECUTION STEPS
1.  **Fetch External Data**: Search/Retrieve the list of **Cantrips** from the 2024 PHB.
2.  **Scan Local Data**: List all JSON files in `public/data/spells/`.
3.  **Audit**: For each PHB Cantrip, check:
    *   Does it exist locally?
    *   Is it in "Old" format or "New" format? (Check schema against `SPELL_JSON_EXAMPLES.md`).
4.  **Report**: Create `docs/tasks/spell-system-overhaul/@SPELL-AUDIT-CANTRIPS.md`.
    *   **Table 1: Completed (New Format)**
    *   **Table 2: Needs Migration (Old Format)** - Mark as HIGH Priority.
    *   **Table 3: Missing (In PHB, not local)** - Mark as MEDIUM Priority.
    *   **Table 4: Extra (Local, not in PHB)** - Mark as LOW Priority.

## CONSTRAINTS
*   **Focus**: CANTRIPS ONLY for this task.

## DELIVERABLE
A Pull Request containing `docs/tasks/spell-system-overhaul/@SPELL-AUDIT-CANTRIPS.md`.