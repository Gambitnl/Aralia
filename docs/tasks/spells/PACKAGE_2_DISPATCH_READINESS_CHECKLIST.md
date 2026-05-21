# Package 2 Dispatch Readiness Checklist

Status: Symphony draft submitted, blocked by Git sync before Jules dispatch.

This checklist is the handoff guard between the prepared Package 2 artifacts and
the first write-producing Jules implementation slice. It exists so a future
foreman can tell exactly what is ready, what is blocked, and which action would
mutate Symphony, Jules, GitHub, or the local repository.

## Ready Artifacts

- Phase 1 plan:
  `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- Scoped baseline report:
  `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- Package 2 task:
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
- Exact Jules prompt:
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`
- Symphony draft payload:
  `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
- Jules Environment operator runbook:
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md`
- Jules Environment snapshot receipt:
  `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`
- Decision report:
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- ROI baseline receipt:
  `docs/tasks/spells/SPELL_PHASE_1_ROI_BASELINE_RECEIPT.md`
- Atlas/gate checkpoint receipt:
  `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- Foreman review and failure-classification receipt:
  `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`
- Task communication receipt:
  `docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md`
- PR/deployment/local-sync receipt:
  `docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md`
- Symphony draft submission receipt:
  `docs/tasks/spells/PACKAGE_2_SYMPHONY_DRAFT_SUBMISSION_RECEIPT.md`
- Git sync attempt receipt:
  `docs/tasks/spells/PACKAGE_2_GIT_SYNC_ATTEMPT_RECEIPT.md`

## Reserved Names

Implementation branch, not yet created or pushed:

- `jules/spells-package2-premade-party-gear`

Optional Codex review/repair branch, not yet created or pushed:

- `codex/spells-package2-premade-party-gear-review`

Optional local worktree, not yet created:

- `F:\Repos\Aralia\.worktrees\spells-package2-premade-party-gear`

## Environment Snapshot Gate

The external Jules Environment `Run and Snapshot` gate is cleared for Package 2.
The first broad script failed during repo-wide typecheck:

```powershell
npm ci --no-audit --no-fund
npm run typecheck
npm run validate:spells
```

The accepted Package 2 scoped script passed:

```powershell
npm ci --no-audit --no-fund
npm run validate:spells
npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose
```

Evidence:

- `docs/tasks/spells/evidence/jules-env-config-spell-phase1-typecheck-failed-2026-05-21.png`
- `docs/tasks/spells/evidence/jules-env-config-spell-phase1-focused-test-path-failed-2026-05-21.png`
- `docs/tasks/spells/evidence/jules-env-config-spell-phase1-package2-scoped-snapshot-passed-2026-05-21.png`

## Confirmed Non-Actions

- The local POST to `/api/v1/task-drafts` has been sent.
- Symphony returned Package 2 draft id `draft-1779344522441-vdy0hi`.
- That draft is currently `blocked_by_git_sync`.
- No Package 2 Jules task has been dispatched.
- Local branch `codex/spell-phase1-symphony-package2-setup` exists with commit
  `290cccb8`; remote push was not completed because the Codex tool approval
  flow rejected the escalated push command before Git ran.
- No Package 2 implementation branch or worktree has been created.
- No Package 2 PR has been opened.
- No Package 2 merge, deployment proof, local sync, or ROI receipt exists yet.
- No Package 2 task-scoped ROI savings claim is allowed yet; the current ROI
  baseline receipt says ROI is unknown until a real Jules handoff and receipts
  exist.

## Next Dispatch Steps

1. Complete remote Git sync for
   `codex/spell-phase1-symphony-package2-setup`, or record an explicit waiver if
   Package 2 will launch from another branch.
2. Rerun or explicitly classify the remaining Git sync blockers reported by
   Symphony: `Could not fetch origin`, tracked dirty files, and untracked files.
3. Rerun the Git preflight or task queue snapshot and record the updated
   readiness state for `draft-1779344522441-vdy0hi`.
4. Dispatch Jules with the exact prompt in
   `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`.
5. Record the Jules handoff/session id, branch, PR URL, verification output,
   Atlas/gate refresh result, and task-scoped ROI facts as they become
   available.
6. Record `roi-foreman-usage` and `roi-estimate` receipts before making any
   Package 2 Symphony/Jules savings claim.
7. Fill `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md` before
   deciding Package 3 can begin.
8. Fill `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md` with scope
   review, failure classification, and the selected review outcome before
   deciding Package 2 is ready for PR follow-through or Package 3.
9. Fill `docs/tasks/spells/PACKAGE_2_TASK_COMMUNICATION_RECEIPT.md` with
    task-scoped messages, clarifications, and operator/Jules communication facts
    before claiming the Symphony task page has complete Package 2 context.
10. Fill `docs/tasks/spells/PACKAGE_2_PR_DEPLOYMENT_LOCAL_SYNC_RECEIPT.md`
    before claiming Package 2 has completed the GitHub, deployment, and local
    sync lifecycle.

## Abort Or Repair Path If Snapshot Fails

If a future Jules Environment snapshot fails, do not dispatch Package 2 or the
affected slice.

Record the failure in the snapshot receipt, classify it as dependency setup,
lockfile, test, typecheck, or unknown, and add a decision-report entry before
choosing a fallback. The old diagnostic fallback was:

```powershell
npm install --no-audit --no-fund
npm run typecheck
npm run validate:spells
```

That fallback may change lockfile state inside Jules' working copy, so it must
not silently replace `npm ci` without a recorded decision.
