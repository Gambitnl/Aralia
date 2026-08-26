# Agora Orchestrator Playbook

**Audience:** an orchestrator agent (a Claude session, or you) that wants to run a
multi-agent fix/build campaign across the Aralia repo using **three systems together**:

1. **Agora board** (`tools/agora/`) — the peer-coordination bus: presence, file **locks**,
   task board, messaging. This is how a fleet of agents works the SAME checkout without
   clobbering each other. API: [`PROTOCOL.md`](./PROTOCOL.md). Single-agent instructions:
   [`AGENT.md`](./AGENT.md). Worker loop:
   [`.claude/skills/agora-coordination/SKILL.md`](../../.claude/skills/agora-coordination/SKILL.md).
2. **Agent matrix** — the heterogeneous fleet you dispatch: in-process Claude subagents
   (the `Agent` tool) **plus** external CLIs (codex, gemini, …). The live operator cockpit
   that visualizes/dispatches the external fleet is a separate app on `http://127.0.0.1:3040`
   (`misc/agent_matrix.html` → `Aralia-operator-dashboard`); Agora mirrors its events into
   that cockpit's activity feed.
3. **Planning surfaces** — where the work backlog lives:
   - **Plan Map** (`public/planmap/`) — the live roadmap-capture surface; append topics/features
     there (task refs use `planmap:<topic>/<feature>`).
   - **Roadmap** (`devtools/roadmap/`) — the generated node graph (capability-doc → manifest →
     generator → UI).
   - **Project tracker** (`docs/projects/PROJECT_TRACKER.md` + per-project `GAPS.md`/`TRACKER.md`)
     — DEPRECATED but still live; being absorbed into the Plan Map by the planning-surface-freshness
     campaign. Read it, but log new planning gaps against Plan Map / Roadmap.
   Ad-hoc issue logs (e.g. `.agent/scratch/ux-pass/ISSUES.md`) are another work source.

This file is the missing link that ties them together. Read `PROTOCOL.md` for exact API
details; read this for **how to run a campaign**. When a second orchestrator is live, read
the pact, [`CO-ORCHESTRATION.md`](./CO-ORCHESTRATION.md) — ownership, lock etiquette,
conflict resolution, escalation, seats and the unattended-closure path.

---

## 0. One-time / per-session startup

```bash
# 1. Start the Agora daemon (single source of truth; bridge → cockpit feed is on by default)
npm run agora                       # node tools/agora/server.mjs, port 4319
# 2. Confirm it's up + see the live dashboard
curl -s http://localhost:4319/health        # {"ok":true,...}
#    Dashboard:  http://localhost:4319/      (presence / locks / tasks / message feed)
#    Cockpit:    http://127.0.0.1:3040/agent_matrix.html  (external fleet + the Agora activity bridge)
# 3. Register yourself as the orchestrator (own identity key so you don't clobber a worker's)
export AGORA_AGENT_ID=orchestrator
node tools/agora/client.mjs pets
node tools/agora/client.mjs register orchestrator --role orchestrator --pet <chosen-pet-slug> --session <your-task-or-thread-id> --note "campaign coordinator" --url http://localhost:4319
```

**You own identity allocation for the fleet.** Use `client.mjs pets` to prefer an available
pet slug for yourself and every worker packet. Every worker you dispatch MUST also get a unique
`AGORA_AGENT_ID` — use its packet handle (`validatePlan` already enforces handle uniqueness,
and the daemon 409s a duplicate live handle, so this is belt-and-braces). Pet uniqueness is a
store invariant: if a requested pet becomes occupied before registration, Agora assigns the next
free identity and the client reports it. Inspect `client.mjs agents` before dispatch continues;
stop if a row lacks a pet or if two live rows share one `pet.slug`. Workers self-check `whoami`
against the returned assignment, not merely the originally requested slug.
A worker never invents its own name; you hand it one. This is what stops two workers in the
one shared checkout from sharing an identity and having `unlock --mine` free each other's
locks. `orchestrate.mjs`'s generated prompts put `AGORA_AGENT_ID=<handle>` on every Agora
command, starting with register; for PowerShell they set `$env:AGORA_AGENT_ID` in the same
call. A separate shell does not inherit the previous export. If you hand-write a worker
prompt, include the same scope on the register call and every later call. The client now
refuses unscoped registration by default, including in a fresh checkout (WF-G344).

**Stamp the model at launch.** You know which model each worker is before it starts, so its
register line carries `--model <model>` (generated prompts use `pkt.model || pkt.agent`). That
puts the model on the roster (`client.mjs agents` shows `[model]`) so a human — or you — can see
what each lane is running. A Codex worker must report its own task/thread id with
`--session <id>`; orchestrator/master roles must always do so regardless of runtime. The
daemon rejects missing required provenance before Presence, and both values surface in
`whoami` and `GET /agents`.

