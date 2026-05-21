# Package 2 Task Communication Receipt

Status: pending Package 2 Symphony task.

This receipt is the durable communication log for Package 2 once the Symphony
draft, Jules handoff, or task page exists. It keeps task-scoped messages,
clarifications, and operator decisions separate from broad thread context so the
first Spell Phase 1 Jules slice can prove how Codex acted as foreman.

## Current State

- Symphony task draft exists: `no`
- Jules handoff/session exists: `no`
- Task page communication available: `no`
- Task-scoped operator messages recorded: `no`
- Task-scoped Codex foreman messages recorded: `no`
- Open clarifications: `none`
- Can this receipt prove task-scoped communication yet: `no`

Reason: Package 2 is still blocked on the Jules Environment snapshot receipt.
No Package 2 Symphony draft or Jules handoff exists yet.

## Communication Channels To Record

After Package 2 dispatches, record communication through the existing Symphony
task paths where available:

- local task messages on the Package 2 task page
- structured task clarifications
- operator answers or waivers
- Jules prompt and any Jules dialogue that affects scope, repair, or readiness
- GitHub PR comments only if they become part of the Package 2 review path

Do not treat broad Codex thread context as task-scoped Package 2 communication.

## Fields To Fill After Dispatch

- Symphony draft id:
- Jules handoff/session id:
- Task page URL or JSON endpoint:
- Initial Jules prompt recorded: `yes` or `no`
- Operator messages recorded:
- Codex foreman messages recorded:
- Structured clarifications recorded:
- Jules dialogue affecting scope or repair:
- GitHub PR comments affecting scope or repair:
- Open questions remaining:
- Communication blockers:
- Can Package 2 advance from a communication standpoint: `yes` or `no`

## Rules

- Do not send Jules feedback just to make this receipt non-empty.
- Do not count global conversation context as task-scoped communication.
- If Package 2 needs an operator decision, record the decision point, options,
  answer, and next proof in the decision report as well as this receipt.
- If Jules feedback is sent, record why local review, a decision-report entry, or
  a GitHub comment was not the better communication channel.
