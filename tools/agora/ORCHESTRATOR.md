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

### Reconcile overlapping completion counts (WF-G285)

Before dispatch, run `task show`, `task lint` and the relevant ready listing.
They check the whole live board, including other campaigns, for file-reference
overlap with completion events at or after the unfinished task's creation.
Treat `COUNTS UNVERIFIED` as a request to remeasure, not a replacement estimate.
Read the sibling's result and reconcile the original brief with current files.
Record exact `COUNT-REVIEW` notes using the [agent instructions](./AGENT.md#recheck-shared-file-counts-before-work-wf-g285).
Review records are authored evidence, not automated verification or ownership.
Later completion receipts invalidate earlier reviews for that new work.

Missing history, failed full-board reads or bounded overflow stay unavailable,
not fresh. Finished task records needed by an unreviewed sibling are retained
by archival. Existing already-archived history is not reconstructed. Exact file
refs are required; the view does not infer semantic impact, expand directory
refs or glob patterns, or grant permissions. Do not publish guessed counts or
silently mark missing historical evidence as resolved. The immutable CLI also
computes this view for an older daemon; source/API behavior is deployed only at
the next separately authorized daemon restart. Do not restart it for this check.

### Publish client repairs safely

`client.mjs` is the stable entry for both existing worker commands and
orchestrator imports. Client implementation work belongs in `client-runtime.mjs`.
Keep feature edits out of the entry and publisher while a fleet is using them.
The publisher snapshots the runtime, root helper, identity policy, gap helpers,
task linter and usage text as one hashed release under ignored `.agent/agora/`.
If a new local dependency is added, include it in `RELEASE_FILES` and verify it
before dispatching workers that need it.

The tooling owner must lock the source files, review the changes, and run the
affected tests before running `node tools/agora/client-release.mjs publish`.
This command checks syntax, imports, the public API and unchanged source bytes;
it does not prove every command's behavior. Then rerun the stable-entry tests
and inspect `node tools/agora/client-release.mjs status`. A failed publication
leaves the previous release selected. Commands already running remain pinned
to their original release; subsequent processes get the new one. Do not remove
old releases while detached heartbeats may use them.

A clean clone without a selected release bootstraps from one committed HEAD
revision, never current dirty source. A missing committed dependency or damaged
release fails closed with owner guidance. Before these new files are committed,
this checkout relies on its explicitly published local release. Do not claim
clean-clone recovery from the current HEAD until the full file set is recorded.
The launcher never retries a board command after a runtime error: that could
duplicate a task, message or gap already sent to the daemon.

### Distinguish Tracking Text From Ownership (WF-G212)

The lock client can identify added sweep-format tracking-marker lines when the
complete bounded text otherwise matches `HEAD` after line-ending normalization.
This names the task citations, not the author or a semantically harmless edit.
Keep the worker's file and task read; an extra Git diff is not needed for that
advisory check. Mixed edits, deletions, new files and unavailable comparison
evidence retain ordinary preservation advice. Never suppress dirty work because
no active lock exists, or infer who wrote it from current or historical claims.
Atomic conflicts still grant nothing. This requires a published client repair,
not a daemon restart or an annotation write to game code.

### Keep owner decisions discoverable

File owner choices as `human-decision` tasks and hands-on requests as
`human-action` tasks. Record a precise question, options and tradeoffs, the
affected work, and its authoritative source link. Keep campaign membership and
provenance. Use a human blocked reason and link dependent work with typed
blocking dependencies rather than duplicating the question across tasks.

The dashboard's `/dashboard/decisions.html` page gathers these records and
legacy explicit human blockers. It is read-only, not an approval channel.
Reconcile recorded owner answers back to the original task or question sheet.
Do not mark implementation done just because a ruling arrived. Recheck old
requests before asking the owner to make a choice that may already be settled.

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

## 0a. Arm event-driven wake in the existing Codex app

**Status: native Codex app wake qualified on 2026-10-24.** Two consecutive app-owner
queue turns completed without a human restart or duplicate launch. Codex and Claude
independently passed all 40 strict receipt checks; 50 focused source checks also pass.
See the [durable proof excerpt](../../docs/architecture/agora-system-review.md#native-two-resume-qualification-passed).
Keep qualification separate from always-on operation: services remain bounded, the
adaptive schedule is open in agora-437d.11, and WF-G361 tracks a separate in-flight
human-message question.

For a reviewed native queue deployment, register the app-owned chat as follows:

```powershell
node tools/agora/watchdog.mjs register-target `
  --handle <agora-handle> --agent <agora-agent-id> --callsign <callsign> `
  --adapter codex-app-queue --session <codex-thread-uuid> `
  --cwd F:\Repos\Aralia --grace 120000
```

The target announces `CALLSIGN DORMANT` before its first idle handoff. A later direct message,
human command, or exact `@callsign` mention is queued once using the running app owner's Codex
build. The existing app process runs the turn. No separate CLI executor resumes the thread.

Queue exit 0 means stored input. Delivery needs the matching app turn and target AWAKE;
automatic re-arm needs that queue-triggered turn's real completion. An unresolved enqueue stays
held rather than being sent repeatedly. The model can finish without posting another DORMANT.

Use `codex-session-turn-once` only for suitable CLI-owned sessions. An app-owned thread can
retain its writer while idle; the earlier CLI bridge failed that live test. Opening
`codex://threads/<thread-uuid>` focuses the chat but does not deliver input.

Run one bounded service for the selected target only:
`node tools/agora/watchdog.mjs run --handles <agora-handle> --for <minutes>`. It holds a
single-service lock and refuses a second live service. PROTOCOL.md "Dormant orchestrator wake
bridge" explains idle gates, owner binding, audit evidence, unresolved enqueues and guarded
stale-lock repair. Two completed native rounds must pass `wakeQualification.mjs` before the
adapter is reported as qualified for that chat.

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

### Packet Verification Contracts

Name the exact focused commands in `guidance`. Ordinary packets use
`npm run typecheck:files -- <owned paths>`; piping a full compile through grep
does not make it scoped (WF-G208). A full typecheck is refused before seeding
unless the packet has `verificationScope: "repository"` and a nonempty
`verificationReason` naming the explicit operator authorization. These fields
do not widen file ownership. Existing guidance/forbidCommands contradictions
still fail validation.

For visible UI work, declare the running local surface separately (WF-G213):

```json
{
  "visualProof": {
    "url": "http://localhost:4319/dashboard/decisions.html",
    "acceptance": "The reference disclosure stays open after board refresh."
  },
  "forbidCommands": ["dev-server"]
}
```

This permits a bounded browser attachment and one ignored, private screenshot,
not starting, restarting or stopping a server or running a full build. Only
credential-free loopback HTTP(S) URLs are accepted. Inspect the rendered image;
DOM state alone is not visual acceptance. A missing surface or missing proof
is a blocker, not completion. UI-file packets without a URL explicitly ask for
one before rendered acceptance can be claimed.

Wrap-up prompts now include complete conditional workflow feedback commands.
Workers search before filing and replace every placeholder with evidence.
The recipe includes `--suggested-agent` from `agents.json` (or
`human-operator`), `--proof`, a repair-component `--surface`, and task provenance
in `--detected-during` (WF-G215/WF-G216). Surface is an open component namespace,
not a task-ID field. The generated Notes field retains the detection task;
workflow Task/thread remains the authenticated registrant session. Do not file
empty template rows when no friction occurred.

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
- **Resolve presumed surfaces before implementation (WF-G333).** Do the scoped
  source search yourself or in that read-only pass. A sentence such as
  `discover: the settings UI component` is not an owned filename. Name the real
  files, or retain the scoped absence evidence and make an explicit parent-owned
  placement decision before assigning exact new paths. Trace the actual caller
  and prop/state chain too; a leaf UI file alone may not ship the behavior.
  Preserve future intent without telling an implementation worker to invent its
  own screen or lock scope. An unresolved product-location decision stays blocked
  for its owner, not delegated as implicit permission to choose.
- Keep helper scripts and proof private per wave and worker. Generated prompts use
  `.agent/scratch/orchestrate/<wave>/<handle>/`, with encoded path segments and an
  ignore check. Do not replace this with a common external scratchpad. External
  scratch needs absolute file URL imports for repo packages, not a change of cwd.
  Point workers to [the living capture guide](./AGENT.md#private-scratch-and-capture-helpers),
  not to a guessed dated capture file. The scratch location does not widen file
  ownership or authorize a dev server or additional checks.
- Watch the **hot files** (one owner across ALL their items): in this repo the chronic
  chokepoints were `MapPane.tsx`, `World3DScene.tsx`, `World3DWrapper.tsx`,
  `groundChunkLoader.ts`, `townEngine.ts`, `AtlasSvgView.tsx`, the Log/`WorldPane.tsx`. When a
  feature's data + render span several files, either give one agent the whole chain or sequence
  the consumers after the producer.

Before seed or dispatch, run `node tools/agora/orchestrate.mjs partition plan.json`. List every
existing Agora task a packet claims in `taskIds`; a task ID in packet `issues` or `refs`
is checked too. The report reads the live task refs **and body paths** and flags every file path outside
the packet's `files`. Widen the packet when it should own the file. If another packet
owns the file, add a `handoffs` entry with `ref`, `toPacket`, and
`expectedBreakage` (and optionally `taskId`). The named sibling must own that exact
file; the worker prompt then states the expected effect and handoff. Missing tasks, duplicate
claims, unowned refs and stale handoffs fail before seed or dispatch changes board state.

Partition reports and generated CLI `prompt`/`dispatch` packets include a live
lock observation (WF-G330): each lock ID, holder ID, every path and glob, reason,
lease expiry, and fetch time. Do not replace that list with a worker's theme.
Each queued packet refreshes the observation immediately before launch and
refuses overlaps on its own files; sibling locks on disjoint files do not stop it.
An observation is advisory, not a reservation or edit grant. Workers must still
re-read locks and acquire their own. Pure `buildPrompt` calls without a supplied
snapshot explicitly say the lock state is unknown; offline supplied data is not
labeled live. A lease expiry is not permission to retire a holder or edit its work.

### Own Changed Union Consumers (WF-G282)

Before editing an owned top-level finite string union, record its exact current
source identity and intended member delta. A same-named union elsewhere is not
the same contract. Forward imports alone do not identify reverse consumers.

Only the actual source-owning packet declares a member delta; a consumer cannot
delegate that declaration while its owner calls the union unchanged. Wave-level
unchanged reviews must not contradict any declared change to that identity.

Packet `unionChanges` contains records with `id`, exact `file`, `symbol`, unique
current `quote`, ordered current `members`, distinct `added` and `removed`,
concrete `reason`, and `otherUsesReview`. Additions must be absent now; removals
must be present now. At least one member must change. `otherUsesReview` records
the parent's assessment of sparse tables, subsets, value-position uses and other
callers. It is not a generated no-change verdict. Required additional edits can
be declared as `consumerEdits: [{ file, quote, reason }]`; this does not own them.

Every finite union in an owned existing source needs either a change record or
an explicit current unchanged review. Packet `unionReviews` uses
`{ file, symbol, quote, members, reason }`. A type catalogue can instead use
`{ file, quote, symbols, hash, reason }`, where `hash` is SHA-256 of the exact
decoded UTF-8 source, including line endings. `captureUnchangedUnionContext`
captures bytes for an already-authored assessment. Never auto-refresh a review
to pass preflight or treat a test fixture's unchanged premise as production proof.

Partition resolves source symbols across the current `src` inventory, including
ignored preview files, tests, aliases, barrels, namespaces and inline imports.
Direct `Record<ChangedUnion, Value>` requires an owning packet. `Partial` is
sparse; `Required<Partial<...>>` restores the exhaustive obligation. A union in
a Record's value position does not require a key-table edit. A literal typed
array listing every current member requires ownership; subset samples do not.
The report lists these observations separately from other type references.

Own each required consumer deliberately or declare an exact handoff to its
actual owning sibling. Companion tests, tracked declarations and ignored test
homes remain required. Record blocking order and combined acceptance with the
parent. The checker never widens `files`, takes locks, launches a worker or
declares sibling integration complete. Re-read current locks before editing.

Seed, prompt and dispatch retain reference-only `UNION-CHANGE:` / `UNION-REVIEW:`
JSON and the self-check policy. Recorded task declarations must match the plan.
Dropped, conflicting, stale, unsupported or incomplete premises refuse before
writes or worker launch. `task lint` excludes quoted metadata from implicit edit
paths; it is not the reverse-consumer verifier. Reconcile with the parent rather
than deleting metadata or rewriting game types to fit the checker.

This is bounded source-symbol inspection, not application typechecking, emitted
code, executed game behavior, complete JavaScript flow or runtime acceptance.
Only direct top-level finite string unions are supported. Relevant transformed
keys, mapped tables, generic/indirect table aliases, shadowed utilities and
unresolved local Record keys require manual reconciliation. The parent remains
responsible for all affected semantic behavior and actual integration proof.
Limits: 16 records / 8192 bytes per packet; 128 members or grouped symbols;
8192 source files / 128 MiB total / 16 MiB per inventory file; 32 million AST
visits; 16 alias links; 4096 consumer observations. Ordinary source anchors keep
the 2 MiB limit. Concurrent source rewrites refuse rather than refresh evidence.

### Audit Action Delivery Owners (WF-G237)

Before changing a UI action or reducer payload, audit the complete intended
route. An owned reducer and `AppAction` member are not enough. UI actions also
need their emitter, `src/types/actions.ts` union and metadata, and
`src/hooks/actions/actionHandlers.ts`. Payload changes need their builder and
caller. Not every reducer action comes through the UI registry.

Packets declare `actionWiring`, with one object per affected route:

```json
{
  "id": "inventory-route",
  "kind": "ui",
  "action": "MOVE_ITEM_TO_CONTAINER",
  "relation": "existing",
  "reason": "Preserve item and container delivery across the current UI route.",
  "payloadFields": ["itemId", "containerId"],
  "metadataExpectation": { "isUiToggle": true },
  "roles": {
    "stateType": { "file": "src/state/actionTypes.ts", "quote": "<unique current source quote>", "change": true },
    "reducer": { "file": "src/state/reducers/characterReducer.ts", "quote": "<unique current source quote>", "change": true },
    "uiType": { "file": "src/types/actions.ts", "quote": "<unique current source quote>", "change": true },
    "metadata": { "file": "src/types/actions.ts", "quote": "<unique current source quote>", "change": true },
    "handler": { "file": "src/hooks/actions/actionHandlers.ts", "quote": "<unique current source quote>", "change": true },
    "emitter": { "file": "src/components/CharacterSheet/Overview/InventoryList.tsx", "quote": "<unique current source quote>", "change": true }
  }
}
```

The quotes above are placeholders, not usable proof. Read the current files and
replace each quote. `change: true` adds an edit obligation to partition's existing
ownership and handoff checks. Own that file deliberately or name the exact
owning sibling with `handoffs`; the declaration never adds it to `files` or
acquires a lock. Required companion tests and declarations remain required.
Sibling delivery stays incomplete until its task and the combined integration
have actual proof. Record real blocking dependencies and order with the parent.

`kind: "payload"` instead requires `stateType`, `reducer`, `builder`, and `caller`
roles, a nonempty `payloadFields` list, and `builderExport`. For example,
`createBattleEndActions` builds enemy outcomes consumed by the state route;
inspect its actual action name rather than assuming every outcome is
`END_BATTLE`. `stateAction` may name a different reducer action for a UI mapping.
Payload routes must not invent an unrelated UI metadata obligation.

Each role has exact `file`, unique current `quote`, and boolean `change`.
A genuinely read-only role uses `change: false` with a concrete `reason` saying
why its contract remains unchanged. Do not label a needed sibling edit read-only
to pass preflight. `relation: "planned"` retains current context anchors but is
not existing delivery proof. An exact new planned source can use
`newFile: true`, `change: true`, and a creation `reason`, with no `quote`; its
absence and physically contained parent are checked. Existing files cannot be
called new. Keep explicit creation intent and the worker's own lock.

Core reducer and `src/state/actionTypes.ts` packets must cover each owned core
source with affected routes. For changes that do not affect wiring, use
`actionWiringReview: { "reason": "<reviewed unchanged-contract assessment>",
"sources": [{ "file": "<exact owned core source>", "quote": "<unique current quote>" }] }`
instead. It cannot be combined with changed routes. This is a parent's reviewed
assessment, not an automatic semantic no-change verdict.

Partition, seed, prompt and dispatch check current declarations before writes or
launch. Recorded task routes must match the plan; missing, conflicting or stale
guidance needs parent reconciliation, not silent deletion. Durable briefs and
all worker prompts retain reference-only declarations and the self-check rule.
`task lint` does not replace this packet gate or certify action delivery.

Existing-route checks use bounded TypeScript syntax: one direct `AppAction`
member and reducer case, declared payload fields/accesses, UI union and literal
metadata flags, direct handler `dispatch`, an emitter call, or a named exported
payload builder constructing fields and a direct imported caller (aliases are
resolved). Comments and strings do not establish these syntax facets. These
checks do not prove reachability, branch coverage, the values being forwarded,
complete data flow, all callers, semantic preservation or rendered behavior.
Barrels, delegated handlers, computed actions, spreads hiding payload fields,
external types and other unsupported forms require an explicit parent audit;
do not rewrite game code merely to satisfy this checker. Planned declarations
must never be presented as proof of an existing unsupported route.

Limits: 16 routes and 8192 UTF-8 bytes of declarations per packet, 64 source
files, 2 MiB per contained regular strict UTF-8 file, 4096 bytes per unique quote,
32 payload field identifiers and 200000 AST nodes per traversal. Limit failures
are incomplete evidence. Authors remain responsible for covering every affected
action; arbitrary English intent is not inferred. Preserve file, command,
approval and verification boundaries.

### Own The State-Holding Production Caller (WF-G255)

Before assigning "wire A into B", trace B's production callers until the
game-state source is reached. Own that caller and every required intermediate
file, with its companion tests, or pre-file a separate dependent integration
task. Owning and testing a pure reader alone does not deliver game behavior.
The historical combat and dialogue hooks are already wired in the current
tree; this rule is not permission to change them again.

Declare `productionCallers` on the packet. Each route has an `id`, current
`module` (`file`, exported `symbol`, unique `quote`), a nonempty `callers`
chain, `state` and a parent `review` explaining why this is the nearest
state-holding caller. Each caller names `file`, exported `symbol`, current
`quote`, `relation` (`existing` or `planned`), `reason`, and `delivery`
(`owned` or `deferred`). The last caller is the declared state owner.

For example, the current dialogue service's `buildNpcDialoguePromptContext`
export is called by `src/hooks/useDialogueSystem.ts#useDialogueSystem`.
The caller receives canonical `GameState`; its reviewed `state` record names
`field: "npcMemory"`, the unique quote containing that typed parameter,
`relation: "existing"` and the reason the full state reaches the builder.
The combat hook instead reads the canonical optional game-state context.
Use current exact quotes, not historical line ranges or guessed hook names.

Partition, seed and dispatch reject recognized explicit wiring instructions
without this audit. They also recheck live task declarations, so a vague new
packet cannot drop an existing task's route. Seeded briefs and all worker
prompt variants retain the exact `PRODUCTION-CALLER` records. This is a
conservative instruction check, not a parser for every possible English
request. Authors must declare every affected chain, not only phrases the
checker recognizes.

Queued CLI launches re-read source and live task records when their slot opens.
Changed seeded metadata, completed follow-ups or lost blocking dependencies stop
that launch rather than reusing the earlier preflight. Markdown emphasis and
function-call notation do not remove an explicit wiring obligation.

An `existing` link requires current direct exported functions and an
unshadowed runtime import/call, including supported aliases and namespace
calls. The state anchor must show either a canonical typed `GameState`
parameter or a supported canonical context field read in the declared
caller. Comments, type-only imports, unrelated functions and fake local
state types cannot establish those clues. A typed parameter proves the
caller holds state, not that every field reaches the intended calculation.
The parent must still review field delivery, nearest-owner choice and
behavior. Dynamic, indirect or unsupported chains stay unverified.

For a future link in current source files, `planned` keeps the current
anchors and reviewed reason but makes no existing call or field-flow claim.
Planned work remains incomplete acceptance. Do not relabel a false existing
claim as planned merely to pass preflight. Current file/quote evidence is
required by this check; unavailable or not-yet-created sources need explicit
parent reconciliation rather than invented evidence.

`owned` requires each caller in this packet's files. `deferred` requires an
unowned caller and its exact `followUpTask`. Before seed or dispatch, that
task must be current and unfinished, keep the caller as an edit obligation
and `refs` entry, and have a blocking dependency on a current build task in
this packet and the same campaign. Use these exact two lines, substituting
the declared paths, symbols and state field:

```text
PRODUCTION-FOLLOWUP: src/hooks/useDialogueSystem.ts#useDialogueSystem delivers GameState.npcMemory
REFERENCE-ONLY: PRODUCTION-SOURCE: src/services/dialogueService.ts#buildNpcDialoguePromptContext
```

The source module is read context for its caller's follow-up, not an extra
edit grant. Generic sibling handoffs, completed follow-ups and nonblocking
links do not satisfy this contract. Deferred integration stays unfinished;
do not hide it in a done result. Each later packet needs its own locks and
all existing ownership, declaration, test and acceptance checks.

The observation is bounded to 16 routes, eight callers per route, 64 source
files and 65,536 bytes of declarations. It reads source without evaluating
game code. It is not a complete call graph, semantic data-flow analysis,
gameplay proof or permission to launch workers or restart the daemon.

### Expose Shared Type Owners (WF-G228)

Read partition's `SHARED TYPES` observation before dispatch. For each owned source,
the scoped syntax audit lists imported type contracts, their source/symbol evidence,
declaring paths, planned packet owners and observed lock holders. It resolves aliases,
named/local re-exports, barrels, namespace imports and type-import expressions without
executing source or running a project typecheck. Ordinary imports of exported
interfaces, type aliases, classes and enums are candidates too. Explicit type imports
whose declarations cannot be identified keep that qualification rather than inventing
a declaration. Seeded briefs and both worker variants retain reference-only evidence.
Their observation excerpt is capped at 8192 UTF-8 bytes to avoid oversized task-new
shell arguments. A marked partial excerpt requires the parent to supply the full
current partition report before a worker relies on omitted evidence; collected
partition evidence itself is not trimmed.

`self`, `sibling`, `unassigned` and `ambiguous` describe this plan's ownership declarations,
not an agent's live claim. A type import does not imply a needed edit. Do not require
every read-only imported contract to join a packet or fabricate a handoff for it.
If an actual required field/signature change is outside the worker's scope, revise
ownership explicitly or pre-file an owning sibling/dependent task and blocking order.
Recheck the current source and locks, and require the worker's own lock before edits.
Do not hide a needed structured type change in strings or `any`/cast workarounds.

Missing sources, unresolved links, invalid syntax, cycles and bounded-audit limits are
reported as incomplete evidence, not proof of absence. The audit inspects at most
256 parsed files, 4096 symbol visits and 16 import/export links per chain. It does not
trace semantic member dependencies, a whole runtime graph, dynamic imports or external
package types. Import-equals and unsupported/global contracts need manual review.
Use the author scope audit and existing ownership-overflow flow for those cases.
An advisory type observation never changes partition's ownership or verification gates.

The WF-G228 combat incident is historical: the current combat contract and executor
already carry `prerequisiteCode`. That history motivates tooling visibility, not another
game repair or permission to reopen the old workaround.

### Own The Mount Point (WF-G214)

Before publishing a packet that promises a new or changed mounted feature, audit
the leaf's actual importers and declare `mountPoints`. Do not infer a 3D scene's
owner from the name of a 2D screen. Give the worker both the leaf and its parent,
or explicitly defer integration to a pre-filed dependent task. A generic sibling
handoff does not replace that durable mounting obligation.

```json
"mountPoints": [{
  "leaf": "src/components/BattleMap/vfx/environmentEffects.tsx",
  "parent": "src/components/BattleMap/vfx/VFXSystem.tsx",
  "symbol": "AmbientWeather",
  "relation": "existing",
  "delivery": "owned"
}]
```

For `existing`, the scoped source audit resolves direct runtime imports using
the repository's TypeScript module settings, including aliases. Type-only imports,
comments, re-exports and unresolved links cannot prove the claim. The declared
leaf and parent must be exact repository-relative source paths within the physical
checkout. `owned` requires both in this packet's files. Existing companion-test,
declaration, overlap and live-lock checks still apply. No path is added for you.

For a new link not yet present, use `relation: "planned"` with a nonempty reviewed
`reason`. New-file intent remains available, but the report explicitly says that
the import is unverified. A planned declaration is not a workaround for an
incorrect existing-link claim. Require actual integration proof after the build.

For a deliberately unmounted build, use `delivery: "deferred"` and
`followUpTask: "<exact current Agora id>"`; the parent must not be owned by this
build packet. Pre-file the follow-up before dispatch. It must be unfinished,
carry the parent in `refs`, and have a blocking dependency (`blocks`, the default)
on a current build task claimed by this packet in the same campaign. Its body
must retain this exact two-line obligation with the declared paths and symbol:

```text
MOUNT-FOLLOWUP: src/components/BattleMap/vfx/VFXSystem.tsx mounts AmbientWeather
REFERENCE-ONLY: MOUNT-LEAF: src/components/BattleMap/vfx/environmentEffects.tsx#AmbientWeather
```

The leaf is read context for the follow-up, not a hidden edit grant. The report
checks the current task, dependency and obligation before seed/dispatch writes.
Do not close the build as fully integrated or lose the follow-up in a result
string. A later mounting packet still needs its own parent/test/declaration
ownership, current locks and applicable rendered acceptance.

Partition reports, seeded bodies and both prompt variants retain the declaration.
Workers must recheck the source chain and stop if it differs from the packet.
This audit inspects only declared direct links; it does not discover arbitrary
prose claims, all importers, facade chains, dynamic registration or private state.
JSX reference counts are syntax clues, not execution, reachability, correct props,
visibility or rendered acceptance. Audit those separately; existing visual and
approval boundaries remain mandatory. Current AmbientWeather is already mounted
in VFXSystem; the old leaf comment is stale and is not evidence of current absence.

### Resolve Forwarding Files Before Assignment (WF-G247)

Partition inspects owned `src/` TS/JS files without importing or running them.
An export-only facade with one internal runtime target is followed through its
forwarding chain. Every downstream file must be owned or covered by an explicit
sibling handoff. Reports print the chain; missing targets, cycles and unresolved
internal exports block partition, seed and dispatch before board writes. The
checker never widens `files` for you. Existing companion-test and declaration
ownership rules still apply to any implementation you add.

For a deliberate forwarding-export-only change, declare the exact owned facade:

```json
"forwarderOnly": [{
  "file": "src/components/BattleMap/characters/CharacterActor.tsx",
  "reason": "Change the compatibility export only; no character behavior changes"
}]
```

An unowned, duplicate, non-forwarding or stale exception fails. This does not
waive explicit implementation paths named in a task body or refs. Workers receive
the declared restriction and must stop if the requested behavior needs other files.

This is not a complete semantic dependency graph. Multi-target barrels,
import-and-export wrappers, package facades, private state and caller behavior
still require a read-only scope audit. For example, `CharacterActor.tsx` forwards
to `characterActor/CharacterActor.tsx`, which calls `useFresnelRim.ts`. Flicker
work needs the hook's private `uniformsRef` owner in the task body/refs and packet,
not just the visible actor facade. Record those actual state owners and callers
before dispatch; sequence them or declare a sibling handoff. Do not infer edit
permission from an import or from a successful structural partition check.

### Ignored Modules Need Local Test Homes (WF-G258)

Partition checks owned source paths against Git's ignore rules before seed or
dispatch. For each ignored module, declare `localTestHomes` on its packet:

```json
"localTestHomes": [
  { "source": "src/workers/voxelMesher.worker.ts", "test": "tests/VoxelLogic.test.ts" }
]
```

The test must be ignored and explicitly owned by the same packet. Add its path
to `files`; the declaration never grants access by itself. This prevents a
generic "test next to the module" instruction from creating a tracked CI test
whose imported source does not exist in a clone. Prompts name the local test
home and retain command limits. Local-only results are not clean-clone CI proof.
Do not change `.gitignore` or publish the ignored subsystem to bypass this gate.
Existing tracked modules still use the normal sibling-test ownership check.

### Test Controls Before Module Migrations

Before moving a module's exports, inventory the tests that may lose their mocks
or random-number controls (WF-G312). Use the tracked read-only checker, naming
the source file, each moved export, and the affected test subtrees:

```bash
node tools/agora/migrationImpact.mjs --module src/utils/combat/combatUtils.ts --symbol rollDice --symbol rollD20 --symbol rollDamage --tests src/commands --tests src/hooks
```

It lists file/line references for module mocks, named and namespace imports,
static barrel re-exports, dynamic imports, `require`, and `Math.random` spies or
assignments. It reads the current TypeScript aliases, including inherited config.
It never executes tests, changes files, creates tasks, or grants ownership.
`--json` provides the same evidence for a packet builder.

Review candidate rows before assigning work. Computed module targets and
same-name imports from other modules are not confirmed migration dependencies.
Variable aliases, wrapper helpers, require-based barrels and `globalThis.Math`
are outside this static check; inspect those manually. A zero-hit result is not
a complete runtime call graph or proof that the migration is safe. Assign the
reported test edits to explicit packets or sequence a separate repair before
integration acceptance. Do not add unowned tests to a worker's scope silently.

This includes body-only DO steps and source anchors such as `src/townEngine.ts:1108`
(WF-G265/WF-G280). The check does not expand ownership automatically. Rewrite or split
the task, deliberately widen its packet, or record a sibling handoff before dispatch.
For evidence-only paths, author a separate `REFERENCE-ONLY: <paths>` line. For an
absence assertion, use `EXPECTED-ABSENT: <paths>` (or `ABSENT:`). Explicit `CREATES:`
and `DELETES:` lines still require edit ownership. URLs, symbolic refs and targets
hidden in linked documents are not inferred; review those manually.

### Reconcile Every Title Surface (WF-G256)

Review the whole title before assigning a packet. Exact title paths now participate
in the same ownership check as refs and body paths, including source anchors. A title
can name the second half of the work even when its detailed brief omits that file.
Missing ownership blocks partition, seed and dispatch before task writes or launch.
Widen the packet deliberately, split the work, or declare a sibling that owns the
exact file and a handoff with its expected effect. A title never grants file access.

Plain-English surface names need a read-only source audit. Record each required
surface as a body line with an exact excerpt of the current title, its source path,
and a unique current source quote:

```text
TITLE-TARGET: {"label":"detail display","file":"src/components/CharacterSheet/Skills/SkillDetailDisplay.tsx","quote":"const expertiseBonus = calculateExpertiseBonus({"}
```

The quote is an example to recheck, not permanent authority. Partition resolves the
quote through the existing bounded source-citation reader and reports the current
line. Missing, ambiguous, invalid or physically escaped evidence blocks. A declared
title target requires ownership or a validated sibling handoff even if a separate
line labels that same file reference-only. Quote contents are metadata, not additional
edit or identifier claims. Bare title filenames require an exact path or a matching
verified `TITLE-TARGET` label and basename; no checkout or owned-file guess is made.

Map every conceptual surface and include its required tests, adapters and shared
implementation after the audit. The checker verifies declared evidence, not whether
the author found every meaning in an English title. It does not prove rendered or
runtime acceptance. Keep unresolved meanings in discovery rather than dispatching a
half-specified packet. Existing reference-only, absence and companion-test rules remain.

WF-G256's old detail-display stub is historical evidence. Current source uses shared
expertise calculation in both views. Do not reopen the absent historical task or claim
this governance check proves their current rendered agreement.

### Preserve Sibling Additions Before Replacement (WF-G307)

Before assigning a source-block replacement, read the current intended block,
including sibling additions since the original brief. Historical line ranges
are hints, not a current boundary. Inventory the affected symbols and record
which behavior the replacement must preserve. Do not infer redundancy from a
still-present old symbol or an unchanged small quote.

Use `captureSourceReview` from `taskLint.mjs` to capture an authoring receipt, or
append a current review to an existing campaign task with the bounded command:

```bash
AGORA_AGENT_ID=<your-handle> node tools/agora/orchestrate.mjs source-review <plan.json> <review.json> [--dry]
```

The review JSON has `taskId`, a new stable `id`, exact repository `file`, unique
literal `start` and `end` boundary strings, `symbols` (your reviewed affected
identifiers) and `reason` (your preservation assessment). A follow-up for the
same block must name the latest receipt's `id` in `supersedes`. Do not supply
`sha256` or `observedAt`: the command reads current source and captures them.
For example, a review after a sibling rider lands must name that rider and
explain its required preserved behavior, not just recapture a new digest.

The command requires your live orchestrator/master/human identity and an exact
unfinished task in the named campaign. It appends a `SOURCE-REVIEW:` receipt
atomically through existing task editing, retaining the original receipt and
concurrent sibling body additions. It does not reopen, finish or dispatch tasks.
`--dry` reads and checks but never appends. An uncertain append is not retried:
inspect `task show` before explicitly resuming. Identical applied ids are not
appended twice; conflicting or already-superseded ids cannot restore old authority.

The command validates the supplied plan first. For reconciliation, use a
coordinator notice plan that names the existing campaign and does not assert
the stale packet receipt as current. After the task receipt is appended,
update the worker plan's receipt chain and run preflight again. This is not a
shortcut around the stale worker-plan gate. Automatic supersession supports
the same file and boundary pair only; changed boundaries need a separate
parent reconciliation and must not silently erase the unresolved old review.

Packets accept captured receipts in `sourceReviews`. Seeded briefs keep them.
Preflight and `task lint` reread the uniquely bounded block. Changed bytes,
unavailable source or invalid boundaries require an explicitly reviewed durable
reconciliation before dispatch; do not silently refresh a baseline. The worker
must recheck after acquiring authorized locks and before editing.

Checks read at most 2 MiB of contained regular UTF-8 text; each block is at most
64 KiB, boundaries at most 512 bytes, and the SHA-256 covers decoded block text
including both boundaries and its line endings. Each task has at most 32 receipts
of 8192 bytes. Symbols are parent-supplied literal identifiers, not an inferred
complete inventory; comments and strings can match. A fresh digest is not
semantic preservation, test execution, rendered proof or an ownership grant.
Active exact-path line-range replacement directives require a receipt, but
arbitrary English is not inferred. Authors remain responsible for coverage,
re-anchoring and documenting every required preserved behavior.

### Check Each File And Symbol Premise (WF-G272)

Before prescribing a call site or a missing field, inspect each exact file. A
global symbol hit does not establish that it exists in another named file.
Declare every named file/symbol pair as one task-body line:

```text
SYMBOL-CHECK: {"file":"src/hooks/combat/useGridMovement.ts","symbol":"findPath","expect":"present"}
SYMBOL-CHECK: {"file":"src/types/character.ts","symbol":"subclassId","expect":"absent"}
```

The second historical prescription is deliberately stale: `subclassId` already
exists. Reconcile the brief instead of adding it again. Wave packets accept the
same objects in a `symbolChecks` array; declarations in guidance are also checked
and copied to seeded briefs. Run `task lint` and inspect the intended member,
definition or call site before dispatch. Packet validation and claimed-task
preflight refuse mismatches, malformed declarations and unresolved review.

If the source cannot be verified, retain the claim visibly, without guessing:

```text
SYMBOL-CHECK-UNVERIFIED: {"file":"src/example.ts","symbol":"findPath","reason":"VERIFY: source unavailable; author must locate the current call site"}
```

`VERIFY` remains unresolved and blocks preflight; it is not permission to
fabricate an API or a call site. Preserve superseded instructions as history.
Absence in an existing file is different from an unavailable file. Declared
checks read contained regular UTF-8 text files, at most 2 MiB each, and match
case-sensitive whole literal identifiers. Comments and strings can match. This
is not semantic parsing or proof that a new field is necessary. Arbitrary
English pairs are not inferred: authors and workers must review coverage and
meaning. Checks never grant file ownership or execute commands from task text.

### Verify Quoted Source Members (WF-G283)

Do not hand-transcribe a union or enum list without checking the exact current
declaration. A name found in a neighboring type does not belong to this type.
Put the list in one reference-only task-body record, not duplicated active prose:

```text
REFERENCE-ONLY: SOURCE-MEMBERS: {"file":"src/example.ts","symbol":"Cultural","kind":"string-union","quote":"export type Cultural = \"shrine\" | \"garden\";","members":["shrine","garden"]}
```

This is a format example, not a claim that the example source exists. `quote`
must be the complete uniquely matching current top-level named declaration,
including export modifiers. `kind` is `string-union` for direct finite string
literal values or `enum` for declared member names. Enum initializers are not
evaluated. Member equality is unordered and case-sensitive. Missing, extra or
duplicate members fail. Generic, referenced, computed or nested unions remain
unsupported; do not flatten them by guessing. Merged declarations, syntax
errors, ambiguous quotes and unavailable sources remain unresolved.

Wave packets accept the same objects in `sourceMembers` (at most 32). Guidance
records are checked too. Packet validation and claimed-task preflight refuse
unresolved claims before dispatch. Seeded task briefs and both worker prompt
variants retain the records and self-check rule. Run native `task lint`, then
review the declaration's meaning and affected consumers yourself. Correctness
here is source membership, not semantic necessity or runtime acceptance.

Seed-map task IDs join ordinary live partition/prompt/dispatch preflight, even
when absent from the authored packet's `taskIds`. The selected task's current
member records are re-read at launch after waiting in the queue. Missing or
ambiguous tasks and unreadable board data fail closed. Scope member records
are kept once as reference metadata, never flattened into a title or prose.
Quoted strings also stay out of verification-command, count-premise and vendor
instruction scans. A member named `npm run build` does not authorize a build.

When proof is unavailable, record `SOURCE-MEMBERS-UNVERIFIED:` with only `file`,
`symbol` and a concrete `reason`. It remains a blocking review, not confirmed
membership. Preserve prior claims in task history; explicitly mark superseded
prose `SNAPSHOT:` only when it is genuinely historical. Never silently refresh
quotes to make a failed check pass. Obvious inline union/enum prose lists warn,
but arbitrary English is not comprehensively inferred: you own claim coverage.

Reads reuse physical containment and regular UTF-8 source limits (2 MiB).
Each record is at most 32768 bytes, its complete quote at most 8192 bytes, and
its list has 1 to 128 distinct strings of at most 1024 bytes without controls.
The existing TypeScript parser is loaded only for explicit declarations; no
application typecheck, emit or evaluation runs. CRLF and LF quotes are compared
as LF. Metadata never implies ownership, locks or executable commands. This
check complements SOURCE-CITATION, SYMBOL-CHECK and WF-G282 consumer ownership;
none substitutes for the others.

### Audit The Whole Repaired Document (WF-G291)

Author documentation repairs as a whole-document audit, not a closed list of
historical line ranges. Keep the motivating contradiction and source citation,
then require the worker to read each repaired document end to end. Check every
repository path presented as current and recheck every absence claim, including
claims outside the cited ranges and in later test-surface sections. Reconcile
contradictory current-state sections rather than only adding a correction above
them.

Classify current, historical, retired and planned references separately. A retired
name can belong in history; a planned path can preserve unfinished intent. Neither
is a current implementation. Do not delete those references just to make a path
check pass. Linked documents do not become owned edit targets.

Require timestamped scoped checks, outcomes, unresolved findings and unchecked
scope before changing `Verified:` metadata. Label partial verification by section
and retain earlier dates for untouched behavior. An unresolved current-path or
absence claim blocks its acceptance and verification-date claim. File existence
does not establish live wiring, test execution or rendered behavior.

Generated worker prompts and seeded task briefs carry this conditional repair
policy. It is guidance, not a semantic document validator, an automatic repository
scan or a new command permission. Required extra edits still need parent
assignment and the worker's own locks. For existing tasks, keep the original brief
as history and record any reconciled acceptance explicitly before resuming.

WF-G291's old MerchantModal-test absence claim is already corrected in Town Map.
That fact does not certify the rest of the document today. Newly found behavioral
drift belongs in a separately scoped, evidence-linked remediation task.

### Prove Runtime Limitations Before Assignment (WF-G264)

Run the named entry point before turning a source comment into a task premise.
Alternatively, cite a current failing run. A leaf calling itself unsupported
is not runtime evidence. WF-G264's original quick-character claim was false:
the existing focused suite assembles every catalog race, including Deep Gnome.

Review the test's actual entry call, input and diagnostic. Do not accept a
passing/skipped case, collection/import error or unrelated assertion as proof.
Keep unknown cases investigation-only. Use an investigative title and no
implementation recipe, then retain the unresolved record in the task and packet:

```text
RUNTIME-LIMITATION: {"claim":"Quick assembly boundary needs a probe","file":"src/utils/sandbox/quickCharacterGenerator.ts","entry":"createQuickCharacter","state":"unverified","reason":"No current executed observation supports this boundary claim."}
```

For a reproduced failure, run a focused test with Vitest's JSON reporter, save
the untruncated report in ignored scratch, then capture its existing receipt:

```powershell
node tools/agora/testBaseline.mjs capture --report .agent/scratch/probe/vitest.json --command "<the exact reviewed test command you actually ran>" --output .agent/scratch/probe/receipt.json
```

This command only reads supplied JSON; it does not execute the recorded command.
Replace the placeholder, and verify the actual reporter path from the runner.
The repository config may use `VITEST_JSON_OUTPUT_FILE` instead of the CLI flag.

A `cited_failure` record names `claim`, `file`, `entry`, `receipt`, `testFile`,
the exact assertion `testName`, SHA256 of both current UTF-8 source texts in
`sourceSha256` and `testSha256`, and the narrow observed `observation`. The
receipt must name that failed assertion in a complete current-checkout run
within two hours. Source/test changes, stale receipts and missing evidence
require a fresh run and author reconciliation. This is a supplied citation,
not authenticated execution or semantic certification of the claimed boundary.

Native task creation and packet preflight refuse recognized unsupported active
claims. Preserve superseded wording as `SNAPSHOT:` after reconciliation. Scanner
source quotes remain literal evidence; review the generated proposal before
filing it, using this gate rather than assuming a boundary comment is true.
Packets accept `runtimeLimitations` arrays or inline records. Seeding and both
prompt variants preserve the exact state, and partition/queued launch recheck
current tasks and source/receipt freshness. Missing or changed task records
block launch. General prose detection is not exhaustive; review other wording
manually. Unverified records need an investigation-only task and no recipe.
If the entry succeeds, record that result instead of commissioning a fallback.
No declared command runs automatically or grants file ownership. Direct HTTP
authors are not gated by this client-only repair; no daemon restart is needed.

### Qualify Value Comparisons Before Deletion (WF-G276)

A populated parser value is not proof that a leaf correction is redundant.
Compare both current value paths and the canonical rule before prescribing
removal. Name the fields and consumers covered by the probe. Keep unequal or
unmeasured comparisons unresolved; do not write a removal recipe as fact.

Task bodies use `VALUE-EQUIVALENCE:` JSON. Packets may instead supply the same
objects in `valueEquivalence`. Use `unverified` when the probe has not run:

```text
VALUE-EQUIVALENCE: {"claim":"Resource re-attachment comparison","left":"parser resource maxUses and resetOn","right":"leaf resource maxUses and resetOn","state":"unverified","reason":"The current outputs have not been compared.","probe":"Proposed focused comparison of both outputs and the canonical resource limit."}
```

`reported_equal` requires the same claim and distinct sides, the named proving
`probe`, concrete comparison `evidence`, and `observedAt` as ISO UTC within the
last 24 hours. It is an author report, not certification by the checker. That
state cannot also carry an unresolved `reason`. An `unverified` record requires
a reason and may name a proposed probe; it cannot carry equality evidence or a
verified timestamp. Investigation may proceed within its authorization, but
deletion waits for current comparison proof and parent reconciliation.

Task lint and packet preflight refuse malformed, duplicate, stale or ambiguous
records and recognized unqualified removal/equality assertions. A good record
does not excuse a separate active assertion. Replace that assertion with the
record; preserve superseded text as `SNAPSHOT:` after author reconciliation.
The small prose detector is not exhaustive: authors and workers must review
other wording manually. Limits are 32 records, 16 KiB each and 2,048 bytes per
text field. No probe executes automatically or grants files or commands.

Seeded briefs and both prompt variants retain the exact state and evidence.
Claimed tasks must match the packet's records. Queued launch checks re-read
the live task, including seeded IDs, and refuse missing or changed premises.
After acquiring authorized locks, workers re-read `task show`, `task lint`, both
current value paths and the named receipt. A changed source or unequal result
blocks deletion, even if authoring lint is clean. Keep source review and
consumer behavior tests; literal freshness is not behavioral equivalence.

### Match Deduplication Acceptance To Its Goal (WF-G325)

Before dispatching deduplication, require one canonical definition, zero obsolete
copies, and behavioral verification for every affected consumer. Do not use an
unlabeled grep count as acceptance. WF-G325's historical "ONE hit" criterion
would have kept the old switch alive beside its replacement.

Declare each unit in the task body with bounded JSON:

```text
DEDUP-GOAL: one shared status-icon definition
DEDUP-ACCEPTANCE: {"canonical":"shared status table","canonicalCount":1,"obsolete":"legacy status switches","obsoleteCount":0,"consumers":["combat helper","Battle Map overlay"],"verification":"Test both consumers delegate to the shared resolver and preserve fallback behavior."}
```

A packet can instead set `dedupAcceptance` to the same object. Seeding retains the
contract and goal in the task. Task lint and packet preflight refuse malformed
contracts, surviving copies, missing consumers and conflicting old count criteria.
Reconcile superseded criteria with the parent before labeling them `SNAPSHOT:`;
never silently replace active acceptance or rewrite someone else's task.

Intake recognizes explicit `DEDUP-GOAL:` declarations and a small set of direct
deduplication directives. It is not a general semantic parser. Review other
wording manually. Limits are 16 contracts, 16 KiB per contract, 2,048 bytes per
text field and 64 distinct consumers per contract.

These declarations do not execute commands, grant file ownership, measure source
counts, prove equivalent behavior or establish consumer completeness. Before
acceptance, collect authorized current measurements and consumer tests, using
count-source metadata where required. Missing behavioral proof remains a blocker.
The workflow repair does not claim new game or rendered acceptance.

### Keep Acceptance Baselines Honest (WF-G284)

Prefer named tests that cover the owned modules. Static dependency candidates
are intake evidence, not proof of complete selection. If acceptance deliberately
names a broader suite, run it before editing and retain its actual Vitest JSON
in ignored scratch. Do not reuse WF-G284's historical service failure counts or
give a worker an unexplained whole-directory requirement to be green.

```bash
node tools/agora/testBaseline.mjs capture --report .agent/scratch/pre.json --command "npx vitest run src/services --pool=threads" --output .agent/scratch/baseline.json
node tools/agora/client.mjs task new "Owned repair" --campaign <id> --body-file .agent/scratch/brief.txt --test-baseline .agent/scratch/baseline.json
node tools/agora/testBaseline.mjs compare --baseline .agent/scratch/baseline.json --report .agent/scratch/post.json --command "npx vitest run src/services --pool=threads"
```

These tools neither authorize nor execute the sample suite. Run only the check
actually authorized for the packet, with Vitest's JSON reporter. Capture records
the supplied command as a claim, not attested execution. CLI intake attaches the
known failing files, individual identities, diagnostics, timestamps and hash to
the original brief. Evidence must name the checkout and be at most two hours old.
Missing/stale/invalid/oversized receipts refuse creation before mutation.

Comparison requires the same command, suite-file inventory and a newer report.
Inherited failures stay red. Different diagnostics or new failures remain visible
even inside an already-red file; missing/skipped coverage cannot justify green
acceptance. Hooks/collection failures remain separate suite evidence. Missing or
ambiguous data fails closed. A checksum detects inconsistency, not forgery or
failure authorship. Recollect evidence if scope changes. No receipt widens edit
ownership or authorizes unrelated debt repairs; keep that debt in the result and
hand it off. See the focused native-reporter tests in `testBaseline.test.mjs`.

### Preserve Test-Mock Contracts (WF-G314/WF-G315)

When a shared module changes, do not let a test mock hide new real exports or
invent exports that production has retired. A saving-throw mock must import and
spread the actual module, then override only its intentional test controls.
Dice controls belong on `systems/dice/rollers`, not a retired combat barrel.
Retain unrelated geometry and ID stubs when removing an obsolete dice spread.

```bash
node tools/agora/mockContractAudit.mjs --tests src/commands --tests src/hooks
node --test tools/agora/mockContractAudit.test.mjs
```

The read-only syntax check recognizes static Vitest mocks of savingThrowUtils
and the combat utility barrel/module, including relative and `@/` spellings.
It rejects bare saving-throw factories and literal or hoisted retired dice
exports. Unsupported factory and spread shapes require review, not a silent
pass. Other aliases, computed module targets, wrapper functions and dynamic
export behavior remain outside this check. It does not execute tests, edit
files, grant ownership or establish runtime correctness.

Before repairing the reported tests, record their existing test results. Preserve
their assertions and intended controls, run the affected suites afterward, and
typecheck only the touched files. Keep baseline debt separate from regressions
introduced by the repair. A clean syntax audit alone is not completion proof.

### Shared Test-Control Changes (WF-G305)

Before retiring a roller, clock, ID source or other shared test control, inventory
the tests that use the old control. Use the migration-impact check above and
review consumers it cannot see. A green run under an obsolete mock is not proof.
Publish the change before the retiring packet closes and before affected sibling
packets accept their test results.

Save a notice JSON file with exactly these fields:

```json
{
  "id": "roller-control-v1",
  "fromPacket": "PK-roller",
  "oldControl": "Math.random spy",
  "replacement": "explicit decision fixture",
  "affectedTests": ["src/hooks/combat/__tests__/useActionExecutor.opportunityAttacks.test.ts"],
  "evidence": "Describe the observed control change and the replacement proof."
}
```

The plan must name an existing campaign through `campaign.id` or `campaignId`.
Seed its tasks first, or put their exact current IDs in each packet's `taskIds`.
Use your current scoped, live orchestrator identity, not a fresh wave identity:

```bash
node tools/agora/orchestrate.mjs control-notice <plan.json> <notice.json> --dry
node tools/agora/orchestrate.mjs control-notice <plan.json> <notice.json>
```

Each listed test must map to exactly one packet's files. The command preflights
all recipients, appends a hashed notice to every assigned task in the retiring
and affected packets, then broadcasts the verified task IDs. It uses the existing
atomic task-body append API, so an edit landing after the initial snapshot is
preserved. Unrelated packets, dependencies, ownership and command limits do not
change. Missing tasks, cross-campaign targets, completed tasks without the notice,
and conflicting content under the same notice ID fail preflight.

Workers must read their inbox and re-read `task show` before verification and
completion. The durable `SHARED CONTROL CHANGE` block names the old control,
replacement, inventoried tests and evidence. A broadcast alone is not delivery.

Publication is per-task, not a transaction across the wave. On failure, inspect
the receipt and task records; an uncertain response may already have appended.
There is no automatic mutation retry. An explicit resume skips exact existing
blocks. Changed content needs a new notice ID. **One coordinator must serialize
publication for a given notice ID**: the existing append API does not enforce
cross-process uniqueness. If every block already exists, no duplicate broadcast
is sent. If the broadcast failed after verified appends, inspect the inbox and
publish a summary of the verified delivery separately.

This checks ownership mapping and durable delivery, not inventory completeness,
replacement correctness or repaired test behavior. Review unlisted consumers and
keep missing replacement proof blocked. Do not restart the shared daemon when
its existing append API supports this command.

### Reconcile Rulings Before Unblocking (WF-G323)

Before a recorded owner ruling unblocks a task, reconcile every instruction it
invalidates. Edit the brief with its source and reason, or append an explicit
`SUPERSEDED BY RULING` block. Never put the answer only in an unblock reason
while leaving contradictory body text active. Keep original provenance and
acceptance evidence. A ruling is a decision, not proof that implementation landed.

Use the existing durable append and state workflow for one reviewed blocker:

```bash
node tools/agora/orchestrate.mjs ruling-unblock <plan.json> <ruling.json> --dry
node tools/agora/orchestrate.mjs ruling-unblock <plan.json> <ruling.json>
```

Set your own `AGORA_AGENT_ID` on each call. The plan names the existing campaign;
this operation does not seed tasks, register a new identity or launch workers.
The ruling JSON uses this shape (all values below are synthetic placeholders):

```json
{
  "id": "palette-ruling-q1-v1",
  "taskId": "agora-target",
  "sourceTask": "agora-decision",
  "sourceReference": "authoritative question sheet Q1",
  "ruling": "Exact recorded owner answer",
  "oldInstruction": "Exact earlier instruction invalidated by that answer",
  "replacement": "Reviewed replacement within the existing scope",
  "evidence": "Why this instruction is superseded, with the decision source",
  "observedAt": "2026-10-09T21:00:00.000Z",
  "blocker": { "at": 1791570000000, "reason": "Exact blocked-event reason" }
}
```

Review the actual owner answer, source, scope and approval boundaries first.
`sourceTask` must be an exact current task in the same campaign carrying the
quote in its body, result or history reason/result. `sourceReference` points to
the authoritative question/decision, not an invented approval. `blocker.at` and
`blocker.reason` come from the target's latest blocked history event. A legacy
task with no usable blocker needs a reviewed current blocker record first;
do not fabricate missing historical provenance.

Dry mode validates the quote, target, current blocker and marker conflicts
without writes. Apply atomically appends a hashed supersession block, verifies
it and the same blocker on fresh reads, then reopens the task with a linked
history reason. The original body, concurrent annotations, creator, claimant,
refs, typed dependencies and permissions stay intact. Marker metadata is
`REFERENCE-ONLY`, not extra file ownership. Existing brief lint must pass.
Explicit resume checks the current brief again even if its marker was already
saved; a prior failed lint is not permission to reopen it.

A changed blocker, missing quote/instruction, different-content marker or
unapplied nonblocked/done target refuses. Failures expose a partial receipt:
inspect task/source/inbox before explicitly resuming; never automatically
repeat a mutation. Exact reruns skip an already verified application, even
after claim, completion or a later blocker. They do not reset later state,
duplicate the block or rebroadcast. A new blocker needs a newly reviewed id.

One coordinator must serialize ruling application. This is not a cross-request transaction;
another state change can still race the final read. Raw state routes remain for
other and recovery workflows; this command does not police arbitrary callers.
Exact quote presence does not infer human approval, semantic truth, revocation
or current validity. The author owns that review. The operation does not remove
blocking dependencies, perform product work or grant external/protected actions.
Workers must re-read body/history/source and stop any remaining contradiction.

### Separate Build From Visual Acceptance (WF-G266)

Split combined build/eyeball/tune work before assigning a build worker who cannot
perform the rendered pass. Use two existing board tasks: explicit build-only
acceptance, then a blocking-dependent visual review/tuning task. No new task
state is needed. Historical WF-G266 tasks are not current product acceptance.

```bash
node tools/agora/orchestrate.mjs split-visual <plan.json> <split.json> --dry
node tools/agora/orchestrate.mjs split-visual <plan.json> <split.json>
```

The plan is an existing valid packet plan naming its current campaign. Use your
scoped live orchestrator/master/human identity; the command never registers or
dispatches agents. The selected packet must be unassigned. Reconcile existing
tasks manually rather than duplicate them. JSON has exactly `id`, `packetId`,
`buildAcceptance`, `reviewer: {agentId, handle}`, `visualProof: {url, acceptance}`,
and `tuningFiles`. Use a stable split ID, explicit separate build-only and rendered
acceptance, and a credential-free running loopback surface. Reviewer UUID/handle
must match a current online roster row, not a role such as `orchestrator`.
Tuning paths are exact, not globs; `[]` explicitly means inspection only. Review
the actual scope, files and verification before writing. The record names later
responsibility; it does not grant immediate edits or skip a reviewer's packet/locks.

Dry review creates nothing. Applying creates the build and review tasks in the
same campaign with a blocking dependency on the exact build ID, then appends
matching reference-only `VISUAL-HANDOFF` / `VISUAL-REVIEW` declarations. Combined
intent remains historical read context. Review names its owner, rendered
acceptance, running surface and tuning refs. `linked: true` requires fresh
verification of both records and their dependency.
Every `after` predecessor must already have exact task identities in the same
campaign. The build retains those blocking prerequisites; an unresolved predecessor
refuses before creation, rather than disappearing during the split.
The durable `buildPrerequisites` and `deliveryRefs` arrays preserve resolved
ordering and canonical completion routing. Current indexed gap refs and Plan Map
refs are copied to the review, but builder-owned source paths are not. A finished
build-only task supplies at most active Plan Map evidence and never closes a gap.
Only accepted review work may provide the delivery receipt. Reconciliation stays
upgrade-only; it does not silently undo an already incorrect historical status.
Completion projections require the named review claimant, matching durable
build/review records and exact canonical delivery refs. Extra Plan Map or
workflow refs hold delivery instead of promoting an unrelated feature or gap.
Explicit workflow IDs remain canonical even when their rows move to the archive.
Review/build blocking dependencies, completed same-campaign prerequisites and
declared tuning refs must also remain intact before either projection accepts
the review. A missing handoff stays held, not implicitly delivered.

Use the returned `packet` for the builder: its scope is build-only and its
`taskIds` and `visualHandoff` bind the pair. Do not seed another build. Keep both
returned `tracking` IDs in wave reporting. Watch/report also recover the review
from durable declarations and refuse wave completion for missing, blocked or
contradictory visual acceptance, even if an older map omitted its review entry.
Board/campaign views retain the open review after build completion. Build done
unlocks its dependency; it does not prove visual acceptance or launch a reviewer.
Review needs a separately audited packet, command limits and authorized tuning locks.
The returned `reviewPacket` is a fragment: add the actual reviewer's current lane
and pet, then audit it separately. Its `visualReview`, exact task, handle, acceptance,
surface and tuning files must agree with the durable record. An inspection-only
review has no owned files. A checked prompt goes to the already registered named
reviewer, who verifies the exact UUID and original session with live `whoami`.
Automatic review dispatch is refused because a newly spawned worker would have a
different identity. Do not register, retire or release that reviewer's old locks.

Partition and fresh queued launch checks refuse removed/changed declarations,
missing/completed/different-campaign review, wrong claimant, missing tuning refs
or a nonblocking/missing build dependency. Builders reread both tasks before
completion. These are routing checks, not semantic split certification, rendered
proof, a universal direct-HTTP completion gate or a cross-request transaction.
Queued checks also refuse lost predecessor dependencies or review delivery refs.
The parent still owns the complete acceptance audit.

Serialize a split ID. Creation/linking can partially succeed. Uncertain responses
stop without retry; inspect tasks/receipt before explicit resume. Exact stored
tasks/links are reused without replacing notes/history; conflicts need a newly
reviewed ID. Never dispatch a partially linked pair or infer success from a
created build alone. No tests, servers, workers, permissions, review closure,
historical task recreation or visual product acceptance are performed by this command.

### Audit Scope Corrections (WF-G246)

When a deepdive or audit supersedes a swept task's scope, reconcile the durable
brief at audit landing. Edit the body or append a clear correction and current
audit reference. A chat relay is not enough. Read the current source first;
WF-G246's historical spell counts and absent task are not current findings.

For campaign-wide delivery, reuse the existing notice path:

```bash
node tools/agora/orchestrate.mjs scope-notice <plan.json> <notice.json> --dry
node tools/agora/orchestrate.mjs scope-notice <plan.json> <notice.json>
```

Use an existing valid packet plan with `campaign.id` or `campaignId`, and your
current scoped live orchestrator/master/human identity. Notice JSON has exactly
`id`, `fromTask`, `oldScope`, `scope`, `observedAt`, and `audit`. `fromTask` is an
exact task in the campaign whose refs include the audit file. It may be done.
`audit` has only `file` (exact relative path) and `quote` (unique current literal
text). The bounded source-citation reader refuses missing, ambiguous, unsafe or
non-UTF-8 sources. Use a real UTC observation within 24 hours, not an old example.
The author reviews the meaning and completeness of the corrected scope; exact
quote matching does not certify audit counts, runtime behavior or acceptance.

Review the dry receipt. All unfinished campaign bodies matching `oldScope` are
included, even siblings absent from the packet list. `closedMatches` needs a
separate acceptance review. Tasks already completed when checked are not
appended or reopened. Completion during delivery can leave applied history;
the partial receipt requires acceptance review and suppresses success broadcast.
Unrelated tasks remain untouched. Each append carries a hashed
`AUDIT SCOPE CORRECTION`, corrected scope, linked source task, current
`SOURCE-CITATION`, audit text digest and explicit superseding instructions.
Original briefs, concurrent notes, claimants, dependencies, refs and permissions
remain intact. Reconcile packet scope, acceptance, dependencies and file owners
before implementation. Workers must re-read the current task and audit; uncovered
work or conflicting evidence is a blocker, not permission to widen their packet.

Audit content and source-task linkage are rechecked around each append; target
state and scope are reread before writing. These checks reduce races, not an
atomic cross-task transaction or compare-and-swap guarantee. Serialize each
notice ID. On failure, inspect the receipt and exact durable tasks before explicit
resume; never retry a mutation automatically or roll back worker notes. Exact
stored blocks are skipped, including after completion. Changed wording or audit
content requires a newly reviewed notice ID. A failed broadcast or an all-present
resume needs explicit reporting, not a claim that a new summary was delivered.
This command does not seed tasks, start workers, execute quoted commands, grant
files or commands, restart the shared daemon, or prove the audited product fixed.

### Capability Claim Corrections (WF-G334)

When a worker's current evidence disproves a capability claim in a task brief,
review the receipt and correct the affected campaign briefs before verification.
Do not leave siblings dependent on a chat relay. Keep the observed host, flags,
surface, time and limits explicit. WF-G334's historical headless-WebGPU result
is not a statement about today's GPU or permission to skip rendered proof.

Use the existing notice and atomic task-body append path. The following JSON
shows the shape only; replace its source task and observation fields with
reviewed actual evidence before publishing:

```json
{
  "id": "capture-claim-v1",
  "fromTask": "agora-exact-source-task",
  "oldClaim": "Headless capture is not proof: the headless path shows only the fail-fast pane.",
  "replacement": "Use the reviewed capture path only after checking the actual adapter and rendered surface.",
  "observedAt": "2026-10-09T20:00:00.000Z",
  "conditions": "Name the tested host, browser, flags, scene and remaining limits.",
  "evidence": "Name the actual scoped receipt and what it proves, not a proposed run."
}
```

The plan must name an existing campaign through `campaign.id` or `campaignId`.
Use your current scoped, live orchestrator/master/human identity. The source
task must be an exact current task in that campaign; it may already be done.
The command does not seed tasks, register workers or read a per-wave seed map:

```bash
node tools/agora/orchestrate.mjs capability-notice <plan.json> <notice.json> --dry
node tools/agora/orchestrate.mjs capability-notice <plan.json> <notice.json>
```

Inspect the dry receipt. It sweeps all current task bodies in the campaign for
the exact old text, including siblings absent from the plan's packet list.
`targets` names unfinished matches; `closedMatches` names completed matches
without the correction and needs separate acceptance review. These are not
reopened or edited. Publication with no target refuses instead of claiming a
correction was delivered. An already stored exact correction is recognized
even after that target completes. Role, source campaign and conflicting content
under the same notice ID are checked before any append.

Each target gets a hashed `CAPABILITY CLAIM CORRECTION` carrying the source,
old claim, replacement, observed time, conditions and evidence. It explicitly
supersedes that claim for the stated conditions only. Original briefs, concurrent
notes, claimants, dependencies, refs and file/command permissions remain intact.
After verified appends, the summary broadcasts the task IDs and completed
matches needing review. Workers must re-read the task, check their actual host
and surface, and post current proof or a blocker before accepting the result.

Delivery shares the control-notice rules above: per-task appends, partial-failure
receipts, no automatic mutation retry, exact-block skipping on explicit resume,
and a new ID for revised content. One coordinator must serialize publication
for a notice ID. If a response is uncertain, inspect task records before
resuming; if the summary failed or a resume finds only already present blocks,
report verified delivery separately rather than assuming chat succeeded.

Exact text is not a semantic search. Review paraphrased claims manually, run a
new sweep if tasks arrive after the snapshot, and inspect completed matches.
Timestamp format checks do not certify freshness, evidence correctness,
inventory completeness, command safety or GPU/runtime capability. This tool
transports reviewed guidance; it does not prove the underlying game visual,
grant a broader packet, execute a capture or restart the shared daemon.

### Deletion Task Checklist (WF-G320/WF-G321)

Before dispatching a data-module deletion or merge, include all of these in the
task body. A broad neighboring suite is not enough to prove that data survived.

- Name the removed path with `DELETES:` and its postcondition with
  `EXPECTED-ABSENT:`. Name the canonical surviving module and export separately.
- Name an owned focused test that directly imports the surviving export and
  checks required IDs/content, uniqueness and callable behavior as applicable.
  If none exists, assign creating one; do not accept a suite that uses only its
  own fixtures. Use a disposable negative control that empties the table or
  removes a required ID and proves the acceptance test fails. Never corrupt the
  shared live table to run this control.
- Run the read-only header inventory before and after deletion:

  ```bash
  node tools/agora/deletionChecklist.mjs --deleted src/data/naval/voyageEvents/index.ts --scan src
  ```

  Missing target paths are allowed. The report names exact generated Dependents
  header hits, including source-relative paths, with file/line evidence. This
  is not a complete dependency graph or proof that deletion is safe. Inspect
  imports, callers, assets and other references separately.
- Carry each unowned hit into an explicit parent-owned follow-up packet. The
  worker reports the affected paths; it does not acquire extra files just because
  they are unlocked. The parent checks current ownership and assigns the work,
  then obtains the required locks and runs one wave-wide header refresh with
  `--sync --only <assigned paths>`. Do not run an unscoped sync or hand-edit
  unrelated sibling headers to make the scan clean.
- Record absence, surviving-export test results, negative-control failure and
  post-delete header hits in the result. Keep header follow-ups visible until
  completed; a green mock-only suite is not deletion acceptance.

The historical voyage merge has its direct-export test at
`src/data/naval/__tests__/voyageEvents.test.ts`; the naval manager's fixture-only
suite cannot substitute for it. This checklist changes task-authoring policy,
not the game's data or the daemon's completion state machine.

### Ownership Overflow And Legacy Membership

Generated workers stop and file concrete ownership-review follow-ups when a fix
needs unassigned files (WF-G252). They name exact paths, the required change,
current lock holder, completed slice and missing proof. A `discovered-from` edge
links the follow-up to the source without making its readiness depend on a
blocked source. The review and original task stay blocked until you assign the
files in a revised packet or sequence an owning sibling. Add real blocking
dependencies only in the direction the remaining work requires. Do not accept
a partly landed task as done merely because its owned slice passed tests.

Workers cannot enlarge their packet just because they can acquire another lock.
They reuse an existing follow-up when one matches and ask a peer owner before
changing its state. Search and review these records before dispatching the next
wave; a task proposal is not permission to edit its referenced files.

For legacy tasks, `NONE RECORDED` is missing membership evidence, while a
standalone record contains an intentional opt-out (WF-G251). Workers leave both
unchanged. You, a master or a human may backfill or move membership with a reason.
The generated contract gives discovered follow-ups the assigned campaign; it
uses the same Plan Map-derived identity as seed when no explicit override exists.
Do not silently infer that a sweep creator makes an omission intentional.

CRLF advice points to the worker's permitted EOL-preserving edit tool, not a
mandatory shell rewrite (WF-G241). A denied capability stays visible; it is not
permission to bypass the sandbox. Transient UNKNOWN/-4094 races use the shared
bounded write helper only when script writes are already allowed.

For every owned `src/` source file, the partition check also finds existing co-located and
`__tests__/` sibling `*.test.*` or `*.spec.*` files with the same module name, plus
same-prefix tests that import that module (WF-G209).
Put those regression tests in the **same packet's** `files`, not a sibling handoff: the
worker must be able to update an obsolete expectation when its source change requires it.
The generated prompt and lock command then name both source and tests. A source-only
packet fails pre-dispatch instead of forcing the worker to preserve an outdated assertion.

Owned TS/JS source also requires any tracked same-name `.d.ts` twin in the same
packet (WF-G263). The partition check reads Git once per analysis and refuses a
source-only packet before seeding. A sibling handoff is not sufficient for this
coupled export contract. The checker never adds files silently and does not
require absent, ignored or untracked declarations. Include and lock the twin,
update it when signatures change, and verify both; dependency-header `--sync`
does not regenerate declarations.

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
6. **unresolved type fields** where a DO step names a type file as the source of fields that do not exist in that file (`unresolvedTypeFields`, WF-G161);
7. **invalid explicit Plan Map status assignments**, checked against the topic or feature enum in `public/planmap/topics.schema.json` (`invalidPlanmapStatuses`, WF-G288). This does not forbid an Agora task from being blocked;
8. **count-dependent premises without a measurement source**, and empty, placeholder or echo-only source declarations (`countSourceCheck`, WF-G343). This checks declarations, not command execution, safety or freshness;
9. **explicit unresolved implementation discovery**, using `DISCOVER:`, `FIND:`, `LOCATE:`, `TO-DISCOVER:` or `DISCOVERY-REQUIRED:` at the start of a body/title line, optionally after an `Owned files:` prefix (`pendingDiscoveries`, WF-G333).

##### Qualify Cast-Removal Premises (WF-G210)

A base interface declaration does not prove that a property is available where
a cast is used. A union member can replace it through `Omit` or redeclaration.
Resolve the current call-site type before prescribing removal. Check every
relevant member and whether a narrowing helper is needed. A grep, parser finding
or literal source quote is not compiler evidence.

The sweep scanner does not perform that semantic check. Its structured
`findings[].typeReview` (also exposed in `typeDebt`) remains `unverified` for casts, type
suppressions and dummy-return assertions. It names the affected finding IDs and
required checks. Both grouped and legacy single-finding scaffolds use the same
review requirement. Type-debt findings remain advisory, outside the actionable
proposal inventory. Explicit `--scaffold` prints investigation commands for
them without creating tasks. Grouped proposals containing type findings also
carry `typeReview`. Suggested bodies contain `TYPE-PREMISE-UNVERIFIED:`;
externally supplied behavior claims, removal steps and acceptance ideas remain
visible as unverified proposals, not approved implementation instructions. A
supplied `verified` label cannot bypass this review. Other proposal identities,
references and existing-task candidates remain unchanged.

Use the suggestion for bounded investigation, not mechanical cast removal.
Before assigning implementation, record the resolved call-site/union facts,
choose any needed narrowing, and collect focused compile/type evidence for the
exact change plus behavior evidence. Type-check fixtures illustrate a pattern;
they are not proof for a different production call site. Task lint checks its
existing authoring rules, not assignability. Preserve historical bodies in edit
history when reconciling them; do not recreate old errors in game code.

##### Keep Source Citations Stable (WF-G211)

Do not commission a change from a bare line number. Read the current source and
record a unique literal quote, keeping any old line only as a snapshot hint:

```text
SOURCE-CITATION: {"file":"src/example.ts","quote":"if (!known.has(token)) return false;","observedLine":12,"findingId":"optional-existing-finding-id"}
```

This is a format example, not a claim that `src/example.ts` exists. The supported
fields are `file`, `quote`, optional positive `observedLine`, and optional existing
`findingId`. Use one JSON object on one body line. A multiline quote uses JSON
newline escapes. The file must be an exact relative path inside the physical
repository. The linter resolves the quote against current text, ignoring line
hints. Missing or duplicate matches, unavailable files, malformed declarations
and bounded/incomplete reads are unresolved, never guessed current locations.

The current sweep scanner's `--scaffold` suggestions re-read each finding's quote
and retain finding IDs and labeled snapshot evidence. If it cannot resolve one,
the suggested body includes `SOURCE-CITATION-UNVERIFIED:` with `file`, optional
`findingId`, and `reason`. Reconcile it before assignment. The scanner never
creates a task, adds a tracking comment or changes source. Its `--root` also
scopes the quote read. After adding a tracking annotation, regenerate or lint the
body again; the same quote must still identify the intended code.

Lint supports at most 64 declarations, 8192 bytes per JSON declaration, 2048 bytes
per quote, and a 2 MiB source read. It normalizes line endings only, not arbitrary
whitespace. It does not execute code or prove meaning, type facts, equivalence or
coverage. Choose a longer quote to disambiguate repeated text. Literal evidence
is excluded from other prose checks and never implicitly grants files; explicit
refs and edit directives elsewhere still retain their existing ownership rules.

Legacy unanchored `file:line` prose receives an advisory review warning, not an
automatic rewrite or rejection. Authors and workers must re-read it before acting.
Label historical evidence `SNAPSHOT:`, `EVIDENCE:` or `KNOWN-INVALID:`. An owner
must reconcile changed task scope, preserving original intake in edit history;
never change game code merely to satisfy a stale source citation.

##### Remeasure Count Premises (WF-G343)

Do not copy a corpus count into the next packet as current fact. Record a reviewed
read-only `COUNT-SOURCE: <command>` in its body and explicitly authorize that
command in Guidance. Require the claimant to re-read the task, run the source
and checkpoint the timestamp, command, current counts and ignored receipt before
acting. The final result carries the same evidence. Source paths are read-only
references, not edit ownership; a separate `CREATES` declaration still overrides
that classification. Missing source paths remain lint defects.

Task lint conservatively detects numeric row, file, spell and gap claims. Use
`COUNT-CLAIM: <premise>` for other count-dependent wording; manual review remains
required. Label old measurements `SNAPSHOT: <date and numbers>` or `EVIDENCE:` so
history is not confused with a live premise. Creating a fixed number of future
deliverables is not a corpus measurement. The linter does not execute commands.

Plan packets can supply `countSources`, an array of single-line commands. Inline
`COUNT-SOURCE` lines in Guidance are preserved too. Validation checks that each
command is explicitly permitted in Guidance before seeding or dispatching; it
does not certify arbitrary shell text as safe. Tests, builds, typechecks and dev
servers are not count sources and retain their separate verification permissions.
For example:

```json
{
  "scope": "Repair the current Enchantment Gap rows after measuring the corpus.",
  "countSources": ["node --import tsx tools/agora/countSpellGaps.mjs"],
  "guidance": "Authorize read-only measurement: node --import tsx tools/agora/countSpellGaps.mjs. Checkpoint the timestamp, exact command, counts and ignored receipt before relying on the premise."
}
```

The adapter uses `scripts/validateSpellIntegrity.ts#checkSpellIntegrity`; it does
not introduce another spell rules engine or repair spell data. JSON receipts count
distinct files for Enchantment Gap and Upcast Gap, disclose reviewed clearances
and every other validator finding, and provide usable counts only when every
scanned file was checked. Empty or incomplete scans exit 2 with null counts.
Complete measurements may still fail the mechanical gate. Timestamped receipts
are snapshots, never future authority. If measurement is unsafe, unavailable or
incomplete, repair the task premise before count-dependent work proceeds.

Task authors and sweep templates must use the current schema vocabulary for roadmap
instructions, not Agora states. Keep the existing Plan Map status when an effort is
blocked; explain why in `status_note` and the linked blocked task. Never replace it
with `blocked`, or pick `superseded` merely to disguise a wait. An explicit
`PLANMAP-STATUS: topic active` or `PLANMAP-STATUS: feature active` body line is also
linted. Plain imperative assignments and `planmap-add.mjs --status` commands are
checked; this is a conservative prose check, not a complete language parser.
Label quotations of bad historical instructions `EVIDENCE:` or `KNOWN-INVALID:` so
they are not mistaken for the action the next worker should execute.

Quote a space-containing external Windows path **alone**, for example
`"D:/Program Files/Git/bin/bash.exe" --noprofile --norc` (WF-G350). Single quotes,
double quotes and Markdown backticks are supported for complete drive paths;
forward slashes and backslashes work. These host paths are not checkout files
and are not existence-checked. Quoted commands, malformed quotes and ambiguous
unquoted paths retain ordinary scanning. This is not a shell parser or general
support for every Windows filename. Keep repository paths outside the host-path
quotes: nearby missing files and ownership obligations still apply. Do not
invent `CREATES` or `ABSENT` declarations to silence host-path fragments.

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

##### Data Edit Premises (WF-G327)

##### Source Record Identity (WF-G294)

For an Idea Board source repair, derive the address, stable source ID and owning
record ID together from the current JSON. Do not copy IDs from a sweep summary,
array index, stale reach receipt or another task. The reachability checker now
prints the same-read identity beside each address. An array path is only a hint.

Generate an identity-only draft without network or board mutations:

```powershell
node scripts/idea-board/source-task.mjs <exact-current-http-address> [<another-address>]
```

The command reads `public/idea-board/records.json` once and prints a JSON draft
with `title`, `body`, `refs` and `sourceRecords`. It refuses absent, excluded or
multiply owned addresses and malformed/duplicate stable identities. It does not
create a task. Add the actual repair scope, acceptance criteria and owned files
before creating or editing an Agora task. Preserve human exclusion rulings.
The historical shortened CozyClay address is excluded now, not an active source
under its former record. Do not resurrect it to replay an old task.

Each draft contains a reference-only `SOURCE-RECORD:` line with these exact keys:
`file` (`public/idea-board/records.json`), `recordId` (`IB-` plus four digits),
`sourceId` (`SRC-` plus four digits), `addressField` (`url` or `archiveUrl`) and
the exact stored HTTP(S) `url`. Put one owning record/source/address instruction
on each line. Explicit `IB-`/`SRC-` address claims, including bare GitHub addresses,
must agree with a current declaration. Split ambiguous paragraphs rather than
silently choosing an owner. Label unselected historical claims `HISTORY:`.
ID-only body instructions in an address-bound task also need reconciliation;
a short ID-only title is accepted only when it agrees with verified declarations.

For a wave, carry the declarations in the packet's `sourceRecords` array and
retain current task declarations exactly. Do not also duplicate their marker
lines in `guidance`. Prompt and durable seed builders append the exact records;
packet preflight and queued launch re-read current ownership and task metadata.
Task and packet must retain the same declaration set in both directions. Removing
a binding from either requires parent reconciliation before assignment continues.
Assign the board through the ordinary `files` contract if it will be edited.
The citation itself grants no file, lock, command, revision or network access.

This is bounded literal identity validation, not semantic evidence, licensing,
link reachability or complete English interpretation. Authors still reconcile
unsupported prose and actual edit intent. Limits: 32 declarations, 8 KiB each,
64 recognized address claims, 256 KiB task body and 2 MiB contained regular JSON.
No task or source is automatically rewritten; source mismatch remains incomplete.

##### Source Rewrite Acceptance (WF-G295)

Before filing a task that rewrites a unique source field, probe the complete
proposed change with that system's current validator and normalizer. Check the
destination against other owners first. If it collides, name those owners and
ask the parent to choose a preservation-safe resolution before creating an edit
brief. Do not delete an identity, reuse a retired ID, silently narrow the batch,
or treat an approval label as permission to bypass the constraint.

For Idea Board primary URLs, use the existing read-only draft generator:

```powershell
node scripts/idea-board/source-task.mjs --rewrite <exact-current-primary-url> <new-url> --reason "<parent-reviewed intent>"
```

It derives current stable IDs and positions from one read and runs
`probeIdeaSourceRewrites` against a disposable complete board. A collision
prints its normalized address, record/source or exclusion IDs and paths, then
exits unsuccessfully without producing an edit brief. Invalid baseline data,
stale from-values and normalized no-ops also fail closed. Preserve the historical
CozyClay exclusion; it is not an active source awaiting this rewrite.

Safe drafts carry `sourceRewrites`, `sourceRecords`, exact `dataEdits` with
authored `from` values, and `dataValues` with reviewed reasons. Retain all four
arrays in the wave packet; do not duplicate marker lines in `guidance`. A
reference-only `SOURCE-REWRITE` has exactly `recordId`, `sourceId`, `from`, `to`
and `reason`. Partition, seed, worker prompts and queued launch checks validate
the complete final batch with the owning validator. Durable tasks must retain
the same rewrite and primary data-edit set as their packets. Changed positions
or source ownership require reconciliation, never automatic reindexing.

This gate covers declared Idea Board primary-URL edits and recognized rewrite
prose, not arbitrary English, structural replacement of whole records, or every
unique field in other systems. Authors must use the corresponding owning
validator for those. Archive URLs do not share primary-URL uniqueness. The
probe does not fetch links, prove research meaning or grant edit permissions.
Task lint's identity/provenance checks alone do not prove rewrite acceptance;
the existing immutable CLI is unchanged by this gate. Workers must rerun the
read-only probe after locking and run the owning validator on the final edit.

##### Data Value Provenance (WF-G267)

Before prescribing a data spelling, cite the exact current sibling JSON field
that supplied it. If the value is deliberately new, declare that choice and
its reason. Existing paths and passing schema validation do not prove corpus
consistency. Read the owning normalizer and compatibility requirements too.

Packets use `dataValues`; durable task bodies use reference-only `DATA-VALUE`
records. For the current cadence example, the target field is
`public/data/spells/level-3/animate-dead.json` with key array
`["effects", 1, "grantedActions", 0, "frequency"]`. Its value is `each_turn`.
The copied sibling is `public/data/spells/level-6/create-undead.json`, key array
`["effects", 0, "grantedActions", 0, "frequency"]`. Both match current data;
this is an audit example, not a request to rewrite either spell.

```json
{
  "dataValues": [{
    "file": "public/data/spells/level-3/animate-dead.json",
    "field": ["effects", 1, "grantedActions", 0, "frequency"],
    "value": "each_turn",
    "origin": {
      "kind": "existing",
      "file": "public/data/spells/level-6/create-undead.json",
      "field": ["effects", 0, "grantedActions", 0, "frequency"],
      "reason": "Reviewed sibling models the same authored command cadence."
    }
  }]
}
```

An explicit new value uses `origin: {"kind":"new","reason":"..."}` with no
source file or field. A reason is required for either origin. The check compares
the current sibling's literal value, not semantic canon or runtime adoption.
It never chooses a value, rewrites JSON, grants a source file or expands locks.
Target ownership still uses the existing packet model; sibling sources are read
context. Missing, stale, malformed or ambiguous evidence requires reconciliation.

Quoted primitive JSON assignments near JSON file context require a matching
declaration. Put the exact target and supported dot/index field on the same
instruction line, for example `effects[1].grantedActions[0].frequency` after
the target path. Another file or nested field cannot satisfy that instruction.
Ambiguous files and unsupported field syntax stop preflight; use the exact
structured record and rewrite unclear prose, not guessed evidence. Pick one
prescriptive spelling. Put unselected alternatives on `HISTORY:` lines rather
than leaving workers to choose between timing/frequency or different values.
Other prose forms still require the author's manual audit; this is not complete
English interpretation or an exhaustive corpus search.

Every `dataEdits` to-value also needs matching `dataValues` provenance, separately
from its current from-value. Existing WF-G327 baseline/no-op checks remain intact.
Task lint reports unresolved provenance without rewriting records. Partition,
seed, prompt generation and queued-launch checks refuse it before their effects.
Task records cannot silently lose or change their authored declarations in a new
packet. Seeded briefs and every worker prompt retain them; workers re-read the
source and confirm the chosen target, full field, value and origin before editing.

Bounds are 32 declarations, 32 key segments, 8,192 value bytes, 16,384 bytes per
record, 64 recognized primitive claims, 262,144 body bytes and regular contained
JSON sources up to 2 MiB. Unsupported work remains incomplete, not certified.

##### Data Edit Baselines (WF-G327)

When a packet prescribes a data edit, read the current field first and record
the value it changes **from**, not just the desired result. An owned filename
means edit scope, not that the file needs a diff. Check the owning normalizer
before requiring a rewrite of authored source text.

Existing JSON-field prescriptions can use `dataEdits`:

```json
{
  "dataEdits": [{
    "file": "public/data/spells/level-8/antipathy-sympathy.json",
    "field": ["targeting", "filter", "sizes"],
    "from": ["Huge or smaller"],
    "to": ["Tiny", "Small", "Medium", "Large", "Huge"]
  }]
}
```

This example is a **no-change decision**, not a requested spell repair. Checked
against current source on 2026-10-09: the raw field remains `Huge or smaller`;
`normalizeFilterValues` and `sameFilterValues` in
`src/systems/spells/validation/SpellIntegrityValidator.ts` expand it to the same
size set. The four `chosen-kind aura` clearances still record the source gate.
Do not rewrite the field to the expanded array merely because a packet names it.

Each declaration names an exact existing repository-relative JSON file covered
by the packet's owned files, a nonempty array of literal keys or array indices,
and a JSON `to` value. A `from` value records the current raw value when known.
Key arrays preserve names containing dots, slashes or empty strings; `null`,
`false` and zero are real from-values, not missing declarations. Globs, external
or traversal paths, links outside the repository, missing fields, malformed
JSON, unknown fields and duplicate prescriptions fail preflight. New files or
new fields need their separate parent-assigned creation/ownership review; do not
invent a null baseline for an absent field.

Validation, ownership preflight and prompt generation read current raw values.
A recorded `from` that no longer matches fails before the normal seed/launch
preflight can proceed. A literal `to` already present fails as an unnecessary
diff. No JSON is written. Omit the `from` only when the current value remains
unverified: validation warns **VERIFY BEFORE EDITING**, and the seeded task
retains that state rather than silently filling in a claimed author baseline.
Known from-values carry **RECHECK BEFORE EDITING** because the file may change
after preflight. Declarations survive on the task as
`REFERENCE-ONLY: DATA-EDIT: {...}` so values containing path-like text cannot
silently grant other edit obligations.

Workers re-read `task show`, inspect the exact current field and checkpoint the
observation time, raw value, reviewed normalizer evidence and needed change or
no-change decision before editing. Missing declarations, including older
packets that only name files, mean verify first. Stale or unclear premises need
an orchestrator correction, not guessed data churn. Required command, lock,
ownership and verification limits are unchanged.

Semantic equivalence is not inferred by the raw JSON checker. Review it through
the owning domain logic; a raw from/to difference does not prove a change is
needed. This contract does not automatically discover every data instruction in
arbitrary prose, cover non-JSON formats, certify future freshness, authorize a
script or provide an atomic transaction across filesystem reads and dispatch.
Recheck under the actual owned lock before writing; preserve unfinished data
intent and explain any necessary representation change.

##### Resolve Discovery Before Dispatch (WF-G333)

Implementation plans reject descriptive `discover`, `find`, `locate` or `maybe`
owned-file entries, bare TODO/TBD targets and angle-bracket placeholders. Explicit
pending markers in Scope or Guidance are rejected too, before presence, campaign,
task mutation or worker launch. Direct ownership analysis uses the same check.
Resolve the source audit and replace the pending markers with the actual plan;
adding one real filename does not satisfy another unnamed requirement. Historical
`EVIDENCE:`, `HISTORY:` and `SNAPSHOT:` context remains distinct. Ordinary game
discovery wording and literal intentional new-file paths remain available.

Record the search command, directories and current source evidence in the task.
If no relevant implementation is found, state the limits of that search rather
than claiming global absence. The parent chooses the new location, traces the
needed wiring, assigns exact paths and records `CREATES:` intent. A separate
read-only discovery pass is valid; it is not a ready implementation packet.
Unmarked English still requires manual review. No marker check executes a search,
chooses a product location or proves every semantic dependency.

**Current settings source map, checked 2026-10-09:** global player settings are
flat fields on `GameState` in `src/types/state.ts`. Rules edition is defined in
`src/config/rulesEdition.ts`, initialized in `src/state/initialState.ts`, and
updated by `SET_RULES_EDITION` in `src/state/appState.ts` with its action type in
`src/state/actionTypes.ts`. During play, the Rules control is in
`src/components/ActionPane/SystemMenu.tsx`; its props flow through
`src/components/ActionPane/index.tsx`, `src/components/layout/GameLayout.tsx` and
`src/components/screens/PlayingScreen.tsx` from `src/App.tsx`. Before character
creation, the edition control is in `src/components/layout/MainMenu.tsx`, passed
through `src/components/screens/MainMenuScreen.tsx` from `src/App.tsx`. Inspect
that chain before prescribing a new global-settings component. AI-provider and
Gemini-fallback settings are separate surfaces, not interchangeable player menus.

The original WF-G333 zero-hit rulesEdition search was historical: these sources
now exist. Do not copy its absence claim into a new task. Recheck with a bounded
read-only search, for example:

```powershell
rg --no-ignore -n "rulesEdition|SET_RULES_EDITION|cycle_rules_edition|onCycleRulesEdition" src/config/rulesEdition.ts src/types/state.ts src/state/initialState.ts src/state/actionTypes.ts src/state/appState.ts src/components/ActionPane src/components/layout/MainMenu.tsx src/components/layout/GameLayout.tsx src/components/screens src/App.tsx
```

This source map and command do not authorize game changes, a new settings UI,
server startup or broader verification. Workers self-check the current named
sources and escalate missing surfaces before editing.

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

### Recovering a Bad File Edit (WF-G260)

Use the existing advisory lock workflow, not a Git reset or an exception to the
shared-checkout guard. New CLI file-lock grants capture the dirty bytes first
observed after grant into the ignored per-lock snapshot home. Before recovery,
inspect `lock --restore <exact-file>` and review the entire current diff. A later
peer edit means the whole-file restore is not appropriate; plan a surgical repair
or ask the owning peer. Only acknowledge `--expect-current <sha256>` after that
review and within the agent's authorized scope.

The current authenticated holder must still own the exact file with enough lease
headroom. Snapshot identity, bearer seal, bytes, target identity and canonical
peer overlap are checked again before writing. Current bytes are retained first.
`lock --restore` keeps the lock; `unlock --revert` releases only the selected
target after success. Refusal, interruption or failed verification keeps the lock;
do not automatically retry. A partial write or failed targeted unlock must be
reported separately from a completed recovery.

Snapshot capture is a bounded post-grant observation, not physical exclusion or
server-side lock-time atomicity. The first baseline is never refreshed on renewal.
Legacy grants have no retroactive baseline. Exact regular files are supported;
directories/globs, missing/deleted paths, large files, links, Git internals and
Agora runtime files need another preservation-safe plan. Use a fresh stable-entry
invocation of the tested published client; cached older entry modules do not gain
new refusal guards. Do not distribute recovery instructions before publishing
and proving the new client. Ordinary legacy commands remain compatible.

See [Local File Recovery](./PROTOCOL.md#local-file-recovery-wf-g260). Proof uses
disposable locked files. It is not authorization to restore real shared files,
restart services, commit, push or widen ownership. Retain receipts in ignored
scratch, never snapshot contents or bearer tokens in tracked task results.

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