`.agent/agora/` (the daemon's snapshot/journal + per-agent identity files) is **gitignored**
so a sibling's `git reset --hard` can't nuke live coordination state.

---

### Seed under the identity you already hold (WF-G172)

`orchestrate seed` used to register `orchestrator-<wave>` every time. An orchestrator that
had ALREADY registered its own handle then owned TWO live presence rows for one session:
presence, campaign ownership and the seeded tasks' `creatorAgent` split across them, a later
`unlock --mine` or `retire` under one handle left the other's claims and locks orphaned, and
the roster over-reported the fleet size.

THE RULE, and `seedPlan` now applies it:

- When `AGORA_AGENT_ID` names a LIVE agent on this board whose role is `orchestrator` or
  `master`, seed coordinates as that identity and registers nothing. It prints which identity
  it reused and why.
- Only when no such identity is set does seed register a fresh `orchestrator-<wave>` handle
  in its own per-wave identity directory.

So: register yourself ONCE, export `AGORA_AGENT_ID`, and seed every wave of that session
under it. Do not register a second orchestrator handle by hand.

## 0a. Arm event-driven Codex wake and desktop surfacing

Agora can wake a dormant Codex task without private desktop injection. Register the exact
technical thread UUID against the version-matched one-shot adapter:

```powershell
node tools/agora/watchdog.mjs register-target `
  --handle <agora-handle> --agent <agora-agent-id> --callsign <callsign> `
  --adapter codex-session-turn-once --session <codex-thread-uuid> `
  --cwd F:\Repos\Aralia --grace 120000
```

The target announces `CALLSIGN DORMANT` before its harness goes idle. A later human command,
direct message, or exact `@callsign` mention makes the watchdog resume one turn using the saved
session's matching Codex engine and last successful model. Only after that child exits cleanly
does the watchdog open `codex://threads/<thread-uuid>`, which brings the same saved task forward
in the desktop app. The `WAKE-AUDIT` completion message reports `surface=desktop-thread-opened`.

The terms **conversation id**, **session id**, **task id**, and **thread id** all refer to that
same technical UUID in this workflow. The deep link is only the desktop address for that UUID;
it does not send a prompt. `/app` is also not an unattended wake command: it hands the currently
open interactive CLI session to the desktop app. Do not run simultaneous CLI and desktop turns
on one UUID; the watchdog waits for the one-shot CLI turn to finish before opening the app.

---

## 0b. Multi-orchestrator governance

Before authoring a wave, inspect active campaign ownership:

```bash
node tools/agora/client.mjs campaigns
```

If no active lead owns your file domain, `orchestrate seed <plan>` claims a lead campaign for
you before it creates packet tasks. If an active lead already overlaps your scope, either stop
and coordinate with that lead, or create a deputy plan with explicit boundaries:

```json
{
  "wave": "ui-deputy-window-frame",
  "pet": "gf-sd",
  "campaign": {
    "id": "ui-deputy-window-frame",
    "role": "deputy",
    "leadCampaignId": "ui-playtest",
    "scope": "WindowFrame-only follow-up lane",
    "paths": ["src/components/ui/WindowFrame.tsx"]
  },
  "packets": [
    {
      "id": "PK-window-frame",
      "handle": "window-frame-deputy",
      "pet": "dream-girl",
      "agent": "claude",
      "scope": "Fix WindowFrame lane only",
      "files": ["src/components/ui/WindowFrame.tsx"]
    }
  ]
}
```

Deputies may overlap their named lead. Rival leads over the same files fail at seed time.

## The runnable harness — `orchestrate.mjs`

The deterministic mechanics of the loop below are codified in
[`orchestrate.mjs`](./orchestrate.mjs) so you drive a wave by command instead of hand-writing
the coordination contract for every agent. A **PLAN** (JSON) declares the wave's packets; the
harness validates **disjointness** (refuses a plan where two packets share a file — the safety
invariant) and unique handles, then generates prompts, seeds the board, dispatches external
agents, and runs the gate.

```bash
npm run agora                                              # daemon up (once)
node tools/agora/orchestrate.mjs partition plan.json       # check claimed tasks against packet file ownership
node tools/agora/orchestrate.mjs seed     plan.json        # register orchestrator + announce the wave
node tools/agora/orchestrate.mjs prompt   plan.json PK-x   # the ready coordination contract for a packet…
node tools/agora/orchestrate.mjs dispatch plan.json PK-x   # …claude => writes prompt for the Agent tool; codex/gemini => probes quota + launches in bg
node tools/agora/orchestrate.mjs status   plan.json        # board snapshot (agents/locks/tasks)
node tools/agora/orchestrate.mjs gate     plan.json --exclude "_stubService"   # typecheck, filter to wave files, baseline delta, PASS/FAIL
node tools/agora/orchestrate.mjs feedback plan.json        # dump the WORKFLOW: messages to iterate the loop
```

PLAN shape (see [`example-plan.json`](./example-plan.json)):
```json
{ "wave": "name", "pet": "orchestrator-pet-slug", "baseUrl": "http://localhost:4319", "baseline": 219,
  "campaign": { "id": "optional-non-roadmap-override", "role": "lead", "scope": "one-line orchestrator scope" },
  "packets": [
    { "id": "PK-x", "handle": "fix-x", "pet": "worker-pet-slug", "agent": "claude|codex|gemini",
      "scope": "one-line", "files": ["src/a.ts"], "refs": ["planmap:topic-id/feature-slug"], "guidance": "optional extra instructions" } ] }
```

**How it maps to the loop:** Step B (partition) produces the PLAN — the harness *enforces*
disjointness but you still author the packets. Steps C/D/E/F/G are the `seed` / `prompt` +
`dispatch` / `gate` / `feedback` / (visual, manual) commands. The one thing a script can't do
is **spawn Claude subagents** — for `agent: "claude"` packets, `dispatch` writes the prompt to
`.agent/scratch/orchestrate/<handle>.prompt.txt` and you launch it with the **`Agent` tool**
(`model: opus`); for `codex`/`gemini` it probes availability (quota-aware) and launches the CLI
in the background itself.

---

## 1. The campaign loop (the proven pattern)

This is the sequence that ran ~90 fixes across 5 waves with **zero lock conflicts**:

### Step A — Pick the work
From a planning surface — the Plan Map (`public/planmap/`), the Roadmap (`devtools/roadmap/`),
the deprecated project tracker (`docs/projects/PROJECT_TRACKER.md` → a project's `GAPS.md`), or an
issue log. Keep a running status ledger somewhere (a `FIX_PLAN.md` or a ledger at the top of
the issue log) so each wave's outcome is recorded.

### Step B — Partition into DISJOINT-FILE packets (the safety rule)
**The single hard rule: no two concurrently-running agents may edit the same file.** In one
shared checkout, parallel edits to one file clobber — locks are advisory, they don't *prevent*
a write, they only *signal*. So you pre-partition so locks rarely collide.

- Dispatch a **read-only partition/discovery agent first** (general-purpose or Explore, opus).
  Have it map each open item → the exact file(s) it touches, then group items into packets
  whose file sets are **disjoint**, and propose a **wave schedule** (items sharing a hot file
  go to ONE owner; conflicting packets go to a later wave). Have it write the plan to a file.
- Watch the **hot files** (one owner across ALL their items): in this repo the chronic
  chokepoints were `MapPane.tsx`, `World3DScene.tsx`, `World3DWrapper.tsx`,
  `groundChunkLoader.ts`, `townEngine.ts`, `AtlasSvgView.tsx`, the Log/`WorldPane.tsx`. When a
  feature's data + render span several files, either give one agent the whole chain or sequence
  the consumers after the producer.

Before seed or dispatch, run `node tools/agora/orchestrate.mjs partition plan.json`. List every
existing Agora task a packet claims in `taskIds`; a task ID in packet `issues` or `refs`
is checked too. The report reads the live task refs and flags every file path outside
the packet's `files`. Widen the packet when it should own the file. If another packet
owns the file, add a `handoffs` entry with `ref`, `toPacket`, and
`expectedBreakage` (and optionally `taskId`). The named sibling must own that exact
file; the worker prompt then states the expected effect and handoff. Missing tasks, duplicate
claims, unowned refs and stale handoffs fail before seed or dispatch changes board state.

For every owned `src/` source file, the partition check also finds existing co-located and
`__tests__/` sibling `*.test.*` or `*.spec.*` files with the same module name, plus
same-prefix tests that import that module (WF-G209).
Put those regression tests in the **same packet's** `files`, not a sibling handoff: the
worker must be able to update an obsolete expectation when its source change requires it.
The generated prompt and lock command then name both source and tests. A source-only
packet fails pre-dispatch instead of forcing the worker to preserve an outdated assertion.

This checks declared file refs, not where implementation actually belongs. Read each task
and confirm its refs name the files that must change; a ref to a comment about deferred work
does not establish ownership of the implementation file (WF-G239).

### Step C — Seed the wave ONTO the board (v0.2: the board IS the plan)
```bash
node tools/agora/orchestrate.mjs seed <plan.json>
```
`seed` first claims a campaign governance record, then creates packet tasks. For roadmap work,
packet refs like `planmap:<topic>/<feature>` are the preferred source: seed reads
`public/planmap/topics.json` and derives campaign id/scope from the topic's campaign key,
campaign label, title, and subtext. Explicit `plan.campaign.id` or `plan.campaignId` still
override for non-roadmap waves; packet files become the campaign paths unless
`plan.campaign.paths` or `plan.campaign.globs` broadens the scope. If another live lead
campaign overlaps, seed fails with a conflict and creates no packet tasks. To cooperate under
an existing lead, set `campaign.role` to `"deputy"` and name the lead with
`campaign.leadCampaignId`.

`seed` now creates **one board task per packet** — packet `priority` orders the ready queue,
packet `issues` become task `refs`, and packet `"after": ["PK-x"]` becomes a task dep so a
wave-2 packet only surfaces in `tasks --ready` once its producer is `done`. The packet→task
map lands in `.agent/scratch/orchestrate/seed-<wave>.json`, and `orchestrate prompt`/`dispatch`
inject each packet's task id into the worker prompt automatically (the worker CLAIMS its
seeded task instead of creating its own). The wave announcement is broadcast as before.
Every seeded task must show a non-null `creatorAgent` block for the orchestrator identity
that seeded it. If a hand-written or custom seeding flow produces a task whose creator is
missing, stop the wave and recreate the task after registering the orchestrator correctly.

#### Connected campaigns: umbrella lead + deputy pattern (WF-G152)

When seeding several connected clusters that share files, claiming multiple `lead` campaigns will fail with HTTP 409 because the daemon prevents active lead campaigns from overlapping paths. Instead, use the **umbrella lead + deputy** pattern:
1. Claim one broad **umbrella lead** campaign covering the entire sweep domain and all shared hot files.
2. Claim one **deputy** campaign per connected work cluster, setting `--role deputy --lead <umbrella-lead-id>`. Deputies are permitted to overlap their lead's path scope, allowing individual clusters to group related tasks without triggering 409 collisions.
3. Seed or file cluster tasks under their respective deputy campaign (`--campaign <deputy-id>`).

CLI recipe:
```bash
# 1. Claim umbrella lead
node tools/agora/client.mjs campaign claim agora-sweep-lead --role lead --scope "sweep umbrella" --path src/hotFile.ts src/cluster1.ts src/cluster2.ts

# 2. Claim deputies attached to the lead
node tools/agora/client.mjs campaign claim agora-cluster-1 --role deputy --lead agora-sweep-lead --scope "cluster 1" --path src/hotFile.ts src/cluster1.ts
node tools/agora/client.mjs campaign claim agora-cluster-2 --role deputy --lead agora-sweep-lead --scope "cluster 2" --path src/hotFile.ts src/cluster2.ts

# 3. File tasks under the deputies
node tools/agora/client.mjs task new "Cluster 1 fix" --campaign agora-cluster-1
node tools/agora/client.mjs task new "Cluster 2 fix" --campaign agora-cluster-2
```

In plan files passed to `orchestrate.mjs seed`, declare `plan.campaign.deputies[]` (each with `id`, `scope`, `paths`, and optional `globs` or `wave`). Seed claims the lead, claims all deputies attached to it, and routes packet tasks to their named `pkt.campaign`.

#### Lint every seeded body BEFORE you dispatch it (WF-G111, WF-G158, WF-G161, WF-G165, WF-G167)

```bash
for t in $(node tools/agora/client.mjs tasks --state open | grep -o "agora-[a-z0-9.]*"); do
  node tools/agora/client.mjs task lint "$t"
done
```

`task lint <id>` reads a task body and reports mechanically detectable defects before dispatch:

1. every **path-shaped token** in the title, body or refs that is not in this checkout (`missingPaths`);
2. every **backticked identifier** that does not grep anywhere under `src/` (`missingIdentifiers`);
3. every **bare source file name** checked across the repository (`missingFileNames`, WF-G158);
4. every **named test path** that does not exist on disk, reporting split test suite candidates (e.g. `combatUtils_*.test.ts` instead of `combatUtils.test.ts`) so vitest does not silently exit 0 on empty filters (`missingTestPaths`, WF-G167);
5. suspect **missing-schema claims** where a task claims "no schema" or "add a schema for X" when type X is already defined under `src/types/**` (`suspectSchemaClaims`, WF-G165);
6. **unresolved type fields** where a DO step names a type file as the source of fields that do not exist in that file (`unresolvedTypeFields`, WF-G161).

It also notes paths that DO exist but are gitignored, because a reader grepping the git
index will not find them and will wrongly call them missing (the GG-145 case).

It exits 1 when it finds anything, so it drops into a wave script directly. It never
refuses or rewrites a task: a body may legitimately name a file the task will CREATE. The
orchestrator's job is to fix the stale references and, for the rest, say in the body which
ones the task is going to create.

Why this is a step and not a nicety: on 2026-09-09, 14 of 40 expanded phase-2 task bodies
were stale or wrong about the code — files that do not exist, invented action names
(`TOGGLE_LEDGER_BOOK` never existed), systems that had already shipped. Workers spent up to
a third of each packet proving a negative, and a less careful worker rebuilds what exists.
Every one of those defects would have shown up here.

`task lint` checks references, not claims. It cannot tell you that a system already
shipped or that a described failure was never observed — for those, state in the body what
IS (file, line count, existing tests) and how the failure was observed.

##### The Grep-Before-Prescribing Rule (WF-G161, WF-G165, WF-G167)

Before writing task DO and ACCEPTANCE steps:
- **Grep `src/types/**` before claiming "no schema exists" (WF-G165)**: Avoid sending workers to create duplicate types or schemas when one already exists (or is re-exported from another type file).
- **Grep named fields in target files before prescribing them (WF-G161)**: If a DO step asserts that fields come from a specific type file, grep the file first. If absent, identify the real source (e.g. a sim state file) or explicitly record in EVIDENCE that the source is unresolved rather than asserting a false source.
- **Resolve test paths against the tree before writing verify gates (WF-G167)**: Vitest treats non-existent test file paths as empty filters and exits 0! Always confirm test paths exist on disk. If a monolithic test suite was split into smaller files, name the exact split files or containing directory.

##### Two-Sided TODO Sweep Lifecycle Contract (WF-G151)

When running a code-marker sweep (`TODO`, `FIXME`, `HACK`):
1. **The two-sided contract**: Every inventoried in-code marker MUST end in exactly one of three terminal dispositions:
   - **(a) A board task**: filed and prioritized as an actionable task on the Agora board.
   - **(b) Code deletion**: deleted from source code if already shipped, obsolete, or factually false.
   - **(c) An explicit in-code parked note**: `// TODO: parked YYYY-MM-DD: <reason>` placed directly at the marker site if deferred or out-of-scope.
2. **Staleness is judged by reading code, not Plan Map status**: Plan Map topic status can be lagging, coarse, or aspirational. Always inspect the code the marker names before classifying staleness.
3. **Full inventory completeness**: Sweeps must not triage only the top 5 largest clusters and ignore the scattered 1-per-file markers. Every inventoried marker must be explicitly resolved, tasked, or parked so the inventory is fully drained.

#### Reading a sibling task back (WF-G118)

`task show <id>` prints one task in full: body, refs, typed deps, claimant, result,
finding/evidence, blocked reason, checkpoint, and the last five history entries. Use it
instead of digging through `.agent/agora/snapshot.json` when a worker asks what a sibling
shipped. `tasks --state blocked` prints each blocked reason under its row.

### Step C2 — Post the wave baseline (WF-G132)
Before the first dispatch, run (or collect from the last wave) the test files the packets will touch,
and post the red list once with `say "WAVE BASELINE (<campaign>, <date>): <test file> <n> (<gap id>); ..."`.
Put the same list in the campaign scope or the packet bodies. A worker that meets one of those reds
cites the message; only a NEW red costs an A/B rerun against the pre-change file. Without this every
worker in the wave re-proves the same sibling breakage (agora-907c.7 spent a full restore-and-rerun).

### Step D — Dispatch the fix agents (each dogfoods Agora)
Every fix agent — Claude subagent OR external CLI — gets a prompt containing the **same
coordination contract**:
```bash
export AGORA_AGENT_ID=<unique-handle>     # MUST be unique per agent (see gotchas)
B=http://localhost:4319
node tools/agora/client.mjs register <handle> --pet <assigned-pet-slug> --session <worker-task-or-thread-id> --note "<scope>" --url $B
TID=$(node tools/agora/client.mjs task new "<scope>" --campaign <campaignId> --id-only --url $B)   # --id-only = bare id, no grep
# WF-G171: name a campaign, or say --standalone --reason "<why>". The daemon refuses a task
# that makes no campaign decision. A seed that must still create campaignless tasks runs
# against a daemon started with AGORA_CAMPAIGN_INTAKE=legacy.
node tools/agora/client.mjs task claim "$TID" --url $B
node tools/agora/client.mjs lock <every owned file> --reason "<packet>" --url $B   # 409 => STOP + report
node tools/agora/client.mjs say "starting <packet>" --url $B
#   ... edit ONLY the owned (and successfully-locked) files ...
node tools/agora/client.mjs say "done <packet>: <one-line>" --url $B
node tools/agora/client.mjs task done "$TID" --url $B          # alias for: task state <id> done
node tools/agora/client.mjs unlock --mine --url $B            # release ALL your locks
node tools/agora/client.mjs say "WORKFLOW: <friction with the workflow, or none>" --url $B
```
Bake these rules into every prompt: **edit only owned files**; **lock before editing, treat a
409 as a hard stop**; **do NOT run heavy commands** (`tsc`/`build`/`vitest`/dev-server) — N
agents thrashing the machine is worse than the orchestrator running ONE integration check
after; **check the claimed task has a real `creatorAgent` that matches the orchestrator or
registered creator before editing**; **report exact diffs + any cross-file follow-ups**; **end
with `WORKFLOW:` feedback**.

### Step E — Integration gate (orchestrator runs this, once per wave)
Workers skip heavy commands; you verify the merged result:
```bash
node node_modules/typescript/lib/tsc.js -b > /tmp/tsc.log 2>&1   # NOTE: `tsc` bin may be missing; call tsc.js directly
grep "error TS" /tmp/tsc.log | grep -E "<wave-touched-files>" | grep -v "<known-preexisting>"
grep -c "error TS" /tmp/tsc.log    # compare to the running baseline; should not rise
```
Filter to the wave's touched files and compare the **total** to the prior baseline (this repo
has a large pre-existing error baseline; judge by the *delta*, not zero). Fix any
fleet-introduced error yourself, re-check. Then do **visual** verification where it applies
(see Step G).

