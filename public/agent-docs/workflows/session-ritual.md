---
description: Close an Aralia agent session. Prove the work, record what is left, release Agora, hand over, and report.
---

# Session close procedure (`/session-ritual`)

Verified: 2026-11-03, against `tools/agora/client.mjs`, `tools/agora/planmap-add.mjs`,
`scripts/git/nightly-snapshot.mjs`, `scripts/memoryWrite.mjs` and the memory note
`session-close-out-protocol` (Remy, 2026-11-03).

This file is the one close procedure for every agent in this repository. Root `AGENTS.md`
("Session Hygiene") points here. `tidy-up.md` is now only a pointer to this file. No
`/session-ritual` slash command or skill exists. Read this file directly.

Use it when your task is done, and when you must stop before the task is done. Find your
close case in section 1. Then do only the steps that section 3 gives for that case.

## 1. Find your close case

| Case | Use it when | Hand-over file |
|---|---|---|
| **A. Small fix** | You fixed a typo, corrected a doc, or made one small fix in a known file. You learned nothing new about a system. | No. Report in chat. |
| **B. Feature session ends** | The task that the session started for is done and proved. All leftover work has a gap row. | Yes |
| **C. Unfinished hand-over** | You stop before the original task is done. For example, Remy asks you to stop, you are blocked, or the context is too long. | Yes, with the work in progress |
| **D. Dispatched worker** | An orchestrator started you with an Agora task or a coordination contract. | No. The Agora task result is the hand-over. |

If you cannot choose, use the heavier case. B is heavier than A, and C is heavier than B.
A worker that must stop before its task is done uses case D. Its task result then names
the unfinished part, and the task goes to `blocked` with a reason.

## 2. Rules for every case

Read these rules before you start to close. They prevent the failures that broke trust
in the past.

1. **Do not commit, push, branch, stash, reset, or make a worktree.** The orchestrator
   pushes settled work through `scripts/git/nightly-snapshot.mjs`. Do these git steps
   only when your own task says so. `docs/architecture/domains/nightly-git-save.md`
   describes the push.
2. **Release every Agora lock before you stop.** The nightly save holds back each file
   that is under a live Agora lock. A lock that you forget blocks the push of your own work.
3. **Do not run repository-wide checks.** Do not run the full test suite, the full
   `npm run typecheck`, the full lint, or a full MemPalace mine. Use the focused check
   that can find a failure in your change. Section 4 lists them.
4. **Do not run the dependency-header sync.** The orchestrator runs one
   `--sync --only` pass for each wave. Name each file with a changed exported
   signature in your report or hand-over instead.
5. **Put screenshots and other throwaway files only in `.agent/scratch/`.** Run
   `git check-ignore <path>` before you write to a new place.
6. **Do not make a dated markdown file**, except an ADR in `docs/adr/`.
7. **Do not edit `AGENTS.md` or a `remy-*.md` memory note.** A hook blocks these edits.
   Put the change that you propose in your report, and Remy applies it.
8. **Do not invent work to fill a step.** If a step has nothing to record, write "none"
   in the report and continue.
9. **Do not close a session in the middle of a task.** Do not send a message to a session
   that shows "needs the user".

## 3. The close steps

Do the steps in this order. The table tells you which steps apply to your case.

| Step | A | B | C | D |
|---|---|---|---|---|
| 3.1 Prove the work | yes | yes | yes, for the done part | yes |
| 3.2 Gap rows | only for a gap you found | yes | yes | yes |
| 3.3 Domain docs and `Verified:` | only if you edited one | yes | yes, for the done part | only for a doc your task owns |
| 3.4 Planmap topic | no | yes | yes, set the true status | no, use a `planmap:` ref |
| 3.5 Memory notes | no | yes, if there is a new gotcha | yes, if there is a new gotcha | only for a reusable gotcha |
| 3.6 MemPalace mining | no | yes | yes | no |
| 3.7 Dependency headers | name the files | name the files | name the files | name the files in the result |
| 3.8 Hand-over file | no | yes | yes | no, use the task result |
| 3.9 Agora release | yes, if you checked in | yes | yes | yes |
| 3.10 Report | short, in chat | yes | yes | in the task result |

