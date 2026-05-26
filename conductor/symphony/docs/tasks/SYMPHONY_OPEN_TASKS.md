# Symphony Open Task Order

This file is the canonical index and ordered queue for the Symphony/Jules middleman track. It organizes proof tasks, baseline contracts, and historical closeout reports into a clean, easy-to-digest roadmap.

## Workflow Status Index

For details on each task, including the specific proof logs, timing diaries, and terminal validation captures, click through to the dedicated task files linked below.

### Historical Milestones & Closeout Records

| ID | Status | Subject | Closeout / Proof Record | Key PRs / Commits |
|---|---|---|---|---|
| **Historical ARA-6 Proof Thread** | `done` | Add regression coverage for non-proficient weapon attack penalties | [ARA-6_CLOSEOUT_REPORT.md](./ARA-6_CLOSEOUT_REPORT.md) | PR #931 / PR #932 / `28ff49a6` |
| **P2** | `done` | Premade party gear, AC conversion logic, & ranged weapon ranges | [PACKAGE_2_CLOSEOUT_REPORT.md](./PACKAGE_2_CLOSEOUT_REPORT.md) | PR #935 / PR #936 |

### Proving-Ground Baseline Contracts

| Order | Status | Subject | Details File |
|---|---|---|---|
| 1 | `done` | Integration Health Checks (Smoke Tests) | [01-integration-health-checks.md](./01-integration-health-checks.md) |
| 2 | `done` | Linear Issue Creation Proof | [02-linear-creation-proof.md](./02-linear-creation-proof.md) |
| 3 | `done` | Jules Manifest Staging Proof | [03-jules-manifest-staging-proof.md](./03-jules-manifest-staging-proof.md) |
| 4 | `done` | Jules Launch Readiness and Launch Proof | [04-jules-launch-readiness-and-launch-proof.md](./04-jules-launch-readiness-and-launch-proof.md) |
| 5 | `deferred` | Dispatch Toggle & Real Worker Proof | [05-dispatch-toggle-real-worker-proof.md](./05-dispatch-toggle-real-worker-proof.md) |
| 6 | `deferred` | Dynamic Worker Mode Consumption Proof | [06-dynamic-worker-mode-consumption-proof.md](./06-dynamic-worker-mode-consumption-proof.md) |

---

## Active Proving-Ground: Spell Phase 1

For the active proving-ground Spell Phase 1 track:
- Packages 1 through 14 have been used to exercise the Symphony/Jules path; use
  the spell tracker for the exact latest package boundary and adjacent gaps.
- The detailed checklist and adjacent gap log for early-game spells live in [SPELL_PHASE_1_TASK_TRACKER.md](../../../docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md).
- Package 14 `vision_light_sound` launched through the visible dashboard/Jules
  path as Linear `ARA-23`, draft `draft-1779763218951-adiujn`, handoff
  `handoff-1779763287600-th7aze`, and Jules session
  `16016352181102771214`. Its task packet and Jules prompt carry the compact
  decision/wait-state rule directly, so ordinary queued/loading/working
  rechecks should stay compact unless a real decision fork appears.
- Package 14 is now complete on `master` through PR #1110,
  `3fdf4cb174d42f15f38353adf69890015ec33ff6`. Jules produced useful
  sound/sensory/illusion product work, but after bounded count-repair feedback
  it pushed an out-of-scope `.github/workflows/gemini-review.yml` quota-bypass
  change instead of the requested `vision_light_sound.md` header fix. Codex
  performed a bounded clean-acceptance repair from current `origin/master`,
  preserved only durable Package 14 product/test/bucket files, corrected the
  bucket counts to Open `61`, Closed `185`, Deferred flavor `7`, added
  interpretability comments to the new focused test/type mirror, force-pushed
  the clean head with lease, and merged after local and GitHub verification.
  Next spell action: select Package 15 from the execution-plan priority list,
  likely `summon_or_controlled_entity`, before launching another Jules task.
- Visual recheck on 2026-05-26 04:54 +02:00 showed the Package 14 Jules page
  signed in, displaying the launched task packet, setting up the repository,
  and reading `public/data/spells/level-1/alarm.json`. There was no plan
  approval gate, PR URL, explicit blocker, or Jules question yet. That is a
  compact wait state: the next proof target is plan approval, PR/result, or an
  explicit blocker, not another full decision entry.
