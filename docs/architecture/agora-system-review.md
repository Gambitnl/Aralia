# Agora - whole-system review

Purpose: judge Agora as one system, not one part at a time. Record what works,
what is weak, why the workflow gap log did not catch the weak points, and what
to add so that it catches them next time.

This file is living. Update it in place. Do not date a copy of it.

Related reviews, written the same day:

- [docs/deepdives/agora-product-review.md](../deepdives/agora-product-review.md)
  (Codex): checks earlier recommendations against the full gap history.
- [product-coherence-and-agora-findings.md](./product-coherence-and-agora-findings.md)
  (Gemini Argon): traces how fixes accumulate and proposes whole-product
  coherence tables.

Verified: 2026-10-24 for the wake code and receipts below. The original
2026-10-22 system inventory was checked against the live daemon, `tools/agora/`,
`.claude/settings.json`, and `public/planmap/topics.json`. The second pass
applied five corrections from the Codex review, each checked against the code.

Current native wake result: **PASS**. Two consecutive app-owner resumes are
verified by independent 40-of-40 receipts; see [the proof excerpt](#native-two-resume-qualification-passed).
Adaptive scheduled checks and the separate human-message gap remain open.

## What Agora is

Agora is the tool that lets several AI agents work in one copy of this
repository at the same time. Each agent signs in, locks the files it will edit,
claims a task from a shared board, and signs out at the end. A local server
(the "daemon", at `http://localhost:4319`) holds the sign-ins, locks, and tasks.

Agora exists because of one choice: no branches and no worktrees. All agents
share one working copy, so they need a way to stay out of each other's files.

## Verdict

The core idea is right, and it does real work. But Agora has grown into a
second product. Two problems matter most:

1. Its main safety rule is not checked at the moment an agent edits a file.
   This is a deliberate design choice, and the design spec states its limits
   (see F1). What is missing is a maintained record of which edit paths check
   locks, and fresh evidence of how well that coverage holds.
2. Its rules are large, and nothing measures what they cost an agent. No
   timing data shows how long the rules take to learn.

The gap log did not catch these problems because it records local friction
only. Agora's design spec and `CO-ORCHESTRATION.md` do state goals and rules.
But no maintained review checks those promises against fresh evidence, so
nothing shows when a promise has no check.

## What works

- **It fits the constraint.** At the time of this review, 3 agents were live
  and held 11 locks. Each lock named the task it served.
- **Friction gets recorded and closed.** The workflow gap log
  (`tools/agora/WORKFLOW_GAPS.md`) held 353 rows at the first pass: 340
  resolved, 10 duplicate, 3 won't-fix, 0 open. This review then filed
  WF-G357 (F7), so the log now holds 354 rows with 1 open.
- **Locks know their owner and expire.** Each heartbeat (the periodic "I am
  still here" signal) also renews the locks that the agent holds.
- **The client runs from a published release.** An agent that edits the
  client source does not break the client for every other agent.
- **A guard blocks destructive git commands.** `tools/agora/guardGit.mjs` runs
  before each Bash command in a Claude session. Agents that
  `orchestrate.mjs dispatch` launches get the same guard through a git shim
  that dispatch puts first on their PATH (WF-G1).

## Findings

### F1. Locks are not checked at the moment of an edit

A lock is only a request. Nothing stops an agent that edits a file without a
lock, or a file that another agent holds.

Evidence:

- The only Agora hook in `.claude/settings.json` is `guardGit.mjs`, and it runs
  on Bash commands only. No shared hook runs on Write, Edit, or MultiEdit.
- `tools/agora/lockGuard.mjs` does check locks before a write. But only two
  tools call it: `planmap-add.mjs` and `planmap-reconcile.mjs`. It came from an
  incident on 2026-07-14, and the fix covered only the tools in that incident.
- Codex and Gemini agents do not run Claude hooks, so an edit hook covers
  Claude sessions only.

This is a design choice, not an oversight. The design spec,
[2026-06-27-agora-agent-coordination-design.md](../superpowers/specs/2026-06-27-agora-agent-coordination-design.md),
says that locks are advisory (line 39) and lists "Claude-Code hooks: None"
(line 56). The later `guardGit.mjs` hook already changed that stance once.

Why it matters: the most important rule in Agora depends on each agent's
memory. A collision does not show up as "no lock check". It shows up as a
different problem, such as "a sibling changed my file" or "the task body is
stale".

Fix: separate two options, because only one of them changes the policy.

- **Option A: refuse an edit when another live agent holds the file.**
  `checkAgoraLock` in `lockGuard.mjs` already applies this rule to two tools.
  A shared PreToolUse hook on `Write|Edit|MultiEdit` with the same rule widens
  the coverage of an existing rule. It lets the edit through when the daemon
  is down, the same way `lockGuard.mjs` does.
- **Option B: require the editor to hold its own lock.** This changes the
  advisory policy and the solo-use behavior. It is an owner decision.

### F2. The rules are too long to absorb

The three guides hold about 45,000 words and about 270 references to gap IDs:

| Guide | Words | Gap-ID references |
|---|---|---|
| `tools/agora/AGENT.md` (single agent) | 8,740 | 89 |
| `tools/agora/PROTOCOL.md` (full API) | 16,764 | 94 |
| `tools/agora/ORCHESTRATOR.md` (campaign lead) | 19,876 | 91 |

The working-loop section of `AGENT.md` runs for 575 lines with no
subheadings. Most fixes added a rule plus the history of its incident. So a new
agent must read the history to find the rule.

Why it matters: each agent reads only the section it needs, so no single agent
feels the full size. The cost goes into every agent's context window, and no
error message reports it.

Fix:

- Keep one page of current rules, written as short commands.
- Move the reasons and the incident history into a separate rationale file.
- Make `onboard` print only the rules for the agent's role.

### F3. The common path takes too many commands

The client has 28 commands, with 77 usage forms. `client-runtime.mjs` is one
file of 4,435 lines, and `store.mjs` is 3,663 lines. A normal worker needs
about six commands.

Fix: add two commands that each do one whole step.

- `agora start <task>`: sign in, claim the task, and lock its files.
- `agora finish`: record the proof, unlock, and sign out.

### F4. Agora creates much of its own work

On 2026-09-20 alone, agents filed 162 workflow gaps. At the time of this
review, one of the three live agents was at work on Agora itself.

Fix: each new rule should replace or merge an old one. Track the guide word
count and the command count, and flag any growth.

### F5. The gap log is one very large file, and most of it is not searchable

`WORKFLOW_GAPS.md` is about 680 KB, with a 17-column table, and it still
grows. Filing a row does not need a lock: `gap add` sends the row to the
daemon, which queues each append behind the previous one (WF-G113, near
`server.mjs` line 1436). The cost of the size is in large diffs and slow
reads, not in lock contention.

The Codex review found a larger problem (its finding F2). `gapIndex.mjs` reads
only the first table, which holds 72 rows. The 281 rows in the two resolved
archives do not appear in `gap search`, even with `--all`. Duplicate checks
also compare open rows only. So an agent cannot easily find an earlier repair
of the same problem.

Fix:

- Add a history-search mode that reads the archives, without making them
  active work.
- Then move resolved rows out of the active file, or keep the rows in the
  daemon store and generate the markdown from them. Do not move the rows
  before history search exists.

### F6. Closed during this review

Agent `agy-wfg-49f6952f` closed three gaps on 2026-10-22, while this review
was in progress:

- **WF-G227 and WF-G271.** The "file already changed before your lock"
  warning fired on almost every file, because this working copy is always
  dirty. The warning now names the agent that recently touched the file. A
  stronger check is still possible: compare the file's fingerprint (its
  digest) with the fingerprint at the previous holder's unlock, not with git.
- **WF-G290.** The task board had only "done" and "blocked". The client now
  accepts `task state <id> partial` with `--covered` and `--uncovered`. This is
  a client form, not a new stored state. The store keeps the task as
  "blocked" and writes what landed and what did not into its result
  (`TASK_STATES` in `store.mjs` still lists five states).

### F7. Codex dispatch fails on Windows before launch (WF-G357)

This review tried to dispatch a Codex Spark worker through
`orchestrate.mjs dispatch`. The quota probe failed with
"unexpected argument 'with'". `probeAgent` runs the probe with `shell: true`
for a bare command name on Windows, so the probe prompt
"Reply with exactly: PROBE_OK" splits into separate words. Every Codex lane
reports itself as unavailable for this reason, which looks like a quota
problem. Filed as WF-G357.

## Why the gap log missed F1 to F5

The gap log recorded these findings, or failed to record them, as follows:

| Finding | In the gap log? |
|---|---|
| Dirty-file warning is noise | Filed twice on 2026-09-20. Open for a month. Closed 2026-10-22. |
| No "partial" task state | Filed on 2026-09-20. Closed 2026-10-22 with a client form. |
| F5: resolved history not searchable | Not filed as a gap. The test `gapIndex.workflowGaps` deliberately keeps the archives out of the index. |
| F1: no lock check at edit time | Never filed. No row mentions `PreToolUse` or an edit hook. |
| F2: guides too long | Never filed. |
| F3: too many commands | Never filed. |

The causes:

1. **Workers file gaps from inside one task.** Most rows come from wave workers
   and orchestrators, in the middle of a work packet. Each worker records the
   step that stopped it. No worker sees the whole system.
2. **A missing check makes no friction.** An edit without a lock breaks nothing
   unless a collision happens. When a collision happens, it looks like a
   different problem.
3. **A fix stays as narrow as its incident.** `lockGuard.mjs` went into the two
   tools from the 2026-07-14 incident. Nobody asked which other write paths had
   the same hole.
4. **Each fix adds text, and nobody pays for the total.** No single agent reads
   all 45,000 words, so no agent reports the size as a failure.
5. **One fix starts a chain of new gaps.** WF-G129 added the dirty-file
   warning. That warning then caused WF-G173, WF-G227, WF-G271, and WF-G292.
   Each fix changed the warning's text. Nobody asked whether the warning
   should exist in its current form.
6. **The row format rewards small items.** Each row needs evidence, a next
   action, and a proof of done. "The system is too large" has no clear proof of
   done, so nobody files it.
7. **The closure rate looks like health.** 340 of 353 rows are resolved. That
   number measures how well rows get closed, not how sound the design is.
8. **Gaps arrive in bursts.** A burst of 162 rows on one day gets triage row by
   row. It does not get a review across rows.

## The missing layer: a statement of what Agora promises

Every store in this repository looks at Agora one part at a time:

| Store | What it holds for Agora |
|---|---|
| `WORKFLOW_GAPS.md` | One row per friction. Its Surface column names where one repair lands, so no row covers the whole. |
| `docs/architecture/domains/` | No Agora doc. The folder holds 44 domain docs, and none covers agent coordination. |
| `docs/adr/` | No decision record for the shared working copy with honor-system locks. |
| Plan map (`public/planmap/topics.json`) | Four topics. `master-orchestrator`: 7 features (3 done, 1 active, 3 specced). `co-orchestration-pipeline`: 50 features (46 done, 4 active). `agora-operator-dashboard`: 17 features. `agora-fleet-coordination`: 4 features, all specced. Each topic tracks features, not whole-product outcomes. |
| Design spec | `docs/superpowers/specs/2026-06-27-agora-agent-coordination-design.md` states goals and non-goals. It is a design record, not a review that is kept up to date. |

So Agora does have a product direction. What is missing is one maintained
statement of the outcomes it promises, with checks and fresh evidence.

A gap log only reacts. It records the distance between what happened and what
one agent expected at that moment. The rule itself is written down:
`CO-ORCHESTRATION.md` section 6 says that "lanes are exclusive file sets", and
the design spec makes locks advisory. But a written rule is policy, not proof.
No record says which edit paths enforce the rule, which paths only trust the
agent, and how often the rule fails. That is why F1 never became a row: the
gap between the written rule and its enforcement had no place to show.

### Proposed promise table

Put this table in a new domain doc,
`docs/architecture/domains/agent-coordination.md`. Each row states a promise,
what checks it, and a number that shows whether it holds.

| Promise | What checks it | How to measure it | State on 2026-10-22 |
|---|---|---|---|
| Two agents never edit one file at once | Nothing at edit time. Locks work on the honor system. | Edits made without a lock | **Not checked** |
| Another agent's git command never destroys your work | `guardGit.mjs` hook, and the git shim for dispatched agents | Blocked commands | Claude sessions and dispatched agents. External sessions that a person starts are not shown to be covered. |
| A new agent can start real work in a few commands | Nothing | Commands from arrival to first edit | Not measured |
| The rules an agent must read stay short | Nothing | `AGENT.md` word count (8,740 now) | Not measured |
| Work continues when the daemon is down | `lockGuard.mjs` lets writes through when the daemon does not answer, in `planmap-add.mjs` and `planmap-reconcile.mjs` only | Which commands work during a daemon outage | **Partial, not verified.** Sign-in, task claims, locks, and messages all need the daemon. No document states the supported outage scope. |

Connect the table to the existing stores:

- **Each row that is "not checked" or "not measured" becomes one gap row.**
  Give it a whole-system Surface, such as `agora-system`. The existing log can
  then hold whole-system gaps.
- **Write one decision record** in `docs/adr/` for the shared working copy.
  Future fixes can then test themselves against that choice, not only against
  the incident in front of them.
- **Review the promise table on a fixed schedule.** Start from the promises,
  not from the gap rows.
- **When you fix one incident, look for the same hole on every write path.**

The same layer is missing for Aralia as a whole. `docs/projects/GLOBAL_GAPS.md`
collects gaps that belong to no single project, but it does not state what the
game promises. Try the promise table on Agora first. Agora is smaller, and its
failures are easier to count.

## Agreed implementation plan

**Status:** the plan is agreed by three agents. Remy subsequently authorized
the Codex wake repair and tool co-creation. That tooling was implemented, but
its live desktop-chat wake test failed. Other items remain proposals unless
separately authorized. This section is the single home of the plan for all
three reviews.

**Agreed on Agora, 2026-10-22:** Claude draft (seq 7694), Argon agreement
(7698), canonical text (7700), Argon AGREE (7703), Codex conditions C1 to C5
(7705), Claude AGREE to C1 to C5 (7707), Argon AGREE to C1 to C5 (7708), the
Plan Map linkage rule from Codex (7706), and the Codex final readback and
AGREE on the saved text (7711). Board task: `agora-437d.5`. Item 14 was added
later the same day from the continuity discussion (WF-G358; Agora seqs 7724,
7727, 7730, 7731 and 7733). The continuity rules themselves are in
`tools/agora/CO-ORCHESTRATION.md` §15 (pact v5, proposed).

**Plan Map linkage rule:** before any implementation packet starts, name the
exact existing Plan Map feature it serves, or propose a curated placement for
Remy. Never promote a feature automatically. A status match between the board
and the Plan Map does not prove a healthy link: `planmap-reconcile` shows
`master-orchestrator` and `agora-fleet-coordination` as DISCONNECTED, with no
board references.

**Order of work:** fix live breakage first, then safety and truth, then
measurement, then weight reduction, then structure. An item that changes
policy waits for Remy.

| # | Item | Band | Owner | Depends on | Acceptance check |
|---|---|---|---|---|---|
| 1 | Quote multi-word quota-probe arguments in `probeAgent` on Windows (WF-G357, F7) | P0 | Claude | — | A unit test shows a multi-word probe argument reaches the child as one argument on the win32 branch. A codex-spark dispatch on Windows passes the probe. |
| 2 | Read-only history search over the resolved archives (F5) | P0 | Codex | Remy approves a narrow Hard rule 9 change for read-only history | Finds known archived IDs and proof text in both archive tables. Active intake and WF-G200 duplicate refusal do not change. IDs, notes and row counts stay the same. |
| 3 | Option A edit hook: refuse Write, Edit or MultiEdit only when another live agent holds the file; let the edit through when the daemon is down (F1) | P1 | Claude | Remy approves the rollout of the shared `.claude/settings.json` hook | Tests cover canonical paths and the self, peer, no-lock, expired-lock and daemon-outage cases. A restarted Claude session is shown to run the hook. Coverage is stated as Claude sessions only: no claim for Codex, Gemini or shell writes. |
| 4 | Domain doc `docs/architecture/domains/agent-coordination.md` and one ADR | P1, may start with P0 | Claude | — | The doc holds the promise table, an edit-path coverage matrix, the daemon-outage scope, and links to the four Agora Plan Map topics. The ADR records the existing shared-tree choice, not a new policy. |
| 5 | Advisory Agora counters in `public/planmap/health.json`, and one bounded coordination journey (F2, F3, F4) | P1 | Argon | — | Counters: guide words and bytes, client command count, active gap-file bytes, gaps per week. The journey records commands, context read, waiting, repair and rework, and lock conflicts. A missing observation is recorded as unknown, not zero. The baseline stays separate from later comparisons. One run supports no claim about general agent speed. |
| 8 | Design note for request receipts after an uncertain mutation | P1, in parallel, design only | Codex | — | Answers persist-before-ACK, outcome lookup, duplicate payloads, and crash and restart cases. No automatic retry. Done before any item 12 design. |
| 14 | Transport wait helper: `client.mjs inbox --since <seq> --wait` (WF-G358) | P1, proposal | Argon or Claude | — | Returns on the first matching message, on a timeout, on a watch expiry, or on a daemon outage, and says which. Catches up through durable `GET /messages?since=` with a stored cursor at start and after a reconnect. The reason: SSE replay is bounded to a 300-event ring (`EVENT_RING_MAX` in `server.mjs`), and the SSE snapshot excludes messages. The `PROTOCOL.md` note near line 1389 that says SSE "cannot replay" is out of date. It may use live `message.post` events (`PROTOCOL.md` near line 1135) as the trigger. It advances the cursor only after it delivers the exact matching message. Claim a cross-turn wake for a harness only after an observed witness in that harness. It never resumes an already active CLI thread. |
| 15 | Prove a cross-turn wake for each harness (WF-G358) | P1; Codex attempt failed | Each harness owner | — | For each harness, require an observed peer-message wake after its turn ends. Claude `7665 -> 7667` and Argon `7752 -> 7753` were witnessed. Codex was configured and tested, but C1 request `7823` produced six failed CLI launches and zero resumed turns or ACKs; C2 was held. See the live qualification result below. A wait helper returning or a child being launched does not prove that the app-owned agent resumed. |
| 6 | Progressive disclosure: `AGENT.md` keeps the core loop; specialized contract rules load only for tasks that carry their marker (F2) | P2 | Argon | 5 | Every existing task-contract and preflight check behaves as before: the same inputs pass or fail the same way. Updated prose test lines alone do not pass this item. The 16 guide-reading test lines are updated. A rerun of the item 5 journey is compared with the baseline. |
| 7 | Preflight capture helper that extends `captureUnchangedUnionContext` and `source-review` | P2 | Argon, Codex reviews | — | Drafts quotes, union members, action-wiring quotes and caller chains. It never refreshes a reviewed verdict. |
| 9 | Move resolved gap rows to an archive file (F5) | P3 | Codex | 2, and Remy approves the Hard rule 9 change | IDs, notes, row counts and archived corrections stay intact. History search still finds every row. Contention is measured before and after. A smaller file is not claimed as fewer Windows sharing failures. |
| 10 | Split `client-runtime.mjs` and `store.mjs` by domain | P3 | Not assigned | Benefit evidence and a wave-wide pause | To be set when the item is authorized. |
| 11 | Reload stateless route handlers without a daemon restart | P3 | Not assigned | Benefit evidence | Never reloads reducer, schema or journal state. |
| 12 | `agora start` and `agora finish` wrapper (F3) | P3 | Not assigned | 5 shows a need, and 8 is done | To be set when the item is authorized. |
| 13 | Dirty-file warning compares file digests with the previous holder's unlock (F6) | P3 | Claude | Benefit evidence | To be set when the item is authorized. |

**Aralia-wide track, after item 5:** Argon's four whole-product lenses
(unification ledger, runtime budgets such as GG-426, product seams, and
playable-loop reachability with runtime witnesses). They stay advisory until
Remy sets thresholds.

**Decisions for Remy:**

- Authorize the plan, or parts of it.
- Approve the item 3 hook rollout. Hooks load only after a session restart.
- Approve the narrow Hard rule 9 change for items 2 and 9.
- Decide Option B (every editor must hold its own lock) and Option C (passive
  `fs.watch` attribution).
- Authorize a P3 start once benefit evidence exists.
- Set thresholds for item 5 and the Aralia-wide lenses.
- Optionally, merge the three reviews. The plan does not depend on a merge.

### Codex live wake qualification: failed

Checked: 2026-10-23 against the saved chat transcript, watchdog launch audits,
child logs, and the peers' recorded Agora reports. This check does not refresh
the earlier code inventory or measurements elsewhere in this review.

The desktop turn completed on October 22 at 20:16:03 CEST. Claude sent C1
request `7823` at 20:16:23. Six CLI launch attempts followed between 20:16
and 20:32. All six exited with code 1 and the same refusal:
`thread-store conflict: thread ... already has an active writer` (`-32600`).

There were **zero successful automatic resumes**, no Codex wake ACK, no clean
child-completion audit, and no C2. The next saved turn began with Remy's
question on October 23 at 12:46 CEST. The expected passing receipt was never
produced. The 38 focused tooling checks do not change this failed live result.

Claude recorded the failure in `7828` and the final six-failure outcome in
`7839`. Argon independently agreed in `7830` and held C2. Task `agora-437d.6`
and WF-G358 remain unresolved.

The attempted bridge starts a separate CLI executor with `codex exec resume`,
then opens the saved chat through a desktop deep link. Sharing the chat ID
does not make it a native wake of the desktop app's existing executor. An idle
turn in the transcript did not release the desktop writer's ownership. A
future app-wake test must deliver through the existing owner; a CLI-only test
would establish a different capability.

### Native app wake follow-up: mechanism probe pending

Checked: 2026-10-23 against Agora messages 7858 and 7863–7873 and the
co-reviewed probe. This is a plan and readiness check, not a live wake result.

Codex, Claude, and Argon agreed to test the supported `codex queue --thread`
client before implementing an adapter. The client queues input for the existing
desktop owner. A separate queue client is acceptable if it does not take over
thread execution. A successful enqueue is not proof that the app consumed it.

The agreed sequence is one idle-gated mechanism probe, adapter implementation
only after that probe passes, then a fresh two-resume qualification. Each
measured resume needs the exact peer request and nonce, a new same-chat turn,
an Agora AWAKE and ACK, and saved turn completion. The desktop chat must show
the turn. The queue client's exit cannot replace that evidence.

The mechanism probe has not run. Claude reported that its automatic approval
review rejected the background idle gate and arm message, citing
`Create Unsafe Agents` for the message (7872). Codex held the probe and
supplied Remy's explicit automatic-resume instruction for Claude's normal
review path (7873). No denied action was redirected to another peer. The
failed CLI result above remains unchanged; no native resume is yet verified.

Claude confirmed in 7877 that the user instruction was already present when
the classifier rejected the actions. Another verbal authorization cannot
resolve that tool-level rejection. The operator can use Claude's normal
per-command approval mode to review the idle gate and single-shot probe.
Until that approval path is resolved, the probe and both measured resumes
remain pending.

The user subsequently switched Claude to per-command approval and approved
the idle gate and one probe send (7880). Claude replaced the old gate with
a gate bound to the new human-triggered baseline turn (7884). The mechanism
probe is now ready to run after that exact turn completes. No native resume
is yet verified. The earlier approval hold is resolved; delivery remains
unproven, and the later two-resume qualification has not started.

### Native queue probe delivered; adapter integration incomplete

Checked: 2026-10-23 against the queue receipt, saved transcript and independent
Agora cross-checks 7888–7892 and 7906–7913.

The native probe did reach this same app-owned thread without a human restart.
Claude sent request 7887 and queued its exact peer marker and nonce once at
11:37:52 UTC. A new turn started at 11:38:01 UTC with
the saved event field
`task_started.payload.turn_attribution.turn_trigger = queue`. Codex posted
AWAKE and nonce ACK 7888. The original app PID 2020 and owner PID 20336 stayed
unchanged; before/after process inventories found no additional Codex process.
Both peers independently checked the transcript. Completion of that active
implementation turn remains a separate check. No native desktop capture was
available, so these records do not establish a separate rendered-visibility claim.

The native verifier now separates enqueue, owner identity and actual app turn
completion. All 20 focused verifier checks pass, including six native cases.
Those checks do not prove two live resumes.

The watchdog adapter remains **paused and incomplete**. Claude reported that
its tool calls at about 13:43 local were still rejected by the Claude Code
auto-mode classifier, despite the reported switch to per-command approval.
The rejected edits cover owner resolution before launch, completion re-arm
and native audit fields. Claude reverted partial cycle edits and retained
unused helpers and enqueue-audit support. No live qualification service was
started. Root did not take over those denied edits. The operator must resolve
the effective approval mode in that active Claude session before integration
continues. The agreed two-round adapter qualification has not started.

### Native adapter implemented; two-round live test pending

Checked: 2026-10-23 against approved Q2 source freeze 7935, root review 7940,
and an independent run of the 29 watchdog and 20 verifier checks. All 49 pass.

The user resolved the approval boundary. Claude implemented the native owner
lookup, idle gate, persistent in-flight enqueue record, exact queue-turn input
matching, owner recheck at completion, completion audit and automatic dormancy
re-arm. An unresolved enqueue is held instead of resent. Root accepted the
source for a bounded live test. Argon is independently reviewing the adapter.

The exploratory Q1 turn completed cleanly at 11:55:42 UTC (7921), closing one
successful native mechanism probe. It is separate from the two-round adapter
qualification. Root is preparing a fresh baseline, peer identities and nonces
for that test. No two-round live PASS receipt exists yet.

The extra Q2-ready continuation gate was stopped and its approved send held
unused (7936): code finished while root was active, allowing direct review.
The later test will use the adapter itself, with no manual DORMANT between
the two measured app turns.

Argon accepted the frozen adapter in 7943. The adapter and verifier are now
jointly reviewed, with 49 focused checks passing. Activation remains held:
Claude corrected its initial READY report in 7947 after the tool rejected
the single `wakeAdapters.codex-app-queue.status` change from `paused` to
`ready`. The notes changed, but the executable gate did not. The isolated Q3
proof and target configuration are prepared; no live watchdog was started.
This is an activation approval boundary, not another missing implementation.

### Two native turns completed; completion audit clock repaired

Verified: 2026-10-24 against saved app turns, peer requests 8085/8091,
the isolated watchdog audit and the unchanged native verifier.

Both measured turns came from the existing app queue, completed cleanly and
kept app process 2020, owner process 20336, the thread and model unchanged.
Each request had exactly one launch and a matching nonce acknowledgment.
The first completion automatically re-armed the service before the second
request. There was no composer turn or duplicate launch inside this pair.

The strict receipt still failed one of 40 checks. The second completion audit
stored 16:57:59.801 UTC, while the saved turn completed at 16:58:00.273 UTC.
The polling pass had started earlier and reused that time after observing the
completion. This 472 ms error is tracked as WF-G360. The failed receipt and
original audit remain unchanged in ignored scratch; neither is a live PASS.

Claude changed only the native completion stamp to read the clock after the
saved completion and live owner recheck. A regression with a delayed owner
check fails on the old line and passes on the repair. Independent focused
checks pass 50 of 50. The verifier and its criteria are unchanged.

The old service reached its original 30-minute expiry and released its
singleton normally. Process 32264 now runs the repair for a bounded 20 minutes,
with a fresh audit and the exact isolated state preserved, including the
current in-flight control turn and cursor. Two fresh measured turns and an
independent strict receipt are still required before a live two-resume PASS.

### Native two-resume qualification passed

Verified: 2026-10-24. The repaired native path passed all 40 strict checks in
independent Codex and Claude runs. Both completed turns were triggered by the
existing app queue. The same app process (2020), owner process (20336), thread,
saved engine and model were preserved. There was no human/composer turn or
duplicate launch inside the measured pair, and no manual dormancy signal
between cycles. The first actual completion automatically re-armed the second.

All times below are UTC on 2026-10-24.

| Cycle | Peer request | Target ACK | App turn started | App turn completed | Completion audit |
|---|---|---|---|---|---|
| C1 | 8118 | 8121 | 17:14:23.492 | 17:15:46.400 | 17:15:49.359 |
| C2 | 8125 | 8128 | 17:16:13.505 | 17:16:52.945 | 17:16:55.079 |

Claude independently accepted the result in Agora 8134. The local ignored
proof directory is `.agent/scratch/agora-native-wake/q3/timestamp-fix/`:
`proof.json` binds the request nonces and turns; `audit.jsonl` records exactly
one enqueue per measured request and matched completion under the original
owner; `receipt.json` and `peer-receipt.json` each report PASS 40, FAIL 0.
This table preserves the load-bearing result for readers without local scratch.

WF-G360 is repaired and live-verified. The earlier interrupted and timestamp
failure receipts remain unchanged. Qualification does not mean every future
message is handled or that a service runs forever: WF-G361 separately tracks
an in-flight human-message question. The requested increasing-interval native
inbox schedule remains open as agora-437d.11; this bounded test did not install it.

## How to recheck these numbers

Run these commands from the repository root:

```bash
curl -s http://localhost:4319/health
```

```bash
node tools/agora/gapIndex.mjs --root tools/agora --summary
```

```bash
grep -rl lockGuard tools scripts --include=*.mjs
```

```bash
wc -w tools/agora/AGENT.md tools/agora/PROTOCOL.md tools/agora/ORCHESTRATOR.md
```
