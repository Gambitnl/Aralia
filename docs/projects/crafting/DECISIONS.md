# Crafting System Decisions

Status: active
Last updated: 2026-06-09

## Decisions

| Date | Decision | Rationale | Proof / follow-up |
|---|---|---|---|
| 2026-06-09 | Preserve both `craftingSystem.ts` and `craftingEngine.ts` while G1 compatibility hardening continues. | The legacy and enhanced craft engines use different quality vocabularies and side-effect payloads, so consolidation would risk behavior loss before the compatibility matrix is fully proven. | `src/systems/crafting/__tests__/craftingCompatibility.test.ts` now covers success/failure normalization, bidirectional quality mapping, and unavailable enhanced fields. |
| 2026-06-09 | Keep Refining/Enchanting UI placement blocked under G5. | The systems exist, but the current crafting UI does not assign them a clear panel/tab owner. Forward UI work needs product/architecture placement first. | Keep `docs/projects/crafting/GAPS.md` G5 blocked until a decision is recorded. |

