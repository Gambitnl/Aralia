# Agent sim deepening

The town agent-sim preview (`?phase=agentsim`) turns a generated town into the
people who live in it. This doc captures what is built and the agreed next steps.

## What is built (2026-06-26)

Reachable at `?phase=agentsim`. Pure and deterministic, ~29 tests green.

- **Town layout**: a real Voronoi-ward town (default, from `townEngine`, adapted for
  the roster/motion pipeline) or a simpler radial demo burg. Fills the window.
- **Behaviour sim**: each villager has needs (energy, satiety, social, wealth) that
  decay and recover; they pick an activity by their most-pressing need and the hour
  (sleep, eat, work, socialise, shop, home); a small wealth economy; families act
  together (a child trails an out-and-about parent; spouses meet to socialise).
- **Schedule mode**: a stateless fixed daily routine you can scrub to any hour. Kept
  as a comparison for now (see decision below).
- **People**: every villager has an age, a race (blood relatives share a race; a
  married-in spouse may differ), and family ties (spouse, parents, children,
  siblings, kin in another town, or no known family).
- **Movement**: agents walk the streets (ward edges, densified so they join the road
  near their door, not cut across blocks).
- **Villager registry**: a household-grouped census with clickable kin links and a
  hover/click detail card.

## Decisions (2026-06-26)

- **Collapse to one mode: Behaviour only.** Drop the Schedule/Behaviour toggle. The
  clock slider re-simulates from dawn up to the chosen hour, so scrub-anywhere still
  works. The fixed routine becomes an internal fallback.
  **BUILT 2026-07-18 (task 187c0fa3).** `?phase=agentsim` is now behaviour-only: the
  toggle is gone and scrubbing/jumping the clock calls the new pure `simulateMindsTo`
  (in `roster/agentSim.ts`), which replays the day from its anchor (hour 0) to the
  chosen hour and snaps agents to their decided plots — the same hour always yields the
  same town. Pressing play keeps the smooth per-frame walk, continuing from that state.
  The fixed-schedule motion (`townMotionSnapshotAt`) stays as the internal fallback for
  the dev overlay and 3D preview. Proof: `roster/__tests__/agentSim.test.ts`
  (determinism/grid-equivalence/wrap) + `Worldforge/__tests__/AgentSimPreview.test.tsx`
  (DOM: no toggle; path-independent re-sim).
- **Deepen it over time** with all three: a real economy (wages, shop income, prices,
  rich vs poor districts), relationships that evolve (affinity from repeated contact →
  friendships, rivalries, courtship, new marriages), and town-scale events (festival,
  fire, crime, weather). This needs a multi-day spine (aging, births, deaths,
  genealogy).
- **Wire it into the real game**: populate the town the player enters from the world
  map, render the crowd in 3D, and let the player click and talk to NPCs.
- **Spatial believability**: front doors on the street plus true door-to-door routing,
  agents stepping inside interiors, and day/night lighting.

Not chosen: standalone inspection/story tooling (family-tree graph, follow-a-villager
camera). Surnames and genealogy may fall out of the deepen work.

## Build order

1. Behaviour-only mode (small; simplifies the rest). **DONE 2026-07-18 (task 187c0fa3).**
2. Front doors + door-to-door routing (finishes the movement story).
3. Deepen-over-time engine (economy + relationships + events + life events).
4. Wire into real gameplay (depends on a solid sim).

## Open items

- Deep courtyard-infill buildings still have a long walk to the nearest street.
- The sim is single-day; no aging/marriages/births/deaths across days yet.
- Relationships are assigned at generation; they do not yet change from interaction.
- It is a preview, not wired into actual gameplay.
- Relationship to the older headless `shipped-living-world` sim (economy/festivals)
  needs reconciling — reuse its logic or keep the visual sim separate.
- **Follow-up (task 187c0fa3):** live in-browser eyeball of `?phase=agentsim` is still
  owed. It was blocked on 2026-07-18 because a concurrent interior-generator migration
  (task 8352cd22) had renamed `generateInterior` → `blueprintForPlot` without yet
  updating `roster/generateTownRoster.ts`, so the page's real roster path threw. The
  collapse is verified at the unit + jsdom-DOM level; re-render the page for the visual
  sign-off once that migration lands.
- **Deferred (task 187c0fa3):** scrubbing snaps agents to their decided plot centroids
  (deterministic, truthful "who is where at hour H"). Street-walking is only shown during
  playback. If we want walking *frames* under a paused scrub too, extend `simulateMindsTo`
  to also fold the route positions (needs the street graph + centroids).
