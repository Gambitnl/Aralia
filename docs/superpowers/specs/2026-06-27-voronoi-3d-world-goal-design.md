# Goal: A High-Quality 3D World That Trickles Down From the Voronoi Worldmap

**Date:** 2026-06-27
**Status:** North Star + first implementable slice
**Author:** Remy (with Claude)

---

## Part 1 — North Star

### Vision

A 3D world where **everything you see and everything you encounter traces deterministically back to a worldmap Voronoi cell.** Drill into any cell — World → Region → Local → 3D ground — and the terrain, settlement, inhabitants, threats, and hidden places are all coherent expansions of that one cell's canonical facts. Nothing renders that didn't come from a cell. Nothing exists in the world that the worldmap didn't authorize.

The worldmap is the **trunk**. Submaps are **branches** that grow finer detail, but only along the trunk's grain. There is no second source of truth, no parallel pipeline, no free-floating procedural noise.

### What "high quality" means here

Content and visuals are **co-primary**. The world must be both *full of meaningful, coherent things* and *believable to look at* — and crucially, both qualities derive from the same parent cell. The render is how the inherited content *expresses itself*; it is never decoration bolted on top of empty terrain.

A high-quality result is one where a player can walk a Local submap and find that:
- the terrain matches the cell's elevation, biome, and climate;
- the settlement matches the cell's culture, population magnitude, and economy;
- the inhabitants match the settlement;
- the threats match the cell's danger markers and zones;
- the notable features (forests, ruins, camps, roads, rivers, roadside taverns) are exactly the ones the worldmap traced — no more, no fewer;
- and every one of those things can be traced, by query, back to the parent fact that produced it.

### Governing principles (the contract)

**1. The Voronoi cell is canonical.**
The FMG (Azgaar) atlas is the single source of truth. One spine. The legacy non-Voronoi `WorldData` / continent streamer and any parallel or dual tracks are **retired or rebuilt on the atlas**. If it renders, it came from a cell.

**2. Inheritance with detail altitude — elaborate, never invent.**
Each tier owns a specific *altitude* of fact. A child tier **elaborates** its parent's facts into finer detail, and may freely generate detail the parent does not own (a villager's name, a tree's exact position, the precise building count). But a child may **never introduce a feature the parent never traced** — no forest, ruin, dungeon, road, or river that lacks a parent anchor. The parent owns *what exists*; the child owns *what it is made of*.

**3. The detail budget per tier.**
Detail is rich but *scale-appropriate* at every level. A tier is "complete" when it carries every fact it owns at its own altitude — not when it is granular.