### Step F — Iterate the workflow loop
Read the `WORKFLOW:` messages (`client.mjs inbox` or the dashboard). Improve the
client/server/protocol/skill from real friction, log the iteration in `PROTOCOL.md`. (This
campaign shipped 3 iterations that way: `unlock <path>`/`--mine`, `task done`, `--id-only`.)

### Step G — Visual verification (the project's standing rule)
Eyeball every visual slice. Non-R3F UI: `preview_*` tools (start `dev`, navigate, screenshot —
the app base is `/Aralia/`, default port 5174). **R3F/3D scenes**: `preview_screenshot` hangs;
use the headless Playwright rigs in `.agent/3d-visual-quality/captures/` (battle map) or
`.agent/scratch/` (ground/atlas), driven by camera dev-hooks `window.__wf3dSetPose` /
`__bm3dCam`. Write throwaway proof PNGs to `.agent/scratch/` (gitignored).

---

## 2. The agent matrix — dispatching external agents

**The machine-readable registry is [`agents.json`](./agents.json)** — statuses, policy roles,
dispatch wiring, and date-bound constraints for every known agent. Consume it programmatically:

```
node tools/agora/orchestrate.mjs agents      # print the registry + expired-constraint warnings
```

`validatePlan` ENFORCES it: a packet whose agent is deprecated (gemini), orchestrator-only by
policy (codex), not supervision-ready, or not wired for dispatch **fails at plan time**, not
mid-campaign. When the operator dashboard's onboarding contract changes an agent's status,
update `agents.json` — it is the single source orchestrators trust.

