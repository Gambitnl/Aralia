# Task 07: Audit Weapon Data for Proficiency Consistency

Status: historical audit task note
Last reviewed: 2026-03-12

## Current reading

This is now a historical audit-task note.

## Verified current-state caution

Manual repo verification on 2026-03-12 confirmed that the old standardize everything onto explicit isMartial booleans or remove the field entirely decision did not fully become the final source-of-truth shape.

The current helper in src/utils/character/weaponUtils.ts still:

- prefers category
- falls back to isMartial
- keeps compatibility with mixed historical weapon data

Use this task and the audit report as evidence about the older data-cleanup direction, not as proof that the cleanup ended in a fully single-source model.