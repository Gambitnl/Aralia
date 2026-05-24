# Spell Phase 1 Task Tracker

Status: active guiding tracker for early-game spell execution.

This is the single task collection and status tracker for Spell Phase 1. It
does not replace detailed package docs, receipts, Atlas trackers, or PR notes.
It points to them, keeps the package queue coherent, and records adjacent gaps
that should not quietly expand the active slice.
Symphony draft ids, workflow logs, click receipts, and local run state stay
external unless a short excerpt is needed in a durable Aralia-facing packet or
temporary migration note.

## How To Use This File

1. Add new tasks here when mapping, implementation, review, or verification
   exposes them.
2. Keep each top-level task status current enough that a future foreman can see
   what is active, blocked, done, or out of scope.
3. Split complex work into package-specific or subsystem-specific task files
   when more detail is needed, then link those files from this tracker.
4. Record adjacent gaps here when they are discovered but do not belong in the
   active slice.
5. Do not delete completed task history unless the artifact lifecycle policy
   says the context has been preserved elsewhere.

Statuses:

- `not_started`: known but not active.
- `active`: current work is happening now.
- `blocked`: next action is known but blocked.
- `waiting`: external checks, Jules, PR review, deployment, or operator action.
- `done`: complete with proof linked.
- `superseded`: replaced by another task or policy.
- `out_of_scope`: recorded gap or task is intentionally outside Phase 1.

## Canonical References

- Plan: `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Lifecycle policy:
  `docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md`
- External decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- Package 3 packet:
  `docs/tasks/spells/PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md`
- Package 4 packet:
  `docs/tasks/spells/PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md`
- Setup PR: `https://github.com/Gambitnl/Aralia/pull/933` (merged
  2026-05-21)
- Package 2 clean-base draft: `draft-1779400428597-mind7o`
- Package 2 Linear issue:
  `https://linear.app/aralia/issue/ARA-7/spell-phase-1-package-2-premade-party-and-gear`
- Package 2 Jules session:
  `https://jules.google.com/session/15527431301408060204`
- Package 2 PR:
  `https://github.com/Gambitnl/Aralia/pull/935`
- Symphony dashboard-first repair PR:
  `https://github.com/Gambitnl/Aralia/pull/936`

## Active Package Queue

| ID | Status | Owner | Task | Detail file | Current boundary |
|---|---|---|---|---|---|
| P0 | done | Codex foreman | Symphony finalization baseline: post-ARA-6 contract, stale-status cleanup, branch/worktree discipline, decision reporting, task evidence pathways, artifact lifecycle rules | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Verification contract passed; dynamic specifications and active queues fully modularized |
| P1 | done | Codex foreman | Scoped baseline inventory for levels 0-3 | `SPELL_PHASE_1_BASELINE_REPORT.md` | Baseline report exists; use as context for later packages |
| P2 | done | Jules implementation, Codex foreman review | Premade level-1 party gear, combat readiness, and caster spellbook legality | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`, `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`, `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | PR #935 merged cleanly; equipment starter assignments fully live |
| P2D | done | Codex foreman | Dashboard-first hardening for Package 2 handoff monitoring | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`; Decisions 26-37; PR #936 | PR #936 merged cleanly; safe PR-refresh, glob resolution, operator answer receipts, and quiet hours fixes fully live |
| P2R | done | Codex foreman, Jules preferred after filing | Workflow-config repair lane for PR #935 failed `review / review` automation | local draft `draft-1779410025252-nnowpt` (`Setup repair for ARA-7`) | Setup repair draft merged and integrated |
| P3 | done | Codex foreman closeout | Character creator spell selection and character sheet spellbook visibility | `PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md` | Wizard selection, known spells filtering, and level 1-3 spellbook tabs merged cleanly via PR #954 |
| P4 | done | Jules implementation, Codex foreman closeout | Combat simulator deterministic spell pilot | `PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md` | PR #979 merged cleanly on 2026-05-22; direct-damage and healing pilots fully live in simulator tests |
| P5 | active | Jules preferred after P4 | AI arbitration pilot for open-ended spells | create `PACKAGE_5_*` docs after deterministic pilot | Scoping and planning the first AI arbitration pilot prompts and player inputs |
| P6 | not_started | Jules preferred after pilots | First mechanics bucket closure for levels 0-3 | create mechanics-discovery docs from current mechanics-discovery evidence | Waiting on pilot evidence |

## Current Setup And PR Tasks

| ID | Status | Task | Evidence | Next action |
|---|---|---|---|---|
| S1 | done | Land setup/context docs so Jules can read Package 2 context from the expected base branch | PR #933 merged as `40678de8` | Done |
| S2 | done | Repair clean-clone typecheck blocker from tracked markdown-library entry importing ignored DesignPreview local tool | Decision 22 in decision report; PR #933 Build green after `tsconfig.json` exclusion | Done |
| S3 | done | Rerun Symphony task queue/preflight from local `master` after setup context lands | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean preflight: local and remote `master` both `40678de8` |
| S4 | done | Dispatch Package 2 to Jules | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Jules session `15527431301408060204` launched and queued |
| S5 | done | Inspect completed Jules session result through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Visible Jules session showed a plan-approval gate, not a usable completion result; plan was approved through the dashboard-linked Jules page |
| S6 | done | Monitor approved Package 2 Jules run through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Dashboard captured PR #935 and current boundary moved to `Bridge Through Scout/Core` |
| S7 | done | Review Package 2 PR #935 before Scout/Core merge path | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`, `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` | PR #935 successfully merged on GitHub |

