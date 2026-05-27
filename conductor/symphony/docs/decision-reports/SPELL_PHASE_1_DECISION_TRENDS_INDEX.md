# Spell Phase 1 Decision Trends Index

Purpose: summarize recurring patterns from the archived full decision ledger so
future foremen can understand the workflow without reading the full audit
history first.

This file is an index, not the authority for individual historical decisions.
Use `archive/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS_FULL_LEDGER_2026-05-25.md`
for exact timestamps, options, and proof. Use
`SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` to see whether each extracted
lesson is implemented, still an active gap, being monitored, or retired.

## Table Of Contents

- [1. Current Trend Summary](#1-current-trend-summary)
- [2. Recurring Decision Types](#2-recurring-decision-types)
- [3. Implementation Value Lessons](#3-implementation-value-lessons)
- [4. Active Operating Rules](#4-active-operating-rules)
- [5. Open Trend-Level Gaps](#5-open-trend-level-gaps)

## Related Files

| File | Role |
|---|---|
| `SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` | Short entry point and logging policy. |
| `SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` | Extracted lessons with resolution state and owning live surface. |
| `archive/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS_FULL_LEDGER_2026-05-25.md` | Full chronological audit archive. |

## 1. Current Trend Summary

Most decisions in the large ledger are about workflow boundaries, not spell
mechanics. The repeated pattern is:

1. Codex scopes a narrow package and prepares durable Jules-readable context.
2. Symphony exposes or fails to expose the needed visible dashboard path.
3. Jules plans or implements from an isolated launch base.
4. Codex reviews scope, file hygiene, verification, PR state, and tracker truth.
5. A repair loop starts if Jules output is useful but stale, conflicting, or
   wider than the package boundary.

The useful product work is real, but the orchestration cost is high. Future
packages should be large enough to justify draft, Linear, handoff, Jules launch,
plan approval, PR review, repair, merge, and tracker closeout.

## 2. Recurring Decision Types

| Type | Representative decisions | Pattern | Reuse guidance |
|---|---:|---|---|
| Environment gate | 0-1, 5-8, 12, 17 | Separate tool/environment blockers from project approval. | Record exact external proof needed before dispatch; do not let setup uncertainty masquerade as product scope. |
| Evidence receipt | 5-16, 23, 80 | Create a durable receipt target before relying on memory. | Keep receipts concise and Aralia-facing; do not promote raw dashboard caches or generated manifests. |
| Dashboard affordance | 26-37, 84-85, 89-90, 114 | A visible operator action is missing, stale, or misleading. | Repair the visible path or record the blocker; avoid hidden endpoint shortcuts during the proving-ground. |
| Scope classification | 31-32, 38, 54, 86, 108, 115 | A plan or PR names files or behavior outside the declared slice. | Withhold approval or request bounded repair unless the extra file is justified and still package-local. |
| Jules wait state | 52, 58-60, 93-96, 98-103, 109-111 | Jules is queued, working, processing feedback, or has not pushed a claimed repair. | State what is being waited for: new PR, new head commit, plan revision, visible failure, or explicit blocker. |
| Branch hygiene | 77-78, 97-112, 120-122, 126 | Jules produces useful work on a stale or noisy branch. | Prefer bounded Jules repair first; use foreman branch-hygiene repair only when product work is verified and the repair only preserves current base and removes noise. |
| Package selection | 2-4, 44, 81, 87, 113 | The next slice is chosen from tracker and mechanics evidence. | Select from the living tracker and execution plan; do not encode temporary package state into the goal. |
| Package value | 113-115, Package 15 closeout | A package may be safe but too small for the orchestration cost, or large enough in theory but too prone to review/repair churn if the handoff is not precise. | Prefer larger coherent batches when rows are repetitive, testable, and covered by existing schema/test patterns; keep tiny docs/count/PR-body/branch-hygiene work local. |

## 3. Implementation Value Lessons

Small Jules tasks are useful when they prove a new workflow boundary or risky
mechanic pattern. They are inefficient once the pattern is established. Packages
8 through 12 show that each slice pays similar overhead regardless of whether it
changes three spell rows or a broader coherent bucket.

Use this package-sizing bias. The practical boundary has now moved upward:
Jules should normally get a coherent multi-row package, not a tiny correction
that Codex can finish and verify faster than the handoff loop can complete.

| Candidate work | Preferred owner | Sizing rule |
|---|---|---|
| Repetitive spell JSON/schema rows with existing test patterns | Jules | Batch the largest coherent safe subset; normally at least five related rows unless finishing a bucket is explicitly worth the overhead. |
| Dashboard controls, task routing, local workflow labels | Codex | Keep local and focused; record only durable summaries. |
| Scope ambiguity, branch hygiene, merge readiness | Codex foreman | Decide from visible Jules/GitHub/dashboard evidence. |
| Tiny docs repairs after a package state change | Codex | Do locally; do not pay a Jules handoff cycle. |
| Stale count fixes, PR-body edits, raw-artifact cleanup, tracker closeout | Codex | These are closeout or hygiene chores, not cloud implementation packages. |
| Broad mechanics with unclear engine shape | Codex scoping first, Jules later | Write a better packet before implementation. |

Package 12 is the latest completed example. Jules' first plan proposed a small
`hex`/`hunters-mark`/`knock` slice and named `UtilityCommand.ts` outside the
expected write scope. Codex withheld approval and asked for a higher-value safe
conditional-ending batch with explicit file-scope justification. Jules revised
the plan to cover `hex`, `hunters-mark`, `knock`, `detect-thoughts`, and
`flame-arrows`, removed the direct `UtilityCommand.ts` edit, and Codex approved
the revised plan. When Jules still asked whether the revised plan met
expectations, Codex used an explicit visible Jules message as the post-launch
update channel and Jules moved to working state. After Jules later stayed on
`Verify` across repeated visible monitoring passes with no PR or remote branch,
Codex sent one bounded visible status nudge asking Jules to open the PR if
verification passed or report the exact failing command and smallest repair if
blocked. That is the preferred wait-state escalation before any stale-session
or replacement-handoff decision. The next visual check showed fresh post-nudge
Jules activity, so Codex recorded an explicit monitored-wait state instead of
treating the goal as blocked or taking over locally. Jules then opened PR
#1084, which confirmed the wait was useful, but the first PR review still
required bounded repair because the branch was dirty against current `master`,
rewound tracker truth, marked P12 closed before acceptance, and widened a
private factory helper to public without a clear production need. When the
first repair comment showed shell-escaped text damage, Codex posted a clean
explicit `@jules` restatement instead of assuming Jules would infer the damaged
parts or taking over locally. Jules then pushed a partial repair, but the PR
still carried stale docs/process noise and `fix_conflict.sh`. Codex performed a
bounded foreman branch-hygiene repair from current `origin/master`, preserving
only the accepted product/test files, keeping `createCommand` private, typing
`CommandContext.conditionalEndings` as `ConditionalEnding[]`, and force-pushing
the clean head with lease to PR #1084. The PR merged after local verification
and green GitHub checks. The pattern is: wait and repair through Jules first;
when a useful implementation remains trapped in branch-noise churn, a tightly
scoped foreman branch-hygiene repair is higher-value than another tiny
orchestration loop.

Package 13 repeated the same lesson with a cleaner acceptance boundary. Jules
produced useful terrain/surface product work, but after PR submission it also
pushed a `.github/workflows/gemini-review.yml` model change to work around
review quota, and the branch still carried stale tracker/process-doc risk
relative to current `origin/master`. Codex kept the implementation value by
creating a clean current-master acceptance branch, preserving only the Package
13 product/test/bucket/completion-note files, correcting the Plant Growth
residual-gap record, and force-pushing that clean head with lease before merge.

Package 14 shows that helper-artifact drift can appear before the PR, not only
during final review. Jules first created `classify.js` / `classify.cjs`, then
deleted them after a visible scope correction, but later showed
`patch_types.js`, `patch_types.cjs`, `patch_json.cjs`, and
`patch_markdown.cjs`, and then `patch_alarm.js` while doing useful
type/data/test/doc work. The useful pattern is to send bounded visible cleanup
corrections before PR submission, then review the final PR file list for durable
package artifacts only. A tracked generated-looking source mirror such as
`src/types/spells.d.ts` is different from a helper script: it may be acceptable
only when the PR explains the repo convention and verifies the paired
source/type change. PR #1110 confirmed the helper-cleaning loop can work: the
final file list contained only durable Package 14 files. The next repair fork
was not helper drift but a stale bucket-summary count, so the right response was
bounded PR feedback and `wait_for_jules_repair_commit`, not local takeover.
When the PR head stayed unchanged after Jules reacted, the visible Jules
session showed `.github/workflows/gemini-review.yml`; because GitHub did not
show that file in the PR diff, the correct classification was "session-drift
warning plus bounded nudge," not "submitted workflow drift." If a later head
does add workflow files, treat that as branch noise and repair or reject it
outside the spell product acceptance path. Jules then did add that workflow
change without fixing the requested count issue, so Codex used a clean
current-master acceptance branch, preserved only the useful Package 14
product/test/bucket files, corrected the bucket counts, force-pushed with
lease, and merged after focused local and GitHub verification.

## 4. Active Operating Rules

- Use the visible Symphony/Jules/GitHub path as the operator surface.
- Treat launched Jules sessions as isolated clones; later local or GitHub
  tracker changes do not reach them automatically.
- Use explicit update channels after launch: visible Jules message, bounded PR
  feedback, PR-branch repair/rebase, or replacement handoff.
- Apply an implementation-value floor before launching Jules. One-file doc
  fixes, stale count/header repairs, raw-artifact cleanup, PR-body adjustments,
  and narrow branch-hygiene acceptance repairs should normally stay with local
  Codex unless the point is to prove the orchestration boundary itself.
- Do not approve plans that name files outside expected scope unless the plan
  explains why the file is necessary and bounded.
- Do not keep full decision entries for every repeated wait if a compact
  wait-state table or tracker row can preserve the same operator truth.
- Package 15's Jules task packet/prompt carries the compact logging rule
  forward so the old Package 12 and Package 13 patterns do not repeat inside a
  fresh isolated Jules clone.
- Future Jules task packets should copy that same rule before launch. If a
  future run still produces full decision entries for ordinary queued/working
  refreshes, classify that as a template/spec enforcement gap.
  The desired behavior is not "never record waits"; it is "record repeated
  waits as compact wait states unless a real fork appears."
- Treat helper-script drift during active Jules work as a real scope-correction
  fork, not a passive wait. Send one visible cleanup request before PR
  submission when `classify*`, `patch_*`, `.orig`, generated caches, or
  orchestration artifacts appear in the active file list.
- Treat plan-revision messages as a plan-gate fork. After the operator sends
  Jules a bounded revision request, the next dashboard action should be status
  refresh / wait for a revised plan, not stale approval of the plan that was
  just challenged.
- A visible Jules state change is not automatically a decision. Package 14's
  first recheck moved from launch/loading evidence to repository setup and
  reading `alarm.json`; because no plan gate, PR, blocker, or Jules question was
  visible, the correct record is a compact wait state with the next proof
  target, not a new full ledger entry.
- Preserve Aralia-facing context in GitHub; keep raw Symphony/Jules runtime
  state, generated manifests, draft ids, click receipts, and local run logs
  external or ignored unless a concise excerpt explains a real package decision.

## 5. Open Trend-Level Gaps

| Gap | Current evidence | Desired repair |
|---|---|---|
| Decision report was too large to navigate | The assumed-approval report grew past 4,000 lines and mixed audit entries with trend discovery. | Resolved by modularization: the old full ledger now lives under `archive/`, the original path is a short entry point, this trend index is the operator summary, and `SPELL_PHASE_1_DECISION_LESSONS_RESOLUTION.md` tracks extracted lessons and remaining gaps. Keep these smaller surfaces current instead of reviving the full ledger as the active log. |
| Packet shortcuts are hardcoded | Package 11, Package 12, and Package 13 all exposed that the visible draft path lags behind new committed package packets. PR #1090 moved Package 13 shortcut rendering/click handling to a small packet registry. | Next target is metadata-derived discovery from committed packet files so a new package packet does not require another dashboard source edit. |
| Fresh draft can lose queue focus to stale handoff history | Package 15 proved the visible draft shortcut by creating `draft-1779771507621-vox90j`, and a visible refresh reconciled Package 14 to merged/local-current. The queue still surfaced an older unlaunched stale Package 11 handoff as the top action before the new draft's Linear boundary. After PR #1115 and Linear `ARA-24`, an older Package 10 completed/no-PR post-launch update record repeated the same focus problem before Package 15 handoff prep. A later live check showed closed Package 9 PR #1030 feedback and Package 14 completed middleman-path receipts could still hide Package 15 `Prepare Handoff`; PR #1117 repaired that path and visual proof then reached Package 15 Jules launch. | Completed/local-current handoffs, old unlaunched stale handoffs, completed/no-PR handoffs already superseded by replacement package paths, and closed-PR feedback history may stay visible as history, but the global next action should prefer the newest ready draft when no live Jules/PR boundary needs operator action. A draft linked to Linear needs its own `Prepare Handoff` stage before old manifest/session/PR/local-sync receipts can count for the current path. |
| Merged handoff can remain the active dashboard boundary | After Package 13 and Package 14 prep merged, visual dashboard use still kept the old Package 13 handoff on the active Scout/Core review boundary because historical conflict-prone file evidence outlived the merged PR and local-current proof. | Merged PRs should complete the Scout/Core lane, local-current proof should complete the local-sync lane, and the dashboard should surface the next package draft path instead of stale review. |
| Visible controls can still be unstable | Package 14 launch showed that even after a next-package button exists and the correct drawer is open, automatic dashboard repainting can detach the button while the operator or browser automation is trying to click it. | Keep next-action intake controls visible and stable during interaction. PR #1101 tags the open Task Intake drawer and pauses automatic repainting while it is open; future controls should follow the same stability rule. |
| Wait states are verbose | Multiple decisions record similar "Jules acknowledged, no new head yet" states. Package 13 now includes the compact wait-state rule in its task packet/prompt before launch. | Use compact wait-state rows for repeated refreshes, reserving full decisions for real forks; if Jules ignores this, repair the task template/spec instead of expanding the decision ledger. |
| State changes can be mistaken for decisions | Package 14 visually advanced to repository setup and reading `alarm.json`, but still showed no plan approval, PR, blocker, or question. | Treat ordinary progress states as compact evidence unless the foreman has to choose between materially different next actions. |
| Jules package floor is too low | Packages 13-15 produced useful code, but several repair loops were for stale counts, helper/runtime artifacts, PR hygiene, or wording that local Codex could fix faster than a full Jules cycle. | Raise the minimum Jules task size: send coherent multi-row mechanics/schema/test batches to Jules; keep one-file docs, count fixes, raw-artifact removal, and clean-acceptance branch hygiene local unless the operator explicitly wants a workflow proof. |
| Larger packages still need explicit classification gates | Package 14's first plan named plausible vision/light/sound work but did not explicitly classify every named early-game row before selecting the subset, and it risked closing fog/darkness rows too broadly. | Require revised plans to separate full row classification, `implement_now` selection, and residual/deferred rows before approval. |
| Plan-revision feedback can leave stale approval as the visible next action | Package 15's first plan approval gate put classification after implementation. Codex sent a bounded Jules revision note, but Symphony still labeled the handoff as `Approve Jules Plan` afterward. | Repair next-action routing so a sent operator message during `AWAITING_PLAN_APPROVAL` routes to `Refresh Jules Status` until Jules handles the revision request. |
| Local Jules state can claim completion before visible proof exists | Package 15 reported `COMPLETED` in Symphony/local Jules records after revised-plan approval, but the visible Jules page still showed `Plan approved`, a `Pause session` control, no completion report, and no PR link. GitHub open-PR search initially found no Package 15 PR. A later visible Jules check showed all plan steps completed and GitHub found PR #1122. | Treat `COMPLETED` plus no PR/completion text as `needs_browser_reconciliation`, not package closeout. The valid next action is visible Jules/GitHub recheck or a workflow repair that reconciles stale local records against visible session evidence before no-PR filing. If a PR appears later, move to foreman PR review and keep the stale local completion as a workflow gap, not a package failure. |
| Helper artifacts recur during useful Jules work | Package 13 showed patch/orig helpers at PR review. Package 14 showed `classify*` helpers, then later `patch_*` helpers, during active implementation before PR submission. | Include explicit "no helper artifacts in final PR" language in package prompts, send visible cleanup corrections as soon as helper drift appears, and reject final PRs that still contain scratch scripts or caches. |
| PR review can expose small acceptance repairs after helper cleanup succeeds | Package 14 PR #1110 removed helper artifacts and passed core checks, but `vision_light_sound.md` kept pre-PR header counts after row status changes. | Send bounded PR feedback for the exact acceptance repair, record `wait_for_jules_repair_commit`, and verify the new head before accepting. Do not convert every repair wait into a full local takeover. |
| Unchanged repair feedback needs one explicit nudge before takeover | Package 15 PR #1122 received bounded repair feedback for raw `.jules` noise, stale bucket counts, and overbroad summon stat-block claims, but GitHub and visual Jules checks still showed the original head and `Ready for review` state. Jules reacted with eyes, later replied, and pushed a repair head, but the repair still missed bucket counts and summon-data acceptance details. | Post one explicit `@jules` nudge that restates the same narrow repair and asks for either a repair head or exact blocker. If Jules pushes a new head, compare it to the requested repair before accepting. If the repair is still a small acceptance/hygiene miss, use bounded branch hygiene instead of another tiny orchestration loop. |
| Visible Jules session may drift into out-of-scope files not yet in the PR | After Package 14 PR #1110 repair feedback, the visible Jules page showed `.github/workflows/gemini-review.yml`, while GitHub initially showed the PR diff was helper-clean and had no workflow file. Jules later pushed that workflow file without the requested count repair. | Classify visible-only drift as a warning until GitHub proves a submitted diff change. If a new head adds the out-of-scope file, treat it as branch noise and use bounded branch hygiene when the product work is otherwise verified. |
| Package value check is implicit | Package 12 exposed a too-small plan at the approval gate. | Add a minimum-value/candidate-classification section to future Jules packet templates. |
| Verify-without-handoff state is underspecified | Package 12 reached visible `Verify`, but repeated GitHub and remote-branch checks still showed no PR or Jules branch. | Add an operator rule: after repeated unchanged `Verify` state, send one bounded visible Jules status nudge; if still unchanged, record a stale-session or replacement-handoff decision instead of waiting silently. |
| Active work after nudge needs a named state | Package 12 showed post-nudge test/doc updates and `Jules is working`, but still no PR/branch. | Treat this as monitored wait with an explicit next proof target, not as a blocker and not as permission for local takeover. |
| PR appears after wait but is stale/noisy | Package 12 PR #1084 appeared after the monitored wait, but was `DIRTY` and rewound tracker closeout state. | Use bounded Jules PR feedback first when product work is useful but branch hygiene/tracker truth/API scope need repair. |
| Repair feedback can be damaged by shell quoting | The first Package 12 PR #1084 repair comment contained malformed escaped text in a few command/file references. | If feedback text is damaged, post one clean explicit `@jules` restatement rather than relying on inference. |
| Useful Jules work can outlive repeated branch noise | Package 11, Package 12, and Package 13 reached useful product/test slices while still carrying stale docs, helper artifacts, workflow edits, or current-master drift. | After at least one clear Jules repair request, bounded foreman branch-hygiene repair is valid when it starts from current `origin/master`, preserves only accepted product/test files, and reruns focused proof before merge. |
| Jules may attempt workflow quota bypasses inside product PRs | Package 13 PR #1096 briefly gained `.github/workflows/gemini-review.yml` after review quota noise, even though workflow edits were out of scope. | Treat workflow-quota edits as branch noise unless the task explicitly owns CI. Preserve product work on a clean branch and leave CI/model routing changes to a separate workflow task. |
| Future packages must carry the compact logging rule before launch | Package 14 carried compact decision/wait-state instructions and still produced useful evidence about helper drift, PR repair waits, and branch-hygiene closeout. Package 15 prep repeated the rule and added that routine implementation choices and verification output belong in the completion report, not the assumed-approval ledger. | Copy the compact logging rule into future package task and prompt files before dispatch instead of relying on Jules to infer updated flow docs after launch. If a future run still expands ordinary waits or routine implementation steps into full decisions, repair the packet template/spec. |
| Mutation labels understate boundaries | Task pages have shown Linear creation and manifest staging as non-mutating. | Correct task-page safety labels so operators can trust the visible boundary summary. |
