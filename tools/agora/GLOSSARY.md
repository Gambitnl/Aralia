# Glossary — planning stack jargon

Plain-English definitions for the terms used around the plan-map, the Agora
board and the specs. Written for a reader who was not in the room when the
term was invented. If a term is not here and should be, add it.

## The plan-map (the roadmap tool)

**Plan-map** — the roadmap page at `/Aralia/planmap/index.html`. It shows what
we plan to build and in what order. Data lives in one file:
`public/planmap/topics.json`.

**Topic** — one box on the map. A piece of work big enough to plan around,
like "Beautification wave" or "Fight in place — slice 1".

**Feature (sub-feature, tile)** — one small card inside a topic's box. A part
of the topic with its own status and its own mini spec document. The numbers
on the tiles are the intended build order.

**Campaign** — the color grouping of topics: World (purple), Combat (teal),
Tooling (gray). Just a category, nothing more.

**Edge (arrow)** — a line between two topics meaning "the pointed-at topic
needs the other one first". Two kinds:
- **Hard** (solid line) — a real technical requirement. You cannot build X
  before Y exists.
- **Chosen** (dashed line) — an order Remy picked on purpose. You *could*
  build X first, but decided not to.
Every arrow carries a **why** — hover it to read the reason.

**READY (the green badge)** — this topic could be started today: nothing
hard blocks it. Computed fresh every time the page loads, never stored, so
it cannot go stale.

**?n (open count)** — how many unanswered questions the feature's spec
document still lists. Counted from the document, never guessed.

**Spike (⚠, dashed tile)** — a research question that could invalidate the
approach, dressed as a task. "Find out whether X even works."

**Superseded / Graveyard** — a decision we reversed. It keeps its record
(with a one-line "killed because") in a strip at the bottom instead of being
deleted. Dead decisions teach; deleted ones repeat.

**Shipped strip** — where finished topics retire so the map only shows live
work.

**Compound node** — a box with smaller boxes inside it (a topic containing
feature tiles). Fancy name for "nested".

## Getting work done (the Agora side)

**Agora / the board** — the local coordination server (port 4319) where
work items ("tasks") live, agents claim them, and progress is recorded.

**Wave** — one batch of work sent to agents at the same time. Comes from a
plan file listing its packets.

**Packet** — one work parcel inside a wave, sized for one agent: what to do,
which files it owns, what must finish before it.

**Wave skeleton** — a draft plan file generated from a topic's features by
`planmap-to-wave.mjs`. It is deliberately incomplete — a human fills in the
file lists and instructions before sending it.

**Punch list** — one term, borrowed from construction: the checklist of
things still to fill in before the job is done. Here: the instructions the
wave-skeleton tool prints ("fill in files, review the order, then seed").

**Seed / dispatch / watch / gate / reconcile** — the wave lifecycle verbs:
put tasks on the board, hand them to agents, wait for results, check the
work compiles, then write the outcomes back to the trackers.

**Refs** — small labels on a board task saying what it belongs to, e.g.
`planmap:fip-slice1/3d-ground-picking` ties a task to one plan-map feature.

**Orphan / DISCONNECTED** — a plan-map topic that says "in progress" but has
no board task tied to it. Nothing can ever update its status automatically,
so it will silently go stale. The reconciler warns about these.

## Keeping the records honest

**Status rot** — the disease where a tracker's statuses stop matching
reality because updating them is manual and nobody does it. Killed the old
feature-tree roadmap.

**Truth loop** — the cure: work finishes on the board → the reconciler
writes the new status back to the plan-map → the map stays true without a
human remembering to edit it.

**Reconciler** — a small script that copies status from the place work
actually happens to the place people look. One-directional on purpose.

**One truth + projections** — the rule that each fact has exactly ONE place
where editing it counts (specs own decisions, the board owns work status,
the plan-map owns plan status). Every other copy is display only.

**The swamp** — the 1,400+ auto-generated TODO tasks and 343 tracked gaps.
Raw intake, not a plan.

**Promotion rule** — how things move between layers: an item climbs from
the swamp to the plan-map only when a human decides it matters; plan-map
topics flow down to the board through tooling. Never automatic upward.

## Map-modelling terms (from the design reviews)

Several of these terms name KNOWN LIMITATIONS of the plan-map, not just
concepts. Those are tracked as real gaps (PM-G1 through PM-G7) in
`docs/projects/planmap/GAPS.md`, each with a trigger condition for when it
must be fixed.

**Containment vs dependency** — "this lives inside that" versus "this needs
that first". The map keeps them separate on purpose: boxes contain, arrows
depend.

**Edge-to-cluster vs edge-to-member** — an arrow pointing at a whole box
versus an arrow pointing at one tile inside a box. The map only supports
the first kind today.

**Member-edge costume** — the warning sign that the map's shape is starting
to lie: an arrow officially points at a whole topic, but its written "why"
admits it really needs just one feature inside it. The validator flags
these.

**Threshold signal** — the agreed tripwire for upgrading the map's model:
three member-edge costumes at once means the simple model no longer fits
and arrows need to be able to point at single features.

**Black-box condition** — the test for whether pointing an arrow at a whole
box is honest: it is, if the outside world only cares that the box is
finished, not which part of it finished.

**False serialization** — making things wait in line that could have run at
the same time. Happens when a numbered list is treated as a dependency
chain.

## Tonight's design terms (combat)

**Fight in place** — combat happens where you stand in the 3D world, with
no scene change.

**Invisible referee** — the 5-foot-square rules grid that decides movement,
cover and spells without ever being drawn on screen.

**(Referee) patch** — the rectangle of rules-grid squares cut out of the
world around a fight. "Context-sized" means bigger for open ground, smaller
for streets.

**Presentation-parity matrix** — the checklist proving every spell effect is
visible and readable on every combat view before an old view is retired.