## Adjacent Gap Log

Use this section for discoveries that matter, but are adjacent to the active
slice or outside its write scope. If a gap becomes active, promote it into the
package queue or a linked detailed task file.

| Gap ID | Status | Found during | Gap | Why adjacent/out of scope | Where to continue |
|---|---|---|---|---|---|
| G1 | done | PR #933 setup checks | Clean CI typecheck failed when tracked `src/md-library-entry.tsx` imported ignored `src/components/DesignPreview/` files | It blocked setup PR merge, but was not spell implementation work | Decision 22; PR #933 Build green |
| G2 | out_of_scope | Package 2 planning | Broad clean-clone typecheck health may include other ignored/local tool mismatches | Package 2 scoped Jules work only needs spell validation and combat utility tests; broad typecheck cleanup should stay separate unless it blocks setup PRs | Record future setup/CI task if more failures appear |
| G3 | not_started | Package 2 planning | Higher-level caster fixtures for level 2-3 spell testing need a roster design decision | Useful for Phase 1, but not part of the default level-1 party gear slice | Promote after P2 or during P3/P4 planning |
| G4 | done | Dashboard-first Package 2 monitoring | After Jules launch, receipt-doc edits made the dashboard worktree non-`master` and dirty, causing the global foreman boundary to show Git sync instead of the active Jules refresh boundary | This is a Symphony dashboard/workflow limitation exposed by the test flow, not spell implementation work | Decision 26; `conductor/symphony/src/server.ts` middleman path repair |
| G5 | done | Dashboard-first Package 2 monitoring | The dashboard first viewport spent too much space on run totals/control API links and showed raw ISO update timestamps with milliseconds | This is a dashboard usability issue exposed by human-style browser navigation, not spell implementation work | Decision 27; `conductor/symphony/public/dashboard.js`; `conductor/symphony/public/dashboard.css` |
| G6 | done | Dashboard-first Package 2 monitoring | A live dashboard refresh could replace the `Refresh Jules Status` button while the operator was trying to click it | This is a dashboard interaction stability issue exposed by human-style browser navigation, not spell implementation work | Decision 28; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-dashboard-interaction-stability.mjs` |
| G7 | done | Dashboard-first Package 2 monitoring | Jules can report `COMPLETED` without a captured PR URL, while the in-app browser may still be blocked on Google sign-in before the result can be inspected | This is a Symphony/Jules visibility and filing blocker, not spell implementation work | Decision 29; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs` |
| G8 | done | Dashboard-first Package 2 monitoring | The dashboard-linked Jules page can reveal a visible plan-approval gate even when Symphony's prior stored status said `COMPLETED` with no PR URL | This was a Symphony/Jules state reconciliation gap, not spell implementation work | Decision 30; dashboard refresh after approval eventually captured PR #935 |
| G9 | done | Visible Jules Package 2 monitoring | The Jules working tree showed helper/scratch files and generated/audit surfaces outside declared write scope while work was in progress; PR #935 file list does not include those helper files, but three premade JSON files still carry large formatting churn | Helper files were transient; formatting was accepted and successfully merged | PR #935 successfully merged |
| G10 | done | PR #935 CI review | GitHub broad test job fails in `src/hooks/actions/__tests__/handleMovement.test.ts`, expecting winter travel time `2700` but receiving `8100`; focused movement test passes locally on both PR #935 checkout and the foreman checkout | Ambient failure resolved and PR successfully merged | PR #935 successfully merged |
| G11 | active | Dashboard task-page note attempt | The visible task message form could not be filled from Codex because the in-app browser reported that its virtual clipboard is not installed | This is a dashboard/workflow evidence-path limitation, not spell implementation work; using a hidden task-message endpoint would bypass the dashboard-first test | Keep durable notes in this tracker/receipt; add a robust visible note-entry fallback or dashboard-side action later |
| G12 | done | Package 2 task-page Scout/Core bridge | The task page listed a safe `POST /refresh-pr` endpoint as raw text under guarded actions, but did not provide a visible control to run that non-mutating refresh | This was a Symphony dashboard affordance gap exposed by dashboard-first PR review, not Package 2 spell implementation work | Decision 31; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page now has `Run Safe Symphony Refresh` |
| G13 | done | Package 2 Scout/Core scope review | Scout/Core treated Package 2 expected-file globs as literal paths and falsely reported the premade JSON and combat test files as out of scope | This was a Symphony evidence-classification bug; the PR file list itself remained inside the declared write scope | Decision 32; `conductor/symphony/src/task-intake.ts`; `conductor/symphony/scripts/verify-pr-scope-risk.mjs`; live evidence now reports `outOfScopeFiles: []` |
| G14 | done | Package 2 operator-answer path | The visible operator-answer form required typed text, but the in-app browser cannot reliably fill that text box because its virtual clipboard path is unavailable | This is a Symphony dashboard workflow limitation; using the hidden operator-answer endpoint would bypass the dashboard-first test | Decision 33; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page recorded `create_setup_repair_task` through `Record Selected Decision` |
| G15 | done | Package 2 selected repair-lane routing | After `create_setup_repair_task` was recorded, the task page still showed PR refresh/Jules feedback instead of the executable local setup-repair draft lane | This was a Symphony workflow-routing gap; the selected decision was recorded but not surfaced as the next visible dashboard action | Decision 34; `conductor/symphony/src/server.ts`; live task page created `draft-1779410025252-nnowpt` through `Create Local Repair Draft` |
| G16 | done | Main dashboard boundary after PR capture | The global `Current Foreman Boundary` still showed `Jules session` / `Refresh Jules Status` after Package 2 had captured PR #935 and recorded the setup-repair lane | This was a dashboard routing bug; completed Jules session receipts should not mask the PR/check boundary once a PR exists | Decision 35; `conductor/symphony/src/server.ts`; `conductor/symphony/public/dashboard.js`; live dashboard now shows `GitHub PR` and `Needs input: 0` |
| G17 | done | Git disposition through visible dashboard | The required Git disposition controls existed inside Git Safety, but the drawer was collapsed by default while Git sync/disposition was the active blocker | This was a dashboard visibility bug exposed by the dashboard-first rule; calling the disposition endpoint directly would bypass the human workflow being tested | Decision 36; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-sync-decision-board.mjs`; live dashboard now opens Git Safety and recorded `tracked_changes=commit_for_jules_base` plus `remote_commits=integrate_after_local_safe` visibly |
| G18 | done | Current-boundary PR review | The top `Current Foreman Boundary` said `Run GitHub PR` with `Method POST` and `Can run now yes`, but rendered only raw links instead of the existing safe PR-refresh button | This was a dashboard affordance bug; using the raw POST endpoint or hunting for a lower duplicate button would weaken the dashboard-first workflow | Decision 37; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-pr-boundary-after-jules-completion.mjs`; current-boundary PR refresh now renders as `Refresh GitHub PR` |
| G19 | done | Phase 1 spellbook assembly audit | `useCharacterAssembly` was carrying the full class spell list into `knownSpells`, which made the creator spellbook look like every class spell was already known instead of only the selected/prepared subset | This was adjacent to the spellbook-visibility work rather than the combat pilot; the creator hook needed a narrow data fix, not a broader UI rewrite | `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`; `src/components/CharacterCreator/hooks/__tests__/useCharacterAssembly.test.tsx`; `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx`; `src/components/CharacterSheet/__tests__/CharacterSheetModal.test.tsx` |
| G20 | done | Visible Package 4 dashboard audit | The dashboard is still surfacing a local-sync blocker on the master checkout even though Package 4 now has PR #979 ready for review | Blocker resolved and PR #979 merged successfully | PR #979 merged successfully |

