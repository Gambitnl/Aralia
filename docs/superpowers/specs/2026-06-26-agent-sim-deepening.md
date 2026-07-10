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

1. Behaviour-only mode (small; simplifies the rest).
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
