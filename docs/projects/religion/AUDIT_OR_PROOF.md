# Religion System Audit Or Proof

Status: active
Last updated: 2026-06-09

This file keeps durable proof for Religion System dashboard claims.

## Latest Proof

| Date | Scope | Proof | Result | Notes |
|---|---|---|---|---|
| 2026-06-09 | G4 ownership review gate | `node scripts/audit-living-project-docs.cjs` | passed | Religion now carries a Required Review Brief for ritual consequence ownership and the project status is review-required; no source changes were made. |
| 2026-06-09 | G3 combat taxonomy routing | `npx vitest run src/systems/religion/__tests__/CombatReligionAdapter.test.ts` | passed | CombatReligionAdapter now reads deity-authored combat taxonomy labels, preserves legacy fixed triggers, and covers case-variant, mixed-label, and missing-tag combat logs. |
| 2026-06-09 | Living-project doc audit after G3 | `node scripts/audit-living-project-docs.cjs` | passed | Religion remains schema-valid after the G3 status refresh, next-step routing update, and proof refresh. |
| 2026-06-09 | Living-project doc shape | `node scripts/audit-living-project-docs.cjs` | passed | Religion now has valid dashboard front matter, all required living-project docs, and one current handoff marker. |
| 2026-06-09 | G1 religion compatibility fence | `npx vitest run src/state/reducers/__tests__/religionReducer.test.ts src/state/__tests__/initialState.religion.test.ts` | passed | The reducer now backfills missing favor from legacy `state.divineFavor`, mirrors writes back to both maps, and the seeded default state keeps canonical and legacy favor aligned. |
| 2026-06-09 | G2 temple service typing fence | `npx vitest run src/systems/religion/__tests__/TempleSystem.test.ts` | passed | Temple services now route legacy strings through explicit adapters and keep structured non-heal effects off the heal path. |
| 2026-06-09 | Living-project doc audit after G2 | `node scripts/audit-living-project-docs.cjs` | passed | Religion schema remains valid after the G2 status refresh and next-step routing update. |

## Current Audit Notes

- G1, G2, and G3 are resolved as concrete compatibility slices; G4 is now review-required and G5-G6 remain open.
- A Required Review Brief is now needed because the ritual consequence contract crosses the Religion and Rituals project boundary.
- Runtime source changed during the G2 service typing pass, but the scope stayed inside the Religion system and preserved the legacy path.
