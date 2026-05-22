# Spell Phase 1 Task Tracker

Status: active guiding tracker for early-game spell execution.

This is the single task collection and status tracker for Spell Phase 1. It
does not replace detailed package docs, receipts, Atlas trackers, or PR notes.
It points to them, keeps the package queue coherent, and records adjacent gaps
that should not quietly expand the active slice.

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
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
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
- Package 2 setup-review workflow repair PR:
  `https://github.com/Gambitnl/Aralia/pull/937`
- Package 2 closeout PR:
  `https://github.com/Gambitnl/Aralia/pull/938`
- Package 3 handoff packet PR:
  `https://github.com/Gambitnl/Aralia/pull/939`
- Symphony worktree Git-gate repair PR:
  `https://github.com/Gambitnl/Aralia/pull/940`
- Symphony scoped Git-disposition repair PR:
  `https://github.com/Gambitnl/Aralia/pull/941`
- Package 3 launch tracking PR:
  `https://github.com/Gambitnl/Aralia/pull/942`
- Package 3 monitor-decision PR:
  `https://github.com/Gambitnl/Aralia/pull/945`
- Package 3 no-PR routing repair PR:
  `https://github.com/Gambitnl/Aralia/pull/947`
- Package 3 publish-request documentation PR:
  `https://github.com/Gambitnl/Aralia/pull/948`
- Symphony worktree local-sync stand-in repair PR:
  `https://github.com/Gambitnl/Aralia/pull/949`
- Package 3 task-routing focus repair PR:
  `https://github.com/Gambitnl/Aralia/pull/951`
- Package 3 dashboard draft: `draft-1779442977969-w2vsy4`
- Package 3 Linear issue:
  `https://linear.app/aralia/issue/ARA-9/spell-phase-1-package-3-spellbook-and-character-creator-visibility`
- Package 3 Symphony handoff: `handoff-1779443555192-bnpws7`
- Package 3 Jules session:
  `https://jules.google.com/session/2823658242418460192`
- Package 3 wait-loop dashboard repair PR:
  `https://github.com/Gambitnl/Aralia/pull/955`
- Package 3 Scout/Core evidence-refresh repair PR:
  `https://github.com/Gambitnl/Aralia/pull/960`

## Active Package Queue

