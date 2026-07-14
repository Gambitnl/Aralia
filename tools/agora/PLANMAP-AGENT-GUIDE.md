# Plan-map — Agent Operating Guide

**Audience: an AI agent working in `F:\Repos\Aralia`.** This tells you how to read, update, and reason about the plan-map. It is the "how to drive it" companion to two authoritative docs you should defer to on conflicts: `tools/agora/PLANNING-STACK.md` (who owns which fact) and `tools/agora/PLANMAP-GRILL-PROMPT.md` (how to capture decisions during a design interview).

If you only remember three things:
1. **The plan-map is the curated roadmap, not a bug tracker.** ~10–40 topics, hand-picked. It records *what we decided to build and in what order* — never "every open defect." Do not pour gaps/TODOs into it.
2. **Update it the moment a direction is decided** ("we're building X"), and flip a status the moment work ships. Use the CLI `planmap-add.mjs`; it validates on write.
3. **Statuses live here; decisions live in specs; work items live on the Agora board.** Don't restate one layer as another. Editing a *projection* (a derived display) is how the old roadmap rotted to death.

---

## 1. What it is (the mental model)

- **File of record:** `public/planmap/topics.json` (JSON, schema at `public/planmap/topics.schema.json`).
- **Sub-campaign lanes:** a campaign may declare an ordered `subcampaigns` array; a topic's optional `subcampaign` places it in that nested visual lane. This grouping does not change dependencies, readiness, or status.
- **Viewer:** `http://localhost:<port>/Aralia/planmap/index.html` on any running dev server. A tech-tree: campaign-colored **topic boxes**, **feature tiles** inside them, `requires` **arrows** between topics, a **Graveyard** strip for superseded decisions, one **★ FOCUS** star, and a date-progression **timeline/rewind** derived from `history.json`.
- **Shape:** `{ campaigns: {…}, topics: [ … ], repoRoot, _readme }`. A topic = a box worth planning around. A feature = a tile inside it. **Feature array order = intended build order** (the viewer chains tile arrows in list order).
- **No dates in the plan itself** — only order (`deps` + feature sequence). Real dates live separately in `history.json` for the timeline; never invent them.

The plan-map sits *above the swamp*: ~343 open gaps (`docs/projects/**/GAPS.md`) and 1400+ auto-TODO board tasks feed it, but only by **human curation**. The ~10-topic-to-hundreds-of-gaps ratio is the design, not a backlog to "complete."

---

## 2. When you touch it (triggers)

| Trigger | Action |
|---|---|
| A design interview / conversation lands "**we're building X**" (a decided feature, agreed direction, named follow-up) | **Capture it the SAME turn** as a topic or feature (status `parked` or `specced`). Don't ask permission; don't batch for later. This is the standing "alpha-signal" rule. |
| You (or a subagent) **shipped** a feature | Flip its status to `done`. |
| Work **started** on a feature | Flip to `active` (or let `planmap-reconcile.mjs` do it from the board). |
| A topic got **grilled into a spec** | Set `specced`, add the `link` to the spec doc. |
| A decision was **reversed/abandoned** | Set `superseded` + a one-line `killed` reason. **Never delete** — the "why we didn't" is worth keeping (it drops to the Graveyard). |
| A gap/defect you noticed | Do **NOT** add it here. It belongs in a `GAPS.md` row (the intake). It only becomes a plan-map feature when a human decides "this is a direction, not a defect." |

**Do not** hand-edit the plan-map to "fix" a status you *think* is stale — check whether the reconciler owns it first (§6).

---

## 3. Reading it

- **Programmatic read** (preferred for logic): `JSON.parse` `public/planmap/topics.json`. Iterate `topics[]`; each has `id, title, sub?, campaign, status, deps[], link?, features[]`.
- **Find a topic:** exact `id` match (ids are `^[a-z0-9][a-z0-9-]*$`). There is **no fuzzy matching** anywhere in the tooling — use exact ids.
- **Feature identity across tools:** a feature is addressed by its **slug** = `title` lowercased, non-alphanumerics → `-`, trimmed, truncated to 40 chars; duplicate base slugs get `-2`, `-3`… by occurrence order, computed over the **full** features array (done included, so indices never shift). This exact scheme is shared by `planmap-to-wave`, `planmap-reconcile`, and `validate-planmap` — never diverge from it.
- **Visual read:** open the viewer (above) if you need to see arrows/graveyard/focus at a glance. Everything it shows is derived from `topics.json` + `history.json`; the JSON is the truth.

---

## 4. The fields (what each one means and who sets it)