Claude subagents (the `Agent` tool, `model: opus`) are the reliable default worker. Historic
CLI invocations (kept for reference; the registry carries the authoritative status):

| Agent | Non-interactive invocation | Notes |
|---|---|---|
| **codex** | `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "<prompt>"` | **Orchestrator/supervisor role ONLY by policy.** Hits a usage quota that resets ~2am — probe first. |
| **gemini** | `gemini --approval-mode yolo -p "<prompt>"` | **DEPRECATED for new lanes** — registry rejects it; historical sessions kept for audit. |
| **cursor** | `cursor-agent.cmd -p "<prompt>"` (versioned path, see agents.json) | WIRED. Pin the versioned `versions/<stamp>` path: a Cursor update writes a new folder. |
| **kilo** | `kilocode` per `agents.json.dispatch` | WIRED. 429-prone: sandbox the lane and fix forward. |
| **agy** | dashboard prompt-file runner per `agents.json.dispatch` | WIRED, but NOT through `orchestrate dispatch`: `promptMode` is "file", so `launchSpec` refuses it without a prompt file. Dispatch it through the dashboard runner. |

**External-agent gotchas (learned the hard way):**
- **Quota check before dispatch.** Codex returns "hit your usage limit" when dry. Probe with a
  1-line prompt or check the cockpit's `/api/agent-usage`; fall back to gemini or Claude.
