# Agora evaluation and whole-product coherence findings

Purpose: evaluate the Agora coordination system, explain why 353 workflow gap IDs at initial snapshot (354 after `WF-G357` was filed during this review wave) and 431 global gap rows accumulated systemic overhead without a whole-system warning, and define a proposal for whole-product coherence tracking.

This file is a living document. Update it in place. Do not create dated copies of it.
Related reviews: [`docs/architecture/agora-system-review.md`](./agora-system-review.md) and [`docs/deepdives/agora-product-review.md`](../deepdives/agora-product-review.md).

Verified: 2026-10-22 against `tools/agora/`, `docs/projects/GLOBAL_GAPS.md`, `public/planmap/health.json`, `docs/adr/`, `docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md`, and the two sibling 2026-10-22 Agora reviews.

---

## 1. Executive summary

Agora (`tools/agora/`) coordinates multiple AI agents (Claude, Codex, Gemini) and human operators in one shared checkout (`F:\Repos\Aralia`). The design spec (`docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md`, lines 20 to 21) explains why: an earlier rule told agents to use a manual Git worktree, and incoming sessions forgot to use it. Keeping one primary tree on `master` is also a standing repository rule (`AGENTS.md`). On this shared checkout, a full TypeScript check takes 10 to 30 minutes (`AGENTS.md`), so Agora pairs pre-dispatch file partition checks and scoped file checks (`npm run typecheck:files`) with a local HTTP daemon (`http://localhost:4319`).

An inspection of Agora across 353 unique `WF-G` rows at initial snapshot (`72 + 219 + 62 = 353` rows up to `WF-G356`, and 354 unique rows after `WF-G357` was filed during this review wave; count command: `powershell -NoLogo -Command "(Select-String -Path tools/agora/WORKFLOW_GAPS.md -Pattern '^[|] *WF-G[0-9]+ ').Count"`) in `tools/agora/WORKFLOW_GAPS.md` and 431 `GG` rows (with IDs up to `GG-432`) in `docs/projects/GLOBAL_GAPS.md` shows two structural problems:

1. **Local workflow fixes accumulate into system-wide overhead.** Although some `WF-G` entries require no source edit (such as `WF-G39`) or live in separate modules, many `WF-G` fixes add code to `client-runtime.mjs` and append rules to `AGENT.md`, `ORCHESTRATOR.md`, or `PROTOCOL.md`. Unit tests then assert that prose in place with regular expressions.
2. **Every current registry tracks subcomponents or single defects, not the whole product.** Subcomponents pass their local checks while whole-product properties drift without an alarm. These properties include system unification, real-window frame budgets, main-game reachability, and agent context-window size.

---

## 2. What Agora gets right

### 2.1 Safeguards built from real incidents

Many core rules in `store.mjs` and `client-runtime.mjs` come from recorded incidents in `tools/agora/WORKFLOW_GAPS.md`:

- **Scoped agent identity (`2026-07-04` collision incident and `WF-G344`, filed `2026-09-21`).** Every CLI registration requires `AGORA_AGENT_ID` and a unique live pet slug from `GET /pets`. `AGENTS.md` and `PROTOCOL.md` also require `--session` provenance for all Codex identities and all `orchestrator` or `master` roles. This stops two agents from sharing one local token file and releasing each other's locks with `unlock --mine`.
- **Seats versus sessions (`PROTOCOL.md`).** A session ends when an agent exits, while a seat stays with the owner across sessions. The `attended` field shows whether a live session holds the campaign seat.
- **Immutable client releases (`client.mjs` and `client-release.mjs`).** Workers load a hashed release snapshot under `.agent/agora/`. Edits to `client-runtime.mjs` do not break concurrent workers in the middle of a wave.
- **Local file recovery (`WF-G260`, `lockSnapshots.mjs`).** The client saves a baseline snapshot of dirty files when it grants a lock. An agent can run `lock --restore` or `unlock --revert` to undo its own edit without `git checkout`, which protects uncommitted peer work.

### 2.2 Deadlock is designed out

Section 5 of `tools/agora/CO-ORCHESTRATION.md` removes classic deadlock ingredients through five rules:

