# Agora Orchestrator Playbook

**Audience:** an orchestrator agent (a Claude session, or you) that wants to run a
multi-agent fix/build campaign across the Aralia repo using **three systems together**:

1. **Agora board** (`tools/agora/`) — the peer-coordination bus: presence, file **locks**,
   task board, messaging. This is how a fleet of agents works the SAME checkout without
   clobbering each other. API: [`PROTOCOL.md`](./PROTOCOL.md). Worker loop:
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
# 3. Register yourself as the orchestrator (own identity dir so you don't clobber a worker's)
export AGORA_DIR=.agent/agora/ids/orchestrator
node tools/agora/client.mjs register orchestrator --note "campaign coordinator" --url http://localhost:4319
```

`.agent/agora/` (the daemon's snapshot/journal + per-agent identity files) is **gitignored**
so a sibling's `git reset --hard` can't nuke live coordination state.

---

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
  "packets": [
    { "id": "PK-x", "handle": "fix-x", "agent": "claude|codex|gemini",
      "scope": "one-line", "files": ["src/a.ts"], "issues": ["X1"], "guidance": "optional extra instructions" } ] }
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

### Step C — Announce on the board
```bash
node tools/agora/client.mjs say "WAVE N dispatching: <packets>. Each agent lock-before-edit, own files only." --url http://localhost:4319
```

### Step D — Dispatch the fix agents (each dogfoods Agora)
Every fix agent — Claude subagent OR external CLI — gets a prompt containing the **same
coordination contract**:
```bash
export AGORA_DIR=.agent/agora/ids/<unique-handle>     # MUST be unique per agent (see gotchas)
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
after; **report exact diffs + any cross-file follow-ups**; **end with `WORKFLOW:` feedback**.

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

Claude subagents (the `Agent` tool, `model: opus`) are the reliable default. To **leverage the
external fleet**, invoke their CLIs non-interactively from Bash (run in background, log to a
file, poll/await):

| Agent | Non-interactive invocation | Notes |
|---|---|---|
| **codex** | `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "<prompt>"` | Proven workhorse. **Hits a usage quota** that resets ~2am — probe first; fall back when dry. |
| **gemini** | `gemini --approval-mode yolo -p "<prompt>"` | Works for contained tasks. Do NOT also pass `-y` (conflicts with `--approval-mode`). Do NOT use `-w` (would make a worktree). |
| qoder / agy / opencode / kilo / copilot | installed but not reliably non-interactive here | the matrix/cockpit can drive them; from a headless orchestrator, prefer codex/gemini. |

**External-agent gotchas (learned the hard way):**
- **Quota check before dispatch.** Codex returns "hit your usage limit" when dry. Probe with a
  1-line prompt or check the cockpit's `/api/agent-usage`; fall back to gemini or Claude.
- **External agents honor `.gitignore`** → they CANNOT read prompt context placed under
  gitignored `.agent/scratch/` (e.g. `ISSUES.md`, `FIX_PLAN.md`). **Inline the full spec** in
  the prompt instead of pointing them at a scratch file.
- **PowerShell host:** separate Bash calls don't share env vars, and `$(...)` is awkward — tell
  external agents to set `AGORA_DIR` inline on each call or chain with `;`.
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
lock <path...> [--ttl min]      unlock <id|path> | --mine       locks
task new <title> [--id-only]    task claim <id>    task done <id>    task handoff <id> <to>    tasks
say <body> | say --to <h> <body>     inbox [--since <seq>] [--mine]     watch     health
```
- All client calls default to `http://localhost:4319` (the `--url` in examples is optional).
- `AGORA_DIR` controls where THIS agent's identity is stored — it MUST be unique per agent.

---

## 4. Hard rules & gotchas (the things that bite)

- **Shared tree, no worktrees/branches** (when that's the directive): the disjoint-file
  partition + lock-before-edit is the ONLY thing preventing clobber. Honor it religiously.
- **Unique `AGORA_DIR` per agent.** The identity file is keyed by daemon URL, so two agents
  sharing `AGORA_DIR` overwrite each other's token. Use `.agent/agora/ids/<handle>`.
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
