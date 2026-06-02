# Dashboard At-A-Glance Status Model

Status: Not started

## Purpose

Build the first implementation slice from
`conductor/symphony/docs/SYMPHONY_DASHBOARD_UX_BRIEF.md`: a stable,
human-readable task status model for the Symphony overview and task detail
header.

The live Spell Phase Package 18 pilot is the concrete proof case. Symphony
should be able to show the user that Package 18 is:

`Jules working; bucket file changed; no PR yet; next proof is PR or blocker.`

That summary should come from stored/fetched Jules, GitHub, Linear, and local
handoff facts, not from a Codex agent manually typing a status note into the
dashboard during the task.

## User Outcome

The user should not need to open Jules to understand the current task state.

The all-task overview should show one compact card per task with:

1. title and package id;
2. current boundary;
3. owner system;
4. next safe action;
5. last observed proof;
6. needs-user flag;
7. status badges for changed file, PR, checks, blocked state, or waiting state.

The task detail page should start with the same summary before any transcript,
raw receipts, logs, or drill-down panels.

## Current Pilot Evidence

Observed on 2026-06-01 in Jules session `5273090409493546069`:

1. Package 18 moved from `Approve plan?` to `Plan approved`.
2. Jules then showed `Working`.
3. Jules auto-connected Stitch, Context7, Linear, and Render MCPs.
4. Jules updated
   `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`.
5. No PR URL was visible yet.
6. The next expected proof is either a PR URL, a Jules blocker, or another
   visible state transition.
7. A later visible Jules check showed the package on the final reporting step:
   counterspell had been changed to `defer_broader_system`, the same bucket file
   remained the only visible modified file, and no PR URL or blocker was visible
   yet.
8. Jules then reported the work complete and said the branch had been generated
   and pushed. Read-only GitHub inspection showed no open PR, and the matching
   remote branch `codex/spells-package18-reaction-opportunity-continuation`
   compared as `ahead_by: 0` with no changed files against `master`. This is a
   distinct boundary: Jules-reported completion without GitHub PR/change proof.
9. After a bounded publish-proof repair request in Jules, GitHub showed PR
   #1143: `Package 18: Reaction Opportunity Safe Replacement`. The PR changed
   only `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
   with +1/-1 lines, had a Gemini review comment with no feedback, and still had
   CI/CodeQL checks in progress. This moved the boundary from `publish proof
   missing` to `github_pr`.
10. A later PR refresh showed the scope still correct (+1/-1 in one bucket file),
    but GitHub had moved to CI triage: Build failed, Tests were still in
    progress, and a CodeQL rollup was queued. Attempting to read the failed Build
    log returned `run ... is still in progress; logs will be available when it is
    complete`. Symphony should classify this as `github_checks`, not as a package
    review decision yet.
11. The workflow run summary showed the Build job failed specifically at the
    `Type check` step, while the `Tests` job remained in progress. GitHub still
    refused the completed Build job log because the overall run had not finished.
    This is a useful dashboard distinction: the failed check type is known, but
    the actionable log is not available yet.
12. Once the workflow completed, Tests, Lint, Quality Scan, CodeQL, and Poison
    File Check were not the blocking issue. The Build log showed broad existing
    TypeScript debt across combat, crafting, world3d, character utilities, and
    shared types, including `savePenaltyRiders`, async command return handling,
    chunk mesh bundle typing, duplicate `savingThrowProficiencies`, and missing
    racial type names. None of those files were changed by Package 18, whose PR
    still changed only one markdown bucket row. Symphony should classify this as
    `unrelated_typecheck_debt` rather than a Jules package repair.
13. PR #1143 was then merged through the normal GitHub squash-merge path on
    2026-06-01 at 13:38:41Z as merge commit
    `4f9b1ffbcec048630905d2cb809c942fdf280356`. This moved the dashboard
    boundary from `github_checks` to `merged_remote`, with local sync and
    package-history closeout still needing their own proof.

The dashboard should classify that as:

| Field | Value |
|---|---|
| Boundary | `merged_remote` |
| Owner | `GitHub/local sync` |
| User needed | `false` |
| Summary | `Package 18 PR #1143 merged remotely with the expected bucket-only change. Required package checks passed; broad Build type-check debt remains unrelated.` |
| Next safe action | `Record merge proof, complete local sync/package-history closeout, and track unrelated typecheck debt separately.` |
| Source | `Jules visible/session fetch plus read-only GitHub PR view` |