| ID | Status | Owner | Task | Detail file | Current boundary |
|---|---|---|---|---|---|
| P0 | active | Codex foreman | Symphony finalization baseline: post-ARA-6 contract, stale-status cleanup, branch/worktree discipline, decision reporting, task evidence pathways, artifact lifecycle rules | `EARLY_GAME_SPELL_EXECUTION_PLAN.md`, `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Setup PR #933, Package 2 workflow/closeout PRs, Package 3 handoff packet PR #939, Package 3 no-PR routing repair PR #947, publish-request docs PR #948, worktree local-sync gate repair PR #949, task-routing focus repair PR #951, wait-loop repair PR #955, post-feedback state-model repair PR #957, monitor-resync docs PR #958, Scout/Core feedback docs PR #959, and Scout/Core evidence-refresh repair PR #960 have landed; current monitor branch `codex/spell-phase1-monitor-16` is carrying a local dashboard state-model fix so posted Scout feedback routes to `Wait for Jules Repair` instead of a duplicate feedback command |
| P1 | done | Codex foreman | Scoped baseline inventory for levels 0-3 | `SPELL_PHASE_1_BASELINE_REPORT.md` | Baseline report exists; use as context for later packages |
| P2 | done | Jules implementation, Codex foreman review | Premade level-1 party gear, combat readiness, and caster spellbook legality | `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`, `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`, `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`, `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`, `PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` | PR #935 merged on 2026-05-22 after PR #937 repaired the review workflow, the PR branch was updated with current `master`, GitHub CI reran clean, and post-merge local gate checks passed on the closeout branch |
| P2D | done | Codex foreman | Dashboard-first hardening for Package 2 handoff monitoring | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`; Decisions 26-42; PR #936; PR #937 | Dashboard-first Package 2 blockers exposed useful repairs: safe PR refresh buttons, Scout/Core glob handling, visible operator decision buttons, setup-repair lane routing, global PR boundary routing, Git Safety visibility, current-boundary action buttons, and first-viewport focus strip; Stitch MCP server entry exists but still needs authentication/restart before Stitch-generated redesigns can be used |
| P2R | done | Codex foreman local-careful | Workflow-config repair lane for PR #935 failed `review / review` automation | local draft `draft-1779410025252-nnowpt` (`Setup repair for ARA-7`); Decisions 38, 40, 41; PR #937 | PR #937 merged, PR #935 branch was updated against current `master`, rerun CI passed, and PR #935 then merged |
| P3 | waiting | Jules implementation, Codex foreman monitoring | Character creator spell selection and character sheet spellbook visibility | `PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_TASK.md`, `PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_PROMPT.md`, `PACKAGE_3_DISPATCH_READINESS_CHECKLIST.md`, `PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json`, `PACKAGE_3_SYMPHONY_HANDOFF_RECEIPT.md`, `PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`, `PACKAGE_3_VISUAL_PROOF_RECEIPT.md` | Jules pushed PR head `c02bf58ea3687f65ad57ca78581f46ae7cadad39` and ordinary GitHub checks passed, but Scout review found Package 3 acceptance blockers: Druid `Speak with Animals` is not visibly rendered as the requested locked/pre-selected creator card, and `SpellCard.tsx` still uses explicit `any` formatting helpers. A third marked Jules feedback comment was posted at `https://github.com/Gambitnl/Aralia/pull/954#issuecomment-4519567250`; after a dashboard safe refresh on 2026-05-22, the repaired Symphony state model now shows `Wait for Jules Repair` instead of a duplicate feedback command |
| P4 | not_started | Jules preferred after P3 | Combat simulator deterministic spell pilot | create `PACKAGE_4_*` docs after P3 | Waiting on P2/P3 |
| P5 | not_started | Jules preferred after P4 | AI arbitration pilot for open-ended spells | create `PACKAGE_5_*` docs after deterministic pilot | Waiting on P4 |
| P6 | not_started | Jules preferred after pilots | First mechanics bucket closure for levels 0-3 | create bucket-specific docs from current mechanics-discovery evidence | Waiting on pilot evidence |

## Current Setup And PR Tasks