- **External agents honor `.gitignore`** → they CANNOT read prompt context placed under
  gitignored `.agent/scratch/` (e.g. `ISSUES.md`, `FIX_PLAN.md`). **Inline the full spec** in
  the prompt instead of pointing them at a scratch file.
- **PowerShell host:** separate Bash calls don't share env vars, and `$(...)` is awkward — tell
  external agents to set `AGORA_AGENT_ID` inline on each call or chain with `;`.
- They still must follow the Agora contract (register/lock/release/WORKFLOW) — give them the
  same coordination block, and **scope them to isolated single-purpose files** (lower blast
  radius if they stray). **Verify their output yourself** (typecheck + diff review) — they're
  less steerable than Claude subagents.

The cockpit (`:3040`) is where a human watches the whole fleet; the Agora activity bridge means
your peer-coordination events show up there alongside external dispatches automatically.

### OrcaRouter free tier — evaluated 2026-09-08, DO NOT WIRE

**Conclusion first: do not point the CLI coding fleet at the OrcaRouter free tier.** The free
tier applies a per-request PROMPT SIZE cap. A coding agent sends source files, the docs say a
long document exceeds that cap, and no amount of waiting helps. The account balance is $0.00,
so only the free tier is reachable. Nothing is wired.

**The 429 rule — the least obvious fact, and the one an implementer must not miss.** Every
free-tier rejection returns HTTP 429 with code `free_rate_limited` and an identical message.
Only the `Retry-After` header tells the two causes apart.

