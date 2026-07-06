# Plan-map data-model decisions (2026-07-05)

Captured here rather than in `public/planmap/**` because that area is under
active concurrent rework (another session + a codex swarm). This is a
point-in-time record of two settled decisions about the plan-map's data model.

## Decision 1 — Edge types: `hard` vs `chosen`, with a MANDATORY `why`

Every dependency edge in `topics.json` is `{ id, kind, why }`.

- **`hard`** — a true prerequisite: the target literally cannot be built or be
  correct until the source ships. Rendered **solid**. Hard deps are the ONLY
  thing that gates the computed **▶ READY** highlight — a topic is READY when
  all of its hard deps are `done`.
- **`chosen`** — a strategic / sequencing decision, not a technical block:
  "we are choosing to do X before Y because…". Rendered **dashed**. Chosen deps
  do **not** block READY (a node whose only unmet deps are chosen can still be
  ready), and a superseded chosen dep drops to the Graveyard as non-blocking.

**The `why` is mandatory on every edge, hard or chosen.** An edge without a
rationale is not allowed. This is the load-bearing rule: it makes the graph a
reasoning artifact ("why does this ordering exist?") instead of a box-and-arrow
diagram. The viewer surfaces `why` as the edge's hover tooltip.

Rationale: the two kinds answer different questions. `hard` answers "can I start
this yet?" (readiness/scheduling); `chosen` answers "why are we doing it in this
order?" (strategy). Collapsing them loses the distinction between a wall and a
preference — and a preference with no stated reason is just clutter.

## Decision 2 — Distances are feet-native (feet is the number in the data, not tiles)

Distances are **stored and reasoned about in feet**, never as tile counts. The
5-ft tile is a referee/rendering convenience, not the canonical unit.

- Spell ranges, movement, and reach live in the data as feet (D&D-native): a
  30-ft move is `30` (feet) in the data — which merely happens to be 6 tiles at
  5 ft — not `6` stored as tiles.
- The fight-in-place invisible referee snaps to a 5-ft tile grid internally for
  adjudication, but that is a derived view over the feet-canonical numbers, not
  the source of truth. Same principle as worldforge "feet-canon" and the
  `BattleMapTile` vocabulary.

Rationale: tiles are a presentation artifact that changes with grid resolution;
feet are the invariant the rules are written in. Keeping feet as the stored
number means the referee's tile size can change (or the gridless BG3-style
presentation can drop the visible grid entirely) without rewriting any data.

## Still open

- **The data model is in flux right now.** `public/planmap/**` is being actively
  reworked by another session and a codex swarm, so treat this as a snapshot —
  reconcile against the live schema (`public/planmap/topics.schema.json`) before
  relying on it.
- **Feature-level (sub-tile → sub-tile) dependency edges remain deferred.** Edges
  currently connect topics (a dep may narrow to one feature of the target via
  `dep.feature`, but a feature cannot yet depend on another feature). Named as an
  open item in the plan-map v3 design and not yet built.

Ready to archive.
