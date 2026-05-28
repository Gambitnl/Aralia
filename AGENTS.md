# AGENTS.md

## Repo Intent

Aralia is a web-based application/game with procedural systems and complex mechanics.

This repo should be approached as **expansion-first**, not cleanup-first.
Preserve unfinished intent, future optionality, and embryonic systems unless removal is clearly justified.
Do not mistake a cleaner diff, lower lint count, or less code for automatic progress.

**The goal is an ever-widening scope.** When executing a task, treat it as a discovery process. Do not artificially shrink success to whatever is easiest to complete. When you discover gaps, missing features, or adjacent debt, classify them and add them to the relevant project's `GAPS.md` tracker without letting discovery swallow the active task.

Aralia task docs are the durable GitHub-synced home for Jules-readable handoff
material. Symphony dashboards, generated manifests, draft ids, click receipts,
local run state, and other orchestration artifacts should stay external or
ignored unless a small excerpt is intentionally copied into an Aralia-facing
task packet or temporary migration note.

For Symphony/Jules work, preserve Aralia-facing intent and proof rather than
raw process exhaust. Track task packets, prompts, acceptance criteria, package
tracker updates, final product PR links, and short blocker or repair summaries.
Keep Symphony implementation repairs, local workflow verifiers, raw Symphony
receipts, dashboard caches, generated manifests, click logs, local task-store
churn, and `.symphony` / `.jules` runtime output ignored or external unless one
concise excerpt is needed to explain a real Aralia package decision.

Do not treat every Symphony planning or operator file as Aralia-facing just
because it lives under `conductor/symphony/`. Files such as Symphony open-task
queues, dashboard backlog notes, local workflow receipts, draft inventories,
and operator-process ledgers are local or Symphony-owned by default. Sync them
to GitHub only when a short excerpt is copied into an Aralia task packet,
tracker, or migration note to explain a real package decision. Before adding a
new Symphony doc to Git, classify it as one of: Aralia-facing handoff material,
Symphony implementation/spec repair material, local operator/process state, or
runtime artifact. Only Aralia-facing handoff material should normally be tracked
in this repo.

For local orchestration chores, prefer bounded `gpt-5.3-codex-spark`
subagents when the work is a low-level scan, classification, checklist/tracker
maintenance pass, receipt/ROI summary, artifact cleanup recommendation, or
decision-lesson extraction. The main Codex foreman still owns final synthesis,
user-facing scope choices, approval-boundary decisions, external mutations,
Jules launch/plan/messaging, GitHub PR actions, merge/deployment/local-sync
decisions, and any final decision about whether Symphony-local material belongs
in Aralia history.

Under uncertainty, the safer failure is usually temporary duplication, not premature pruning.

## User Calibration

When available, consult `.agent/workflows/USER.local.md` before substantial work.

Use it as a values-and-risk calibration file:

1. what the user is trying to protect
2. what counts as meaningful progress
3. what patterns break trust
4. what recurring pitfalls agents should help contain

Do not treat `USER.local.md` as permission to invent personal lore about the user.
Prefer confirmed values, observed work-patterns, and explicit trust signals over speculative personality claims.

If `USER.local.md` contains both confirmed observations and open questions, optimize your behavior around the confirmed parts and treat the open questions as prompts for cautious inquiry, not as settled truth.

## Cold-Start Rules

Before writing new code, assume the repo may already contain:

1. a reusable component or scaffold
2. an unfinished version of the system you are about to build
3. a local UI/style standard you should extend instead of bypassing

Before implementing, search for:

1. existing related systems in `src/`
2. shared UI primitives, frame patterns, button treatments, and styling conventions
3. roadmap/tooling/docs that describe the feature area or an unfinished branch of it

If a new conversation starts cold, do not invent a parallel system until you have checked for an existing one.

Good starting surfaces:

1. `docs/AGENT.md` for broad architecture and directory orientation
2. `docs/ARCHITECTURE.md` for domain-level system mapping
3. roadmap/workflow docs when the task touches unfinished or planned capability
4. the MemPalace memory system (see below)

## MemPalace (AI Memory System)

This project has a local, persistent AI memory system called **MemPalace**. It contains 143,000+ searchable text chunks ("drawers") from:

1. The entire Aralia codebase (source, docs, game data, config)
2. All past Claude Code conversation transcripts
3. All past OpenAI Codex CLI session transcripts

### How to query it

**Via MCP (Claude Code):** The MCP server is already configured. Use the `mempalace` tool to search for past decisions, code context, or conversation history.

**Via CLI:**
```
mempalace search "your query here"
```

**Via Python:**
```python
import chromadb
c = chromadb.PersistentClient(path="C:/Users/Gambit/.mempalace/palace")
col = c.get_collection("mempalace_drawers")
results = col.query(query_texts=["your query"], n_results=5)
```

### When to use it

- **Cold starts**: Before building something new, search the palace for prior discussions or decisions about that system.
- **Debugging**: Search for past conversations where a similar issue was discussed or resolved.
- **Architecture questions**: Query for past rationale behind design choices.
- **Continuity**: When picking up work another agent started, search for their session context.

### Keeping it updated (Targeted Mining Policy)

To avoid scanning thousands of unrelated data and codebase files, **do not default to full-repo mining after every task.** Instead, follow a **targeted** mining policy that keeps the palace accurate while being highly efficient and proportional to the work performed.

#### Targeted vs. Full-Repo Mining Policy

