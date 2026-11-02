# Overland Travel

Verified: 2026-11-02

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
- `src/components/MapPane.tsx` commits world-map and submap trips. It plans the
  route, prices it, rolls once-per-trip outcomes, and hands travel meta to
  `onTileClick`.
- `src/systems/worldforge/travel/localGroundJourney.ts` quotes a source Local
  journey from the accepted body through surveyed terrain and crossings. The
  embedded Atlas reviews it; `useAppAtlasEntry.ts` revalidates the quote and
  commits through the same normal travel action before changing ground windows.
- `src/hooks/app/useAppTravelActions.ts` - applies that meta through App's state:
  movement, clock, gold, conditions, provisions, discoveries and encounters.
- `src/hooks/app/useAppAtlasEntry.ts` - distinguishes an explicit current-body
  return from a fresh selected-cell descent.

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

The map offers Fastest route and Favor safer ground. The cautious option weights
time spent in dangerous cells when selecting a path. Its weighted score never
becomes elapsed time: route minutes, supply stops and arrival use the selected
path's actual edge times. Both choices may select the same route. The selected
town's quote sits beside its confirmation and includes the existing forced-march
save warning; it remains scrollable on a narrow screen.

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
the travel hook deducts the fare with `MODIFY_GOLD` after arrival. Owned-ship voyages pay no
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
(DC 10 + hours over). `resolveForcedMarch` rolls each member's save; the travel
hook applies `exhaustion` only to members who failed their own save.

Exhaustion then costs speed. `partyExhaustionLevel` reads the party's worst level
and `exhaustedSpeedMph` applies the 5e -5 ft per level through
`calculateExhaustionEffects`, and MapPane prices every route field (land,
multimodal, submap) at that speed. A worn-out party therefore takes measurably
longer over the same ground; a rested party is priced exactly as before.

Known limit: the condition does not STACK - `SET_CHARACTER_CONDITION` is
idempotent, so travel exhaustion tops out at level 1 today. Tracked as GG-141.

## Provisions, encounters, events

A committed trip also spends food and water (`travelProvisionDecision`,
`applyProvision`), rolls one danger encounter graded by medium - the road ambush
table for land, the sea table scaled by lane/coastal/open danger for a crossing
(`travelEncounter.ts`, `multiModalAtlasGraph` danger tiers) - and rolls one
seeded biome trip event (`tripEvents.ts`). Underprovisioned trips open a choice
flow (half day / push on / forage) instead of moving.

## Ground return and discovery accounts

`3D at My Location` explicitly requests a body resume. When the current cell,
location and any native Atlas address still agree, the entry hook preserves the
accepted ground position, height and retained Local receipt. Selecting a focus
for a fresh descent keeps its existing reset behavior. A foreign cell cannot
reuse the old body's meters.

`useWorld3DDiscovery` records nearby real hidden sites and dungeon entrances in
the saved discovery journal as well as the map-pin list. Accounts use the world,
cell and source ID, so revisiting or reloading does not add another account.
Revisiting a legacy pin can add its missing journal account. Dungeon doorway
discovery uses the arrived player's position rather than the camera focus.
These accounts grant knowledge and a map marker, not loot or quest completion.

Bounded live replay used a normal new character, Fianna Jorvik, in Chernov,
seed `1793176397587`, cell `1884`. A real Camp pin originally left the journal
empty. Returning through My Location originally cleared the accepted body.
The repaired loaded run retains one Camp account and exact XYZ through the
map round trip, including after normal walking. A later normal ferry round trip
reached Vruch cell2011 and returned to Chernov cell1884, paying 12 GP each way.
The corrected return preview matched its 4h21 commitment. Its new account uses
the actual 16:01:25 arrival time, including any trip delays, rather than departure
state captured by the hook. Normal save/full reload retains gold16, HP10,
inventory8, explored cells1884/2011, three accounts and one Camp pin. Vruch's
rendered ground and Town Plan also retained exact accepted body XYZ after reload.

The next normal journey reached Putivl cell1885 on foot through the Yamoto
Oldgrowth. The selected quote showed 15h14, about 23 miles and Moderate danger,
with DC 17 Constitution saves. The real save passed, and the journey arrived
without an encounter at 07:54:33 on the next day. Desktop and 390px phone renders
showed the quote, warning and confirmation together without document overflow.
Normal save/full reload retained gold16, HP10, inventory8, four accounts,
explored1884/1885/2011 and exact arrived ground position454.55999999961557 /
465.59999999993295 /7.976205389493977 meters. The saved travel remainder is
1436.076043988497 minutes, below the full-day provision threshold; rations and
water therefore remain five each. No encounter or exhaustion was forced.

The subsequent normal long rest quoted and spent one ration and one water,
advanced eight hours to 16:01, and reset the travel remainder to zero. Another
normal save/full reload retained four of each provision and the same body,
gold and HP. Four source NPC routine accounts were added as the town advanced;
the four place accounts remain distinct. This verifies the generic rest flow,
not physical access to an inn or guest bed.

Putivl's Town Cell and To Player renders show the body below a large raised
river deck. This is unresolved physical arrival evidence, not an accepted
walking path or landscape fix. The town/companion support investigation owns
the shared surface correction. The cautious planner has 267 differing source
town routes in this seed, but the first takes about44 hours; that read-only
audit is not a played cautious journey.

