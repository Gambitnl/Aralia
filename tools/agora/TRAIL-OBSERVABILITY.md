# Agora and Plan Map Activity Observability

Status: Proposed

Verified: 2026-09-02 against the current Agora daemon, store, dashboard,
protocol, planning-stack documentation, and AgentTrail v0.2.0.

Owner: Agora tooling

## Purpose

Add a local, read-only activity-observation layer to Agora and Plan Map. The
layer should help a human or orchestrator answer these questions without
changing task or roadmap truth:

1. Which files have changed recently?
2. Which active Agora task, lock, campaign, or Plan Map feature appears to
   account for each change?
3. Which active work has no matching observed activity?
4. Which completed or out-of-scope area is being touched again?
5. Where is attribution missing, ambiguous, or stale?
6. How does activity span Aralia and future related repositories?

The design adapts useful ideas from
[AgentTrail](https://github.com/sodiumsun/agenttrail), especially the
separation of declared plans from observed filesystem activity. It does not
install AgentTrail as a second tracker and does not create a `PLAN.md`.

## Decision Summary

Agora should own collection and attribution of short-lived observed activity.
Plan Map should display a read-only projection of that evidence beside its
curated roadmap records.

The implementation must follow these rules:

- Plan Map remains authoritative for curated roadmap status and product
  dependencies.
- Agora remains authoritative for in-flight tasks, claims, locks, campaigns,
  results, and execution dependencies.
- Observed activity is evidence, not status truth.
- Observation never changes a task, feature, campaign, lock, or dependency.
- Ambiguous attribution stays ambiguous.
- The baseline works from filesystem events without provider-specific hooks.
- Optional hooks may improve attribution but may not become required for
  correctness.
- The implementation extends the current Agora daemon and dashboard instead
  of introducing a second daemon, plan file, or reconciliation loop.
- Multi-repository support uses an explicit repository registry. It does not
  discover projects by scanning ports.

## Authority Boundaries

The planning stack has one owner for each kind of truth.

| Concern | Authority | Activity layer behavior |
| --- | --- | --- |
| Topic and feature status | `public/planmap/topics.json` | Read and annotate only |
| Product dependency | Plan Map | Read and annotate only |
| Task state and claimant | Agora | Read and attribute only |
| Execution dependency | Agora | Read and annotate only |
| File ownership during work | Agora lock | Treat as strongest attribution evidence |
| Campaign scope | Agora campaign paths and globs | Use as scope evidence |
| Filesystem change | Activity observer | Record as an observation |
| Agent responsible for a change | Not directly observable from `fs.watch` | Infer only with confidence and evidence |
| Roadmap or task correction | Human or orchestrator through existing workflow | Never perform automatically |

This feature is not a fourth reconciler. The three reconciliation directions
defined in `PLANNING-STACK.md` remain unchanged. Activity evidence may make a
reconciliation need visible, but the existing board-to-GAPS, board-to-Plan Map,
or Plan Map-to-spec workflow performs the correction.

## Non-Goals

The first five increments do not:

- replace Agora tasks, campaigns, locks, messages, or presence;
- replace Plan Map topics, features, statuses, or dependencies;
- create or maintain `PLAN.md`;
- infer task completion from file activity;
- reopen completed tasks or features automatically;
- auto-claim tasks or acquire locks;
- inspect file contents, prompts, command bodies, or secrets;
- provide employee monitoring, productivity scoring, or performance rankings;
- prove authorship when several agents can write the same checkout;
- require Claude, Codex, Cursor, or any other provider-specific hook;
- install or modify provider instruction files automatically;
- publish local activity outside the operator's machine;
- copy AgentTrail's UI or source wholesale.

## Terms

**Declared scope**: Paths or globs declared by an active Agora lock, task,
campaign, or an optional Plan Map location hint.

**Observed touch**: A coalesced filesystem event showing that a path was
created, changed, renamed, or removed.

**Attribution**: A relationship between an observed touch and one or more
declared records. Attribution includes its evidence and confidence.

**Mismatch**: A derived condition where observed activity and declared scope do
not line up. A mismatch is a warning, not a mutation.

**Regression touch**: Activity mapped to a completed Agora task or completed
Plan Map feature. It indicates possible follow-up work, not a confirmed
regression.

**Quiet work**: Active declared work with no observed touch during a configured
window. This can be normal for research, review, communication, or external
work.

**Observer health**: Whether each configured repository watcher is live,
degraded, disconnected, or resynchronizing.

## User Stories

### Human operator

- I can open Agora and see recent file activity grouped by task, agent,
  campaign, repository, and warning.
- I can tell why a file was attributed to an agent rather than seeing a bare
  assertion.
- I can find changes that have no task, lock, campaign, or Plan Map link.
- I can distinguish a warning from a proven coordination violation.
- I can open a task or Plan Map feature and see recent activity without reading
  raw JSON.

### Orchestrator

- I can compare my campaign scope with observed touches before launching a new
  wave.
- I can see overlapping campaign matches and coordinate before assigning more
  work.
- I can find claimed tasks that are quiet without assuming the worker is idle.
- I can identify completed areas being touched and decide whether to create a
  repair task.

### Worker agent

- I can verify that the files I am changing match my task and lock scope.
- I can see when my work is being attributed incorrectly or ambiguously.
- I am not required to install a provider hook for basic visibility.

## System Context

The current Agora implementation already provides the foundations this feature
should reuse:

- an append-only coordination journal and compacted snapshots;
- agents, tasks, locks, reservations, messages, campaigns, and task history;
- exact paths and globs on locks and campaigns;
- task `refs`, including `planmap:<topic>/<feature>` references;
- task `retraceFiles`, populated from lock paths and globs;
- a loopback HTTP server and server-sent event transport;
- a dashboard with task, campaign, presence, lock, and inspector views;
- a best-effort activity mirror for selected coordination events.

Observed filesystem touches are higher-volume and lower-authority than Agora
coordination events. They therefore need a bounded, separate buffer rather than
being appended one-by-one to the authoritative Agora journal.

## Proposed Architecture

### Components

#### `trailObserver.mjs`

Owns repository registration, recursive watchers, path normalization,
coalescing, ignore rules, watcher health, and a bounded recent-touch ring.

It emits normalized touches but does not know about Agora tasks or Plan Map.
This separation keeps filesystem behavior testable without loading the Agora
store.

#### `trailAttribution.mjs`

Pure functions that compare normalized touches with a read-only Agora snapshot
and an optional Plan Map index. It returns zero, one, or several attribution
candidates with evidence and confidence.

It also derives warnings. It never mutates the inputs.

#### `trailStore.mjs`

Maintains ephemeral observations, aggregates, warning state, replay sequence,
and health. It may write a replaceable cache under `.agent/agora/`, but that
cache is not authoritative and must be safe to delete.

#### Agora server integration

The existing server owns lifecycle start and stop, read-only trail endpoints,
and a separate trail SSE stream. The observer must not delay or fail normal
Agora coordination routes.

#### Agora dashboard integration

A dedicated Activity view displays recent touches, warnings, file heat,
attribution evidence, and observer health. Existing task and campaign
inspectors gain compact observed-activity sections.

#### Plan Map integration

Plan Map fetches a read-only summary from the Agora server when available. It
renders activity badges and mismatch notices beside the existing curated data.
Plan Map remains fully functional when Agora or the observer is unavailable.

### Runtime Flow

1. Agora loads the explicit repository registry.
2. The observer starts one watcher per enabled repository.
3. Startup enumeration establishes a baseline but emits no historical touches.
4. A filesystem event is normalized and checked against ignore rules.
5. Events for the same path and operation are coalesced.
6. Attribution compares the touch with current locks, tasks, campaigns, and
   Plan Map links.
7. The trail store updates its recent ring, aggregates, and warning state.
8. Trail SSE clients receive the derived event.
9. The dashboard and Plan Map render evidence without changing source records.

## Repository Registry

Multi-repository support must be explicit. The proposed runtime file is:

`.agent/agora/trail-repositories.json`

This file is local operator configuration and should remain ignored. A checked
in example may be added under `tools/agora/examples/` in Increment 5.

Illustrative schema:

```json
{
  "version": 1,
  "repositories": [
    {
      "id": "aralia",
      "label": "Aralia",
      "root": "F:/Repos/Aralia",
      "enabled": true,
      "ignore": ["dist/**", "coverage/**"]
    }
  ]
}
```

Requirements:

- Repository IDs are stable, unique slugs.
- Roots are resolved once at startup and must exist.
- Every emitted path is repository-relative.
- A touch resolving outside its repository root is rejected.
- Symlink and junction resolution must not silently escape a registered root.
- Duplicate or nested roots produce a configuration warning.
- Invalid entries do not prevent valid repositories from being observed.
- The default, when no registry exists, is the current Agora repository only.

## Data Contracts

The exact JavaScript representation may evolve, but the API must preserve the
semantics below.

### Repository health

```ts
interface TrailRepository {
  id: string;
  label: string;
  rootLabel: string; // A safe display label, never an absolute root by default.
  state: "starting" | "watching" | "degraded" | "resyncing" | "stopped";
  startedAt: number | null;
  lastEventAt: number | null;
  lastError: string | null;
  ignoredEventCount: number;
  droppedEventCount: number;
}
```

### Observed touch

```ts
interface TrailTouch {
  id: string;
  seq: number;
  repoId: string;
  path: string;
  operation: "create" | "change" | "rename" | "remove" | "unknown";
  observedAt: number;
  firstObservedAt: number;
  eventCount: number;
  source: "filesystem" | "provider-hook";
  sessionId: string | null;
  toolName: string | null;
  attribution: TrailAttribution;
}
```

`sessionId` and `toolName` are present only when an optional trusted hook
supplies them. A filesystem touch alone leaves both fields null.

### Attribution

```ts
interface TrailAttribution {
  state: "attributed" | "ambiguous" | "unattributed";
  confidence: "direct" | "strong" | "suggestive" | "none";
  candidates: TrailAttributionCandidate[];
}

interface TrailAttributionCandidate {
  agentId: string | null;
  taskId: string | null;
  campaignId: string | null;
  planmapRefs: string[];
  evidence: Array<
    | "session-match"
    | "exact-lock-path"
    | "lock-glob"
    | "task-retrace-path"
    | "task-retrace-glob"
    | "campaign-path"
    | "campaign-glob"
    | "task-planmap-ref"
    | "planmap-location-hint"
  >;
}
```

### Warning

```ts
interface TrailWarning {
  id: string;
  type:
    | "unattributed-touch"
    | "ambiguous-owner"
    | "unlocked-touch"
    | "out-of-scope-touch"
    | "completed-work-touched"
    | "quiet-active-work"
    | "plan-stale"
    | "observer-degraded";
  severity: "info" | "warning" | "high";
  repoId: string;
  path: string | null;
  taskIds: string[];
  campaignIds: string[];
  planmapRefs: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  occurrenceCount: number;
  explanation: string;
  evidence: string[];
  suggestedAction: string | null;
}
```

### Snapshot

```ts
interface TrailSnapshot {
  version: 1;
  generatedAt: number;
  seq: number;
  repositories: TrailRepository[];
  recentTouches: TrailTouch[];
  warnings: TrailWarning[];
  aggregates: {
    byPath: TrailPathAggregate[];
    byAgent: TrailOwnerAggregate[];
    byTask: TrailOwnerAggregate[];
    byCampaign: TrailOwnerAggregate[];
    byPlanmapRef: TrailOwnerAggregate[];
  };
}
```

## Path Normalization

All matching uses one normalization pipeline:

1. Resolve the configured repository root to its canonical absolute path.
2. Resolve the event path without following it outside the root.
3. Convert separators to `/`.
4. Remove a leading `./`.
5. Preserve display casing but use case-insensitive comparison on Windows.
6. Reject empty paths, traversal segments, and paths outside the root.
7. Match exact paths before globs.
8. Compile globs through the same matcher used by Agora locks where practical.

Default ignores:

- `.git/**`
- `node_modules/**`
- `.agent/agora/**`
- `.agent/scratch/**`
- common build outputs such as `dist/**`, `build/**`, and `coverage/**`
- editor swap files and operating-system metadata
- the observer cache itself

Repository-specific ignores extend, but do not weaken, required safety ignores.
The UI reports ignored and dropped event counts so filtering is observable.

## Event Coalescing and Retention

Editors frequently produce several events for one logical save. The observer
must reduce noise before attribution:

- Coalesce the same repository, path, and compatible operation for 500 ms.
- Preserve `firstObservedAt`, latest `observedAt`, and `eventCount`.
- Treat remove followed by create as rename-or-replace unless the platform
  provides stronger information.
- Keep the most recent 2,000 coalesced touches or 30 minutes, whichever is
  smaller.
- Keep path heat aggregates for 24 hours in memory.
- Deduplicate an equivalent warning for 60 seconds while increasing its count.
- Keep no unbounded history.

A replaceable cache may be written atomically every 15 seconds to improve
dashboard continuity after daemon restart. Cache corruption must be handled by
discarding the cache and restarting observation, never by failing Agora.

Raw touches do not enter Agora's append-only coordination journal. Only a human
or orchestrator action taken in response to evidence creates normal Agora
history.

## Attribution Rules

Attribution is evaluated against one coherent read snapshot. Candidate
precedence is:

1. Provider-hook session matches exactly one registered Agora presence session.
2. Path matches exactly one active lock's exact path.
3. Path matches exactly one active lock glob.
4. Path matches exactly one claimed or in-progress task's `retraceFiles` exact
   path.
5. Path matches exactly one claimed or in-progress task's `retraceFiles` glob.
6. Path matches exactly one active campaign exact path.
7. Path matches exactly one active campaign glob.
8. A linked Plan Map feature has an optional exact location hint.
9. A linked Plan Map feature has an optional location glob.

The strongest matching tier determines confidence, but all meaningful lower
tier evidence remains visible.

### Confidence

- `direct`: A trusted provider session matches a live Agora presence and the
  path matches that agent's active lock or task.
- `strong`: Exactly one live lock owner matches the path.
- `suggestive`: Exactly one task, campaign, or Plan Map location matches, but
  no live lock proves ownership.
- `none`: No candidate matches.

### Ambiguity

If two candidates match at the strongest tier, attribution is `ambiguous`.
The implementation must not break ties by recency, creation order, agent name,
or campaign role.

An exact lock can disambiguate overlapping campaign globs. A provider session
can disambiguate only if the path is also within that session owner's declared
scope. A session ID alone does not authorize an out-of-scope path.

### Completed work

Completed tasks and Plan Map features are excluded from normal active-owner
attribution. They are searched separately to derive a possible
`completed-work-touched` warning. This prevents a completed record from hiding
an otherwise unattributed touch.

## Warning Rules

Warnings are explainable, deduplicated, and advisory.

### `unattributed-touch`

Emit when a non-ignored touch matches no live lock, active task, active
campaign, or Plan Map location hint.

Default severity: `info`. Promote to `warning` after three touches to the same
path in ten minutes.

### `ambiguous-owner`

Emit when multiple candidates match at the strongest attribution tier.

Default severity: `warning`. Promote to `high` when the candidates belong to
different active campaigns and the path is not covered by a unique lock.

### `unlocked-touch`

Emit when a touch maps to an active claimed or in-progress task, but the
claimant has no matching active lock.

Default severity: `warning`. Do not emit for tasks explicitly marked read-only
or planning-only when that metadata is introduced; until then, explain that the
signal may be expected for non-editing work.

### `out-of-scope-touch`

Emit when a trusted provider session identifies an agent, but the touched path
matches none of that agent's lock, task, or campaign scope.

Default severity: `high`. Filesystem-only events cannot produce this warning
because they do not identify an actor.

### `completed-work-touched`

Emit when a touch maps only to completed Agora work or a completed Plan Map
feature.

Default severity: `warning`. The text must say "possible follow-up" rather
than "regression" unless a human confirms the regression.

### `quiet-active-work`

Emit when claimed or in-progress implementation work has no matched touch for a
configurable period. The recommended default is 20 minutes.

Default severity: `info`. Suppress for recent messages, fresh heartbeats,
planning-only tasks, review tasks, and external work when that metadata is
available. This warning must never describe an agent as idle.

### `plan-stale`

Emit when an active Plan Map-linked task has recent matched activity but the
linked feature has not been updated within the configured threshold. The
recommended threshold is 20 minutes after the first observed touch, matching
AgentTrail's useful plan-staleness heuristic while keeping the result advisory.

Default severity: `info`.

### `observer-degraded`

Emit when a watcher cannot start, stops unexpectedly, exceeds its event buffer,
or requires resynchronization.

Default severity: `high` for a fully unobserved repository and `warning` for
partial degradation.

## API

All new endpoints are read-only and follow Agora's existing loopback trust
model. Responses use repository-relative paths by default.

### `GET /trail`

Returns the current `TrailSnapshot`. Optional query parameters:

- `repo=<id>`
- `agent=<id>`
- `task=<id>`
- `campaign=<id>`
- `planmap=<ref>`
- `warning=<type>`
- `since=<unix-ms>`
- `limit=<1..500>`

Invalid filters return `400`. Unknown valid IDs return an empty result rather
than `404`.

### `GET /trail/tasks/:id`

Returns recent touches, aggregate counts, warnings, and attribution evidence
for one Agora task. It does not return or rewrite the task record.

### `GET /trail/campaigns/:id`

Returns activity and overlap warnings for one campaign.

### `GET /trail/planmap/:topicId/:featureId?`

Returns a Plan Map-safe summary. It omits absolute paths, raw hook metadata,
and unrelated task details.

### `GET /trail/repositories`

Returns watcher health and safe display metadata.

### `GET /trail/events`

Provides server-sent events with its own sequence and replay ring. It is
separate from `/events` because trail events are ephemeral and must not consume
the coordination sequence.

Event types:

- `trail.hello`: current sequence, health, and compact snapshot;
- `trail.touch`: one coalesced touch;
- `trail.warning`: warning created or updated;
- `trail.warning-cleared`: warning no longer active;
- `trail.health`: repository watcher state changed;
- `trail.resync`: client must fetch `/trail` again.

`Last-Event-ID` replay is best effort within the bounded ring. A client that
falls behind receives `trail.resync`.

## Agora Dashboard Experience

### Activity view

Add an `Activity` tab beside the current Board and Pets views. It contains:

- observer health for each repository;
- recent touches in reverse chronological order;
- hot paths by coalesced touch count;
- active warnings grouped by severity and type;
- filters for repository, agent, task, campaign, Plan Map reference, and time;
- a pause control that pauses rendering, not collection;
- a clear-local-view control that clears client filters only;
- an inspector showing attribution candidates, confidence, and evidence.

The default view prioritizes warnings and attributed work rather than rendering
an unbounded terminal-like event feed.

### Existing inspectors

Task inspector additions:

- last observed touch;
- matching files and counts;
- attribution confidence;
- active warnings;
- link to filtered Activity view.

Campaign inspector additions:

- observed paths inside declared scope;
- observed paths outside scope when a trusted session proves ownership;
- overlaps with other active campaigns;
- quiet tasks and observer health.

Presence inspector additions:

- activity attributed to the agent;
- direct versus suggestive attribution count;
- current task and lock evidence.

### Accessibility and readability

- Do not use color as the only warning or confidence signal.
- Give every status an icon and text label.
- Explain confidence in plain language.
- Keep raw records behind a secondary disclosure.
- Support keyboard navigation and visible focus.
- Announce new high-severity warnings through an ARIA live region without
  announcing every touch.
- Respect reduced-motion settings.

## Plan Map Experience

Plan Map receives no new status values. It may show these derived badges:

- `activity now`: recent matched activity;
- `quiet`: active linked work with no recent observation;
- `scope warning`: ambiguous or out-of-scope evidence;
- `possible follow-up`: completed feature touched;
- `unmapped`: activity in a topic area without a feature match;
- `observer unavailable`: evidence cannot currently be collected.

Each badge opens a human-readable evidence panel containing:

- observation time;
- repository-relative paths;
- linked Agora tasks and campaigns;
- confidence and matching reason;
- observer health;
- a link to Agora's filtered Activity view.

If Agora is unavailable, Plan Map silently preserves its normal roadmap view
and shows one unobtrusive observer-unavailable indicator. Cached observations
must not masquerade as live data.

### Plan Map location hints

Increment 4 may add optional validated location hints to topics or features:

```json
{
  "observedPaths": [
    "src/systems/entities3d/**",
    "misc/design/entity-*.ts"
  ]
}
```

These hints describe stable product location, not edit ownership. The field
name must remain distinct from Agora lock and campaign scope. Before adoption,
the Plan Map schema and validator must prove that:

- paths are repository-relative;
- traversal and absolute paths are rejected;
- globs use the same documented semantics as Agora;
- a missing field remains valid;
- hints do not alter feature status or dependency logic;
- stale hints produce validation or health output, not automatic deletion.

Until those checks exist, Plan Map attribution uses explicit `planmap:` task
refs and campaign links only.

## Optional Provider Hooks

Filesystem observation is the portable baseline. Provider hooks are optional
enrichment adapters.

An adapter may submit:

```ts
interface TrailHookEvent {
  version: 1;
  provider: "codex" | "claude" | "cursor" | string;
  sessionId: string;
  toolName: string;
  operation: "before" | "after";
  repoId: string;
  paths: string[];
  occurredAt: number;
}
```

Hook requirements:

- accept an allowlisted schema only;
- reject absolute or out-of-root paths;
- never store prompts, command bodies, file contents, environment variables,
  model output, or credentials;
- require the session ID to match a registered Agora presence before granting
  direct attribution;
- tolerate duplicate and out-of-order delivery;
- never block the provider if Agora is unavailable;
- never modify `AGENTS.md`, `CLAUDE.md`, editor settings, or hook configuration
  automatically;
- document manual installation and removal separately for each provider.

## Security and Privacy

- Bind activity endpoints to the same loopback interface as Agora.
- Do not enable cross-origin access beyond the existing approved dashboard and
  Plan Map origins.
- Return repository-relative paths. Expose absolute roots only in local
  diagnostic logs when explicitly enabled.
- Redact paths matching `.env*`, credential, token, private-key, and secret
  patterns to a stable `[sensitive-path]` label before storage or transport.
- Never read file contents to classify a touch.
- Bound request filters, response sizes, buffers, and SSE clients.
- Treat repository registry input as untrusted local configuration.
- Resolve junctions and symlinks before accepting a path.
- Escape all path and record text before dashboard rendering.
- Do not send raw touches through the external operator activity mirror.
- If selected warnings are mirrored later, send only warning type, repository
  ID, record IDs, and redacted relative path.

## Failure and Degraded Modes

### Watcher unavailable

Agora continues normally. The repository is marked `degraded`, its activity UI
shows the error, and no absence-of-activity warnings are derived while coverage
is incomplete.

### Event overflow

Increment `droppedEventCount`, emit `trail.resync`, rebuild aggregate state from
new events, and suppress certainty-dependent warnings until health recovers.

### Daemon restart

Reload an optional valid cache, mark its data as historical, establish a fresh
watch baseline, and emit no synthetic touches for files that already differ.

### Dirty checkout at startup

Existing dirty files are baseline context, not observed touches. The UI may
show a separate Git baseline summary if a later increment adds it, but it must
not attribute pre-existing changes to newly registered agents.

### Rename uncertainty

When the platform reports incomplete rename information, emit `unknown` or a
remove/create pair. Do not invent a source-to-destination relationship.

### Generated write storm

Apply coalescing, ignores, ring bounds, and backpressure. A storm may degrade
observer health but may not consume unbounded memory or delay Agora mutations.

### Plan Map unavailable or invalid

Continue lock, task, and campaign attribution. Mark Plan Map projection as
unavailable and do not infer roadmap ownership.

## Delivery Increments

The work is divided into five increments. Each increment is independently
useful and has a stop/go gate.

### Increment 1: Observe

Goal: Safely collect and expose bounded repository-relative activity for the
current Aralia repository.

Scope:

- add watcher, coalescing, ignore, retention, health, and ephemeral store
  modules;
- integrate lifecycle with the Agora server behind `--trail` or
  `AGORA_TRAIL=1`;
- add `GET /trail`, `GET /trail/repositories`, and `GET /trail/events`;
- include no task, campaign, agent, or Plan Map attribution yet;
- add protocol documentation and unit/server tests.

Acceptance criteria:

1. Startup baseline emits no touches.
2. A create, edit, rename, and remove under the root produces normalized
   repository-relative observations.
3. Required ignores produce no observations.
4. A path outside the root is rejected.
5. Repeated editor events coalesce.
6. Buffers remain bounded during a write storm.
7. Watcher failure does not fail task, lock, or message routes.
8. SSE reconnect either replays retained trail events or requests resync.
9. The existing Agora test suite remains green with the feature disabled and
   enabled.

Stop/go gate: Do not begin attribution until Windows watcher behavior, event
volume, and server responsiveness pass a sustained local test.

### Increment 2: Attribute

Goal: Map observations to existing Agora declarations and derive explainable
warnings.

Scope:

- add pure attribution functions;
- match active exact locks, lock globs, task retrace files, campaign scope, and
  task `planmap:` refs;
- expose task and campaign trail endpoints;
- implement ambiguity and warning rules;
- add optional provider-hook ingestion only if the filesystem baseline is
  stable;
- keep raw observations outside the Agora coordination journal.

Acceptance criteria:

1. A unique exact lock produces strong attribution.
2. Overlapping strongest candidates produce ambiguous attribution.
3. An exact lock disambiguates overlapping campaign globs.
4. Filesystem-only activity never claims a specific actor without ownership
   evidence.
5. Completed work is reported separately from active ownership.
6. Warning explanations name the matched and missing evidence.
7. Attribution functions do not mutate Agora snapshots.
8. Task and campaign state remain byte-for-byte unchanged after observation.

Stop/go gate: Sample real multi-agent work and review false positives with a
human before enabling warning emphasis in the dashboard.

### Increment 3: Agora UI

Goal: Make activity and warnings useful to humans in the Agora dashboard.

Scope:

- add the Activity tab;
- add observer health, filters, recent touches, hot paths, and warnings;
- add readable attribution evidence to task, campaign, and presence inspectors;
- use trail SSE for incremental updates;
- add accessibility, responsive layout, and reduced-motion behavior;
- add browser tests and rendered proof.

Acceptance criteria:

1. A human can explain why a displayed touch is attributed.
2. Ambiguous and unattributed events are visibly distinct.
3. Observer degradation cannot look like zero activity.
4. Pausing rendering does not pause collection.
5. Filters survive ordinary board refresh without becoming durable state.
6. Raw JSON is secondary to human-readable facts.
7. Activity remains usable at the dashboard's supported desktop and narrow
   viewports.
8. No event feed causes the page layout to grow without bounds.

Stop/go gate: Obtain rendered operator acceptance before adding Plan Map
badges, because poor warning language would otherwise spread to two products.

### Increment 4: Plan Map Integration

Goal: Project activity evidence onto roadmap topics and features without
changing roadmap truth.

Scope:

- resolve `planmap:` refs from active Agora tasks;
- add read-only activity badges and evidence panels to Plan Map;
- define and validate optional `observedPaths` hints if explicit refs are
  insufficient;
- add stale-plan and completed-feature-touch signals;
- preserve full Plan Map operation when Agora is unavailable;
- update Plan Map documentation and validation.

Acceptance criteria:

1. No activity event changes `topics.json`.
2. Existing Plan Map status and dependency validation remains authoritative.
3. A linked feature shows recent evidence with task and campaign provenance.
4. An unlinked touch cannot silently select a feature by title similarity.
5. Optional location hints reject unsafe paths and use documented glob rules.
6. Completed-feature activity says possible follow-up, not regression.
7. Agora unavailability leaves a readable, navigable Plan Map.
8. Focused and global Plan Map validators pass.

Stop/go gate: Review whether location hints provide enough value to justify
their maintenance cost before making them common roadmap metadata.

### Increment 5: Multi-Repository and Hardening

Goal: Support Aralia plus explicitly registered related repositories with
operational safeguards.

Scope:

- add repository registry validation and a checked-in example;
- support per-repository health, filters, and ignore overrides;
- add load, restart, overflow, junction, and symlink tests;
- add metrics for event rate, coalescing, drops, buffer size, and attribution
  confidence;
- define optional warning summaries for the operator activity mirror;
- document provider adapters, privacy, troubleshooting, and removal;
- decide whether observation should graduate from opt-in to default-on.

Acceptance criteria:

1. Two or more registered repositories remain distinguishable end to end.
2. Nested, duplicate, missing, or escaping roots fail safely and visibly.
3. One failed watcher does not degrade healthy repositories or Agora itself.
4. Event storms stay within documented memory and latency budgets.
5. Absolute paths and sensitive path names do not leak through APIs or UI.
6. Multi-repository filters work in Agora and Plan Map.
7. Provider hooks can be installed and removed independently.
8. An operator can disable the feature without migrating task or roadmap data.

Stop/go gate: Default-on requires measured acceptable overhead and a reviewed
privacy posture. Otherwise the feature remains explicit opt-in.

## Proposed File Plan

The implementation should prefer these narrow additions and existing files:

| Increment | Files |
| --- | --- |
| 1 | Add `tools/agora/trailObserver.mjs`, `tools/agora/trailStore.mjs`, focused tests; update `tools/agora/server.mjs` and `tools/agora/PROTOCOL.md` |
| 2 | Add `tools/agora/trailAttribution.mjs` and tests; update server integration and protocol |
| 3 | Update `tools/agora/dashboard/index.html` and dashboard tests or browser fixtures |
| 4 | Update the existing Plan Map viewer, schema/validator, and tests only after locating its current implementation; update planning-stack docs if the projection contract changes |
| 5 | Add a registry validator/example, provider-adapter documentation, hardening tests, and narrowly scoped operator-mirror summaries if approved |

Do not assume these filenames authorize editing. Every implementation increment
must re-read current code, check Agora locks, and use the current worktree as
authoritative.

## Test Strategy

### Unit tests

- Windows and POSIX path normalization;
- case handling and separator normalization;
- traversal, junction, and symlink escape rejection;
- glob matching parity with Agora;
- event coalescing and operation folding;
- bounded retention and warning deduplication;
- attribution precedence and confidence;
- ambiguous candidates;
- completed-work separation;
- quiet-work suppression;
- sensitive-path redaction;
- pure-function non-mutation.

### Server tests

- feature flag disabled and enabled;
- endpoint filters and limits;
- malformed registry and malformed hook payloads;
- loopback/CORS behavior;
- SSE hello, replay, overflow, resync, and disconnect cleanup;
- watcher failure isolation;
- no writes to the Agora task/campaign journal from raw touches;
- no regression in existing coordination endpoints.

### Integration tests

- temporary repository create/edit/rename/remove sequence;
- startup with pre-existing dirty files;
- unique lock attribution;
- overlapping campaigns and lock disambiguation;
- task `planmap:` reference projection;
- daemon restart with valid and corrupt cache;
- two repositories with the same relative path;
- high-rate generated-file simulation.

### UI and browser tests

- Activity view filtering and inspector detail;
- degraded observer and disconnected Agora states;
- human-readable evidence instead of raw-record-first presentation;
- keyboard operation and focus;
- ARIA warning announcements;
- narrow and desktop viewport screenshots;
- Plan Map with and without Agora available;
- completed-feature and ambiguous-scope labels.

### Performance budgets

Initial targets, to be measured and revised from evidence:

- less than 2 percent steady-state CPU while repositories are quiet;
- less than 100 MB additional resident memory for one repository and the
  default 2,000-touch ring;
- less than 50 ms p95 synchronous handling per coalesced event before SSE
  transport;
- no measurable p95 latency regression above 10 ms on normal Agora mutation
  routes during a 100-events-per-second synthetic burst;
- recovery from a bounded overflow without daemon restart.

Performance target failure blocks default-on rollout but need not block an
opt-in diagnostic release.

## Rollout and Migration

1. Ship Increment 1 disabled by default.
2. Run local shadow observation during normal multi-agent work.
3. Record event volume, ignored volume, dropped events, memory, and latency.
4. Add attribution with warnings visible only in diagnostics.
5. Review a sample of attributed, ambiguous, and unattributed touches.
6. Enable the Agora Activity tab for explicit opt-in sessions.
7. Obtain operator acceptance of language and signal quality.
8. Add Plan Map projection without location hints first.
9. Add optional location hints only where refs and campaign scope are
   insufficient.
10. Test multiple explicit repositories and provider adapters.
11. Decide default-on status from measured overhead and privacy review.

No migration of existing Agora or Plan Map records is required. Existing tasks
without refs and campaigns without paths remain valid; their activity is less
attributable and is shown honestly as such.

## Operational Metrics

The diagnostics surface should expose:

- events received, ignored, coalesced, retained, and dropped;
- current and peak ring size;
- watcher restarts and degraded duration;
- attribution counts by confidence;
- warning counts by type and severity;
- SSE clients, replay hits, and resyncs;
- processing latency percentiles;
- optional-hook events accepted and rejected.

Metrics are local diagnostics. They are not agent performance measures and
must not rank agents by touch volume.

## Documentation Requirements

Each implementation increment updates:

- `tools/agora/PROTOCOL.md` for data and endpoints;
- `tools/agora/ORCHESTRATOR.md` when orchestration behavior changes;
- `tools/agora/AGENT.md` when worker-visible self-check behavior changes;
- `tools/agora/PLANNING-STACK.md` only if the projection contract changes;
- the Plan Map domain or operator documentation when its UI is integrated;
- this specification's `Verified:` date when validated against changed code.

Documentation must consistently state that observed activity is advisory and
cannot by itself prove authorship, completion, or a policy violation.

## Overall Acceptance Criteria

The complete five-increment capability is accepted when:

1. Agora observes one or more explicit repositories without compromising
   normal coordination behavior.
2. Observations are bounded, restart-safe, and repository-relative.
3. Attribution is explainable and represents ambiguity honestly.
4. Existing locks, tasks, campaigns, and `planmap:` refs provide the primary
   mapping evidence.
5. The dashboard gives humans a readable activity and warning view.
6. Plan Map displays evidence without gaining a second status engine.
7. No event mutates task, campaign, lock, feature, status, or dependency truth.
8. Provider hooks are optional, minimal, and free of prompt or content capture.
9. Security, accessibility, failure, load, server, and browser tests pass.
10. Operator documentation explains enablement, limitations, and removal.
11. The implementation retains no unbounded event history and exports no local
    activity by default.
12. The system can be disabled without changing or migrating authoritative
    Agora or Plan Map records.

## Recommended Defaults

- Name in UI: `Activity`, not `AgentTrail`, to avoid implying an upstream
  product dependency.
- Initial enablement: opt-in with `AGORA_TRAIL=1`.
- Current repository fallback: enabled when the flag is set and no registry
  exists.
- Coalescing: 500 ms.
- Recent-touch ring: 2,000 events or 30 minutes.
- Path heat: 24 hours in memory.
- Quiet-work threshold: 20 minutes, informational only.
- Plan-stale threshold: 20 minutes after first matched activity.
- Activity persistence: replaceable local cache, not authoritative history.
- Provider hooks: off by default.
- Plan Map location hints: deferred until Increment 4 evidence shows they are
  needed.
- External mirroring: off by default; never mirror raw touches.

## Open Decisions

The implementation can begin with the recommended defaults. These decisions
must be revisited at the named gates:

1. After Increment 1 load testing, should the observer remain opt-in or become
   default-on for Agora development?
2. After Increment 2 sampling, which warning types have a sufficiently low
   false-positive rate for primary dashboard placement?
3. During Increment 4, are task refs and campaign scope sufficient, or does
   Plan Map need maintained `observedPaths` hints?
4. During Increment 5, which related repositories should be in the operator's
   explicit registry?
5. Should selected high-severity summaries enter the operator activity mirror,
   or remain only in Agora?

## Known Limitations

- `fs.watch` semantics differ across operating systems and filesystems.
- Filesystem events do not identify the writing process or agent.
- Several agents sharing one checkout can remain ambiguous without unique
  locks or trusted session hooks.
- Read-only, planning, browser, and external work can be correctly quiet.
- Generated outputs can dominate event volume if ignores are incomplete.
- A path-to-feature hint can become stale even when syntactically valid.
- Activity shows that a path changed, not whether the change is correct.
- Local observation cannot prove work performed in an unregistered remote
  checkout.

These limitations must remain visible in documentation and UI language.

## External Precedent and Attribution

AgentTrail v0.2.0 is an MIT-licensed local observability project that combines a
declared plan with observed filesystem and optional session-hook activity. Its
useful precedent includes bounded local state, derived component status,
staleness signaling, session activity, filesystem heat, and a local dashboard.

Aralia's adaptation intentionally differs by using Agora and Plan Map as the
existing declarations, preserving their separate authority, using explicit
repository registration, and refusing automatic setup mutations. If source is
copied rather than independently implemented, preserve the upstream MIT
copyright and license notice as required by the
[AgentTrail license](https://github.com/sodiumsun/agenttrail/blob/main/LICENSE).
The upstream implementation is available in
[`bin/agenttrail.mjs`](https://github.com/sodiumsun/agenttrail/blob/main/bin/agenttrail.mjs).