| ID | Status | Task | Evidence | Next action |
|---|---|---|---|---|
| S1 | done | Land setup/context docs so Jules can read Package 2 context from the expected base branch | PR #933 merged as `40678de8` | Done |
| S2 | done | Repair clean-clone typecheck blocker from tracked markdown-library entry importing ignored DesignPreview local tool | Decision 22 in decision report; PR #933 Build green after `tsconfig.json` exclusion | Done |
| S3 | done | Rerun Symphony task queue/preflight from local `master` after setup context lands | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean preflight: local and remote `master` both `40678de8` |
| S4 | done | Dispatch Package 2 to Jules | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Jules session `15527431301408060204` launched and queued |
| S5 | done | Inspect completed Jules session result through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Visible Jules session showed a plan-approval gate, not a usable completion result; plan was approved through the dashboard-linked Jules page |
| S6 | done | Monitor approved Package 2 Jules run through dashboard-safe workflow | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Dashboard captured PR #935 and current boundary moved to `Bridge Through Scout/Core` |
| S7 | done | Review Package 2 PR #935 before Scout/Core merge path | `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md`, `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`, `PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` | PR #937 repaired the stale Gemini model workflow; PR #935 was updated with current `master`; GitHub CI passed; PR #935 merged as `88c11e434c461823bc4226409059882a0ab9ceb6` |

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
| G9 | done | Visible Jules Package 2 monitoring | The Jules working tree showed helper/scratch files and generated/audit surfaces outside declared write scope while work was in progress; PR #935 file list did not include those helper files, but premade JSON files carried large formatting churn | Helper files were transient at PR-file-list level; formatting churn was accepted because the final file list stayed inside Package 2 scope and GitHub CI plus local package checks passed | PR #935 merged; future packages should still ask Jules for narrower JSON diffs where practical |
| G10 | done | PR #935 CI review | GitHub broad test job failed in `src/hooks/actions/__tests__/handleMovement.test.ts`, expecting winter travel time `2700` but receiving `8100`; focused movement test passed locally on both PR #935 checkout and the foreman checkout | The failing file was outside Package 2's write scope and not touched by PR #935; after rerun/update-branch, GitHub `Tests` passed | Classified as ambient/rerun-cleared, not a Package 2 implementation blocker |
| G11 | active | Dashboard task-page note attempt | The visible task message form could not be filled from Codex because the in-app browser reported that its virtual clipboard is not installed | This is a dashboard/workflow evidence-path limitation, not spell implementation work; using a hidden task-message endpoint would bypass the dashboard-first test | Keep durable notes in this tracker/receipt; add a robust visible note-entry fallback or dashboard-side action later |
| G12 | done | Package 2 task-page Scout/Core bridge | The task page listed a safe `POST /refresh-pr` endpoint as raw text under guarded actions, but did not provide a visible control to run that non-mutating refresh | This was a Symphony dashboard affordance gap exposed by dashboard-first PR review, not Package 2 spell implementation work | Decision 31; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page now has `Run Safe Symphony Refresh` |
| G13 | done | Package 2 Scout/Core scope review | Scout/Core treated Package 2 expected-file globs as literal paths and falsely reported the premade JSON and combat test files as out of scope | This was a Symphony evidence-classification bug; the PR file list itself remained inside the declared write scope | Decision 32; `conductor/symphony/src/task-intake.ts`; `conductor/symphony/scripts/verify-pr-scope-risk.mjs`; live evidence now reports `outOfScopeFiles: []` |
| G14 | done | Package 2 operator-answer path | The visible operator-answer form required typed text, but the in-app browser cannot reliably fill that text box because its virtual clipboard path is unavailable | This is a Symphony dashboard workflow limitation; using the hidden operator-answer endpoint would bypass the dashboard-first test | Decision 33; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-task-detail-page.mjs`; live task page recorded `create_setup_repair_task` through `Record Selected Decision` |
| G15 | done | Package 2 selected repair-lane routing | After `create_setup_repair_task` was recorded, the task page still showed PR refresh/Jules feedback instead of the executable local setup-repair draft lane | This was a Symphony workflow-routing gap; the selected decision was recorded but not surfaced as the next visible dashboard action | Decision 34; `conductor/symphony/src/server.ts`; live task page created `draft-1779410025252-nnowpt` through `Create Local Repair Draft` |
| G16 | done | Main dashboard boundary after PR capture | The global `Current Foreman Boundary` still showed `Jules session` / `Refresh Jules Status` after Package 2 had captured PR #935 and recorded the setup-repair lane | This was a dashboard routing bug; completed Jules session receipts should not mask the PR/check boundary once a PR exists | Decision 35; `conductor/symphony/src/server.ts`; `conductor/symphony/public/dashboard.js`; live dashboard now shows `GitHub PR` and `Needs input: 0` |
| G17 | done | Git disposition through visible dashboard | The required Git disposition controls existed inside Git Safety, but the drawer was collapsed by default while Git sync/disposition was the active blocker | This was a dashboard visibility bug exposed by the dashboard-first rule; calling the disposition endpoint directly would bypass the human workflow being tested | Decision 36; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-sync-decision-board.mjs`; live dashboard now opens Git Safety and recorded `tracked_changes=commit_for_jules_base` plus `remote_commits=integrate_after_local_safe` visibly |
| G18 | done | Current-boundary PR review | The top `Current Foreman Boundary` said `Run GitHub PR` with `Method POST` and `Can run now yes`, but rendered only raw links instead of the existing safe PR-refresh button | This was a dashboard affordance bug; using the raw POST endpoint or hunting for a lower duplicate button would weaken the dashboard-first workflow | Decision 37; `conductor/symphony/public/dashboard.js`; `conductor/symphony/scripts/verify-pr-boundary-after-jules-completion.mjs`; current-boundary PR refresh now renders as `Refresh GitHub PR` |
| G19 | done | Setup-repair draft execution | The generated setup-repair draft expected `package-lock.json`, `package.json`, and `.github/workflows/ci.yml`, but the actual PR #935 review failure was in `.github/workflows/gemini-review.yml` and the repository lacked a current `GEMINI_MODEL` variable | This was a Symphony setup-repair scoping gap plus a GitHub repository configuration gap; the fix updates future repair draft scope and records why the live repair intentionally touched `gemini-review.yml` | Decisions 38, 43; PR #937 merged; repository variable `GEMINI_MODEL=gemini-2.5-flash`; PR #938 review rerun passed |
| G20 | done | PR #935 failed test classification | GitHub full-suite Tests failed `handleMovement - Seasonal Effects > increases travel time in Winter`, expected `2700`, got `8100`; the focused `handleMovement.test.ts` passed locally on synced `master` | This was outside Package 2 write scope and outside the workflow-model repair; rerun after PR #935 branch update passed | Classified as rerun-cleared/ambient for Package 2 |
| G21 | active | Dashboard redesign request | The operator asked to use Stitch for dashboard UX. A restricted Google Cloud Stitch API key exists, but the Stitch API rejected API-key auth with `API keys are not supported by this API`; the working path is OAuth/gcloud with `STITCH_USE_SYSTEM_GCLOUD=1`. `stitch-mcp doctor` and direct CLI project listing work through OAuth, while the already-running `mcp__stitch__` tool still returns `Auth required`, likely requiring a Codex/MCP restart before the live MCP tool picks up the corrected auth path. | This is a tooling/authentication gap for future design iteration, not a reason to mislabel local dashboard edits as Stitch-generated | Decisions 39 and 47; `C:\Users\Gambit\.codex\config.toml`; Stitch still needs a successful authenticated project/screen read through the live MCP tool before design work can be called Stitch-driven |
| G22 | done | Main dashboard first-viewport review | Even after earlier compaction, the dashboard still required too much scanning before the active boundary/action was obvious | This is dashboard workflow UX, adjacent to Package 2 spell implementation but directly required by the dashboard-first goal | Decision 39; `conductor/symphony/public/dashboard.js`; `conductor/symphony/public/dashboard.css`; dashboard contract checks and rendered browser inspection passed locally; PR #937 merged |
| G23 | done | Package 2 closeout to Package 3 setup | Some Package 2 detailed-file statuses stayed active after PR #935, PR #937, and PR #938 merged | This was a tracking/documentation drift issue, not an implementation blocker; stale tracker text can mislead future agents and dashboard task scoping | Package 3 planning update reconciled Package 2 detailed-file statuses and made Package 3 the active slice |
| G24 | active | Package 3 planning/Jules feedback | Current character creator assembly may place the full class spell list in `knownSpells` while selected level 1 spells become `preparedSpells`; Jules also found that the 2024 `getMaxPreparedSpells.ts` utility returns numeric prepared limits for Bard, Sorcerer, Warlock, and Ranger | This may be intentional spell availability modeling, and changing the shared preparation utility would broaden Package 3 into rules/runtime semantics. The player-facing issue is still that the spellbook UI must not look like fixed-known casters have daily Prep/Unprep controls if Package 3 is treating them as known-caster visibility cases. | Decision 54: keep the shared 2024 prep-table utility intact and ask Jules to hide Prep/Unprep controls locally in `SpellbookTab`/`SpellbookOverlay` for Bard, Sorcerer, Warlock, and Ranger, with focused test coverage |
| G25 | active | Package 3 planning | Spellbook and spell creator surfaces need rendered proof, not just source edits | Visual verification belongs in Package 3; Package 2 deliberately did not claim this proof | `PACKAGE_3_VISUAL_PROOF_RECEIPT.md` |
| G26 | active | Package 3 dashboard Git gate | The dashboard Git sync plan suggested pushing/pulling local `master` even though local-only `master` commits are unrelated racial-mechanics work and the active Package 3 docs are on a package branch | This is a Symphony workflow-guidance gap exposed by dashboard-first use; the agent recorded dispositions visibly, chose a non-destructive branch publication path, and landed a regression-tested Symphony fix so a clean worktree branch at `origin/master` can pass the gate without touching local `master` | Decisions 45 and 46; PR #940 merged as `ca35cf61fdc02f19e561ad1e4aff758548155ff6`; next proof is successful visible Package 3 dashboard draft creation from the repaired branch |
| G27 | done | Package 3 dashboard Git gate follow-up | After PR #940, the dashboard correctly compared the current branch to `origin/master`, but reused an older `keep_local` disposition for unrelated local `master` commits and under-described the needed current-branch merge step as a push | This is a Symphony dashboard state-scoping defect; stale operator decisions must not carry across unrelated Git evidence | Decision 48; PR #941 merged as `3647c87d35d42dbe937e971493e12dfd16d69f9a`; the restarted dashboard Git gate reported ready on `codex/spell-phase1-package3-dashboard-flow` |
| G28 | active | Package 3 dashboard draft/handoff launch | The dashboard task navigator showed Package 3, but the actual draft and handoff controls lived inside the collapsed `Task Intake And Records` drawer after each render; the operator had to reopen the drawer after promote/stage/launch before the next per-card button was reachable | This is a Symphony dashboard UX affordance gap, not a Package 3 spell implementation blocker; the current-boundary button did work for later Jules status refreshes | Decision 49; continue with current-boundary controls when available, and consider opening the relevant details group automatically when the selected task boundary belongs there |
| G29 | active | Package 3 Jules completion reconciliation | After dashboard plan approval, Jules reported `COMPLETED` but Symphony captured no PR URL; visible Jules inspection showed the signed-in session still waiting for explicit plan confirmation, so the agent confirmed the bounded plan in visible Jules and dashboard refresh returned the handoff to `IN_PROGRESS`; after PR #945, visible Jules showed actual Package 3 edits and a `Working` pre-commit step; after the next refresh, the dashboard reported `Send Jules Feedback` because Jules needed a known-caster/prep-control decision | This is a Jules/Symphony reconciliation gap and a dashboard visibility gap: the dashboard correctly surfaced a feedback boundary, but it still does not show the actual Jules question, so the operator must inspect the linked Jules session to avoid sending blind feedback. The visible-code evidence is useful, but downloading the zip or recreating the diff locally would bypass the intended Jules PR flow. | Decisions 50-54; Jules session `2823658242418460192`; option B feedback was sent visibly; next proof is dashboard status refresh plus GitHub branch/PR evidence |
| G30 | done | Package 3 no-PR blocker wording | The reusable middleman-path blocker for a completed Jules session without PR hardcoded `before filing Package 2`, even when Package 3 was the active handoff | This was a Symphony wording/workflow defect exposed by Package 3; misleading package-specific text can send the operator to the wrong next task | Decision 51; `conductor/symphony/src/server.ts`; `conductor/symphony/scripts/verify-completed-jules-no-pr-boundary.mjs`; blocker now says `before filing the next handoff` |
| G31 | done | Package 3 completed-no-PR routing | After option B feedback, Jules again reported `COMPLETED` with no captured PR. The dashboard correctly pointed to visible Jules inspection, but the middleman PR lane borrowed old Package 2 PR #935 as if it were the active review boundary for Package 3. | This is a Symphony routing defect exposed by dashboard-first use. Package 3 must not inherit old Package 2 PR, Scout/Core, or local-sync state when the active Jules handoff has no PR. | Decision 55; PR #947 merged on 2026-05-22; live dashboard JSON now keeps the Package 3 handoff as the waiting PR lane source |
| G32 | done | Package 3 Jules publish gap | Visible Jules previously showed in-scope Package 3 code edits and accepted option B feedback, but repeated dashboard refreshes after the visible publish request captured no PR URL and GitHub showed no expected Package 3 branch/PR. Jules later opened PR #954 on suffixed branch `jules/spells-package3-spellbook-creator-visibility-2823658242418460192`. | This was a Jules/Symphony publication gap rather than a reason to silently recreate the implementation locally. The dashboard-first flow waited for a PR, visible export, or durable no-publish response. | Decisions 56, 58, 60, and 61; PR #954 is now the active Package 3 review boundary |
| G33 | done | Package 3 dashboard local-sync gate | The local-sync return path blocked a clean monitor worktree branch because its name was not literally `master`, even though `master` is checked out in the user's main repo and the monitor branch matched `origin/master`. | This was a Symphony worktree-compatibility bug exposed by dashboard-first use; forcing the main repo's `master` branch would interfere with the user's local work. | Decision 57; PR #949 merged and the restarted dashboard on `codex/spell-phase1-package3-monitor-7` no longer showed the branch blocker while Package 3 remained waiting for Jules PR |
| G34 | done | Package 3 task-routing panel | After PR #950 landed, the middleman/current-boundary cards correctly focused Package 3, but the `Task routing and nudge plan` panel picked old Package 2 because Package 2's local-sync receipt had the newest bookkeeping timestamp. | This is a Symphony dashboard focus defect, not a reason to mutate the user's main `master` checkout or import Package 3 locally. A human operator should see the active Package 3 Jules session as the next route while older Package 2 sync history remains historical evidence. | Decision 59; PR #951 merged as `c9c97796cbeda7f1a765c371e7127543f2d1660f` after rerun-cleared Tests, so task routing now ranks live handoffs ahead of post-merge bookkeeping |
| G35 | done | Package 3 Jules zip fallback | The visible Jules session exposed Package 3 code updates and a `Download zip` control while no PR/branch was visible. Clicking `Download zip` through the Codex in-app browser failed because downloads are not supported, and no local zip appeared. Jules later opened PR #954, making the zip fallback unnecessary for the current Package 3 path. | This was a handoff/export blocker exposed by the dashboard-first flow. Scraping visible code panes or using hidden export paths would have bypassed the UI blocker rather than fixing or recording it. | Decision 60; superseded by PR #954 |
| G36 | done | Package 3 PR feedback loop | After PR #954 appeared, GitHub Build/Tests failed on Package 3 TypeScript/test issues and Gemini review flagged matching code defects, but Symphony classified the failed checks as `workflow_config` and kept asking whether to route workflow repair even after the operator recorded `send_jules_feedback` and a marked Jules feedback comment was captured. | This is a dashboard workflow-routing defect. Once `[Jules feedback]` exists, the operator has already chosen the external repair lane; the next visible action should be waiting for Jules to push a repair and refreshing PR state, not repeating the same decision. | Decisions 61 and 62; PR #955 merged as `f3f8abafbd99882e9d103853ab8c837845ea990b`; live task page now shows `Wait for Jules Repair`, no human input required, and no duplicate feedback command |
| G37 | done | Package 3 post-feedback repair loop | After Jules pushed repair commit `0ce77a9c`, the dashboard still treated the existence of any prior `[Jules feedback]` comment as enough reason to keep waiting, even though the PR had changed and GitHub Tests now failed on a new focused Package 3 test failure. | This is a Symphony PR state-model defect exposed by the dashboard-first flow. A prior feedback comment should suppress duplicate comments only until a later PR update arrives; after a repair lands and checks still fail, the dashboard must surface a fresh repair/feedback boundary. | Decisions 63 and 64; PR #957 merged the PR `updatedAt` timing guard. Live task page showed `Repair Failed Checks`, then after selected Jules feedback and PR comment #4519399645, returned to `Wait for Jules Repair` |
| G38 | active | Package 3 post-merge monitor branch sync | After PR #957 and PR #958 were squash-merged, each local monitor branch still contained the pre-squash commit, so the dashboard Git gate reported a local-only commit even though the repair/docs had landed on `origin/master`. | This is a Symphony/worktree hygiene wrinkle exposed by dashboard-first monitoring, not a Package 3 implementation issue. The immediate safe action was to preserve the old branches and move the monitor worktree to a fresh branch from `origin/master`; future dashboard guidance could recognize squash-equivalent local commits more clearly. | Decisions 64 and 65; `codex/spell-phase1-monitor-14` now matches `origin/master`; consider a future dashboard note for post-squash branch replacement |
| G39 | active | Package 3 Scout/Core review | After PR #954 checks passed, the dashboard correctly identified a Scout/Core boundary but exposed only an operator-only wait state and raw evidence link. Scout found concrete review blockers and had to post feedback directly to GitHub. | This is a dashboard workflow UX gap: Scout/Core review needs a visible route for recording findings and sending/attaching review feedback, otherwise the operator must leave the dashboard at exactly the point where the dashboard says Scout is required. | Decision 65; PR comment #4519567250 records the live feedback; Decision 66 adds a visible first-viewport Scout/Core evidence refresh; Decision 67 prevents a duplicate Scout feedback command after the marked feedback is already posted, but does not yet add a full Scout feedback authoring/sending workflow |
| G40 | done | Package 3 Scout/Core dashboard use | The top Scout/Core boundary could not run the safe PR evidence refresh; the real `Refresh PR Checks` button was buried in the full handoff card and the task navigator still said `Wait for PR Checks` even while the middleman path said `Scout/Core review`. | This was a dashboard workflow defect exposed by using the dashboard like a human operator. It did not justify bypassing the UI or repairing Package 3 locally. | Decision 66; `conductor/symphony/src/server.ts`; `conductor/symphony/public/dashboard.js`; live dashboard now shows `Refresh Scout/Core Evidence`, a first-viewport `Refresh GitHub PR` button, and the task navigator labels Package 3 as `Scout/Core review` |
| G41 | done | Package 3 posted Scout feedback refresh | After the third `[Jules feedback]` comment was posted, refreshing PR #954 moved the dashboard back to `Scout Bridge Risk` and showed a duplicate `Prepare Jules PR feedback comment` action even though no new Jules repair commit had arrived. | This was a Symphony state-model defect exposed by dashboard-first use. The right operator state is waiting for Jules to repair after already-posted Scout feedback, not re-posting the same feedback or repairing Package 3 locally. | Decision 67; `conductor/symphony/src/task-intake.ts`; `conductor/symphony/scripts/verify-pr-next-action.mjs`; live task page now shows `Wait for Jules Repair` with no duplicate feedback command after safe refresh |