The complete loop remains open: source Local access, useful named landmarks,
interiors, preparation, events, weather/fatigue choices and landscape quality need
further actual play. See Gameplay Flow GF-10 and GF-G09/20/35/36/37/38.

Source Local access now requires a reviewed journey. AtlasDemo retains the
selected Region/Local/focus and requests a quote from localGroundJourney. App
revalidates that quote before calling the normal travel action and replacing the
ground window. A cartographic inspection alone does not move presence or grant a
discovery. Classic inspection cannot reset an accepted body or enter another cell without travel. Its current-area entry returns a visible refusal; explicit My Location resumes matching accepted feet.

The planner and localTerrainEndpointRefusal share the same point-admission
rules: owning area, surveyed land height, regional river corridor and recorded
crossing footprint. Refusal text identifies departure versus destination and
distinguishes missing survey from missing land. A river-corridor refusal describes
the map constraint; it does not assert that rendered feet are underwater. It
does not narrow the river, create a bridge or waive a crossing requirement.

Actual native current-cell selection, Region descent and Putivl Local entry
display the departure refusal without changing body, HP, gold or discoveries.
Nine affected route checks pass. Later earned bank movement admits a real 2.79 km woodland journey through unchanged source terrain. Its paid time, provisions, exact Local identity and accepted feet survive normal Save/full reload and hydrated resave. Physical bridge approach and useful new discovery remain unaccepted.

## Ground pointer and persistence boundaries

GroundMovePlane uses the existing groundClickMove gesture helper. Only a
primary tap commits on release. Camera orbit, pan, drag, cancellation and
multiple pointers do not issue a destination. Native move capture tracks
excursions beyond the pick plane. Actual desktop orbit/pan and tap were replayed.

The same renderedGroundHit now considers visible upward caps of explicitly tagged source walkSurface floors and treads as well as terrain. World3DScene keeps those parts separate when merging drawing by material, so a shared wall or roof color cannot become a floor pick. Oblique indoor taps therefore target the drawn slab rather than terrain underneath it. Hidden floors and slab sides are excluded; the existing hidden-terrain presentation behavior remains. People, doors and furnishings before that actual surface still own the interaction. The destination is only XZ intent: normal supported walking and access checks control the path and reached height. This changes no source geometry or accepted feet by itself.

Walking can query exact mounted deck geometry through
createDeckSupportQueryFromMesh. The optional slabTopIndices receipt permits
underside clearance without rebuilding an estimated LOD. Queries return all
support layers; the motion owner selects a reachable height. No query grants
a higher bridge floor to a body standing beneath it.

Canonical continuous terrain remains the physical authority. Putivl's visible
coarse bank differs by about 4 m at the accepted body. Adopting that visual LOD
as physics caused a rejected same-XZ height migration. Near-player render
fidelity and legitimate bank access remain open; source positions were retained.

World3DScene refines drawing near accepted feet through
`src/systems/world3d/terrainFootingDetail.ts`. It intersects the existing coarse
partition with a finite common grid, samples canonical continuous height, and
blends back to unchanged exterior positions and shading. Adjacent chunk edges
use the same geometric cuts. The patch waits for its whole neighbor ring;
protected river-site previews exclude it. It never replaces physical support.
Ordinary WebGL play now selects it after separate Menaikon land qualification;
WebGPU retains explicit canonical selection. The worker contract is below.

The earlier Putivl experiment reduced a 4.14 m ray error at the body to 0.7 cm;
nine nearby samples stayed within 1.01 cm. Its source hashes and accepted XYZ
survived normal save/full reload and re-entry. That historical local drawing
proof does not qualify a water approach, arrival or regional crossing. Those
acceptance boundaries remain open.

Published ground water can be read through
`src/systems/worldforge/bridge/groundWaterSurfaceQuery.ts`. It reuses the source
chunk sampler, water mesh builder and triangle reader, including local ribbon
widths, bank overdraw, bends, taper, lakes and neighboring overhangs. The rest
environment guard uses this surface rather than a separate centerline-distance
estimate. It reads geometry only; it never moves a body or changes a river.
Legacy ribbons without published waterlines remain unknown. An undefined result
does not establish dry land, reachable support or regional crossing permission.
Grounded click and WASD movement now use World3D/groundWaterMovement.ts. The existing walking solver owns support, grade, doors and decks. The shared frame budget pays existing difficult-terrain cost for wading; Earth Walk and Timberwalk retain their terrain qualifiers. Every 4 cm step checks published water against the actual assembled standing mouth with a 5 cm margin. Missing anatomy, unknown ribbon levels and deeper water refuse movement. No water, terrain, saved position or regional permission is rewritten. Swimming, currents, drowning and underwater breathing remain unimplemented. Ancestor world matrices are updated before measuring standing anatomy. Accepted idle feet stay fixed. A dry published point supplies no regional crossing certificate. The exact original-save copy and then the original party passed a played shallow bank exit and Save/full reload/physical re-entry. A normal post-load resave also preserves all thirteen checked hydrated travel groups exactly. The new dry-bank position still lies inside the regional river42 corridor, so it supplies no Local crossing permission. A supported bridge or land approach remains open.
See the rest-and-recovery domain for recovery rules. Actual Putivl warning,
Cancel and full-reload proof preserve thirteen saved groups and the earned body.

