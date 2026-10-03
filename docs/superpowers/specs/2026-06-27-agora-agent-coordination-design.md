# Agora - Local Peer-Agent Coordination System

**Date:** 2026-06-27
**Status:** Core coordination system (2026-06-27) - design approved and BUILT; the daemon, API, dashboard, and client all ship.
**Amended:** 2026-08-28 - campaign system specification added below (sections 1-17). PROPOSED, not built.
**Amended:** 2026-08-28 - self-validating campaign charter and trial-by-fire plan added (sections 18-28). PROPOSED, not built; no board task was seeded and no Plan Map entry was changed.
**Amended:** 2026-08-29 - Remy settled eight decisions (sections 29-36). Those DECISIONS are final; the code is still proposed. Where a decision contradicts sections 1-28, the decision wins.
**Amended:** 2026-08-30 - four more decisions settled (sections 37-43), closing the open questions from section 36 and revising the phase order.
**Amended:** 2026-08-30 - the last two open values settled (sections 44-47). All fourteen questions are answered.
**Amended:** 2026-08-30 - D-P settles the seat name source (section 48). All fifteen questions are answered; nothing is open but approval and build work.
**Amended:** 2026-08-31 - six build-shaped decisions settled (sections 49-57). Three carry a named cost, and each gets a constraint rather than a softening.
**Owner:** Remy

## Problem

Multiple Claude Code (and other) agents run concurrently on this machine against the
**same** Aralia checkout (`F:\Repos\Aralia`). They have no way to coordinate, so they
clobber each other - most destructively via `git reset --hard`, which wipes a sibling's
uncommitted work (see project memory `concurrent-forks-shared-tree` /
`multi-agent-shared-repo-worktree`). Today's only mitigation is "manually use a git
worktree," which agents rarely remember to do.

There is prior art at `.agent/orchestration/` (the "cockpit" + `activity.jsonl`), but it
is a **hub-and-spoke** model: one orchestrator dispatching work *down* to cheaper external
agents (codex/gemini/jules/qoder). What's missing is **peer-to-peer** coordination among
co-equal agents working the same tree: a shared place to announce presence, claim/lock
files, post and claim tasks, and message each other.

## Goal

A local **daemon** that is the single source of truth for a small set of coordination
primitives, exposed over HTTP with a **real-time (SSE) feed** and a **live web dashboard**,
plus a **discovery layer** so any cold-start agent finds and uses it. Named **Agora** (the
Greek assembly/marketplace - the commons where the agents meet).

## Non-Goals

- **Not** an enforcement mechanism. With no Claude-Code hooks (explicit decision), the
  daemon cannot physically block a file write. **Locks are advisory / cooperative** - they
  work because every agent chooses to check in. The dashboard exists partly so a human can
  spot collisions the honor system misses.
- **Not** a replacement for the existing external-dispatch cockpit. This is a fresh,
  dedicated surface; the two can be cross-linked later but are not merged here.
- **Not** a git-merge automation tool. Agents share one tree; Agora coordinates *intent*
  (who's touching what), it does not arbitrate git operations directly beyond letting
  agents lock paths before a risky `reset`/`checkout`.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Isolation reality | Same shared checkout - locks arbitrate literal file edits |
| Capabilities (v1) | All four: file/resource locks, task board, messaging, presence |
| Interface | Local Node daemon + HTTP API + live dashboard |
| Real-time | **Server-Sent Events (SSE)** push (added on review) |
| Claude-Code hooks | **None** - agents call the API explicitly; locks advisory |
| Dashboard | Fresh, dedicated (not an extension of the cockpit) |
| Storage/runtime | **Single-writer Node daemon, in-memory state + append-only JSONL journal + periodic snapshot.** Zero native deps. |
| Discovery | "Collaborative Spaces" section in `PROJECT_TRACKER.md` + `PROTOCOL.md` + a Skill |

### Why single-writer + JSONL (not SQLite)

Every mutation funnels through one daemon process, so writes are **already serialized** -
we get concurrency safety for free and never need SQLite's locking/ACID machinery (which
on Windows means a native build dependency). State lives in memory; durability is a
periodic JSON **snapshot** plus an append-only **JSONL journal** of every event since the
snapshot. On restart the daemon loads the snapshot and replays the journal tail. This also
matches the existing `.agent/*.jsonl` activity-log convention.

## Architecture

Small, independently-testable units:

- **`tools/agora/store.mjs`** - the single source of truth. Holds in-memory state
  (`agents`, `locks`, `tasks`, `messages`), applies every mutation through one path, and
  for each mutation (a) appends an event to the JSONL journal, (b) fans the event out to
  live SSE subscribers via an in-process pub/sub, (c) periodically writes a snapshot.
  Pure logic given (current state, event) -> next state; unit-testable without the network.
- **`tools/agora/server.mjs`** - thin HTTP layer (Node built-in `http`, no framework):
  routing, JSON parse/serialize, auth-token check, and the SSE endpoint. Delegates ALL
  state changes to the store. Serves the dashboard's static files.
- **`tools/agora/dashboard/index.html`** - self-contained vanilla-JS page. Subscribes to
  `GET /events` via the browser-native `EventSource` and live-renders four panels:
  presence, locks, task board, message feed. No build step, no framework.
- **`tools/agora/client.mjs`** - optional thin CLI so a human or agent can run
  `node tools/agora/client.mjs lock src/foo.ts` (and `register`, `tasks`, `say`, `watch`)
  without curl boilerplate. `watch` streams the SSE feed via Node.
- **`tools/agora/PROTOCOL.md`** - the full API reference + etiquette.

**Code location:** `tools/agora/` is committed and versioned (shared across agents).
**Runtime state location:** `.agent/agora/` (snapshot + journal) is **gitignored**, so a
sibling's `git reset --hard` cannot nuke the coordination state. (Note: `git clean -fdx`
still would; documented as a known caveat in PROTOCOL.md.)

## Data model

```
Agent   { id, handle, token, registeredAt, lastSeen, status, note }
Lock    { id, paths[], globs[], agentId, reason, createdAt, expiresAt }
Task    { id, title, body, state, createdBy, claimedBy?, createdAt, updatedAt, history[] }
Message { id, seq, from, to, body, createdAt }     // to = agentId | "all"
Event   { seq, type, payload, ts }                  // journal + SSE envelope
```

- `Task.state` ∈ `open | claimed | in_progress | blocked | done`.
- `Message.seq` is a monotonic integer cursor for `?since=` polling and SSE resume.
- Presence: any authenticated API call refreshes the caller's `lastSeen`. An agent is
  **online** if seen within the presence TTL, else **stale**, else (after a longer grace)
  dropped from the active list.

## HTTP API (default port 4319, configurable via `--port` / `AGORA_PORT`)

Auth: `register` returns a `token`; all mutating calls send `Authorization: Bearer <token>`.

**Presence**
- `POST /agents/register {handle, note?}` -> `{agentId, token, handle}`
- `POST /agents/heartbeat` -> refresh `lastSeen` (optional; any call also refreshes)
- `GET  /agents` -> active agents with status

**Locks (advisory)**
- `POST   /locks {paths?[], globs?[], reason?, ttlMs?}` -> `201 {lock}` or
  `409 {conflict: {path, heldBy, lock}}`
- `GET    /locks` -> all active locks
- `DELETE /locks/:id` -> release (holder or admin only)
- Locks auto-expire at `expiresAt` (default TTL 30 min) so a dead agent never deadlocks.

**Task board**
- `POST /tasks {title, body?}` -> `{task}` (state `open`)
- `POST /tasks/:id/claim` -> state `claimed`, `claimedBy = caller`
- `POST /tasks/:id/state {state}` -> transition (e.g. `in_progress`, `blocked`, `done`)
- `POST /tasks/:id/handoff {toAgentId}` -> reassign
- `GET  /tasks` -> board, filterable by `?state=`

**Messaging**
- `POST /messages {to, body}` -> `{message}` (`to` = agentId or `"all"`)
- `GET  /messages?since=<seq>&to=<me|all>` -> messages after cursor

**Real-time**
- `GET /events?since=<seq>` -> **SSE** stream of all events (presence/lock/task/message).
  Browser dashboard uses `EventSource`; agents may `curl -N` it; both can resume via
  `since`. Heartbeat comment line every ~20 s keeps the connection alive.

**Meta**
- `GET /health` -> `{ok, version, uptime, counts}` (cheap "is the daemon up?" probe)
- `GET /` -> dashboard

## Lifecycle & durability

- **Start:** `node tools/agora/server.mjs` (a `package.json` script, e.g. `npm run agora`).
  Loads latest snapshot from `.agent/agora/snapshot.json`, replays
  `.agent/agora/journal.jsonl` tail, begins serving.
- **Mutate:** store applies -> appends to journal -> fans out SSE -> updates in-memory state.
- **Snapshot:** every N events or T seconds, write snapshot + truncate journal to events
  after the snapshot point (atomic write-then-rename).
- **Expiry sweep:** a periodic timer expires stale locks and demotes/drops stale agents,
  emitting `lock.expired` / `agent.stale` events like any other mutation.
- **Stop:** SIGINT writes a final snapshot.

## Discovery (make-or-break, since locks are advisory)

1. **Project tracker section** - a new **"🏛️ The Agora - Agent Collaborative Spaces"**
   block near the top of `docs/projects/PROJECT_TRACKER.md`: how to check the daemon is up
   (`GET /health`), how to start it, the endpoint cheat-sheet, and the **etiquette**:
   *register on arrival -> lock paths before editing -> post a task / say what you're doing ->
   release on done -> heartbeat occasionally.*
2. **`tools/agora/PROTOCOL.md`** - full API + data model + caveats, linked from the tracker.
3. **A Skill** (`agora-coordination`) - so a cold-start Claude session auto-discovers the
   protocol the Claude-native way, complementing the HTTP interface. The skill teaches the
   register->lock->work->release loop and the curl/client snippets.

## Testing

- **`store.mjs` unit tests** (the tricky logic, no network):
  - lock granted on free path; `409` conflict on overlapping path/glob; release frees it
  - lock auto-expiry at `expiresAt`
  - task transitions: open->claim->in_progress->done; double-claim rejected; handoff reassigns
  - message `?since=` cursor filtering; direct vs broadcast routing
  - presence TTL: online -> stale -> dropped
  - journal replay: snapshot + journal tail reconstructs identical state
- **API tests** against an in-memory store: auth-token enforcement, status codes, SSE
  envelope shape.
- **Manual proof:** start daemon, open dashboard, register two agents via `client.mjs`,
  watch a lock conflict + a message appear live in the dashboard (SSE), capture to
  `.agent/scratch/` per the temp-proof rule.

## Build slices (for the implementation plan)

1. **Store + journal/snapshot** (`store.mjs` + tests) - the heart, fully testable alone.
2. **HTTP server + API** (`server.mjs`) over the store, incl. auth + `/health`.
3. **SSE feed** (`/events` + store pub/sub) and resume-by-`since`.
4. **Dashboard** (`dashboard/index.html`) consuming SSE.
5. **Client CLI** (`client.mjs`) incl. `watch`.
6. **Discovery** - `PROTOCOL.md`, tracker section, `agora-coordination` skill, `.gitignore`
   entry for `.agent/agora/`, `npm run agora` script.

## Open caveats (documented, not blocking)

- Advisory locks ≠ enforcement; honor system + human dashboard oversight.
- `git clean -fdx` would still remove gitignored runtime state.
- Agents in single-shot Bash calls can't hold a long-lived SSE stream within one tool call;
  they poll `?since=` instead. SSE is primarily for the dashboard and `client.mjs watch`.

---

# Campaign system specification (added 2026-08-28)

**Section status:** PROPOSED design. Only the "Verified today" table below describes shipped code.
**Section author:** `specwright-fde383` (Agora agent `636a619b-b3af-4bb4-aa84-085f33af212c`,
session `7101dbf9-b2b9-4414-bed5-efb2812bed09`, model claude-opus-5).
**Accountable owner:** Remy (human operator).
**Approvers:** Remy, plus the master orchestrator for each implementation phase.
**Primary Plan Map reference:** `planmap:master-orchestrator` (feature *campaign adopt endpoint*).
**Supporting Plan Map references:** `planmap:agora-fleet-coordination`,
`planmap:agora-operator-dashboard`.

The 2026-06-27 sections above stay as written. They record why Agora exists and why it uses a
single-writer daemon. Campaigns did not exist at that date. This section adds them.

## 1. Why this section exists

Campaigns today govern ownership. They do not describe intent.

A campaign record holds an id, an owner, a scope string, and a file list. It holds no mission, no
outcome, no milestones, and no completion test. A reader cannot tell what a campaign tries to
achieve, how far it got, or what to do with its leftover tasks. Ten of the thirteen live campaigns
sit in state `active` with a dead owner. Nobody can close them, because only the owner may change
state, and the owner is gone.

This section specifies the missing half: intake, charter, hierarchy, tracking, and cleanup.

## 2. Verified today (shipped behavior, 2026-08-28)

Evidence comes from the source files named, and from the live daemon on port 4319
(`/health` reported 13 campaigns, 71 tasks, version 0.3.0).

| Behavior | Where | Confirmed state |
|---|---|---|
| Campaign record shape | `store.mjs:1417` | `{ id, role, leadCampaignId, agentId, scope, paths[], globs[], wave, state, warnings[], createdAt, updatedAt, history[] }` |
| Campaign states | `store.mjs:28` | `active`, `blocked`, `done`. Three only. |
| Campaign roles | `store.mjs:29` | `lead`, `deputy`. One nesting level, for governance only. |
| Lead overlap refusal | `store.mjs:1389` | A second live lead over the same path or glob gets `409`. |
| Deputy join | `store.mjs:1406` | A deputy must name a live lead. Sibling overlap raises a warning, not an error. |
| Owner liveness | `store.mjs:1329` | Tri-state `online`, `stale`, `gone`. `gone` means silent past 60 min. |
| Adoption | `store.mjs:1379` | ALREADY IMPLEMENTED as a side effect of re-claim. A gone owner's active campaign may be re-claimed under the same id. `createdAt` survives. History gains `{ action: 'adopted', previousOwner }`. |
| State change authority | `store.mjs:1451` | Owner only. No override path exists. |
| Task-to-campaign link | `store.mjs:1484` | `task.campaignId`, validated against known campaigns. One level. No milestone field. |
| Lane-scoped pull | `store.mjs:1658` | `claimNextReady` filters by `campaignId` and `category`. |
| Task graph fields | `store.mjs:1747` | `ready`, `depStates`, `gates` computed per read, never persisted. |
| Task timestamps | `store.mjs:1518` | `createdAt`, `updatedAt`, and a `history[]` of `created`, `claimed`, `state`, `handoff`, `reaped` entries with `at` and `by`. |
| Agent attribution | `store.mjs:1577` | `claimedBy`, `claimedAgent`, `assignedPet` snapshots, plus `creatorAgent`. |
| HTTP surface | `server.mjs:469,493,505` | `POST /campaigns`, `GET /campaigns`, `POST /campaigns/:id/state`. Nothing else. |
| CLI surface | `client.mjs:1060,1089,1112` | `campaign claim`, `campaign state`, `campaigns`. |
| Dashboard | `dashboard/index.html:2248,1846` | Campaign panel, `adoptable` badge, and an inspector that lists campaign tasks and deputy campaigns. |
| Plan Map derivation | `orchestrate.mjs:321` | `orchestrate seed` reads `public/planmap/topics.json` and builds the campaign id `planmap:<campaign-key>:<topic-ids>` plus a scope label. |
| Test coverage | `store.orchestration.test.mjs`, `server.orchestration.test.mjs`, `client.orchestration.test.mjs` | Four campaign tests: overlap refusal, tri-state owner plus adoption history, task namespace and restart survival, CLI claim and list. |

### What is NOT implemented today

- No campaign tier, effort, or risk field.
- No charter, mission, outcome, or completion test.
- No milestone or workstream record.
- No Plan Map reference field on the campaign record. The Plan Map link survives only inside the
  campaign id string, and the daemon never validates it.
- No `POST /campaigns/:id/adopt` route. The Plan Map lists this as `specced` under
  `master-orchestrator`, yet implicit adoption already works through re-claim.
- No triage report, no per-task disposition, and no closure path for a dead owner's campaign.
- No campaign progress figure anywhere.

## 3. Vocabulary and layer separation

Four layers hold four different kinds of fact. Keep them apart. `PLANNING-STACK.md` sets the
parent rule: one truth per fact, everything else a projection.

| Layer | Owns | Home | Lifetime |
|---|---|---|---|
| Plan Map | Durable roadmap intent. What we mean to build, and why. | `public/planmap/topics.json` | Years. Survives every wave. |
| Campaign charter | Operational plan for one bounded effort. Mission, scope, milestones, tests. | Agora daemon record, git-ignored | One campaign. |
| Agora task | Live execution state. Who holds it, what changed, what proof exists. | Agora daemon record, git-ignored | Hours to days. |
| Dashboard | The joined view. Computes progress and warnings. Owns nothing. | `dashboard/index.html` | Render time only. |

