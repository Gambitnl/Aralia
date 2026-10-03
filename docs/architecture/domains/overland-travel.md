# Overland Travel

Verified: 2026-09-09

## Purpose

How the party crosses the world map: route planning, ferries and fares, getting
lost, forced marches, and what each of those costs. This doc covers the travel
RULES. The renderer that draws them is `docs/architecture/domains/world-map.md`;
sea voyages on an OWNED ship are a separate loop, see
`docs/architecture/domains/naval-underdark.md`.

## Where it lives

- `src/systems/travel/` - the pure rules (routing, fares, drift, forced march,
  provisions, encounters, readout formatting). Everything here is unit-testable
  without React.
- `src/systems/worldforge/travel/` - the graphs those rules run on, built from
  the canonical atlas (land graph, multimodal land+sea graph, submap graph).
- `src/components/MapPane.tsx` - the only place that COMMITS a trip. It plans the
  route, prices it, rolls the once-per-trip outcomes, and stamps them onto the
  travel meta it hands to `onTileClick`.
- `src/App.tsx` - applies that meta after the move: gold, conditions, log lines.

The split matters: MapPane decides, App applies, and `systems/travel` owns every
rule both of them use. A new travel rule belongs in `systems/travel`, not in
either component.

## Route planning

`planRoutesFrom(graph, origin, opts)` (`routePlanning.ts`) runs one Dijkstra pass
and returns a FIELD - `to(cell)` yields the plan for any destination, so hovering
the map is free after the first pass. `opts.speedMph` prices time; the graph's
own `edgeMinutes` wins where a graph supplies it (the multimodal graph does, so
its sea legs keep their own speed).

Effective speed comes from `transportSpeedMph(transport)` (D&D ft/round / 10 ≈
mph; a puller-limited cart falls back to 2 mph), then the party's exhaustion
penalty is applied - see Forced march below.

## Ferries and fares

`buildMultiModalAtlasGraph` builds ONE graph that can walk to a port, cross
water, and walk away from the far harbor. Land travel alone cannot cross sea
cells at all, so the ferry is what makes an island reachable. Sea cells are
transit, never destinations: a clicked lane is rejected rather than snapped
ashore.

`segmentRoute` splits the resulting plan into `land` / `sea` / `tender` legs.
A `tender` leg appears only when an OWNED ship is too large for the destination
dock (`dockTiers.ts`); a hired ferry is a small craft and lands anywhere.

`ferryFare(route)` charges a flat `FERRY_BOARDING_FEE_GP` plus
`FERRY_PER_SEA_MILE_GP` per sea mile, rounded up, computed from sea miles only.
Both are TUNABLE and flagged for design review. MapPane checks affordability
BEFORE the provisioning flow and refuses the trip when the party cannot pay;
App deducts the fare with `MODIFY_GOLD` after arrival. Owned-ship voyages pay no
fare - they commit through `onSetSail` instead and resolve day-by-day at sea.

The readout shows the fare before commit: `formatMultiModalSummary` appends
`· Fare: N gp` whenever a positive fare is supplied. `AtlasSvgView` draws land
legs dashed amber (`6 4`), sea legs dotted cyan (`2 5`) and tender legs muted
tan (`0.5 3`), with harbor markers at each transfer.

## Navigation drift (getting lost)

`deriveNavDrift` rolls the DMG p.111 get-lost check ONCE per committed trip: a
Survival check against the route's GOVERNING navigation DC, which is the worst
cell the route crosses. An all-maintained route grades to DC 0 and is exempt -
no roll at all. On a failure the party still ARRIVES at the intended cell but
drifts a wrong compass heading and loses 1d6 hours; `cause` names whether the
wilds or a faded forest path lost them.

Drift is a LAND mechanic and time-only. A trip with any sea leg never rolls (you
do not get lost following a ferry lane), and no drift ever moves the party to a
different cell. There is no "sail with no destination and drift" behavior - a
voyage always commits to a destination burg.

Seeding is `(worldSeed, destination cell)`, so a given world reproduces the same
trip exactly. Note the PRNG caveat in `docs/projects/GLOBAL_GAPS.md` GG-140: a
small seed makes `SeededRandom`'s first draw a near-minimum roll.

## Forced march and exhaustion

`calculateForcedMarchStatus(hours)` marks any trip past the safe 8-hour day as a
forced march and derives a Constitution save DC that climbs with each extra hour
(DC 10 + hours over). `resolveForcedMarch` rolls each member's save; App applies
the party-wide `exhaustion` condition when anyone fails.

Exhaustion then costs speed. `partyExhaustionLevel` reads the party's worst level
and `exhaustedSpeedMph` applies the 5e -5 ft per level through
`calculateExhaustionEffects`, and MapPane prices every route field (land,
multimodal, submap) at that speed. A worn-out party therefore takes measurably
longer over the same ground; a rested party is priced exactly as before.

Known limit: the condition does not STACK - `SET_PARTY_CONDITION` is idempotent,
so travel exhaustion tops out at level 1 today. Tracked as GG-141.

## Provisions, encounters, events

A committed trip also spends food and water (`travelProvisionDecision`,
`applyProvision`), rolls one danger encounter graded by medium - the road ambush
table for land, the sea table scaled by lane/coastal/open danger for a crossing
(`travelEncounter.ts`, `multiModalAtlasGraph` danger tiers) - and rolls one
seeded biome trip event (`tripEvents.ts`). Underprovisioned trips open a choice
flow (half day / push on / forage) instead of moving.

## Proof

`src/systems/travel/__tests__/travelMechanicsVerification.test.ts` walks the
whole chain end to end (ferry itinerary -> fare -> gold -> arrival cell; road
exemption -> drift; forced march -> exhaustion -> slower route). The per-rule suites
next to it cover each piece in isolation, and
`src/components/Worldforge/__tests__/AtlasSvgView.test.tsx` pins the drawn leg
styles and readout text.