Cold save/load calls wait for storage initialization and pending recovery.
See docs/architecture/domains/save-load.md. Actual Save Game/full reload/fast
Continue retained the earned Putivl body and resources despite an older legacy
payload. These boundaries do not establish full travel-loop acceptance.

## Native keyboard movement and destination handoff

The native avatar owns one physical frame budget for held keys. The keyboard
driver publishes transient direction through GroundMovementIntent; the avatar
applies character pace, support and water cost once. The camera follows reached
feet at priority -0.5 after the avatar's -0.75 pass. Older callers without a
body reader and physical-stop callback retain their existing request driver.

Native takeover, release and blur use onGroundStop to settle the actual body
through the existing movement-cancellation callback. They do not create another
click destination. Disabled movement detaches the mutable key object so a modal
cannot arm the hidden body. A validated ground tap or new Locale destination
hands control back to the existing click walk. The Wrapper passes its existing
transient destination object as groundMoveRequest; ordinary accepted-footfall
updates and camera-only gestures do not grant that handoff. These fields are
Scene-local and never become a saved travel receipt or crossing permission.

Qualification remains separate from implementation. Actual dry-bank input first
used 2.4881 capped frame seconds, allowing about 3.791864 m at this character's
pace, while the rendered path measured 1.845444 m. All 33 held samples were dry.
Coupled controller regressions reproduced startup easing and cover dry/wet costs,
release, blur and removal of movement admission. Thirty-four focused cases pass;
six scoped source/test paths report zero errors and zero suppressed diagnostics.
A copied native replay exposed an additional 0.11 m backward release correction
when stopping reused a click request; that candidate was rejected. The revised
physical-stop contract then records zero post-release drift in the copied scene.
Copied native orbit, primary-down and key takeover preserve actual feet; a valid
tap and the existing Locale destination still walk normally. Copied full reload,
physical re-entry and hydrated resave preserve thirteen travel groups, recovery
fields and 83 generated NPC identities. These are bounded controller checks.

The original party then normally walks five bank-approach legs to
463.45740869641924 / 506.7571538609514 / 11.52670476979762 m. Every observed
release settles at exact feet. The rendered view still shows large civic bridge
surfaces interfering beside buildings; it is not a readable or completed crossing.
Normal Save at 17:28:33 and full reload/explicit Load preserve exact
manual bytes and thirteen travel groups. Actual 3D re-entry restores identical
saved, body and terrain height. A normal hydrated Save at 17:29:45 preserves all
thirteen groups, the recovery fields and 83 generated NPC key/id/name/role
identities. Gold remains 16, HP 10, provisions 4+4 and discoveries eight; Local
address fields remain empty. Normal World Map pauses the retained original.
The first immediate post-modal held-input no-op remains unresolved; subsequent
admitted original steps pass. No copied position, source lift, waterline change,
regional crossing permission or bridge arrival was accepted.

A read-only search uses the mounted support registry and qualified wading across
nearby source bridge ends. Its 20-second bound visits 730 nodes and retains a
44.112698 m planned frontier, still 15.767114 m from an end. Raw deck topY can
differ from mounted support. This plan neither proves impassability nor grants
a crossing. The native replay now reaches its bank frontier; supported bridge
approach and Town/region admission remain open.

## Bridge shape across streamed chunks

sampleGroundChunk retains each bridge's original four grid-space corners in the
optional sourcePoints packet, alongside the clipped polygon used for chunk
admission. The canonical GroundDeck corners, topY, style and identities stay
unchanged. Docks, fords and legacy packets keep their existing geometry path.

buildDeckMesh builds the authored bridge slab, arch and dressing from that full
span, then clips its finished triangles to the chunk. Cut vertices interpolate
position, normal and color. Slab-top triangle receipts follow the cut faces, so
physical underside clearance and rendering describe the same bridge. Chunk
edges do not become new arch ends, railing ends or masonry abutments.

The mounted mesh remains the walking authority through
createDeckSupportQueryFromMesh. This correction never chooses the highest
surface for a body below the bridge, migrates saved feet or grants a crossing.
Legacy packets without sourcePoints keep their previous shape until rebuilt.

