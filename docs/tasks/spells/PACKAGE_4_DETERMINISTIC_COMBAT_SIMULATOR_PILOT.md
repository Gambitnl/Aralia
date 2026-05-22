# Package 4 Jules Task: Deterministic Combat Simulator Pilot

Status: done; the visible handoff through Linear issue ARA-10 completed and
PR #979 merged cleanly.

This is the deterministic combat simulator slice for Spell Phase 1. It exists
to prove that early-game spells do real work end to end once they leave the
selection and preparation surfaces. The slice should stay narrow enough that
success or failure is obvious in tests and rendered play.

This packet is the durable Aralia-facing home for the work. Symphony draft ids,
handoff receipts, click receipts, workflow logs, and local run state stay
external or ignored unless a small excerpt is needed here for future Aralia
contributors.

Current live state: ARA-10 was linked, the Jules handoff produced PR #979,
and that PR merged cleanly on 2026-05-22. Keep this file as the scope and
acceptance record, not as a runtime receipt.

Local proof already in place:
- `src/hooks/__tests__/useAbilitySystem.package4.test.tsx` now covers a level 0
  cantrip (`fire-bolt`), a level 1 multi-target spell (`magic-missile`), a
  level 2 multi-target spell (`scorching-ray`), and a level 3 area spell
  (`fireball`) against the combat simulator bridge.

Dashboard boundary note:
- The visible dashboard is also reporting a separate local-sync blocker on the
  master checkout. That state belongs to external Symphony/local git workflow,
  not to this Aralia packet and not to any transient runtime receipt.

## Worker

Default worker: Jules.

Codex role: foreman only. Codex owns scoping, review, verification, decision
reporting, and packet maintenance. Jules should own the implementation-heavy
combat-path changes once the slice is dispatched through the visible workflow.

## Why This Slice Exists

Package 3 is responsible for spell visibility and selection surfaces.
Package 4 was responsible for proving that the selected spells actually
resolve in the combat simulator in a deterministic way.

The pilot therefore used the smallest representative set of spells that
exercised:

- direct damage
- simple healing
- save-or-condition resolution
- a buff or duration/resource change that stays readable in combat logs

If the smallest useful set is enough, do not widen the slice just to cover more
spells. The goal was a reliable simulator proof, not a broad spell rewrite.

## Prompt Draft

```text
You were Jules working on Aralia Spell Phase 1, Package 4: deterministic combat
simulator pilot.

Goal:
Prove a deterministic early-game spell path end to end in the combat simulator.
Use the smallest representative set of level 0-3 spells that exercised damage,
healing, condition, and buff behavior. Keep Package 3 spellbook visibility work
out of this slice; only touch combat/runtime code and targeted tests needed to
prove the simulator path.

Primary context:
- docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md
- docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md
- docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md
- docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md
- src/hooks/useAbilitySystem.ts
- src/commands/factory/SpellCommandFactory.ts
- src/utils/character/spellAbilityFactory.ts
- src/components/BattleMap/BattleMap.tsx
- src/components/Combat/CombatView.tsx

Allowed write scope:
- src/commands/factory/SpellCommandFactory.ts
- src/hooks/useAbilitySystem.ts
- src/utils/character/spellAbilityFactory.ts
- the nearest existing combat/battle map tests that prove the pilot path
- spell data only if a narrow data change is required to make the pilot
  deterministic and testable

Do not edit in this slice:
- character creator spellbook UI
- broader spell data migration or schema work
- AI arbitration policy, except to preserve non-deterministic fallback behavior
- Symphony runtime, manifest, draft, receipt, or click-log artifacts

Required work:
1. Make the deterministic spell path visible enough to execute from the combat
   simulator.
2. Ensure selected spells, target validation, cost checks, and resolution flow
   through one deterministic path.
3. Make the combat log or equivalent state updates prove the spell actually
   resolved.
4. Preserve existing AI-routed spell behavior outside the deterministic slice.
5. Add or update a focused test proving the pilot path works end to end.

Verification to run:
- npm run validate:spells, if spell data changes
- npm run generate:spell-gates, if spell data changes
- npx vitest run src/commands/__tests__/SpellCommandFactory.test.ts --reporter=verbose
- npx vitest run src/hooks/__tests__/useAbilitySystem.test.ts --reporter=verbose

If the slice needs a narrower test file, use the nearest existing combat or
battle-map test that actually covers the pilot path and report that exact path.
Do not claim Package 3 spellbook visibility or Package 5 AI-routed spell work
from this slice.

Acceptance criteria:
- Representative deterministic spells can be cast from the combat simulator
  without falling into AI-routed fallback behavior.
- Target selection, validation, resource/action cost, and effect application
  were visible in tests or render-backed checks.
- Combat log output proved the spell resolved.
- Existing AI spell fallback behavior remained intact for AI-routed cases.
- Any broader spellbook visibility issue discovered during this slice was
  recorded for Package 3 instead of being solved here.

Handoff notes:
- Keep transient Symphony draft ids, click receipts, and local sync state
  external or ignored unless they are needed to explain a durable decision in
  this packet.
- Use the visible dashboard/Linear/Jules path for dispatch and review.
- PR #977 and similar receipt-only PRs should only be pulled into Aralia GitHub
  if they add a real Aralia-facing summary; otherwise they stay external or
  ignored.

## Closeout

- PR #979 merged the deterministic combat simulator pilot.
- The packet stays here as a durable record of scope and proof for future
  Aralia contributors.
```
