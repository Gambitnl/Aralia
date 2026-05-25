# Spell Phase 1 Decision Trends Index

Purpose: summarize recurring patterns from
`SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` so future foremen can understand
the workflow without reading the full audit ledger first.

This file is an index, not the authority for individual decisions. Use the
decision report for exact timestamps, options, and proof. Use this file to spot
repeated decision types, active operating rules, and package-sizing lessons.

## Table Of Contents

- [1. Current Trend Summary](#1-current-trend-summary)
- [2. Recurring Decision Types](#2-recurring-decision-types)
- [3. Implementation Value Lessons](#3-implementation-value-lessons)
- [4. Active Operating Rules](#4-active-operating-rules)
- [5. Open Trend-Level Gaps](#5-open-trend-level-gaps)

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
| Branch hygiene | 77-78, 97-112, 120-122 | Jules produces useful work on a stale or noisy branch. | Prefer bounded Jules repair first; use foreman branch-hygiene repair only when product work is verified and the repair only preserves current base and removes noise. |
| Package selection | 2-4, 44, 81, 87, 113 | The next slice is chosen from tracker and mechanics evidence. | Select from the living tracker and execution plan; do not encode temporary package state into the goal. |
| Package value | 113-115 | A package may be safe but too small for the orchestration cost. | Prefer larger coherent batches when rows are repetitive, testable, and covered by existing schema/test patterns. |

## 3. Implementation Value Lessons

Small Jules tasks are useful when they prove a new workflow boundary or risky
mechanic pattern. They are inefficient once the pattern is established. Packages
8 through 12 show that each slice pays similar overhead regardless of whether it
changes three spell rows or a broader coherent bucket.

Use this package-sizing bias:

| Candidate work | Preferred owner | Sizing rule |
|---|---|---|
| Repetitive spell JSON/schema rows with existing test patterns | Jules | Batch the largest coherent safe subset. |
| Dashboard controls, task routing, local workflow labels | Codex | Keep local and focused; record only durable summaries. |
| Scope ambiguity, branch hygiene, merge readiness | Codex foreman | Decide from visible Jules/GitHub/dashboard evidence. |
| Tiny docs repairs after a package state change | Codex | Do locally; do not pay a Jules handoff cycle. |
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

## 4. Active Operating Rules

- Use the visible Symphony/Jules/GitHub path as the operator surface.
- Treat launched Jules sessions as isolated clones; later local or GitHub
  tracker changes do not reach them automatically.
- Use explicit update channels after launch: visible Jules message, bounded PR
  feedback, PR-branch repair/rebase, or replacement handoff.
- Do not approve plans that name files outside expected scope unless the plan
  explains why the file is necessary and bounded.
- Do not keep full decision entries for every repeated wait if a compact
  wait-state table or tracker row can preserve the same operator truth.
- The next Jules task packet/prompt should make that compact logging rule
  explicit before launch so the old Package 12 pattern does not repeat inside a
  fresh isolated Jules clone.
- Preserve Aralia-facing context in GitHub; keep raw Symphony/Jules runtime
  state, generated manifests, draft ids, click receipts, and local run logs
  external or ignored unless a concise excerpt explains a real package decision.

## 5. Open Trend-Level Gaps

| Gap | Current evidence | Desired repair |
|---|---|---|
| Decision report is too large to navigate | The assumed-approval report is over 4,000 lines and mixes audit entries with trend discovery. | Keep this trends index current when a repeated pattern appears or closes. |
| Packet shortcuts are hardcoded | Package 11 and Package 12 both needed dashboard source edits before visible draft creation. | Replace hardcoded packet buttons with a small registry or metadata-derived list. |
| Wait states are verbose | Multiple decisions record similar "Jules acknowledged, no new head yet" states. | Use compact wait-state rows for repeated refreshes, reserving full decisions for real forks; include that rule in the next Jules packet/prompt before launch. |
| Package value check is implicit | Package 12 exposed a too-small plan at the approval gate. | Add a minimum-value/candidate-classification section to future Jules packet templates. |
| Verify-without-handoff state is underspecified | Package 12 reached visible `Verify`, but repeated GitHub and remote-branch checks still showed no PR or Jules branch. | Add an operator rule: after repeated unchanged `Verify` state, send one bounded visible Jules status nudge; if still unchanged, record a stale-session or replacement-handoff decision instead of waiting silently. |
| Active work after nudge needs a named state | Package 12 showed post-nudge test/doc updates and `Jules is working`, but still no PR/branch. | Treat this as monitored wait with an explicit next proof target, not as a blocker and not as permission for local takeover. |
| PR appears after wait but is stale/noisy | Package 12 PR #1084 appeared after the monitored wait, but was `DIRTY` and rewound tracker closeout state. | Use bounded Jules PR feedback first when product work is useful but branch hygiene/tracker truth/API scope need repair. |
| Repair feedback can be damaged by shell quoting | The first Package 12 PR #1084 repair comment contained malformed escaped text in a few command/file references. | If feedback text is damaged, post one clean explicit `@jules` restatement rather than relying on inference. |
| Useful Jules work can outlive repeated branch noise | Package 11 and Package 12 both reached useful product/test slices while still carrying stale docs, helper artifacts, or current-master drift. | After at least one clear Jules repair request, bounded foreman branch-hygiene repair is valid when it starts from current `origin/master`, preserves only accepted product/test files, and reruns focused proof before merge. |
| Mutation labels understate boundaries | Task pages have shown Linear creation and manifest staging as non-mutating. | Correct task-page safety labels so operators can trust the visible boundary summary. |
