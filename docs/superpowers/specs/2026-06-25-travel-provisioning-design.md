# Travel Provisions — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Author:** Remy + Claude

## Problem

The world map lets the player travel to any *discovered* cell, however far, and the
trip just advances the clock by the route's duration. Nothing communicates — or
enforces — that a long journey requires **provisions**. The player has no way to
realize, before committing, that they can't feed the party all the way to a distant
destination. We want a food/provisioning mechanic that gates long-distance travel and,
crucially, surfaces that limit in the UI *before* the trip is taken.

This started as "UX that helps the player realize they can't travel somewhere without
visiting it" — but the real intent is **logistics**: can the party carry enough food
for everyone over the days the trip takes.

## Scope

### v1 — player party only (this spec)

Buildable now on existing systems (`party: PlayerCharacter[]`, `ItemType.FoodDrink`
items with weight + freshness, the atlas travel-route planner, companion `loyalty`).

### Deferred phases (recorded, not built here)

Each is blocked on a prerequisite system that does not exist yet:

| Phase | Blocker |
|---|---|
| Mounts as food consumers (`food/day * mounts`) | no mount system |
| Vendor-rapport auto-resupply en route | no vendor/merchant-relationship system |
| Non-party NPC travel companions + provisioning consent (dialogue, recorded agreement, negotiated terms, relationship-gating, dynamic re-consent) | no non-party-NPC interface (party ≠ `companions`) |

These are captured so the v1 data model leaves room for them (the daily-consumption
sum is an extensible list of consumers, not a hardcoded `party.length`).

## The model

### Food currency

A canonical **Rations (1 day)** item, category `ItemType.FoodDrink`, carries a
`rationDays: 1` payload (one person-day of food). *Days-of-food* for the party =
`sum(rationDays across all party inventories) / dailyNeed`. Other food items can feed
into the ration-day total later; rations is the clean v1 currency.

### Consumption

- Daily need (person-days/day) = number of consumers. v1 consumers = `party.length`.
  The consumer list is modeled as an extensible array so mounts/NPCs can be added later
  without changing the gate logic.
- Half-rations mode: each consumer eats `0.5` person-day/day, doubling range, at the
  cost of a **fatigue tick** (and, for companions, a small morale/loyalty hit) per day.

### Trip length

`tripDays = ceil(routeSeconds / 86400)`, where `routeSeconds` comes from the existing
travel-route planner (`planSelectedAtlasRoute` → `route.minutes * 60`). Short hops are
<1 day and never gated; the mechanic only bites on long journeys.

### Reachability (food range)

`foodRangeDays = floor(daysOfFood / dailyNeed)` at full rations (or `* 2` at
half-rations). A cell is **in range** if its `tripDays <= foodRangeDays`.

## UX — the surfacing

### Travel-mode readout (MapPane)

In Travel mode the atlas already shows a route preview on hover. Add a provisions line:

> *Tabbart's Reach — 5 days travel · Food: 3 days · short 2 days*

with a ✓/✗ state. Standard / in-range trips read green; shortfalls read amber/red.

### Atlas affordance (the pre-click signal)

Cells whose `tripDays` exceeds `foodRangeDays` get a **graduated "provisions-short"
overlay** on the atlas (e.g. a faint amber hatch + a 🥖 warning glyph), so the player
*sees* the food horizon before clicking. This is the answer to the original request.

### The gate — graduated, never a flat block

- **In range** → travel proceeds normally.
- **Short by a little** (≤ ~⅓ of trip) → amber warning + one-click confirm.
- **Short by a lot** → red strong-confirm.

Departing underprovisioned opens a choice (composing the approved behaviors):

1. **Turn back** — cancel.
2. **Forage / hunt en route** — a survival skill check that offsets part of the food
   need in exchange for added travel time and slower progress.
3. **Half-rations** — stretch the supply (range × 2) at a daily fatigue/morale cost.
4. **Push on** — if food still reaches zero mid-route, the party **auto-halts at the
   last cell its food could sustain** (partial-stop) and takes **starvation**
   consequences there (a status effect: exhaustion / HP or ability penalty).

### Companions

Marching party **companions** while underprovisioned drains `loyalty` (existing 0-100
field) each starving day. Below a loyalty threshold, a companion may **desert** at the
halt. (Non-party NPCs are out of scope — deferred.)

## Architecture & components

- **`src/systems/travel/provisioning.ts`** (new, pure): `daysOfFood(party)`,
  `dailyNeed(consumers)`, `foodRange(...)`, `provisionStatusForTrip(tripDays, ...)` →
  `{ inRange, shortfallDays, severity }`. No React, fully unit-tested.
- **Rations item** in the item data + a small helper to read `rationDays` off any
  `FoodDrink` item.
- **MapPane travel readout + atlas overlay**: consume `provisioning.ts` to render the
  readout line and the per-cell "provisions-short" affordance. The overlay is a new
  derived layer keyed off `foodRangeDays` and per-cell `tripDays`.
- **`handleTileClick` (App.tsx)**: before committing a travel move, compute the
  provision status; if short, route through the choice flow instead of moving directly.
  Apply forage/half-rations modifiers to `travelSeconds` and food spend.
- **Daily food spend + starvation**: on travel completion (or each travel-day tick),
  decrement rations by consumed person-days; at zero, dispatch a starvation status
  effect (reuse the existing status-condition command path) and, for companions, the
  loyalty hit / desertion check.

## Data flow

1. Travel mode → hover a cell → planner yields `route` → `provisioning.ts` computes
   status → readout + overlay render.