### 3.1 Prove the work

1. Run the focused check that can find a failure in your change. Section 4 lists the checks.
2. For visual work, capture the rendered result into `.agent/scratch/<topic>/`. Look at
   each image yourself before you claim a visual fix.
3. Write down each check, its command, and its result. Use this list in the report.
4. Do not repeat a check that passed, unless a later change makes the result old.

If the work is visual, Remy reviews it before the orchestrator archives the session. Say
in the report where the captures are.

### 3.2 Gap rows

Each open item must have a gap row. A gap row is the only record that survives the
session. Use the Agora client, not a hand edit. The `gap add` command needs no lock.

1. Search for a row that already exists:
   `node tools/agora/client.mjs gap search "<the defect in your own words>"`
2. If a row exists, add your evidence to it:
   `node tools/agora/client.mjs gap update <id> --status <its current status> --note "<new evidence>"`
3. If no row exists, add one. Use the project that owns the gap, or `global` when no
   project owns it. Use `workflow` for friction with the agent tools.

   ```bash
   node tools/agora/client.mjs gap add --project <global|workflow|project-dir> \
     --gap "<what is missing or wrong>" --evidence "<how you know>" \
     --why "<why it matters>" --next "<the repair>" --proof "<what proves it fixed>" \
     --suggested-agent <agents.json key|human-operator>
   ```

4. Resolve each row that your work fixed:
   `node tools/agora/client.mjs gap resolve <id> --note "<proof>"`
5. Write each row id in the report or the hand-over.

`tools/agora/AGENT.md` step 6 gives the full rules for gap rows.

### 3.3 Domain docs and the `Verified:` line

A domain doc in `docs/architecture/domains/` says how a system works now.

1. Find the domain doc for each system that you changed. If none exists, write one.
2. Lock the doc with Agora before you edit it.
3. Change the text that your work made false. Add the new behavior.
4. Set the `Verified:` line to today's date only for the sections that you checked
   against the code. If you checked only some sections, name them on the line. Keep the
   old date for the sections that you did not check.

Do not update a domain doc for a typo fix or for a change that does not alter how the
system works.

### 3.4 Planmap topic

`public/planmap/topics.json` holds the status of each planned feature. The planmap Stop
hook asks about it when you change product code.

1. Find the topic and the feature for your work in `topics.json`.
2. Lock the file: `node tools/agora/client.mjs lock public/planmap/topics.json --reason "<why>"`.
   Other sessions use this file often, so keep the lock short.
3. Set the status. Use one of `parked`, `specced`, `active` or `done`.

   ```bash
   node tools/agora/planmap-add.mjs --topic <topic-id> --feature-match "<feature text>" --set-status <status>
   ```

   For a new feature, use `--topic <topic-id> --feature "<title>"`. The command validates
   the file.
4. Unlock the file at once: `node tools/agora/client.mjs unlock public/planmap/topics.json`.

Case C sets the true status, which is usually `active`. Do not set `done` for work that
is not done. A dispatched worker (case D) does not edit `topics.json`. Its board task
carries a `planmap:<topic>/<feature-slug>` ref. Then `tools/agora/planmap-reconcile.mjs`
changes the status. `tools/agora/PLANMAP-AGENT-GUIDE.md` gives the full rules.

### 3.5 Memory notes

Agent memory (`~/.claude/projects/F--Repos-Aralia/memory/`) holds recall and gotchas.
Use it only for knowledge that is in no other file and that a later agent needs.

1. Check for a note that already covers the fact. Update that note instead of a new one.
2. Write one fact in each note, with the frontmatter that `MEMORY.md` describes. Use the
   hash-checked helper `scripts/memoryWrite.mjs` (`updateMemory`), because other
   sessions write to the same store.
3. Add one line for a new note to `MEMORY.md`.
4. Do not save what the repository already records. Put a fact about how a system works
   in its domain doc (step 3.3). Do not edit a `remy-*.md` note.

