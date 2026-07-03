# The Planning Stack — Truth Ownership Rules

**Audience:** any agent or human touching plans, specs, statuses, gaps, or the board.
**Origin:** planning-stack review, 2026-07-02. Sibling to `ORCHESTRATOR.md`.

Aralia's planning stack is five surfaces, but only some of them OWN facts. The
rule that keeps it truthful: **one truth + projections** — every kind of fact
has exactly ONE editable home per band; everything else is a derived display
that a reconciler refreshes. Editing a projection is how status-rot starts
(the feature-tree roadmap died exactly this way).

## 1. Who owns what

| Fact kind | AUTHORITATIVE home | Projections (display only — never hand-edit as truth) |
|---|---|---|
| **Decision** (what we chose + why) | Spec doc (`docs/superpowers/specs/*.md`) / subspec (`specs/subspecs/*.md`) | plan-map `sub`/`why` summaries, MEMORY.md, Agora packet guidance |
| **Status** of a curated topic/feature | plan-map (`public/planmap/topics.json`) — kept honest by `planmap-reconcile.mjs` | spec "Status:" headers, MEMORY.md, feature-tree |
| **Status** of an in-flight work item | Agora board task (`:4319`) | plan-map (via reconcile), GAPS.md rows (via `orchestrate reconcile`) |
| **Status** of a tracker gap | the owning `GAPS.md` row — kept honest by `orchestrate reconcile --apply` | gapIndex JSON (pure parse, never hand-edited) |
| **Dependency** (product ordering) | plan-map `deps[]` (`hard`/`chosen` + `why`) | prose in specs |
| **Work item** (a thing to do) | Agora board task (state machine, claimant, refs, result) | GAPS.md rows are the *intake*; plan-map features the *curated subset* |
| **Open question** | subspec "Open" section | nowhere else — do not scatter open questions into other layers |

The feature-tree roadmap (`devtools/roadmap`, :3010) is an **inventory**
(presence, not progress) — its status counters are known-rotted and must not be
trusted or "fixed" by hand. MEMORY.md is a session cache, regenerable, never
authoritative.

## 2. The three-reconciler rule

Exactly three one-directional sync mechanisms keep the stack truthful. Do not
build more; do not skip these:

1. **board → GAPS.md** — `node tools/agora/orchestrate.mjs reconcile <plan> --apply`
   (done tasks with gap refs close their tracker rows).
2. **board → plan-map** — `node tools/agora/planmap-reconcile.mjs [--apply]`
   (tasks carrying `planmap:<topic>/<feature-slug>` refs flip feature/topic
   statuses; also prints **DISCONNECTED** topics that no board task references —
   those are the ones reconcile can never fix and are one quarter from rot).
3. **plan-map ↔ spec headers** — `node tools/agora/validate-planmap.mjs`
   (advisory drift warning when a spec's "Status:" line flatly contradicts the
   plan-map status; fix whichever side is lying).

Everything else is derive-on-read (gapIndex parses GAPS.md live; MEMORY.md is
rewritten per session). If you find yourself wanting a fourth reconciler, you
probably created a second editable home for a fact — remove it instead.

### Nightly drift visibility (to be wired — mechanism lives outside the repo)

The 2am snapshot commit is a Windows Scheduled Task ("Aralia Daily Git Commit")
running `C:\Users\Gambit\.claude\scripts\aralia-daily-commit.ps1` — NOT a
repo-owned script, so this repo can't extend it directly. The one line to add
to that script, before the commit block:

```powershell
node F:\Repos\Aralia\tools\agora\planmap-reconcile.mjs *> F:\Repos\Aralia\.agent\scratch\planmap-drift.txt
```

That lands a nightly dry-run (including the DISCONNECTED list) in
`.agent/scratch/planmap-drift.txt`, visible to every session. Until it's added,
run the reconcile dry-run manually at the start of any planning session.

## 3. The promotion rule (curated layer above the swamp)

The swamp: ~343 open gaps (gapIndex over `docs/projects/**/GAPS.md`) and 1400+
auto-TODO board tasks. The curated plan: ~10 plan-map topics. The ratio is the
design, not a bug.

- **Gaps/TODOs flow UP only by human curation.** A gap becomes a plan-map
  feature only when a human decides "this is a direction, not a defect."
  The plan-map NEVER auto-ingests gaps — wiring gapIndex → plan-map would
  recreate the drowned 200-branch feature-tree.
- **Plan-map flows DOWN by tooling.** `planmap-to-wave.mjs <topicId>` turns a
  topic's features into an orchestration wave skeleton, stamping
  `planmap:<topicId>/<feature-slug>` refs so reconcile can close the loop.

## 4. `deps` vs `after` — different concepts, never unify

- **plan-map `deps[]`** = PRODUCT ordering: "topic X requires topic Y", with
  `kind: hard` (technical block) or `kind: chosen` (deliberate sequencing) and
  a mandatory `why`. It survives across waves and expresses design intent.
- **Agora plan `after`** = EXECUTION scheduling: "packet B starts after packet A
  finishes", within one wave, resolved to board task deps at seed time.

They look similar and are not. Neither is derivable from the other: a `chosen`
product dep may be violated by an intentional out-of-order spike; an `after`
chain often exists between features with no product dependency at all (shared
file ownership, review order). Do not "simplify" by merging them or generating
one from the other.

## 5. Feature-tree recommendation (recorded, not yet applied in full)

The feature-tree's Done/Active/Planned counters rotted (105 done / 96 active,
known-wrong). Minimal honesty fix applied 2026-07-02: the "At A Glance" card in
`devtools/roadmap/src/components/debug/roadmap/RoadmapVisualizer.tsx` is
relabeled **"Inventory — presence, not progress"**. Fuller fix (suppress or
freeze the counters entirely) is deferred — the generator pipeline
(`devtools/roadmap/scripts/*`) has known failure modes and is not worth
destabilizing for a label.