- Visual recheck on 2026-05-26 05:05 +02:00 showed a Package 14 plan approval
  gate. Codex rejected the first plan through visible Jules chat because it did
  not make the required full named-row classification explicit before choosing
  a subset, and it risked closing `fog-cloud`/`darkness` rows without proving
  the exact non-broad visibility facts. Next proof target: revised Jules plan
  with full classification and a separated `implement_now` subset.
- Visual approval on 2026-05-26 05:14 +02:00 accepted Jules' revised Package
  14 plan. The revised plan begins with classification of every named
  cantrip/level 1-3 row, then separates the likely implementation subset
  (`alarm`, `thaumaturgy`, `daylight`, `silent-image`, `major-image`) from
  narrow proofs and deferred broader systems. Package 14 is now waiting for
  Jules implementation/PR evidence or an explicit blocker.
- Visual check on 2026-05-26 05:21 +02:00 showed Jules working with
  `classify.js` / `classify.cjs` helper activity. Codex sent a visible scope
  correction: preserve the classification results in durable bucket/task notes,
  but remove helper scripts before PR submission and keep the final file list to
  approved Package 14 artifacts.
- Visual checks through 2026-05-26 05:40 +02:00 showed Jules had removed the earlier
  classification helpers, selected the Package 14 implementation subset, and
  moved into type/data/test/doc updates. The visible activity still included
  `patch_types.js`, `patch_types.cjs`, `patch_json.cjs`, and
  `patch_markdown.cjs`, so Codex sent a second visible scope correction after
  confirming the chat submission: those patch helpers must be deleted before PR
  submission, while the tracked `src/types/spells.d.ts` mirror may remain only
  if Jules explains and verifies the repo convention that keeps it aligned with
  `src/types/spells.ts`.
- Visual check on 2026-05-26 05:49 +02:00 showed Jules still in `Running code
  review ...`, no open Package 14 PR on GitHub, and a new `patch_alarm.js`
  helper after the broader patch-helper correction. Codex sent a shorter
  visible reminder that `patch_alarm.js` is also temporary and every
  `patch_*.js` / `patch_*.cjs` helper must be removed before PR submission.
- Jules opened PR #1110 for Package 14 with a helper-clean durable file list
  and green core GitHub checks. Codex's local merge-result review passed the
  focused spell validation, Atlas bucket audit, sensory mechanics Vitest, and
  TypeScript proof, but found one bounded stale-count issue in
  `vision_light_sound.md`: the table rows now count `closed: 185`,
  `open/actionable_open: 61`, and `deferred_flavor: 7`, while the header still
  showed the old `76` open and `170` closed summary. Codex posted bounded PR
  feedback, Jules reacted with eyes, and a visible Jules-page check confirmed
  the active Package 14 session/branch. Current next action is to wait for a
  new PR #1110 head, then verify the count repair before acceptance.
- Follow-up refresh showed PR #1110 still at head `2c7cb414...` with no new
  repair commit. A visible Jules-page check showed the session on
  `.github/workflows/gemini-review.yml`; GitHub confirmed that workflow file is
  not in the submitted PR diff, so this is a session-drift warning rather than
  a current PR artifact. Codex posted one bounded PR nudge asking Jules to push
  the count-only repair or state the blocker/counting rule, and restated that
  workflow edits must stay out of Package 14. If the next visible check still
  shows no new head, choose and record a foreman branch repair or replacement
  handoff path before acting.
- Package 14 launch exposed two dashboard UI blockers after the durable packet
  landed: completed Package 13 closeout did not reveal next-package intake, and
  the open intake drawer still auto-refreshed during clicks. PR #1100 and PR
  #1101 repaired those dashboard-first blockers before Jules launch.
- Package 13 `terrain_or_surface` is complete. It launched to Jules as Linear
  `ARA-22`, handoff `handoff-1779754985825-4yijzn`, and Jules session
  `4325471518148676473`, then merged through PR #1096 as
  `0cd0af47f348b21f331644e7d1bdb502400d3f3a`.
