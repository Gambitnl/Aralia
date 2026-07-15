# Planning surface freshness — design

**Status:** approved by Remy, 14 July 2026 (chat + artifact review). **Revision 2, same day:** Remy directed a full merge — the project tracker is absorbed into planmap and deleted. See "Revision 2: full absorption" below; it supersedes the doc-mirror contract, the audit check, and the mechanical migration in this spec.
**Artifact (visual version):** https://claude.ai/code/artifact/67892a55-95b6-4c4f-b42d-8ab952deb0de
**Planmap topic:** `planning-surface-freshness`

## Summary

Planmap becomes the only place where status is set by hand. The roadmap, the project docs, and the task board stay in line with it automatically. The roadmap reads planmap live on every page load. The project docs receive machine-written copies. The task board feeds results back into planmap.

Decisions recorded from the design session:

- planmap holds all status; its 5 words become the only legal vocabulary
- the 71 project doc folders with no planmap topic join planmap as component-tier topics
- the project tracker page's health view moves into the planmap page; the tracker page then forwards there
- the roadmap revives and is fed from planmap (Remy explicitly rejected parking it)
- updates run both live (after board events) and nightly (2am backstop)

## The problem, measured (14 July 2026)

- roadmap: 100% of its 324 manifest entries are over 30 days old; the newest is from 19 May; only 1 of its 21 feature groups matches a planmap topic
- project docs: 24 of 53 active projects not updated in over 30 days; 11 different status wordings, so no tool can compare them
- planmap: only 29 of 85 topics carry any date, so freshness is not measurable from the file
- Agora board: finished tasks are never removed; a task handed to a missing agent stays stuck (WF-G15); campaigns keep dead owners (WF-G17)
- chronicle and atlas: run only when someone remembers; nothing shows when nobody has

## How it works

Two feed styles, each where it fits:

- tools with a live page read planmap directly on load — the roadmap works this way, so it cannot lag
- files that people and git read get copies written into them — the project docs work this way

One idempotent program does all writing: `tools/agora/sync-surfaces.mjs`. Steps, each independent:

1. board to planmap: apply done and in-progress task states to planmap features (reuse `tools/agora/planmap-reconcile.mjs` logic, `--apply` path)
2. planmap to docs: write the 3 machine-owned status lines into each linked doc
3. board tidying: archive old done tasks, refuse or repair ghost claims, flag dead-owner campaigns
4. freshness: stamp `updated` on changed topics; write `public/planmap/health.json`

Two triggers, same program:

- the Agora daemon runs it debounced, about 60 seconds after the last board event
- the nightly 2am job runs it as backstop and writes the daily freshness report; the 2am job is the external Windows Scheduled Task "Aralia Daily Git Commit" (`C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1`) — add one line there, before the commit step

Idempotency is a hard requirement: running twice must equal running once, at any moment, mid-session.

## Reviving the roadmap

Two code findings explain the death, each with a direct fix.

**Finding 1 — the planmap wiring exists but is empty.** The roadmap UI fetches `/Aralia/planmap/topics.json` on every load (`devtools/roadmap/src/components/debug/roadmap/modules/roadmap-bootstrap-loader.ts`) and applies `applyPlanmapOverlay` (`modules/planmap-overlay.ts`), which replaces a node's status from its bound topic. The binding map `PLANMAP_TOPIC_BY_NODE_ID` (`devtools/roadmap/scripts/roadmap-engine/generate.ts:47`) is empty.
Fix: fill the bindings, and move them from source code into a data file the sync program maintains.

**Finding 2 — new nodes require source edits.** The engine (`roadmap-engine/generate.ts`) builds feature nodes only from `.agent/roadmap-local/processing_manifest.json`, gated by hard-coded allowlists (`CURATED_SUBFEATURES` and friends). Entries that fail the gate are dropped silently. Every new feature needed a code edit, so feeding stopped in May.
Fix: the engine gains one new node source — planmap itself. Every topic becomes a node under its campaign's branch; every topic feature becomes a child node. No allowlist applies to planmap-born nodes. Existing curated nodes stay unchanged.

Safety rules the code demands:

- duplicate node ids crash the whole graph (`roadmap-engine/id-validation.ts` throws; `/api/roadmap/data` then 500s). Planmap-born ids derive from the topic id (already schema-guaranteed unique, `^[a-z0-9][a-z0-9-]*$`) under a distinct prefix (for example `planmap_<topicId>`), so they cannot collide with curated ids
- titles may change freely: node id comes from the topic id, not the title, so saved positions (`layout.json`), label overrides, and test results stay attached
- the sync program never writes roadmap stores. The doc-processing pipeline (sqlite `tooling_state.sqlite` + manifest) is untouched; `roadmap-session-close.ts` regenerates the manifest from sqlite and would clobber outside edits — so nothing edits it from outside
- planmap status maps to roadmap's 3 colors as the existing overlay already does: done→done, active→active, parked/specced/superseded→planned

