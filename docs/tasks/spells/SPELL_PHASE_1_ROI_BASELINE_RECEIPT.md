# Spell Phase 1 ROI Baseline Receipt

Status: baseline recorded, no ROI claim.

This receipt keeps the Symphony/Jules return-on-investment trail honest before
the first Spell Phase 1 Jules implementation slice exists. It separates local
Codex foreman preparation from later Jules implementation savings, so the flow
does not count broad planning or long-thread context as measured task savings.

## Scope

- Flow: Spell Phase 1, cantrips and spell levels 1-3.
- Current slice: Package 0 and Package 1 foreman preparation.
- Next implementation slice: Package 2, premade party and gear.
- Worker model: Jules-first implementation, Codex as foreman.

## Current Measured Facts

- No Package 2 Jules task has been dispatched.
- No Package 2 Jules implementation branch exists.
- No Package 2 PR exists.
- No Package 2 deployment or local-sync proof exists.
- No Package 2 avoided-work estimate exists.
- No Package 2 task-scoped foreman-usage receipt exists in Symphony yet.

## Foreman Work Already Performed

Codex has produced local foreman artifacts for the spell flow:

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md`
- `docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_PROMPT.md`
- `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json`
- `docs/tasks/spells/PACKAGE_2_DISPATCH_READINESS_CHECKLIST.md`
- `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`

This is useful setup work, but it is not proof that Jules saved implementation
time. It should be counted as foreman preparation until a Jules handoff exists
and the task-scoped Symphony ROI endpoints can record real receipts.

## Non-Counted Context

The active Codex thread has broad goal-context usage. That context spans
planning, status repair, contract cleanup, baseline generation, and discussion.
It must not be used as task-scoped ROI savings for Package 2.

If a later foreman records this long-thread usage, it should use a
`codex_goal_context` source and remain separate from task-scoped foreman usage.

## Required Package 2 ROI Evidence

Before claiming any Symphony/Jules savings for Package 2, record:

1. a Package 2 Symphony draft id
2. a Jules handoff/session id
3. Package 2 changed-file scope
4. Package 2 verification output
5. task-scoped Codex foreman usage through the local `roi-foreman-usage` path
6. a documented avoided-work estimate through the local `roi-estimate` path
7. caveats explaining what the estimate does and does not measure

The estimate should stay conservative. It can become `candidate_savings` only
after both task-scoped foreman usage and an avoided-work estimate exist.

## Current Verdict

ROI is unknown.

The flow has useful workflow value signals: Codex has scoped the first Jules
slice, prepared exact prompt/payload artifacts, and made the dispatch blocker
visible. Those are not measured savings. The first possible ROI claim belongs
after Package 2 has a real Jules handoff, review, verification, and receipt.