### 3.6 MemPalace mining

Mine only the folders that your session changed. Use the narrowest folder that holds
each changed file. MemPalace cannot mine a single file.

1. List the changed files: `git diff --name-only` and `git status --short`. Keep only
   your files. Other sessions share this checkout.
2. Mine each folder with the MCP tool `mempalace_mine`. Set `source` to the folder,
   for example `F:/Repos/Aralia/docs/architecture/domains`, and set `wing` to `aralia`.
   The command line equivalent is
   `python -m mempalace mine "F:/Repos/Aralia/<folder>" --wing aralia`.
   The bare `mempalace` command is not on the PATH on this host.
3. Read the counts of files processed and filed. A run with zero files is not a success.
   Check the folder path, and report the result.
4. If the result says "Peer MCP writer active" or "palace ... is held by PID", another
   session holds the palace. Do not stop that process. Report the mine as skipped, give
   the error, and name the folders. The orchestrator mines them later.

Do not mine `node_modules`, build output, `.agent/scratch/`, or generated data.

### 3.7 Dependency headers

Do not run the sync. Name each file that has a changed exported signature, or a changed
`utils`, `hooks` or `state` file. Put the list in your report, hand-over, or task result.
The orchestrator runs one pass for each wave:

```bash
npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync --only <path> [<path>...]
```

If no such file changed, write "none".

### 3.8 Hand-over file

Write the hand-over at `.agent/scratch/handovers/<session-name>.md`. Use a short name
from the session title, for example `perf-minified.md`. Use the template in section 5.
The file is in the gitignored scratch folder, so it is a pointer and not a durable home.
Each open item must have a gap row (step 3.2). Each fact that a later agent needs must go
to a durable home (steps 3.3 to 3.5). Do this before you write the hand-over.

### 3.9 Agora release

Do these steps after your last edit, and in this order.

1. If you claimed a board task, finish it with proof. For long text, use a file:
   `node tools/agora/client.mjs task done <id> --result-file <path>`. For work that you
   cannot finish, use `task state <id> blocked --reason "<what blocks it>"`.
2. Release your locks: `node tools/agora/client.mjs unlock --mine`.
3. Report tool friction: `node tools/agora/client.mjs say "WORKFLOW: <friction, or none>"`.
   File real friction as a `workflow` gap row (step 3.2).
4. Retire: `node tools/agora/client.mjs retire --note "<final state>"`.

Set `AGORA_AGENT_ID` to your own handle on each call. Without it, `unlock --mine` can
release the locks of another agent.

### 3.10 Report

Put the result first. The session that started you sees only the first 400 characters.

- **Case A:** one to three lines. Give the file and line, the check and its result, and
  any new gap row id.
- **Cases B and C:** give the hand-over path in the first line. Then give a short form of
  the hand-over sections 1, 3 and 5. Add a proposed `AGENTS.md` change, if you have one.
- **Case D:** the task result holds the report. Give the changed files, the proof, the
  gap row ids, the files for the dependency-header pass, and any knowledge that is not
  in a file yet.

State each skipped step and the reason. If a check failed, say so and give the output.

## 4. Focused checks

| Change | Check |
|---|---|
| A doc or an instruction | Check the links and the paths that you cite. Read the diff. Run no app tests and no build. |
| TypeScript source | `npm run typecheck:files -- <path> [<path>...]` and the Vitest file for the changed code |
| A test, or behavior with a test | The changed test files only, through `/test-ts` or `public/agent-docs/workflows/test-ts.md` |
| Visual or UI work | A rendered capture of the changed surface, inspected by you. Design Preview is at `/Aralia/misc/design.html?step=<step>`. |
| `topics.json` | `node tools/agora/validate-planmap.mjs` (`planmap-add.mjs` runs it for you) |
| Agora daemon routes | A fresh in-process `createAgoraServer` test. See "Server-route proof" in `tools/agora/AGENT.md`. |

Run a broader check only for a risk that the focused check cannot cover, or when the task
asks for it.

## 5. Hand-over template