| Tier | Owns (canonical, rich-but-coarse) | Generates (fine detail) |
|------|-----------------------------------|--------------------------|
| **World cell** | Geography (elevation, biome, climate); identity (culture/state, population *magnitude*, economy class); **feature traces** — presence + approximate location + type of notable things: forests, ruins, dungeons (flagged, not visibly placed), camps, roads, rivers, roadside taverns | — |
| **Settlement cell** (village/city — a richer cell *type*) | Everything a world cell owns, plus urban-scale facts: districts, notable structures, rough extent, key institutions | — |
| **Region / Local submap** | — | Instantiates each traced feature as actual walkable geometry (the forest's real extent, the dungeon's real entrance, the camp's real tents); generates granular settlement layout |
| **3D ground** | — | Full granularity: individual trees, buildings, named NPCs, props, furniture |

The world cell does **not** know each villager's name, the tree count, or the number of buildings. Those are the submap's to generate. The world cell **does** know that a forest, a roadside tavern, and a ruin exist here, roughly where, and of what kind.

**4. Fail loud — at the right altitude.**
If a parent cannot furnish a fact it *owns at its own altitude*, that is a **defect in the worldmap generator**, surfaced by audit and fixed at the source. Submaps only read down; they never paper over a thin parent with a drill-time fallback (per the no-fallback directive).

A "gap" is altitude-specific:
- A Local submap needs a forest anchor, but the world cell traced none → **defect** (the world cell failed to own a feature trace it should).
- A settlement cell lacks district data → **defect**.
- A submap generates villager names the world cell never carried → **correct** (that's the submap's altitude, not a gap).

**5. Deterministic.**
Same seed + same cell ⇒ byte-identical world, at every tier, regardless of drill path or depth. (Same identity rule already proven by the canonical-town generator.)

**6. Provenance is checkable.**
Every rendered entity can name the parent-cell fact it derives from. The system can answer, for any tree, wall, NPC, or hostile: *"which cell fact produced you, and at which tier were you elaborated?"* Anything that cannot answer is a bug.

### The trickle-down data flow

```
World Voronoi cell  ─ owns ─▶  geography + identity + feature traces
        │ (read down; elaborate, never invent)
        ▼
Region / Local submap  ─ generates ─▶  walkable terrain + instantiated features + settlement layout
        │
        ▼
3D ground  ─ generates ─▶  individual trees, buildings, named NPCs, props
```

Each arrow is a one-way contract: down only. A child may ask its parent "what do you own here?" and elaborate the answer. A child may never write back up, and may never source a feature its parent didn't trace.

---

## Part 2 — First Implementable Slice

### Scope

**One drill path, end to end, proving the contract.** Pick a single representative land cell that carries a burg, and drill it World → Region → Local → 3D ground. The slice succeeds when the inheritance contract provably holds the whole way down, and fails loudly where the worldmap cell is too thin to source what a tier needs.

This is deliberately *one path*, not a broad sweep — depth of proof over breadth of coverage.

### The proof — a Cell Provenance Audit

The centerpiece deliverable is an audit that walks the rendered 3D slice and classifies **every** entity (each terrain patch, each instantiated feature, each building, each NPC, each hostile, each hidden site) into one of three states:

- **(a) Inherited** — directly carries a parent-cell fact (e.g., this biome tint = the cell's biome).
- **(b) Elaborated** — fine detail that legitimately elaborates a parent fact the child is entitled to generate (e.g., this named NPC elaborates the settlement's population magnitude).
- **(c) Orphaned / defect** — a feature with no parent anchor, **or** a missing scale-appropriate fact the parent should have owned.

The audit **PASSES** only when zero entities are in state (c). State (c) is a red test — sparsity becomes a failure, not a silent shrug.

### The canonical cell schema (the yardstick)

The slice defines, concretely, what facts a cell *must* carry to be "rich enough" at its altitude — the schema the audit measures against:

- **Wilderness/land cell:** elevation, biome, climate, culture/state ownership, danger markers/zones, and feature traces (forest? ruin? dungeon? camp? road segment? river? roadside tavern? — each as presence + approx location + type).
- **Settlement cell:** the above, plus population magnitude, economy class, districts, notable structures, rough extent.

### Output of the slice — the upstream gap list

Running the audit against real FMG data produces a concrete, prioritized list:
- which canonical-schema facts **FMG already provides** (use them);
- which are **missing** and must be added to the worldmap generator (the upstream fixes).

This list is the bridge from "build the 3D world" to "the worldmap must get richer at its own altitude" — and it is generated by evidence, not guessed.

### System disposition (use or replace)

- **Keep & build on:** the FMG Voronoi atlas, the artifact tiers (Region/Local), the canonical-town generator (already deterministic and identity-correct), the ground chunk loader + renderer, the hostile-derivation-from-markers path, and the combat-extracts-from-ground seam (already a faithful inheritor).
- **Retire / rebuild on the atlas:** the legacy non-Voronoi `WorldData` continent streamer and the `?wf_legacy=1` path. The km-scale flyover, if kept, is rebuilt as a scale variant of the *same* atlas-rooted pipeline — not a parallel data source.
- **Add:** the canonical cell schema, the provenance tagging that every tier must emit, and the Cell Provenance Audit harness.

### Sign-off (both required, because quality is co-primary)

1. **Render-and-eyeball** the 3D slice (per the visual-inspection rule — render rig, not numeric goldens alone): does it *look* like a coherent expansion of that cell?
2. **Audit passes** — zero orphaned/defect entities; every rendered thing names its provenance.

Neither alone is sufficient. A slice that looks good but fails the audit is hiding invented content; a slice that passes the audit but looks wrong means the schema or the elaboration is too thin.

---

## Out of scope (YAGNI for the first slice)

- Multiple cell archetypes / biome coverage (the slice is one path).
- AI/LLM gap-filling (explicitly rejected — gaps are fixed upstream, not generated at drill time).
- Asset/prop polish (realistic rocks, vegetation detail) — deferred per the breadth-over-polish decision.
- Sub-cell elevation fidelity upgrades (Terrain Diffusion) — separate track.
- Writing back up the hierarchy / player-authored world edits.