- Package 13 proved the compact wait-state rule and also exposed the remaining
  high-friction pattern: useful Jules product work can still need a bounded
  foreman clean-acceptance repair when the PR branch is stale or carries
  out-of-scope workflow edits.
- Visual recheck on 2026-05-26 02:31 +02:00 showed the Package 13 Jules page
  still displaying the task content and pause-session control, with no plan
  approval, PR, blocker, or question visible yet. That is a compact wait state,
  not a new assumed-approval decision.
- On 2026-05-26 02:40 +02:00, Codex approved the visible Package 13 Jules plan.
  The plan stays inside the expected terrain data/runtime/test path, includes
  full row classification before bucket closure, and targets a coherent
  terrain subset instead of a tiny one-row implementation.
- On 2026-05-26 02:52 +02:00, a visual Jules refresh showed early scope drift:
  patch helper files, `patch_*.js`, `src/types/combat.ts.orig`, root
  `test_terrain_command.ts`, and `src/types/combat.ts` appeared in the visible
  diff. Codex sent a bounded visible correction asking Jules to clean those
  artifacts before submit and stay on durable Package 13 files unless
  `src/types/combat.ts` is explicitly unavoidable.
- On 2026-05-26 03:00 +02:00, a follow-up visual Jules refresh showed the first
  correction had only partially cleaned the diff: `patch_bucket.js`,
  `patch_bucket_more.js`, `.orig` files, and `src/types/combat.ts` were still
  visible. Codex sent a second visible correction before PR submission.
- On 2026-05-26 03:08 +02:00, Jules' visible session reported that it removed
  all patch/orig files, reverted `src/types/combat.ts`, moved the terrain type
  mapping into `TerrainCommand.ts`, and kept focused `TerrainCommand` tests.
  The session was running code review with no PR URL yet, so the next state is
  compact wait for PR or exact blocker.
- Jules then opened PR #1096. Codex reviewed the visible Jules page and GitHub
  PR state, found a later out-of-scope `.github/workflows/gemini-review.yml`
  quota-bypass edit plus stale tracker/process-doc risk, and force-pushed a
  clean current-master acceptance branch with lease. The accepted head kept
  only the Package 13 product/test/bucket/completion-note files and recorded
  Plant Growth's exact 4:1 movement multiplier as a residual gap.
- PR #1096 passed local verification and GitHub Build, Lint, Tests, Quality,
  Poison, Analyze, and CodeQL checks, then merged on 2026-05-26.
- Visible dashboard use exposed that the Package Packet Drafts section had no
  Package 13 button. PR #1090 repaired that blocker by rendering package
  shortcuts from a shared registry and adding Package 13 there, rather than
  adding another one-off click handler.

---

## Governance & Proving-Ground Rules

Documentation is part of the live workflow, not an after-action cleanup item. The following principles govern Symphony development and must be preserved by all foremen and workers.

Every live task is also a workflow test. Foremen should advance the bounded
task and correct the workflow record in the same pass when the task reveals
dashboard friction, stale docs, unclear ownership, or missing proof. If the
repair would cross a guarded boundary or derail the task, log the gap here, in
the audit, or in the proving-ground tracker with the next proof target.

### 1. Canonical Reference Mapping
- The canonical approval-boundary table is `../JULES_MIDDLEMAN_OPERATING_SPEC.md#approval-boundaries`.
- The canonical workflow-phase table is `../JULES_MIDDLEMAN_OPERATING_SPEC.md#workflow-phases`.
- For the active spell Phase 1 track, the operator has allowed assumed approvals at each phase boundary.
- Every assumed approval must be logged in
  [`SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`](../decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md)
  listing the decision point, options, decision made by the agent, rationale,
  and mutation performed or skipped.
- Decision logging should stay proportional. Use a full assumed-approval
  decision only when the foreman chooses between materially different paths,
  such as approving or rejecting a plan, sending bounded repair feedback,
  replacing a stale handoff, performing branch-hygiene repair, merging, or
  expanding scope. Repeated observations that preserve the same state should use
  a compact wait-state row in the tracker, task receipt, or this queue instead
  of another full decision entry.