**Topic** (`required: id, title, campaign, status`):
- `id` — stable kebab-case slug. Never reuse or rename lightly (refs point at it).
- `title` — the box label. `sub` — one-line subtitle (a *projection* of the spec's decision; keep it short and honest).
- `campaign` — one of the keys in `campaigns` (currently `world`, `combat`, `tooling`, `travel`, `character`, `ui`); sets the color lane.
- `status` — `parked | specced | active | done | superseded` (see §5).
- `focus: true` — **at most ONE topic** may carry this: the thing actually being touched right now (capacity-of-one). The validator warns on duplicates. Move it, don't accumulate it.
- `deps[]` — **product ordering** (see §5). `link` — repo-relative path to the topic's spec doc.
- `killed` — one-line reason (only when `superseded`). `history` — `{designed, built, builtApprox?}` real dates for pre-git work (timeline only; `builtApprox: true` if derived — never fake a precise date).

**Feature** (`required: title, status`), a tile inside a topic:
- `title`, `status` (same enum). List order = build order.
- `link` — its own small subspec (`docs/superpowers/specs/subspecs/<topic>--<feature>.md`).
- `open: n` — integer **mirror** of the "## Open" bullet count in that subspec. **Counted from the doc, never guessed**; recompute when the doc changes. It's the settledness axis.
- `spike: true` — research that could invalidate the approach (renders dashed ⚠; do not let it masquerade as a build step).
- `parallel: true` — this step branches off the parent tile instead of chaining after the previous step (default is sequential).
- `killed`, `history` — as above.

---

## 5. Status enum + deps (the two things agents get wrong)

**Status semantics** (identical for topics and features):
- `parked` — captured, not yet designed.
- `specced` — grilled out, a spec exists.
- `active` — being built now.
- `done` — shipped.
- `superseded` — decision reversed; add `killed`, keep the record (Graveyard).

**`deps[]` = PRODUCT ordering, and it is NOT execution scheduling.** Each dep is `{ id, kind, why }` (or a bare string id you must later enrich):
- `kind: "hard"` — a real technical prerequisite (X cannot exist until Y).
- `kind: "chosen"` — a deliberate order someone picked (X could be built first, but we chose Y first).
- `why` — **mandatory**, one honest sentence. If your `why` names *one specific feature* of the target topic, the edge is wrong-grained → split that feature into its own topic (or use the `deps[].feature` slug to point the arrow at that one feature).
- **Never confuse `deps` with Agora `after`.** `after` is intra-wave execution scheduling ("packet B after packet A"); `deps` is cross-wave product intent. Neither derives from the other. See `PLANNING-STACK.md §4`.

---

## 6. Keeping statuses honest — the reconcile loop (READ THIS before hand-flipping a status)

The old feature-tree roadmap died of manually-edited, never-updated statuses. The antidote is **one truth + projections**, kept in sync by exactly **three one-directional reconcilers** (do not build a fourth; a fourth means you created a second editable home for a fact):

1. **board → GAPS.md:** `node tools/agora/orchestrate.mjs reconcile <plan> --apply`
2. **board → plan-map:** `node tools/agora/planmap-reconcile.mjs [--apply]` — Agora tasks whose refs contain `planmap:<topicId>/<feature-slug>` flip feature/topic statuses (task done → feature `done`; any in-flight → at least `active`; all features done → topic `done`). It also prints **DISCONNECTED** topics no board task references — those can never be auto-fixed and are one quarter from rot.
3. **plan-map ↔ spec headers:** `node tools/agora/validate-planmap.mjs` (advisory drift warning when a spec's `Status:` line contradicts the map).

**Practical rule for you:** if a feature is driven by an Agora wave (it carries `planmap:` refs), let `planmap-reconcile.mjs --apply` set its status — don't hand-flip. If it's a topic/feature with **no** board task behind it (a DISCONNECTED one, e.g. work you just did directly), then you *are* the source of truth — flip it by hand via the CLI. At the start of any planning session, run the reconcile **dry run** to see current drift + the DISCONNECTED list.

---

## 7. How to WRITE to it (commands, in order of preference)

**Primary: the capture CLI** (`tools/agora/planmap-add.mjs`) — read → mutate → validate → write, deliberately dumb (exact ids, errors loudly):

```bash
# New topic
node tools/agora/planmap-add.mjs --new-topic <id> --title "…" --campaign <world|combat|tooling|travel|character|ui> \
     [--sub "…"] [--status parked|specced|active|done] [--link docs/…] [--dep <targetId>[:hard|:chosen]]

# Add a feature to an existing topic
node tools/agora/planmap-add.mjs --topic <id> --feature "…" [--status parked] [--link docs/…]

# Flip a status (topic, or a feature matched by substring)
node tools/agora/planmap-add.mjs --topic <id> [--feature-match "ground picking"] --set-status active
```
After adding a `--dep`, go fill in its `why` (the CLI leaves it blank/TODO — an edge without a `why` is a lie).

**Fallback: hand-edit `topics.json`.** Only when the CLI can't express the change (e.g. adding `open:`, `spike:`, `parallel:`, `history`, `killed`, or a `deps[].feature`). Then **always** run:
```bash
node tools/agora/validate-planmap.mjs   # must exit 0
```
It checks required fields/enums, unique ids, every `deps[].id` resolves, every `link` file exists, campaigns resolve, and slug references resolve.

**Multi-agent safety:** when other agents are live in the tree, acquire the Agora file lock first — `node tools/agora/client.mjs lock public/planmap/topics.json` — because `topics.json` is a single hot file and concurrent writes clobber (last-write-wins). If you can't lock, prefer the CLI (atomic read-mutate-write) over a raw editor, and re-read immediately before editing.

---

## 8. Turning a topic into executable work (plan → wave)

When a topic is ready to build:
```bash
node tools/agora/planmap-to-wave.mjs <topicId> [--out .agent/scratch/orchestrate/<topicId>.json]
```
It emits an orchestration **wave skeleton** — one packet per non-`done` feature, `after`-chained in features-array order, each stamped with `refs: ["planmap:<topicId>/<feature-slug>"]` so `planmap-reconcile.mjs` can later close the loop. It is a SKELETON: you fill in files/agent/guidance by hand before `orchestrate seed` (no LLM auto-fill by design). This is the ONLY sanctioned plan-map → board direction; do not auto-ingest the other way.

---

## 9. Specs pair with the map (don't duplicate facts)

- A grilled topic gets a spec: `docs/superpowers/specs/YYYY-MM-DD-<name>.md`, referenced from the topic's `link`.
- Each meaningful feature gets its own subspec: `docs/superpowers/specs/subspecs/<topic>--<feature>.md`, with exactly two sections — `## Decision` (what was locked + why) and `## Open` (remaining questions). Link it from `feature.link`; set `open:` to the Open-bullet count.
- **Decisions live in specs. Statuses live in the map. Open questions live in the subspec's `## Open` — nowhere else.** The plan-map `sub`/`why` are one-line *projections* of the spec, not the source. See `PLANNING-STACK.md §1`.

---

## 10. What NOT to do (failure modes that rotted the last roadmap)

- ❌ Don't auto-ingest gaps/TODOs into the plan-map (would recreate the drowned 200-branch feature-tree). Gaps flow UP only by human curation.
- ❌ Don't hand-edit a *projection* as if it were truth (spec `Status:` headers, MEMORY.md, the feature-tree counters at `:3010` — those are known-rotted *inventory*, presence not progress; never "fix" them by hand).
- ❌ Don't delete a superseded topic/feature — mark `superseded` + `killed`.
- ❌ Don't merge `deps` and `after`, or derive one from the other.
- ❌ Don't invent dates, `open:` counts, or a precise `built` date (use `builtApprox: true`).
- ❌ Don't leave a `--dep` without a `why`, or a second `focus: true`.
- ❌ Don't guess feature slugs — compute them with the shared scheme (§3) or read the tool output.

---

## 11. Recipes (copy-paste starting points)

**Capture a freshly-decided direction (during/after a conversation):**
```bash
node tools/agora/planmap-add.mjs --new-topic <id> --title "…" --campaign <lane> --status parked --dep <blocker>:hard
# then edit topics.json to add the dep's why (one sentence), and validate:
node tools/agora/validate-planmap.mjs
```

**Mark a feature you just shipped as done:**
```bash
node tools/agora/planmap-add.mjs --topic <id> --feature-match "<unique words from the title>" --set-status done
```

**Split a wrong-grained feature into its own topic** (your dep `why` pointed at one feature): create the new topic, move the feature there as a tile, and repoint the arrow with `deps[].feature` if the dependence is on just that tile.

**Retire a reversed decision:** hand-edit the topic/feature to `"status": "superseded"` + `"killed": "<one line>"`, then `validate-planmap.mjs`.

**Start-of-planning-session hygiene:**
```bash
node tools/agora/planmap-reconcile.mjs        # dry-run drift + DISCONNECTED list
node tools/agora/validate-planmap.mjs         # structural sanity
```

---

## 12. Quick reference

**Commands:** `planmap-add.mjs` (capture/flip), `validate-planmap.mjs` (sanity, exit 0), `planmap-reconcile.mjs [--apply]` (board→map status), `planmap-to-wave.mjs <id>` (map→wave skeleton), `client.mjs lock <file>` (multi-agent lock).

**Status:** parked → specced → active → done (+ superseded/killed).

**Ownership:** decision→spec · status→map · work item→Agora board · open question→subspec `## Open` · gap→`GAPS.md`. Everything else is a projection.

**Authoritative companions:** `tools/agora/PLANNING-STACK.md` (fact ownership + 3 reconcilers), `tools/agora/PLANMAP-GRILL-PROMPT.md` (decision-capture interview), `public/planmap/topics.schema.json` (field-level truth), `tools/agora/GLOSSARY.md` (jargon).
</content>