**Warning - a name collision already causes confusion.** The Plan Map uses the word "campaign" for
a color-coded taxonomy lane, such as `rendering` or `agents`. Agora uses the same word for an
owned file domain. They are unrelated. Gap `WF-G60` records the failed attempt to use a Plan Map
lane id as an Agora campaign id. This specification always writes **Plan Map lane** for the first
sense and **campaign** for the second.

## 4. Regular tasks and campaign tiers

A micro effort is a plain Agora task. It gets no campaign, no charter, and no intake. Campaigns
start at the small tier.

Four measures set the tier. Take the highest tier that any single measure reaches.

| Measure | small | standard | large |
|---|---|---|---|
| Expected effort (agent-hours) | up to 4 | 4 to 20 | more than 20 |
| Expected task count | 2 to 5 | 6 to 20 | more than 20 |
| Expected affected files | up to 10 | 11 to 50 | more than 50 |
| Coordination and impact risk | low | medium | high |

**Escalation rule.** Risk and effort escalate the required intake level on their own. A campaign
that names 4 tasks but touches a public API, the daemon protocol, or the save format takes the
`large` intake. Record the escalation reason in the charter. Never lower a tier to skip work.

### Requirements matrix

`R` means required. `O` means optional. `-` means not required.

| Charter field | small | standard | large |
|---|---|---|---|
| `mission` | R | R | R |
| `outcome` | R | R | R |
| `planMapPrimary` | R | R | R |
| `planMapSupporting[]` | - | O | O |
| `currentState` | O | R | R |
| `scope[]` | R | R | R |
| `nonScope[]` | O | R | R |
| `tier` | R | R | R |
| `effort` | R | R | R |
| `risk` | R | R | R |
| `affectedDomains[]` | O | R | R |
| `milestones[]` | - | R | R |
| `workstreams[]` | - | O | R |
| `dependencies[]` | O | O | R |
| `acceptance[]` | R | R | R |
| `verification` | R | R | R |
| `adoptionPolicy` | O | R | R |
| `owner` | R | R | R |
| `approvers[]` | R | R | R |
| `author` | R | R | R |
| `revisions[]` | R | R | R |
| `openDecisions[]` | O | O | R |
| `escalationPath` | - | O | R |
| Risk and dependency review | - | - | R |
| Human approval before `active` | - | - | R |

## 5. Roles and accountability

One campaign has exactly one accountable owner. Many roles may draft or review it. Only the owner
answers for it.

| Role | May do | May not do |
|---|---|---|
| Campaign creator | Draft the charter. Propose tier, scope, and Plan Map references. | Approve the charter. |
| Lead orchestrator | Own the campaign. Seed tasks. Change campaign state. Run triage. | Approve a `large` charter alone. |
| Master orchestrator | Approve small and standard charters. Authorize adoption and triage. Force closure. | Skip human approval for a `large` campaign or a destructive action. |
| Planning agent | Generate a draft charter from a Plan Map topic. Suggest milestones. | Approve, seed, or adopt. |
| Human operator | Approve any charter. Approve destructive actions and Plan Map overrides. Pause or kill a campaign. | - |
| Worker agent | Claim tasks in the campaign. Post results. Raise blockers. | Change campaign state or charter. |

Every campaign requires orchestrator involvement at intake, at every tier. The small tier gets a
light but mandatory review, not a bypass.

## 6. The campaign charter

The charter is the operational specification. It lives in the daemon record, not in a repository
file. The dashboard renders it.

| Field | Type | Meaning |
|---|---|---|
| `mission` | string, 1 sentence | Why this campaign exists. |
| `outcome` | string | The observable end state. Written so a reader can tell if it arrived. |
| `planMapPrimary` | ref | Exactly one `planmap:<topic>` or `planmap:<topic>/<feature>`. |
| `planMapSupporting[]` | ref[] | Extra topics the work touches. |
| `currentState` | string | What exists now, before the campaign. |
| `scope[]` | string[] | What this campaign will change. |
| `nonScope[]` | string[] | What it deliberately will not change. |
| `tier` | enum | `small`, `standard`, `large`. |
| `effort` | object | `{ agentHours, taskCount, fileCount }`, all estimates. |
| `risk` | enum | `low`, `medium`, `high`, plus a one-line reason. |
| `affectedDomains[]` | string[] | Architecture domains, from `docs/architecture/domains/`. |
| `milestones[]` | node[] | Ordered planning nodes. See section 8. |
| `workstreams[]` | node[] | Parallel lanes. See section 8. |
| `dependencies[]` | ref[] | Other campaigns or Plan Map topics that must land first. |
| `acceptance[]` | string[] | Testable completion criteria. |
| `verification` | string | How the outcome gets proved. Names tests, screenshots, or live probes. |
| `adoptionPolicy` | enum | `reclaim`, `close-on-abandon`, or `escalate`. Sets the default triage advice. |
| `owner` | agentRef | The accountable identity. |
| `approvers[]` | agentRef[] | Who approved, and at what time. |
| `author` | agentRef | Who drafted it. |
| `revisions[]` | entry[] | `{ at, by, summary }` per edit. Append only. |
| `openDecisions[]` | entry[] | Unresolved calls, each with an owner. |
| `escalationPath` | string | Who to wake, and when. |

**Validation.** Refuse a charter that misses a required field for its tier. Refuse a charter whose
`acceptance[]` is empty. Warn when `nonScope[]` is empty on a standard or large campaign, because
an unbounded scope is the common failure.

## 7. The Plan Map contract

Every campaign must carry a valid Plan Map connection. The connection proves that the work serves
a recorded roadmap intent, and not an agent's own invention.

### Rules

1. Exactly one `planMapPrimary`. Never zero. Never two.
2. Supporting references are optional. They mainly serve standard and large campaigns.
3. A large campaign that names supporting topics in a different Plan Map lane must record a
   cross-lane justification in the charter.
4. Validation checks four things at intake, and again on every campaign read:
   - the topic id exists in `public/planmap/topics.json`;
   - the feature slug, when given, resolves inside that topic;
   - the topic status is not `superseded`;
   - the topic status does not contradict the campaign state. An `active` campaign against a
     `done` topic is a contradiction.

### Graduated handling of a bad reference

Apply the first step that fits. Escalate only when the step fails.

| Step | Condition | Action |
|---|---|---|
| 1. Auto-refresh | The topic moved or the slug changed, and the new target is unambiguous. | Re-derive the reference. Record the change in `revisions[]`. |
| 2. Repair task | The Plan Map itself is wrong or missing an entry. | Create a Plan Map repair task. Link it to the campaign. Continue other work. |
| 3. Split | Some workstreams hold valid references and some do not. | Keep valid workstreams running. Move invalid ones to step 4. |
| 4. Quarantine | The affected work cannot proceed safely. | Freeze the affected tasks. Block new claims on them. |
| 5. Needs-review | The campaign or a workstream carries an unresolved reference. | Mark it `needs-review`. Show the warning on the dashboard. |
| 6. Documented override | An orchestrator judges the reference acceptable as-is. | Require a written reason in `openDecisions[]`. |
| 7. Human approval | The override is high risk. | Block until a human approves. |
| 8. Block | The affected work still has no valid reference. | Refuse claims on that work. |
| 9. Escalate and pause | The core `outcome` depends on the broken reference. | Pause the whole campaign. Notify the escalation path. |

A stale reference never silently disappears, and it never silently stops the work either.

## 8. Campaign hierarchy

Use a hybrid shape. Campaigns hold planning nodes. Planning nodes hold ordinary tasks.

```
campaign
  └── milestone            (planning node - a checkpoint in time)
        └── workstream     (planning node - a parallel lane)
              └── task     (ordinary Agora task - the only executable leaf)
```

### Rules

- **Tasks stay ordinary.** A campaign task is a normal board task. It appears on the global task
  board, obeys the same state machine, and is claimable by the normal `task next` path. This
  avoids a second, disconnected execution system.
- **Only tasks execute.** A milestone and a workstream never get claimed and never get a result.
  They aggregate.
- **Planning nodes may exist alone.** A milestone with no tasks yet is legal. It marks intent.
- **Membership is a task field.** A task carries `campaignId`, `milestoneId`, and `workstreamId`.
  All three are optional. A task with `campaignId` and no milestone belongs to the campaign root.
- **Depth is capped at three planning levels**, that is campaign, milestone, workstream. Deeper
  nesting needs an explicit charter opt-in and a master-orchestrator approval, because a deep tree
  hides work rather than organizing it.
- **Dependencies stay on tasks.** Existing task `deps[]` already gates readiness. A milestone
  computes its readiness from its tasks. Never add a second dependency mechanism.
- **Readiness rolls up.** A milestone is `ready` when every task it holds is `ready` or `done`. A
  milestone is `blocked` when any task is `blocked`.

## 9. Campaign lifecycle

Campaign state is separate from task state, from owner liveness, and from the dashboard badge.
Keep the four apart. Today's code conflates the first three, and that is why ten campaigns are
stuck.

| Axis | Values | Source |
|---|---|---|
| Technical state | `draft`, `needs-review`, `approved`, `active`, `blocked`, `triage`, `adopted`, `closing`, `done`, `closed`, `quarantined` | The campaign record. |
| Owner liveness | `online`, `stale`, `gone` | Computed from presence. Never stored. |
| Disposition | `adoptable`, `escalated`, `paused` | Computed from state plus liveness. |
| Task state | `open`, `claimed`, `in_progress`, `blocked`, `done` | The task records. Unchanged. |

`adoptable` is a computed label, not a state. A campaign is adoptable when its state is `active`
and its owner liveness is `gone`. This matches today's code, and this specification keeps it.

### Legal transitions

| From | To | Who | Note |
|---|---|---|---|
| - | `draft` | creator | Charter starts empty. |
| `draft` | `needs-review` | creator | Submit for intake. |
| `needs-review` | `draft` | orchestrator | Changes requested. |
| `needs-review` | `approved` | master orchestrator; human for `large` | Charter validation must pass. |
| `approved` | `active` | owner | Task seeding may now start. |
| `active` | `blocked` | owner | A named blocker is required. |
| `blocked` | `active` | owner | Blocker cleared. |
| `active` | `triage` | master orchestrator or human | Only when the campaign is adoptable. |
| `triage` | `adopted` | successor | After task dispositions are approved. |
| `adopted` | `active` | successor | Work resumes under the new owner. |
| `active` | `closing` | owner | Acceptance criteria met, verification pending. |
| `closing` | `done` | owner, plus one approver | Verification evidence recorded. |
| `done` | `closed` | master orchestrator | Archive. No further mutation. |
| any | `quarantined` | master orchestrator or human | Plan Map contradiction or safety hold. |
| `quarantined` | `needs-review` | human | Released after repair. |

Every transition writes a history entry with actor, time, prior state, new state, and reason. The
daemon refuses a transition with no reason on `blocked`, `quarantined`, and `closed`.

## 10. Adoption and triage

### Detection

A campaign becomes adoptable with no human action. The daemon already computes this. An `online`
owner is never adoptable. A `stale` owner is never adoptable. Only `gone` qualifies.

### Workflow

1. **Detect.** The dashboard shows the `adoptable` badge. No state changes yet.
2. **Report.** The daemon generates a read-only triage report. It changes nothing. It lists the
   charter, the Plan Map references and their validity, each milestone, and every task with its
   state, last actor, last activity time, and any result.
3. **Start.** An authorized master orchestrator, an authorized orchestrator, or a human starts
   triage explicitly. The campaign moves to `triage`. No implicit start exists.
4. **Review.** The successor reads the charter, the references, the milestones, the scope, and the
   task graph.
5. **Recommend.** The system proposes a disposition for each task. The recommendation is advice.
6. **Approve.** The successor approves each task action one at a time. Bulk approval is refused.
7. **Guard.** A destructive or high-risk action needs separate human approval.
8. **Record.** Every action writes actor, timestamp, reason, prior state, new state, and evidence.

### Per-task dispositions

| Disposition | Meaning | Risk |
|---|---|---|
| `continue` | Keep as-is under the new owner. | low |
| `reopen` | A dead claimant held it. Return it to `open`. | low |
| `reassign` | Hand to a named live agent. | low |
| `merge` | Fold into another task, which becomes the survivor. | medium |
| `block` | Hold behind a named blocker. | low |
| `close-obsolete` | The work no longer applies. Close with a reason. | high - human approval |
| `escalate` | The successor cannot judge it. Raise it. | low |

`close-obsolete` and `merge` destroy or hide work. Neither runs without recorded approval. This
preserves the existing Agora principle that no task is silently destroyed.

### If the original owner returns

- **Before triage starts.** The original owner re-registers and re-claims. The campaign stays
  theirs. Nothing changes. Record a `resumed` history entry.
- **During triage.** The successor holds the campaign. The daemon notifies both parties. The
  original owner may not seize it back. A human resolves the conflict.
- **After adoption.** The successor is the owner. The original owner joins as a deputy or as a
  worker. Ownership never flips back without an explicit, recorded handoff. This keeps the
  "no silent ownership takeover" rule intact in both directions.

## 11. Authorization matrix

| Action | creator | worker | orchestrator | master | human |
|---|---|---|---|---|---|
| Create a campaign draft | yes | no | yes | yes | yes |
| Submit intake | yes | no | yes | yes | yes |
| Approve a small or standard charter | no | no | no | yes | yes |
| Approve a large charter | no | no | no | no | yes |
| Seed tasks | no | no | owner only | yes | yes |
| Claim a campaign task | yes | yes | yes | yes | - |
| Change campaign state | no | no | owner only | yes | yes |
| Adopt an adoptable campaign | no | no | yes | yes | yes |
| Start triage | no | no | yes | yes | yes |
| Approve a low-risk task disposition | no | no | successor | yes | yes |
| Approve `close-obsolete` or `merge` | no | no | no | no | yes |
| Override a Plan Map contradiction, low risk | no | no | yes, with a reason | yes | yes |
| Override a Plan Map contradiction, high risk | no | no | no | no | yes |
| Pause or quarantine a campaign | no | no | no | yes | yes |

The existing safety principles hold without change. Locks stay advisory. The daemon stays the
single writer. Every mutation stays auditable. No ownership transfer happens silently. No task is
destroyed silently.

## 12. Data model - proposed additions

None of the fields below exist today, unless the Status column says otherwise. Do not implement
them in this task.

### Campaign record

| Field | Type | Required by tier | Source of truth | Persisted | Status |
|---|---|---|---|---|---|
| `charter` | object | all | campaign record | yes, snapshot and journal | proposed |
| `charter.tier` | enum | all | intake | yes | proposed |
| `charter.effort` | object | all | intake estimate | yes | proposed |
| `charter.risk` | enum | all | intake | yes | proposed |
| `charter.planMapPrimary` | string | all | Plan Map, mirrored | yes | proposed |
| `charter.planMapSupporting` | string[] | standard, large | Plan Map, mirrored | yes | proposed |
| `charter.milestones` | node[] | standard, large | campaign record | yes | proposed |
| `charter.workstreams` | node[] | large | campaign record | yes | proposed |
| `charter.acceptance` | string[] | all | campaign record | yes | proposed |
| `charter.approvers` | entry[] | all | campaign record | yes | proposed |
| `charter.revisions` | entry[] | all | campaign record | yes, append only | proposed |
| `state` | enum | all | campaign record | yes | EXISTS, needs the wider enum in section 9 |
| `ownerStatus` | enum | - | computed | no | EXISTS |
| `ownerLive` | boolean | - | computed | no | EXISTS |
| `ownerAlive` | boolean | - | computed in `server.mjs` | no | EXISTS but undocumented - see WF-G82 |
| `planMapHealth` | object | all | computed at read | no | proposed |
| `progress` | object | all | computed from tasks | no | proposed |
| `adoption` | entry[] | - | campaign record | yes | partly EXISTS as `history` entries |

### Planning node record

| Field | Type | Meaning | Persisted |
|---|---|---|---|
| `id` | string | Stable node id. | yes |
| `kind` | enum | `milestone` or `workstream`. | yes |
| `parentId` | string | Campaign id or milestone id. | yes |
| `title` | string | Short label. | yes |
| `intent` | string | What this node achieves. | yes |
| `order` | integer | Display order. | yes |
| `acceptance` | string[] | Node-level completion test. | yes |
| `state` | enum | Computed from member tasks. | no |

### Task record additions

| Field | Type | Meaning | Persisted | Status |
|---|---|---|---|---|
| `campaignId` | string | Campaign membership. | yes | EXISTS |
| `milestoneId` | string | Milestone membership. | yes | proposed |
| `workstreamId` | string | Workstream membership. | yes | proposed |
| `startedAt` | number | First move to `in_progress`. | no - derive from `history` | computable today |
| `completedAt` | number | Move to `done`. | no - derive from `history` | computable today |
| `agentTrail` | entry[] | Every agent that held the task. | no - derive from `history` | computable today |

**Derivation note.** Task start time, completion time, and the actual agent trail are already
recoverable from `task.history[]`. They need a computed projection in `listTasks`, not new stored
fields. Follow the precedent set by `ready`, `depStates`, and `gates`: compute on read, never
persist, so journal replay stays exact.

### Compatibility and migration

- Every new field is additive and optional. An old campaign record loads unchanged.
- A campaign with no `charter` renders as `legacy` on the dashboard. It is readable and closable.
  It is not seedable until a charter is attached.