- A state can advance visually without becoming a full decision. For example,
  `queued` -> `setting up repository` -> `working` is still compact when no
  approval gate, PR, blocker, or Jules question appears. It becomes a full
  decision only when the foreman must choose between materially different next
  actions.
- Package 14 is the next spell package that carries this compact rule in the
  Jules task/prompt before launch. If Jules still writes full decision entries
  for plain queued/working refreshes, treat that as a workflow-template gap to
  repair, not as evidence that every wait needs another decision.
- If an assumed approval or boundary decision exposes workflow/doc friction,
  the same decision entry should point to the repair proof or the owning gap
  entry so the decision report is not the only durable record.

### 2. Git & Verification Discipline
- Do not gitignore contract verifiers.
- Files matching `conductor/symphony/scripts/verify-*.mjs` are durable source when they protect the Symphony workflow.
- Runtime state such as `conductor/symphony/.symphony/*`, live proof captures, visual verification images, and Jules run output should stay ignored.
- Raw Symphony receipts and local dashboard byproducts should also stay ignored
  by default. Promote only the short Aralia-facing answer that a future worker
  needs, such as final package status, material PR links, current blocker, or
  accepted repair outcome. Do not make spell trackers list every Symphony
  support PR; point detailed workflow provenance back to this queue, the audit,
  or the decision report.

### 3. Environment & Execution Guidelines
- **Task Routing**: Symphony evaluates task scope sequentially. The next proof demonstrates sequential Jules execution and not parallel local workers.
- **Jules environment setup**: Ensure the environment snapshot is verified before dispatch. The accepted Package 2 setup requires `package2_scoped_snapshot_passed`. The detailed operator instructions are kept in `SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md` and the environment result in `SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`.
- **Intake Flow**: Submit `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json` to local Symphony for Package 2 Symphony task draft submission and Jules dispatch.
- **Delegation ROI ledger**: Track Codex costs conservative-first without mixing estimations into measured tokens.

### 4. Historical Reference Strategy
- ARA-6 is historical proof for the workflow rather than the current live contract target.
- Historical closeouts are fully archived. All active spell tasks align with `EARLY_GAME_SPELL_EXECUTION_PLAN.md`.

### 5. Active Workflow Gap: Jules Session Base Drift
- **Status**: implemented; keep monitoring during future active Jules sessions.
- **Observed failure mode**: Codex merged an updated task tracker to GitHub
  after Jules had already started from an earlier base commit. Jules then opened
  its PR from the older isolated checkout, so the new tracker wording did not
  reach Jules and the PR conflicted in the tracker.
- **Operating rule**: after Jules starts, no new local commits, merged tracker
  PRs, or GitHub-synced task-doc adjustments should be assumed to appear inside
  that running Jules session. Adjustments need an explicit communication or
  branch-update method: visible Jules message, `[Jules feedback]` PR comment,
  foreman PR-branch repair/rebase after PR creation, or replacement handoff from
  current `origin/master`.
- **Decision logging rule**: if the desired action is to wait because Jules is
  believed to be preparing a repair commit, record that as an explicit
  `wait_for_jules_repair_commit` state with the observed PR head, the visible
  Jules state, and the next recheck condition. The first wait after a new fork
  may justify a full decision entry; repeated unchanged waits should be compact
  wait-state rows unless new evidence changes the available choices. Do not let
  an unstated "wait" become the hidden default, but do not turn every refresh
  into another full decision.
- **Repair-head rule**: a new Jules PR head only resolves the wait after the
  foreman compares it with the requested repair. Green checks or a changed
  commit hash are not enough if the head adds unrelated workflow files or leaves
  the requested package acceptance issue unresolved.
- **Latest Package 10 proof**: PR #1059 demonstrated the rule in practice.
  Jules' first repair head was newer and green but still carried an
  out-of-scope workflow edit and did not add object/placement proof, so the
  valid action was another bounded repair request and explicit `@jules` nudge.
  After Jules pushed a scoped repair head, Codex still compared acceptance
  coverage before merging and added only a bounded test-proof repair on the PR
  branch.