2. Click → `handleWorldforgePick` (travel branch) → `onTileClick` → `handleTileClick`
   computes status → if in range, move + advance time + spend food; if short, open the
   choice flow.
3. Choice resolves → apply modifiers → move; on arrival/halt, spend food, apply
   starvation/loyalty effects as needed.

## Error / edge handling

- No food items at all → `daysOfFood = 0`; any trip with `tripDays >= 1` is short by all
  of it.
- Empty party (shouldn't happen) → `dailyNeed = 0` → no gate (defensive).
- Sub-1-day trips → `ceil` rounds these up to `tripDays = 1`, costing one person-day per
  consumer. They are "in range" whenever the party holds at least `party.length` rations
  (the common case), so in practice short hops still feel ungated — but a party with zero
  food *is* correctly stopped even on a one-day hop.
- Half-rations + forage stack: forage reduces the day's need first, half-rations applies
  to the remainder.

## Testing

- `provisioning.test.ts`: days-of-food math, daily need with N consumers, range at full
  vs half rations, severity buckets (in-range / minor / major), zero-food and empty-party
  edges.
- A MapPane/readout test: a short trip shows ✓ and no overlay; a long trip shows the
  shortfall line + the provisions-short affordance on the out-of-range cell.
- A `handleTileClick` reducer-level test: in-range travel spends the right rations;
  underprovisioned push-on halts at the sustainable cell and applies starvation.

## Approved extensions (v1.1 — locked 2026-06-26)

Four conceptual extensions were approved to fold into the v1 model, plus two
refinements to the affordance and the forage option. These reshape the pure core
*before* UI consumes it (cheaper than retrofitting), but keep the deferred phases
below untouched.

### E1 — Water as a second resource (highest-leverage)

The provisioning core is generalised from "days of food" to **days of a consumable
resource**, parameterised by item id and per-consumer daily need. **Food** (rations)
and **water** (a canonical waterskin-day item) are two instances of the identical
math. The trip is gated by the *binding* resource — `min(foodRangeDays,
waterRangeDays)`. Water need can differ from food need (e.g. arid terrain raises
water burn but not food burn — see E2). The readout shows whichever resource runs
out first; the ring (below) is drawn at the binding horizon.

### E2 — Terrain / transport burn multiplier

Terrain already affects travel *time* (`TERRAIN_TRAVEL_MODIFIERS`), so it implicitly
affects trip-days. E2 adds a separate **consumption multiplier**: harsh terrain
(mountains, swamp, desert) burns more rations/water *per day* independent of speed,
and favourable transport (mounts/wagons carrying supplies, river barges) can lower
per-day burn. The multiplier is computed over the route's terrain sequence (mean of
per-cell burn factors, weighted by time-in-cell) and applied to `dailyNeed`.
Per-resource: desert raises water burn ~1.5×; mountains raise food burn.

### E3 — Food weight ↔ encumbrance ↔ speed

Rations and water have `weight` (already on `Item`). Total provision weight feeds the
existing encumbrance model, which slows travel pace — creating the core tension:
carrying enough supply for a long trip *itself* lengthens the trip. The loop is:
more days of food → more weight → slower pace → more days of travel → more food
needed. The core exposes `provisionWeight(inventory)`; the gate recomputes trip-days
with the encumbrance speed penalty applied so the horizon reflects the real,
weight-adjusted reach.

### E4 — Resupply caches / depots

The map gains a logistics layer: the player can **drop a food/water cache** at a
discovered cell (transferring rations out of the party inventory into a positioned
stash) and recover it later; **owned towns stock provisions** as a purchasable
resupply point. Caches/depots are reachability anchors — the ring is re-seeded from
any depot the route passes through, so a chain of caches extends effective range. v1.1
ships the cache *data model + drop/recover* and town stock; auto-routing through
depots is a follow-on.

### R1 — Provisioning **ring** affordance (replaces per-cell amber overlay)

Instead of shading each out-of-range cell amber, the atlas draws a single
**provisioning-ring contour**: the boundary of the in-range set, derived directly
from the `RouteField.dist` field the route preview already computes (a cell is
in-range iff `tripDaysFromMinutes(dist[cell]) <= bindingRangeDays`). The ring reads
instantly as "this is how far your supplies take you." Drawn at the *binding*
resource horizon; depots (E4) re-seed it. (Per-cell tint may still appear on
hover/selection for precise per-destination confirmation, but the ring is primary.)

### R2 — Biome-yield forage loop (replaces flat +1-day offset)

Foraging is a real survival sub-loop, not a fixed offset: a **Survival
(Wisdom) skill check** against a **biome-yield DC** (forest/plains forgiving, desert/
mountain harsh), yielding `0..N` resource-days on success scaled by margin, at a
**time cost** (slows the day's progress) and a **bad-forage hazard** roll (spoiled/
poisonous find → a minor condition, or wasted day). Water foraging keys off the same
mechanic against biome water availability. Proficiency in Survival and party size
both raise expected yield.

## Out of scope (explicit)

Mounts, vendor-rapport resupply, and all non-party-NPC provisioning/consent — deferred
to later phases per the table above. Within the approved extensions, **depot
auto-routing** (E4) and **multi-resource forage stacking edge cases** (R2) are the
known follow-ons.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-06-25-travel-provisioning-design.md","sha256WithoutMarker":"34b35ed8cc19e2550ad700207fa61f5465e64a425b28fdd36625be8802be77bf","markedAtUtc":"2026-06-26T00:40:14.399Z"} -->