## Required Model Shape

Add a derived status summary object for drafts/handoffs. The exact code location
can reuse the existing task-intake snapshot and dashboard rendering flow, but
the user-facing shape should include:

```ts
type TaskAtAGlanceStatus = {
  boundary:
    | 'draft'
    | 'git_sync'
    | 'linear_issue'
    | 'jules_manifest'
    | 'jules_plan'
    | 'jules_execution'
    | 'github_pr'
    | 'github_checks'
    | 'review'
    | 'deployment'
    | 'local_sync'
    | 'blocked'
    | 'done';
  owner: 'user' | 'codex' | 'symphony' | 'linear' | 'jules' | 'github' | 'deployment' | 'local';
  severity: 'calm' | 'waiting' | 'needs_input' | 'blocked' | 'ready' | 'done';
  headline: string;
  detail: string;
  nextSafeAction: string;
  needsUser: boolean;
  lastProofAt: string | null;
  sourceLabel: string;
  badges: Array<{ label: string; tone: 'neutral' | 'info' | 'warning' | 'danger' | 'success' }>;
};
```

This is a target shape, not a mandate to add a new standalone store. Prefer a
derived field on the existing task/handoff API response so the dashboard does
not duplicate workflow truth.

## Rendering Requirements

1. Render the summary in the all-task overview.
2. Render the same summary at the top of the task detail page.
3. Keep raw Jules/GitHub/Linear details behind drill-down panels.
4. Preserve expanded panels, filter state, scroll position, and form drafts
   during refresh.
5. Update only the component whose data changed.
6. Label whether the status came from an automated fetch, local receipt, or
   Codex note.

## Non-Goals

1. Do not build a second task database.
2. Do not require Stitch, Context7, Render, or Linear for every task.
3. Do not make manual Codex notes the normal status source.
4. Do not refresh the whole page for routine task status updates.
5. Do not change Package 18 scope or Jules write permissions.

## Stitch Design Aid

Stitch may be used for visual exploration of the overview card and task detail
header. Any Stitch output must be constrained to this status shape and the
existing Symphony data model. Treat Stitch as a mockup aid, not an authority on
workflow state.

## Acceptance Criteria

1. A handoff with `julesState` indicating plan-approved execution and no PR URL
   renders as waiting on Jules, not as needing user approval.
2. A handoff with a visible PR URL renders as waiting on GitHub PR/check
   refresh.
3. A handoff with `AWAITING_PLAN_APPROVAL` or `AWAITING_USER_FEEDBACK` renders
   as needing user input.
4. A blocked Git sync or forbidden-file condition renders as blocked.
5. The dashboard can refresh the status summary without replacing unrelated
   task panels or resetting page scroll.
6. Package 18 can be represented as `Jules working; bucket file changed; no PR
   yet; next proof is PR or blocker.`
7. A Jules-reported completion with no PR and no branch diff renders as
    `publish proof missing`, not as complete and not as PR review.
8. Once a PR appears, the summary moves to GitHub ownership and shows changed
   files, check status, and review state.
9. A package PR merged with unrelated broad Build debt renders as
   `merged_remote`, not as `blocked` and not as `done`.
10. A merged remote package keeps showing the next proof boundary: local sync,
    package-history closeout, deployment proof when applicable, or a documented
    deployment waiver for docs-only packages.
11. Routine task-intake refreshes preserve the operator's scroll position and
    reopen stable drill-down panels, so a Jules/GitHub/local-sync refresh does
    not feel like the whole dashboard reset.

## Implementation Notes

2026-06-01 slice:

1. `conductor/symphony/public/dashboard.js` now derives a compact handoff
   at-a-glance packet from existing Jules, GitHub, check, and local-sync facts.