- **Implemented behavior**: Symphony now keeps a post-launch base-drift packet on
  launched Jules handoffs when current `origin/master` moves after the recorded
  launch base. The dashboard warning says that the running Jules clone will not
  receive later tracker or workflow edits automatically and points the foreman to
  visible Jules message, bounded PR feedback, PR-branch repair/rebase, or
  replacement handoff.
- **Verifier**: `node scripts\verify-jules-post-launch-base-drift.mjs` after
  `npm run build` from `conductor/symphony`.

### 6. Active Workflow Gap: Task-Page Promotion Feedback And Duplicate Handoffs
- **Status**: observed during Package 11 launch; repair still needed.
- **Observed failure mode**: the standalone task page for Package 11 created
  Linear `ARA-20`, then the visible `Prepare Handoff` button did not visibly
  advance, navigate, or show a useful status message. Later dashboard
  inspection showed the clicks had actually promoted duplicate handoffs:
  `handoff-1779735447555-z4a0fu` and `handoff-1779735529994-aq60x6`.
- **Operating rule**: if a task-page boundary button appears not to advance,
  inspect the dashboard/task JSON before clicking it again. If a duplicate is
  created, choose exactly one active handoff, record the duplicate as stale, and
  do not launch both.
- **Mutation-label issue**: the Package 11 task page displayed `Mutates
  external systems: No` for Linear issue creation and `Mutates local files: No`
  for Jules manifest staging. Those labels are too broad for the actual
  boundary and should be corrected so operators can trust the visible safety
  summary.
- **Latest Package 11 proof**: the active path is
  `handoff-1779735529994-aq60x6`, launched to Jules session
  `13361122470730968094`. The duplicate `handoff-1779735447555-z4a0fu` should
  remain unlaunched/stale unless the active path is explicitly abandoned. On
  2026-05-25 at 21:25 +02:00, Codex approved Jules' revised visible plan after
  Jules removed the out-of-scope command-base files from the first plan; Jules
  now shows `Plan approved` and `Working`.
- **Next repair target**: make task-page guarded actions show success/failure
  receipts and refresh to the live handoff after promotion; prevent repeated
  draft promotion when a draft already has a promoted handoff.

### 7. Active Workflow Gap: Jules PR Branch Hygiene After Base Drift
- **Status**: observed and resolved for Package 11 by bounded foreman
  branch-hygiene repair; keep as an operating pattern for future Jules PRs.
- **Observed failure mode**: Jules opened PR #1072 with useful Package 11 product
  work, but the branch also included raw `.jules` worklog state and stale-base
  rewinds of current Symphony docs/tracker records that had already landed on
  `master`.
- **Operating rule**: a Jules PR that contains useful implementation work is not
  automatically acceptable if it carries raw runtime artifacts or stale-base
  workflow doc rewinds. Foreman review must compare the PR against current
  `origin/master`, remove or request removal of raw `.jules`/runtime state, and
  preserve current durable tracker and decision records.
- **Package 11 proof**: Codex posted bounded repair feedback on PR #1072
  at `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536811401`.
  Local review found `validate:spells`, Atlas audit, and focused Vitest passed,
  but `npx tsc --noEmit --pretty false` failed in the new test file. A later
  GitHub recheck still showed PR head `bc1d6bfa5b9282b4f9a6081e16cf00fe05a9935a`
  and the same file-list issues, while the visible Jules page showed "I have
  received the PR comments and am processing them." That correctly kept the
  task in `wait_for_jules_repair_commit`, not local takeover and not a
  blocked-goal filing.
- **Repair recheck**: Jules pushed PR head
  `19738e8cf512c6058dffa196de318d8b65bdd15d`. Local foreman verification now
  passes `validate:spells`, Atlas audit, focused Vitest, and
  `npx tsc --noEmit --pretty false`. The branch is still not acceptable because
  it adds a Package 11 worklog entry to `.jules/worklogs/worklog_scribe.md` and
  rewinds current `master` Symphony/tracker documentation, including the
  Package 11 decisions and wait-state docs from PR #1074. Codex posted a second
  bounded repair request at
  `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536944637`.
