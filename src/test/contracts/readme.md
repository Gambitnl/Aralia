# Contract Tests (Shape Guards)
<!-- TODO: Fix mojibake (“â€””, “â€œ”) by normalizing this file to UTF-8/ASCII so contract docs render cleanly. -->

Purpose: lightweight, type-driven checks that fail fast when core shapes change. Each file focuses on a recurring breakage area.

Files:
- `combatShapes.test.ts` â€” minimal `BattleMapTile`, `BattleMapData`, `CombatCharacter` + action economy fields.
- `environmentLogs.contract.test.ts` â€” contract for environment/ollama log shapes. <!-- No entry here previously; added to document the existing contract test. -->
- `gameStateDefaults.test.ts` â€” `createMockGameState` must keep critical flags (ollama logs, dev override, economy/religion/environment, banter cooldowns).
- `quests.contract.test.ts` â€” quest shape invariants for planning and state updates. <!-- No entry here previously; added to document the existing contract test. -->
- `spells.contract.test.ts` â€” spells include targeting/effects; `createAbilityFromSpell` returns a combat-ready `Ability`.
- `statusEffects.contract.test.ts` â€” status effect shape guard coverage. <!-- No entry here previously; added to document the existing contract test. -->
- `characterCreation.contract.test.ts` â€” class/fighting style/ancestry/legacy required fields.
- `travelWorld.contract.test.ts` â€” travel exports (pace modifiers, ability score casing), travel event shape, market event types.
- `services.contract.test.ts` â€” Gemini service facades return `StandardizedResult<Gemini*>`.

How to run:
```bash
npm run test -- src/test/contracts

# Domain typecheck slices (faster isolation when full typecheck is noisy)
npm run typecheck -- --project tsconfig.combat.json
npm run typecheck -- --project tsconfig.world.json
npm run typecheck -- --project tsconfig.character.json
npm run typecheck -- --project tsconfig.services.json
```

Why: These guard against the â€œmissing field in mocks/typesâ€ churn weâ€™ve been fixing. If a required shape changes, one of these will fail and point to the domain. That keeps fixes localized and preserves intent. 