The roadmap keeps what is its own: per-node test results (`.agent/roadmap-local/node-test-status.json`, written by the test runner), document evidence, media, and the opportunities panel.

## The field map

Fill in once; everything below follows with no further effort.

| You do this, once | Roadmap | Project docs | Planmap page | Task board |
|---|---|---|---|---|
| change a topic's `status` | node recolors on next load | status line rewritten (≤1 min live, nightly at worst) | badge + date stamp | — |
| add a new topic | new node under its campaign branch | nothing until docs linked | new entry, age 0 | available to wave planning |
| add or update a feature | child node appears/recolors | — | feature row updates | wave tool can make tasks (exists: `planmap-to-wave.mjs`) |
| an agent finishes a board task | follows | follows | follows | program flips the linked feature in planmap; the rest follows |
| set `focus` | node highlights (`planmapFocus`, exists) | — | focus marker | — |
| link `docset` | detail panel links docs | doc gains its 3 machine lines | health badges appear | — |
| mark `superseded` | node reads as planned/gray | status line updated, old label kept in note | drops from active lanes | open tasks flagged |

Flows the other way, or not at all:

- test results: test runner → roadmap nodes; planmap never touches them
- open gap counts: read live from each GAPS.md; shown on the planmap page; never copied
- doc prose (north stars, decisions, runbooks): people write it; only the 3 status lines are machine-owned
- topic dependencies as roadmap edges: later, optional

## File contracts

### New planmap topic fields (tooling-written)

- `updated`: date of last real change; stamped by `planmap-add.mjs` and the sync program
- `docset`: docs/projects slug holding the topic's deep docs
- `tier`: `strategic` or `component`; pages filter on it so ~156 topics stay readable

`public/planmap/topics.schema.json` and `tools/agora/validate-planmap.mjs` learn all 3.

### Status vocabulary

Only planmap's words are legal anywhere: `parked` · `specced` · `active` · `done` · `superseded`.
One-time conversion of the 11 doc wordings:

| Found in docs (count) | Becomes | Note |
|---|---|---|
| active (53) | active | — |
| complete, complete_for_current_gap_set, complete for World-owned scope (4) | done | fine print moves to a note field |
| idle (5) | parked | — |
| partial (11) | active | each shows in the review table |
| review-required (4) | active | plus a decision-waiting flag in health.json |
| merged-reference, reference-only, linked-support (6) | superseded | original label kept in note |
| missing (1) | — | set by hand at review |

### Doc frontmatter: 3 machine-owned lines

```
status: active          # copied from planmap, one of the 5 words
planmap_topic: forests  # owning topic id
last_synced: 2026-07-14 # when the program last wrote here
```

Everything else in the doc stays hand-owned. `scripts/audit-living-project-docs.cjs` (`npm run projects:audit`) gains one check: these lines must match planmap; a hand edit fails the audit and the next sync rewrites it.

Shared doc folders (8 combat topics → one combat doc set) roll up deterministically: any linked topic active → active; else any specced → specced; else all done → done; else parked.

### New small files

- `public/planmap/health.json` — per topic: doc completeness, open gap count, decision-waiting flag, days since `updated`, and the program's own last-run time (a dead program is visible on the page)
- a campaign-to-branch table: which campaign's topics hang under which roadmap branch; set at migration, checked nightly
- a node-to-topic bindings file replacing `PLANMAP_TOPIC_BY_NODE_ID` in code

## The one-time move

- the 32 topics already matched to a doc folder get their `docset` link
- the 71 unmatched doc folders each become a component-tier topic, status via the conversion table
- all existing topics (85 at design time; 88 by capture day) get `tier: strategic` and `updated` seeded from git history of topics.json
- existing curated roadmap nodes that correspond to topics get bound, from a reviewable table
- each of the 10 campaigns gets a roadmap home branch, from a reviewable table
- planmap topic `planmap-roadmap-sync` (specced) closes as superseded by this design

Gate: nothing is written until Remy approves the printed tables (71-row folder table, bindings table, campaign homes).

## Board tidying

- done tasks are archived after 14 days (default, Remy may change) to a monthly archive journal; live board stays small
- handoff to a dead or unknown agent is refused at the endpoint (closes WF-G15)
- sweep reopens claimed tasks whose claimant left the roster
- campaigns whose owner is gone get flagged stale (closes WF-G17)

## Failure handling

- steps run independently; one failure never blocks the rest
- if topics.json fails validation, the program refuses all writes and reports instead — garbage never propagates
- writes are atomic: temp file then rename
- failures land in health.json; the planmap page shows last-good-run age — loud, never silent

## Testing

- unit: vocabulary conversion, shared-doc roll-up, archive selection
- idempotency golden: fixture state, run twice, byte-identical output
- roadmap invariant: every planmap topic appears exactly once; no id collisions
- migration approved from printed tables before any write
- planmap UI badges checked by eye with screenshots during the work (visual rule)

## Build order