- **Latest wait-state proof**: after PR #1075 merged, PR #1072 still showed
  head `19738e8cf512c6058dffa196de318d8b65bdd15d`, remained dirty, and still
  listed `.jules/worklogs/worklog_scribe.md`. Codex posted explicit `@jules`
  branch-hygiene nudge
  `https://github.com/Gambitnl/Aralia/pull/1072#issuecomment-4536996291`, which
  GitHub shows Jules has seen.
- **Closeout proof**: Jules later pushed head
  `907b210816ca7c7fffaa6928561e69f6d041c6d5`, but it still rewound current
  Symphony/tracker docs. Codex performed a bounded foreman branch-hygiene repair
  from current `origin/master`, preserved only the seven Package 11 product/test
  files, committed `e974ae3ada4df16ebb62ab4fd6054374ae666a2d`, and force-pushed
  that clean head with lease to PR #1072. GitHub then showed the PR file list
  scoped to `command.json`, `lesser-restoration.json`, `StatusConditionCommand`,
  `SpellCommandFactory`, their focused tests, and `src/types/spells.ts`, with no
  `.jules` worklog or stale Symphony doc rewinds. Local gates passed
  `npm run validate:spells`, `node scripts\auditAtlasBuckets.mjs`, focused
  `StatusConditionCommand` / `SpellCommandFactoryStatus` Vitest,
  `npx tsc --noEmit --pretty false`, and `git diff --cached --check`; GitHub
  Build, Lint, Tests, Quality, Poison, Analyze, and CodeQL passed. PR #1072
  merged on 2026-05-25 as
  `d5dfd3f1fafca0e7ab74460ed8ebbb425de25b57`.
- **Future repair target**: if a Jules repair remains stale after explicit
  feedback and visible/named nudge, bounded foreman branch-hygiene repair is a
  valid option when the product/test slice is already verified and the repair is
  limited to preserving current `origin/master`, removing raw runtime artifacts,
  and keeping the scoped Jules implementation files.

### 8. Active Workflow Gap: Package Packet Shortcut Drift
- **Status**: immediate Package 12 repair landed through PR #1079; Package 13
  registry repair landed through PR #1090; metadata-derived shortcut discovery
  remains open.
- **Observed failure mode**: after the Package 12 and Package 13 task packets
  landed on `master`, the visible dashboard still lagged behind the next
  package boundary until a separate dashboard repair added the button. The
  manual draft form existed, but the known in-app browser long-text-entry path
  is unreliable in this proving-ground, so a hidden task-draft API call would
  skip the operator-facing blocker.
- **Operating rule**: when a committed spell package packet is the next tracker
  boundary, the dashboard must expose a visible way to create the corresponding
  local draft before Codex launches Jules. If the visible control is missing,
  repair the dashboard control or record the blocker; do not silently create the
  draft through a hidden endpoint.
- **Immediate Package 12 repair**: PR #1079 added a visible
  `Create Package 12 Draft` button wired to the committed Package 12 task and
  prompt, and extended
  `conductor/symphony/scripts/verify-task-dashboard-navigator.mjs` so the
  packet shortcut cannot silently fall behind the tracker again for this
  package. Codex then used the visible path to create draft
  `draft-1779743756459-8uvr0z`, Linear `ARA-21`, handoff
  `handoff-1779744252464-e065rv`, and Jules session `3991627368289943007`.
- **Future repair target**: replace the hardcoded packet-button list with a
  small package registry or metadata-derived list, so each new package packet
  becomes visible without another dashboard source edit. Preserve the current
  explicit-button behavior until that registry exists; it is still safer than
  hidden endpoint use during the active proving-ground.
- **Latest Package 13 proof**: PR #1090 added Package 13 to a shared packet
  registry, rendered shortcut buttons from that registry, and routed package
  draft clicks through one generic handler. Codex then used the visible Package
  13 button to create draft `draft-1779754729582-hqen06`, Linear `ARA-22`,
  handoff `handoff-1779754985825-4yijzn`, stage the ignored Jules manifest, and
  launch Jules session `4325471518148676473`.

### 9. Active Workflow Gap: Low-Value Jules Package Sizing
- **Status**: observed during Package 12 plan approval; operating rule added,
  durable repair still needed in future packet/scoping templates.