- **429 WITH `Retry-After`** — a rate window is full. Wait exactly that many seconds, then retry
  ONCE. Do **not** back off exponentially: a free window refills completely at its boundary
  rather than easing back, so exponential backoff is actively wrong here — the opposite of
  normal quota guidance.
- **429 WITHOUT `Retry-After`** — the prompt exceeded the free tier's cap. **Never retry.** The
  docs say "Retrying unchanged fails identically, forever."

**What it is.** An OpenAI-compatible gateway fronting 40+ providers behind one key and one endpoint. The base URL was not captured in this pass — read it from the console; do not guess.

**Model ids.** The console catalog on 2026-09-08 showed `deepseek-v4-flash-free` (deepseek),
`hy3-free` (tencent), `glm-5.3-flash-free` (z-ai). The docs page instead lists
`deepseek/deepseek-v4-flash-free` and `deepseek/deepseek-v4-pro-free`. The two lists disagree;
the docs say the catalog is the source of truth, because free capacity changes as models come
and go. Prefer the built-in router alias **`orcarouter/free`**: it covers the whole free tier
under one id, scores each request's difficulty, sends light work to the smaller free model and
hard work to the stronger one, never escapes to paid, and removes the need to chase name
changes by hand.

**Three caps.** (1) Requests per minute and per day, counted per workspace; the day bucket rolls
at 00:00 UTC. (2) The tier is set by LIFETIME spend, not a subscription — an account that never
topped up gets a deliberately small daily allowance, and one modest top-up lifts it permanently.
(3) Below the spend threshold only, the per-request prompt size cap above. Marketing shows "10
requests/min, 50/day" free and "20/min, 800/day" after $20 lifetime spend; the docs contradict
that, saying the limits are tuned live and none is published. Docs win; marketing is indicative.