1. **Targeted Mining (Preferred Default)**:
   Limit mining to the narrow directories or specific subdirectories affected by the session's work.
   - For normal task completion, identify changed files using:
     - `git diff --name-only HEAD~1..HEAD` (for the latest commit)
     - `git diff --name-only` (for uncommitted work)
     - Any newly created durable Aralia-facing documents, reports, or plans
       under `docs/`.
   - Do **NOT** mine runtime artifacts, temporary proof captures, generated outputs, `node_modules`, build outputs, or massive structured data unless they are the exact durable artifact being preserved.
   - Record skipped or partial mining honestly in the final session report.

2. **Full-Repo Mining (Exception Only)**:
   Run a full-repo mine (`mempalace mine F:\Repos\Aralia --wing aralia`) **only** under these conditions:
   - The task changed repo-wide conventions, patterns, or architecture.
   - Many disparate directories changed across the entire codebase.
   - The MemPalace index is suspected to be stale or corrupt. Do not automatically full-repo mine; report the symptom, run only documented repair/diagnostic steps if available, and ask the operator before any full-repo re-mine.
   - The operator/user explicitly requests a full re-mine.

#### MemPalace CLI Limitations & Workarounds

> [!IMPORTANT]
> **No Single-File/File-List Support**: The MemPalace CLI `mine` command expects a directory. Passing a single file (e.g., `mempalace mine F:\Repos\Aralia\AGENTS.md`) directly will result in `Files processed: 0`. Always target the **narrowest containing directory** instead.

> [!IMPORTANT]
> **Explicit Wing Specification Required**: When mining a subdirectory, do not rely on root config discovery. Always pass `--wing aralia` so drawers stay in the project wing.

#### Concrete Examples

- **For a Spell Phase task-documentation update (narrow subdirectory target)**:
  ```powershell
  mempalace mine F:\Repos\Aralia\docs\tasks\spells --wing aralia
  ```
- **For a single durable file in a subdirectory** (mine its narrowest parent directory with explicit wing to capture it):
  ```powershell
  mempalace mine F:\Repos\Aralia\docs\tasks\spells --wing aralia
  ```
- **For a source change in `src/`**:
  ```powershell
  mempalace mine F:\Repos\Aralia\src\components\dashboard --wing aralia
  ```
- **For broad architectural changes (full-repo re-mine)**:
  ```powershell
  mempalace mine F:\Repos\Aralia --wing aralia
  ```

### Palace location

- Config: `F:\Repos\Aralia\mempalace.yaml`
- Database: `C:\Users\Gambit\.mempalace\palace`
- Wing: `aralia` (single wing covering the whole project)

## Risk Priorities

When tradeoffs appear, use this bias order:

1. preserve intent and future feature space
2. preserve behavior
3. reuse existing structures where possible
4. only then optimize neatness, lint cleanliness, or broad refactor quality

Broad cleanup is not neutral. If a change removes code, exports, imports, or architectural branches, explain why that removal is safe.

If a lint/type/build fix appears to require broader refactor, do not silently expand scope. Keep the fix local or explicitly flag the broader work for review.

## Interpretability

The project owner does not rely on raw code reading as the primary review surface.
Comments are part of the human-facing interpretability layer.

When editing code, comments should help answer:

1. what changed
2. why it changed
3. what was preserved
4. what remains uncertain or deferred

Do not use comments to hand-wave broad changes as "cleanup" if meaningful behavior, optionality, or system direction may have changed.

## Visual Verification

For UI and UX work, rendered output is the source of truth.

Do not mark a visual issue as fixed from source code, DOM state, or computed styles alone.
Use Playwright screenshots or direct rendered inspection before claiming a visual fix is verified.

If only structural checks were completed, say that explicitly instead of collapsing them into a visual verification claim.

## Roadmap And Discoverability

The roadmap/tooling layer is not just project management. It helps humans and agents understand:

1. what exists
2. what is unfinished
3. what is done
4. what is planned
5. where systems live
6. what should be reused instead of duplicated

If you are changing a system with roadmap implications, use the roadmap-related workflow/tooling rather than relying only on local code impressions.

## Environment

1. **Shell**: Use `powershell -NoLogo -Command` (do not use `pwsh`).
2. **Paths**: Project root is `F:\Repos\Aralia`. Use backslashes for native commands and avoid `Users\Users` nesting mistakes.
3. **Node Execution**: Setting `{ shell: true }` is mandatory when spawning Windows `.cmd` or `.ps1` wrappers via Node.js.

## Required Tooling

1. **Testing**: Use `/test-ts` to execute unit tests (Vitest), type tests (TSD), or build-time checks (TSC).
2. **Dependency Tracking**: When modifying exported signatures, `utils`, `hooks`, or `state` files, run:
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync <path>`
3. **Push Policy**: Treat broad `npm run typecheck` and `npm run lint` output as visible debt unless the task is explicitly a strict cleanup/review pass. The pre-push policy in `scripts/git/pre-push-aralia.sh` keeps `npm run sync-check` and intent-gate failures blocking, but ordinary pushes do not run the full type/lint backlog. Run `npm run quality:debt` for a summarized report, `ARALIA_PRE_PUSH_STRICT=1 git push` for strict local gating, and `npm run hooks:install` to install or refresh the local `.git/hooks/pre-push` delegator.
4. **Session Hygiene**: Execute `/session-ritual` after major task verification to sync dependency headers and complete end-of-session maintenance.

## Practical Rule

If you are about to build something new, first answer:

1. what existing system is closest to this
2. what standard or scaffold should this reuse
3. what unfinished intent might this accidentally overwrite

If you cannot answer those questions yet, search more before coding.
