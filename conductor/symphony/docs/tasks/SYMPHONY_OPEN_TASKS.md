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
- Package 15 `summon_or_controlled_entity` is now the active Jules package.
  PR #1114 landed the durable Aralia-facing packet/prompt and visible dashboard
  shortcut. Codex used that visible `Create Package 15 Draft` control to create
  draft `draft-1779771507621-vox90j`, linked Linear `ARA-24`, prepared handoff
  `handoff-1779774561087-k9184e`, staged the ignored `.jules` manifest, and
  launched Jules session `5400768066928394476`.
- Package 15 carries the compact decision/wait-state rule directly. The next
  Jules run should record full decisions only for real forks such as plan
  approval/rejection, repair requests, branch-hygiene repair, replacement
  handoff, scope expansion, and merge/closeout. Routine implementation choices,
  repeated unchanged waits, file lists, and verification output should stay in
  compact wait rows, task receipts, PR summaries, or completion reports.
- Latest Package 15 live fork: visible Jules inspection showed a plan approval
  gate, but the plan ordered implementation before the required full row
  classification. Codex sent a bounded dashboard/Jules revision request instead
  of approving it. Symphony must now route that state to `Refresh Jules Status`
  until Jules responds with a revised plan, starts work, opens a PR, or exposes
  a blocker; stale `Approve Jules Plan` should not remain the next action after
  an operator revision note has been sent.
- Current Package 15 live state: Jules produced a revised plan that begins with
  row classification and Codex approved it visibly. A later dashboard refresh
  recorded Jules `COMPLETED` with no PR URL, no completion result, and no branch,
  while visible Jules still showed `Plan approved` plus a `Pause session`
  control. GitHub open-PR search found no current Package 15 PR, so Codex
  treated that as stale completion reconciliation, not package closeout.
  Follow-up visible Jules inspection then showed `Jules is working`,
  `Pre-commit checks passed`, Package 15 file content, and still no PR link.
  A later visible Jules check showed all plan steps completed, and GitHub now
  has PR #1122 from branch
  `jules/spells-package15-summon-controlled-entity-5400768066928394476`. The
  current proof target moved to Codex foreman review of PR #1122 against the
  Package 15 task packet. GitHub checks were green, but foreman review found
  acceptance blockers: raw `.jules/worklogs/worklog_scribe.md` runtime noise in
  the diff, stale `summon_or_controlled_entity.md` header counts after row
  status changes, and structured `summon-beast` / `phantom-steed` data that
  needs to either carry the supported stat-block facts or narrow its claim.
  Codex posted bounded PR feedback at
  `https://github.com/Gambitnl/Aralia/pull/1122#issuecomment-4541506297`.
  A later GitHub refresh still showed original head
  `197021520769bf9303db7dc331972a85f805605d`, and a visual Jules inspection
  still showed `Ready for review` with the raw `.jules/worklogs/worklog_scribe.md`
  diff visible. Codex posted one explicit `@jules` repair nudge at
  `https://github.com/Gambitnl/Aralia/pull/1122#issuecomment-4549145355`.
  Jules reacted with eyes to that nudge, but GitHub still showed the same PR
  head at the time this status was recorded.
- Latest proof target closed: repair and prove the queue-focus rule exposed
  after Package 15 draft creation. A visible `Refresh All Jules` run reconciled
  Package 14 to completed/merged/local-current, but the dashboard top action
  still preferred older stale handoff bookkeeping over the new Package 15
  `Create Linear Issue` boundary. PR #1115 repaired that first stale-history
  path and Codex created Linear `ARA-24`; the follow-up live check then exposed
  an older completed/no-PR Package 10 post-launch update record stealing focus
  from Package 15 `Prepare Handoff`. A later check exposed the same class again:
  closed Package 9 PR #1030 feedback and Package 14's completed middleman
  receipts still borrowed the current path. The current repair adds a separate
  `Prepare Handoff` middleman stage and suppresses closed/superseded history
  from the global queue when a newer draft owns the path. PR #1117 merged that
  repair; after restart, visual/API proof showed Package 15 `Prepare Handoff`,
  and Codex continued through visible handoff prep, manifest staging, and Jules
  launch. PR #1119 then proved the plan-revision routing repair. Current next
  proof target: wait for a new Package 15 PR #1122 head or Jules reply after the
  explicit nudge, then compare that head with the bounded repair request before
  accepting. Green checks alone are not enough while the raw `.jules` file,
  stale bucket counts, or partial stat-block claim remain unresolved. If the
  PR head remains unchanged after the explicit nudge/acknowledgement, the next
  real fork is a bounded current-master branch-hygiene repair, a replacement
  handoff from current `origin/master`, or filing the Jules session as stale.

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
- Package 15 is the current spell package carrying this compact rule in the
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
- **Package 15 follow-up**: PR #1114 proved the visible shortcut could create
  draft `draft-1779771507621-vox90j`, but then the global queue action still
  preferred stale older handoff bookkeeping over the fresh draft. The shortcut
  exists; the remaining defect is queue focus after old handoffs reconcile to
  completed, stale-local, or completed/no-PR superseded states. PR #1115 fixed
  the unlaunched stale duplicate case; the active follow-up extends that repair
  to the completed/no-PR post-launch update case exposed after Linear `ARA-24`.
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