- The state enum widens. Old values `active`, `blocked`, and `done` keep their meaning.
- Journal replay must tolerate an event that carries unknown charter keys, so an older daemon can
  read a newer journal without a crash.

## 13. Dashboard campaign tracker

The tracker is a dashboard view. It reads the Agora API. **Do not create a repository tracker
file.** Runtime campaign state stays in the git-ignored daemon state, per the original design.

| Panel element | Data source | Computed or stored |
|---|---|---|
| Plan Map intent and references | `charter.planMapPrimary`, `charter.planMapSupporting`, joined against `topics.json` | stored plus join |
| Charter body | `charter` | stored |
| Tier, effort, risk | `charter.tier`, `.effort`, `.risk` | stored |
| Milestone and workstream tree | planning nodes | stored |
| Nested task tree | tasks filtered by `campaignId`, grouped by node | stored |
| Open, in-progress, blocked, done markers | `task.state` | stored |
| Task start time | `task.history` first `in_progress` entry | computed |
| Task completion time | `task.history` `done` entry | computed |
| Assigned agent | `task.claimedAgent`, `task.assignedPet` | stored |
| Actual agent history | `task.history` claim and handoff entries | computed |
| Dependencies and blockers | `task.deps`, `depStates`, `gates` | computed today |
| Task result and evidence | `task.result`, `resultDisposition`, `finding`, `evidence` | stored today |
| Campaign progress | done tasks over total, per milestone and overall | computed |
| Completion criteria state | `charter.acceptance` against evidence | stored plus manual check |
| Adoption and handoff history | `campaign.history` | stored today |
| Stale reference warnings | `planMapHealth` | computed |
| Unresolved decisions | `charter.openDecisions` | stored |
| Audit trail | `campaign.history` plus `task.history` | stored today |

Roughly half the tracker needs no new storage. Timestamps, agent trails, dependencies, and results
already exist in task history. The genuinely new storage is the charter, the planning nodes, and
the two task membership ids.

## 14. Surface map

| Surface | Existing | Missing | Proposed |
|---|---|---|---|
| `store.mjs` | `claimCampaign`, `setCampaignState`, `listCampaigns` | charter validation, planning nodes, triage, progress | `putCharter`, `validateCharter`, `addPlanningNode`, `startTriage`, `applyDisposition`, `campaignProgress`; widen `CAMPAIGN_STATES` |
| `server.mjs` | `POST /campaigns`, `GET /campaigns`, `POST /campaigns/:id/state` | adopt, charter, nodes, triage | `POST /campaigns/:id/charter`, `GET /campaigns/:id`, `POST /campaigns/:id/adopt`, `GET /campaigns/:id/triage`, `POST /campaigns/:id/triage/:taskId`, `POST /campaigns/:id/nodes` |
| `client.mjs` | `campaign claim|state`, `campaigns` | everything else | `campaign charter`, `campaign show`, `campaign adopt`, `campaign triage`, `campaign milestone`, `campaign progress` |
| `dashboard/index.html` | campaign panel, adoptable badge, inspector | charter, tree, progress, triage UI | campaign tracker view per section 13 |
| `orchestrate.mjs` | derives campaign id and scope from the Plan Map | charter generation, tier gate | emit a draft charter at `seed`; refuse to seed an unapproved campaign |
| `PROTOCOL.md` | campaign governance section | new routes, charter shape, `ownerAlive` | extend the section |
| `ORCHESTRATOR.md` | campaign loop | intake, tiers, triage | add an intake procedure and a triage procedure |
| Tests | 4 campaign tests | see section 15 | roughly 18 new cases |

## 15. Test plan

| Category | Representative case |
|---|---|
| Tier validation | A `large` charter with no `milestones[]` is refused. A `small` charter with no `milestones[]` is accepted. |
| Plan Map primary | A charter with zero primary references is refused. A charter with two is refused. |
| Supporting references | A `small` campaign that names supporting references gets a warning. A `large` cross-lane reference with no justification is refused. |
| Stale reference | A primary reference to a renamed topic auto-refreshes and writes a revision entry. A reference to a `superseded` topic marks the campaign `needs-review`. |
| Charter approval | An orchestrator cannot approve a `large` charter. A human can. |
| Hierarchy | A task with a `milestoneId` from another campaign is refused. A fourth planning level is refused without opt-in. |
| Timestamps | A claim then a `done` yields the correct computed `startedAt` and `completedAt`. |
| Agent attribution | A handoff produces a two-entry `agentTrail`. |
| Readiness | A milestone with one blocked task reports `blocked`. |
| Progress | Six of eight done tasks yield 75 percent, per milestone and overall. |
| Adoptable detection | An `online` owner is not adoptable. A `stale` owner is not adoptable. A `gone` owner is. |
| Adoption authorization | A worker cannot adopt. An orchestrator can. |
| Read-only triage | A triage report changes no record. Compare a state snapshot before and after. |
| Dispositions | Each of the seven dispositions produces the expected task state and a history entry. |
| Destructive approval | `close-obsolete` with no human approval is refused. |
| Owner return | A return before triage restores the owner. A return after adoption does not. |
| Audit and replay | A snapshot plus journal replay reproduces the charter, the nodes, and the adoption history exactly. |
| Dashboard | The tracker renders a legacy campaign with no charter, and filters by tier and by state. |
| Migration | A pre-charter campaign record loads, renders, and can be closed. |

## 16. Implementation phases

Build in this order. Each phase leaves the board working.

| Phase | Content | Gate |
|---|---|---|
| 1 | Schema and validation. Charter fields, tier rules, widened state enum, additive migration. | Store tests pass. Existing 13 campaigns still load. |
| 2 | Plan Map contract. Reference validation, `planMapHealth`, the graduated handling ladder. | Validation catches a real stale reference in `topics.json`. |
| 3 | Intake and approval. Draft, review, approve. `orchestrate seed` refuses an unapproved campaign. | A `large` campaign cannot go `active` without human approval. |
| 4 | Hierarchy and task metadata. Planning nodes, `milestoneId`, `workstreamId`, computed rollups. | A three-level tree renders from the API. |
| 5 | Dashboard tracker. Section 13, in full. | A human reads campaign progress without curl. |
| 6 | Adoption and triage. Report, explicit start, per-task disposition, approval guards. | The ten stuck campaigns get triaged and closed. |
| 7 | API and CLI polish. Full route set, `PROTOCOL.md`, `ORCHESTRATOR.md`. | Docs match the routes. |
| 8 | Migration and verification. Backfill charters for live campaigns. | Zero campaigns in `active` with a gone owner. |

### The smallest useful MVP

Phases 1, 2, and 6, in that order, plus a minimal read view.

Reason: the live pain is not missing intake. It is ten unclosable campaigns and no way to see what
they meant. A charter that holds mission, outcome, tier, and one Plan Map reference, plus a triage
path that can close a dead campaign task by task, fixes the observed damage. Milestones,
workstreams, and the full tracker follow. The target model in this section stays whole; only the
order changes.

## 17. Open decisions and risks

1. **Charter durability.** The charter lives in git-ignored daemon state. A `git clean -fdx`
   destroys it, as the original caveat notes. Decide whether a charter deserves an export path.
   The user requirement forbids a repository tracker file, so any export must be a manual, human
   action, not an automatic write.
2. **Plan Map lane naming.** Two meanings of "campaign" already caused `WF-G60`. Decide whether to
   rename the Plan Map concept to "lane" in `topics.schema.json`. That is a breaking schema change.
3. **Charter authorship.** A planning agent can draft a charter from a Plan Map topic. Decide
   whether a generated charter may enter `needs-review` without a human read.
4. **Effort estimates.** Remy's standing directive forbids time estimates. `charter.effort` sets a
   tier threshold, not a schedule. Decide whether to keep the agent-hour figure, or to tier on task
   count and file count alone. This decision is unresolved and blocks nothing.
5. **Deputy versus workstream.** The `deputy` role and the `workstream` node overlap. Decide
   whether a deputy becomes a workstream owner, or stays a separate governance concept.
6. **Risk - a heavier intake may push agents to skip campaigns.** An agent that wants to avoid a
   charter will file plain tasks instead. Mitigate with the tier rules in section 4, and by keeping
   the small-tier charter genuinely short.
7. **Risk - computed progress can mislead.** Six of eight tasks done says nothing about whether the
   `outcome` arrived. Always show acceptance-criteria state beside the percentage.
8. **Observation, not yet a tracker row.** The Plan Map feature *campaign adopt endpoint* under
   `master-orchestrator` reads as `specced`, yet implicit adoption already ships through re-claim.
   The feature text describes a stricter guarded endpoint that does not exist. Repair the feature
   text when phase 6 lands, rather than now, so the correction matches the shipped behavior.

---

# The self-validating campaign - charter and trial by fire (added 2026-08-28)

**Section status:** PROPOSED. Nothing here is built. No board task was seeded. No Plan Map entry
was changed.
**Section author:** `campaignwright-f4ee8d` (Agora agent `1b49af9d-f8c8-4dbe-a1e6-73bab9e7ed78`,
session `7101dbf9-b2b9-4414-bed5-efb2812bed09`, model claude-opus-5).
**Relationship to the section above:** the previous section defines the target campaign model.
This section defines the first campaign that will *use* that model, and the gates it must pass
before the model is trusted on real abandoned work.

## 18. New facts measured on the live daemon, 2026-08-28

These readings change the plan above. Take them as evidence, not as opinion.

| Reading | Value | Consequence |
|---|---|---|
| Tasks that carry a `campaignId` | **0 of 72** | Every one of the 13 campaigns holds zero tasks. The campaign-to-task link is schema-only. |
| Tasks that carry a `planmap:` ref | 14 of 72 | The working Plan Map link today lives on the **task**, not on the campaign. |
| Campaigns `active` with a `gone` owner | 10 of 13 | Unchanged from the earlier reading. |
| Task history entry shape | `{ at, by, action, state }` | No prior state. No reason. No evidence pointer. |
| `resultDisposition`, `finding`, `evidence` | present on live task records | The WF-G53 work is live. The daemon runs that source. |
| Agent attribution from history | recoverable | A real record shows three successive claimants and a final `done`. |
| `orchestrate seed` packet rule | files must be disjoint | Two packets in one wave may not share a file. |

### What this breaks

**The per-task triage workflow has nothing real to triage.** The earlier section assumed an
adoptable campaign carries orphaned tasks. No campaign carries any task. Stage 2 of the trial
therefore cannot prove per-task disposition against real data. Only a synthetic fixture can.

**Requirement 21 is not satisfiable on today's schema.** The requirement asks every action to
record actor, timestamp, reason, prior state, new state, and evidence. A history entry records the
actor, the timestamp, the action, and the **new** state only. Prior state and reason do not exist.

Both readings are registered as gaps. See section 27.

## 19. Campaign identity and charter

| Field | Value |
|---|---|
| **Campaign id** | `agora-campaign-model-trial` |
| **Mission** | Prove the new Agora campaign model on itself, before it governs any other work. |
| **Outcome** | One campaign carries a validated charter, a milestone tree, and ordinary board tasks. Its progress reads from the dashboard. One real adoptable campaign reaches an auditable closed state, with every action recorded and no silent mutation. |
| **Current state** | Campaigns are ownership shells. Ten sit `active` with a dead owner and cannot be closed. Zero tasks link to any campaign. No charter, tier, risk, milestone, or Plan Map field exists on a campaign record. Adoption ships as a side effect of re-claim; the guarded adopt endpoint does not exist. |
| **Primary Plan Map reference** | `planmap:master-orchestrator/campaign-charter-tiered-intake-plan-map-` |
| **Supporting references** | `planmap:agora-fleet-coordination`, `planmap:agora-operator-dashboard` |
| **Tier** | **standard** |
| **Effort** | 8 to 14 agent-hours; 8 tasks; roughly 12 files |
| **Risk** | **high** |
| **Risk rationale** | The work changes the coordination daemon that every other agent depends on. A store or journal defect stops the whole fleet. The trial also mutates a real campaign record. |
| **Affected domains** | `tools/agora/` daemon, client, dashboard, and orchestrator. No game source. |
| **Adoption policy** | `escalate`. If this campaign is itself abandoned, do not auto-close it. Raise it to the human. |
| **Accountable owner** | The lead orchestrator that claims `agora-campaign-model-trial`. |
| **Approvers** | Remy (human) for the charter and for every Stage 2 action; the master orchestrator for each phase gate. |
| **Author** | `campaignwright-f4ee8d`, 2026-08-28. |
| **Escalation path** | Stop work. Post on the command channel. Wake Remy. Do not improvise a repair on the daemon. |

### Scope

- Charter fields, tier rules, and validation in the store.
- Plan Map reference validation for a campaign.
- A read-only campaign view that joins charter, milestones, and tasks.
- A guarded, read-only triage report.
- Per-task disposition with an approval guard.
- The staged trial in section 22.

### Non-scope

- Workstreams. The trial uses milestones only.
- Nesting deeper than campaign, milestone, task.
- Automatic charter generation from a Plan Map topic.
- Bulk cleanup of the other nine adoptable campaigns. That waits for Stage 3.
- Any change to task state semantics, lock behavior, or the reap horizon.
- Any game-source file.

### Acceptance criteria

1. A charter that misses a required field for its tier is refused, with the field named.
2. A campaign with zero or two primary Plan Map references is refused.
3. A campaign with a primary reference to a missing topic or slug is refused.
4. The campaign view returns charter, milestones, and the task tree in one read.
5. A triage report changes no record. A byte-level before-and-after snapshot is identical.
6. Every task in the trial receives exactly one explicit disposition.
7. A destructive disposition without recorded human approval is refused.
8. Snapshot plus journal replay reproduces the charter, the milestones, and the triage history.
9. One real adoptable campaign ends `done` or `closed`, with a complete audit trail.
10. No campaign, task, lock, or reservation outside the trial changes.

### Verification strategy

- Store-level tests for every acceptance criterion, run against a fresh in-process store.
- Server-route tests against a fresh in-process `createAgoraServer`, per the existing rule.
- A synthetic fixture on a disposable daemon for Stage 1. Never on the shared daemon.
- Stage 2 on the shared daemon, one campaign, with a human present.
- A recorded board result for each task, with the test name and the measured figure.

### Revision history

| At | By | Summary |
|---|---|---|
| 2026-08-28 | `campaignwright-f4ee8d` | First draft. Not yet submitted for intake. |
| 2026-08-30 | `campaignwright-4365d4` | Primary Plan Map reference re-pointed from the adopt feature to the charter feature, per section 20 step 3, now that the repair has landed. The adopt feature was rewritten under D-J and its slug changed. |

## 20. The conflict in the earlier MVP - called out

The earlier section names phases 1, 2, and 6 as the MVP, and says the live pain is ten unclosable
campaigns. That MVP **conflicts with its own rules**, in two ways.

**Conflict 1 - intake before intake exists.** Requirement 5 says every campaign needs orchestrator
intake. Phase 3 builds intake. So phases 1 and 2 would run under no intake at all, and the first
campaign to use the model would be exempt from the model. The fix is not to move phase 3 earlier.
The fix is to accept that **this campaign's intake is manual**: a human and an orchestrator review
this charter by reading it, and record the approval on the board. The charter in section 19 is that
manual intake. Later campaigns get the automated gate.

**Conflict 2 - a Plan Map reference that under-describes the work.** Requirement 9 says exactly one
primary reference. The only exact, existing feature is the adopt endpoint. This campaign also
builds the charter, the tier rules, and the Plan Map contract, which that feature does not mention.
Choosing it is honest about what exists and dishonest about what the campaign does.

Do not resolve conflict 2 by inventing a Plan Map entry. Resolve it in this order:

1. Start the campaign with the adopt-endpoint feature as the primary reference. It is real, it is
   `specced`, and it covers the trial slice that carries the risk.
2. Run the Plan Map repair task in section 24 as the **first** task of the campaign.
3. When the repair lands, re-point the primary reference at the new feature. Record the change in
   the charter revision history.

This is the graduated ladder from the earlier section, step 2, applied to the campaign that defines
the ladder. That is the point of a self-validating campaign.

## 21. Milestones and the task tree

Workstreams are out of scope. The tree is campaign, milestone, task.

```
agora-campaign-model-trial
├── M1  Intake and Plan Map truth
│     ├── T1  Manual intake + charter approval
│     └── T2  Plan Map repair: add the charter/intake feature
├── M2  Schema and validation
│     ├── T3  Charter schema + tier validation (store)
│     └── T4  Plan Map reference contract (store)
├── M3  Read model
│     └── T5  Campaign read model + minimum dashboard view
├── M4  Trial by fire
│     ├── T6  Stage 1 - synthetic fixture on a disposable daemon
│     └── T7  Stage 2 - one controlled real campaign
└── M5  Review
      └── T8  Stage 3 - post-trial review and charter revision
```