```markdown
# Hand-over: session "<session title>"

Session id <id>. Closed <YYYY-MM-DD>. Case <B or C>. <One line: done, or what is left.>

## 1. Original task: <name> (<done | partly done | not started>)

<What the task asked for, and what exists now.>

- Code: <files>.
- Proof: <tests, checks, CI runs, commit ids>.
- Captures: `.agent/scratch/<topic>/` (<what each image shows>). Visual work waits for Remy.
- Plan map: <topic id>, feature "<name>", status <status>.

## 2. Later tasks

| Task | Status | Proof |
|---|---|---|
| <task or gap id> | <done, partly done, not started> | <commit, test, row id> |

## 3. Open items

- **<gap id>:** <what is left, and the next step>.

Each open item has a gap row. <Say "No open item lacks a row.">

## 4. Knowledge not in a file yet

- <Fact, and where you saved it: memory note, domain doc, or "only here".>

## 5. Uncommitted files

- `<path>`: <what changed>. <Safe to push | Hold back: reason>.

Files with a changed exported signature, for the dependency-header pass: <paths, or none>.

## 6. Work in progress (case C only)

- The next step: <the exact next action>.
- Half-edited files: <paths, and what state each one is in>.
- How to check where the work is: <a command or a page>.
```

For case C, mark each uncommitted file "safe to push" or "hold back". The nightly save
can push each unlocked file. A half-edited file that breaks the build must not go to
GitHub without a review.

## 6. After the hand-over: the orchestrator's steps

This section is for the orchestrator, or for Remy when no orchestrator runs.

1. Read the hand-over. A hand-over is a report, not proof. Check the diff and the proof
   before you call the work done.
2. If the work is visual, Remy looks at it first.
3. Run the dependency-header pass once, with `--only` and the files that the wave named.
4. Push the files through `scripts/git/nightly-snapshot.mjs`. Hold back each file that
   the hand-over marks "hold back".
5. Archive the session with `archive_session`. You can undo this step. A session with an
   open Remote Control client cannot be archived by a tool, so Remy archives it from the
   sidebar.
6. Start one new session for each group of open items. Give it a clear title and a brief
   that points at the hand-over.
7. Keep a session that is still on its own topic. Rename it if the title is too narrow.

## 7. Retired steps

The earlier version of this file (and `tidy-up.md`) had the steps below. The close
procedure no longer uses them. Run one only when Remy or your task asks for it.

| Old step | Why it is retired | Where it is now |
|---|---|---|
| Every agent runs `--sync <file>` | It writes dependents that other agents hold locked. | Orchestrator, once each wave (step 3.7). |
| Script-path sweep that searches `conductor/` | The `conductor/` folder was deleted on 2026-08-31. | Search the moved name in `docs`, `public`, `scripts`, `src`, `tools` and `.github` when you rename a script. |
| Roadmap-node orchestration as a mandatory step | It updates the `devtools/roadmap` feature tree, which is an inventory and not a status store. | Planmap topic (step 3.4). `public/agent-docs/workflows/roadmap-node-orchestration.md` stays for an explicit roadmap task. |
| User-profile calibration | `.agent/workflows/USER.local.md` is absent. | `user-profile-calibration.md`, on request. |
| Terminal learnings into `.agent/rules/Terminal.md` | That file is local and Codex-only. Agent memory now holds gotchas. | Memory notes (step 3.5). |
| `/review-session` and `/log-session` | No Claude command exists, and no session runs them. | `review-session.md` and `log-session.md`, on request. |
| Code-commentary skill check | The skill exists only for Codex (`.codex/skills/code-commentary`). | The comment rules in root `AGENTS.md` ("Interpretability"). |
| Sub-agent parallel contract | It conflicts with the limit of two subagents at a time. | None. |
| Tidy-up `light`, `standard`, `full` and `push` modes through `codex exec` | Each mode started a new Codex run with no context. The `full` mode ran the full test suite, and `push` prepared a push that only the orchestrator makes. | This file. `npm run tidy-up:*` now prints a pointer to it. |
