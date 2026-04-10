# AGENTS.md

## Repo Intent

Aralia is a web-based application/game with procedural systems and complex mechanics.

This repo should be approached as **expansion-first**, not cleanup-first.
Preserve unfinished intent, future optionality, and embryonic systems unless removal is clearly justified.
Do not mistake a cleaner diff, lower lint count, or less code for automatic progress.

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

### Keeping it updated

After significant project changes, re-mine to index new files (already-filed files are skipped automatically):
```
mempalace mine F:\Repos\Aralia
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
3. **Session Hygiene**: Execute `/session-ritual` after major task verification to sync dependency headers and complete end-of-session maintenance.

## Practical Rule

If you are about to build something new, first answer:

1. what existing system is closest to this
2. what standard or scaffold should this reuse
3. what unfinished intent might this accidentally overwrite

If you cannot answer those questions yet, search more before coding.