The old polygon-first path could rotate an arch on a short quad or flatten a
three/five-corner clip. Two regressions reproduce that defect; 29 deck cases and
four scoped type paths pass. Thirty-six original-world samples agree with the
full-span reference within 0.000000666 m. Native saved/body/source identity and
normal save/reload qualification are recorded in the living
[gameplay tracker](../../projects/gameplay-flow/TRACKER.md#one-bridge-shape-across-streamed-chunks).

Bridge shape does not establish bank access. fitTownDeckToBanks still raises a
single base to the higher endpoint; the measured lower end can remain 2.093218 m
above terrain. Building collision, the bank/deck join, camera obstruction and
Town/region crossing provenance require separate qualification. Preserve their
physical and route refusals while diagnosing the source relationship.

## Player visibility beneath bridges

The existing player camera sightline queries mounted world3d:site-building and
world3d:decks roots. It uses actual transformed opaque faces, player body bounds
and visible-parent/material rules. A bridge is an occluder even when no building
intersects the camera arm. NPCs and unrelated scene actors remain excluded.
The existing framing/retraction controller owns the resulting eye position;
walking direction, accepted feet, geometry and travel permission are unchanged.

Two regressions reproduce the previously clear building-only ray through an
opaque deck. Twenty-two affected camera cases and two scoped type paths pass.
Actual native copy and original renders show the figure at the same accepted
feet. Copied movement preserves heading and exact stopping, followed by normal
save/full reload, physical re-entry and thirteen-group hydrated continuity.
The living tracker holds measured positions and receipts.

Ground visibility and route admission remain separate. acceptedGroundPoint
projects the body's real saved meters through its owning Local bounds. A prior
regional river refusal must be checked again after earned movement; it is not
a permanent property of the town. Fianna's earned bank checkpoint has no wet corridor and admits a zero-distance plan; subsequent native woodland travel is verified separately. Neither fact grants a river crossing.

## Paving in the canonical footing patch

The canonical footing patch refines road and verge meshes around accepted
feet. Ordinary WebGL ground play now selects it by default. WebGPU keeps
explicit groundDetail=canonical selection; groundDetail=coarse provides the
existing coarse comparison. roadGeometry retains derived terrainLift metadata
from the original bake, clips the existing faces and interpolates their road
space. The core follows continuous source ground with small ordered drawing
offsets; the annulus blends back to the unchanged coarse exterior. Surface
kinds, widths, colors, plazas, junctions and verge patterns keep their owners.
Old bundles without metadata stay unchanged. The same loaded-neighbor gate
admits land and paving together; protected river previews keep their old path.

This changes rendering only. Walking support, saved feet, source terrain,
water, deck geometry and costed Local admission do not change. Native Dara
shows bounded body clearance, with full-reload state continuity. Paving
artifacts, transitions, responsiveness and general performance remain open.
Do not treat that local evidence as default promotion or a bank/crossing grant.
The living gameplay tracker carries the actual measurements and receipts.

SiteBuilding also memoizes unchanged source-site/interior-admission props.
Its own state, frame subscriptions and clock, furnishing, door and resident
contexts still update normally. This preserves live world behavior while
avoiding redundant building JSX during body-position writes. Its native
performance benefit is still under verification.

## Verification

`src/systems/travel/__tests__/travelMechanicsVerification.test.ts` walks the
whole chain end to end (ferry itinerary -> fare -> gold -> arrival cell; road
exemption -> drift; forced march -> exhaustion -> slower route). The per-rule suites
next to it cover each piece in isolation, and
`src/components/Worldforge/__tests__/AtlasSvgView.test.tsx` pins the drawn leg
styles and readout text.

## Native Local return and saved geographic identity

AppPhaseContent releases the transient Atlas artifact carrier only after the ground scene unmounts. It retains atlasGroundAddress and atlasGroundPosition in reducer/save state. useAppAtlasRuntime reconstructs the same canonical Region, Local and focus when render objects are needed again. Merely looking at Atlas must not turn accepted Local meters into a different town-centered position.

The actual journey exposed a cleanup defect that cleared the compact address with the transient carrier. One regression fails before repair; fifteen affected admission/transition/return cases pass afterward, with both changed type paths clean. A byte-exact backup of the game-created post-arrival checkpoint restores the earned journey through normal Load without replaying its outcomes. Repaired ordinary Atlas return, manual Save, full reload, explicit Load and hydrated resave preserve fourteen travel groups, including non-null native address/position, costs and discoveries, plus recovery and 83 NPC identities. Normal My Location and To Player re-entry render the correct Local with exact accepted feet and matching terrain/avatar height. Full landscape quality and performance are separate open checks.

Town presence is resolved by the existing burgIdForLocation/resolveTownForLocation readers with optional accepted-ground context. Native meters use their saved Local bounds; legacy meters use the existing entry-anchor Local. Both are checked against the same population-scaled town envelope and apron used by Region generation. Invalid or foreign ground cannot grant presence. Callers without ground context, including town simulation/registration, retain cell-level resolution.

Player-facing keeper projection, town menus and news, ambient crier/gossip, rumor acquisition and observed routine accounts pass this context. Stale town service actions use the same boundary. An independently placed proprietor can still be met away from town, while their distant shop is unavailable. Frozen broadsheets remain readable after leaving. This is settlement-scale presence, not proof of a particular person's physical reach or an individual's daily schedule.

Actual woodland UI and133-second ambient observation verify the absence of remote town affordances and new town speech. Normal Save/fullreload/hydrated resave preserve21 checked groups, including the complete83 NPC/81business records and positive native lineage. Useful local discoveries and onward wayfinding remain gameplay work; this does not certify all indoor, dungeon or distant-service contexts.

## Wilderness search and journal clock

Search the Area uses the existing deterministic cell/biome forage table, stamps dynamicLocationItemIds even when empty and spends1800 game seconds for a new search. Once searched, the same area refuses another search. Taking the found item preserves the separate forage and acquisition accounts; those are distinct from a source place landmark. Native save/reload preserves searched state and refuses repeat loot/journal entries.

Item pickup, forage and harvest journal writers use existing formatGameTime, which pins UTC like the game clock. Host-local formatting of ancient campaign dates can otherwise apply historical offsets unrelated to the fictional world. Existing saved entry strings are not rewritten without a reliable event-time source. The native forage exposed this defect; handler tests/runtime formatting support the repair, with a newly played corrected entry still pending.

The existing appState load path separately migrates shiny_coin inventory records into scalar gold. The actual one-coin pickup preserved total value but changed inventory/gold shape on its first reload; a second post-migration reload is exact and does not credit again. Do not present the first migration as unchanged resources or infer a safe quantity/provenance policy from one coin. The economy owner has that evidence.

## Actual party position on Region and Local maps

AtlasDemo reuses acceptedGroundPoint and the existing party overlay for embedded Region and Local maps. The reader uses the accepted body's own native or legacy Local bounds, exactly as journey admission does. A foreign world/current-cell mismatch, missing body or invalid point produces no party marker. Inspecting the map does not move the party, spend provisions, reveal a place or mark a quest. Existing discovered-place overlays remain separate; World-level Find Me retains its existing cell marker. The UI label is Your position.

Fourteen existing map/navigation cases and a one-path scoped typecheck pass. Actual Dara's legacy-window Region/Local renders share exact absolute feet and preserve21checkpoint groups after full document/native Load/resave; live navigation/refusal/resave also retains six progression fields. This is bounded placement/continuity evidence, not a movement-response, every-address, source river agreement or useful-route acceptance. Current played receipts and limits remain in the gameplay tracker.

## Physical cues for discovery sources

The existing prop placement engine reads GroundWorld hidden sites through groundToPlacementContext. Ruins retain their original dressing stream. A separate per-source discovery-cues stream now adds a cave overhang, a shrine form, a cold camp firepit with a log, a natural grove cluster or weathered wreck timbers at existing source coordinates. No source is created, moved or renamed. Invalid and out-of-window anchors are refused rather than clamped onto an edge. Existing slope and placement gates still decide whether a cue can be seated.

Cave-overhang and unlit-firepit geometry use PartBuilder and the existing cached vertex-colored form table consumed by GroundProps. The open overhang does not cut terrain or grant a tunnel, dungeon entry or safe passage. Cold stones and ash do not light a fire, create occupants or grant recovery. Natural clusters and debris do not promise loot or an intact craft. These physical cues add no label or discovery account.

useWorld3DDiscovery remains the authority for discovery: the accepted body must enter the original source radius. Camera framing, panning and generated prop counts grant no discovery. Canonical Atlas source IDs, native Local bounds, journal identities and persistence remain with their existing owners. The source-cue change has focused placement, geometry and proximity checks; actual source recognition and useful named-place arrival still require rendered play. Aggregate native generation is supporting evidence only. The current gameplay receipt belongs in the living Tracker and GF-G37, not in a new dated report.

## Bounded canonical footing construction

The canonical-detail terrain renderer uses finite common refinement in terrainFootingDetail.ts. It intersects each original source face with the detail window and finite grid. An interior fan retains collinear boundary cuts. Adjacent chunks use the same partition lines and grid cuts, including their unchanged affine exterior, so the construction preserves source-face coverage and shared borders without recursive thin corner chains. Exterior heights, colors and normals interpolate the original face; the original input buffers are never mutated.

The current ground caller retains its eight-meter core, sixteen-meter outer radius and source-cell/8 maximum edge request. The grid cell diagonal fits that request. The helper retains the 250,000-vertex per-mesh refusal and bounds grid/work allocation. It does not publish a coarse fallback when the requested geometry cannot fit. The existing loaded-neighbor-ring admission and source height callback remain authoritative. Walking support and accepted positions are separate and unchanged.

Road, deck, water and prop conformance keep their existing owners and need separate rendered verification. Correct terrain support does not qualify an overlying road or a bridge join. Selection follows the renderer rules above; these geometry algorithms do not choose a default. Played recovery, ray measurements, source fingerprints, current checkpoint and remaining acceptance work belong in the living gameplay Tracker and GF-G57.

## Local map orientation and distance

LocalMapView uses north-up absolute-feet coordinates. Its display-only north reference and feet ruler use the current Local view scale and the existing atlas getCleanNumber rounding helper. The ruler updates on zoom; panning changes the inspected area without moving the party. Player markers, canonical gate labels and explicit ground-entry choices keep their existing owners. The classic Cell Map modal remains a world map; the retained Local is available through Play/Atlas explorer. This distinction remains a discoverability gap.

## Forced-march elapsed-time feedback

The travel commit hook now uses the existing formatTravelTime formatter for
both passed-save and failed-save messages. This matches route-preview duration
precision: the actual 11h46 Olaspi journey must not become a claim that the party
traveled past12 hours. Only future log text changes. Forced-march DC, one roll
per member, clock cost, exhaustion dispatch and saved historical accounts keep
their existing behavior.

Two fractional-duration regressions reproduced the old wording, then the full
eight-case hook suite passed. Both affected files pass scoped types with zero
errors and zero suppressed diagnostics. One scoped header pass updates only the
owned hook; three dependent files remain unwritten. Existing source outside the
feedback change and header compares exactly, and original line endings remain.
This is a source candidate under GF-G85. Future naturally earned native log and
rendered verification remain pending; do not reroll Perrin's failed journey or
rewrite its historical account to qualify the new wording.

## Local journey time review

LocalJourneyPreview keeps the complete LocalJourneyQuote as the departure authority. When that total includes time beyond the route itself, it shows Route time, Navigation and delays, and Total travel time. It uses the existing travelReadout formatter. Quiet trips keep a single Travel time row. The source quote already carries navigation and event time; this display does not roll again, change costs or expose event text or drift direction before departure. The journey log remains responsible for the actual consequence narrative. Food, water, encounter risk, forced-march warnings, refusal and explicit confirmation retain their existing owners.

The split addresses an actual wetland return whose 2.67 km quote displayed 7h 53m without explaining the extra time. The played log subsequently recorded six hours lost to navigation. Current gameplay proof, costs, accepted body and reload status belong in the Gameplay Flow Tracker; source checks alone do not qualify a journey or arrival.

## Physical blocked-movement feedback

PlayerAvatar uses its existing Html nameplate/status area to explain a refused
player movement request. A blocked solver result retains the message after
input release; another permitted attempt clears it. Specific unsupported-footing
and water-refusal explanations take priority. The generic notice is player-only;
actorId companions retain their existing notices and behavior. It changes no
collision, standing anatomy, geometry, camera, route, accepted position or speed.
The notice is transient UI, not a new saved world fact.

Actual desktop Perrin receives a readable220px message after a refused forward
step, and a permitted reverse step clears it. The body/actor UUID and accepted
pose remain exact through the refused input. Nine avatar cases pass after the
missing-status regression; two scoped paths have zero errors/suppressed
diagnostics. Inverse audit preserves every pre-existing source byte outside
notice bookkeeping/UI. Imports and signatures are unchanged. Native named
step-back save/fullreload/explicit Load retain13 state groups and13 protected
archives exactly, including resources, paid source note and earned exhaustion.

This qualifies bounded feedback, not the bank's geometry. Actual supported/dry
feet can still disagree with mounted terrain, and blocked forward/lateral versus
permitted reverse motion establishes no bridge, swimming or regional route.
GF-G55/GF-G57 and current Gameplay Flow records retain those wider requirements.

## Resident directions from canonical public geography

The existing global directions topic uses resolveHouseholdPersonalReply and its direct-reply publication guard for a living registered resident's own current town. npcLocalDirections reuses burgIdForLocation's accepted-feet presence, the canonical north-up town plan and existing compass math. A uniquely linked owned public workplace must match the source town, plot and proprietor household. The fitted plot supplies the building type; legacy merchant stock does not rename a tavern into a different service. The answer gives the own town and broad workplace sector, not a path or a safe crossing. Missing or ambiguous workplace information does not invent a destination. Authored knowledge overrides and other conversation paths retain their owners.

This is an explicit source-factual answer, not an AI-failure fallback. Normal dialogue still records the discussed topic and delivered reply through DISCUSS_TOPIC/SET_LAST_NPC_INTERACTION. The hook re-resolves the same answer before publishing; a changed town or source invalidates it before effects. The resolver grants no visited place, reward, movement, opening-hours claim or entry permission. Published directions are retained as the NPC Interaction account described below. A map keeper conversation remains distinct from physical building arrival. Native rendered delivery and save/full-reload proof belong in the Gameplay Flow records.

### Physical approach remains separate from source directions

Native Putivl play confirms a source-factual compass answer does not qualify its approach. A bank walk can be admitted by building walls yet refused by the mounted deck standing-body query. Preserve such refusal and accepted height; a route description never grants a collision waiver or a lifted bridge arrival. The measured Gameplay Flow checkpoint and read-only geometry diagnosis are recorded in the living project records. Meeting/topic memory persists across later play and true reload. Current-interaction fields can clear while the existing Logbook retains the published directions as an attributed conversation account; neither grants physical arrival.

### Retaining heard directions in the existing Logbook

After the existing direct-reply identity/geography publication guard succeeds, useDialogueSystem records global_directions as an NPC Interaction account with the actual speaker and exact delivered words. The existing Logbook owns search, read status and save persistence; no second travel journal is introduced. Stable world/source/words identity and a local-directions knowledge flag let logReducer ignore repeated advice, including rapid repeat publication, while preserving changed advice, another source/world and ordinary repeat NPC events. This is learned advice, not LOCATION_DISCOVERY: no map coordinates, site visit, movement, safe-route grant, XP or resource reward is added. No historical wording is backfilled from cleared transient replies. Native continuity qualification belongs in the living Gameplay Flow records.

Logbook list/detail dates use a valid stored gameTime through the existing UTC formatters. Older accounts without a valid game clock fall back to the retained receipt timestamp. Display does not rewrite stored clocks, account content or the existing receipt-based ordering. Actual source attribution, repeat-advice dedupe and retrieval after transient replies clear were rendered and normally saved/full-reloaded; current proof belongs in Gameplay Flow records.

Town Routine observations now store the full ISO game time at which the world update observes the transition. A coalesced rest or wait does not prove when within that interval the activity began. Existing clock-only accounts retain their original values: the Logbook shows Date not recorded and their recorded clock time instead of presenting the host receipt date as an in-game date. Source identities, flags, content and saved chronology are not rewritten. This correction is specific to the routine writer and Logbook display; it does not qualify every event writer or resolve midnight notice relevance.

## Firsthand knowledge of a public room

The existing World3D discovery hook records a public-building visit in the existing discovery log when a fresh arrived body stands on a visible structural floor and inside its canonical public main room. The wrapper passes the same actual body height used for accepted movement. Camera focus, requested movement, map inspection and a horizontally nearby room are insufficient.

publicBuildingDiscovery.ts uses the shared site transform, blueprint origin and townBuildingVisit plan. The structural floor must be within four centimeters of the feet. Tactical-only geometry, furnishings, doors, private rooms and private households are excluded. Business main common rooms, shopfronts, workshops and forges are eligible; fitted temples, shrines, libraries and schools can expose their main hall, nave, sanctuary or study. This is knowledge of entering, not permission to trade, lodge, use goods or meet a resident.

The saved business registry supplies the name for its exact burg and plot. The account retains world seed, cell, building, room, floor and business identity. Its locationId is world:<seed>:cell:<cell>:building:<source-building-id>; the existing location-discovery reducer and loaded log deduplicate it across reentry and reload. Blueprint caching stores computation only. No second visit store, hidden-site pin, XP or forced NPC contact is introduced.

The entry uses the actual observation game time and describes the fitted room and contemporaneous staffing schedule. Staffing comes from attendanceForVisit and saved town life, so an entered inn can still have an off-duty keeper or no guest-bed offer. The normal discovery reducer mirrors the new account into the existing adventure log; reading it uses the existing unread state. Existing earned account wording and timestamps remain intact when a writer is corrected.

## Local journeys along mapped town streets

localGroundJourney first tries localTownStreetRoute against the selected Local's exact town plan with saved deltas applied. This reuses buildStreetGraph and routeAlongStreets from the resident route system without changing its geometry or NPC state. Travelers keep their exact accepted endpoints; a roster centroid-to-door substitution is not allowed.

Both endpoints and the whole path must lie on authored street widths and outside private plot footprints. Two-foot samples retain the existing regional land, river-crossing, survey and owning-cell admission. Unqualified street edges are removed from a temporary graph before searching, so a valid longer land approach can beat a blocked geometric shortcut. The roster's disconnected straight fallback is refused unless both endpoints genuinely share one authored street span. No town bounding box, name or gate label grants travel permission.

A qualified route uses the existing road speed, danger, grade and navigation rules, plus ordinary season and exhaustion costs. Maintained road navigation has DC0; country routes retain their previous rules and seeded event streams. Events, encounters, supplies and forced march still use the existing travel transaction. Route geometry participates in the street quote key so changed source paths require a fresh review. The preview describes mapped town streets explicitly; it does not promise an event-free journey. Native Putivl evidence includes the longer222.463m land route and a normal199s charged arrival, while an unrecorded river link remains rejected.

The Town Plan building selector also distinguishes colliding saved name/type labels with its existing one-based building numbering. This changes neither business names, plot IDs, fitted uses, filters nor keeper actions. An inspected building remains inspection; it does not move the body or create a visit account.

## Time while reading a route

The App passive clock treats the full Worldforge Atlas as a map whenever worldViewMode is atlas and mapSurface is worldforge, including its loading and journey-review surfaces. It reuses the existing map-pause gate and cleans up the old exploration timer when either flag changes. Returning to classic play or ground 3D resumes one-second ticks without charging time spent reading the map. The ordinary map modal keeps its existing pause rule.

This gate affects only passive exploration time. Accepted travel, ordinary wait and rest retain their explicit ADVANCE_TIME costs and world consequences. It does not change terrain admission, navigation rolls, route keys, resources, source identities or accepted positions. Native evidence includes a paused route review followed by a normally charged 8,726-second country journey; the current played receipt belongs in the Gameplay Flow records.

## Ground compass

The ground scene reports the existing camera view direction to InWorldHUD through its wrapper. Ground north is negative Z, matching the north-up Local map. CameraHeadingReporter reuses one vector, samples at a quarter-second cadence and publishes only changed rounded bearings; a vertical or unavailable direction clears the readout. The label says View because camera direction and walking direction can differ.

This presentation state is local to the mounted wrapper. It never changes GameState, saves, camera controls, movement intent, accepted feet, terrain or source identities. The badge absorbs pointer clicks instead of passing a ground pick through to the scene. It hides when ground-camera bearing is unavailable or the view is not ground mode. The existing map, minimap and entry-anchor systems retain their responsibilities. Native click/orbit/phone and actual walking qualification belong in Gameplay Flow records.

## Flooded building approaches

A paid atlas-cell arrival does not establish a public-room visit or a reachable service. The existing buildingEntryApproach bridge adds shared physical landings and treads while retaining source terrain, foundations and floors. It limits a modest approach to six treads, a one-meter rise and 0.17-meter risers. Ground assembly admits those parts only on dry support through groundWaterMovementAt. Wet or unresolved ground does not receive a new bridge or a door-height exception. Normal water, slope, door and room admission still control actual walking and interaction.

publicBuildingDiscovery records a first-hand public-room visit only when accepted feet stand on a real structural slab in the matching room. Exterior labels and a refused contact cannot grant that account, a meeting, a service or permission. Exterior observation memory would need its own explicit knowledge kind in the existing discovery system while preserving this visit guard.

A visit does not supply a temple dedication. The normal altar reading uses templeDedicationAccessError for fresh public-room reach and resolveWorldforgeTempleIdentity for the actual atlas-cell religion and canonical main temple. A unique living office holder supplies the optional clergy listing; a missing or disputed office stays unknown. The existing discovery log retains a stable snapshot of the faith and listed clergy. An unchanged reread keeps the first account, while a later succession can produce a new historical account without rewriting earlier knowledge. Reading grants no meeting, attendance, service, permission or recovery.

In player follow, camera collision retracts along the same yaw and can reject a blocked stationary orbit by recalling its last checked clear view. An orbit gesture therefore does not guarantee its requested bearing near a facade. The View compass reports the rendered bearing; ordinary WASD uses that camera-relative direction. Neither framing nor its refusal relocates accepted feet. When collision shortens a requested player-follow arm, FreeRoamCameraController compares legal lower and higher pitch candidates along that same yaw before accepting a short view. Each candidate uses the existing mounted structure/ground sightline query; requested zoom, gradual arm recovery and the final post-damping check remain. This can clear a rising outdoor bank without changing physical support or input heading. The existing cameraGroundRaycast exact triangle index serves static mounted buildings and decks as well as terrain and roads, so a short indoor arm does not scan every structural triangle for every body sample. It caches candidate selection only. Live transforms, attribute/index changes and material rules remain authoritative. Animated, instanced, custom-raycast and unusual-range meshes retain the native raycast path; decorative geometry that intentionally yields therefore remains nonblocking. Initial To Player admission remains a separate playerCameraFrame query; a follow-camera improvement does not prove that every interior can be framed after reload.

## Moving near-foot drawing off the browser thread

World3DScene uses useFootingMeshes for an admitted standing-ground patch when
the world has no ground-shape cuts. The hook uses the existing createWorkerClient
lifecycle and a render-only footingMeshWorker. The worker receives a cloned
snapshot of cols, rows and heights. It calls the existing groundSurfaceY sampler
and the existing terrain, road and verge refinement functions through
footingMeshJob. It does not reconstruct a town, move an actor, change support or
write a source buffer. Ground edits retain their immediate existing path, and
protected river previews retain their existing selection rules.

One complete batch contains terrain and paving for the loaded chunks. The
browser retains the previous completed drawing while the worker prepares the
next window. Before the first result, the source drawing remains visible. At
most one batch runs and one latest request waits. Obsolete replies are discarded.
The scene checks the original bundle identity before using a returned chunk,
so a result cannot replace a newer streamed bundle. Source arrays are cloned
into the worker; only worker-owned output buffers are transferred back.

DrawingMesh holds the returned arrays in a private resource slot. Components
read those same arrays to create their geometry. Keeping large mesh arrays out
of enumerable component props avoids expanding them in React development timing
records. Timing tools remain enabled. Each mounted draw mesh keeps the existing
geometry disposal owner. Leaving the scene terminates the worker through the
shared lifecycle. A crash retains the last completed drawing; a later request
restarts and initializes a worker rather than silently changing the ground.

This is an asynchronous drawing contract, not a new physical surface. Native
walking and sprint samples, exact buffer comparisons, reload evidence and
remaining acceptance limits belong in the gameplay Tracker and GF-G92.
Cross-source resident identity and saved support changes remain GF-G93.

## Arrival dates in the adventure journal

Verified: 2026-10-31 against the travel hook, MOVE_PLAYER reducer and discovery reducer.

Map travel preserves its existing movement/discovery/clock/provision/fare/forced-march/encounter action order. The hook calculates arrivalGameTime from the departure game clock plus the actual rounded journey seconds, navigation delay and trip-event delay. Both MOVE_PLAYER branches carry that optional timestamp. The travel summary uses it only to stamp the new journal entry; ADVANCE_TIME remains the clock authority. Ordinary movement without a valid timestamp keeps the current game time.

The discovery reducer likewise dates the new adventure-log mirror from an explicitly supplied valid discovery gameTime. It does not substitute the wall-clock fallback for a missing event time. Existing discovered-place accounts, prior journal entries, read state, resource rules, movement and dice outcomes are preserved. This repair does not backfill previously earned summaries.

The native Stamstad trip exposed the seam: its discovery correctly says14:19:31, but travel/discovery journal summaries retain departure10:32. New regression tests fail on the original code and pass after the repair, including midnight rollover, delayed travel, legacy/invalid movement dates, source discovery time and prior-entry conservation. All49affected checks across five suites pass; six scoped source/test paths report zero errors and zero suppressed diagnostics. Source tests do not constitute a new native journey; future-arrival runtime proof is tracked in the gameplay-flow records.
