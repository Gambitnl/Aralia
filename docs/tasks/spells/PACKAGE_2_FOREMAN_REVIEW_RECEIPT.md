# Package 2 Foreman Review And Failure Classification Receipt

Status: historical PR #935 foreman review; PR #935 has merged.

Backlog-retirement note, 2026-06-25: this receipt is retained as Package 2
review provenance. Current package state lives in
`docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md` and package history; do not
restart Package 2 from the stale active-review wording below.

This receipt is the review desk for Codex after Jules returns the premade party
and gear slice. It exists before dispatch so the first Spell Phase 1 Jules PR
has a clear, repeatable review path instead of relying on memory or scattered
terminal notes.

## Current State

- Package 2 Jules handoff exists: `yes`
- Package 2 PR or patch exists: `yes`
- Scope review complete: `yes`
- Local verification complete: `yes`
- Failure classification complete: `partial`
- Deployment/local-sync evidence applicable: `no`
- Can Package 3 begin from this receipt: `no`

Reason: PR #935 exists and scoped Package 2 verification passes, but GitHub's
broad test job and Gemini review job are still failing. The broad test failure
is outside the Package 2 diff and needs an explicit Scout/Core disposition
before merge or Package 3 readiness.

Dashboard bridge status: the task-page safe refresh control now works from the
visible Symphony page, and Scout/Core now honors Package 2 expected-file globs.
Current Scout/Core evidence reports `outOfScopeFiles: []` and file risk
`medium` due to large diff size, not write-scope escape.

## Scope Review Fields

- Jules handoff/session id: `15527431301408060204`
- Package 2 branch:
  `jules/spells-package2-premade-party-gear-15527431301408060204`
- Package 2 PR or patch: `https://github.com/Gambitnl/Aralia/pull/935`
- Changed files: thirteen files under `public/premade-characters/`,
  `src/utils/combat/combatUtils.ts`, and
  `src/utils/combat/__tests__/combatUtils_premade.test.ts`
- Files within allowed write scope: `yes`
- Out-of-scope files, if any: `none in final PR file list`
- Scout/Core out-of-scope files after glob repair: `[]`
- Scout/Core file risk after glob repair: `medium`, because the diff is still
  large enough to require review attention
- Premade identities preserved: `yes from semantic JSON diff; still review
  large formatting churn before merge`
- Character creator UI touched: `no`
- Character sheet spellbook UI touched: `no`
- Broad spell schema/runtime architecture touched: `no`
- AI arbitration policy touched: `no`
- Symphony orchestration files touched: `no`

## Verification Fields

- `npm run validate:spells`: passed via
  `tsx scripts/validateSpellJsons.ts`; `459 / 459` spell JSON files valid
- `npm run generate:spell-gates`: passed via
  `tsx scripts/generateSpellGateReport.ts`; `459` spells, `0`
  schema-invalid, `3` structured-vs-canonical mismatches, `0`
  structured-vs-JSON mismatches
- Combat utility or premade legality test: passed via concrete Windows-safe
  command:
  `vitest run src/utils/combat/__tests__/combatUtils_premade.test.ts src/utils/combat/__tests__/combatUtils_attack.test.ts src/utils/combat/__tests__/combatUtils_rollDice.test.ts --reporter=verbose`;
  `3` files passed, `16` tests passed
- Additional focused checks: `handleMovement.test.ts` passed locally on both
  the detached PR #935 checkout and the Codex foreman checkout after GitHub's
  broad test job failed that same test
- Visual spellbook or character creator proof claimed by Package 2: `no`

Package 2 must not claim visual spellbook or character creator proof. If Jules
touches or reports those surfaces, route that as Package 3 follow-up unless the
operator explicitly changes the slice scope.

## Failure Classification

Classify each blocker before deciding repair, feedback, merge, or Package 3
readiness:

- `none`: no blocker remains
- `scope`: Jules changed files or behavior outside Package 2
- `data`: premade JSON, equipment shape, caster legality, or manifest issue
- `runtime`: combat conversion, AC/baseAC, weapon range, or attack behavior
- `test`: missing, weak, or failing local verification
- `spell_gate`: spell validation or gate refresh issue
- `atlas`: Atlas/reporting evidence missing or inconsistent
- `setup`: dependency, install, typecheck, or environment issue
- `decision_boundary`: requires an operator or foreman decision before moving
  forward
- `external`: GitHub, deployment, or other outside-system state

For each blocker, record:

- Blocker: GitHub broad `Tests` job fails in unrelated
  `src/hooks/actions/__tests__/handleMovement.test.ts`.
- Classification: `external` plus `test`.
- Evidence: PR #935 does not touch movement files; focused movement test passes
  locally on both the PR checkout and the foreman checkout.
- Agent decision: do not ask Jules to broaden Package 2 into movement repair.
- Repair path: Scout/Core must classify as ambient CI/order issue, rerun after
  any known isolation fix, or split a separate movement-test stability task.
- Next proof: documented Scout/Core disposition before merge.

- Blocker: Gemini review job fails.
- Classification: `external`.
- Evidence: workflow uses `gemini-1.5-flash`; Gemini CLI reports the model is
  not found or not supported for `generateContent`.
- Agent decision: treat as CI/review infrastructure, not a Package 2 code
  finding.
- Repair path: update Gemini workflow/model separately or accept as
  non-blocking with a recorded decision.
- Next proof: passing review rerun or explicit Scout/Core waiver.

- Blocker: large JSON formatting churn in three premade files.
- Classification: `decision_boundary`.
- Evidence: semantic diff is narrow, but line churn remains high in
  `kael_ironvow.json`, `lyris_songweaver.json`, and
  `thalren_deeproot.json`.
- Agent decision: do not mark as a functional failure; require Scout/Core to
  decide whether reviewability is good enough or should go back to Jules for a
  narrower rewrite.
- Repair path: accept with semantic-diff evidence, or ask Jules to preserve
  prior formatting while keeping the same semantic changes.
- Next proof: recorded reviewability decision.

- Resolved blocker: Scout/Core initially reported Package 2 premade JSON files
  and `combatUtils_premade.test.ts` as out of scope.
- Classification: `dashboard_workflow` plus `scope_evidence`.
- Evidence: expected-file globs were declared in the task scope, but the
  classifier treated them as literals until Decision 32.
- Agent decision: repair the dashboard evidence classifier instead of waiving
  the false warning manually.
- Result: visible safe refresh now reports `outOfScopeFiles: []`; this issue no
  longer blocks PR review.

## Review Outcomes

Choose exactly one outcome after review:

- `ready_for_pr_follow_through`: scope and local verification are good enough to
  continue PR/deployment/local-sync tracking.
- `needs_jules_feedback`: Jules should repair within the same Package 2 branch.
- `needs_codex_review_repair`: Codex should use the reserved
  `codex/spells-package2-premade-party-gear-review` branch for a bounded repair.
- `needs_operator_decision`: the blocker is a real scope, product, or workflow
  decision.
- `blocked_do_not_advance`: Package 2 is not safe to advance and Package 3 must
  not begin.

Current outcome: `needs_operator_decision`.

Reason: Package 2 itself appears scoped and locally verified, but the PR still
has failed GitHub checks and reviewability concerns that must be dispositioned
through the dashboard/Scout/Core bridge before merge.

## Rules

- Do not mark Package 2 complete from Jules status alone.
- Do not open Package 3 until this receipt, the Atlas/gate checkpoint receipt,
  and the ROI evidence path all agree that Package 2 is safe to advance.
- Do not silently fold Package 3 UI work, broad spell runtime architecture, or
  AI arbitration policy into this receipt.
- If Codex performs any review repair, record why Jules feedback was not the
  better first repair path.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md","sha256WithoutMarker":"7d7d77091b97844c86ae1e4504cbb1e6f0a8341676bfb3718088be6146ee338f","markedAtUtc":"2026-06-25T22:29:38.345Z"} -->
