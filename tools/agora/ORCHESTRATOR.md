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
3. **Project tracker** — the work backlog: `docs/projects/PROJECT_TRACKER.md` (gitignored,
   local) is the durable inventory; per-project `GAPS.md`/`TRACKER.md` hold the open items.
   Ad-hoc issue logs (e.g. `.agent/scratch/ux-pass/ISSUES.md`) are another work source.

This file is the missing link that ties them together. Read `PROTOCOL.md` for exact API
details; read this for **how to run a campaign**.

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
node tools/agora/client.mjs register orchestrator --note "campaign coordinator" --url http://localhost:4319
```

**You own identity allocation for the fleet.** Every worker you dispatch MUST get a
unique `AGORA_AGENT_ID` — use its packet handle (`validatePlan` already enforces
handle uniqueness, and the daemon 409s a duplicate live handle, so this is belt-and-braces).
A worker never invents its own name; you hand it one. This is what stops two workers in the
one shared checkout from sharing an identity and having `unlock --mine` free each other's
locks. `orchestrate.mjs`'s generated prompts already bake `export AGORA_AGENT_ID=<handle>`
into STEP 1 — if you hand-write a worker prompt, include it yourself.

**Stamp the model at launch.** You know which model each worker is before it starts, so its
register line carries `--model <model>` (generated prompts use `pkt.model || pkt.agent`). That
puts the model on the roster (`client.mjs agents` shows `[model]`) so a human — or you — can see
what each lane is running. A worker may also self-report its own conversation id with
`--session <id>`; both surface in `whoami` and `GET /agents`.

`.agent/agora/` (the daemon's snapshot/journal + per-agent identity files) is **gitignored**
so a sibling's `git reset --hard` can't nuke live coordination state.

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
node tools/agora/orchestrate.mjs seed     plan.json        # register orchestrator + announce the wave
node tools/agora/orchestrate.mjs prompt   plan.json PK-x   # the ready coordination contract for a packet…
node tools/agora/orchestrate.mjs dispatch plan.json PK-x   # …claude => writes prompt for the Agent tool; codex/gemini => probes quota + launches in bg
node tools/agora/orchestrate.mjs status   plan.json        # board snapshot (agents/locks/tasks)
node tools/agora/orchestrate.mjs gate     plan.json --exclude "_stubService"   # typecheck, filter to wave files, baseline delta, PASS/FAIL
node tools/agora/orchestrate.mjs feedback plan.json        # dump the WORKFLOW: messages to iterate the loop
```

PLAN shape (see [`example-plan.json`](./example-plan.json)):
```json
{ "wave": "name", "baseUrl": "http://localhost:4319", "baseline": 219,
  "campaign": { "id": "optional-non-roadmap-override", "role": "lead", "scope": "one-line orchestrator scope" },
  "packets": [
    { "id": "PK-x", "handle": "fix-x", "agent": "claude|codex|gemini",
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
From the project tracker (`docs/projects/PROJECT_TRACKER.md` → a project's `GAPS.md`) or an
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

### Step D — Dispatch the fix agents (each dogfoods Agora)
Every fix agent — Claude subagent OR external CLI — gets a prompt containing the **same
coordination contract**:
```bash
export AGORA_AGENT_ID=<unique-handle>     # MUST be unique per agent (see gotchas)
B=http://localhost:4319
node tools/agora/client.mjs register <handle> --note "<scope>" --url $B
TID=$(node tools/agora/client.mjs task new "<scope>" --id-only --url $B)   # --id-only = bare id, no grep
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
| cursor / kilo / agy | onboarded per the dashboard contract, not yet wired into `orchestrate dispatch` | wire `dispatch.command/args` in agents.json + a `launchSpec` branch before first use. |

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

---

## 3. Agora client cheat-sheet (full API in PROTOCOL.md)

```
register <handle> [--note]      whoami        agents
lock <path...> [--ttl min]      unlock <id|path> | --mine | <id> --force       locks
campaign claim <id> [--role lead|deputy] [--lead <id>] [--path <p>...] [--glob <g>...]
campaign state <id> done|blocked|active     campaigns [--state active]
task new <title> [--dep <id>...] [--priority N] [--ref <gapId>...] [--campaign <id>] [--id-only]
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
- **Fresh agents**: point them at `client.mjs onboard <handle>` (one-shot registration +
  situational briefing + the rules; `--gaps` adds tracker intake) — also now in AGENTS.md, so
  even un-prompted agents can find the front door. Long workers keep presence with
  `client.mjs heartbeat --every 600` in the background.
- **Workflow friction goes in [`WORKFLOW_GAPS.md`](./WORKFLOW_GAPS.md)** — the durable,
  structured registry for gaps in the workflow ITSELF (hard row schema in the file; same
  table format as project GAPS.md, so `gapIndex.mjs --root tools/agora` parses it). A
  `say "WORKFLOW: ..."` message that matters should ALSO become a row there; tag fixing
  tasks with `--ref workflow:WF-G<n>`.

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