1. program core: board→planmap apply, date stamps, health.json, nightly trigger — stops the worst rot, makes age visible
2. roadmap revival: engine reads planmap topics as nodes; bindings move to data — the dead tool returns, rot-proof by construction
3. live trigger: daemon runs the program debounced after board events — same-day freshness for parallel sessions
4. doc copies + audit check — ends double bookkeeping and the 11-word mess
5. board tidying — board stops growing; WF-G15 and WF-G17 close
6. one-time move (gated on table approval)
7. planmap page: age badges, health badges, tier filter; tracker page forward — the console lands on data that is already true

## Implementation pointers

- planmap writers: `tools/agora/planmap-add.mjs`, `tools/agora/planmap-reconcile.mjs` (one-way board→planmap, `--apply`), `tools/agora/validate-planmap.mjs`, `tools/agora/planmap-history.mjs`
- roadmap live path: `roadmap.html` → `src/roadmap-entry.tsx` → `RoadmapVisualizer.tsx:790` → `modules/roadmap-bootstrap-loader.ts` (4 fetches incl. topics.json) → `modules/planmap-overlay.ts`; server: `scripts/vite-plugins/roadmapManagers.ts` (:3010) → `devtools/roadmap/scripts/roadmap-server-logic.ts` → `roadmap-local-bridge.ts` → `roadmap-engine/generate.ts:2650`
- roadmap gates to change: `generate.ts:47` (`PLANMAP_TOPIC_BY_NODE_ID`), curated allowlists near `generate.ts:2497`; id rules `roadmap-engine/id-validation.ts`, slug in `roadmap-engine/text.ts`
- tracker data source: `scripts/vite-plugins/devhub/projectRoutes.ts` (`/api/projects/dashboard`, `/api/projects/detail`); audit `scripts/audit-living-project-docs.cjs`
- board: `tools/agora/store.mjs` (`sweepExpired`, no task GC today), `tools/agora/server.mjs` (sweep every 30s; presence TTLs 10/60/120 min; lock TTL 30 min)
- nightly host: external ps1 `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` (2am scheduled task); PLANNING-STACK.md already proposes wiring reconcile there
- doctrine to respect: `tools/agora/PLANNING-STACK.md` — reconcilers stay few; gaps flow up only by human curation; this design adds the sync program as the one writer and keeps gap ingestion out of planmap

## Out of scope

- chronicle and atlas writers (visibility only: the nightly report shows days since each last ran)
- reviving the roadmap doc-processing pipeline (session-close, manifest ingestion) — it keeps working as-is for doc evidence
- topic dependencies as roadmap edges
- any change to Agora presence/lock reaping beyond the listed task rules

## Revision 2: full absorption (Remy, 14 July 2026)

Remy's direction, verbatim intent: each project tracker card becomes a planmap tile; gaps become step tiles (features) on it; subagents do the migration, one card at a time; each subagent first checks the card is not already on the map; done work is fitted onto the right lane (campaign) at the right date (`history` stamps); after migrating, the subagent deletes the whole `docs/projects/<slug>/` folder, distilling anything worth keeping into a spec doc linked from the tile.

What this supersedes in the spec above:

- the 3 machine-written doc lines, the roll-up rule, and the audit check — void; the doc layer stops existing
- the `docset` field — not added; migrated tiles carry `link` to their distilled spec doc instead
- the mechanical 71-row migration — replaced by the agent wave below
- health.json doc fields — health derives from planmap itself (age from `updated`, open steps from features, decision flags), plus engine liveness and chronicle/atlas silence

The wave, per project (85 board tasks, seeded from planmap):

1. dedupe: check the map for an existing topic covering the card (id match, then title match — reuse the matching from the 14 July diff); if covered, enrich that topic instead of creating one
2. migrate: card → topic tile (right campaign lane, `tier: component` unless clearly strategic, status via the conversion table above, `status_note` for nuance)
3. gaps → features: each open gap row becomes a feature (step tile); decision-required gaps get `decision: true`
4. done work → history: completed work is added as done features with `history.built` backdated from doc evidence dates
5. distill: content still worth keeping (runbooks, live design decisions) goes into one spec doc under `docs/superpowers/specs/`, linked from the tile
6. delete: remove `docs/projects/<slug>/` entirely (git history is the archive; the 2am snapshot preserves pre-delete state)
7. validate: `node tools/agora/validate-planmap.mjs` must exit 0 before the task is done

End-state cleanup once all 85 are migrated: delete `misc/project_tracker.html` + `misc/project_tracker*.js`, `docs/projects/PROJECT_TRACKER.md`, `scripts/audit-living-project-docs.cjs` and its npm script, and the `/api/projects/*` routes in `scripts/vite-plugins/devhub/projectRoutes.ts`. `orchestrate reconcile`'s GAPS.md leg goes dormant with the files (board→planmap reconcile replaces it).

Schema additions for the wave: feature-level `decision` (boolean) joins Revision 1's `updated`, `tier`, `status_note`.

## Open defaults

- archive age for done tasks: 14 days
