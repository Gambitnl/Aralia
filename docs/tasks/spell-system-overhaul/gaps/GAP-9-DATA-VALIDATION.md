# GAP-9: Spell Data Validation Errors

**Status:** High Priority / Data Integrity
**Discovered:** During Validation Run (2025-05-20)

## Context
The validation script `scripts/validate-data.ts` is functional and correctly identifies spells that do not conform to the Zod schema defined in `src/systems/spells/validation/spellValidator.ts`.

## Current Errors
The following 6 spells have broken data and need immediate remediation:

### 1. `find-familiar`
*   **Issues:**
    *   `duration.concentration`: Missing (expected boolean).
    *   `effects[0].trigger`: Missing.
    *   `effects[0].condition`: Missing.
    *   `effects[0].summon.statBlock.skills`: Invalid keys ("Perception", "Stealth").
*   **Fix:** Add missing fields; ensure skill keys use strict enum or IDs if required.

### 2. `mage-armor`
*   **Issues:**
    *   `effects[0].duration.type`: Invalid option.
*   **Fix:** Ensure duration type matches `rounds`, `minutes`, or `special`.

### 3. `shield`
*   **Issues:**
    *   `effects[0].duration.type`: Invalid option.
    *   `effects[1].duration.type`: Invalid option.
*   **Fix:** Check strict literal types for duration.

### 4. `shield-of-faith`
*   **Issues:**
    *   `effects[0].duration.type`: Invalid option.
*   **Fix:** Likely same as above.

### 5. `tensers-floating-disk`
*   **Issues:**
    *   `range.type`: Invalid option.
    *   `duration.type`: Invalid option.
    *   `duration.concentration`: Missing.
    *   `effects[0].trigger`: Missing.
    *   `effects[0].condition`: Missing.
*   **Fix:** Review against Zod schema allowed values.

### 6. `unseen-servant`
*   **Issues:**
    *   `range.type`: Invalid option.
    *   `duration.type`: Invalid option.
    *   `duration.concentration`: Missing.
    *   `effects[0].trigger`: Missing.
    *   `effects[0].condition`: Missing.
*   **Fix:** Add missing fields and correct enum values.

## Action Plan
1.  Open each file in `public/data/spells/`.
2.  Apply fixes to satisfy the Zod validator.
3.  Run `npm run validate` to confirm clean pass.