**Fallback.** A free id works as the PRIMARY model of a request, but a free id further down an
`extra_body.models` chain is DROPPED. Free never rolls over to paid. That agrees with this
repo's NO-FALLBACK DIRECTIVE in `src/config/llmProviderConfig.ts` lines 28-37.

---

## 3. Agora client cheat-sheet (full API in PROTOCOL.md)

```
pets                            register <handle> --pet <slug> [--note]      whoami        agents
lock <path...> [--ttl min]      unlock <id|path> | --mine | <id> --force       locks
campaign claim <id> [--role lead|deputy] [--lead <id>] [--path <p>...] [--glob <g>...]
campaign state <id> done|blocked|active     campaigns [--state active]
task new <title> (--campaign <id> | --standalone --reason "...") [--dep <id>...] [--priority N] [--ref <gapId>...] [--id-only]
task campaign <id> (<campaignId> | --standalone) --reason "..."     move a task between campaigns (WF-G169)
task claim <id>    task next [--id-only]    task done <id> --result "<what+proof>"
task handoff <id> <to>    tasks [--ready]
say <body> | say --to <h> <body>     inbox [--since <seq>] [--mine]     watch     health
```
- All client calls default to `http://localhost:4319` (the `--url` in examples is optional).
- `AGORA_AGENT_ID` (or a unique `AGORA_DIR`) scopes THIS agent's stored identity — it MUST be
  unique per agent, or `unlock --mine` releases another agent's locks.

**Orchestration on the board (new in v0.2):**
- **Campaign ownership lives on the daemon now**: inspect `campaigns` before planning, and let
  `orchestrate seed` claim a lead/deputy campaign before packet tasks are created. Rival lead
  overlap fails before seeding; deputies must name the lead they are joining.
- **Sequencing lives on the daemon now**: create wave-2 packets with `--dep <wave1-taskId>` —
  they only surface in `tasks --ready` / `task next` when every dep is `done`. `--priority`
  orders the ready queue. No more hand-sequencing in plan JSON.
- **Graph recipes (diamond + checker)**: seed dep-free leaves for parallel work, converge
  with `--dep`, and gate poisonous output behind a checker task. The playbook — fake-edge
  test, diamond rules, five-check checker node, static vs dynamic, board reading — is
  [`GRAPH-ENGINEERING.md`](./GRAPH-ENGINEERING.md).
- **Worker-pull waves**: instead of assigning packets, seed N prioritized tasks and tell each
  worker to loop `task next` → work → `task done <id> --result "<files + proof>"`. The board
  balances the load.
- **Results live on tasks**: require `--result` in your worker prompts; read outcomes from
  `tasks` (done tasks print their result) instead of scraping `say` messages.
- **Crash recovery is automatic**: a worker silent past the drop horizon (60 min) is reaped —
  locks freed, its claimed tasks reopened for the next `task next`. For a stale-but-not-dead
  holder blocking a file, `unlock <lockId> --force` (refused while the holder is online).