| # | Title | Purpose | Milestone | Deps | Owner role | Acceptance evidence | Safe for |
|---|---|---|---|---|---|---|---|
| T1 | Manual intake and charter approval | Record this charter on the board and approve it by hand, because the automated gate does not exist yet. | M1 | - | orchestrator | A board task whose result names the approver, the tier, the risk, and the primary reference. | orchestrator, master, human |
| T2 | Plan Map repair - charter and intake feature | Add one feature to `master-orchestrator` covering charter, tiered intake, and the Plan Map contract. | M1 | T1 | orchestrator | `validate-planmap.mjs` clean; the new slug printed; the charter re-pointed. | orchestrator with human approval |
| T3 | Charter schema and tier validation | Add the charter object, the tier rules, and the requirements matrix to the store. Additive only. | M2 | T1 | worker | Store tests for every required and optional field per tier; all 13 existing campaigns still load. | worker |
| T4 | Plan Map reference contract | Validate the primary reference, reject zero or two, resolve the feature slug, compute `planMapHealth`. | M2 | T3 | worker | Tests for missing topic, missing slug, `superseded` topic, and a status contradiction. | worker |
| T5 | Campaign read model and dashboard view | One `GET /campaigns/:id` that joins charter, milestones, tasks, and computed timestamps. Render section 25. | M3 | T3, T4 | worker | A rendered view of the trial campaign; computed `startedAt`, `completedAt`, and `agentTrail` match the raw history. | worker |
| T6 | Stage 1 - synthetic fixture | Prove adoptable detection, read-only triage, and low-risk dispositions on a disposable daemon. | M4 | T5 | orchestrator | Byte-identical snapshot across report generation; replay reproduces the triage history. | orchestrator |
| T7 | Stage 2 - one controlled real campaign | Triage exactly one real adoptable campaign on the shared daemon. | M4 | T6 | master | Per-task dispositions, full audit trail, and a diff proving no other record changed. | master **plus** human approval per action |
| T8 | Stage 3 - post-trial review | Compare expected against actual. Revise the charter. Decide on the remaining nine campaigns. | M5 | T7 | orchestrator | A revision entry, a gap row per failure, and a written go or no-go. | orchestrator, human |

### Seeding constraints - read before you seed

`orchestrate.mjs:231` refuses a plan where two packets share a file. T3, T4, and T5 all touch
`tools/agora/store.mjs`. **They cannot be three packets in one wave.** Choose one:

- seed them as three sequential waves, one packet each; or
- seed one packet that owns `store.mjs` across T3 and T4, and a second wave for T5.

The sequential form is preferred. It keeps one writer on the daemon source at a time, which is the
right posture for a high-risk campaign.

**No board task was created.** The plan below is ready to seed and needs operator authorization.

```json
{
  "wave": "agora-campaign-model-trial-w1",
  "pet": "<orchestrator-pet-slug>",
  "baseUrl": "http://localhost:4319",
  "campaign": {
    "id": "agora-campaign-model-trial",
    "role": "lead",
    "scope": "Self-validating campaign: charter schema, Plan Map contract, read model, trial by fire",
    "paths": ["tools/agora/store.mjs", "tools/agora/server.mjs", "tools/agora/client.mjs"],
    "globs": ["tools/agora/dashboard/**"]
  },
  "packets": [
    {
      "id": "PK-charter-schema",
      "handle": "agora-charter-schema",
      "pet": "<worker-pet-slug>",
      "agent": "codex",
      "scope": "Charter object, tier rules, and per-tier required-field validation in the store",
      "files": ["tools/agora/store.mjs", "tools/agora/store.orchestration.test.mjs"],
      "refs": ["planmap:master-orchestrator/campaign-charter-tiered-intake-plan-map-"],
      "guidance": "Additive only. Every new field optional at the record level; tier rules enforce presence. All 13 existing campaign records must still load from snapshot and journal."
    }
  ]
}
```

## 22. Trial by fire - the staged proving sequence

### Stage 0 - static validation

No daemon. No mutation. Read the charter and check it.

| Check | Pass condition |
|---|---|
| Charter completeness | Every field required for `standard` is present and non-empty. |
| Tier consistency | The stated tier matches the highest tier that any measure reaches. |
| Effort and risk consistency | `high` risk on a `standard` tier carries a written escalation reason. |
| Plan Map primary validity | The topic exists, the slug resolves, the status is not `superseded`. |
| Hierarchy validity | Every task names a milestone that exists. No cycle in `deps`. |
| Authorization matrix | Every task names a role that is allowed to perform it. |
| Acceptance criteria | Each criterion is testable and names its evidence. |

Stage 0 runs entirely against this document. It gates entry to Stage 1.

### Stage 1 - synthetic fixture, disposable daemon

Run on a private port with an isolated `AGORA_DIR`. **Never on port 4319.**

1. Start a disposable daemon. Seed one fixture campaign and four fixture tasks.
2. Register a throwaway owner. Claim the campaign. Claim two tasks.
3. Simulate owner loss by advancing the clock past the drop horizon, or by retiring the owner.
4. Confirm the campaign reports `ownerStatus: "gone"` and the `adoptable` label.
5. Snapshot the full state. Generate the triage report. Snapshot again. **The two must match byte
   for byte.**
6. Apply the four low-risk dispositions: `continue`, `reopen`, `reassign`, `block`.
7. Attempt `close-obsolete` with no approval. It must be refused.
8. Stop the daemon. Restart it. Confirm replay reproduces the charter, the dispositions, and the
   triage history exactly.
9. Destroy the fixture. Confirm the shared daemon was never contacted.

Stage 1 is where per-task disposition gets proved, because no real campaign holds tasks.

### Stage 2 - one controlled real campaign

**Requires explicit human approval before the first mutation.** Ask, wait for a clear yes, then act.

1. Propose one campaign. Recommended: **`viz-tier12-fixes`** - `active`, owner `gone`, two path
   tokens, zero tasks, and a single-entry history. It is the smallest real target with the least
   coupling.
2. Record the pre-state: the full campaign record, the full task list, all locks, and all
   reservations.
3. Generate the read-only triage report. Show it to the human. Change nothing yet.
4. Because the campaign holds zero tasks, Stage 2 proves **campaign-level closure only**, not
   per-task triage. Say so in the result. Do not claim the task path was exercised.
5. On approval, adopt the campaign and move it to `done`, with actor, reason, and prior state
   recorded.
6. Record the post-state. Diff it against the pre-state. Nothing outside the target may differ.
7. Post the evidence on the board.

### Stage 3 - post-trial review

1. Compare each acceptance criterion against what actually happened.
2. Register a gap row for every failure and every friction point.
3. Revise the charter. Append a revision entry.
4. Decide go or no-go for the remaining nine adoptable campaigns. The decision is the human's.

### Stop conditions - halt immediately, do not work around

Halt the trial and escalate on any of these:

- The primary Plan Map reference is missing, or it contradicts the campaign state.
- A required charter field for the tier is absent.
- An adoption or closure path turns out to be reachable without authorization.
- The triage report cannot be produced read-only.
- A task lacks the history needed to reconstruct its audit trail.
- Any record changes during a dry run.
- A campaign or task state fails to replay identically after restart.
- A lock or reservation conflict appears on a trial file.
- An edit lands on a working-tree file outside the campaign scope.
- A destructive action occurs without recorded human approval.

Each stop condition writes a gap row before work resumes.

### Success criteria

| Criterion | How it is judged |
|---|---|
| The campaign is inspectable from the dashboard | A human opens the dashboard and reads mission, tier, risk, and progress without curl. |
| Progress reads from ordinary task records | The figure is computed from `task.state`, not stored on the campaign. |
| History yields start, completion, and attribution | Computed values match the raw `history[]` for a task with three successive claimants. |
| One adoptable campaign is triaged with no silent mutation | The byte-level snapshot check passes. |
| Every task gets an explicit disposition | Count of dispositions equals count of tasks. Zero defaults. |
| The real campaign ends in a valid auditable state | State is `done` or `closed`, and history names actor, reason, and prior state. |
| No unrelated record changes | The pre-state and post-state diff is limited to the target. |
| All failures are recorded and routed | Each failure has a `WF-G` row with exact provenance. |

## 23. State model for this campaign

Seven axes. Keep them apart. Today's code collapses the first three, which is why ten campaigns
are stuck.

| Axis | Values | Stored or computed |
|---|---|---|
| Campaign technical state | `draft`, `needs-review`, `approved`, `active`, `blocked`, `trial`, `triage`, `adopted`, `closing`, `done`, `closed`, `quarantined` | stored |
| Owner liveness | `online`, `stale`, `gone` | computed from presence |
| Dashboard label | `adoptable`, `escalated`, `paused`, `legacy` | computed |
| Task state | `open`, `claimed`, `in_progress`, `blocked`, `done` | stored, unchanged |
| Triage state | `none`, `report-ready`, `in-review`, `applied` | stored on the triage record |
| Task disposition | `continue`, `reopen`, `reassign`, `merge`, `block`, `close-obsolete`, `escalate` | stored per task, per triage |
| Approval state | `not-required`, `pending`, `granted`, `refused` | stored per action |

`trial` is new in this section. It marks a campaign that runs its proving sequence. It behaves like
`active` for task claims, and it blocks the `closing` transition until Stage 3 records a verdict.

### Transitions for this campaign

| From | To | Who | Gate |
|---|---|---|---|
| - | `draft` | author | Charter written. |
| `draft` | `needs-review` | author | Stage 0 passes. |
| `needs-review` | `approved` | human, because risk is `high` | Manual intake recorded on the board. |
| `approved` | `active` | owner | T1 done. |
| `active` | `trial` | owner | T5 done. Stage 1 may begin. |
| `trial` | `triage` | master | Stage 2 approved by the human. |
| `triage` | `adopted` | master | Dispositions applied and recorded. |
| `adopted` | `trial` | master | Return to the trial to finish Stage 3. |
| `trial` | `closing` | owner | Stage 3 verdict recorded. |
| `closing` | `done` | owner plus one approver | Every acceptance criterion is judged. |
| `done` | `closed` | master | Archive. |
| any | `blocked` | owner | A named blocker. |
| any | `quarantined` | master or human | A stop condition fired. |
| `quarantined` | `needs-review` | human | Repair recorded. |

Every transition writes actor, timestamp, reason, prior state, and new state. **That record shape
does not exist today.** See gap WF-G86.

## 24. Plan Map review

`validate-planmap.mjs` is clean: 184 topics, 773 features, exit 0. There is no structural failure.
Every finding below is semantic drift.

| Finding | Detail | Proposed repair | Authorized? |
|---|---|---|---|
| Best primary reference | `planmap:master-orchestrator/campaign-charter-tiered-intake-plan-map-`, status `specced`. Exact and real. | Use it. | no change needed |
| Stale feature text | That feature describes an adopt endpoint "guarded like unlock --force". Implicit adoption already ships through re-claim (`store.mjs:1379`). The feature reads as wholly unbuilt. | Reword to say that implicit re-claim adoption exists, and that the guarded endpoint does not. | **NOT DONE.** Needs authorization. |
| Missing feature | No topic or feature covers the campaign charter, the tiered intake, or the Plan Map contract. | Add one feature to `master-orchestrator`: "Campaign charter + tiered intake + Plan Map reference contract", status `specced`, linked to this document. | **NOT DONE.** This is task T2. |
| Supporting references | `agora-fleet-coordination` (`specced`, tooling) is the parent epic. `agora-operator-dashboard` (`active`, agents) owns the dashboard work. Both fit. | Use both as supporting references. | no change needed |
| Cross-lane note | The primary sits in the `agents` lane; `agora-fleet-coordination` sits in `tooling`. A `standard` campaign does not require a cross-lane justification, but record the split so a `large` successor inherits the reasoning. | Record in the charter. | done here |

**No Plan Map file was modified in this pass.**

## 25. Minimum dashboard view for the trial

Dashboard only. No tracker file, tracked or local. Runtime state stays in the git-ignored daemon
state.

| Element | Source | New work? |
|---|---|---|
| Mission and outcome | `charter.mission`, `charter.outcome` | needs the charter |
| Plan Map reference plus a validity badge | `charter.planMapPrimary` joined against `topics.json` | needs the charter and the join |
| Tier, effort, risk | `charter.tier`, `.effort`, `.risk` | needs the charter |
| Milestone list with rollup state | planning nodes plus member tasks | needs planning nodes |
| Nested task tree | tasks filtered by `campaignId`, grouped by `milestoneId` | needs `milestoneId` |
| Task state markers | `task.state` | exists |
| Task start and completion time | first `in_progress` and the `done` entry in `task.history` | compute on read; no storage |
| Agent history | claim and handoff entries in `task.history` | compute on read; no storage |
| Dependencies and blockers | `deps`, `depStates`, `gates` | exists |
| Result and evidence | `result`, `resultDisposition`, `finding`, `evidence` | exists and live |
| Triage recommendations | triage record | new |
| Approvals | approval record | new |
| Audit history | `campaign.history` plus `task.history` | exists, but see WF-G86 |
| Trial stage and stop or success status | campaign state plus the trial record | new |

Roughly half needs no new storage. The genuinely new storage is the charter, the planning nodes,
`milestoneId`, the triage record, and the approval record.

## 26. Data model review against what exists

| Field | Exists today | Recoverable from history | Needs new persistence | Should stay computed |
|---|---|---|---|---|
| `campaign.id`, `role`, `agentId`, `scope`, `paths`, `globs`, `wave`, `state`, `history` | yes | - | - | - |
| `ownerStatus`, `ownerLive`, `ownerAlive` | yes | - | - | yes |
| `charter.*` | no | no | **yes** | - |
| planning nodes | no | no | **yes** | - |
| `task.campaignId` | yes, unused | - | - | - |
| `task.milestoneId` | no | no | **yes** | - |
| `task.startedAt` | no | **yes** | no | yes |
| `task.completedAt` | no | **yes** | no | yes |
| `task.agentTrail` | no | **yes** | no | yes |
| transition reason and prior state | **no** | **no** | **yes** | - |
| triage record | no | no | **yes** | - |
| approval record | no | no | **yes** | - |
| `progress` | no | no | no | yes |
| `planMapHealth` | no | no | no | yes |

### Migration risks

- **Empty campaigns.** All 13 campaigns hold zero tasks. A read model that assumes tasks must
  render an empty campaign without an error.
- **Charterless campaigns.** Render them as `legacy`. Readable and closable. Not seedable until a
  charter is attached. Never fabricate a charter for an old record.
- **Widened state enum.** Old values `active`, `blocked`, and `done` keep their meaning. A replay
  of an old journal must not fail on an unknown new value, and a new journal must not crash an
  older daemon.
- **Journal tolerance.** Add unknown-key tolerance to the campaign reducers before the charter
  ships, not after.

### Charter durability - an unresolved risk

The charter lives in `.agent/agora/`, which is git-ignored by design. The original 2026-06-27
caveat still holds: `git clean -fdx` removes it. A charter is planning intent, and losing it costs
more than losing a lock.

The user requirement forbids a tracked tracker file, and that requirement stands. Two options
remain, and neither is chosen yet:

1. Accept the loss. The Plan Map holds the durable intent; the charter is operational only.
2. Add a manual, human-invoked export. Never an automatic write into the tree.

Option 1 is consistent with the layer separation in section 3. Option 2 is safer. This is open
decision D3 in section 28.

## 27. Workflow gaps registered from this pass

Two new rows in `tools/agora/WORKFLOW_GAPS.md`. Both are measured, not inferred.

| Row | Summary |
|---|---|
| **WF-G85** | Zero of 72 board tasks carry a `campaignId`, so all 13 campaigns hold no tasks. The campaign-to-task link is schema-only, and campaign progress cannot be computed from anything. |
| **WF-G86** | A task history entry records `{ at, by, action, state }` only. There is no prior state, no reason, and no evidence pointer, so the required audit shape cannot be produced. |

Three rows from the earlier pass remain open: WF-G82, WF-G83, and WF-G84.

### Observations recorded here, not as gap rows

- **`orchestrate seed` disjointness blocks a multi-packet daemon wave.** Packets may not share a
  file (`orchestrate.mjs:231`). Three tasks that touch `store.mjs` cannot be one wave. This is a
  deliberate safety invariant, not a defect. Section 21 works within it.
- **The Plan Map link lives on tasks, not campaigns.** Fourteen tasks carry `planmap:` refs; zero
  campaigns do. The campaign-level Plan Map contract is therefore genuinely new behavior, not a
  formalization of current practice.

## 28. Implementation phasing and open decisions

| Phase | Content | Can it be tested without changing the live daemon? | Needs |
|---|---|---|---|
| 0 | Charter and static validation, section 22 Stage 0 | **yes** - document only | human approval of the charter |
| 1 | Plan Map contract, T4 | **yes** - in-process store tests | Plan Map repair, T2 |
| 2 | Campaign read model, T5 | partly - needs a new route | new API plus dashboard work |
| 3 | Synthetic trial, T6 | **yes** - disposable daemon on a private port | nothing shared |
| 4 | One controlled real campaign, T7 | **no** | explicit human approval per action |
| 5 | Post-trial review, T8 | yes | human go or no-go |
| 6 | The remaining nine adoptable campaigns | no | a passing Stage 3 |

**Smallest safe MVP:** phases 0, 1, and 3. Charter, Plan Map contract, and a synthetic trial. All
three run without touching the shared daemon's behavior. They prove the model before a single real
record moves. Phase 4 is the first irreversible step and must not start until phase 3 is green.