## Detailed Task File Index

| File | Purpose | Status |
|---|---|---|
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md` | Package 2 scope and acceptance criteria | active, blocked before Jules dispatch |
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md` | Exact Jules prompt for Package 2 | prompt-ready, not dispatched |
| `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` | Handoff guard for Package 2 | active |
| `PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` | Package 2 Atlas/gate proof target | pending implementation |
| `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` | Package 2 Codex review/failure classification target | pending implementation |
| `PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` | Package 2 task-scoped communication target | pending implementation |
| `PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` | Package 2 PR/deployment/local-sync target | pending implementation |
| `PACKAGE_3_SPELL_SELECTION_AND_SPELLBOOK_VISIBILITY.md` | Package 3 spell-selection and spellbook visibility packet | active |
| `PACKAGE_4_DETERMINISTIC_COMBAT_SIMULATOR_PILOT.md` | Package 4 deterministic combat simulator pilot packet | waiting on PR review after visible handoff through Linear issue ARA-10 |
| `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Retain/archive/delete policy for package artifacts | active |
| `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean-base Package 2 draft, Linear issue, handoff, manifest, Jules launch, PR #935, and scoped verification receipt | active, PR review in progress |

## Update Rules

- Update this tracker before starting a new package.
- Update it after every package-level PR, merge, local sync, Jules dispatch,
  Jules result, foreman review, Atlas/gate checkpoint, or artifact filing
  decision.
- When a change only preserves Symphony runtime state, classify it as external
  or ignored unless the Aralia tracker needs a short durable summary.
- If a detailed package file contradicts this tracker, treat that as a tracking
  bug: reconcile the two instead of assuming either one is silently correct.
- Adjacent gaps should stay visible here until they are either promoted,
  rejected, accepted as future work, or linked to a more specific tracker.