- **Tracker bridge**: tag tasks with `--ref <project>:<gapId>` (use the EXACT Gap ID from the
  registry — e.g. world3d uses `W3D-G5`-style ids); intake work from the tracker with
  `node tools/agora/gapIndex.mjs --open-only` (all open GAPS.md rows as JSON; `--summary`
  for per-project counts). Close the loop after the wave:
  `orchestrate reconcile <plan>` lists every done-task ref whose GAPS.md row is still open
  (with the recorded result as evidence) — update those rows or dispute the result.
- **Wave lifecycle**: `orchestrate watch <plan>` blocks until every seeded task is
  done/blocked and prints the collected results; `orchestrate report <plan>` is the
  retrospective (per-packet time-to-done, reap counts, results).
- **Fresh agents**: assign a catalog pet and task/thread id, then point them at `client.mjs onboard <handle> --pet <slug> --session <id>` (one-shot registration +
  situational briefing + the rules; `--gaps` adds tracker intake) — also now in AGENTS.md, so
  even un-prompted agents can find the front door. Long workers use the 30-minute bounded
  `client.mjs heartbeat --every 600` helper, ideally with `AGORA_OWNER_PID` or
  `--owner-pid <pid>`, and re-run it only while work remains active. Even `--forever` cannot
  extend heartbeat-only presence past the server's 2-hour lease.
- **Workflow friction goes in [`WORKFLOW_GAPS.md`](./WORKFLOW_GAPS.md)** — the durable,
  structured registry for gaps in the workflow ITSELF (hard row schema in the file; same
  table format as project GAPS.md, so `gapIndex.mjs --root tools/agora` parses it). A
  `say "WORKFLOW: ..."` message that matters should ALSO become a row there; tag fixing
  tasks with `--ref workflow:WF-G<n>`. Every new row names one `Suggested agent` using an
  exact `agents.json` key, plus the registrant's exact Agora handle, full agent UUID, and
  task/thread ID from `client.mjs whoami`. Generic labels such as `orchestrator` are roles,
  not provenance, and must not be written in `Registered by`.

---

## 4. Hard rules & gotchas (the things that bite)

- **Shared tree, no worktrees/branches** (when that's the directive): the disjoint-file
  partition + lock-before-edit is the ONLY thing preventing clobber. Honor it religiously.
- **Claim campaign scope before seeding.** A second lead over the same files must stop on the
  campaign conflict or join as a deputy with explicit boundaries; do not bypass the conflict by
  renaming the wave.
- **Unique identity per agent.** The identity file is keyed by daemon URL only, so two agents
  sharing it overwrite each other's token AND `unlock --mine` from one releases the other's
  locks (bit us 2026-07-04: a vegetation agent released a prop agent's 5 locks mid-edit).
  Preferred fix: export `AGORA_AGENT_ID=<handle>` — the client then stores identity in
  `client-identity.<handle>.json`. A unique `AGORA_DIR` per agent
  (`.agent/agora/ids/<handle>`) also still works.
- **Locks are advisory** (no Claude-Code hooks): nothing physically blocks an edit. Value comes
  from agents choosing to lock-and-check + the human dashboard catching collisions.
- **`node --test tools/agora/` is broken** on Node 22.19 — use the glob: `node --test "tools/agora/*.test.mjs"`.
- **The `tsc` bin may be missing** from `node_modules/.bin` even when TypeScript is installed —
  call `node node_modules/typescript/lib/tsc.js -b` directly.
- **`node_modules` may be incomplete** (missing transitive deps like `@babel/core`,
  `@alloc/quick-lru`) → the dev server won't compile; run `npm install` to repair (it's
  non-invasive — reconciles to the lockfile). The dev server is also flaky under the preview
  MCP; restart it (`preview_stop`/`preview_start`) and expect a ~30–60s cold compile.
- **Don't commit unless asked** — this repo auto-snapshots to GitHub at 2am; leave work in the
  tree. `docs/projects/` and `.agent/agora|scratch/` are gitignored.
- **Scale the fleet to the ask.** A handful of agents for a small wave; a partition pass +
  10–13 agents for a broad sweep. External agents only when you've confirmed they're available.

---

## 5. Pointers

- API + worker etiquette + iteration log: [`PROTOCOL.md`](./PROTOCOL.md)
- Cold-start worker loop (a Skill): `.claude/skills/agora-coordination/SKILL.md`
- Discovery beacon: the "🏛️ The Agora" section of `docs/projects/PROJECT_TRACKER.md`
- Design/rationale: `docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md`
- Worked example of a full campaign: `.agent/scratch/ux-pass/{ISSUES.md (status ledger), FIX_PLAN.md, X1_INVENTORY.md, X5_INVENTORY.md}`
