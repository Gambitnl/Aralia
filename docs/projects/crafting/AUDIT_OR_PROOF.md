# Crafting System Audit / Proof

Status: active
Last updated: 2026-06-09

## Latest Proof

| Date | Scope | Command / check | Result |
|---|---|---|---|
| 2026-06-09 | G1 compatibility regression hardening | `npm exec vitest run src/systems/crafting/__tests__/craftingCompatibility.test.ts` | Passed: 13 tests. |
| 2026-06-09 | Living-project schema | `node scripts/audit-living-project-docs.cjs` filtered to Crafting | `schema_status: valid`; support docs now present. |
| 2026-06-09 | Diff hygiene | `git diff --check` on Crafting touched files | Passed with line-ending warnings only. |

## Coverage Notes

- The compatibility proof preserves both craft engines and does not authorize merge/delete work.
- The focused test file covers legacy success, legacy failure with material loss, legacy failure with returned materials, every documented legacy-to-enhanced quality mapping, every enhanced-to-legacy fallback, and the unavailable enhanced field list.
- G5 remains blocked on the Refining/Enchanting placement decision.