**Recommended first task:** T1. Record this charter on the board and get it approved by hand. It
costs one task, it changes no code, and it is the manual intake that conflict 1 in section 20
requires.

### Open decisions

| # | Decision | Blocks |
|---|---|---|
| D1 | Does `trial` become a real campaign state, or a charter flag on `active`? | phase 2 |
| D2 | If no real campaign holds tasks, is Stage 2 still worth running for campaign-level closure alone? | phase 4 |
| D3 | Charter durability: accept loss, or add a manual export? | nothing today |
| D4 | Should the transition-record repair (WF-G86) land before the charter, since the charter's audit claims depend on it? | phase 1 |
| D5 | Does the deputy role become a workstream owner, or stay separate? Still open from the earlier section. | later expansion |

D4 deserves attention. The charter promises an audit trail that today's history shape cannot carry.
Building the charter first would ship a documented guarantee that the data model does not keep.

---

# Decisions settled, and what they change (added 2026-08-29)

**Section status:** DECIDED by Remy. Still PROPOSED as code - nothing here is built.
**Decided:** 2026-08-28, through a scoping questionnaire, answers received twice identically.
**Recorded by:** `campaignwright-51c48a` (Agora agent `0f241c30-4e75-4093-bcb8-b799a5838705`,
session `7101dbf9-b2b9-4414-bed5-efb2812bed09`).
**Effect on the sections above:** sections 1-28 stay as written, for the record. Where a decision
below contradicts them, **this section wins**. Each contradiction is named.

## 29. The eight decisions

| # | Question | Decision |
|---|---|---|
| D-A | Read-only triage report | Build a **separate read-only surface**. |
| D-B | Durable identity | **Seats, for campaign ownership only.** Sessions keep locks and tasks. |
| D-C | Dependency types | Adopt the **full ten-type Beads model**. |
| D-D | Campaign membership | **Hierarchical ids**, Beads style. |
| D-E | Smaller ideas | Take **all four**. |
| D-F | Where to record | **All four places**, including a new Plan Map feature. |
| D-G | Trial order | **Revise the spec first**, then trial. |
| D-H | Next work | **Seed T1** and **investigate WF-G85**. Both. |

Three of these overruled my recommendation: D-C, D-D, and D-G. The reasoning for each is below,
because a decision recorded without its reason turns into folklore.

## 30. What the WF-G85 investigation found, and why it settles D-D

I recommended "investigate first" for campaign membership. Remy chose the structural fix directly.
The investigation ran anyway, under D-H, and it supports the decision rather than my caution.

**Measured 2026-08-29 on the live daemon.** The board grew from 72 tasks to **119**, and from 13
campaigns to **21**, while the questionnaire was open. The defect ratio did not move:
**0 of 119 tasks carry a `campaignId`.**

**The cause is proven, not inferred.** `orchestrate seed` sets `campaignId` and `wave` together
(`orchestrate.mjs:413`). **Zero tasks carry a wave either.** So seed created none of the 119. Every
task was hand-made through `client.mjs task new`, where `--campaign` works (`client.mjs:56`) and is
optional.

**It is not carelessness.** Workers use the flags they are taught:

| Field | Tasks that set it | Taught in AGENT.md? |
|---|---|---|
| `category` | 119 of 119 | yes |
| `refs` | 88 of 119 | yes |
| `campaignId` | **0 of 119** | **no - zero mentions** |

`--campaign` appears in `ORCHESTRATOR.md` once, inside a cheat sheet. Task creators are ordinary
workers, not orchestrators: `task-scout` 37, `worker-ad54de` 34, `orchestrator-becd6d` 13.

**This is why D-D is right and my recommendation was too cautious.** A field that is merely
*required* still depends on somebody reading the correct document. A hierarchical id makes
membership unforgettable, because a task cannot be named without it. The defect becomes
unrepresentable rather than discouraged.

**A second finding, unasked for.** Eight campaigns were created on 2026-08-28 -
`ui-gap-fixes-expanded`, `test-coverage-expanded`, `systems-cleanup-expanded`,
`history-saveload-expanded`, `co-orch-expanded`, `modularization-expanded`, `todo-sweep-expanded`,
`viz-tier12-expanded`. Every one is `active`, owner `gone`, zero tasks. **18 of 21 campaigns are now
adoptable.** WF-G83 is not a historical artifact; it reproduces every time someone runs a wave.

**A trap worth naming.** `--campaign` means two different things. On `register` it is a free-text
presence label. On `task new` it is a validated foreign key. Same flag, two meanings, two commands.
This is the same class of error as the Plan Map lane collision in section 3.

## 31. D-C - the ten dependency types replace the hand-built hierarchy

I recommended four types. Remy took all ten. The wider set costs one table of documentation and
removes more bespoke machinery than the narrow set does.

**Blocking types** - these gate readiness:

| Type | Meaning | Replaces |
|---|---|---|
| `blocks` | B cannot start until A closes | today's untyped `deps[]` |
| `parent-child` | children blocked when the parent is blocked | section 8's milestone rollup |
| `waits-for` | B waits for **all** of A's children | section 8's "milestone is ready when every task is" |
| `conditional-blocks` | B runs only if A fails | nothing today - new capability |

**Non-blocking types** - graph annotations only:

| Type | Meaning | Replaces |
|---|---|---|
| `related` | informational link | prose in `Notes` |
| `tracks` | tracks another item's progress | nothing today |
| `discovered-from` | found while working on another item | the gap-to-task link written as prose in every `WF-G` row |
| `caused-by` | root-cause link | prose |
| `validates` | test or verification link | the `evidence` field's implicit target |
| `supersedes` | replaced by a newer item | section 10's `merge` disposition |

**What this deletes from the earlier spec.** Section 8 defined milestone readiness by hand:
"a milestone is `ready` when every task it holds is `ready` or `done`." That rule is now
`waits-for`. Section 10's `merge` disposition is now `supersedes`. Neither needs its own code.

**Open risk.** Ten types on a board with 119 tasks and no typed deps means most types sit unused at
first. That is acceptable: an unused type costs a table row, while a missing type costs a
migration. But the vocabulary must be documented before it ships, or it repeats the `WF-G80`
failure where invented values passed unchecked.

## 32. D-B - seats own campaigns, sessions own everything else

Constellation's split: "sessions are days; seats are people." Remy took the narrow form.

| Layer | Owns | Lifetime |
|---|---|---|
| **Seat** | campaign ownership | survives sessions, model changes, and renames |
| **Session** | locks, reservations, task claims, presence | one working period |

**Why narrow.** The ten-then-eighteen stuck campaigns are a campaign-ownership problem. Locks and
the reap horizon work correctly today: a lock SHOULD die with the session that took it, because the
edit it guarded is over. A campaign should not.

**What this changes in section 9.** `adoptable` is currently computed as "state is `active` and
owner liveness is `gone`". Under seats, a campaign is adoptable when its **seat** is gone or has
handed off, not when a session ended. Most of the eighteen would never have become adoptable.

**Cost.** Two identity models coexist. Every agent must know which applies where. The rename record
stays in the roster, per Constellation, so a seat's history survives a rename.

## 33. D-A - a separate read-only surface

The triage report gets its own surface that can only read. bdeyes is the model: it shells out to a
read-only CLI mode, consumes JSON, never touches the store directly, and ships no mutation command.

**This upgrades the Stage 1 gate.** Section 22 proves "no mutation" with a byte-identical snapshot
comparison. That is a test. A surface with no write path is a structure. Keep the snapshot test as
well - it is cheap - but the guarantee no longer rests on it.

**What it must not be.** Not a mode flag on the existing dashboard. The dashboard is read-write and
carries a message composer and onboarding controls. A flag hides controls; it does not remove the
write path.

## 34. D-E - the four smaller ideas

| Idea | Where it lands |
|---|---|
| An **aging** view - what has gone quiet | The dashboard, and the read-only surface. Every stuck thing this session was quiet, not wrong: eighteen campaigns, seventeen invisible gap rows, 119 unlinked tasks. Silence is the recurring failure mode, and nothing surfaces it. |
| **Never falsify the record** | A written rule in `AGENT.md` and `PROTOCOL.md`. A record may be reopened, amended, or disputed. It may never be rewritten to flatter anyone, human included. Wider and sharper than section 10's no-silent-destruction rule. |
| **Postmortems amend the governing document** | Closing a `WF-G` row that changed a rule must cite the amendment. This already happened informally: rule 9 and rule 10 in `WORKFLOW_GAPS.md` both came from gap rows. Make it explicit and dated. |
| **Handoff requires consent** | A session ends when the agent parks or finishes its work and says it is ready. `retire` is mechanical by comparison. Honest limit: this cannot bind an agent that is killed or reaped, which is the case that actually hurts. |

## 35. D-G - revise before trialing, and what that reorders

I recommended trialing the narrow slice first. Remy chose to revise the spec first. The reason is
sound: D-C and D-D delete parts of the trial as specced, so trialing now would prove machinery that
is already scheduled for deletion.

**Revised phase order.** This supersedes section 16 and section 28.

| Phase | Content | Changed by |
|---|---|---|
| 0 | Spec revision - this section | D-G |
| 1 | Plan Map feature and charter schema | D-F |
| 2 | Hierarchical ids and the ten dependency types | D-C, D-D |
| 3 | Seats for campaign ownership | D-B |
| 4 | Read-only surface and the aging view | D-A, D-E |
| 5 | Synthetic trial, on a disposable daemon | unchanged |
| 6 | One controlled real campaign | unchanged, still needs human approval per action |
| 7 | Cleanup of the remaining adoptable campaigns | now **eighteen**, not nine |

**The MVP moves.** Section 28 named phases 1, 2, and 6. The smallest safe MVP is now phase 2:
hierarchical ids plus typed dependencies. Both are pure data-model work, both are testable in an
in-process store, and both remove code from the earlier spec rather than adding it.

## 36. Open decisions after this round

Section 17 and section 28 listed D1 to D5. Their status now:

| Was | Status |
|---|---|
| D1 - is `trial` a real state or a flag? | **still open** |
| D2 - is Stage 2 worth running with no tasks? | **sharper now.** Eighteen adoptable campaigns hold zero tasks between them. Stage 2 can prove campaign-level closure only. |
| D3 - charter durability in git-ignored state | **still open**, and now more pressing: a charter is worth more than a lock, and `git clean -fdx` still removes it. |
| D4 - must the history repair land before the charter? | **effectively yes.** D-E's "never falsify the record" promises an audit trail that WF-G86 says the data model cannot keep. |
| D5 - deputy versus workstream | **resolved by D-C.** `parent-child` covers it. Workstreams stay out of scope. |

New open questions raised by this round:

1. **Id migration.** 119 existing tasks have flat ids. Hierarchical ids need a scheme for tasks that
   belong to no campaign. Do they keep flat ids forever, or get a synthetic root?
2. **Seat identity.** Does a seat map to a person, a role, a model, or a machine? Remy left the note
   field empty, so this is undecided.
3. **Ten-type rollout.** Do all ten ship at once, or do the four blocking types ship first?

---

# Round-two decisions (added 2026-08-30)

**Section status:** DECIDED by Remy, 2026-08-29. Still PROPOSED as code.
**Recorded by:** `campaignwright-4365d4` (Agora agent `77025016-4b6e-4e33-af0b-a9a2c1a42e1d`,
session `7101dbf9-b2b9-4414-bed5-efb2812bed09`).
**Effect:** these close the three open questions in section 36, and add one authorization.

## 37. The four decisions

| # | Question | Decision | My recommendation |
|---|---|---|---|
| D-J | The stale Plan Map adopt feature | **Rewrite the whole feature** | reword only |
| D-K | The 119 flat-id tasks | **Migrate what can be inferred** | leave them flat |
| D-L | What a seat is | **A named persona** | a role |
| D-M | Ten dependency types | **All ten together** | blocking four first |

Remy overruled the recommendation on all four. Across both rounds that is six overrides out of
twelve questions, and every one moved the same way: toward the complete option. The recommendations
were miscalibrated, not the decisions. Remy's standing directive is to plan the full vision and
never shrink it for perceived feasibility, and these choices are that directive applied
consistently. Future options in this document should present the complete form first.

## 38. D-J - rewrite the adopt feature, do not patch its wording

The Plan Map feature under `master-orchestrator` reads:
*"campaign adopt endpoint: POST /campaigns/:id/adopt, guarded like unlock --force"*.

I proposed a one-sentence correction, because implicit adoption already ships through re-claim
(`store.mjs:1379`) and only the guarded endpoint is missing. Remy chose the full rewrite instead,
and the reason holds up: **decision D-B changed what adoption means.** Under seats, a campaign is
adoptable when the seat is gone or has handed off, not when a session ended. A feature written
against session-liveness describes the wrong mechanism, so correcting its tense would preserve a
wrong model in tidier words.

The rewrite must state:

- Implicit adoption exists today through re-claim, and its limits.
- Adoption is a **seat** transfer, not a session takeover.
- The guarded endpoint, the read-only triage report, and per-task disposition are the unbuilt part.
- Its dependency on D-B, so nobody builds it before seats exist.

**Authorization.** Remy approved this Plan Map edit. It is not yet made.

## 39. D-K - migrate what can be inferred, and mark it as inferred

Remy chose to recover the subset of campaign membership that evidence supports, rather than leave
all 119 tasks flat.

**The tension I raised, and how it resolves.** My stated cost was that a guess recorded as fact sits
badly beside D-E, "never falsify the record." Remy read that and chose migration anyway. The two are
reconcilable, and the reconciliation is a requirement, not a softening:

> **An inferred membership must be marked inferred, carry its evidence, and never render as
> recorded truth.**

That satisfies both decisions. The record is not falsified when it says plainly what it knows and
how it knows it. A migration that silently promotes a guess to a fact would breach D-E; one that
labels every derived link does not.

### Required shape

| Field | Meaning |
|---|---|
| `campaignId` | The inferred campaign. |
| `membership` | `recorded` or `inferred`. Absent means `recorded`, for the one task that has a real link. |
| `inferredFrom` | The evidence: which ref, wave name, or date window produced it. |
| `inferredAt` | When the migration ran. |

### Evidence ranked, strongest first

1. **A `planmap:` ref that matches a campaign's own Plan Map topic.** 14 tasks carry such refs.
2. **A wave name.** Zero tasks carry one today, so this yields nothing, but the rule belongs in the
   migration for future data.
3. **A creation-time window inside a single campaign's active period**, combined with a file path
   that falls inside that campaign's declared `paths` or `globs`.
4. **Nothing.** The task stays flat and unmigrated. This is expected for most of the 119.

Rule 3 is the weakest and the most tempting. Require **both** the time window and the path overlap,
never either alone, and record both in `inferredFrom`.

**The dashboard must show inferred membership differently from recorded membership.** A campaign
whose entire task list is inferred is not the same as one whose tasks declared themselves, and a
reader deciding whether to close a campaign needs to see which they are looking at.

## 40. D-L - a seat is a named persona

Remy took Constellation's own reading rather than my narrower "a role."

A seat has a name, a home, an accumulating history, and a diary. It survives model upgrades and
renames, and the rename stays in the roster rather than replacing the old name.

**What this adds beyond a role.** A role answers "who is accountable." A persona also answers "what
has this owner done before, and what did they learn." That history is what makes a successor's
triage decisions informed rather than blind - the successor can read what the previous holder
recorded, not merely inherit an empty mandate.

**What it costs, stated plainly.** A persona needs scaffolding a role does not: a roster with a row
per seat, a diary per seat, and a naming scheme chosen once and kept. Constellation supplies the
shape for all three. This is the largest single item in the campaign program, and it is now on the
critical path for adoption, because D-J makes the adopt feature depend on it.

**Still open.** The naming scheme itself. Constellation says the founding seat picks its own name
first and the scheme follows from it. Remy has not chosen one, and it does not block phase 2.

**Not adopted:** Constellation §4, "every seat has a home of its own - a clone no other process
touches." Rejected in section 32 and still rejected. A seat is an identity here, not a checkout.

## 41. D-M - all ten dependency types ship together

Remy chose one migration over two.

The cost I named stands and must be paid deliberately: **six of the ten types have no caller on day
one**, and an undocumented type is exactly how `WF-G80` happened - a row carried three invented enum
values for two days because nothing checked them.

**Therefore the vocabulary ships with its enforcement, not after it.** Before any typed dependency
is accepted:

1. All ten types are listed in `PROTOCOL.md` with a one-line meaning each, in the same style as the
   `WORKFLOW_GAPS.md` column vocabulary.
2. The store refuses an unknown type. It does not coerce, and it does not silently accept.
3. `AGENT.md` names the four blocking types in the working loop, beside `--ref` and `--category`.
   That is the exact omission that caused `WF-G85`: workers use what AGENT.md teaches, and only
   what it teaches.

Point 3 is the one most likely to be skipped and the one most likely to cause the next WF-G85.

## 42. Revised phase order

Supersedes section 35. Two changes: D-L moved earlier because D-J depends on it, and the Plan Map
rewrite is now a real task rather than a note.

