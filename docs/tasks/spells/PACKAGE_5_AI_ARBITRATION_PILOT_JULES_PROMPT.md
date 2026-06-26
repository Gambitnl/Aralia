# Package 5 Jules Prompt: AI Arbitration Pilot

You are Jules working on Aralia Spell Phase 1, Package 5: AI arbitration pilot.

Goal:
Prove one open-ended early-game spell path end to end. The player should be able
to cast an AI-routed spell, provide intent through the input path, receive a
visible arbitration result, and fail safely when AI is unavailable or the input
is invalid. Keep deterministic mechanics deterministic.

Primary context:
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`
- `docs/tasks/spells/PACKAGE_5_AI_ARBITRATION_PILOT.md`
- `src/components/BattleMap/AISpellInputModal.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/systems/spells/ai/AISpellArbitrator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts`
- `src/utils/securityUtils.ts`
- `public/data/spells/level-0/prestidigitation.json`
- `public/data/spells/level-2/suggestion.json`

Preferred spell set:
1. `prestidigitation`
2. `suggestion`
3. Optional assisted-control case: `blindness-deafness`

Allowed write scope:
- `public/data/spells/level-0/prestidigitation.json`
- `public/data/spells/level-2/suggestion.json`
- `public/data/spells/level-2/blindness-deafness.json`, only if needed for a
  focused assisted-arbitration regression
- `src/components/BattleMap/AISpellInputModal.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/systems/spells/ai/AISpellArbitrator.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest focused tests under `src/commands/**/__tests__/`,
  `src/hooks/**/__tests__/`, or `src/components/**/__tests__/`

Do not edit:
- broad AI policy for every illusion/social/utility spell
- deterministic spell mechanics except to preserve existing behavior
- character creator spell choice UI
- character sheet spellbook UI
- premade roster semantics
- Symphony runtime/source files, manifests, receipts, click logs, or local state
- level 4-9 spell behavior

Required work:
1. Add meaningful `aiContext.prompt` values for `prestidigitation` and
   `suggestion`.
2. Set `playerInputRequired` honestly for those spells.
3. Prove the player input modal or simulator-facing input request path appears
   for an AI DM spell that needs input.
4. Prove suspicious or empty input is rejected before arbitration.
5. Prove AI unavailable/disallowed arbitration fails visibly and safely.
6. Prove allowed arbitration can create a narrative command and can process
   returned mechanical effects when present.
7. Preserve the deterministic Package 4 spell path.
8. Regenerate spell validation and spell gates. Do not commit timestamp-only
   `public/data/spell_gate_report.json` churn.
9. Record follow-up AI-routing candidates without broadening this pilot.

Verification:
```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts --reporter=verbose
```

If you add a more focused modal/hook/component test, include it in the final
verification command and completion note.

Acceptance:
- `prestidigitation` and `suggestion` require player intent and have useful
  prompts.
- AI arbitration success, denial/service failure, and suspicious-input rejection
  are covered by tests or rendered proof.
- Deterministic spell behavior is not converted into AI behavior.
- Any additional open-ended spell candidates are recorded as follow-up work.
- No Symphony runtime/source/local-state artifacts are committed.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_5_AI_ARBITRATION_PILOT_JULES_PROMPT.md","sha256WithoutMarker":"b563b72c87094044f1e5217a34d8cb16ea613ee8736f490c2453b9453c78ad99","markedAtUtc":"2026-06-25T22:29:38.362Z"} -->
