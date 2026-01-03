# Contract Tests (Shape Guards)

Purpose: lightweight, type-driven checks that fail fast when core shapes change. Each file focuses on a recurring breakage area.

Files:
- `combatShapes.test.ts` — minimal `BattleMapTile`, `BattleMapData`, `CombatCharacter` + action economy fields.
- `gameStateDefaults.test.ts` — `createMockGameState` must keep critical flags (ollama logs, dev override, economy/religion/environment, banter cooldowns).
- `spells.contract.test.ts` — spells include targeting/effects; `createAbilityFromSpell` returns a combat-ready `Ability`.
- `characterCreation.contract.test.ts` — class/fighting style/ancestry/legacy required fields.
- `travelWorld.contract.test.ts` — travel exports (pace modifiers, ability score casing), travel event shape, market event types.
- `services.contract.test.ts` — Gemini service facades return `StandardizedResult<Gemini*>`.

How to run:
```bash
npm run test -- src/test/contracts

# Domain typecheck slices (faster isolation when full typecheck is noisy)
npm run typecheck -- --project tsconfig.combat.json
npm run typecheck -- --project tsconfig.world.json
npm run typecheck -- --project tsconfig.character.json
npm run typecheck -- --project tsconfig.services.json
```

Why: These guard against the “missing field in mocks/types” churn we’ve been fixing. If a required shape changes, one of these will fail and point to the domain. That keeps fixes localized and preserves intent. 