1. **Atomic lock acquisition.** A `POST /locks` request grants all requested paths in one call or conflicts without granting any path.
2. **Everything expires.** In `tools/agora/store.mjs`, presence becomes `stale` after 10 minutes (`presenceTtlMs = 600000`). Locks expire after 30 minutes by default, and renewals preserve the lock's original duration (`WF-G110`). Silent agents are reaped at 60 minutes (`presenceDropMs = 3600000`), or 120 minutes while holding an active task (`WF-G4`), and heartbeat-only presence expires 2 hours after the last meaningful call (`heartbeatOnlyLeaseMs = 7200000`).
3. **Queue, do not spin.** When a lock conflicts, an agent takes a FIFO reservation (`lock --queue`) with inbox notifications (`WF-G297`) instead of running a retry loop.
4. **Takeover only on gone.** A successor can re-claim a campaign ID only when the prior owner is `gone`, never while the owner is `online` or `stale`.
5. **Never wait while holding.** Agents must release locks before waiting on an asynchronous command-channel reply. This fifth rule relies on agent discipline.

### 2.3 One owner per fact kind

`tools/agora/PLANNING-STACK.md` assigns one authoritative home to each fact kind:

- Spec files own design decisions.
- `public/planmap/topics.json` owns curated feature status.
- The Agora board owns active work items and claims.
- `GAPS.md` files own defect intake.

Three one-way reconcilers keep projections aligned with those homes.

---

## 3. Where Agora strains under its own weight

| File | Size on 2026-10-22 | Role | Primary strain |
|---|---:|---|---|
| `tools/agora/WORKFLOW_GAPS.md` | about 680 KB | Workflow defect registry and archive | One 17-column Markdown table holds 72 active-table rows at initial snapshot (73 with `WF-G357`) and 281 archived rows plus long proof notes. Daemon `POST /gaps` serializes writes without an Agora lock (`WF-G113`), while `WF-G180` and `WF-G206` added Windows open retries; full-file rewrites still rewrite all ~680 KB and produce large diffs, and `gapIndex.mjs` parses only the first table. |
| `tools/agora/client-runtime.mjs` | 219.7 KB | CLI implementation monolith | Hot lock target during Agora maintenance waves. Contains duplicate client-side fallback logic for un-restarted daemon features (comment near line 269). |
| `tools/agora/store.mjs` | 168.2 KB | Daemon state store and journal | Single file combines presence, locks, reservations, seats, tasks, campaigns, and freshness views. |
| `tools/agora/ORCHESTRATOR.md` | 143.6 KB | Fleet coordinator guide | Contains 20+ specialized JSON and AST preflight schemas. |
| `tools/agora/orchestrate.mjs` | 118.8 KB | Wave planner and dispatcher | Couples partition checks, prompt generation, CLI launches, and verification gates in one file. |
| `tools/agora/PROTOCOL.md` | 115.3 KB | HTTP API reference | Mixes wire-protocol tables with historical incident logs. |
| `tools/agora/taskLint.mjs` | 92.4 KB | Task body static checker | Large rule engine for prose and metadata tags inside task descriptions. |
| `tools/agora/AGENT.md` | 61.4 KB | Single-agent guide | Requires every worker to load 25+ specialized metadata rules on cold start. |

### 3.1 Context-window tax in the agent guides

Steps 2 and 4 of `tools/agora/AGENT.md` list more than 25 specialized metadata contracts: `COUNT-REVIEW`, `TITLE-TARGET`, `SYMBOL-CHECK`, `SOURCE-MEMBERS`, `SOURCE-CITATION`, `TYPE-PREMISE-UNVERIFIED`, `CREATES`, `CREATED`, `DISCOVER`, `DATA-EDIT`, `ACTION-WIRING`, `UNION-CHANGE`, `SHARED TYPE DEPENDENCIES`, `PRODUCTION-CALLER`, `MOUNT POINTS`, `RUNTIME-LIMITATION`, `VALUE-EQUIVALENCE`, `COUNT-SOURCE`, `SHARED CONTROL CHANGE`, `SUPERSEDED BY RULING`, `CAPABILITY CLAIM CORRECTION`, `VISUAL-HANDOFF`, `AUDIT SCOPE CORRECTION`, `DEDUP-ACCEPTANCE`, and `TEST BASELINE`.

`WF-G302` scopes task-campaign advice by role, and `client.mjs onboard` prints a brief orientation summary, but generated worker prompts in `orchestrate.mjs` and cold-start rules in `AGENTS.md` still tell agents to read `AGENT.md` and `ORCHESTRATOR.md`. A typical task packet uses one or two of these contracts, yet every cold-start reader of `AGENT.md` loads all 25 rules.