| Phase | Content | Gate |
|---|---|---|
| 1 | Plan Map: rewrite the adopt feature (D-J), and add the charter feature already landed | Reads as seat-based, not session-based |
| 2 | Hierarchical ids + all ten dependency types, with `PROTOCOL.md` and `AGENT.md` updated in the same pass (D-M) | Store refuses an unknown type; AGENT.md names the blocking four |
| 3 | Migration of inferable membership, marked as inferred (D-K) | Every migrated task carries `membership` and `inferredFrom` |
| 4 | Seats as named personas: roster, diary, rename record (D-L) | A campaign survives a session end without becoming adoptable |
| 5 | Read-only surface + aging view (D-A, D-E) | No write path exists, not merely hidden |
| 6 | Synthetic trial on a disposable daemon | Byte-identical snapshot across report generation |
| 7 | One controlled real campaign | Human approval per action |
| 8 | The remaining adoptable campaigns | A green trial |

**The MVP is unchanged: phase 2.** It is still the smallest useful slice, and it still removes more
code than it adds.

## 43. Open after round two

1. **The seat naming scheme** (D-L). Constellation says the founding seat names itself first.
2. **Inferred-membership threshold.** Rule 3 in section 39 needs a concrete time window. A day? The
   campaign's whole active period? Not yet chosen.
3. **`WF-G86` before or after the charter.** Unchanged from D4 in section 36, and now sharper: D-K
   requires `inferredFrom` provenance on a task, while WF-G86 says the history entry cannot yet
   carry a reason. The same missing capability blocks both.

---

# Round-three decisions (added 2026-08-30)

**Status:** DECIDED by Remy, 2026-08-29. Closes both open values from section 43.
**Recorded by:** `campaignwright-4365d4` (`77025016-4b6e-4e33-af0b-a9a2c1a42e1d`).

## 44. The two decisions

| # | Question | Decision | My recommendation |
|---|---|---|---|
| D-N | Seat naming scheme | **A themed set** | let the founding seat name itself |
| D-O | Inference time window | **The campaign's whole active period** | until the owner went quiet |

That is eight overrides in fourteen questions, and all eight moved toward the wider option.

**The rule this section first stated was wrong, and is superseded by section 62.** It read:
"when an option list has a narrow end and a complete end, Remy takes the complete end. Present
it first." That is a rule about ORDER. Following it changed nothing, because the defect was
never in the ordering - it was in the reasoning that set the recommendation. Overrides
continued at the same rate for ten more questions after this rule was written.

## 45. D-N - a themed set, and the theme I propose

Remy chose a named theme over an emergent convention.

**Proposed source: Aralia's own lore.** This is a proposal, not a decision, and one word changes it.

Why this source over stars or cartographers:

- **It does not run out.** That was the stated cost of a themed set, and it is the one theme where
  the cost does not apply. Aralia generates names continuously; the supply is the world itself.
- **It cannot age badly in the way a real-world theme can.** A seat named after a scientist or a
  city inherits that name's later reputation. A seat named from an owned fiction does not.
- **It makes the roster read as part of the project** rather than as infrastructure bolted beside
  it. A seat is meant to be a colleague, per D-L. A colleague from the world they work on fits.

**Constraints on the scheme, whatever the source:**

1. One name per seat, chosen once, and kept across model changes.
2. A rename is recorded in the roster, never overwritten. The old name stays legible.
3. The name must not encode the seat's job. That would recreate the role model D-L rejected, and
   it would go stale the first time a seat's scope widened.
4. The name must not encode a model or a vendor. Same reason as the rejected option in D-L.

**Still open: the exact source.** Aralia lore is my proposal. It blocks nothing - seats are phase
4, and no name is needed before then.

## 46. D-O - the widest window, and the tie-break that makes it safe

Remy chose the campaign's whole active period, from claim to last state change.

**The cost I named has been measured, and it is worse than I stated.** I said the window would be
enormous and the path-overlap test would do all the work. Measured on the live daemon:

> **34 file tokens are claimed by more than one campaign.**

The cause is visible in the data. Eight campaigns created on 2026-08-28 carry the `-expanded`
suffix and duplicate an older wave's scope almost exactly - `ui-gap-wave-20260709` and
`ui-gap-fixes-expanded` share `src/state/actionTypes.ts`, `craftingReducer.ts`,
`AlchemyBenchPanel.tsx`, `GameModals.tsx`, `MerchantModal.tsx`, and more. Both are `active`. Both
have gone owners. Under the widest window, both are candidates for the same task.

So ambiguity is the **common case**, not the edge case. The decision stands, and it needs a rule
that D-K already implies:

> **An ambiguous inference is not an inference. When a task matches more than one campaign, it
> stays flat, and every candidate is recorded.**

### Required shape, extending section 39

| Field | When |
|---|---|
| `membership: "inferred"` | Exactly one campaign matched. |
| `membership: "ambiguous"` | Two or more matched. `campaignId` stays empty. |
| `inferredCandidates[]` | The campaigns that matched, with the evidence for each. |

**Never break a tie automatically.** Not by campaign age, not by scope narrowness, not by task
count. Every such rule is a guess wearing arithmetic, and D-E forbids recording a guess as a fact.
A human or an orchestrator resolves an ambiguous task, or it stays flat forever. Staying flat
forever is an acceptable outcome.

**A prediction worth recording, so it can be checked.** Because the `-expanded` campaigns
duplicate their predecessors, I expect the ambiguous count to be large - plausibly larger than the
cleanly-inferred count. If that turns out true, the more useful repair is not a better tie-break.
It is to merge each `-expanded` campaign with the campaign it duplicates, using the `supersedes`
dependency type from D-M, before the migration runs at all. That would collapse most ambiguity at
its source.

Do not do that merge yet. It needs its own decision, and the count that would justify it does not
exist until the migration is written.

## 47. Open after round three

1. **The theme source for seat names** (D-N). Aralia lore proposed. Blocks nothing.
2. **Whether to merge the eight `-expanded` campaigns with their predecessors**, per section 46.
   Cannot be decided before the ambiguous count is measured.
3. **`WF-G86` before the charter.** Unchanged from section 43. The `inferredFrom` provenance that
   D-K requires needs the same history-entry capability that WF-G86 says is missing.

Nothing else is open. Fourteen questions have been asked and fourteen answered.

## 48. D-P - seat names come from Aralia lore

**Decided 2026-08-29.** Remy confirmed the proposal in section 45. This closes open item 1 there,
and it is the fifteenth and last answer.

Seat names are drawn from Aralia lore. The four constraints in section 45 still hold:

1. One name per seat, chosen once, kept across model changes.
2. A rename is recorded in the roster, never overwritten.
3. The name must not encode the job. That would recreate the role model D-L rejected.
4. The name must not encode a model or a vendor.

**One caution, since the source is the project own fiction.** A seat name and a game entity name
will now be drawn from the same well, so a reader can confuse the two. Keep seats in the roster
and nowhere else, and never reuse a name that already belongs to a live entity in the world data.

**Every question is now answered.** Fifteen asked, fifteen answered. What remains is not a
decision: board task T1 needs a human approval, and the work in section 42 needs building.

---

# Round-five decisions (added 2026-08-31)

**Status:** DECIDED by Remy, 2026-08-31. Six shape decisions, all raised by build work.
**Recorded by:** `decider-*` (session `7101dbf9-b2b9-4414-bed5-efb2812bed09`).

## 49. The six decisions

| # | Question | Decision | My recommendation |
|---|---|---|---|
| D-Q | Who restarts the daemon | **Remy restarts it** | same |
| D-R | Where the seat roster lives | **Both - daemon, mirrored to a tracked file** | tracked file only |
| D-S | Hierarchical id shape | **Short hash ids, like Beads** | keep the UUID, add a prefix |
| D-T | Typed dependency migration | **Migrate `deps[]` outright** | widen it in place |
| D-U | What counts as quiet | **Compare against the item's own history** | one threshold per state |
| D-V | Read-only surface form | **A separate server on its own port** | a second page from the same daemon |

Five of six overruled the recommendation, and every one of those five chose the option tagged
**most complete**. Across all twenty-one questions asked in this campaign the count is now
**thirteen overrides, all in the same direction**. Section 44 already recorded the rule; this
round confirms it beyond doubt. Present the complete end of the range first, and treat a narrow
option as the thing that needs justifying.

**Three of these decisions carry a cost I named when I asked.** Each stands, and each gets a
constraint that makes it safe rather than a softening that makes it smaller. That is the same
pattern as D-K and D-O.

## 50. D-Q - the operator restarts the daemon, and did

The daemon was down: nothing listened on port 4319. Remy restarted it rather than authorizing me
to, which is what the standing rule intends - a restart drops every live lock and reopens every
claimed task, for every agent on the machine, not only the one that asked.

**This discharged two pending caveats.** WF-G87 and WF-G88 both said `AWAITS LIVE DAEMON RESTART`.
Proven against the live daemon at version 0.3.0, two minutes after it came back:

- `GET /tasks?campaignId=agora-campaign-model-trial` returned **1 task** of **186** on the board.
- `GET /tasks?campaignId=does-not-exist` returned **`400 {"error":"unknown campaign: ..."}`**,
  not a silent full-board `200`.

## 51. D-R - the roster lives in both places, and the mirror is derived

I raised a contradiction: D-L promises a seat that outlives everything, while Agora state lives in
git-ignored `.agent/` (`.gitignore:107`) and dies to `git clean -fdx`. Remy chose both homes rather
than either.

**The cost I named was that two copies need a sync rule, and `PLANNING-STACK.md` warns a second
editable home is how status rot starts.** The constraint that answers it:

> **The daemon record is authoritative. The tracked file is a projection, written only by an
> export, never hand-edited, and never read back as truth.**

That keeps the one-truth-plus-projections rule intact. The mirror is a durable backup and a
human-readable roster; it is not a second place to change a seat. If the two ever disagree, the
daemon wins and the mirror is regenerated - the same relationship `gapIndex` JSON has to
`GAPS.md`, and the opposite of the rot pattern the planning stack warns about.

**Open:** what writes the mirror, and when. A manual export command is the safest starting point,
because an automatic write into the tree is the thing the dashboard-only rule exists to prevent.

## 52. D-S - short hash ids, and every old reference must still resolve

Beads shape: `agora-a3f8` for a campaign, `agora-a3f8.1` for its task. All 186 current tasks carry
UUID v4 instead.

**The cost I named was measured, not guessed.** Old ids are quoted in places that cannot be
rewritten honestly:

- **15 finished board results** quote a short hex prefix in their result text.
- **4 rows in `WORKFLOW_GAPS.md`** quote one - including `64256c05`, which this campaign wrote.

Rewriting those quotes would be editing the record after the fact, which D-E forbids. So:

> **Every existing task id must keep resolving forever, as an alias.**

The migration assigns a new short id and retains the UUID as a permanent alias. `resolveTaskId`
already accepts a prefix (WF-G64/WF-G65), so the lookup path exists; it gains an alias table rather
than a new mechanism. A quoted prefix from July must still find its task in a year.

## 53. D-T - migrate the deps field outright, without touching the journal

Remy chose one shape everywhere over a field that accepts two shapes forever.

**The cost I named was that it rewrites history, which sits badly with never falsifying the
record.** That objection was too broad, and the distinction matters:

| What is rewritten | Verdict |
|---|---|
| A task's **current** `deps[]` value | Fine. Current state is meant to change. |
| A past **journal event** | Forbidden. That is the record itself. |

So the migration runs as a **new journal event** - one migration entry that states what it changed
and why - and never edits an event already written. Replay then reproduces the old shape followed
by the migration, which is the truth of what happened. 25 of 186 tasks carry deps today, so the
event is small and inspectable.

## 54. D-U - quiet is measured against the item's own history

Remy chose the self-tuning rule over any fixed number.

**The cost I named was that it needs history most records do not have.** The constraint:

> **An item with too little history is not flagged, and says so.** It reads
> `not enough history yet`, never `quiet` and never `fine`.

A silent third state is how a check becomes wallpaper. The aging view must distinguish *quiet*,
*active*, and *unknown*, because treating unknown as fine is exactly the blind spot the view exists
to remove. A sensible floor is three recorded gaps before any judgment.

## 55. D-V - a separate read-only server on its own port

The strongest of the three options: the write code is not merely unused, it is absent from the
process.

**The cost I named was a second process to start, watch, and keep in step.** Two constraints keep
that honest:

1. **It shares the store module read-only, and imports no route file.** Absence has to be
   structural, or the guarantee is only a convention.
2. **It must be startable and stoppable independently.** If the daemon is down, the read-only
   surface should still serve the last snapshot - a triage report is most wanted precisely when
   something has gone wrong.

**Open:** the port. 4319 belongs to the daemon; 4320 already serves the artifacts dashboard.

## 56. Revised phase order

Supersedes section 42. D-S and D-T both land in phase 2 and both grew.

| Phase | Content | Gate |
|---|---|---|
| 1 | Plan Map rewrite (done), charter schema | - |
| 2 | Short hash ids **with a permanent UUID alias table**, plus the ten dependency types migrated by a journal event | Every quoted id from July still resolves; replay reproduces the migration |
| 3 | Migration of inferable membership, marked inferred | Every migrated task carries `membership` and `inferredFrom` |
| 4 | Seats as named personas, daemon record plus derived tracked mirror | A campaign survives a session end; the mirror never read back as truth |
| 5 | Read-only server on its own port, plus the aging view | No write route is importable; unknown is a visible third state |
| 6 | Synthetic trial | Byte-identical snapshot across report generation |
| 7 | One controlled real campaign | Human approval per action |
| 8 | The remaining adoptable campaigns | A green trial |

## 57. Open after round five

1. **What writes the roster mirror, and when** (D-R). A manual export is the safe default.
2. **The read-only server's port** (D-V). 4319 and 4320 are taken.
3. **The `-expanded` campaign merge**, unchanged from section 47.
4. **`WF-G86` before the charter**, unchanged. D-T's migration event and D-K's `inferredFrom` both
   need the richer history entry that WF-G86 says does not exist yet.

## 58. D-W - short hash codes for ids, confirmed

**Decision.** A campaign's id is `agora-a3f8`. Its tasks are `agora-a3f8.1`. This is the
Beads shape, taken literally.

**What I proposed instead, and why Remy overruled it.** I built the hierarchy with the
campaign's readable name as the prefix, so a task read `living-interiors-live-clock.1`.
My argument: Beads uses codes because its campaigns have no human name, while Aralia's
have good ones averaging 23 characters. Remy chose the code. That is the fourteenth
override in twenty-four questions, and every one has moved toward the more complete
option. See section 44.

**What keeps the readability.** Three constraints answer the cost I named:

1. A campaign carries `name` - the readable name a person chose.
2. The code is DERIVED from that name, so claiming the same name twice reaches the same
   campaign, with no lookup table to keep in step.
3. Anything a person reads prints the name beside the code. `campaign list` shows
   `agora-9947 (living-interiors-live-clock)`. A bare code says nothing, and a listing of
   26 bare codes is unusable. This was found by a test, not by reasoning: the listing
   assertion failed and the output was 26 unreadable rows.

**Every former id keeps resolving, forever.** Campaign slugs and task UUIDs both become
permanent aliases. Fifteen finished board results and four `WORKFLOW_GAPS.md` rows quote a
UUID prefix; rewriting them would breach D-E.

## 59. D-X - the roster mirror is written on every seat change

**Decision.** The daemon writes the tracked roster file whenever a seat is created,
renamed, or retired. Not a manual export.

**The cost, stated plainly.** This is the daemon writing into the tracked tree by itself.
That is the behavior the dashboard-only rule exists to prevent, and I recommended the
manual export for exactly that reason. Remy chose the automatic write.

**Constraints that must hold when this is built (phase 3):**

1. The daemon writes ONLY the roster file. No other tracked path, ever.
2. The write is a projection of daemon state. It is never read back as truth, and never
   hand-edited - the same relationship `gapIndex` JSON has to `GAPS.md`.
3. The write must be atomic, because a half-written roster is worse than a stale one.
4. It must not commit. Writing the working tree is what was decided; committing was not.

## 60. D-Y - the read-only server takes port 4321

**Decision.** Port 4321, the free neighbor of 4319 (the daemon) and 4320 (the artifacts
dashboard).

Three Agora surfaces then sit on three consecutive numbers, so a reader learns one range
rather than three separate facts. Nothing else on the machine claims it. Built in phase 4
per D-V: its own process, with no write route importable.

## 61. Phase 2 is built

Both halves ship, with tests, docs, CLI, and end-to-end proof against a real server.

- **Typed dependencies (D-C, D-M, D-T).** Ten types; the blocking four gate readiness. An
  unknown type is refused, never defaulted. `migrateTaskDeps` is one journal event,
  idempotent, control-plane gated. `GET /tasks/dep-types`; `--dep <id>:<type>`.
- **Short codes and hierarchy (D-D, D-S, D-W).** `mintCampaignId` and `mintTaskId`; an
  alias table consulted by every lookup and serialized into the snapshot; `formerIds[]`
  and an `id-migrated` history entry per renamed object; `migrateIds` with a dry run.
- **The WF-G85 pattern, caught a second time.** `AGENT.md` mentioned dependencies zero
  times - the same shape as `--campaign`, which worked, was optional, was undocumented,
  and was therefore used zero times in 119 tasks. Both the ten types and the id shape are
  now written into the step a worker actually reads. This was D-M's third condition and
  the one most likely to be skipped.