- **Observed failure mode**: the Package 12 visible Jules plan proposed a small
  three-spell implementation and named `src/commands/effects/UtilityCommand.ts`
  outside the declared expected write scope. Approving that plan would pay the
  full Symphony/Linear/Jules/GitHub overhead for a low-yield slice while also
  allowing a scope expansion without an explicit file-scope reason.
- **Operating rule**: before approving a Jules plan, compare the proposed
  implementation value with the orchestration cost. If the work is repetitive,
  testable, and covered by existing schema/test patterns, ask Jules for a
  larger coherent safe batch instead of approving a tiny representative slice.
  Keep exclusions explicit: broad terrain, light/vision, summon/control, social
  AI, trap/glyph, combat HUD, levels 4-9, Symphony runtime, and GitHub workflow
  edits remain out of scope unless a later package says otherwise.
- **Latest Package 12 proof**: Codex withheld approval for Jules session
  `3991627368289943007` and sent a visible revision request asking Jules to
  classify all cantrip/level 1-3 `conditional_ending` candidates that fit
  existing schema/test patterns, implement the largest coherent safe subset,
  justify any unavoidable file outside the original write scope, and list
  deferred rows with reasons. Jules revised the plan to cover `hex`,
  `hunters-mark`, `knock`, `detect-thoughts`, and `flame-arrows`, removed the
  direct `UtilityCommand.ts` edit, kept the runtime bridge inside allowed
  `SpellCommandFactory` / `spellAbilityFactory` / focused-test territory, and
  deferred `animal-messenger`. Codex approved the revised plan visibly. Jules
  then asked whether the revised plan met expectations, so Codex used an
  explicit visible Jules message as the post-launch update channel and told
  Jules to proceed exactly within the approved five-spell scope, with no
  `UtilityCommand.ts` edit. Jules later reached visible `Verify`, but repeated
  GitHub PR checks and remote branch checks still showed no Package 12 handoff.
  Codex sent one bounded visible Jules status nudge asking Jules to open the PR
  if verification passed, or report the exact failing command, error output,
  and smallest proposed repair if blocked. A later visible check showed Jules
  still working and making post-nudge test/documentation updates, so the active
  decision is monitored wait rather than stale-session replacement or local
  takeover. Jules then opened PR #1084, proving the monitored wait was useful,
  but the PR was `DIRTY` against current `master`, rewound tracker truth, marked
  P12 closed before acceptance, and widened
  `SpellCommandFactory.createCommand` from private to public without a clear
  production need. Codex posted bounded repair feedback at
  `https://github.com/Gambitnl/Aralia/pull/1084#issuecomment-4537781802`.
  Because that first repair comment had shell-escaped text damage, Codex posted
  a clean explicit `@jules` restatement at
  `https://github.com/Gambitnl/Aralia/pull/1084#issuecomment-4537832896`.
  Jules pushed a partial repair, but the PR still carried stale docs/process
  noise and `fix_conflict.sh`. Codex performed a bounded foreman
  branch-hygiene repair from current `origin/master`, preserved only the
  accepted Package 12 product/test files, kept `createCommand` private, typed
  `CommandContext.conditionalEndings` as `ConditionalEnding[]`, and
  force-pushed that clean head with lease to PR #1084. Local verification and
  GitHub Build/Lint/Tests/Quality/Poison/Analyze/CodeQL checks passed. PR #1084
  merged on 2026-05-25 as
  `2a9dc25e19daae04db06053b61cdca9e1dc82a4e`.
- **Future repair target**: update package templates so they include a minimum
  package-value check, an explicit candidate-classification step, and a rule
  that plans naming files outside expected scope must justify why the file is
  necessary before approval.

---

## Superseded Per-Task Status

The older task status logs remain as historical context:
- **Task 02, Task 03, and Task 04** status descriptions have been superseded by the completed ARA-6 and Package 2 verification runs. Refer to [02-linear-creation-proof.md](./02-linear-creation-proof.md), [03-jules-manifest-staging-proof.md](./03-jules-manifest-staging-proof.md), and [04-jules-launch-readiness-and-launch-proof.md](./04-jules-launch-readiness-and-launch-proof.md) for individual contract validations.