### 3.2 Partially manual preflight transcription

Static checkers such as `unionConsumerOwnership.mjs`, `actionWiring.mjs`, `productionCallerOwnership.mjs`, and `mountOwnership.mjs` catch real integration gaps. Some evidence capture is already automated: `captureUnchangedUnionContext` (`ORCHESTRATOR.md` line 392) and the `source-review` command (`ORCHESTRATOR.md` line 820) read source files and compute SHA-256 digests directly. However, orchestrators still transcribe exact `quote` strings, `unionChanges` member lists, `actionWiring` role quotes, and `productionCallers` chains by hand into plan JSON. Manual transcription of exact quotes by an LLM causes avoidable preflight failures.

### 3.3 Client and daemon drift (`pending_restart`)

The CLI publishes new code immediately through `client-release.mjs`. The daemon (`server.mjs`) runs in memory until the operator approves a restart. To pass acceptance before a daemon restart, workers write duplicate GET-only fallback logic in `client-runtime.mjs` (for example, `taskFreshness.mjs` in `WF-G285`).

---

## 4. Why 353 workflow gap IDs and 431 global gap rows did not flag this growth

No telemetry currently measures how much of Agora's file growth or agent context cost comes from any single cause. Alongside verified rules such as `WORKFLOW_GAPS.md` Hard rule 9 and the 16 guide-reading test lines below, five structural hypotheses consistent with the observed `WF-G` examples explain why the gap loop did not flag cumulative growth:

1. **The gap loop inspects single packets, not system trends.** Workers file a `WF-G` row when a single step fails during a task. Each cold-start agent runs for one session only. It does not know that `AGENT.md` grew from a short guide to 61.4 KB over hundreds of sessions.
2. **The resolution recipe locks prose into the main guides.** Many `WF-G` repairs add a code guard, append a rule section to `AGENT.md`, `ORCHESTRATOR.md`, or `PROTOCOL.md`, and add a unit test that checks those files for the `WF-G` identifier. Running `(Select-String -Path "tools/agora/*.test.mjs" -Pattern 'AGENT\.md|ORCHESTRATOR\.md|PROTOCOL\.md').Count` returns **34 guide-name reference lines across 11 `*.test.mjs` files**: **16 guide-reading prose-check lines across 5 test files** (`controlNotice.test.mjs`, `deletionChecklist.test.mjs`, `orchestrate.test.mjs`, `scopeNotice.test.mjs`, and `visualAcceptance.test.mjs`, several looping over all three guides) plus **18 fixture-path, doc-serving, or comment lines across 6 test files** (`client.test.mjs`, `mdRender.test.mjs`, `packetOwnership.test.mjs`, `server.orchestration.test.mjs`, `server.seats.test.mjs`, and `store.test.mjs`). Moving specialized rules into separate files breaks those 16 guide-reading checks unless the tests change at the same time.
3. **Bad task output is visible, while context tax is silent.** An unmounted component or a stale count produces a visible defect on the board. Context-window dilution produces no error message. When an agent overlooks a rule buried in a 61.4 KB file, the team files a new `WF-G` row that adds another paragraph to the same file.
4. **Disjoint file packets discourage structural splits.** `orchestrate.mjs` requires non-overlapping file lists across concurrent packets. Appending a function to `client-runtime.mjs` fits a narrow packet. Splitting `client-runtime.mjs` or `AGENT.md` into smaller modules requires a wave-wide pause on the hottest files in `tools/agora/`.
5. **Explicit archive retention rules (`WORKFLOW_GAPS.md` Hard rule 9) keep all historical rows in one file.** Hard rule 9 of `tools/agora/WORKFLOW_GAPS.md` forbids deleting resolved rows and keeps the 281 archived rows and long proof notes inside the ~680 KB file (likely reinforced by the repository's general expansion-first bias in `AGENTS.md`).

---

## 5. The missing lens: whole-product coherence versus subcomponents

Every current tracker in Aralia records subcomponents, features, or single defects:

- **Project `docs/projects/*/GAPS.md` files** track defects in one domain.
- **`tools/agora/WORKFLOW_GAPS.md`** tracks friction in one workflow command or check.
- **`public/planmap/topics.json`** tracks individual features under a topic.
- **`docs/projects/GLOBAL_GAPS.md`** uses the same single-defect table format as project gap files. In practice, it serves as an inbox for subcomponent bugs that lack a local project folder (for example, `GG-409` for rock-foot foam coordinates in Round 15, or `GG-425` for a single-tile normal array diff after brush undo).

Although `WF-G176`, `WF-G186` (`adoption`), and `WF-G188` (declared-symbol reachability) added optional checks to `validate-planmap.mjs`, those fields only check features where an author opted in. No surface continuously measures standing invariants across the integrated product as a whole.

### 5.1 Whole-product failures that subcomponent checks missed

- **Five separate water systems (`GG-341` and `docs/adr/0006-one-water-one-surface.md`).** The FFT ocean, beach swash, river reach, LAND-page water, and game-world rivers each passed their own packet checks. As a product, Aralia had five incompatible water systems that could not meet at a river mouth until a human ordered ADR 0006.
- **5 FPS on the live river page and 14 FPS on the ocean river-mouth page (`GG-426` in `docs/projects/GLOBAL_GAPS.md`, line 27).** Individual ocean rounds checked their local frame-time delta in a `1600x900` capture at `dpr 1` (about 16 ms). Across rounds, cumulative shader readers, octaves, and compute passes pushed the ocean river-mouth page in a `2071x1833` window at `dpr 1.5` to 14 FPS (69 ms mean frame, 2.04M triangles, and 50 textures). The 2026-10-20 amendment in `GG-426` notes that the 5 FPS readout was on the live seven-falls river page (`step=water&river=1&live=1&riverCourse=references&rw=1&rd=1&rq=12`), and proposes a real-window gate of `2560x1440` at `dpr 1.5` under 16.7 ms.
- **Historical lag between a resolved decision and whole-codebase adoption (`WF-G176` and `WF-G181`).** When `WF-G176` and `WF-G181` were filed, the deterministic dice contract (`rollContract.ts`) had been marked `RESOLVED` on the Plan Map since `2026-07` while adoption stood at `2 of 145` production roll sites (`143 of 145` still called `Math.random()`). Task `agora-f821.4` (`2026-09-20`, recorded in `public/planmap/topics.json` lines 6056 and 6070) later migrated all 143 remaining sites across 78 files to `src/systems/dice/rollers.ts` over `DiceAuditLog` (`145 of 145` adopted, with 4 files reaching it through a forwarding export in `combatUtils`).
- **Preview-sandbox isolation.** Complex systems pass visual checks in `/Aralia/misc/design.html?step=...` preview pages while no standing measurement tracks whether the main playable game loop mounts and executes them.

---

## 6. Recommended improvements (proposals for owner decision)

Canonical prioritized plan: see [`docs/architecture/agora-system-review.md`](./agora-system-review.md#agreed-implementation-plan) ("Agreed implementation plan", agreed on Agora in `seq 7694` to `7743`) for the single proposed execution order (`P0` to `P3`), the Aralia-wide whole-product lens track, acceptance checks (`C1` to `C5`), and owner gates across all three reviews.

### 6.1 Upgrade the Agora control plane

1. **Inject specialized rules on demand.** Keep `tools/agora/AGENT.md` to the core 5-step loop (target: 4 KB to 8 KB, subject to owner approval). Move the 25+ specialized contract playbooks (`UNION-CHANGE`, `ACTION-WIRING`, `PRODUCTION-CALLER`, `VISUAL-HANDOFF`, `DATA-EDIT`) into modular files under `tools/agora/rules/`. Make `task show`, `task lint`, and `orchestrate.mjs prompt` print only the rules for markers present on that task. Update the 16 guide-reading test checks (out of 34 matching lines in `tools/agora/*.test.mjs`) to read the modular rule set.
2. **Extend existing capture helpers (`orchestrate.mjs prepare`).** Extend the pattern of `captureUnchangedUnionContext` (`ORCHESTRATOR.md` line 392) and `source-review` (`ORCHESTRATOR.md` line 820) so a preparation command extracts draft `quote` strings, union `members`, `actionWiring` role quotes, and `productionCallers` chains into the draft plan JSON. Never auto-refresh an already-reviewed semantic verdict (`ORCHESTRATOR.md` line 393); leave `reason` and review fields for the orchestrator to author.
3. **Pair an archive file split with a `--history` search mode.** Finding F2 of `docs/deepdives/agora-product-review.md` shows that `gapIndex.mjs` parses only the first table in `WORKFLOW_GAPS.md` (72 rows at initial snapshot, 73 with `WF-G357`) and ignores the 281 archived rows. Ship a `--history` search mode in `gapIndex.mjs` and `client.mjs gap search` first to fix that proven discovery gap, and then move the 281 archived rows into `tools/agora/WORKFLOW_GAPS_ARCHIVE.md` on `gap resolve` to reduce rewritten bytes per append (neither `WF-G180` nor `WF-G206` proves that file size caused Windows sharing failures, so any contention improvement requires measurement).
4. **Support hot-reloadable stateless route handlers.** Keep HTTP sockets, SSE streams, and journaled state in `server.mjs`, and allow stateless query routes and computed views to reload from a published runtime snapshot. Store schema and journal reducer changes still require a coordinated daemon restart.
5. **Separate three edit-boundary options.** The 2026-06-27 design spec (line 56) stated `Claude-Code hooks: None`, and the `guardGit.mjs` `PreToolUse` hook on `Bash` already changed that stance once. Separate three distinct mechanisms for owner decision:
   - **(a) Refuse edits when another live agent holds the lock.** `tools/agora/lockGuard.mjs` (`checkAgoraLock`) already enforces this in `planmap-add.mjs` and `planmap-reconcile.mjs`. Adding a `PreToolUse` hook on `Write`, `Edit`, and `MultiEdit` with that same check widens coverage of an existing rule without changing the advisory policy.
   - **(b) Require the editor to hold its own lock before writing.** This changes the cooperative advisory policy and requires an explicit owner decision plus a solo or offline mode.
   - **(c) Add passive `fs.watch` observation (`TRAIL-OBSERVABILITY.md`).** This provides post-write attribution and unattributed-touch warnings for external CLIs rather than pre-write blocking.
6. **Split `client-runtime.mjs` and `store.mjs` by domain.** Separate locks, tasks, gaps, seats, and campaigns into distinct source files that `client-release.mjs` bundles into one release.

### 6.2 Proposal: track four whole-product coherence lenses in existing truth homes

In accordance with `AGENTS.md` ("Where knowledge goes") and `tools/agora/PLANNING-STACK.md` (and consistent with Section 4 of `docs/deepdives/agora-product-review.md`), do not create a fourth editable status registry. Instead, route each part of whole-product coherence to its existing authoritative home:

- **Standing promises and contracts** live in living domain docs (`docs/architecture/domains/agent-coordination.md` for Agora, and domain docs under `docs/architecture/domains/` for game systems).
- **Curated feature and outcome status** stays in `public/planmap/topics.json`.
- **Automated measurements and candidate budget checks** run in `tools/agora/sync-surfaces.mjs` and report in `public/planmap/health.json`.

The table below proposes four whole-product measurement lenses for owner review. All numeric thresholds (such as 16.7 ms frame time, 8 KB guide size, or 100 KB active gap file size) are provisional candidates that require explicit owner approval before acting as blocking gates:

| Proposed lens | What it tracks across the whole repo | Proposed check in `sync-surfaces.mjs` and `health.json` |
|---|---|---|
| **1. Unification ledger ("One system")** | Cross-cutting domains (Water, Terrain, Dice, Lighting, Save and State, Modals, Agent Coordination): names the one canonical ADR or domain contract and counts rival or legacy implementations in `src/`. | AST and import counters (for example, `2 of 5 water systems on oceanSurface.ts` as an active target, or `145 of 145 dice roll sites on rollers.ts` after `agora-f821.4` with 4 files via the `combatUtils` forwarding export as a completed baseline). |
| **2. Carrying-capacity budgets (provisional)** | Real-window runtime targets (`2560x1440` at `dpr 1.5` frame time of 16.7 ms or less, VRAM ceiling, draw-call ceiling, cold ready time) and Agora control-plane size targets (`AGENT.md` at 8 KB or less, active `WORKFLOW_GAPS.md` at 100 KB or less). | Perf receipts (`window.__araliaPerf.report()`) and file-size counters in `health.json` (advisory until thresholds are approved by the owner). |
| **3. Critical product seams** | Boundaries where subsystems meet: *River Reach to River Mouth to FFT Ocean*, *Town to Volume Bubble to 3D Land*, and *Agora CLI to Running Daemon*. | Seam integration test status and the live `pending_restart` count. |
| **4. Playable loop reachability** | Whether each major system is mounted and reachable from the main playable game entry (`App.tsx` and game state) versus isolated inside `design.html` preview pages. | Static import-graph reachability from main game entry points plus a named entry-to-behavior runtime test witness (static imports alone do not prove playable reachability). |