**Test count: 273 pass.** Two failures are older and unrelated - `planmap-history.test.mjs`
is written for Vitest and cannot run under `node --test` at all, and `fatalErrorLog`
binds a port and fails standalone too.

**Not yet applied to the live board.** The daemon is operator-owned. Both migrations
preview before they write.

## 62. The calibration rule, corrected

**Supersedes the rule in section 44.** That rule said to present the widest option first. It was
a rule about presentation, so following it could not fix anything. The recommendations stayed
wrong at the same rate.

**The real defect.** I find a genuine cost in the wider option, and then treat that cost as a
reason NOT to take it. Remy takes it anyway, and the cost gets solved. The cost was real every
time. It was never a veto.

Three cases from this campaign, all with the same shape:

| Decision | The cost I found | What actually happened |
|---|---|---|
| D-O, inference window | The window becomes huge, and many campaigns claim the same files | Decision stood. The rule "if more than one matches, pick none" made it safe. |
| D-X, roster mirror | The daemon writes into the tracked tree by itself | Decision stood. Four constraints bound it: one path, projection only, atomic, no commit. |
| D-W, short codes | A code says nothing; 26 bare codes are unreadable | Decision stood. Every listing now prints the name beside the code. |

In each case the reasoning was correct and the conclusion was wrong.

**The rule.** When a cost argues against the wider option, design the mitigation BEFORE letting
that cost move the recommendation. Then recommend on what remains. A cost with a known fix is a
constraint to record, not a reason to shrink the work.

**A second rule, about reporting.** Do not report a running override tally each round. Counting
is not changing, and a tally reads as self-criticism in place of a correction. Record a
calibration finding once, when the DIAGNOSIS changes. This section is that record.

**How to tell whether this rule works.** The old rule failed silently, because nothing measured
it. This one is testable: the failure mode is a recommendation whose stated reason is an
unmitigated cost. If a future recommendation names a cost and offers no fix for it, the rule was
not applied.

## 63. D-Z - work out the effort links before renaming

**Decision.** Build the membership inference first. Rename once, afterwards.

**Why it was asked.** The rename preview reported 199 tasks, but 189 of 234 belong to no
campaign. For four tasks in five the new name would carry no more meaning than the UUID it
replaced, because there is no membership to encode. Renaming first would mint 189 empty names
and then need to replace them, leaving two former names on each task instead of one.

**Superseded in practice by section 66.** The inference was measured before it was built, and
it places zero of 189. The premise of this decision - that membership is latent in the
evidence - does not hold. See section 66.

## 64. D-AA - a lasting owner is never "gone"; ask who is present

**Decision.** Stop asking whether a seat has gone. Ask whether any live session holds it. A
campaign whose seat nobody holds is UNATTENDED.

**The reasoning, which was mine and which Remy took.** A session heartbeats every few minutes,
so its liveness is observable. A seat never checks in at all - it has no pulse to take. "Is
the seat gone?" is therefore not a hard question but a malformed one, and any rule answering it
invents the answer. Attendance is observable every second.

**What this changes.** `ownerStatus` on a campaign is replaced by `attended` / `unattended`,
computed from whether a live session currently holds the owning seat. The §9 adoptable
computation follows: adoptable becomes *active AND unattended*, which is a fact rather than an
inference. All 27 campaigns read owner-gone today for the trivial reason that no session
outlives itself.

## 65. D-AB - one holder at a time, taken at sign-in, released when the session drops

**Decision.** An agent names the seat it is taking as it registers. A second agent is refused
while the first is live. The seat is released when that SESSION drops.

**The cost, and its mitigation.** The obvious worry is a crashed agent locking a seat nobody
can take. The mitigation is what makes this the strongest option rather than a trade: release
follows the session's own liveness, which the daemon already measures accurately every few
minutes through presence. Nothing new has to be invented to unlock a seat, and no timer has to
be argued over.