## Detailed Task File Index

| File | Purpose | Status |
|---|---|---|
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md` | Package 2 scope and acceptance criteria | done; historical scope packet |
| `PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md` | Exact Jules prompt for Package 2 | done; dispatched through Symphony/Jules |
| `PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md` | Handoff guard for Package 2 | done; handoff and PR lifecycle completed |
| `PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` | Package 2 Atlas/gate proof target | done for Package 2 |
| `PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` | Package 2 Codex review/failure classification target | superseded by merge closeout; older blocker details retained |
| `PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` | Package 2 task-scoped communication target | done for Package 2 |
| `PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md` | Package 2 PR/deployment/local-sync target | done for Package 2 |
| `SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md` | Retain/archive/delete policy for package artifacts | active |
| `PACKAGE_2_SYMPHONY_HANDOFF_RECEIPT.md` | Clean-base Package 2 draft, Linear issue, handoff, manifest, Jules launch, PR #935, and scoped verification receipt | done for Package 2 |
| `PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_TASK.md` | Package 3 scope and acceptance criteria | dispatched to Jules; waiting for PR |
| `PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_PROMPT.md` | Exact Jules prompt for Package 3 | dispatched to Jules; waiting for PR |
| `PACKAGE_3_DISPATCH_READINESS_CHECKLIST.md` | Handoff guard for Package 3 | active; launched to Jules and waiting for PR |
| `PACKAGE_3_SYMPHONY_HANDOFF_RECEIPT.md` | Package 3 dashboard draft, Linear issue, handoff, manifest, Jules launch, and queued status receipt | active; waiting for Jules PR |
| `PACKAGE_3_SYMPHONY_TASK_DRAFT_PAYLOAD.json` | Dashboard draft payload for Package 3 | used for dashboard draft `draft-1779442977969-w2vsy4` |
| `PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md` | Package 3 Atlas/gate proof target | pending implementation |
| `PACKAGE_3_VISUAL_PROOF_RECEIPT.md` | Package 3 rendered/test visual proof target | pending implementation |

## Update Rules

- Update this tracker before starting a new package.
- Update it after every package-level PR, merge, local sync, Jules dispatch,
  Jules result, foreman review, Atlas/gate checkpoint, or artifact filing
  decision.
- If a detailed package file contradicts this tracker, treat that as a tracking
  bug: reconcile the two instead of assuming either one is silently correct.
- Adjacent gaps should stay visible here until they are either promoted,
  rejected, accepted as future work, or linked to a more specific tracker.