2. Merged GitHub PRs no longer inherit a blocked dashboard tone solely because
   an old broad Build check was red; they move to the local-sync/deployment
   proof boundary unless local sync itself is blocked.
3. Routine task-intake renders now capture scroll position and stable open
   drill-down panels before replacing the task intake HTML, then restore them
   afterward. This is an incremental no-reset repair, not a full component-frame
   renderer yet.
4. `conductor/symphony/src/server.ts` now includes an `atAGlance` packet in
   draft and handoff task-detail responses. The standalone task page renders it
   above the dense task grid so opening a task starts with boundary, owner, and
   next-proof status rather than raw receipts.
5. The standalone task page now refreshes only the at-a-glance card from the
   task-detail JSON endpoint on a short cadence. The rest of the page remains in
   place, and failed background refreshes keep the last visible status instead
   of blanking or reloading the page.
6. Dashboard overview rows, handoff drilldowns, and standalone task-page
   at-a-glance cards now show a human-readable source/freshness line such as
   `Jules fetched`, `GitHub fetched`, `Local sync fetched`, or `Symphony
   updated`. This makes automated polling visible without asking Codex to type
   status notes manually.
7. The handoff overview board now includes lane counts for Operator, Jules,
   GitHub, local sync, ready/current, and prepared work. These counts are
   derived from the same at-a-glance boundaries as the row summaries, giving the
   user an all-task status overview before drilling into individual cards.
8. Each lane count now expands into a compact human-readable task list with the
   task title, derived boundary, short summary, and link back to the matching
   handoff card. This is the first drillable overview component and keeps lane
   details derived from API/fetch state rather than manual notes.
9. When automatic dashboard polling is held because the operator is interacting
   with task intake controls, Symphony now refreshes only the handoff status
   board from `/api/v1/task-drafts` instead of skipping status freshness or
   replacing the whole task area. This is the first isolated dashboard component
   refresh path.
10. The isolated handoff status-board refresh preserves which lane drilldowns
    were open before the board update. A background board refresh should update
    the counts and lane contents without collapsing the user's current
    Operator/Jules/GitHub/local-sync drilldown.
11. Full task-intake renders now include lane drilldowns in the stable-details
    restore path as well. If Symphony does need to replace the larger task area,
    the user's open lane drilldowns are restored alongside task previews and
    foreman groups.
12. Standalone task pages now give the at-a-glance card direct drilldown links
    to the current boundary, timeline, messages, scope, Jules state, deployment,
    and local-sync sections when those components exist. The isolated
    at-a-glance poll renderer preserves those links after refresh.
13. Visible task-page actions no longer force `window.location.reload()` after
    recording local notes, clarifications, task filing, operator answers,
    guarded Symphony actions, repair-push receipts, or Jules feedback. They
    refresh the isolated at-a-glance card and leave the rest of the page in
    place, preserving scroll and form context.
14. After visible task-page actions succeed, the task page also refreshes the
    human-readable Current Boundary, Task Filing, Messages, Clarifications, and
    Timeline components from the task-detail JSON response. This keeps the
    drilldown evidence current without reloading the page or asking Codex to
    manually retype status notes.
15. Successful task-page submissions clear their just-submitted form fields
    after the API call succeeds, reducing accidental duplicate notes,
    clarifications, filing reasons, operator answers, repair-push receipts, or
    Jules feedback while keeping the page context stable.
16. The task-page in-place refresh now updates Deployment and Local Sync
    readiness fields from the task-detail JSON response after successful visible
    actions. Local sync checks can update status, blockers, sync eligibility,
    mutation warning, and next-proof text without reloading the task page.
   files, check state, review state, and the next safe refresh/review action.
9. A failed check whose workflow run is still in progress renders as `checks
   settling`, not as ready for repair, because logs may not be available yet.
10. A failed broad check whose logs cite files outside the PR diff renders as
    `unrelated check debt` and should preserve the package review path instead
    of sending Jules a repair request for files it was forbidden to touch.
