---
description: Run Aralia's context-aware end-of-session tidy-up chain.
---

# /tidy-up Workflow

This is the canonical tidy-up flow for Aralia agents. It is an agent workflow, not
the same thing as `npm run clean`.

## Source Of Truth

Tracked workflow docs live in `public/agent-docs/workflows/`.

The `.agent/workflows/` directory is local-only and ignored by Git. Use it only
for local calibration files such as `USER.local.md` and `INTENT-GATE.local.md`.
Do not point shared scripts or durable docs at `.agent/workflows/*.md`.

## Tier Selection

Agents choose a tier by risk and blast radius before running tidy-up. The user
does not need to name a tier.

| Situation | Mode |
| --- | --- |
| Only docs, comments, local notes, or tiny metadata edits changed | `light` |
| One narrow code file changed, focused verification already ran, and no shared contract changed | `light` |
| Source behavior, tests, runtime data, or user-facing output changed | `standard` |
| Exported types, shared utilities, hooks, state, build scripts, workflow scripts, Git hooks, package scripts, roadmap docs, or agent workflow docs changed | `full` |
| Branch merge, push preparation, release preparation, worktree cleanup, Git hook repair, or anything that previously broke sync changed | `push` plus the matching `standard` or `full` mode |
| UI or visual behavior changed | `standard` plus rendered verification |
| The agent cannot classify the change in under one minute | `standard`, or `full` if any shared-system file was touched |

The default safety rule is: when unsure, choose the heavier tier.

## Runnable Entry Points

- `npm run tidy-up:light`
- `npm run tidy-up:standard`
- `npm run tidy-up:full`
- `npm run tidy-up:push`
- `npm run tidy-up` defaults to `standard`

`scripts/tidy-up.sh <mode>` is the shared launcher for Codex CLI contexts. In an
active Codex Desktop conversation, prefer reading this workflow directly so the
agent can use the current conversation history.

## Mode Contracts

### Light

Use for low-risk documentation, comments, local notes, and tiny metadata edits.

Required:

1. inspect `git status --short --branch`,
2. run `npm run sync-check`,
3. confirm whether focused verification already ran or explain why it is not
   needed,
4. scan for stale workflow-path references if workflow docs or tooling metadata
   changed,
5. report changed files and open follow-ups.

### Standard

Use for ordinary code, data, tests, or user-facing behavior changes.

Required:

1. complete all `light` requirements,
2. run the relevant `/test-ts` path or focused test command,
3. run `/verify` with focused verification evidence,
4. include visual verification for UI/visual work,
5. run targeted session-ritual steps only for files actually touched.

### Full

Use for shared-system, workflow, tooling, Git-hook, package-script, roadmap, or
agent-doc changes. This is the original full tidy-up chain.

Required:

1. Run `/test-ts` from `public/agent-docs/workflows/test-ts.md`.
2. Run `/roadmap-node-orchestration` from `public/agent-docs/workflows/roadmap-node-orchestration.md`.
3. Run `/session-ritual` from `public/agent-docs/workflows/session-ritual.md`.
4. Run `/codexception` when the session produced reusable agent or environment learnings.

### Push

Use when preparing to publish, when Git/worktree/push mechanics changed, or when
the task repaired a push blocker.

Aralia Git hygiene policy:

1. `F:\Repos\Aralia` is the primary tree.
2. The primary tree should normally stay on `master`.
3. Local feature branches and extra worktrees are temporary exceptions, not a
   normal resting state.
4. Extra branches/worktrees must be removed, explicitly allowlisted, or reported
   before push/session close.
5. Temporary exceptions use explicit environment variables:
   `ARALIA_GIT_HYGIENE_ALLOWED_BRANCHES`,
   `ARALIA_GIT_HYGIENE_ALLOWED_WORKTREES`, or
   `ARALIA_GIT_HYGIENE_BYPASS=1`.

Required:

1. run `npm run sync-check`,
2. run `npm run git:hygiene`,
3. run `npm run intent-gate -- --strict`,
4. if the local intent gate is intentionally absent, report the exact blocker
   rather than bypassing silently,
5. simulate the tracked pre-push hook with the same environment the push will use
   when a bypass is explicitly justified,
6. pair this mode with `standard` or `full` when the change itself needs normal
   code/workflow verification.

## Full Execution Order

1. Run `/test-ts` from `public/agent-docs/workflows/test-ts.md`.
2. Run `/roadmap-node-orchestration` from `public/agent-docs/workflows/roadmap-node-orchestration.md`.
3. Run `/session-ritual` from `public/agent-docs/workflows/session-ritual.md`.
4. Run `/codexception` when the session produced reusable agent or environment learnings.

## Subagent Policy

Use bounded `gpt-5.3-codex-spark` subagents for independent scan,
classification, checklist, and receipt-summary work when that can happen without
overlapping file edits.

The parent agent owns:

1. final synthesis and user-facing scope choices,
2. approval-boundary decisions,
3. external mutations,
4. GitHub, merge, deployment, local-sync, and push decisions,
5. final decisions about whether local Symphony or agent material belongs in
   Aralia history.

## Completion Rules

Tidy-up is incomplete unless the final response includes:

1. the `/test-ts` result or an explicit blocker,
2. the required Roadmap Node Orchestration output block,
3. the required User Profile Calibration output block or a clear reason it was
   skipped,
4. verification evidence from `/verify` or an explicit blocker,
5. a short list of files changed during tidy-up,
6. any open follow-ups.

If no terminal learnings or codexception-worthy learnings were found, say so
plainly instead of editing a file just to satisfy the step.