**Rejected:** taking the seat when a campaign is claimed (a seat could then not be held while
reading, planning, or reviewing) and several holders at once (the seat stops answering "who is
responsible", which is the only question it exists to answer).

## 66. D-AC - an empty, unattended, old effort is its own case

**Decision.** Empty plus unattended plus old is a distinct disposition, and such a campaign is
closed on sight rather than reviewed one at a time.

**Measured:** 21 of 27 campaigns hold zero tasks. All 27 are unattended. The oldest was opened
on 2026-07-08. An empty campaign still reserves its file scope, so 21 of them hold ground for
no work.

**The mitigation, designed before the recommendation.** The risk is closing a campaign opened
deliberately to reserve ground with work planned but not yet written down. Two constraints
remove it: the campaign must be BOTH empty AND untouched for a stated age, and the list is
printed before anything is closed. A reserved-but-unstarted campaign is days old, not two
months.

## 67. The inference cannot work, and the measurement says why

**This supersedes the premise of D-Z.** Before building the inference, a read-only probe
measured what it would place. The answer is **zero of 189**.

| Evidence rank (from D-O) | Tasks it placed |
| --- | --- |
| A shared roadmap reference | 0 |
| A shared wave name | 0 |
| Created during the campaign's life AND shares a file | 0 |

**Why each rank fails.**

1. Forty orphan tasks carry a `planmap:` reference, but **no campaign is named after a roadmap
   topic**. The references point at topics no campaign claims.
2. **Zero orphan tasks carry a wave name.** D-O anticipated this ("wave names (0 today)").
3. The third rank fails on its time half. 47 of 65 tasks with known files DO share a file with
   some campaign, but only 2 fall inside any campaign's window, and 0 satisfy both halves.

**The root cause is a defect, now WF-G103.** A campaign record never moves after it is claimed:
23 of 27 have `createdAt === updatedAt`, and every one reports an active life of **0 days**.
D-O chose "the campaign's whole active period" BECAUSE it was the widest window on offer. It is
in fact a single instant, and nothing can fall inside an instant. I warned in D-O that the
window would be too wide. It is zero. The warning was wrong in direction and the measurement
found it.

**Even the forbidden shortcut barely helps.** If file overlap counted ALONE - which D-O
explicitly forbids - the yield across 189 orphans is: 7 placed, 40 ambiguous, 142 unmatched.

**The honest reading.** WF-G85 established that `--campaign` was optional and undocumented, so
the membership was never captured. Inference cannot recover information that was never
recorded. The measurement is consistent with the membership being genuinely absent rather than
latent, which means no cleverer rule will find it either.

**What this leaves.** The rename is not blocked by anything real: those 189 tasks belong to
nothing, and a standalone name states that truthfully rather than hiding it. The capture defect
is already fixed for future work - AGENT.md now teaches `--campaign`, and hierarchical ids make
membership structural rather than optional. This is put back to Remy rather than decided here,
because his answer to r8q1 rested on a premise the measurement has removed.

## 68. D-AD - place what is certain, list every tie, guess nothing

**Decision (r9q1).** Do all of it: place the tasks that one campaign matches, record the
candidates for every task several match, repair WF-G103, then rename once.

**Built. 275 tests pass, up from 273.**

### The repair, WF-G103

`touchCampaign` moves a campaign's `updatedAt` whenever its work moves: a task created in
it, a task claimed in it, a task changing state in it. It is called from the REDUCERS, so
replay reproduces the same spans, and it only ever moves the stamp forward - a replayed older
event must not drag a campaign's last activity backwards. Proven by a test that asserts
`updatedAt > createdAt`, which was false for 23 of 27 live campaigns.

### The four verdicts

`inferTaskMembership` writes one of four values onto every task, in ONE journal event:

| Verdict | Meaning | `campaignId` |
| --- | --- | --- |
| `recorded` | The task already names its campaign. Nothing is guessed. | unchanged |
| `inferred` | Exactly one campaign matched. `inferredFrom` says what the evidence was. | filled |
| `ambiguous` | Several matched. Every candidate is listed in `inferredCandidates`. | **stays empty** |
| `unknown` | Nothing matched. Said out loud rather than left blank. | empty |

The evidence ladder runs shared roadmap reference, then shared wave name, then shared file.

**One prohibition is deliberately set aside.** D-O forbade file overlap ON ITS OWN. That
prohibition existed to stop a guess being recorded as a fact. The pick-none rule and the
candidate list do that job directly and better, so the PURPOSE of D-O is kept while its
wording is not. Remy chose this explicitly, with the conflict stated in the option itself.

### What it will do to the live board

Measured by a read-only probe on 2026-09-07, before any of it was built:

- 45 tasks `recorded` - they already name a campaign
- 7 tasks `inferred` - one campaign matched, marked as a guess with its evidence
- 40 tasks `ambiguous` - several matched, so none is chosen and all are listed
- 142 tasks `unknown` - no evidence links them to anything

That last number is the honest finding of section 67: the membership was never captured, and
no rule recovers what was never recorded.

### Not yet applied

### Applied 2026-09-07

Remy restarted the daemon and authorized the run. All three steps applied to the live board.
The dry run matched the measured prediction exactly: 45 recorded, 7 inferred, 40 ambiguous,
142 unknown. Then 27 campaigns and 220 tasks took short ids, and 25 dependency edges took
the type `blocks`.

### The order stated below was WRONG, and the run proved it

> **Superseded.** The original text read: "**Order when it does run:** infer membership, then
> rename ids, then type the dependencies. The rename must come after the inference, because a
> task placed into a campaign should be named from that campaign rather than renamed twice."

The first half is right and the second half is not. The rename must come after the inference,
for the reason given. But it must ALSO come after the dependency typing, and that was missed.

`ids.migrate` follows a rename into every dependency edge, and it reads `d.id`. Before
`migrate-deps` runs, a dependency is a bare string, so `d.id` is `undefined` and no edge
matches. `migrate-deps` then wraps each bare string and preserves the pre-rename id. The live
board now holds 25 edges that name a UUID while every task holds a short code.

**Nothing is broken.** Every read resolves the old id through the permanent alias table, so
readiness gating is correct. That is the D-S alias constraint doing exactly the job it was
added for. But the stored record names an id that appears nowhere else, which is a trap for
any future reader that skips `canonicalId`.

**Corrected order:** infer membership, then type the dependencies, then rename ids.

Registered as WF-G104. Remy chose the repair (r10q1) over leaving it, and it is applied.

### The repair, applied 2026-09-07

`migrateDepIds` points every dependency at the id its target carries now, in ONE
`task.deps.canonicalize` event. It edits no past event, and the old id stays a permanent alias,
so D-E holds. Route `POST /tasks/deps/canonicalize?dry=1`; CLI `task migrate-dep-ids [--dry]`.

All 25 edges repointed. A second run reports 0. Verified on the live board rather than from the
exit code: zero dependency ids match a UUID pattern, task `agora-3701` stores `agora-3e92` with
`gates: 0`, and that target still carries `8026b877-...` in `formerIds`.

The corrected order is written where readers look - PROTOCOL.md beside the routes, and
`client.mjs --help` beside the commands. That is the WF-G85 lesson: a rule only in a spec is a
rule nobody applies.

## 69. Phase 3 - seats, and the cleanup they made possible

**Built 2026-09-07. 291 tests pass, up from 279.** Remy said "proceed with the next stage",
and then that the cleanup of the 23 adoptable campaigns belonged to this stage too.

### Why seats came first

The cleanup could not honestly run before seats existed. "Adoptable" meant *the owner is
gone*, and the owner was a SESSION. A session always ends, so on 2026-09-07 all 27 live
campaigns reported a gone owner and not one had been abandoned. Sorting campaigns on that
signal would have been sorting on noise.

Seats replace the broken question with an answerable one: **is a live session sitting in this
campaign's seat right now?** That is observed, not inferred.

### What a seat is

A durable identity that owns a campaign (D-B). A session is a day; a seat is a person. Locks,
reservations, task claims and presence stay with the SESSION - those are about work in
progress, not about responsibility.

- **Taken at sign-in**, with `--seat <name>` on register. Claim-on-campaign was rejected: the
  seat could not be held while its holder was reading or reviewing, which is most of the work.
- **One holder at a time.** A second live claimant is refused. The crashed-agent worry is
  answered rather than traded away - the seat is free the moment the holder's presence drops,
  and presence is already measured every few minutes. `seatIsHeld` asks whether the holder is
  live, so **no seat-level timer exists and none had to be argued over.**
- **Registration always succeeds**, even when the seat is refused. Failing it would strand an
  agent holding a token it could not use. The refusal comes back as `seatError`.
- **Created deliberately.** A seat carries a diary and a history, so a misspelling at sign-in
  must not conjure one. `seat new <name>` is its own step, and the error names it.
- **The name may not encode the job or a model** (D-N). `lead-reviewer` is refused: naming a
  seat for the job recreates the role model seats replace. `opus-one` is refused: a seat must
  outlive a model change.
- **A rename keeps every former name.** `formerNames` and `renames[]` grow; nothing is
  overwritten.
- **A diary** per seat, so a successor inherits what was learned rather than an empty job.

`campaign.seatId` is the durable owner; `campaign.agentId` stays as the session that claimed
it, because the history should say who was actually at the keyboard. A campaign with no seat
reads `UNATTENDED` forever - which is the honest reading of every campaign claimed before
seats existed, not a defect.

### The roster mirror

Written to `tools/agora/seat-roster.json` on every seat change (D-R, D-X). `.agent/` is
git-ignored by design, so a seat that is supposed to outlive everything would not survive a
`git clean -fdx`. Four constraints, each answering a real cost: one path only, a projection
never read back, an atomic write, and no commit. It holds **seats only** - a campaign list
there would become the local campaign tracker the dashboard-only rule forbids.

### The cleanup, and the blocker it exposed

`setCampaignState` allows only the OWNER to close a campaign, and every owner is a session
that has ended. **The cleanup was therefore impossible to perform by any existing path.**
`sweepEmptyCampaigns` is the control-plane route, and it refuses more than the owner path
does, not less:

| Refused | Why |
| --- | --- |
| Holds any task | The per-task triage rule owns those, not a sweep |
| Somebody is on it | Attended, whatever its age |
| Under the age limit | A freshly reserved campaign is days old, not two months |
| Not active | Nothing to close |

The preview is the DEFAULT. Writing needs `--apply`, so the printed list always comes first -
that is half of D-AC, not a courtesy. Every campaign left alone states its own reason, so the
list is auditable rather than a number to be trusted.

**Measured on the live board, 30-day limit:** 9 would close, all empty and 49 to 61 days old.
18 stay - 6 hold real work, 3 are already done, and the 8 `-expanded` campaigns are only 10.6
days old and fall under the limit. Those 8 are the WF-G83 pathology reproducing in real time
and want the merge D-O describes, not a sweep.

### The seat names - closed 2026-09-08

D-P settled that seat names come from Aralia lore, with one caution: never reuse a name
belonging to a live entity in the world data. **Measured 2026-09-07: the written lore cannot
supply them.** `public/data/glossary/entries/lore/` holds three entries, and every proper noun
that does exist - 18 deities, 12 factions, 2 companions, 5 static NPCs - IS a live entity,
which is exactly what the caution forbids. So the mechanism shipped holding zero seats, and
the question went back to Remy with the measurement rather than with an invented name.

**Remy named a better source than the one I asked for (r11q1): the game's own racial name
generators.** That is not a fixed list, and it is stronger for it. It is the same well the
world draws from when it names its own people, so a seat name is Aralia lore BY CONSTRUCTION
rather than by an author's choice, and it never runs out.

`tools/agora/seat-names.ts` is the bridge. It draws from `NamesGenerator.getBase()` - the
Markov generator ported from Azgaar's map generator - restricted to the eleven fantasy bases
(human, elven, dark-elven, dwarven, goblin, orc, giant, draconic, arachnid, serpent,
levantine). The thirty-two real-world culture bases are deliberately excluded: a seat named
from the Nordic or Japanese base would read as a real person's name, and a lasting identity
must not be mistaken for one.

Every candidate passes three gates before it is offered:

1. **The store's own rules**, IMPORTED rather than copied. `SEAT_NAME_RE`, `SEAT_NAME_FORBIDDEN`
   and `assertSeatName` left the store's closure and became module exports for exactly this -
   a duplicated rule list is a rule list that drifts, and two checks that are supposed to agree
   would quietly stop agreeing.
2. **The D-P caution, applied.** 59 words read live from `src/data` at run time: deities,
   factions, underdark factions, companions, static NPCs. A candidate sharing any word is
   dropped.
3. **Uniqueness within the draw**, so a batch never repeats itself.

**HONEST LIMIT, recorded rather than hidden.** The collision check covers names WRITTEN DOWN in
data files. Every burg resident, merchant, burg and state in the live world is generated on the
fly from a world seed and exists in no file, so a collision with one of those cannot be checked
without generating the whole world. Generated seat names are novel Markov output, so the risk is
small - but it is not zero, and the tool says so on every run.

**It is a separate tool, not part of the daemon, on purpose.** The daemon coordinates agents
across a shared checkout and must not depend on the game's world generator to start. The tool
prints candidates; `seat new <name>` still takes a plain name from a person who chose it.

### Proven end to end, 2026-09-08

- `npx tsx tools/agora/seat-names.ts --count 12 --seed agora-phase3` offered twelve names across
  eleven races, each checked against 59 live words and 27 refused job or model words.
- Seat `doralon` created - an elven draw.
- A session took it at sign-in, and the campaign `agora-campaign-model-trial` was claimed under
  it. The campaign now reads `seat: doralon`, `attended: true`, `adoptable: false` - the first
  campaign on this board that has ever had a durable owner.
- The roster mirrored to `tools/agora/seat-roster.json` on the same change.
- The seat's diary carries its first entry: where its name came from, and how to draw more.

Suite 295 pass, up from 292. `tools/agora/seatNames.test.mjs` asserts the shared rules are
exported, that a job name and a model name are still refused, that a capital is NORMALIZED
rather than refused, and that every name the tool offers passes the store's own check and is not
a live deity. It also asserts the same seed gives the same names, so a decision about who a seat
is can be reproduced.

## 70. Phase 4 built - the read-only surface and the aging view

Built 2026-09-08, on Remy's request through the sheet's "start this now" button.

**Two files, one import.** `tools/agora/readonly-store.mjs` reads. `tools/agora/readonly-server.mjs`
serves on port 4321 (D-Y) and imports only that reader. Neither holds a write call.

**Why it does not reuse `createStore` (D-V).** `createStore` is the single writer: it opens the
journal for append and rewrites the snapshot. A second process holding it would be a second writer
against one journal. So the reader opens the snapshot itself, reports entities as of that snapshot,
and names how far behind the snapshot is. It does not replay the journal tail, because that needs
the reducers, and a second copy of a reducer is a reducer that drifts.

**The guarantee is checked, not promised.** `assertNoWritePath()` reads the source of both modules
and fails on any write call, on `createStore`, or on `emit(`. Its own banned words are split in
half and joined at run time, so the check does not fail on its own list. One test proves the check
fails when a write appears, because a guard nobody has seen fail is a guard nobody knows works.
Every write verb is refused by ONE gate at the top of the handler, so a route added later cannot
accept a POST by forgetting to check.

**Three things the live data forced, each found by looking at real output rather than by design.**

| What the view said | Why it was wrong | The rule now |
|---|---|---|
| The 6 quietest items were all silent 0.1d against a typical gap of 0 | Creating a task writes three history lines in under a second. Those sub-second gaps dragged the median to 16 seconds, so anything touched hours ago read as quiet. | Writes within `BURST_MS` (60s) are ONE action. This is not a staleness threshold; it answers what counts as one event. |
| 0 quiet out of 261 | Three migrations wrote `membership`, `id-migrated`, `deps-typed` and `deps-renamed` onto nearly every record within minutes, resetting the apparent freshness of the whole board. | `BOOKKEEPING_ACTIONS` are done TO the record, not to the job, and are excluded from the rhythm. A view a maintenance sweep can blind reports all clear on the day it stops seeing. |
| 11 of 13 quiet rows were tasks already `done` | A finished task silent for a fortnight is behaving correctly. | Settled items are left out, and the count left out is printed. |

**The result on the live record**, 2026-09-08: 105 items that can still move - **2 quiet, 103
unknown**, 156 finished not shown. Both quiet rows are `blocked` jobs, which is exactly the failure
mode the view exists to surface: `agora-139c`, silent 11.5 days against its own 9-hour rhythm, and
`agora-2e50.2`, silent 9.6 days against its own 2 minutes.

**103 unknown is the honest headline, and it is a finding about the record rather than the view.**
Campaign records carry at most three history entries, so almost no campaign can be judged at all.
D-U asked for that state to be visible instead of folded into "fine", and it is: `unknown` is a
group on the page, sized and colored like the others.

**Twelve tests** in `tools/agora/readonly.test.mjs`, including the bulk-sweep case that the live
data produced.


## 71. Trial by fire - Stage 0 run, and the halt

**Result: Stage 0 fails. The trial stops before Stage 1.** Three stop conditions from section 22 are true. Section 22 says to halt and not work around a stop condition, so nothing after Stage 0 ran.

The reader started this work on 2026-09-13 with the "start this now" button on the question sheet. The check is a script, not a reading: `trial-stage0.mjs` parses section 19 (the charter), section 21 (the task tree), the section 4 tier rules, the section 11 authorization matrix, and `public/planmap/topics.json`. It printed 7 of 13 checks passed and 6 failed.

### 71.1 The checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Fields for the stated tier (standard) | PASS | All 18 required fields are present. |
| 2 | Tier consistency | **FAIL** | Risk is high. Section 4 puts high risk in the large tier, and the highest measure wins. The work also changes the daemon protocol, which section 4 sends to large intake. |
| 1b | Fields for the tier the measures require (large) | **FAIL** | Workstreams, dependencies, and open decisions are absent. Section 19 lists workstreams as non-scope, but the large tier requires them. |
| 3 | High risk on standard has a written reason | **FAIL** | The risk rationale gives no reason to stay on standard. |
| 4a | Primary Plan Map reference resolves | PASS | Resolves to the charter feature on `master-orchestrator`. |
| 4b | Primary reference is not superseded | PASS | Status is `done`. |
| 4c | Primary reference agrees with what exists | **FAIL** | The map says `done`. `store.mjs` has no charter code. |
| 4d | Supporting references resolve | PASS | `agora-fleet-coordination` (specced), `agora-operator-dashboard` (active). |
| 5 | Hierarchy is valid | PASS | 8 tasks, 5 milestones, no missing milestone, no cycle. |
| 6 | Each task role may do the task | **FAIL** | T1 approves a charter. Its role is orchestrator. Section 11 does not let an orchestrator approve a standard charter. The recorded T1 result names the human as approver, so the real approval was valid. |
| 7 | Acceptance criteria are testable | PASS, with a limit | 10 criteria, each with named evidence. 6 of them test features that do not exist, so no one can test them today. |
| 8 | Effort obeys the no-estimates directive | **FAIL** | The effort field reads "8 to 14 agent-hours". Section 17 item 4 flagged this, and no one fixed it. |

### 71.2 The stop conditions that are true

1. **A required charter field for the tier is absent.** The correct tier is large, and three large-tier fields are missing.
2. **The primary Plan Map reference contradicts the campaign state.** The map shows the charter feature as done. None of it is built.

### 71.3 Why the map says done

The reconcile step (`reconcileBoardToPlanmap` in `tools/agora/planmap-reconcile-lib.mjs`) gives a feature the strongest state of any task that points at it. Only one task ever pointed at this feature: T1, `agora-8148.1`, the intake approval. T1 finished on 2026-08-30. Tasks T2 to T8 were never put on the board. So one paperwork task made an unbuilt feature read done.

This is filed as **WF-G150** in `tools/agora/WORKFLOW_GAPS.md`, severity high. The Plan Map data is not changed. That needs the operator's authorization.

### 71.4 A contradiction inside this design

Section 4 says high risk always takes the large tier, and says never to lower a tier to skip work. Section 22 Stage 0 checks that "high risk on a standard tier carries a written escalation reason". That check assumes high risk on standard is allowed. Both rules cannot be true. Section 4 is the stronger rule, so the Stage 0 check must change to "high risk requires the large tier".

### 71.5 The later stages cannot run as written

- **Stage 1** needs a charter record, a triage report, dispositions, and a campaign progress view. None of them exist in `store.mjs` or `server.mjs`. `CAMPAIGN_STATES` holds only `active`, `blocked`, and `done`.
- **Stage 2** named `viz-tier12-fixes` as the real campaign to work. The D-AC cleanup already closed it. Two other campaigns can be adopted now. Stage 2 also needs a clear yes from the human before the first change.
- **Stage 3** reviews Stages 1 and 2, so it has nothing to review.

### 71.6 What must happen before a second run

1. Revise the charter: set the tier to large, add workstreams, dependencies, and open decisions, remove the time estimate, and set T1's role to human.
2. Change the section 22 Stage 0 check as section 71.4 says.
3. Fix WF-G150, or have the operator correct the feature status by hand.
4. Build T2 to T8, so Stage 1 has something to run.
5. Pick a new Stage 2 campaign, and get the human's yes.


## 72. Fix everything, then run the trial again - what was built

**Decision (operator, 2026-09-13, sheet question r12q1):** fix everything, then run the trial
again. Rewrite the plan at the large size, remove the time estimate, fix the map flaw, correct the
map entry, build the missing tools, and pick a new real campaign for Stage 2.

**Status:** built and tested. Stage 0 still fails on ONE error, the Plan Map entry that reads
`done`. Correcting that entry needs a direct yes in chat; an automated safety check refused the
edit on the strength of the sheet answer alone. Stage 1 is written and has not run, because
Stage 0 gates it.

### 72.1 What was built

| Part | Where | Proves it |
|---|---|---|
| Charter rules, the Plan Map contract, the triage report, as pure functions | `tools/agora/campaign-model.mjs` | `store.triage.test.mjs` |
| `putCharter`, `approveCharter`, `campaignView`, `triageReport`, `startTriage`, `applyDisposition`, `finishTriage`, and five journal events | `tools/agora/store.mjs` | `store.triage.test.mjs`, 16 tests, one per acceptance criterion plus the §71 findings |
| Seven routes | `tools/agora/server.mjs` | `server.triage.test.mjs` |
| `campaign charter`, `approve`, `show`, `triage report`, `start`, `apply`, `finish` | `tools/agora/client.mjs` | help text |
| The triage report on port 4321, from the snapshot | `readonly-store.mjs`, `readonly-server.mjs` | `readonly.test.mjs` |
| WF-G150 | `planmap-reconcile-lib.mjs`, `planmap-reconcile.mjs`, `sync-surfaces.mjs` | `planmap-reconcile-lib.test.mjs` |
| Stage 1 | `tools/agora/campaign-trial-stage1.mjs` | not yet run |

The rules live once, because two processes need them: the daemon, and the read-only surface that
must never write. `assertNoWritePath` now reads `campaign-model.mjs` and
`planmap-reconcile-lib.mjs` as well.

**Suite:** 418 of 419 pass. The one failure is `gapIndex.test.mjs`: rows WF-G127, WF-G128,
WF-G148 and WF-G149 name a Suggested agent that is not an `agents.json` key. Other agents filed those
rows. WF-G150 had the same fault and is fixed.

**The tests were checked to fail.** Three rules were broken on purpose, one at a time: the human
guard, the tier floor, and the read-only report (an emit inserted into it). Each break failed its test.

### 72.2 What the plan revision changes

| §71 finding | Resolution |
|---|---|
| Tier stated standard; risk high | A stated tier below the measured one is refused. The charter is `large`, with workstreams, dependencies, and open decisions |
| §22 check "high risk on standard needs a reason" contradicts §4 | §4 wins. The check is now "the stated tier is not below the measured tier" |
| Effort in agent-hours | `effort` is `{ taskCount, fileCount }`. Any time key is refused by name. This closes §17 item 4 |
| T1, an approval, owned by an orchestrator | An approval task must name a role allowed to approve its tier. T1 is `human` |
| Plan Map primary reads `done` | WF-G150 is fixed in the reconcile rule. The entry itself is not yet corrected, see above |
| Stage 1 had no tools | Built |
| Stage 2 target already closed | The target is an open decision in the charter, for the operator |

The revised charter is `charter-agora-8148-v3.json`, 8 tasks and 17 files. It is not yet stored on
the daemon: the live daemon runs code from before these routes, and a charter would be refused
anyway until the map entry is corrected.

### 72.3 Stage 0, second run

Stage 0 now runs the daemon's own `validateCharter` against the real `topics.json`.

| Charter | Result |
|---|---|
| §19 as first written | FAIL, 7 errors. It finds all six §71 failures by itself: the time estimate, the tier floor, three missing large-tier fields, and the T1 role. The seventh is the Plan Map contradiction |
| Revised (v3) | FAIL, 1 error: `planMapPrimary: contradiction: the reference reads "done" while the campaign is "active"` |

### 72.4 WF-G150, and why the fix has this shape

A task ref cannot tell "this task delivers the feature" from "this task serves the campaign that
will". A charter can: its `planMapPrimary` is the feature the campaign exists to deliver. So a
feature that a not-yet-done chartered campaign names as its primary is capped at `active`, and a
task closed by triage (`closedReason`) is no evidence. The wider rule was measured first and
rejected: capping every campaign's done tasks would have held back 24 of 61 feature keys, because
most wave campaigns are never closed.

**The limit:** a campaign with no charter gets no cap. Only chartered campaigns are protected.

### 72.5 Choices made inside the build, for the operator to see

1. **D1 is not ruled.** Triage is recorded on `campaign.triage` and the campaign state does not
   change. That is the additive form, and it is reversible.
2. **The human guard.** `supersede` and `close-obsolete` need a caller registered as `human` and the
   words of the approval. The daemon cannot see a person. When an agent relays an approval from
   chat, the quote must be the operator's words.
3. **An edit clears approvals.** An approval is of the text that was read.
4. **A found fault, fixed in passing.** The read-only surface read `seat.heldBy`, but the store
   writes `seat.holder`, so every seat read as unheld on port 4321.
5. **A found fault, not fixed.** `client.mjs gap add` writes a row with Suggested agent `-`, which
   the gap index test then refuses. That is how WF-G150 and the four rows above failed.

### 72.6 Stage 1 design, as written

A disposable daemon, built in-process with `createAgoraServer`, on a private port and a temporary
directory. It does not spawn `server.mjs`, because the daemon binary mirrors activity into
`.agent/orchestration`, spawns `sync-surfaces` against the SHARED daemon, and writes the tracked seat
roster. All three are switched off. Every connection to port 4319 is refused in-process and counted.
The clock sits between the drop horizon and twice it: the owner reads gone, and the reaper has not
yet freed its claimed tasks.

### 72.7 Next, in order

1. The operator says yes in chat to correcting the feature from `done` to `active`.
2. Stage 0 passes, or stops again.
3. Stage 1 runs.
4. The operator restarts the daemon on 4319, so it runs this code. The revised charter is stored and
   approved by the human.
5. Stage 2: a real adoptable campaign is proposed, its read-only report is shown, and every action
   waits for a yes.


## 73. Restart, WF-G168, and Stage 1 passed

**Decisions (operator, 2026-09-13, sheet questions r13q1 and r13q2):** Claude restarts the daemon.
The read-only surface reads the newest changes too.

### 73.1 The restart

The daemon on 4319 was stopped and started again through the ops launcher
(`POST /__start-service`), after a notice on the board (message seq 2970). The record came back
whole: 372 tasks, 38 campaigns, and the event sequence continued. The new routes answer.

**Found after the restart.** Campaign `agora-8148` (`agora-campaign-model-trial`) reads `done`. The
orchestrator seat `wayfarer` closed it on 2026-09-09 for the seats milestone only. The charter,
triage, and trial outcome are not met. While it reads `done`, WF-G150 correctly allows the Plan Map
to mark the charter feature done again, and the v3 charter is not stored. Reopening it was refused
by the session's permission check, because another agent closed it. It waits on the operator.

### 73.2 WF-G168, resolved

- The reducers and the state helpers they use moved, unchanged, from `store.mjs` into
  `tools/agora/store-reducers.mjs`. The daemon and the read-only surface import the one copy.
- **Proof the move changed nothing:** the old and new store, opened on a copy of the live record
  (3.3 MB snapshot, 36 KB journal), wrote byte-identical snapshots of 3,345,542 bytes.
- The surface applies the journal tail in memory and names any event it cannot apply. With no
  snapshot and a journal present, it rebuilds from the journal, as the daemon does. A corrupt
  snapshot is still refused.
- `assertNoWritePath` reads `store-reducers.mjs` too. It passes.
- A new test fails when the tail replay is removed.

### 73.3 Stage 1 - PASS, 18 of 18

`tools/agora/campaign-trial-stage1.mjs`. The first run stopped at check 5 (WF-G168). The re-run found
two more faults before it passed, both fixed:

1. A fresh daemon has no snapshot file. The surface refused that case; it now rebuilds from the journal.
2. The Stage 1 script gave the surface the real Plan Map and the daemon a fixture map. The script
   now gives both the fixture map, and a new check compares the two reports and names the first
   difference.

The run proved, on a disposable daemon: adoptable detection; a byte-identical record across report
generation; the surface report identical to the daemon report with 22 journal-tail events applied;
reopen advice for a gone claimant; explicit start by the command channel only; the four low-risk
dispositions with prior and new state; one disposition per task; finish refused until every task has
one; close-obsolete refused without a human and without the human's words; adoption at finish;
replay after restart identical over 6,546 characters; zero contacts with 4319.

**Suite:** 418 of 419. The failure is still `gapIndex` on WF-G127, WF-G128, WF-G148, WF-G149. One run
also failed `retrace.wiring.test.mjs`, which passed alone and on the next full run; it tests git
behavior this work does not touch.

### 73.4 Next

1. The operator decides whether `agora-8148` is reopened, and by whom.
2. Store the v3 charter. A large charter then needs the human's approval.
3. Stage 2: propose one real adoptable campaign, show its read-only report, and ask before each change.


<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md","sha256WithoutMarker":"0107e03ef6cbe3b454e3e28c6cfa3ba6d37bdda88e1a59a1e0d192eb3562067e","markedAtUtc":"2026-08-09T20:24:28.256Z"} -->
