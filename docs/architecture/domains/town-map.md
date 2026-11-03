# Town Map

Verified: 2026-11-03 (GG-613 retaining walls and street ramps at pad edges, GG-614 churchyard grading, measured at four bands and 15 sampled towns). Earlier: 2026-11-03 (GG-554 lot sizes in feet, GG-584 no movement blocker on a road, GG-581 cloister fallback; measured on the demo town, Borieborum, Legium and the band towns). Earlier: 2026-11-02 (GG-608 every front door faces a street: blueprint entry rule and ribbon lot winding, measured on two towns and 40 sampled towns in revisions 1, 4 and 2). Earlier: 2026-11-02 (GG-604 suburb lanes: the lanes between suburb blocks are passages joined to the approach roads, measured on the demo town and Borieborum). Earlier: 2026-11-02 (GG-600 town work and GG-601 street joins, door steps, errand doors and errand slots: see "Street crowd: errands, departures and outdoor drawing"). Earlier: 2026-11-02 (GG-593 plaza pads: market squares and civic forecourts graded to at most 5 degrees in the 3D bake, measured at four bands and a town sample). Earlier: 2026-11-02 (street crowd errands, departures, outdoor-only drawing and talk/listen poses: see "Street crowd: errands, departures and outdoor drawing"). Earlier: 2026-11-02 (GG-586 market square: measured at four bands and 24 sampled towns, Hafting rendered in the 2D town map at `step=town3d`). Earlier: 2026-11-02 (GG-577 shared courts in the old core and GG-569 civic grounds in the 3D bake, measured at four bands, rendered at `step=town3d` Real 3D for Paphina). Earlier: 2026-11-02 (GG-542: staff and patron parity between the building visit and the live schedule). Earlier: 2026-11-01 (town-map rules GG-560 to GG-567: main street, river channel, bridges, docks, gate hooks, house shape, front gardens, passages and civic grounds, measured at four bands and thirteen water towns, rendered at `step=town3d`; candidate homestead/parent-land/shared-approach planning and larger-town coverage failure; explicit candidate rural household/field source facts; fresh-only resolved building purpose and household-first prop wealth; native settled nave orbit, altar route and retained knowledge reload; requested-heading camera retraction and native temple bench/reload; measured retained-prop repair proposal and native movement contract; saved-revision factual readers and Local/address reconstruction; revision-aware building/rest readers, truthful routine reports and source-change inspector reset; recorded door widths, household reference drafts and native poor-home reload; saved town-layout registration and ground projection; retained town-layout reader and measured runtime precision; reached furnishing identity source and captured desktop component view; town-look rules GG-544 to GG-551, census of 813 towns; fitted civic labels and native library use; town roads meet the world roads, GG-541, census of 8 towns). Earlier, 2026-10-29: (canonical door-head alignment, measured standing clearance, actual Fenna entry/owned trade/counter examination and two native interior reloads; live Brooksmith work/home handoff, night manual full reload and continuous terrain walking; separate workplace attendance and retirement; ground recovery, finish-based rest cooldown and named-slot reload; source-grid combat handoff and actual Alrio defeat; observed Alrio growth, saved exploration knowledge, bounded stair/input gates and exact repaired world return; typed tavern services and saved local hooks; canonical proprietor reconciliation, clear activity targets, resident mouse selection, family/memory reload, in-place rest, saved front doors and qualified railed Hartdown traversal). Source-bound shelf rendering and owned-content examination were checked in the saved Menaikon visit.

Named household schedules share the occupancy owner's 07:00 breakfast, 08:00
work and 18:00 return boundaries. Street travel uses existing route length at
1.2 m/s. Interior arrival waits for that leg, and one stable resident render key
collects home and workplace packets rather than discarding the second site.
Street ownership checks all destinations. Actual Brooksmith work-hour placement
was inspected inside the source shop, with unchanged player coordinates; this
camera-only check does not qualify physical player entry or commute navigation.
Indoor door-to-station legs remain straight and do not yet route around furniture.
Normal Jessa waits followed by a live-clock observation verify the Brooksmith
interior body visible at work at 17:59, hidden at 18:00:02, and visible at home
at 18:00:55, consistent with the source route's 53.68 seconds. Camera-only supper
and 22:04 sleeping-room captures retain seven source household members. Bodies
still stand at activity stations; seated meals, bed poses, physical stair/door
navigation and player entry remain unaccepted. The intervening street walk was
not visually qualified. Normal waiting also grew the discovery count from 4 to
52; chronology and relevance remain open rather than being counted as story progress.
The normal manual slot saved 22:05:13 and was explicitly loaded through Resume
Journey after a full document reload. Jessa retains seed 1793176402448, cell 4100,
XYZ 464.72931224239215 / -0.45952220226579654 / 473.2825216099574,
HP 10, gold 32 and seven inventory entries. All seven household render keys and
their world-space sleeping destinations survive; only ordinary live clock time
passes. This verifies the corrected support height, not unchanged legacy Y.

Walking now reuses `groundChunkLoader.groundSurfaceY` through `groundSurfaceYM`.
The former nearest-cell helper invented an 8.17 m step across a 10 cm boundary.
Natural ground has a 40-degree directional grade limit; structural floors and
treads retain their step and standing-clearance admission. Actual cold-load
replay settled Jessa's unsupported saved height from -4.708 to -0.295 m at the
same XZ, then admitted a short contour walk. The steep direct bank climb still
stops. That terrain replay did not qualify deck support or an on-foot town approach.
All 24 focused terrain/wall/door/stair checks and three scoped type paths pass.

The next walking candidate consumes the exact mounted deck mesh through
`createDeckSupportQueryFromMesh`, rather than reconstructing a flat top from
`GroundDeck.topY`. Fresh meshes carry `slabTopIndices` for underside clearance.
Old packets expose `hasSlabUndersides=false`; their missing clearance receipt
is not accepted as complete collision proof. The travel-owned geometry query
passes 27 focused cases, three scoped type paths and eight unchanged geometry
byte baselines. Those checks are distinct from actual walking acceptance.

`createMountedDeckWalkingSurfaces` retains each world's last mounted mesh per
chunk so a camera-only unload cannot remove support under the body. New LOD
meshes replace their chunk; a new ground world creates a new registry. Keyboard
and click walking share it. Reachable heights still use the existing step band,
so a saved body below a bridge is not lifted onto it. Rails, posts, abutments and
low slabs use the same 1.9 m body proxy. The existing 22 cm shin-step clearance
allows gentle arches without disabling torso/head collisions. Natural/deck
grades remain limited to 40 degrees. After one arch-contact failure and that
bounded repair, 35 distinct walking checks and five scoped type paths pass.
The three-source header wave updates one file, leaves two unchanged and reports
two stale dependents unwritten. Cold gameplay replay is pending for this candidate;
no legitimate bridge crossing, town approach or new physical service is accepted.

Cold rendered evidence then exposed a further discrepancy: the continuous
1.524 m source grid is not the coarser welded chunk's drawn triangles. Travel's
actual Putivl down-ray found terrain at 4.0334 m below a saved 7.9762 m body;
this is a different town from Jessa's and is not a Jessa measurement. The grid
repair alone therefore does not prove rendered foot support. A candidate that
made those coarse triangles the physical terrain was rejected: the rest owner's
Brea replay changed a preserved Y from -5.43279 to 1.50997 m at the same XZ.
That is a failed continuity experiment, not accepted relocation or inn arrival.
The override is removed. Canonical continuous terrain remains physical authority;
`renderedTerrainHeightAt` is a read-only discrepancy diagnostic. It retains the
best detail that actually mounted for comparison, never for moving a saved body.
The revised regression explicitly keeps an accepted 4 m body at 4 m when the
drawn triangle is at 2 m. All 21 current motion cases and the two changed
source/test type paths pass with zero errors or suppressed diagnostics.
The next correction must improve near-player rendering fidelity around accepted
canonical positions. The pure fine/coarse land transition in `riverTerrainLod`
is an existing scaffold; no render patch, source-grid edit, bank flattening or
resolution change has landed. Actual cold replay after removing the override
explicitly loads Jessa's original night slot, mounts the physical scene and
uses native To Player. The saved XYZ, HP 10, gold 32 and seven inventory entries
remain exact. The body is visible and the coarse physical override is absent.
At that same accepted point the drawn-terrain diagnostic is -2.592228787417703 m
versus the saved -0.45952220226579654 m footing: a 2.13 m visual gap remains.
This verifies preserved canonical footing, not physically convincing rendering.
The diagnostic triangle index is now lazy, so ordinary loading does not build
comparison indexes for all terrain chunks. A deck-only fixture exposed a missing
previous-cache guard; after repair all 21 motion cases pass and the changed
source path has zero type errors or suppressed diagnostics. The final separate
fresh-menu client succeeds and its capture is inspected with no errors file.
Jessa's earlier night save and the rest owner's original named slot remain the
baselines. Exact deck support remains a separate candidate, without
an accepted bridge crossing, on-foot town approach or new physical service.

Free-roam keyboard and click travel share `groundLocomotion`: existing character
speed in feet per round converts to meters per second (30 feet becomes 1.524
m/s). Shift requests twice that pace through one scene-local intent object;
blur and unmount clear it. Frame displacement uses at most 100 ms, including
stair pacing, so a stalled frame cannot become a long doorway stride. This does
not spend a combat Dash action or change collision, accepted footing or saves.
The player nameplate keeps a constant screen size after close camera views
made its former perspective scale cover the HUD.

An isolated unchanged copy of the interiors owner's earned Sana Chronicle
replays Roban Westsmith's Menaikon workshop, plot 156. Actual WASD leaves the
bench room, receives the same-room refusal and returns to gain staffed access.
One ordinary spare-dagger job rolls 10 against DC 10, takes 20 game minutes and
recovers one iron scrap and one leather strip; HP 9 and gold 20.77 stay intact.
The closed exterior leaf blocks forward walking. Ordinary fine taps align the
body, reopening admits the threshold crossing and support descends from
3.3682 m to 3.1613 m. A cold document reload and explicit default Chronicle load
retain XYZ 448.7431348853053 / 3.1612753245430465 / 491.8224627697499,
16 inventory entries and the open source door. This separate visit does not
qualify Jessa's bank approach, an NPC commute, every doorway or stair, seated
meals, bed use, crowd collision or Shift/click parity in actual play. Eleven
focused movement checks and five scoped type paths pass; the five avatar
checks pass again after the label change. Desktop and 390 px rendered checks
show an 88 by 24 px player label without horizontal overflow.

The existing household container reader totals exact catalog IDs in first-seen
order without changing source stock or ownership. The interiors owner's actual
Roban barrel read shows two separate one-ration rows as a quantity of two;
shelves expand their catalog description without transferring goods. Its
source checks are separate from that owner's final persistence qualification.

The accepted-height guard supersedes the earlier automatic legacy-height
settling behavior described in the historical terrain replay above. A finite
saved Y is retained on mount and idle frames. A genuine new arrival without Y
still resolves nearby canonical support. Walking first requires support beside
the actual saved feet; it refuses an unsupported request instead of moving the
body to terrain at the same X/Z. A supported requested step can settle a small
height discrepancy. `isGroundFootingSupported` supplies the avatar's explicit
footing-unavailable status, separate from water admission and camera framing.
The prior guard wave passed 45 distinct checks: 22 motion, seven avatar, seven
keyboard and nine stair cases, plus five clean scoped type paths. A streamed support
fixture also clears the warning at the exact retained feet before a new walking
request; that rerun overlaps the final case inventory. When groundPos is null,
the avatar queries canonical support instead of adopting the camera datum.
Actual named-return entry confirms canonical Y 3.8723420020916612 without a
warning; the higher companion anchors and under-deck scene remain unresolved.
Supported Sana walking also advances 0.0929 m on the workshop floor without a
warning; normal Save/full reload preserve exact feet, HP, gold and inventory.

Actual original Mara default Load at 07:31:04 and normal 3D at My Location
reproduce old-source Y 6.166488720703125 becoming 3.8723420020916612 without
walking at the same X/Z. On a fresh repaired-source copy, normal entry and W
input retain XYZ 442.3199999997944 / 6.166488720703125 / 460.0799999999162,
HP 12, gold 12 and 12 inventory entries. The body and both companion anchors
remain exact. Ordinary manual Save at 07:37:43, native full document reload,
explicit default Load and normal resave at 07:39:06 retain 13 present groups
exactly, including party, inventory, NPC memory, companions and quest log.
The absent journal field is not counted. The warning fits desktop and 390 px at
220 by 45.59 px without overflow; companion labels still clip at phone width.
The original input payload SHA256 remains 894a2dcd29b0904fb5bc533f58cce5336c130a10e64df1017ef24a44d2cdc696.
This is an archived regression copy, not a replacement for later companion
story progress. Preserving unsupported feet does not repair the under-deck
scene, make a bank/route walkable or qualify physical reunion or arrival.

The player-frame helper and free-roam controller query mounted opaque building
geometry at camera height. A cached broad phase limits ray work; live leaf
transforms reflect opened doors. The physical figure supplies head, feet and
side samples. Its projected blobShadow never contributes body width. Indoor eye
heights and shorter arms are tried without changing accepted feet. Retraction
is rechecked and its temporary dolly floor stays valid on following frames.
Callers that omit the optional scene query retain the conservative building
sweep; an unavailable mounted scene fails closed.

Keyboard camera translation uses actual footfalls rather than solver requests.
It follows settling motion after key release, then yields to pointer input.
Avatar, keyboard and camera visibility frame priorities are -0.75, -0.5 and 0.
Centered player views follow actual height; panned-away and town/combat framing
retain their own control. This is camera state, not discovery or locomotion.
The preceding 1.7997 m opaque follow obstruction motivated this repair. Actual
Sana exit/re-entry and desktop/390 px inspection verify bounded camera/body
following, with 34 focused cases and clean scoped types. Dark interiors, narrow
post overlap and broader camera/route fit remain open. Native full document
reload, explicit manual Load, inspected rebuilt desktop/390 px views and normal
resave preserve 16 present non-null data groups exactly, including the open
leaf and NPC/town data. This verifies one workshop return and player continuity,
not connected resident routines. See TRACKER.md for the autosave recovery and
source-epoch boundary. No water or bridge claim follows.

The town roster reserves explicit `proprietorHomeId` heads before assigning
remaining jobs by proximity. Both 2D and 3D merchant entry use
`computeBurgMerchants` with the canonical town seed. `townsim/householdNpc.ts`
projects supported age and family facts onto stable keeper/member IDs. Existing
NPC capabilities and memory, and existing business stock, remain intact during
reconciliation. Already-met children's parent references resolve to keeper IDs.
Actual Sypege inspection and saved reload verify Bryn Hartdown's shop and Lys
Greenford's smithy identity. Separate non-residential workplaces now pass
`workplaceOnly` to the shared occupancy owner: only the active adult proprietor
has a work station during 08:00–17:59. Children, spouses and home servants do not
inherit employment or sleeping claims there. The structural proprietor brief
and owned goods remain intact; unused bedrooms are not silently demolished.
Retired proprietors keep their existing work-plot identity for keeper/stock
joins, while the roster's `retired` flag prevents a daily work shift. Their
home occupancy retains daytime household activity. This is not a new staff or
succession system, nor migration proof for every historical simulation record.

`TownBuildingInspector` disables Talk and Browse when the source proprietor is
off duty or retired, and explains the absence. Unowned businesses retain their
existing fallback. Actual separate Jessa/Apololis play reproduced remote Talk
with absent Ysolde Brooksmith at 07:01. Repaired renders show her family eating
at home 92 and absent from shop 2. A normal zero-die Short Rest advances to 08:04:
only Ysolde is working in the shop; children and servants do chores at home.
Her name, family, seed, money and inventory are unchanged. This is inspector
and clock proof, not observed physical commuting, seated meals, ownership
permission, or useful furnishing services. Physical workplace meetings,
explicit hired staff, retirement succession and authored companion skills stay
open in Gameplay Flow GF-G23. Dawn town lighting remains visibly dark.

Earlier verification: 2026-10-16 (Agora task `agora-4fa0.70`). This pass re-checked every
current-state path and retired-file absence claim across the document and
reconciled the 2D `TownPlanView.tsx` pan/zoom and `TownPlanView.test.tsx` test
coverage claims against source without broadening rendered visual acceptance.
The 2026-09-23 pass (Agora task `agora-e840.7`) deleted the six orphaned
RealmSmith generator files and moved their names under "Retired Names". The
2026-09-20 pass (Agora task `agora-f821.32`) checked every path named as current
against the worktree with a file check, removed the five deleted town files from
the current-state sections, and moved their names under the single "Retired
Names" heading below. The building generation, road surface, perimeter and
preview sections were last verified 2026-09-08 and were not re-checked in this pass.

## Local building inspection

The dungeon expedition keeps bought source-matching accounts beside physical
traces derived only from explored floor keys, decay overlays and historical
props. It never displays the DM history log as player knowledge. Saved Alrio
play retains fungal growth and 176 mapped cells through retreat/re-entry.
World ground input and save-writing footfalls are suspended while the retained
dungeon overlay owns play; the hidden body stays at its return anchor. Actual
stairs gate level changes. Developer progress simulators remain separate from
normal UI and do not establish combat or loot; see Gameplay Flow GF-G27.

Adjacent generated creatures now hand a source-grid crop and registry actor to
the existing tactical combat owner. Source encounter IDs, accepted footing and
world return receipts survive the boundary; END_BATTLE owns attrition and loot.
Ground play also opens the existing short/long rest flows without abandoning the
accepted body position. Long Rest previews supplies and cooldown, uses ordinary
wait for eligibility, reduces one exhaustion level and records completion time for
the next cooldown. Actual Menaikon rest and named-slot reload preserve resources
and XYZ; ordinary named-save creation remains unwired (GF-G29).

A validated return checkpoint reconstructs the same floor/position without a new
entry visit. False victories and replayed rewards are rejected. Actual Alrio
solo play reached and fought the Water Weird, ending in defeat at 0 HP. A won
reward and full return/save/reload remain unverified; reducer fixtures alone do
not establish that player outcome.

Tavern services use the registered keeper business type, with owner lookup for
older saves and name-based entry only for unregistered merchants.
`Town/Intrigue/RumorMill` buys through the validated merchant transaction seam
and displays durable Service receipts even after bought gossip leaves the offer
pool. `TavernGossipSystem` restricts location-bound active rumors to the current
town and expiration, while retaining unlocated world news. World-owned dungeon
hooks have a separate local-ruins inquiry; their source text/IDs and earshot
remain authoritative. Saved Menaikon play verifies a bought undercity-growth
hook, canonical Alrio Channels entry, three movement cells and retreat with
exact world position and explored keys retained. Full expedition, meaningful
combat/reward and companion stories remain unaccepted. Business type versus
building use and active staffing still need reconciliation.

`systems/worldforge/interior/stairLayout.ts` reserves a measured two-flight shaft
and outside floor landings in cloned rooms while preserving the street entry.
`stairHousehold.ts` trial-fits real furniture and admits only plans that retain
every assigned sleeper. Adjacent child-only bedrooms may share one room after
its bed fit passes; adult rooms and trade rooms are not merged by that repair.
`generateBuilding.ts` tries one candidate and one child-room repair to bound town
streaming work. Failed homes retain the previous fitted plan. Bare previews keep
legacy compact stairs. Admitted geometry uses real treads, risers, timber supports,
a half-height landing and a four-cell floor opening. The SVG draws the same shaft.

Hartdown and Oakstead pass this gate; Blackford's trial fails. Hartdown retains
five beds and a separate parent room, with a hearth, table and provisions barrel
in its hall. Normal movement reached the lower landing and physical barrel;
save/reload preserved the exact position and household plan. Both stair flights
and the matching 2D floor plans were inspected.

`groundBuildingMotion.ts` now samples structural floor/tread support in short
steps and prevents excessive rises, unsupported drops and low ceilings. A fixed
1.9 m standing proxy needed an eight-foot lower stair opening. Feet/shins use a
narrower proxy beside low risers; shoulders retain the existing 0.6 m footprint.
These values do not establish clearance for every race or equipped weapon.
Ground walking ignores hidden tactical duplicate party walls; the retained
planar collision export still respects them for its existing enclosure contract.

Movement requests remain transient. Actual avatar footfalls write saved XYZ at
ten hertz, and old saves without height pick up their ground slab. Keyboard
control starts at the actual body when taking over from a click. Dungeon return
context also retains optional height. Normal controls climbed both Hartdown
flights, reached the parent's assigned bedroom and opened its real bed, then
descended to the hall. Separate upstairs and on-tread full reloads preserved
height and position. Continuous inclined timber handrails, close balusters and
landing guards now share the canonical shaft. Hartdown's railed climb, landing
turn, descent and another on-tread full reload pass in actual play. The tight
turn was steered with a camera aligned to the flights; all-angle navigation,
arbitrary in-motion save timing, broader body/equipment fit and other homes'
full traversal remain unverified.

`buildingModels.ts` keeps conservative collision bounds and a separate beam
profile. `interiorParts.ts` converts that profile to meters. The live renderer
and building preview use `beamGeometry.ts` for the actual sloping timber, and
the instanced probe carries the same orientation. Native WebGPU pixels were not
inspected. Rail pieces never become walkable support. The intermediate landing
retains at least 0.8 m of conservative turning depth after the terminal posts.

The gameplay Town Plan exposes buildings through map clicks and an accessible
building selector while the party occupies that settlement's atlas cell.
`TownBuildingInspector.tsx` displays canonical floor plans, named household
members, jobs, current hourly activity, and examinable furnishings.
`townBuildingVisit.ts` reuses the production Atlas-to-artifact bridge,
`buildingPlotInput`, `blueprintForPlot`, household resolution, occupancy, and
owned container manifests. Saved building history is supplied by GameModals.
Each building uses its own manifest seed stream. Inspection does not transfer
goods or move the player into a 3D room.

Keeper talk and browsing call the existing gameplay handlers using the saved
plot-keyed NPC and business. The inspector does not replace saved residents.
Physical furnishing use, taking owned goods, and reconciling older keeper
identity with household names remain open in the
[gameplay flow gaps](../../projects/gameplay-flow/GAPS.md).

Town navigation preserves slightly concave Atlas boundaries produced by vertex
quantization. For those parents, submap generation clips the parent against each
convex Voronoi child instead of treating the parent as a convex window. This
keeps Sypege's inherited burg subcell available without changing its geography.

### Staff and patrons in the two occupancy views

The building visit (`townBuildingVisit`, the inspector) and the live schedule
(`occupancyScheduleForPlot`, the 3D town) both read `computeOccupancy`, so
they cannot disagree about who works in a building. They store patrons in
different places:

- The visit keeps family and staff in `occupancy.stationsByHour` and
  public-house patrons in `occupancy.visitorStationsByHour`.
- The live schedule puts everyone in one `occupants` array. Patrons come
  after the family, with `memberIndex` = `household.members.length` +
  visitor index and `visitor: true`, so each render id stays unique.

Compare staff with staff (`!visitor`) and patrons with patrons. GG-542 counted
two inn patrons as household members 5 and 6 at work. The guard test is
`components/Worldforge/__tests__/townBuildingVisit.staffParity.test.ts`.

## Physical resident meetings

`InteriorOccupants.tsx` gives named bodies and their labels one selection route
through `GroundFurnishingContext`. Absent scheduled bodies hide their DOM labels.
`groundResidentInteraction.ts` resolves stable household member keys against the
same `townBuildingVisit` used by the inspector. An indoor resident and the
fresh avatar footfall must share a room and floor within 2.5 m. A current
street-owned personal body uses the same range and level checks plus the native
physical walking solver against source ground and saved open doors. Its reader
returns the actual rendered pose, never a requested route destination. Talk reads
the current body again; an absent, departed or moved resident cannot use an old
profile pose.

Resident body selection now accepts the primary pointer button only. Right and middle buttons remain available to the camera without starting a profile or reach refusal. A normal right-drag on Roban Westsmith reproduced the unwanted selection before this guard. The mounted regression failed on both camera buttons before the fix; all 25 occupant checks and two-file scoped types now pass. Fresh-source replay confirms that right-drag orbits without a resident warning and primary selection still refuses an out-of-reach body. An ordinary floor click then reaches Roban and opens his real profile. This changes no body position, schedule, family, reach limit or dialogue permission. The resident profile uses the existing left reader position to avoid the party-chat dock. World3DWrapper contains its scene branch in a same-size isolated stacking context, so Drei HTML name labels keep their depth order inside the world and cannot cover sibling inspection panels. Fresh-source desktop and 390-by-844 phone screenshots confirm readable household prose, no chat or name-label overlap, and no horizontal overflow. Native Close works, and explicit manual Load restores the real prior meeting, exact body and resource summary. Verification includes 25 occupant cases, six wrapper interaction cases with a bounded import allowance, and three scoped type paths. An extra loader suite retains one explicit 30-second cold-import timeout; its other three cases pass. This is bounded profile/input proof, not natural crowd, automatic graphics recovery or meaningful generated conversation acceptance.

New residents use burg plus household member key. Roster workers reuse the
existing plot-keyed keeper ID and its saved identity; this does not reconcile
older mismatched merchant names. New NPC family and age come from the real
household. Unsupported blood relations are omitted. Ordinary residents receive
an unarmed commoner baseline rather than randomly generated adventuring gear.
Their earned skills, quests and willingness to join need separate producers.
Talk uses existing dialogue and the authoritative `state.npcMemory` lane; the
NPC's embedded initial memory is not the current meeting record.

Actual Cob Hartdown contact, full reload, repeat Talk and another reload retain
one first-contact fact, update recency and preserve the real parent/siblings.
This does not accept generated conversations or natural crowd presentation:
the remaining room/stair routes and character poses are not qualified. The four
children now have clear distinct targets, and both age-5 and age-13 profiles open
by normal mouse selection without moving the player. Native pointer handlers
attach when Drei's HTML portal creates its actual button; a parent mount effect
can run before that node exists. Desktop and phone profiles were inspected.
The ground-only Short Rest button opens the
existing rest modal without abandoning the avatar's hall XYZ. The modal's
completion feedback and Atlas re-entry resetting position remain open findings
in [Gameplay Flow](../../projects/gameplay-flow/GAPS.md).

`activityPositions.ts` assigns non-sleeping stations clear plan-feet positions
beside their canonical activity targets. It uses real furniture footprints,
room boundaries, excluded stair/landing cells and a grid flood from room doors.
The fixed standing footprint and mutual spacing are two feet (0.6096 m). The
SVG and occupancy bridge read the same position. Bed assignments and schedules
are unchanged. A full room retains its previous station with an explicit
`no-clear-space` issue; this is not universal crowd-fit acceptance. Indoor travel
uses distance at 1.2 m/s, while the hourly home/out owner and exact frontage
handoff stay intact. Transit still follows straight segments and has no queue
or collision-aware route around furniture and stairs.

## Physical furnishing examination

Production interior parts carry canonical floor, room, furnishing index, and
kind. Clicking a furnishing in `World3DScene.tsx` resolves its current building
through `townBuildingVisit.ts`. `groundFurnishingInteraction.ts` validates the
identity and geometry, the avatar's fresh rendered footfall, room, floor, and
distance to the piece's footprint (at most 1.5 meters). Camera position and a
requested destination do not establish reach. The wrapper displays examination
and household container contents without transferring goods or advancing use.

Actual saved-game keyboard movement and mesh clicks exercised Hartdown's hearth
and kitchen barrel. Barrels use a rounded coopered mesh with iron bands within
their canonical footprint. Other furnishings still use simple geometry.
The avatar retains its spawn anchor while destinations change, caps long
strides, and remains the single moving player during staged encounters.
Ground clicks intersect rendered terrain; registered MapControls keep the
keyboard camera and target together.

`groundBuildingMotion.ts` sweeps horizontal movement against canonical building
parts using the shared site transforms. Its fixed 0.6-meter walking footprint
slides along faces and stops at corners without tunneling through thin walls.
Floor slabs, overhead lintels, below-grade parts, and presentation dressing do
not block ground-floor travel. Legacy overlapping saves can move toward the nearest exit rather
than becoming trapped. This does not implement race-sized body collision,
stair climbing, or route planning.

Both the avatar and keyboard driver use that sweep. A blocked avatar reports
its reached position to cancel and correct the destination. Actual footfalls
also drive exploration at ten hertz when the camera stays still. Camera pans
and destinations cannot grant discovery, dungeon entry prompts, or proximity
combat. Dungeon return uses the actual arrival coordinate. The active dungeon
overlay suppresses exterior proximity checks. Meaningful furnishing use,
ownership persistence, and saving during an unfinished walk remain open.

## Saved front doors

Production entry leaves carry their canonical floor, door index, position, axis,
and inward swing. `sitePartTransform.ts` supplies one open-leaf footprint and
render pose. `BuildingDoor.tsx` renders the fitted timber leaf, panels, and iron
rings; `groundBuildingMotion.ts` blocks at the leaf's current position.
Legacy untagged leaves and tactical combat retain the previous passage rule.

`groundDoorInteraction.ts` validates the canonical plan, actual fresh footfall,
floor, entry room or street approach, and 1.5-meter reach. A door cannot swing
or close into the player's walking footprint. `SET_TOWN_BUILDING_DOOR` stores
sparse current state in `TownSimState.buildingDoors`, by plot and geometry-backed
door id. Old saves begin closed. These flags do not enter structural history or
regenerate the town. Pending interactions show Opening/Closing door and reject
duplicate requests. Actual Hartdown play exercised opening, normal traversal,
closing refusal in the doorway, closing after stepping clear, and save/reload.
Permission/locks, NPC door use, and animated swing remain open.

## Household furnishing

`generateBuilding.ts` furnishes household plans after all sleeping groups have
been assigned, including overflow groups on the ground floor.
`householdFurnish.ts` uses the shared metric `furnitureCatalog.ts` read by the
production 3D bridge. Whole furniture footprints must fit within actual room
cells and avoid other pieces and stair shafts. A one-foot navigation grid
checks connected door/stair approaches for a 0.8-meter-wide walker and reachable
bed approaches. Routes bend around furniture instead of reserving an arbitrary
cell-center tree. Ground-floor routes now exclude the solid shaft and reach its
actual low end using the renderer's ascent direction. Previously the path proof
walked through that shaft. Hartdown's compact entry hall cannot keep its former
hearth/tables while preserving access; the normal placement gate omits them,
while its kitchen remains furnished. Overflow sleepers in multipurpose halls
also participate in capacity-proven reassignment, retaining Blackford's beds.
Upper landing/vertical traversal remains unverified. The current stair run is
too short for realistic ascent; see Gameplay Flow GF-G17. Hearths require an exterior wall.
Room purposes reuse the existing furnishing recipes. Plans without a household
brief retain their previous furnishing path.

Bounded alternative packing tries precede a missing bed. In crowded homes,
children can share another family bedroom only after a trial proves a bed fits.
This changes room claims without changing relatives, lots, walls, or doors.
The saved Sypege Hartdown, Blackford, and Oakstead fixtures now have a real bed
for every assigned sleeper. Oakstead also has spare beds; those do not count
toward another room's capacity. `occupancy.ts` assigns distinct bed stations to
residents sharing a room, leaving a station unset for a real shortage.
These fixtures do not prove universal household capacity. Furnishing
examination, natural physical use, and ownership persistence remain separate.

## Building scale and real 3D inspection

Building Lab doubles both physical town-plan axes with `transformTownPlan`
before adapting its parcels, keeping roads and lots aligned and five-foot cells
unchanged. The production keep placement prefers a peripheral ward with room
for a forty-foot square before street setbacks. Keeps resolve dressed stone,
a flat slate roof, and four continuous parapets supporting their merlons.
For seed 792767481 at population 3200, the lab keep is 55 by 55 feet.
Explicit parcel bounds still limit individual buildings; the site transform
does not promise a fixed multiplier for every clipped or minimum-sized plan.
Wealthy gable trim now uses vertically connected steps instead of floating
bargeboard fragments. Building Lab supports hover labels and individual part
selection, with dimensions, floor level, and separate roof-surface selection.

Worldforge's canonical building generator uses five-foot cells. Type-specific
footprint ranges in `src/systems/worldforge/interior/footprint.ts` now reserve
larger floor areas across all fourteen building types. Town parcels remain
authoritative: explicitly constrained plots may produce smaller plans. Row
packing in `townEngine.ts` retains generated depth and avoids the former fixed
15/20-foot frontage override.

The blueprint preview and Building Identity Lab both use `PreviewBuilding3D`.
It shows canonical furnishings with the production bridge's dimensions, plus
a six-foot reference figure on one five-foot square. The figure is a measuring
aid, not a resident or a universal character height. The scene uses feet; the
streamed town converts feet to meters at 0.3048 meters per foot.

The streamed renderer batches actual outer-wall segments, openings, and
architectural details through `buildingExteriorGeometry.ts`; nearby interiors
still use the complete site-part representation. Shared fallback surface images
live in `public/assets/town-materials`, with provenance and limitations in its
README. This improves building inspection but does not establish final visual
acceptance against the Dream Loop concept.

The reviewed tavern seed 792767481 now has a 60-by-55-foot bounding envelope
(previously 40 by 40). An irregular envelope is not its usable floor area.

House surfaces share physical texture coordinates across the foot-based lab and
meter-based world. Roof courses follow the slope; plaster, thatch, slate, and
clay use construction-specific colors while retaining seeded variation. The
seven-image fallback library now includes weatherboards, brickwork, and clay
tiles. Plain timber-plaster houses receive visible framing that avoids windows.
Gable ends and the solver's roof-step skirts close the previously open roof skin.
The lab initially faces the entrance, uses rough physical surface lighting with
ink edges, and retains orbit controls and the character-scale reference.

## Real 3D road surfaces

`src/systems/world3d/roadGeometry.ts` splits road faces at terrain-cell edges
and diagonals, so their interiors follow the rendered ground as well as their
corners. This prevents triangular patches of paving from sinking into terrain.
Matching town-street endpoints receive beveled joins for each paving layer.
Road tiers have separate height bands: all plaza layers sit above avenue,
street, and lane layers, preventing lower-tier ruts from crossing plaza edging.
Flat chunks retain compact ribbons; regional road routes and colors are preserved.

## Town roads meet the world roads

Verified 2026-11-02 (GG-582: roads keep to a bank). Earlier: 2026-10-31
(GG-541). One function, `region/roadCourse.ts`
(`roadCourseFt`), gives each world road its course. It smooths the route
between towns and keeps every route point in a burg's cell exactly, so a road
runs through each town it serves. The region tier draws that course, and the
town generator takes the same course at true scale (`town/townRoadCourse.ts`,
the inverse of the town placement, as `townRiverCourse` does for the river).
The town's approach road is therefore the wilderness road.

Before this, the region tier smoothed the whole route, which cut the corner at
each town, and the town took every route through its cell shrunk about 30x by
the cell affine (`cellRoadPolylines`, now unused but kept). Town roads ended in
grass. At Tineroe (world 1793371993547) the trail passed 403 m from the town.
A census of 8 towns in that world after the fix: the world road passes 0 m from
7 town centers and 4.6 m from one, and every town street end that touches no
other street lies on a world road, except one inner lane near a market.

**A road keeps to a bank (GG-582).** A world road and the river in its valley
follow the same chain of map cells, so at true scale a road can lie on the
river's center line. Remy found one at Borieborum (burg 702, world 903674813):
1,083 ft of approach road in the water. The shared rule
`keepRoadOffRivers` (`region/roadCourse.ts`) moves each stretch of road
that comes nearer a river than half the river's width plus
`ROAD_RIVER_CLEAR_FT` (30 ft) onto the bank, at exactly that distance. The
width is the river's width at each point (`riverRoadClearAtFt`, the nearest
atlas segment, the rule `generateRiverBanks` uses). A stretch that leaves on
the side it came from stays on that bank. A stretch that leaves on the other
side crosses once, at the place where the atlas road itself changes bank and
meets the river most nearly square, and the crossing runs straight across.
Both tiers apply the rule to the full world road within
`ROAD_RIVER_CONTEXT_FT` (10,000 ft) of their own area
(`keepRoadOffRiversNear`): the region tier with every river near its window
(`generateRegion`), and the town with its own river
(`townRiverRoadReachFt`, passed to `townRoadCourseCanon` for layout
revision 2 only). The town's approach and the wilderness road stay one line.

Town points are not held to the river rule. A river town's center usually lies
in its river, and a road held there runs into the water. The town plan closes
what that leaves:

- an approach road and a field track get a bridge deck where they cross;
- a field track keeps to a bank, with its gate end held;
- a top-up gate stands out of the water (`buildWalls` `dry`);
- a road that stops short of the wall runs on to the nearest ring point out of
  the water, within 15% of the ring's span, and a gate stands there
  (`roadsReachWall`);
- a road that shares a gate with another road runs to that gate
  (`approachesToGates`);
- the main street drops a corner only where the new straight line stays out of
  the water (`river` input to `buildStreetNetwork`);
- a village branch lane does not start on its street's bridge, and it ends
  where any part of a step meets the water (`laneVillage.ts`).

Measured on all 249 river towns of world 903674813 with
`.agent/scratch/town-look/road-in-river.mts`, `road-ends.mts` and
`region-match.mts` (gitignored): road length in the water outside bridges
0 ft (5,647 ft in 18 of a 40-town sample before); every approach end on a wall
is at a gate; each town approach that reaches the town edge meets the region
road there (0 ft off in a 40-town sample); those 40 region windows have no
road in the water, and all 26 of their crossings meet the river at 90
degrees. Open: GG-583 (a wall in the river, or a town center outside its
wall, leaves 4 roads without a gate) and GG-584 (a hedge in the Legium
gateway).

## Town shape rules measured against Watabou (town look)

Verified 2026-10-31 (GG-544 to GG-551, Remy's town-look sheet). Every town
was measured against Watabou town and village output, and Remy picked all
eight rules. Every town re-lays out; 43 played-town fixture tests need new
subjects (GG-552). The rules, in `town/`:

- **Physical scale.** `canonicalTown` passes `feetPerUnit` (`townSpanFt /
  CANON_TOWN_SPAN`, 1.2 to 6 ft per unit). With it, lots, streets, quays and
  fields are sized in feet. A plan without it (tests, the building lab) is
  schematic and keeps ward-relative sizes.
- **Deep lots** (`townLots.packBlockDeep`, GG-545). Each block edge owns the
  block points nearest its street line. That territory is cut into lots 15 to
  30 ft wide, running to the rear line, at most 70 ft and 30% of the block's
  short span, so a back court survives for the shared court houses. All cuts
  are half-plane clips of the real block, so concave blocks work. Edges whose
  inward side is outside the block (backward slivers) are not streets. Rows in
  a temple, keep or citadel ward stop at its grounds (GG-566, below).
- **Streets in feet** (GG-550). The back lane is the 3D lane, 10 ft; all tiers
  keep the 28/22/15/10 ft ladder.
- **Field tracks** (GG-549). A gate with no road gets a lane-tier `approach`
  with `track: true`, out to the farm band or a nearer road.
- **Road and water carve** (GG-546). Only drawn approaches carve, with round
  caps at bends and ends. A river with a known width carves its true channel
  (GG-561, below); without one, the 3D channel half-width plus a 5-ft
  towpath. The coast carves a 15-ft quay. A block too small to cut is one
  building.
- **Suburbs** (GG-544). The wall ring is inset `0.94 − 0.24 × crowd` of the
  core, so a full town's wall encloses its old town. Suburb blocks fill the
  band between wall and core edge, nearest a road first, then ribbons run
  along the roads. The outside count is `wallFill` × the inside count. Suburb
  wards carry `extramural: true` and come after every intramural ward, so
  intramural plot numbers keep their order. Unbuilt band blocks are market
  gardens (`openLand` source `extramural`).
- **Suburb lanes** (GG-604). Each suburb block is pulled in from its cell
  by about half a lane, and that lane is now a street. `suburbLanes` in
  `townEngine.ts` emits the cell edges of the built suburb blocks as
  passages (`role: 'passage'`, tier `lane`, half a lane wide, no
  `serves`). Before this, a row that faced its cell edge had no way out
  except through the row behind.
  - An edge two built cells share is one lane. A piece inside a house is
    left out. A suburb lot keeps more than a quarter lane from its cell edge,
    so the lane reaches no house, and as a passage it drops no house (GG-564).
  - Each lane joins every approach road it crosses: the crossing point is
    added to both lines, so the router joins them at one node.
  - A lane group that reaches no road gets one straight link (at most eight
    lanes long) to the nearest road or reached lane. The link may not cross a
    house, the wall or the water. A group that still reaches nothing is
    dropped, so no lane is an island.
  - The lanes come last in `streetNetwork`, so every earlier street keeps
    its id. Revisions 1 and 4 (`townLayoutV1`) do not run this pass.
  - Measured with `.agent/scratch/npc-life/faults.mts`: fitted doors whose
    step crosses another plot fell from 27 to 5 of 674 (demo town) and from
    184 to 9 of 1,151 (Borieborum). Routes that cut another plot for more than
    3 ft fell from 98 to 22 (demo). The 14 doors left were blueprint entries
    on a back or side wall, fixed by GG-608 below. Cost: the router has more
    nodes, and the demo bake rose from about 20 s to 31 s (GG-605).
- **Every front door faces a street** (GG-608, Remy's ruling 2026-11-02,
  "Fix all towns"). Two causes, two fixes:
  - **Blueprint entry** (`interior/doors.ts`, every layout revision and old
    saves too). The entry room is the main room when it touches the street;
    else the public room on the street nearest the main room in door steps,
    through public rooms only (a corridor first at each depth). No bedroom
    or member's room (`forSlot`) is used or passed. Only when no public room
    reaches the street does the old rule stay: the main room's outer wall.
    Before, a main room with any outer wall took the entry, often on the back
    wall or on a side party wall.
  - **Ribbon lots** (`townSuburbs.ts`, revisions 2 and 3). A lot starts with
    its road edge, wound so the lot lies to the left of it, because
    `orientedQuad` reads the first edge as the street front. On the right
    side of a road the winding was reversed, so those houses faced away from
    their road.
  - Rooms do not move; only the entry door and what reads it (windows,
    clear space, stations). Sample of 8 towns per revision (world 903674813):
    the entry moved in 65 of 643 buildings (revision 1), 65 of 649
    (revision 4) and 166 of 2,314 (revision 2); world 1793146029630: 40 of 522
    (revision 1) and 44 of 527 (revision 4). A saved observed building keeps
    its saved plan.
  - Measured with `.agent/scratch/npc-life/faults.mts`: 0 of 674 (demo) and
    0 of 1,151 (Borieborum) door steps cross another plot, and no route cuts
    a plot for more than 3 ft. Every demo door and 1,150 of 1,151 Borieborum
    doors are on the front edge; the last is a keep whose door is on the
    short side of its quad that touches its street.
- **Lot sizes in feet** (GG-554). A canonical plan unit is townSpanFt /
  1000 ft (1.2 to 6), but two lot checks read units as feet:
  `buildingEnsembles` stamped a lot profile only on lots 15 units and up,
  and `packWardFrontage` cut its five-cell lots at `CELL_FT * 5` units.
  Both now take the plan scale (`feetPerUnit`) from `townEngine`;
  `townLayoutV1` (revisions 1 and 4) passes none and is unchanged. Share of
  attached lots with a profile, 3 towns per class: city 23% -> 63%, capital
  0% -> 75%, walled town 39% -> 76%; village detached 53% -> 98%. A profiled
  lot is drawn to its exact lot line (no inset), so those houses grow to
  their lot. Two follow-ons keep doors and lanes clear: the plan-only door
  (`buildStreetGraph` without fitted doors) takes the house front when it is
  within 5 ft of the nearest wall, and `suburbLanes` tests a house as its
  drawn rectangle. `packWardFrontage`'s five-cell path runs only with
  `partyWallRows`, which current towns route to `packBlockSquare`.
- **No movement blocker on a road** (GG-584). The last step of
  `placePropsInstrumented` drops a prop that blocks movement when it reaches
  onto a road (half the paved width plus a reach of 0.4, 0.75 or 1 m by size
  class) or stands within one cell (plus that reach) of a gatehouse. Rivers
  and roads with no recorded width are not tested; signs, lanterns and
  other non-blockers stay. Milestones and fingerposts now stand on the verge
  past each road's edge. Legium's west gate has no prop within 6 m (before: a
  stone bench at 0.3 m, a hedge at 1.5 m, two carts), and the battle anchor
  is the gate tile (40, 30) again. Dropped per town (Legium and four band
  towns): 12 to 169 building-side props, 4 to 114 roadside markers, 42 to 101
  dock props, 13 to 18 gate props; no market prop.
- **Cloister fallback** (GG-581). The cloister search shrank its walk's
  width and length together, so on grounds with cut corners (Hafting) the
  width fell under 16 ft first, and it never tried the side behind the
  building. When it finds nothing, a second search tries both flanks and the
  back with width and length apart and keeps the largest walk. Hafting now
  has a walk and a garth behind its temple; every cloister the first search
  placed is unchanged.
- **Ports reach the shore** (GG-547). `buildTownCore` runs the core out to two
  quay widths of any coast edge. A crowded town's wall stands back from the
  shore, so quays may seat on the suburb band outside the wall (`pierFor`).
- **Lane villages** (GG-548). Every unwalled settlement (`form: 'lanes'`) is
  houses along its road and branch lanes, with gardens behind, a green and a
  church at the heart (`laneVillage.ts`).
- **Strip fields** (GG-551). Farm parcels are cut into strips about 44 ft wide
  that run back from their road; each carries `furrowAngle`.

Census of all 813 towns of world 903674813, before → after: median plots in a
walled town 81 → 317, built-block cover 0.44 → 0.77, walled-area cover 0.21
→ 0.42 (Watabou 0.34 to 0.45), empty blocks 14.7% → 4.8%, gates with a road
81% → 100%, coast distance 0.17 → 0.07 of the span. Buildings outside the
wall: 0 → 44% (capitals), 20% (cities), 10.6% (walled towns, whose walls are
mostly not full). Capital generation takes about 1.2 s.

## Town map rules from Remy's 2026-11-01 review (GG-560 to GG-567)

Verified 2026-11-01 at the four filled bands of the `town3d` step (village
Sarprak 718, walled town Hafting 433, city Paphina 220, capital Borieborum
702; world 903674813 has no hamlet), at the four "water burgs" picks, and at
nine more river towns. Layout revision 1 (`townLayoutV1.ts`) is unchanged.
The rules, in the order the engine runs them:

- **Main street first** (GG-567, `planMainStreet`). Before the wards are cut,
  the engine draws a line from the main gate to the market: a gentle curve,
  at most a tenth of its length off straight. The main gate is the gate on
  the longest road whose line keeps at least 60% of its site pairs. Ward
  sites go in pairs across the line, one each side, a block (150 ft) apart,
  so the Voronoi edge between each pair lies on the line. The scatter keeps
  clear of each pair and of the market. Ward corners closer than 7.5 ft are
  welded, which removes the short jogs where four wards meet. The market
  ward is the roomy ward at the line's end. The street network routes the
  main gate to the first corner of the market ward, with edges on the line
  at a quarter of their length. That spine is `main: true`, 25 ft wide
  (`MAIN_STREET_WIDTH_FT`, between avenue and market frontage), and runs from
  the gate to the market. Its drawn line drops short sharp jogs; the block
  inset still reads its ward edges (`wardEdges`). A lane village marks its
  street past the green as `main`.
- **River out of the town** (GG-561, `townRiverCut.ts`). With a river width,
  the channel is the river line plus half the width plus an 8 ft bank
  (`RIVER_BANK_FT`). Every ward the channel crosses splits along the two bank
  lines, and the pieces in the water go, so the banks are ward edges. Suburb
  band cells split the same way, and the water carve uses the same channel.
  A market inside the channel moves a ward span out onto the main gate's
  bank.
- **Bridges carry streets** (GG-560). The street ends at the two banks pair
  up as links; the engine builds the main street's crossing first, then
  those nearest the center, a ward span apart, at most about 37 degrees off
  square. Links join the street graph, so routes cross on them. A deck is
  the link plus an 8 ft abutment at each end, as wide as its street plus a
  2 ft parapet each side. Any other street over the water (a gate on the
  wall where it meets the river) gets a deck where it crosses. A deck that
  touches another is dropped. Without a river width (a schematic plan) the
  old crossing search stays, with the same deck width rule.
- **Docks on the bank** (GG-561). A river dock starts on the bank line and
  reaches the bank margin plus 30% of the river width; a village landing
  stage does the same. Coast docks keep their old rule.
- **Gate hooks** (GG-562, `dropGateHooks`). A corner within 1.5 street widths
  of a gate that turns back more than 90 degrees goes, and the corner before
  it is checked again. The main street uses 30 degrees and twice the reach.
- **House shape** (GG-563, `houseShapeOk`). A house is at least 12 ft across
  its narrow side (`MIN_HOUSE_WIDTH_FT`), has four or more corners, and no
  corner under 30 degrees. A failed lot joins its row neighbor; failing that,
  its sharp corners are cut off (`chamferSharpCorners`) and left as open
  ground; failing that, it is yard. Court houses and one-house blocks obey
  the same rule. A thin block's rows may always run 20 ft deep
  (`THIN_BLOCK_ROW_FT`).
- **Squarish houses** (GG-563, Remy's ruling "MOSTLY squares or squarish").
  Every house passes `isSquarish`: all corners within 15 degrees of square
  (90, or 270 for an L notch). The lot cutter counts a wedge that cannot
  hold a 12 ft rectangle on its front as failed, so it joins its neighbor.
  The last pass in `finishTownPlan` turns a house that still fails into the
  biggest rectangle on its front inside its lot (`rectangleOnFront`); the
  lot is drawn as yard under it.
- **Block shapes for square houses** (GG-563, Remy's ruling: change the
  block shapes, keep the 15-degree rule). Counted by block shape, blocks of
  nine or more corners (suburb blocks on the wall's curve) lost 57% of their
  houses and blocks under 40 ft across lost 75%. The fix has four parts:
  - **Ward grid.** The ward sites stand on a jittered grid turned to the main
    street (`lattice` in `generateSubmapSites`; `BLOCK_ASPECT` 1.6,
    `BLOCK_JITTER` 0.3), 1.6 sites per ward the population asks for
    (`BLOCK_GRID_DENSITY`), so blocks come out smaller and near-rectangular.
  - **Straight block edges.** A convex block corner within 4 ft of straight
    merges into one longer street edge (`simplifyConvexCorners`).
  - **Rectangle rows.** Each street cuts a row of true rectangles, the
    longest street first, and a lot stops short of the lots already placed
    (`packBlockRows`). The engine cuts each block both ways and keeps the cut
    with more houses (`packBlockSquare`).
  - **Civic seats.** A first ward cut picks where the temple, keep and
    citadel go; the wards are cut again with the grid kept clear round each
    seat (`CIVIC_SEAT_FT`, at most 0.9 ward spans), so the civic buildings
    keep room for their grounds.
- **No house in a street** (GG-564). Each block is inset by the half width
  of the street on each edge (exact half-plane inset). The last pass in
  `finishTownPlan` drops any house that reaches into any street of the
  network (`streetReach`): the runs from gates, removed hooks and wide
  street ends are not ward edges.
- **Gardens by district** (GG-564, Remy's ruling). In the dense core inside
  the walls a house stands on its street line. In a suburb (15 ft), a
  wealthy ward (20 ft) and a lane village (15 ft) it stands behind a front
  garden: `openLand` with `front: true`. Ward wealth is set before the lots
  are cut, and wealthy and suburb rows run deeper (`GARDEN_ROW_SHARE`) to
  make room.
- **Passages** (GG-565, Remy's ruling "add a passage"). Each back-court
  house gets a 6 ft passage from its door to the nearest street, through the
  fewest other court houses. A street lot in the way keeps the parts beside
  the passage that are still a house. Passages are streets with role
  `passage` and `serves`, so the 2D map and the 3D bake draw them.
- **Civic grounds** (GG-566, `civicGrounds.ts`). A temple, keep or citadel
  faces its widest street. It gets grounds (a margin of 30, 25 or 35 ft that
  the rows may not enter), a 24 ft forecourt, and an approach (12 or 14 ft,
  a `passage` street) through the houses to the street. The faith of the
  cell picks the temple's set piece (churchyard, grove, pool or cloister)
  and the state form picks the keep's (bailey, cloister or hall yard); a
  citadel always has a bailey. `plan.civicGrounds` carries them; the 2D map
  draws them. A village church stands in its own churchyard.
- **Shared courts in the old core** (GG-577; default taken, Remy did not
  answer). The ward grid is coarse inside the old core (`OLD_CORE_SHARE`
  0.55 of the town radius round the market), so its blocks come out larger.
  A block at least 80 ft across (`COURT_BLOCK_FT`) keeps a shared court:
  the street rows stop short to leave it at least 50 ft wide
  (`COURT_SPAN_FT`), and up to four square houses (at most 24 by 16 ft)
  ring it, with an open middle of 18 ft (`courtRingHouses`). Every house
  still passes the 15 degree guard.
- **Civic grounds in 3D** (GG-569). `transformTownPlan` and
  `toArtifactPlan` carry `civicGrounds` in feet to the ground bake. The
  bake reuses its existing systems, with no new renderer:
  - the forecourt, a cloister walk, a hall yard and a gatehouse floor are
    paved plazas;
  - a sacred pool is a carved lake;
  - a cloister garth is a garden parcel of the town vegetation;
  - each grove tree is a `townTree`;
  - a bailey's curtain wall is a town wall run, split at its gatehouse, and
    the gatehouse uses the town gatehouse form;
  - each grave gets a headstone, and a pool gets reed beds on its edge (the
    `civic-grounds` prop pass, last in `placePropsInstrumented`).
  The open grounds stay as the window's grass.

Measured after (before in brackets), all four bands: houses under 12 ft 0
(Hafting 56), corners under 30 degrees 0 (Hafting 8), houses in a street 0
(Hafting 77, capital 15), back-court houses with a passage 14 of 14
(0), main street max turn 0 to 8 degrees, decks at the capital 14 to 26 ft
wide for 10 to 22 ft streets (73 ft), house centers in the capital's river 0
(120 of 1,995), squarish houses 100% (Hafting 38.8%, Paphina 18.4%,
Borieborum 11.8%). Houses before the squarish rule, with the squarish rule
alone, and with the new block shapes: Sarprak 65, 65, 65; Hafting 389, 321,
344; Paphina 305, 216, 282; Borieborum 1,563, 986, 1,227 (revision 1 of
Hafting has 121). Measured with
`.agent/scratch/town-look/gaps.mts` and `squarish.mts` (gitignored).

Shared courts (GG-577), houses and courts after (before in brackets):
Sarprak 65 and 0 (65 and 0); Hafting 324 and 7 (344 and 0); Paphina 282
and 1 (282 and 0); Borieborum 1,194 and 8 (1,227 and 0). Squarish houses
stay at 100%. Civic grounds in the Real 3D bake (GG-569): Paphina 19 of 19
graves have a headstone; Sarprak keeps 33 of 44, and the surface gate drops
11 on steep ground; the Borieborum grove has its 8 trees; the Paphina keep
and the Borieborum citadel each have a curtain wall and a gatehouse at the
plan position. Measured with `courts-bands.mts`, `civic3d.mts` and
`civic3d-pos.mts` under `.agent/scratch/town-look/` (gitignored).

Still open: the Hafting cloister places no walk because the cloister does
not fit its grounds (GG-581), and the 3D river carve is narrower than the
channel the plan now cuts (GG-553).

## The market square (GG-586)

Verified 2026-11-02 at the four filled bands of the `town3d` step and at six
towns of each size class in world 903674813. Remy asked at Hafting (burg 433)
for a market square: the plaza was a bare tan block. Layout revision 1 is
unchanged.

The square is the plaza ward's block. `buildMarketSquare`
(`town/marketSquare.ts`) lays it out at the end of `finishTownPlan`, after
every house is final. The result is a `plan.civicGrounds` entry with civic
kind `plaza` and set piece `market`, placed after the temple and keep
grounds. So the GG-566 and GG-569 paths carry it to the 2D map and to the 3D
bake. A plan with no scale profile (a schematic plan) gets no market.

What the square holds (`marketPieces`) comes from the size class and the
town wealth band. The band is `townWealthBand` in `population.ts`, the rule
the town personality uses:

| Size | Centerpiece | Market hall | Weigh house | Pillory | Stall cap |
|---|---|---|---|---|---|
| Village | well; market cross when rich | no | no | no | 6 |
| Walled town | well, market cross, fountain (poor, comfortable, rich) | rich only | not poor | yes | 24 |
| City | market cross when poor, else fountain | yes | yes | yes | 40 |
| Capital | fountain | yes | yes | yes | 64 |

A poor town's stall cap is 0.7 times the table, and a rich town's 1.3 times.

How the pieces stand:

- A clear walk runs round the inside of the square: 16 ft, or 8 ft on a
  village green. So a street that enters at a corner or a side, and a shop
  that faces the square, opens onto paving, never onto a stall.
- The centerpiece stands at the most open point of the square. A 16 ft lane
  from the main street's mouth to the centerpiece stays clear.
- The market hall stands as far from the main street's mouth as it fits. It
  covers at most 18% of the square and shrinks to half size before it gives
  up. The weigh house stands as near the hall as it fits. The pillory stands
  beside the centerpiece.
- Stalls are 10 by 7 ft. They stand back to back in pairs of rows along the
  square's longest side, with a 12 ft aisle between pairs and an 8 ft cross
  aisle after every four stalls. The stalls nearest the centerpiece fill
  first, up to the cap, and at least 55% of the square stays open.
- A walk grid (2.5 ft cells) floods in from every part of the square's edge
  that lies on a street. A stall whose open side the flood does not reach is
  dropped (`marketReach` measures the same thing).

A market square has a size floor (`MARKET_SEAT_FT`): no scattered ward site
stands nearer the market point than 120 ft in a walled town or 160 ft in a
city or capital. The larger of that floor and the old clearance (0.8 ward
spans) wins, at true scale only. Before it, city squares were 6,000 to 11,000
sq ft, too small for their hall, and Borieborum's was 9,473 sq ft with two
stalls.

The edges: a frontage house whose street side looks onto the square, across
the market street and at most a wealthy front garden, is `facesMarket`
(`plotFacesSquare`). The population pass makes it a shop, an inn or a tavern
by its class; a landmark such as a guild hall still comes first. Its frontage
is a `market-arcade` ensemble.

Where it draws:

- 2D: `TownPlanView` draws the square, its stalls and pieces in the civic
  grounds group, under the houses. The plaza's own fill no longer draws over
  everything when a market covers it.
- 3D: `toArtifactPlan` adds the market hall (two storeys) and the weigh
  house (one storey) as `civic` plots after every other plot, so no plot id
  moves. The `civic-grounds` prop pass stands a `market-stall` on each
  planned stall, open toward its aisle, with one or two pieces of stock inside
  it, and a `well`, `market-cross`, `fountain` or `pillory` at its outline's
  middle. `market-cross` and `pillory` are new catalog props; a fountain is
  drawn as a wide well basin, a market cross as a tall stone cross, a pillory
  as a fingerpost. A town with a planned market gets no old ring of stalls
  (`buildMarketPlazas`).

Measured with `.agent/scratch/town-look/market.mts` and `market3d.mts`
(gitignored):

- Bands: Sarprak (village) a well and 5 stalls, 90% open; Hafting (walled
  town, comfortable) a market cross, weigh house, pillory and 24 stalls, 86%
  open; Paphina (city, rich) a fountain, hall, weigh house, pillory and 11
  stalls, 82% open; Borieborum (capital) a fountain, hall, weigh house,
  pillory and 64 stalls, 76% open.
- Six towns per class: stalls per square, village 0 to 4, walled town 5 to
  24, city 4 to 21, capital 30 to 64; open share at least 0.72 (capital), 0.79
  (city), 0.81 (walled town), 0.89 (village). Every stall in every sampled
  square is reached from a street, and all the free paving is reached. No
  stall stands nearer the edge than the walk.
- Halls where due: city 5 of 6, capital 6 of 6, rich walled town 1 of 1.
  Weigh houses: walled town 5 of 6, city 3 of 6, capital 6 of 6; the misses
  are squares with no room left.
- Facing houses that trade: 171 of 182 in the sample; the rest are landmarks.
- 3D bake: Paphina places 13 of 13 market props at their plan positions,
  and its hall and weigh house are buildings. Before the plaza pads (below),
  Hafting placed 25 of 26 and Sarprak 0 of 6, because the surface gate
  refused props on 11 to 18 degree ground.

### Plaza pads in the 3D bake (GG-593)

Verified 2026-11-02 with `.agent/scratch/town-look/market3d-593.mts`,
world 903674813. The bake grades each paved square to a gentle pad before
it levels the building plots. `gradePlazaTerrainPads`
(`bridge/plazaTerrainPads.ts`) runs in `makeGroundWorld` just before
`flattenBuildingTerrainPads`, on the same encoded height grid.

- The plazas are `planPlazas`: the market square first, then each civic
  forecourt, cloister walk, hall yard and gatehouse passage (GG-569).
- Each plaza gets a plane fitted to the grid nodes inside it (least
  squares). The plane passes through their mean height, so cut and fill
  balance and the square keeps its level.
- The plane's grade is held to `PLAZA_MAX_GRADE_DEG` (5 degrees, about one
  in eleven). That is well under the 10 degree prop surface gate. A square
  that is already gentler keeps its own fall.
- A node that an earlier plaza graded keeps its height, so the market square
  wins where a forecourt touches it. One ring of nodes round each pad blends
  halfway toward it, as round a building pad.
- The building pads run after this step. A hall or weigh house inside a
  square samples the graded paving, and every house keeps its level floor.

Results: Sarprak places 6 of 6 (before 0 of 6), Hafting 26 of 26 (before
25 of 26), Paphina 13 of 13 and Borieborum 66 of 66. Sample: 14 sampled towns place 365 of 365 market pieces at their plan positions; 3 of them have a square steeper than 5 degrees (up to 9.6), now graded to 5; the steepest ground under a piece is 5.0 degrees; the largest cut or fill at a square's edge is 3.4 m.

Open: a village green with no room after its walk and centerpiece holds no
stall (two of four sampled greens hold 0 or 1).

### Churchyards and retaining walls in the 3D bake (GG-614, GG-613)

Verified 2026-11-03 with `bank-probe4.mts` (session scratchpad), world
903674813, against commit 093b78113 run from a `git archive` copy.

- **Grading order.** `canonicalTownWaterAndDecks` returns `gradePads`: the
  market square, then each churchyard's whole grounds (held to
  `CHURCHYARD_MAX_GRADE_DEG` = 10 degrees and left as grass), then the other
  civic paving. A churchyard and its forecourt therefore share one plane.
  `GroundWorld.gradedPads` records the list.
- **Retaining walls** (`retainPadEdges` in `bridge/plazaTerrainPads.ts`,
  after the pads and before the building pads). Each pad edge is walked in
  1 m steps, and the pad's plane is set against the natural ground two cells
  out. Where the step is more than `PAD_WALL_STEP_M` = 1.2 m, a wall run
  stands one cell out. 4 ft is the height above which codes (IBC 1807.2)
  want an engineered retaining wall; over the two-cell skirt it is a bank of
  about 22 degrees. The nodes within a cell outside take the pad's height,
  so a grave or stall on the edge stands on the pad. The nodes past the wall
  keep the natural height. A wall's top is a 0.4 m parapet above the higher
  ground, and its base a 0.3 m footing below the lower ground.
  `GroundWorld.retainingWalls` carries the runs with `wallTopY` and
  `wallBaseY` per point, apart from the defense `walls`. Only the chunk wall
  mesh draws both, and `wallGeometry` uses the per-point top and base.
- **Streets** that meet a pad edge get no wall. Their ground takes up the
  step the pad made at its nearest edge point and lets it out over the step
  divided by `PAD_RAMP_GRADE` (1 in 8, the usual limit for a cart street).
  So the pad adds at most 1 in 8 to a street's own grade.
- Results (band towns): Sarprak 44 of 44 graves stand (before 33), 5 wall
  runs, no bare step over 1.2 m (before 30 m), approach grade 0.109 m per m
  (before 0.215). Hafting, Paphina and Borieborum need no wall. Markets keep
  6 of 6, 26 of 26, 13 of 13 and 66 of 66 pieces. Sample (15 towns): bare
  steps over 1.2 m 18 -> 3 m (single samples at a run end; a run needs
  three points); graves 128 of 140 before and after.
- Open: 12 sampled graves (Epicea 8, Cormopedrid 4) stand on a regional road
  that crosses the churchyard, so the GG-584 rule keeps their stones off it
  (GG-615). Some streets near squares step more than 1 in 8 where the pad
  steps little: bridge deck ends and other later bake shaping (Borieborum),
  and natural hillside streets (Hafting). Not checked in a rendered 3D view
  (free memory under 6 GB).

## Town perimeter and skyline rendering

The streamed wall mesh has closed sides, top, footing, and gate-end faces.
It is 2.4 meters thick and rises 4.8 meters above its sampled ground, with
another 0.4 meters buried. Stone images use world-aligned physical texture
coordinates and shallow bump relief. The existing open runs preserve gate gaps.

The ground postprocessing chain composites clouds before applying final SMAA,
with composer multisampling disabled so foliage color and depth coverage agree.
Clouds render without temporal upscaling to retain thin foreground silhouettes.

## Purpose

The Town Map domain covers deterministic town and village exploration surfaces, including generated layouts, local movement, building interaction entry points, merchant access, and town-scoped rendering helpers.

## The renderer moved; the state did not

Corrected 2026-08-05. This doc named three rendering surfaces that no longer
exist:

- `Town/TownCanvas.tsx`
- `Town/VillageScene.tsx`
- `hooks/useTownController.ts`

Worldforge replaced them. A town now draws through
`src/components/Worldforge/TownPlanView.tsx` in 2D and through the ground bake
in 3D, from ONE canonical plan per (atlas, burg).

Generation and state were not retired with the renderer, and that split is the
useful fact here. `townReducer.ts` and `types/town.ts` are still live.

RETIRED 2026-09-14 (Agora task `agora-e840.5`). The RealmSmith 2D painter stack
is gone. `src/services/RealmSmithAssetPainter.ts`,
`src/services/RealmSmithTownGenerator.ts` and `src/services/realmsmith/` were
deleted. They had zero importers. Three parts were salvaged into
`src/rendering2d/`: the doodad glyphs, the biome palette, and the night light
pool. `src/types/realmsmith.ts` stays, because `types/town.ts` and
`utils/spatial/walkabilityUtils.ts` still use it.
The four generator files (`BuildingGenerator.ts`, `DoodadGenerator.ts`,
`RoadGenerator.ts`, `TerrainGenerator.ts`) had no importer either. They were
deleted 2026-09-23 with `realmsmithBiomes.ts` and `constants/realmsmith.ts`
(ruling Q9, Agora task `agora-e840.7`). The salvage review
`docs/architecture/REALMSMITH_GENERATOR_SALVAGE.md` kept no code. Every
mention of `RealmSmithTownGenerator` or `AssetPainter` below is history.

The 2026-09-20 pass removed those names from every current-state section. They
now appear only in this history block, in the "Retired Names" list and in
"Historical Drift Corrected". Those three places record what the old surfaces
did; nothing below describes a live surface by a retired name.

## Verified Current Entry Points

Each path below resolves in the worktree as of 2026-10-16:
- `src/components/Worldforge/TownPlanView.tsx`
- `src/state/reducers/townReducer.ts`
- `src/types/town.ts`
- `src/types/realmsmith.ts`

## Current Domain Shape

The domain has ONE 2D town render surface: `TownPlanView.tsx`. In 3D a town
draws through the ground bake. Both read ONE canonical plan per (atlas, burg).

State and types are separate from the renderer and outlived it:
- `src/state/reducers/townReducer.ts`
- `src/types/town.ts`
- `src/types/realmsmith.ts`, still imported by `types/town.ts` and
  `src/utils/spatial/walkabilityUtils.ts`

The six orphaned RealmSmith generator files were deleted 2026-09-23 (ruling Q9,
Agora task `agora-e840.7`). Their names are under "Retired Names". Prose comments
in `src/systems/worldforge/props/placementEngine.ts`,
`src/systems/worldforge/town/farmCrops.ts` and
`src/systems/worldforge/town/population.ts` record behavior ported out of them
and mark each file "retired 2026-09-23". Do not read those comments as live
wiring.

## Retired Names

These names appear in the history sections above and in older docs. None of
them resolves in the worktree. Do not treat any of them as current:
- `Town/TownCanvas.tsx` - renderer, replaced by Worldforge
- `Town/VillageScene.tsx` - renderer, replaced by Worldforge
- `hooks/useTownController.ts` - controller hook, went with the renderer
- `src/services/RealmSmithTownGenerator.ts` - deleted 2026-09-14, `agora-e840.5`
- `src/services/RealmSmithAssetPainter.ts` - deleted 2026-09-14, `agora-e840.5`
- `src/services/realmsmith/` - deleted 2026-09-14, `agora-e840.5`
- `src/services/BuildingGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/DoodadGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/RoadGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/TerrainGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/data/realmsmithBiomes.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/constants/realmsmith.ts` - deleted 2026-09-23, `agora-e840.7`

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it claimed a lowercase `src/services/realmsmith/**/*.ts` ownership lane; that
  directory was deleted on 2026-09-14
- it described the renderer as TownCanvas plus AssetPainter; both are gone and the
  surface is `TownPlanView.tsx`
- it named `src/components/Trade/__tests__/MerchantModal.test.tsx` as absent. That
  file DOES exist in the worktree; the 2026-09-20 pass checked it. The "not present"
  claim was itself the drift.
- the 2026-09-20/2026-09-23 text claimed `TownPlanView.tsx` did not present pan
  or zoom controls and that no test covered pan. Source inspection on 2026-10-16
  (`agora-4fa0.70`) confirmed that `TownPlanView.tsx` implements pointer-drag
  pan and native non-passive wheel zoom and that `TownPlanView.test.tsx` covers
  a pan-drag lifecycle regression.

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- Town generation remains deterministic from seed and world-position inputs.
- Town navigation should continue to respect walkability and building collision.
- Town rendering, merchant entry, and NPC-click handling can live here without making the town domain the owner of all inventory, dialogue, or combat systems.
- Broader claims like town never triggers combat directly or exit points always return to the correct submap tile should be documented carefully unless they are explicitly verified in code.

## What Is Materially Implemented

This pass verified that the town-map domain has:
- a live Worldforge 2D town surface, `TownPlanView.tsx`, which computes a
  fit-to-view base transform and handles interactive pointer-drag pan
  (`onMouseDown`, `onMouseMove`, `onMouseUp`, `onMouseLeave` updating
  `viewTransform`) and native non-passive wheel zoom around the cursor
  (`addEventListener('wheel', handleWheel, { passive: false })`). This source
  reconciliation does not claim rendered visual acceptance.
- a 3D town through the ground bake, from the same canonical plan
- a town reducer and a town type lane, both still live
- `src/types/realmsmith.ts`, kept because live modules still import it

Claims this pass could NOT verify, because the surfaces that carried them were
deleted: merchant-entry actions from town and village buildings, NPC and
ambient-life interaction hooks, and in-town character movement/navigation
controls. The 2D Worldforge view provides viewport pan and wheel zoom, not
local character traversal or building/NPC interaction hooks. Treat those
character movement, merchant-entry, and NPC hooks as open work, not as shipped.

## Verified Test Surface

Verified tests in this pass:
- `src/components/Worldforge/__tests__/TownPlanView.test.tsx` (includes the
  pointer-drag pan regression `'survives a pan drag that ends before the final move (no null drag-ref crash)'`)
- `src/components/Worldforge/__tests__/TownAgentSnapshotView.test.tsx`

The four retired tests this section used to name covered the old `TownCanvas`
pan/dev controls, character navigation, and `useTownController.ts`. All four
went with the renderer they tested. While `TownPlanView.test.tsx` covers 2D
viewport pan-drag lifecycle in `TownPlanView.tsx`, no replacement test covers
in-town character navigation or the retired controller hook today.
- `src/services/__tests__/strongholdService.test.ts`
- `src/components/Trade/__tests__/MerchantModal.test.tsx`

## Open Follow-Through Questions

- Which surface should carry in-town character movement and navigation now that `useTownController.ts` is gone (while `TownPlanView.tsx` handles 2D viewport pan and wheel zoom)?
- Where should building-interaction and merchant-entry rules be documented: here, or in the dialogue, trade, or inventory docs?
- What replaces the NPC and ambient-life interaction hooks that went with the old canvas?


## Source-bound shelf display

The production interior bridge carries a shelf's own manifest into its render part through optional shelfDisplay metadata. It uses containerManifests with the same per-plot interior seed stream as townBuildingVisit. Home and workplace containers keep distinct streams even when one household owns both. The metadata includes the ownerHomeId, original item IDs and quantities, and a front direction toward the nearest cell in the actual room.

ShelfDisplay renders an open frame inside the existing furnitureCatalog dimensions. The scene applies the same canonical depth reflection used for the part position. Structure, floor support, collision bounds and furnishing selection identity retain their existing authority. Clicking a visible prop bubbles to the whole shelf and uses the existing fresh same-room/floor reach check. Examination continues to show exact stock and existing catalog descriptions; transfer requires its separate permission path.

Current household goods have simple catalog-ID silhouettes for books, coins, pottery, jugs, candles, provisions, folded cloth and tools. Six bays hold three bulky goods or twelve stacked coins per bay. The current counting-room reserve fixture of twenty silver pieces, ten gold pieces and six ledgers fits within those bounds. Future larger stock is visually bounded at eighteen bulky goods or seventy-two coins, and unknown IDs receive no invented substitute; examination retains all source rows and quantities. Geometry is merged into at most three content material groups plus the wooden frame, memoized while source data is stable and disposed on unmount. Stored candle bundles stay unlit. Verification covers five shelf-model cases and 63 unchanged bridge cases (68 distinct checks), with five scoped source/test paths typechecked; the reserve correction rechecked the model and its test. The larger reserve is model-tested, while the played two-coin shelf retains its geometry.

The saved Menaikon shopfront review verifies two ledger books and two gold pieces, ordinary book selection and exact manual reload continuity. A camera-only household model review verifies three pots and five jugs while the body stays at the shopfront. Other item silhouettes have bounds coverage. These checks establish this display path while broader furniture use, household permission, town appearance and performance remain open.


## Saved life history and present-day residents

Verified: 2026-10-28 (92 distinct focused cases across nine suites, 24 scoped source/test paths; actual desktop life refusal, same-context native full reload and 19 exact saved groups).

The town worker receives saved life facts and the calendar day alongside building history. Its street roster and named interior packets omit people whose matched canonical life has ended or has not yet begun. Both read the existing agentLife adapter. The town's genealogy, chronicle, belongings, businesses and NPC memory remain saved. A death does not assign a relative the deceased person's job. Trade and borrowed-workbench admission use the same life-aware businessAttendance check, including transactions from an already-open merchant window. Existing lodgingKeeperOnDuty still needs the same qualification; this wave does not establish inn service admission.

New TownSim registrations copy householdMemberId from each existing roster row without changing its numeric occupantId. Legacy records lack that provenance. A legacy match requires one exact name in the same canonical home in both the saved candidates and current household; duplicate matches stay unresolved. Stable saved household keys take precedence even when names or homes change. Numeric insertion slots alone are unsafe: in Sana's retained Menaikon visit Roban Westsmith is saved as395/home151/deceased day-253, while today's roster gives b151:head405 and saved405 belongs to Oswin Thornhall/home149. The current original household separately differs from old simulated ages, ancestry and child coverage. This repair does not rewrite those source facts or invent missing life records.

Family biography retains known deceased relatives with isAlive false, and current profiles label matched deceased members. Household prompts retain these relationships without claiming those relatives are alive. Untracked people retain existing behavior and are not qualified as confirmed living people. Ambiguous legacy bodies remain distinct; keeper contact and service are unavailable with an unverified-identity explanation. Death and future birth are different states. The town-plan inspector reads the same saved life input, filters current floor-plan markers and disables unavailable keeper actions. Its dispatch path rechecks contact rather than trusting an old enabled button. Minimal worker dependency facts exclude wealth, news and clock seconds so ordinary movement and conversation do not rebuild the world. A calendar-day or life-fact change can rebuild the projection. The larger connected-routine, succession, privacy, newborn-placement and age/ancestry reconciliation work remains open.


Actual Sana desktop inspection of plot156 marks Roban Westsmith and Edith Ashbourne deceased, removes Roban’s current marker and shows the no-successor refusal with Talk/Browse disabled. Normal Save at17:05:20, native full document reload, explicit manual Load and normal resave17:08:26 preserve19 present groups exactly, including67 complete NPC records, business stock, TownSim, memory and actual feet. The clock advances186 seconds. The first cold reload completes after its60-second observation at74.2315s; the second warm document reaches the menu at7.175s. These are bounded development-preview observations, not a loading or frame-rate acceptance claim. Dark public interiors, inward camera retraction, physical bench refusal, living home/work routes and the larger daily-life experience remain open.

## Player camera clearance and sloping entries

The player camera retains its requested arm length while the existing rendered
obstruction query retracts it. Clearance restores distance gradually at3m/s
along the same heading. An observed orbit zoom takes precedence; pan-away and
other framing retain their existing paths. This avoids retaining a wall's
temporary clamp as the player's zoom choice. Seven focused cases and two scoped
paths pass. Actual street orbit retracts to0.734m then returns to6.173m without
another To Player command; broader interior camera fit remains open.

Door admission and walking remain independent. Opening a door within reach
does not establish a passable threshold. The derived entry leaf and added beam
now read the same storey-aware head height as the canonical structural opening.
This preserves the seven-foot wall void instead of placing a second beam at
2.1 m. Structural walls, floor, doorway width and terrain remain intact.

The avatar measures standing height from its assembled visible meshes, including
held gear and excluding its projected shadow. Measurement precedes gait and
includes mounted ancestor transforms. Empty or missing anatomy stays unknown;
legacy movement callers retain the 1.9 m default. Building/deck headroom uses
that height through the existing single-budget walking path. Horizontal width
is still the 0.6 m proxy. Mouth immersion and water permission remain separate.

Actual normal weapon put-away and morning walking reach Fenna123's floor;
same-room Talk and an owned torch purchase are played. Walking around the open
leaf reaches the counter examination through existing physical admission; no
reach rule changes. Two native interior reloads preserve nineteen checked state
groups exactly, and repeat contact retains a single direct meeting fact.
Universal anatomy, broader furnishing services, camera fit and connected daily
routines remain open.
The living Gameplay Flow [tracker](../../projects/gameplay-flow/TRACKER.md#fenna-source-doorway-clearance-and-physical-shop-service)
owns exact gameplay, save/reload receipts and remaining acceptance.


## Resident label ownership

The ground loader carries bake-hour roster markers separately from live resident
body packets. World3DNameplates leaves a markerOnly wf-occ settlement/roster ID
to the live resident layer when that matching packet is loaded. This prevents a
static working nameplate from coexisting with the person's live body label or
remaining at work after OUT ownership. Missing packets and older packets without
settlement provenance retain their existing fallback. Display names never match
people across settlements. No actor, schedule or saved identity changes here.
Actual Fenna runtime proves one visible body and two producers before repair,
then one live label after source refresh. Ten focused cases and two scoped types
pass. Street name/selection continuity and connected route quality remain separate
open work; removing a stale marker does not prove a completed daily routine.


The later Fenna closing pass observes the indoor endpoints, plus one rendered
Dwarf instance matching her projected street point although both indoor packets
specify Human. The complete crossing is unqualified. At that earlier source epoch, routing
anchors also differed from the actual rendered shop/home leaf centers by2.386m
and0.769m. GroundWorld carries explicit front-door offsets, but siteGeometry
then omitted them from ChunkSite. These exposed projection/route seams; the source candidate below addresses them;
do not move source geometry or rewrite person identities to conceal them.
The normal closed-home frontage checkpoint passes nineteen exact native reload
groups, including memory and TownSim doors. This is save continuity, not proof of
universal live-body visibility: the near-body selector can omit a known household
member from the outdoor camera view. The Gameplay Flow tracker owns these exact
receipts and the remaining physical route, privacy and daily-life acceptance.


### Source-owned street and entry handoff

Verified: 2026-10-29 (focused source checks, first actual morning route and native
nineteen-group browser reload; corrected home eligibility and evening handoff
observed, with rendered road footing still unqualified).

residentDoorRoutes derives endpoints from fitted ground-level source leaves and
builds a fresh existing street graph. The same graph measures arrival delays.
siteGeometry carries explicit offsets into ChunkSite, including zero values.
The town plan, road geometry, fitted walls, source people and saved identities
are not rewritten. The loaded home/shop endpoint discrepancies are now below
7e-11m in read-only runtime inspection, rather than the earlier0.769m/2.386m.

InteriorOccupants retains the same close personal actor across room and street
ownership using the existing street sampler. Settlement plus household member
is the join; roster ID and full name guard against stale or successor packets.
GroundAgents suppresses the corresponding generic proxy while that personal body
owns a budget slot. Known distant proxies use packet ancestry instead of rerolling
it. The cap remains ten, with existing18/24m admission/retention. An absent body
outside this selected cohort is not evidence of a missing source resident.

residentDoorUse reads only exact matched source residents and their existing
entry movements. Indoor entry requests use the actor's measured arrival/departure
windows; a nearby chore leg cannot operate the frontage just because the next
hour is OUT. Street requests use the existing commute's source/destination.
Only the matching actual ground entry and a same-floor nearby moving body qualify.
World3DScene unions these transient keys with player-saved opens, using the same
effective set for the rendered leaf and player collider. It never removes a
saved player open or writes new TownSim permission. BuildingDoor gives a resident
crossing right of way rather than toggling the separately saved player state.
After Load, the transient state is re-derived from the normal clock and schedule.

The first morning run tracks one Human model/mesh recipe through nineteen street
points and into the work station. The real home leaf opens and closes, but a
chore-user false positive prompted the corrected window above. Its red regression
and all33 affected resident cases pass. The later day 7 morning observes Fenna/
Ysolde then Fenna alone, with no chore-moving child operating the home door.
The shop leaf was not mounted in that first camera range. This is not acceptance
of whole-course collision-aware resident walking: indoor legs remain straight,
and walls, stairs, furniture, crowding and private entry still need actual play.

Normal later public walking re-enters the shop and admits physical Meet/Talk.
The refreshed native19-group reload preserves source memory, resources, doors,
businesses and exact feet. The shared tracker now contains the detailed receipt.
The later day 7 runtime observes corrected home users (Fenna/Ysolde, then Fenna
alone), with no chore child admitted. A complete visible door/collision route is
still unqualified. The subsequent actual evening return records one personal
Human model, the shop/home door handoffs and matching captured leaf/PlayerAvatar
open sets. The inspected street frames expose road-buried legs; no complete
physical-route acceptance follows. The native evening browser reload retains
19 PRESENT groups and both saved door maps exactly. The tracker owns the bounded
115/79-sample receipt and same-save road-candidate next action.
Finer ordinary waiting uses the existing rest flow; its canonical mechanics home
is [Rest and recovery](rest-and-recovery.md). The actual 23-hour-13-minute and
14-minute waits preserve HP, inventory, gold and memory while retaining native
daily world changes. These are time-action checks, separate from reload parity.

### Street support and the open inn threshold

Verified: 2026-10-29 (same-save private paving, normal street walking, actual open
inn entry refusal and nineteen-group native browser reload).

The opt-in canonical detail renderer follows the admitted feet: same-point road
discrepancy falls from43–44cm to6.5mm, with source height retained. This is a
near-player render qualification, not default adoption, distant actor coverage
or performance acceptance. Shared-load movement RAF p95 remains200ms.

The source inn33 leaf opens normally and both walking consumers receive that
open key, but the actual public approach stops at the raised foundation. The
basement wall ends230.59mm above the stopped feet; the floor slab is higher.
The220mm walking step rule and actual standing height are unchanged. A real
entry support connection is the next experiment, using existing tread/landing
SiteParts and the common walking solver. Foundation removal in a diagnostic
clone is only cause isolation; no source wall, floor or terrain is removed.

Native browser reload retains19 PRESENT groups including the player-opened door.
Two same-name legacy Tomas Woodwick records at home158 remain unresolved, so
keeper services stay unavailable rather than choosing a person without evidence.
The Gameplay Flow tracker owns the precise receipt and physical replay gates.


## Street crowd: errands, departures and outdoor drawing

Verified: 2026-11-02 (unit tests; Node probes of the seed-42 demo town and of
Borieborum, burg 702 at world 903674813; headless World3D demo shots and frame
counts). Work, street joins and errand slots (GG-600, GG-601) were checked
the same day with unit tests and Node probes of both towns.

The street crowd (`GroundAgents`) draws only people who are outside a
building. `townMotionSnapshotAt` marks them `outdoors`: a walker, a person at
an errand place, or an OUT person with no errand place. A person at home,
asleep or at work is inside and is not drawn. Before this, everyone whose room
packet was not loaded stood at their front door at every hour.

Errands. `occupantLocationAt` gives each non-worker one OUT block a day and
still reports the home plot for it, so interiors and businesses read OUT as
"not in the house". `roster/errands.ts` `errandPlotFor(graph, occupant)`
picks the public plot (market, workshop, temple or civic) that the person walks
to. It reads only the street graph (`PlotEntrance.role`) and the occupant, so
the crowd, the room arrival gate and any other holder of the same graph agree.
Children favor the market and civic plots, adults the market, elders the
market and the temple. The choice is among the 8 nearest places of the chosen
role within about 400 m. `townSnapshot.occupantStopAt` swaps the OUT block to
that plot. `recentCommute(occupant, hour, graph)` sees errand legs only when
it gets the graph. `residentDoorUse` gets the town's graph from
`groundAgentMotion.streetGraphForTown`, the same object the crowd walks, so a
resident opens their own door to leave for an errand and to come back.

Work (GG-600). The town engine links every home to its work
(`population.assignWorkplaces`): the home that runs a workplace, a home whose
breadwinner is staff at a near workplace, or a labor home.
`roster/employment.ts` reads those links into `Occupant.employment`
(`{plotId, role}`) once the roster ids are fixed. The head works where the
link says; in a family business the spouse and adult kin help there; a lodger
and a spare roster slot take day labor. Children, servants, retired people
and the spouse and kin of a staff or labor home do not work. Day labor goes to
the nearest heavy-work building with room (storehouse, granary, mill, bakery,
workshop, smithy, the keep, then shops and inns as porters). `workPlotId`
still marks only the business keeper, because merchant ids, the owner's name,
stock and shop succession join on it. `occupantWorkPlotId` returns
`workPlotId`, then the civic duty, then `employment`. Every new worker is away
from their house packet during the day shift, so the street walk and the room
agree. Staff are not drawn inside their workplace yet (its room packet admits
only the keeper), and a staff or labor job is never baked as a static figure.
Borieborum: 1,017 of 3,524 people work (70 before), and 906 different people
walk from 07:00 to 09:00. Demo town: 600 of 2,109 (53 before).

Route search (GG-605). Verified: 2026-11-02 (route parity probe of both
towns and a unit test). The router takes its next node from a binary heap
ordered by distance, then node id, which is the tie rule of the old full scan,
so every route is the same as before. One search per start node is kept per
graph (up to 512) and resumed for later goals. A route endpoint finds its
entrance in a 1 ft grid of entrance centroids and doors. The burg 3 capital
(1,733 buildings) spends 4.3 s in resident door routes, 97 s before.

Street joins and door steps (GG-601). `buildStreetGraph` joins a street that
ends on another street's span (`joinStreetEnds`, within 2 ft): it splits that
span at the dead end. Before this the seed-42 town had 13 unjoined lanes, and
838 of its 3,886 legs fell back to a straight line through the buildings. A
door never moves (interiors are fitted to it), but its street point may: when
the square step to the nearest street would cut another plot, or go back into
its own plot past its first 6 ft, the router takes the nearest clear point
within 40 ft more, including points that slide along the nearest street. A
door with no clear point keeps the step that crosses least; deep-block row
houses with no clear way to a street are GG-604.

Departures. A household leg leaves 0 to 39 minutes after the hour
(`legDepartureDelayHours`, a hash of person and hour). Until then the person
is still inside. `commuteArrivalDelayAtHour` adds the wait to the walk, so a
room claims a body only after both.

At the place. `errandSpotFor` puts the person on the street side of the
door, short of the street center, so a group never meets the group across the
street. The zone runs up to 26 ft along the street each way, and short of
half the gap to the nearest other errand place. Every caller that has the
roster calls `registerErrandGroups` first (the crowd pass and the bake's
`residentDoorRoutes`). Each person then takes the lowest slot that is free
when they arrive, and the slots fill a grid 2.5 ft apart from the door outward.
So two people at one place at one time never share a point. A caller with no
roster keeps a stable hash point. The group faces the middle of the zone.
Pairs closer than 0.5 m at 13:00: demo town 0 (49 before), Borieborum 0
(136 before).

Speed and smoothness. The 3D crowd walks everyone at 1.2 m/s
(`measuredWalk`). The 2D agent preview keeps its half-hour legs for people
with no household id. The game clock moves in whole game seconds, so
`crowdRenderClock.ts` runs a drawing clock between the ticks, never past the
next one. Two crowd passes 0.3 game seconds apart bracket that clock, and
walkers glide between them every frame. Per person, the stop table, routes,
leg times and errand spots are cached on the graph.

Detail limits. At most 900 figures within 320 m of the camera are drawn,
nearest first, with 256 per pose bucket. An empty bucket is hidden.

Activities. A person at an errand place talks (`Idle_Talking`, 6 frames) or
listens (`Idle_FoldArms`, 3 frames); about 60% talk. The frames come from the
entity generator's clip system (`public/anim/humanoid/human-base-animations.glb`,
loaded once) through `bakeCrowdClipFrames`, which freezes clip poses of the
skinned body and moves each part with the bone under its anchor. These frames
use the skinned body; the idle and walk frames use the segment body. Indoor
activities (eating, sleeping, a smith at work) and stall keepers in the market
square are not drawn yet.

## Physical contact with a current street resident

Verified: 2026-10-29 (47 affected checks in two suites, five scoped paths,
actual desktop household first and returning conversations; final reload receipt
is recorded in the Gameplay Flow tracker).

InteriorOccupants admits a current OUT body only when its existing live street
sampler supplies finite coordinates and the mounted personal actor is visible.
The stable household member and original source building still own identity.
Its primary body pointer and native name button share the same live reader.
Absent routes and hidden placeholders remain unavailable. Existing personal
body ownership, shared refs, ten-person budget, hysteresis and schedules stay
intact. This is contact admission, not a new commute or collision solver.

World3DWrapper supplies current source ground and saved door state at selection
and again at Talk. groundResidentInteraction retains source-member, finite
position, same-level and 2.5 m reach checks. A street body additionally requires
an unobstructed native walking path, so closed walls and doors cannot grant
remote conversation. Indoor room/floor admission is unchanged. The conservative
check uses the walking solver's default standing height and saved player doors;
independent qualification against resident-only transient door opens and mounted
bridge walking surfaces remains open. No geometry or person is moved by a pick.

New physical NPC registration passes the current TownSim life record and actual
game day into the existing household reconciler, matching normal arrival/load.
This makes living/deceased relative status present from first contact instead
of requiring a later load to add it. It does not rewrite existing NPCs, invent
family, reset memory or grant adventuring skills. The founding biography/body
and current-life presentation remain separate and still need visual alignment.

Actual house 55 contact follows ordinary streets and the real opened door from
shop 123. Lys Ashdown identifies as retired and recognizes the return visit.
Faelan Ironsmith's reached street body admits Meet/Talk, first-contact recall,
the current priest introduction and spouse Sten. Sten's reciprocal family reply
then follows a short normal keyboard approach in the hall. Temple services,
personal duties, family help, quests and recruitment are not established by
these factual encounters. The close room view still has crowding, dark walls,
camera obstruction and a toolbar overlapping a resident name. A hidden furnishing
intercepted an overhead street click; its physical room gate refused access.
These remain product gaps, not accepted presentation or furnishing use.


## A current priest at the main temple

Verified: 2026-10-29 (actual desktop temple and kitchen contact, separate nine-group/913-message and nine-group/916-message full reloads, repaired normal house admission and an independent kitchen floor ray).

institutionWorkplaceRoster projects the sole current living priest from saved succession onto the existing centrally selected temple. The physical bridge must qualify a real ground-floor public nave, entry and clear station beside the existing altar. Ambiguous identity, missing duty space, children, retired people and existing paid or home crafts retain prior assignments. civicWorkplace stays separate from workPlotId, preserving household NPC IDs, merchant identity, genealogy, biography and saved memory. Founding nearest-person selection is not rerun to replace the saved priest.

institutionOccupancyBuildings reuses the original home body packet at the qualified duty station from08:00 to18:00. Breakfast, supper and sleep remain at home. Existing residentDoorRoutes provides fitted door endpoints and measured travel delays; personal actor ownership joins home and work into one person. This adds no collision-aware indoor route, priest service, magic, adventuring skill or consent. World3DWrapper resolves the original household for identity and the current workplace blueprint for physical reach, then rereads the live pick at Talk.

Sana actually walks the public streets to source temple168, opens its real leaf from an admitted approach and enters the nave through normal keyboard movement. Faelan Ironsmith's reached altar body admits Meet/Talk, recognizes Sana, names Sten as spouse and confirms the prior meeting.70 NPCs remain, with one original direct first-meeting fact for Faelan. The post-conversation full document reload preserves all nine PRESENT groups and the913-message prefix exactly. The native resave clock changes18:05:26 to18:07:21; exact body position, identity and memory do not change. The earlier pre-walk reload separately preserves907 messages.

An ordinary175-minute Wait reaches17:58:33 without changing party, inventory, gold, NPC payloads or NPC memory and grants no recovery. By18:00:06 the same keyed personal actor is on the return street;18 subsequent seconds retain one UUID and progressing feet. The exact indoor departure was missed and the leaf remained player-opened. Autonomous door use and a complete collision-aware commute remain unproven.

Normal walking later returns Sana to the household. Faelan's meal body is admitted after a normal Town Cell/To Player camera reset; his kitchen requires its actual doorway rather than conversation through the hall wall. The rendered desktop profile measures760x646 at1440x900, with16px text, separate family/shared-address columns and no internal scroll. It retains priest/age86/Sten spouse/prior-meeting status. Four existing profile tests and both affected type paths pass0/0. The selected home Talk result was not captured before the browser runtime ended. Subsequent movement and unsaved conversation were not recovered; recovery uses the exact earlier913-message native export, not a new continuity proof.

### Nearby bodies must yield to a reached household

Before the camera reset, ten previously selected neighboring residents occupy the body budget while Faelan's actual supper packet exists but his body is absent. The reset restores his household at the exact same player feet, isolating selection rather than lost source data. Absolute previous-cohort priority is now replaced by visible-person priority and a one-meter retained-distance margin. Real moving people keep priority;18/24m entry/exit limits and the ten-body cap remain. Four new regressions run two red/two green before the fix, then all38 cases across the new and existing suites pass. Three scoped paths pass0/0. Only the selector and one obsolete absolute-retention assertion change; the Town owner's current floor/gait/contact suffix is byte-exact. Installed Chrome156 now completes an ordinary street/house approach without Town Cell or a camera reset. At18:22:41 Faelan is admitted among ten home bodies, replacing the retained neighboring cohort. His467.48470260825246/539.7989009283478 root is at3.9288164399052112, matching Sana's admitted floor height. The later kitchen contact and full reload are now qualified below.

Town owns the floor-support repair. Root independently qualifies Faelan at this kitchen station only: a separate downward ray against the matched mounted home54 building hits its upward floor surface at3.9288164369416685 while the actor root is3.9288164399052112 (gap2.96e-9m). This does not qualify temple support, stairs or every resident. Dark walls, crowded bodies, camera obstruction, first-cold-contact freshness refusal, meaningful priest help, personal story and recruitment stay open. Disposable receipts remain under .agent/scratch/gameplay-flow/replies/.

### Kitchen recognition survives a full reload

After the configuration owner releases SOURCESTABLE, normal Continue restores the earned18:23:40 save. Ordinary keyboard movement crosses the real kitchen opening to467.0960797549704/538.9181882718377/Y3.9288164399052112. A normal camera orbit brings the Meet label on screen; no pose setter, teleport, room bypass or saved-state patch is used. Actual Meet/Talk names Faelan, current age86 and priest role, recognizes Sana, names Sten as spouse and answers that they have met before. The760px desktop profile is rendered and inspected again. Crowded overlapping figures and camera-close framing remain visibly poor.

Normal Save, full document reload, Continue, To Player and native resave preserve all nine PRESENT groups exactly, including feet, roster, memory, household simulation and companions. All916 incoming log entries remain an exact prefix; the clock advances18:28:46 to18:29:32. Native actor remount and a second physical Meet/Talk again recognize the earlier contact.70 NPC records,75 memories and Faelan's one original direct first-meeting fact remain. Receipts are priest-budget-kitchen-reload-receipt.json, priest-budget-kitchen-floor-ray.json and the matching before/after native state/storage exports in ignored scratch. These are bounded continuity proofs, not acceptance of privacy, natural crowding, autonomous commuting or useful priest services.

### Activity stations stand on their source slabs

Verified: 2026-10-29 (59 affected resident/door/contact cases, two scoped paths,
actual inn33 visitor support and nineteen-group native full reload).

InteriorOccupants derives an immutable floor-level lookup from each streamed
site's actual floor boxes, ordered around the ground slab at base zero. A station
keeps its authored local X/Z and level, but its feet use the matching slab top.
The previous building-datum/nominal3m placement buried ground-floor feet121.92mm
and could disagree with upper/basement storey geometry. Furniture, ceilings and
entry treads are not room-floor substitutes. Absent source support retains the
legacy placement and remains unqualified. This changes station support, not
source identities, schedules, route X/Z, agency, body geometry or saved state.

Actual inn33 Perrin/Mirek retain their keys and X/Z; both roots equal the source
floor top4.566810010866708 before and after true browser reload/explicit manual
Load/resave. Nineteen present non-null native groups remain exact at1793259413485.
The legacy visitor packets do not prove linked households or autonomous routines.
Ground/upper/basement fixtures pass; temple and upper-floor physical traversal
are not accepted by this replay. Startup Ollama502s remain separate from rendering.

Current indoor motion still interpolates straight room legs and the street layer
still samples terrain. The corrected station height cannot certify a supported
doorway/stair handoff. A normal direct common-room stair approach stops; a
different direction is admitted by a read-only walking query. Next play the
actual circulation route and inspect source stairs, then integrate shared entry
support without actor lifts, removed walls or relaxed walking limits. Darkness,
body overlap, privacy and useful furnishing/service interactions remain open.


Historical configuration park: normal Save/MainMenu at18:23:40 retains915 messages,70 NPC records and75 memories at467.60947377027605/536.3270308856984/Y3.9288164399052112. Both native state and full browser storage are archived as priest-budget-config-park-*. Installed Chrome156 renders the real world and accepts normal movement; bundled headless shell1200 instead produced zero-FPS/capture timeouts, was backed up and closed normally. The runtime change preserves all nine protected groups. Subsequent ordinary walking changes playerGroundPos and the derived localeCoords within playerCell.cellId4337; the seven nonmovement groups and the earlier message prefix remain exact. This is separate from full-reload acceptance. That configuration window is now released. The newer qualified native kitchen resave is18:29:32, with its independent nine-group/916-prefix receipt above. No whole-loop acceptance follows.

Latest earned continuation after the qualified reload: actual paid-account discussion explicitly disclaims firsthand knowledge but mentions Senna as a prior source without corroborating memory. It establishes no new fact, route, quest or service. Normal Save18:33:02 has919 messages; the separately archived final Main Menu autosave18:33:33 has920 messages,70 NPC records and75 memories. Files priest-budget-final-park-state.json/storage.json preserve that exact newer checkpoint. The nine-group/916-prefix proof remains the earlier18:29:32 boundary. Next improve overlapping kitchen figures and close camera framing using existing source-bound station/capacity rules, then qualify useful priest help or a personal story.

## Supper uses connected common space

Verified: 2026-10-29 (30 affected cases across three suites, three scoped paths, actual1440x900 source-refresh render and nine-group/925-message native reload).

Existing activityPositions.placeActivityStations now gives standing adult meals a1.5ft radius and source-identified children the existing1ft radius. Native figures measured roughly0.50–1.37m wide; the former uniform two-foot center separation visibly interpenetrated them. Three-foot adult center separation is a bounded improvement, not a promise that every broad generated body clears every neighbor or wall. Chores, visitors and sleeping keep their existing activity rules. The occupancy caller passes existing member ages; all its prior schedule/bed/retirement/business code is byte-exact outside that one argument and the required dependency header.

Meals use the original table room first, then actual same-floor door-connected kitchen/hall/common-room/great-hall space. Real corridors connect those rooms but receive no dining stations. The search never crosses private rooms or exterior doors to claim capacity. Overflow retains a real table only when its new room has one; it otherwise uses a clear standing place in that common room. Adults reserve larger places before children fill smaller gaps. Household identity, all thirteen Menaikon home54 members, original meal hour, floor levels, furniture and blueprint stay unchanged. A genuine lack of space remains explicit as no-clear-space; no resident is hidden.

The first real-home regression fails before the repair. A uniform four-foot attempt leaves five Menaikon stations unsupported and also regresses a smaller household. Three-foot adult spacing, child sizing and corridor-connected overflow finish with30 passing cases: six activity-position cases, eight occupancy cases and sixteen bridge cases. Three scoped paths have zero errors or suppressed diagnostics. Two advisory headers update in one scoped pass; nine dependents are not written. The occupancy call write retries four times after a transient busy-file error; readback/inverse comparison confirms the intended single-argument change outside its header. Original test bytes remain an exact prefix.

Native source verification matters: a page reload on the old no-watch preview retains old transformed modules and unchanged positions. The owned preview is normally saved/parked, controlled-restarted, then checked to serve radiusFor before normal Continue. Actual fresh desktop rendering shows distinct new source positions and hall use. Full document reload/Continue/To Player/native resave preserves all nine PRESENT groups exactly and the complete925-message prefix,18:49:09 to18:51:42. No page errors occur. Physical Meet/Talk still recognizes Faelan and Sana; no substitute body or source person is introduced. The ten-body render cap remains separate from thirteen source station records.

Whole crowding acceptance remains OPEN. Fresh placement puts Rosa at467.23863341974567/538.9182322537218, only0.14255367156m from Sana's unchanged saved467.0960797549704/538.9181882718377 feet. Static station allocation has no player reservation or dynamic body avoidance. Camera-close views, body-specific arm/wall clearance, seated meals, safe actor-to-actor movement and full activity routes remain unqualified. Next reuse the existing standing-position and locomotion owners to reserve the player's accepted footprint and prevent interpenetration without moving saved feet, removing people, hiding bodies or relaxing building/water collision. Source and native receipts are priest-crowding-* under ignored scratch; the standard smoke image is main-menu-only and is not household acceptance.

Latest supper continuation: physical fresh-source Have we met before again answers yes. Normal Save18:54:53 and actual Main Menu autosave18:55:36 are newer than the qualified18:51:42 reload. The final park archive has933 messages,70 NPC records,75 memories and Faelan's one original first-meeting fact; priest-crowding-final-park-state.json/storage.json retain it. This later checkpoint is not a new nine-group comparison after conversation. The next integration points are residentBodyOwners in World3DScene/InteriorOccupants and the existing PlayerAvatar/resolveGroundWaterWalk movement owner. No actor collision code has been added yet; companion actor props and the new player-only refusal feedback must be preserved.

### Inn interior stairs refuse ordinary walking

Verified: 2026-10-29. Normal on-foot play reaches the low stair approach at
439.775612/445.651098/Y4.566810 in inn33, The Shadowed Sigils. A normal first-tread
attempt then refuses movement: all24 samples remain at that floor height. The
rendered refusal is inspected. This is physical stair failure, not an inference
from the earlier obstructed direct approach or invalid xM/zM helper call.

The canonical inn blueprint reproduces451 original structural shapes and all34
furnishing references, kinds, rooms and local positions. Its legacy flight has
eleven rises per3.048m storey:277mm risers and111mm going. The ordinary220mm step
limit and body remain unchanged. The existing return-stair renderer/planner is
the reuse target; current canonical and child-room-merge plans admit no layout.
An offline public-landing revision examines39 geometric layouts. All are rejected:
13 consume rooms,19 cannot preserve required doors,2 lose original furnishings,
2 reserve the street entry and3 lose assigned beds. A second scratch trial replaces
the furnishing recipe with all34 exact original objects, retaining the existing
fitter's dimensions, margins and800mm walking width. Its39 layouts also admit
none: the five layouts surviving room/door/entry checks all lose assigned beds.
No revised architecture is promoted. Guest bed1:5:12, owned containers, sleeper assignments and entry identity
must survive any later candidate; a populated replacement room is insufficient.

Latest earned normal Save1793262569798/day7 19:39:05 retains the stair-base feet
439.795438/445.688443/Y4.566810. The game is in the normal Long Rest modal with no
wait/rest submitted. Subsequent true document reload, explicit latest manual
Load, rendered inspection and normal resave1793266024168/day7 19:40:10 preserve all19
PRESENT non-null groups exactly, including the same feet and both saved doors.
Both visible visitor roots still match the slab with zero gap. No page errors;
the old preview's four Ollama502 startup errors remain separately recorded.
Current native/storage archives and continuation guide now point to
inn33-stair-base-reloaded-* in ignored scratch. No clock, pose, door,
resident or inventory state was injected.

Next leave the inn normally and continue supported public-interior gameplay.
The two failed preservation trials change task order, not acceptance: first
qualify a preservation-aware architectural fit before any structural adoption,
with Sana normally saved at a safe public approach. Then replay actual stairs
and save/full-reload continuity. Do not raise the
step limit, shrink bodies or aisles, remove barriers, lift actors, lose beds or
invent access to private rooms. Connected resident indoor/street routes, useful
services, privacy, meals, sleep, lighting and crowding remain open in GF-G23/GF-G60.
The complete town-community goal remains ACTIVE.

Ignored evidence: inn33-first-tread-ordinary-attempt.json/png (image inspected),
inn33-low-end-ordinary-route.json, inn33-canonical-stair-diagnosis.json,
inn33-return-stair-circulation-trial.json, inn33-retained-object-stair-trial.json
inn33-stair-base-true-reload.json, inn33-stair-base-after-true-reload.png (inspected)
and inn33-stair-base-reloaded-native.json
with matching storage. These are bounded gameplay/diagnosis receipts, not stair
or whole-community acceptance.

Normal reverse walking now reaches the common-room aisle, centers through the
retained open entry, and descends its real treads to the street. The first short
center approach reaches its time bound; a subsequent ordinary continuation reaches
the street. Both attempts are retained. Rendered exit is inspected. Normal
Save1793266348080/day7 19:43:19 records443.224644/451.335775/Y3.839758 with unchanged
inventory, gold and people. This movement/save is separate from the qualified
stair-base full reload; no later street reload is claimed. The public Town Plan
shows library31 with two furnished studies and librarian Rosa Colewick's family;
ambiguous child records stay explicitly unverified. Physical library entry and
use remain unplayed. Next follow the public streets to a supported public
interior while retaining the preservation-aware stair redesign as open work.

## Visible actor separation and yielding

Verified: 2026-10-29 (68 affected cases in five suites; the full ten-path type wave and later posed-bound/matrix repairs are scoped clean. Final physical acceptance remains pending).

The ground scene owns one transient map of mounted body footprints. PlayerAvatar and party actors publish their actual reached feet and measured horizontal envelope; the existing resident body publishes the same source identity and visible pose. Hidden/unmounted actors remove their footprint. Nothing enters NPC memory, worker packets or saved population data. The turn-based overlay retains its existing movement/collision authority.

The existing geometry/water resolver admits movement before a swept actor test may shorten it. The shortened endpoint is resolved for support again. Full-segment tests prevent tunneling; an idle accepted player never moves, and an existing overlap permits escape rather than crossing the other center. The original player-only blocked notice consumes the final refusal. Companion props, routes, camera behavior and the original geometry/water code remain. Nearby residents may take small support-checked yield steps within their own source floor and bounded station neighborhood, then return toward their task. Dry-only probes grant no new swimming, stair, door or privacy permission; full route behavior remains unqualified.

The initial native run preserves Sana feet467.0960797549704/538.9181882718377/Y3.9288164399052112 and one Rosa UUID while Rosa moves from the former0.142553m gap through0.382554m to0.839816m. That is a FAILED clearance check, not accepted separation: measured body envelopes still overlap. The primary journey naturally reaches19:04:04, is normally saved/parked with941 messages, and is archived as bodyspace-earned-evening-park-state.json/storage.json. Its browser is closed normally; no earlier fixture is promoted over this earned state.

Diagnosis exposes initial assembly/bind-pose width caching and world-axis facing inflation. New regressions reproduce both. Horizontal space now primes from the first posed body, samples a bounded grow-only envelope, and measures in the figure's own axes. A real attached Three.SkinnedMesh test also reproduces a translated binding error (225m reported instead of0.5385m); the radius helper refreshes ancestors followed by updateMatrixWorld so the skin bind inverse matches the renderer. The existing vertical/water anatomy snapshot remains unchanged. Five initial absent-behavior failures, a new-contact yielding failure and the later pose/facing/skin failures are preserved separately. All68 current affected cases pass.

The corrected-pose replay still fails native clearance: three samples at18:57:12–18:57:14 retain0.104549m envelope overlap while Sana stays at her original feet. A normal load of the preserved manual save reproduces a second stalled cluster at18:55:39. Read-only probes admit all16 sampled directions on the same dry floor; the actor solver returns the original point even without the indoor floor mask. The actual mounted crowd supplies a new failing regression: equal total-overlap scoring settles between already intersecting larger neighbors while still intersecting the player. Recovery now first reduces player/companion reservation overlap, then total existing crowd overlap; existing clear-neighbor barriers and geometry/support checks remain. All69 affected cases in five suites pass; the changed helper and regression pass scoped typechecking with zero errors or suppressed diagnostics. The fresh owned preview is replaying the same legitimate manual save. Physical clearance, normal approach/exit, contact and native reload remain pending. Earned19:04:04/941 stays protected separately; no earlier test copy is promoted. Receipts are bodyspace-native-yield-probe-diagnosis.json and bodyspace-crowd-priority-red/green.json in ignored scratch.

### Close player cameras preserve a readable room

Verified: 2026-10-29 (33 camera cases, three scoped paths, actual library repeat
entry/material restoration and nineteen-group post-examination native reload).

FreeRoamCameraController uses playerCameraSelfVisibility only while following
the accepted lead body. The helper measures visible body meshes, excluding the
projected shadow and hidden equipment. Within0.5m it clones only the lead's
materials to positive0.08 opacity;0.8m hysteresis prevents repeated switches.
Original material objects/arrays return on a clear view, pan, source appearance
replacement or unmount. Only owned clones are disposed. NPC/companion materials,
mesh visibility, physical geometry, actor-space bounds, camera position/heading
and structure queries retain their existing authority.

The named entity-ink shader has its ownuA alpha, so standard material opacity
alone leaves an opaque inverse hull. The helper reuses OUTLINE_MATERIAL_NAME and
adjusts only that cloned shader's alpha. Original uniforms and other custom-shader
contracts remain. Actual library entry first reproduces the solid-hull failure,
then the revision shows all26 meshes/six ink alphas at0.08. Normal deeper walking
restores all to1 on the same root and geometry identities. This qualifies the
observed WebGL close view, not every experimental renderer or room angle.

Library31/source plot30 opens through its real door and admits ordinary walking
onY2.844430. A reached same-room Shelf click opens its actual examination card,
showing two owned Clay Pots and no reading action. Normal post-examination Save,
true document reload, explicit manual Load and resave preserve19 PRESENT groups
and all948 messages at1793271756222/day7 20:29:17; the render is inspected. Contents
are not transferred and no knowledge is awarded. The existing READ_ITEM path
reads frozen inventory content through the broadsheet reader; it is not yet a
public library service. Preserve belongings, source IDs and access/attendance
when extending it. Lighting, useful library service and connected town life stay
open in [Gameplay Flow gaps](../../projects/gameplay-flow/GAPS.md).

## Evening household circulation

Verified: 2026-10-29.

Actual continuation from the earned19:05:11/941 park exposes a passage refusal. A first ordinary forward-diagonal burst moves0.281778m; a second moves only0.0000326m. The nearest mounted resident envelope is0.000641m away, and the original blocked-direction notice is visible. A normal sideways approach moves another0.600m, then renewed forward movement stalls after0.130945m and0.005796m. Building, floor and body geometry remain authoritative; no forced click, actor pose, clock or saved-state patch is used. Normal Save/MainMenu parks at19:09:36/943 with earned feet467.6289193349559/538.4882330273601/Y3.9288164399052112. Before-source state/storage and first/side/hall burst receipts are archived in ignored scratch.

This is the19:00 hearthside schedule, not the previously qualified18:00 meal. The source allocator packs all thirteen residents into one hearth room using two-foot center allowances, despite a second real hearth in a connected common room. A new actual-household regression reproduces the single-room allocation; a private/disconnected-room refusal case passes unchanged. The existing activity allocator now applies its adult three-foot/child two-foot gathering allowance and same-floor door-connected common-room overflow to hearthside gatherings as well as meals. It keeps the original hearth first, selects a real hearth when moving to another shared room, and never assigns gathering stations in a corridor or bedroom. Source people, activity hours, beds, jobs, furniture and blueprint remain. This is a stationary-capacity repair; safe complete routes, body-specific clearance and autonomous room-to-room travel still require native play.

All20 affected cases across three suites pass: eight activity-position cases (including two new evening regressions), eight occupancy cases and four existing body-budget cases. The two changed source/test paths typecheck with zero errors and zero suppressed diagnostics. The source diff preserves every pre-existing allocator branch outside shared-gathering allowances, connected-room selection and activity-appropriate furnishing targets. Source-fresh native replay remains pending. Source files: src/systems/worldforge/interior/activityPositions.ts and its existing activityPositions.test.ts. Evidence: hearth-capacity-red/green.json and hearth-circulation-before-source-state/storage.json under .agent/scratch/gameplay-flow/replies/.


The first hearth-capacity candidate is now loaded on a fresh owned preview. All nine PRESENT protected groups and944 incoming messages survive19:09:36→19:09:59 exactly, with no page errors. Parent viewed the1440×900 scene. Standard smoke initially times out at document readiness; after document200 and changed-module reachability are verified, the warm rerun succeeds and its main-menu-only image is viewed. This smoke is not household acceptance.

Native circulation is still not accepted. Direct front-door movement meets an interior wall: the actual kitchen-to-hall opening is at467.0335757626921/538.1843416916045, offset from the front door467.6811262587129/534.8386641286729. Normal alignment/backoff attempts also encounter a source child station on the kitchen approach. Read-only eight-direction probes distinguish geometry refusal from actor-disc refusal and show a free retreat direction; no pose is patched. Ordinary retreat succeeds, but subsequent attempts still stop at resident boundaries. Source-plan inspection and an added regression reproduce a gathering station only0.5ft from the actual doorway-to-shared-center approach where3ft is required by the existing adult gathering allowance. Evidence: hearth-circulation-direction-probes.json, hearth-source-door-waypoints.json, actual keyboard burst receipts and hearth-passage-red.json.

A revised stationary experiment reserves supported paths from real room door approaches into reached shared interior space. It reuses the allocator's existing furniture/stair-safe candidate grid and caches the search per plan/room; no route search runs on animation frames. Gathering stations must remain outside the passage allowance. The original household, blueprint, actor movement and geometry remain. Capacity/regression results and a new fresh-source native circulation replay are pending; an actual shortage must remain explicit rather than assigning private rooms, suppressing people or shrinking clearance. Normal Save/MainMenu before this revision parks19:17:19 with earned feet468.03945494011845/538.7882787901286/Y3.9288164399052112. The saved manual has944 messages; the later native autosave is authoritative for continuation.


The supported-passage reservation experiment is rejected after its bounded test. It leaves four of the thirteen Menaikon residents without a clear station at18/19 and regresses the smaller Sypege plot1 supper. The run records four failing activity-position cases and thirteen passing cases overall; hearth-passage-candidate.json and hearth-passage-rejected-source/tests.txt preserve the attempt. The checked source and test are restored byte-for-byte to the preceding20-case green/two-path clean-type candidate; the rejected passage reservation is not applied. No clearance is reduced, private room admitted, person removed or geometry changed to force capacity. The current source therefore improves evening common-room use, while complete passage clearance remains unqualified.

Next investigate a feasible combination of source room capacity, actual body envelopes, household gathering routines and routes before another passage experiment. A same-floor standing-only crowd may exceed the space left after a usable passage is reserved. This is a measured capacity warning for the current approach, not proof that the household, building or all possible layouts are impossible. Reuse the existing blueprint/household/room-route owners; protect earned feet and source identities before any structural or routine change.


Final normal Save/full-document reload/Continue/resave preserves all nine PRESENT protected groups exactly and all945 incoming messages as an exact prefix,19:17:19→19:17:31, with no page errors. The actual1440×900 reload render is parent-viewed. Normal Main Menu parks19:18:04/946 at earned feet468.03945494011845/538.7882787901286/Y3.9288164399052112. The rejected passage source is not applied; the preceding20-case green evening allocator remains. Proof: hearth-final-native-reload-receipt.json and hearth-final-park-state/storage.json. Complete circulation remains OPEN. Tracker/GF-G21 now record both the prior local actor-space proof and this current evening capacity limitation.


## Measured body shapes and room passage

Verified: 2026-10-29.

The earned19:18:04/946 continuation supplies a read-only native body-envelope survey: ten mounted residents plus Sana are measured; the source household still has thirteen people. The three unmounted residents are not declared clear or removed. Lys Blackcroft's current Tiefling figure measures about0.896m wide and1.202m deep while its foot-centered circumcircle has diameter about2.118m. The full asymmetric bounds include the tail; nobody's body is resized. Sixteen actual dry geometry-approved step directions are recorded. Two are refused by circles while a swept comparison against all eleven mounted full oriented boxes finds no box contact. This identifies empty circular margins as one circulation obstruction, without proving that all stations or routes fit. Receipts: circulation-live-body-envelope-survey.json and circulation-obb-feasibility-input/result.json in ignored scratch.

The existing actor-space owner now accepts optional measured body-axis bounds and facing alongside the unchanged radius. A continuous separating-axis sweep checks the full translated box, including asymmetric offsets; unmeasured/invalid shapes retain the circle compatibility path. Yielding scores measured overlap, keeps previously clear people protected and carries the existing player comfort margin into box checks. A bounded conservative turn check refuses to swing anatomy or gear through a neighbor, including intermediate angles when both endpoint poses are clear. An obstructed turn holds the prior facing while translation may sidestep. Player and resident owners publish accepted facing with reached feet. The separate standing-height/water anatomy function, building/water solvers, camera and companion route callbacks, source identities and saved population data retain their owners. Profiles are transient and do not enter saves.

Nine new baseline regressions fail against the old circle-only behavior while all twenty earlier helper cases pass. The final affected run passes80 cases across five suites: nineteen actor-space, eleven measurement, twelve Avatar, thirty-four interior-owner and four body-budget cases. This includes the exact recorded kitchen refusal, asymmetric tail, true sweep, facing, intermediate-only turn contact and actual Avatar integration. Eight changed source/test paths typecheck with zero in-scope errors; one diagnostic in an imported file is suppressed. A later two-path actor check has zero in-scope errors and the same one imported suppression. This is not a repository-wide type-clean claim. The dependency-header wave and source-fresh native replay are pending. The earned journey is normally parked19:23:10/947 at unchanged468.03945494011845/538.7882787901286/Y3.9288164399052112 before source adoption.

Full animated-body clearance, body-specific wall/doorway fit, complete circulation and all thirteen residents' physical placement remain unqualified. Periodically retained standing envelopes and the source box sweep do not establish continuous gait or every rotation/route in the world. The next proof is ordinary movement through the actual kitchen doorway and hall on a coherent owned preview, followed by native contact and save/reload continuity. The prior capacity-losing aisle prototype remains rejected and unapplied.


The measured-shape header wave completes with two source headers updated, three already current and three test files outside the dependency graph; six other dependents remain unwritten. Fresh-source normal Continue preserves nine PRESENT protected groups exactly and all947 incoming messages as a prefix,19:23:10→19:23:30, without page errors. Ordinary keyboard play crosses the kitchen threshold at19:31:10 and reaches the hall at19:33:33. These are real accepted feet on the existing floor, not pose injection. The exterior approach remains blocked by actual resident bounds. Native probes show no player-body overlap at the sampled stop. The threshold render also exposes poor close camera framing behind a resident; camera ownership is separate and no camera acceptance follows from passage progress. Receipts: obb-fresh-source-load-receipt.json, obb-actual-kitchen-door-bursts.json, obb-hall-to-entry-bursts.json and obb-hall-direction-probes.json in ignored scratch.

A native eleven-body hallway survey finds pressured lodgers1/2 beside physically clear lodger0, who receives no pressure under the prior player-only comfort policy. Lodger3 similarly borders unpressured lodger4. This establishes missing propagation as a candidate obstruction, not proof of an unobstructed floor route. The actor-space owner now builds transient courtesy reservations: the existing player/companion0.2m margin remains, and only residents actively yielding or returning from a yield ask neighbors for0.1m. Yield scoring uses these reservations while a separate physical-body map protects every previously clear neighbor from new contact. Static residents send no new pressure. Existing geometry/floor probes, drift limits, source identities, body sizes, mounting cap and circle fallback remain.

Four new helper regressions fail against the missing API, then all23 helper cases pass. They cover a constrained-lane chain, stationary unpressured neighbors, preventing a new physical intersection inside soft comfort overlap, and the exact recorded hall neighbor arrangement. The affected measurement/Avatar/interior suites also pass57 cases, plus four body-budget cases:84 distinct checks overall. Three changed paths typecheck with zero in-scope errors and zero imported suppressions after removing a diagnostic-only radius field from the recorded fixture. The scoped header pass reports two current headers, one test outside the graph and seven dependent paths deliberately unwritten. Standard-client1440×900 main-menu smoke passes and its rendered image is inspected; this is not gameplay acceptance.

Normal Save/Main Menu preserves the earned hall feet467.44910625494174/537.5862630068004/Y3.9288164399052112 at19:52:45 with948 messages before courtesy adoption. A full-document reload/Continue on the coherent owned3034 preview stops at the main menu with the actual page error 'makeCellLocationId is not defined'. The arrival-path owner is notified; root does not alter that peer-owned source, retry an unchanged graph, inject state or revert the earned journey. Courtesy behavior in the room, exterior passage, final contact and save/reload verification remain PENDING until the shared load error is repaired. The broad gameplay goal remains active.


The arrival-path owner confirms the transient missing-name error was repaired before their final stable graph. After one controlled refresh of root's own preview, the true full-document Continue succeeds: all nine PRESENT protected groups remain exact and all948 messages remain an exact prefix,19:52:45→19:53:28, with no new error stacks. The fresh1440×900 town and player-focused renders are inspected. Ordinary movement advances from hall467.449106/537.586263 to467.882303/536.044367 without a sampled player overlap; the next direct approach is refused by actual head/lodger bounds. A diagonal detour toward a body-clear point instead slides along geometry to467.734117/536.085051. This does not establish complete exit passage or continuous all-body clearance. Read-only actual geometry probes are next; no pose, floor, clock or NPC identity is patched. Receipts: courtesy-fresh-load-receipt.json, courtesy-entry-first/next/third-bursts.json, courtesy-hall-body-survey.json and courtesy-clear-side-bursts.json. The shared-load dependency is resolved, while full circulation and final earned-progress reload remain open.


The final nearby-solid diagnostic identifies only the actual open front-entry leaf beside the blocked approach. Its canonical source door is0:2:x:-0.7620:-3.0480; the open geometry is retained. Ordinary east-then-north movement rounds its end to467.961802/535.739646, then a west/north attempt reaches467.9017568361772/535.6942449220479 before actual head/lodger2 contact refuses further advance. Sampled player overlap remains false. This is an approximately1.9m northward hall advance, not exterior passage or an all-pair clearance claim. The next diagnosis should inspect those neighbors' geometry-admitted yielding routes and room capacity before another source experiment.

Normal Save/MainMenu20:03:27/949 followed by full-document reload/Continue20:03:49 preserves every one of nine PRESENT protected groups exactly and all949 incoming messages as an exact prefix, with no new page errors. The parent inspects the actual1440x900 reload scene. Eleven mounted body profiles include Sana; sampled player overlap is false, with four residents signaling yielding. All thirteen source people remain; the three unmounted bodies and continuous gait/all-pair clearance are not qualified. Final normal resave/Main Menu parks20:04:32/950 at the same earned feet. Receipts: courtesy-nearby-solid-parts.json, courtesy-open-leaf-bypass-bursts.json, courtesy-leaf-inner-return-bursts.json, courtesy-final-native-reload-receipt.json and courtesy-final-park-state/storage.json. Tracker's measured-body/courtesy section and onlyGF-G21 now carry the bounded proof; prior Tracker prefix and all other gap rows are inverse-byte-exact. The complete gameplay goal remains active.


## Bounded detours for a resident beside the entrance

Verified: 2026-10-29. Complete circulation remains OPEN.

The earned20:04:32/950 continuation is resumed normally. Return initially uses the town-wide camera, so a player-only actor map is rejected as evidence of a clear room. Normal To Player mounts eleven profiles before diagnosis. The source head is roughly0.52m from the scheduled hearthside station, against the actual front wall. Northward geometry probes admit no step; inward directions meet Sana. Several physically clear side steps slightly worsen the0.2m player comfort score, so the existing greedy resolver waits. Lodger2 has moved behind Sana and is not the same forward barrier after this fresh load. These observations distinguish an actual local-score limitation from absent bodies or proof that no room route exists.

Ordinary lateral keyboard play reaches468.5203999464489/535.7890197405629/Y3.9288164399052112 without a sampled player overlap. A read-only route search at the resulting actual arrangement finds a six-step head sidestep through the current source floor and full measured body admission:65 expanded nodes, no bound hit,266.9ms for that diagnostic. No actor is moved by the search. This is local route feasibility with eleven mounted profiles, not a game-frame benchmark, all-thirteen capacity or exterior acceptance. Normal Save/MainMenu protects20:15:16/952 before source adoption. Proof: entrance-yield-feasibility.json, entrance-yield-route-feasibility.json and entrance-right-side-bursts.json in ignored scratch.

The existing yielding owner now accepts transient route state only for the mounted resident. Greedy recovery remains first; a blocked person overlapping player/companion comfort may search a detour in two-node increments per call, with128 total nodes and twelve0.12m planning steps maximum. Soft comfort may temporarily worsen along a detour; the target remains the existing player/companion reservation, and every planned/followed segment rechecks physical bodies and the existing dry source-floor geometry. Cached routes cannot authorize a new physical contact or replace support. Source position/floor/goal changes discard stale routes, closed geometry is rechecked, visibility loss drops state, and facing is held while following the measured sidestep. Failed bounded searches wait and later reconsider; they do not hide people, reduce bodies, change geometry or prove global impossibility. The tactical tile pathfinder was inspected; its5ft combat-grid movement does not represent this live body/source-solid query, so the existing actor owner remains the implementation home.

Six new behavioral cases cover the initially flat comfort score, per-call probe bound, a neighbor entering a retained route, absent/different-floor support, source-owner relocation and newly closed geometry. The first four produce three real movement failures and twenty-four passes against the previous helper. The affected final run passes90 cases across five suites; three changed source/test paths typecheck with zero errors and zero imported suppressions. A dependency-header pass reads the actor helper current and the test outside the graph, but encounters a transient UNKNOWN open failure on the owned InteriorOccupants file. Its subsequent read succeeds and its full intended body is byte-exact; a bounded retry of only that failed header is pending. Source-fresh native following, exterior passage, contact and final earned-progress reload remain PENDING while the shared wrapper owner completes a coherent source boundary. The prior950/949 reload proof remains historical; it is not detour acceptance.


The detour candidate gains an original-floor anchor so several small supported rises cannot accumulate into another storey. Its final helper run passes30cases; with the unchanged61other integration cases the affected union is91distinct cases. The final three-path scoped check has zero errors and zero suppressed imported diagnostics. The failed-only header retry succeeds and updates the Interior LFheader; the final three-file wave then reports two headers current, the test outside the graph and eight dependent paths deliberately unwritten. Standard-client1440x900 main-menu smoke completes and is viewed. This is separate from household acceptance.

After Town's12212/12217stable-wrapper boundary, only root's stopped preview is refreshed. Full-document Continue from20:15:16 to20:15:35 keeps nine PRESENT protected groups exactly and all952 messages as an exact prefix, with no new page errors. A diagnostic reader initially cannot find its renderer module in the capped Resource Timing list; the actual served Interior import identifies the existing module URL, and the corrected read-only reader sees eleven profiles and no player overlap. This diagnostic error is not a game load failure. The head is now beside the opening, and the existing transient detour state is present. Ordinary northwest movement advances about0.65m to468.0588924560576/535.3275122501718/Y3.9288164399052112. The same head UUID remains while its accepted feet move; the final sampled player overlap is false. Before/after snapshots do not qualify every followed waypoint or continuous all-body clearance. The head still occupies the entrance and complete exit passage is not achieved.

The user's new planning-view direction takes priority before a further gameplay source experiment. Normal Save/MainMenu parks20:20:40/952 at those earned feet, with state/storage archived as entrance-route-integration-pivot-state/storage.json. Current direction is to expose the same derived project view through Agora or Planmap while canonical records retain authority. Companion already owns the shared Planmap adapter, Travel owns the future workflow instruction update, and root performs read-only desktop qualification without duplicating their UI. Root filed WF-G367 for the independently observed Agora gap-index rejection of this project's legacy four-column tables; that intake repair remains separate. Native exterior/contact/final earned-progress reload for the detour remains OPEN. Receipts: entrance-route-fresh-load-receipt.json and entrance-route-native-first-bursts.json. No actor pose, geometry, clock or identity is patched.


### Public library chronicle reading

The physical furnishing reader offers Read town chronicle at a civic library's
study desk. libraryReadingAccess uses the canonical plan and actual reached
body, keeper life/occupation/work shift, and the existing source resident's
door-arrival ownership. It does not assign a household member to serve or take
owned container contents. The wrapper rechecks current ground/history, town
identity and real town news before using the existing Broadsheet modal.

SET_BROADSHEET_VISIBLE accepts an optional readingPlace with source burgId and
townName. Only a matching current town uses that name and Library reading copy
label; ordinary live openings, closing and READ_ITEM clear the context. Frozen
owned books retain their original content/name. This is presentation, not a
second chronicle, purchased object or permission record. The wrapper's existing
commitment guard also blocks walking behind the open reader.

The first native desk reading is played and inspected, but exposes the old
retail label and hidden S-key movement. Both are retained as failures. Four
regressions first fail, then40 affected cases/five suites and10 scoped paths
pass; a final9 mounted cases pass after a missing town-name guard. Corrected
source manual reload preserves20 present groups/all982 messages exactly.
Corrected reading-copy/keyboard/post-use reload gameplay is still pending.
Current earned source profile is parked at day8 08:32:51; owned shelf pots and
all source identities remain. The complete town-life goal is open.


## Front entrance standing targets

The front entrance remains the next physical circulation check. A standing target beside the door's hinge can satisfy the old radial gap while occupying the opening. The allocator now reserves the canonical three-foot entry width and inward leaf approach, expanded by the existing activity allowance. Only tagged entries receive this rule. Internal doors retain their prior policy; legacy tagged entries without a swing direction reserve both approach sides. Furniture, plans, people, bed assignments and age-sized standing allowances stay unchanged. This reserves stationary space; it does not establish a walking route or full body clearance against walls.

An isolated experiment using the actual occupancy owner checks the thirteen-person Menaikon home and three smaller homes across all 24 hours. No standing issues occur, the evening roster remains complete, and plans and households remain exact. The crowded home's head target moves from (13.5, 2.5) to (13.5, 4.5) feet. Baseline tests expose the real front-entry failure and both side-entry directions. The final affected run passes 25 cases across three suites; both scoped source/test paths typecheck with zero errors and zero suppressed imported diagnostics. One scoped dependency-header wave updates the LF allocator header, skips the test outside the graph and leaves two dependents unwritten.

Normal Save/Main Menu parks the earned game at 20:27:52 with 952 messages and the prior reached feet (468.0588924560576, 535.3275122501718, Y3.9288164399052112). Native adoption is pending a coherent boundary from the concurrent world-rendering owner. Actual front-door exit, body contact, source-floor support and a final earned-progress full reload remain unqualified. No clock, position, roster or geometry is patched. Ignored receipts: entry-station-feasibility.json, entry-station-baseline-red.json, entry-station-focused-checks.json and entry-station-before-state.json under .agent/scratch/gameplay-flow/replies/.


The wider capacity check changes this decision. Of 48 additional real building samples, 47 have households and one is skipped. Nine households gain no-clear-space stations under the entry reservation; burg10/plot20 regresses from zero to ten across its day. All plans and households stay exact, so this is an allocation regression rather than lost source data. The candidate is rejected for adoption. Both owned source/test files are restored byte-for-byte to their pre-experiment contents; candidate source, tests and the 47-home results remain in ignored scratch. The four-home experiment and 25 passing cases did not establish general capacity. No native load adopts the candidate. Next inspect constrained-room packing and find entrance-safe placement without losing residents; keep the earned952 save parked. Receipt: entry-station-wider-capacity.json and entry-station-10-20-layout.json.


A second isolated experiment distinguishes greedy packing from candidate admission. With unchanged entry exclusion, body allowances, room connectivity, furniture and source plans, a most-constrained-first bounded search places all five residents in burg10/plot20 and all thirteen in the reached burg675/plot54. The five-person case uses five search nodes; three children fit in staggered kitchen rows after both adults are placed. This proves usable capacity for these cases, not a production route or general solution. Across the nine regressed homes at20:00, only10/10 and10/20 fully solve. Three homes have an empty candidate set, two exhaust this finite candidate graph, and two hit the10,000-node bound. Restricting the diagnostic to previously placed residents leaves the same two solved homes. A model failure is not proof of physical impossibility: source geometry, the one-foot candidate lattice, whole-cell stair/landing exclusions and activity-room admission still need comparison. Do not ship a packing-only fix, shrink body allowances, remove people or enlarge the saved world to make this result pass. Next audit a zero-candidate resident against the actual room/door/stair geometry, then revise the existing admission/allocation owner with broader capacity and native proof. Receipts: entry-station-packing-feasibility.json, entry-station-packing-regressions.json and entry-station-packing-prior-valid.json. The rejected source/test remain restored and native952 remains parked. The parent also renders the shared Planmap rejection card at1440px and closes only its QA context; the actual game remains Main Menu20:27:52.


## Library reading replay qualified; click priority remains open

Verified: 2026-10-29. The corrected library desk reader is now used in actual
play. The Menaikon Chronicle shows Day 8 / Library reading copy and real burg675
news without a retail price. While it is open, normal S, W and D holds leave the
same live Three player root, body position and native feet exactly stationary.
Normal Close clears the reading context; an ordinary S hold then walks about
0.754m. No item, household goods, quest result or source person is granted.

After the earned aisle approach, normal Save/full document reload/explicit
manual Load/resave retains all20 PRESENT non-null groups and all985 messages
exactly. The rebuilt library is rendered and inspected. The120s avatar-label
observation times out before the same page naturally finishes rebuilding;
there is no restart, rollback or browser error. This does not qualify cold-load
latency or the dark, crowded room. Latest qualified archive is
library31-post-use-loaded-native/storage.json, stamp1793281119553, day8 08:51:41,
feet494.512219/465.555034/Y2.844430; normal Main Menu parks the same session.
One ration, one water,20.75GP and9HP remain. Earlier pending-reading statements
describe the earlier source-only epoch, not this completed reading replay.

Actual interaction failures remain. A fresh Desk click opens its card but also
walks about1.018m. A later Examine shelf hint instead opens Rosa's resident card;
no post-reading pot verification is claimed. Read-only ray measurement confirms
the invisible movement plane at distance2.934/Y3.95985 is nearer than the desk
at3.8379/Y3.50251, with actual terrain at5.379/Y2.72251. The existing ground
gesture begins before the desk stops pointer-down propagation. A narrow source
candidate now yields ground input to another public R3F event intersection in
front of actual terrain;21 affected tests pass. Source types/header verification
and actual updated-runtime replay remain pending at this receipt. No Scene,
actor, geometry, source identities or ownership rule is changed.

The shared derived view is verified inside Planmap at
/Aralia/planmap/index.html?view=project-progress&focus=town-community-focus.
The exact3017 entry works at1440px and fresh focused1024px, Back/reopen works,
and four canonical record links serve exact source bodies. Companion's single
adapter, Travel's workflow instructions and Combat's saved URL are reused.
Canonical records retain authority; the ignored cache is presentation only.

Proof in ignored .agent/scratch/gameplay-flow/towns/: library31-fixed-reader-actual,
library31-fixed-reader-keyboard-proof, library31-fixed-reader-walking-restored,
library31-post-use-reload-proof, library31-post-use-loaded.png,
library31-shelf-timeout-current.png and library31-desk-ray-diagnosis.json.
GF-G23/GF-G60 and the complete connected-community goal remain OPEN. Next qualify
the click-priority repair on the physical desk, recheck owned pots through a
correct target, preserve earned progress through another full reload, then
follow source home/work routines and useful representative services.


The restored source and original tests now pass all20 cases across the same three affected suites. Both owned files remain byte-for-byte exact to their pre-experiment content. The three empty candidate sets are burg10/plots7 and15, and burg675/plot21. Each has a10-by-10-foot common room, a bed, a legacy stair cell and a hearth or barrel. Every previous adult point is beside the entry (x6.5–8.5, y2.5–3.5 feet). The renderer uses a4-foot compact stair inside that5-foot cell; its half-foot edge does not establish reclaimed adult standing capacity. Furnishing approaches reserve1.5feet inward from the doorway, while the rejected standing experiment reserves3feet plus the existing activity allowance. These owners have different clearance contracts. This is a source comparison, not rendered physical-impossibility proof. Before changing geometry or adopting a new rule, reconcile placement, passage and capacity against actual bodies and retain all residents. Receipts: entry-station-zero-candidates.json, entry-station-geometry-owner-audit.json and entry-station-restored-checks.json. The same native browser is verified at Main Menu with20:27:52/952; no candidate has been adopted.


## Capacity-preserving entry relocation

The rejected hard exclusion remains archived. A revised entry improvement first keeps the existing valid allocation, then tries to relocate only residents whose stationary targets obstruct a tagged entry. A replacement must clear the canonical opening/inward approach and every retained neighbor at the existing activity allowance, on the same permitted floor and activity-room set. If no such replacement exists, the existing resident stays placed; this preserves people while the upstream layout conflict remains explicit. No body allowance, room, stair, furniture, identity or schedule is reduced or removed. This improves usable entrances where capacity exists; it does not qualify cramped layouts as fixed.

The isolated47-household/all24-hour comparison adds no standing issues and loses no previously valid station; source plans and households remain exact. The reached thirteen-person household keeps all other gathering targets while its evening head target changes from(13.5,2.5) to(13.5,11.5)feet. The longer relocation is a new source stationary target, not proof of a lived commute. Four-home/all-day entry checks pass. The previous source first fails four real entry cases while13 pass; the revised affected run passes29 cases across three suites, including the47-household regression and three cramped-home preservation cases. Scoped types, header maintenance and source-fresh native passage/contact/floor/full-reload proof are pending at this record. The actual browser remains Main Menu20:27:52/952 at unchanged earned feet. Earlier20 restored-source checks pass separately. Native adoption will not be claimed from these allocator tests.


The revised source passes both scoped paths with zero errors and zero suppressed imported diagnostics. Its single scoped header wave reports the allocator current, the test outside the graph and two dependents deliberately unwritten. The first standard1440x900 client times out during the cold load. The actual saved-game page then reaches Main Menu, and an HTTP200 JavaScript read confirms the new allocation and relocation functions; comments are stripped by Vite, so a comment-string reader was not a valid version check. One warm standard-client rerun completes and its main-menu image is inspected. This is separate from gameplay acceptance.

The source-fresh actual game resumes at unchanged earned feet and20:28:41 with no page errors. The mounted head is now at468.9179477061621/538.1325376518329 on the same source floor, clear of the entry. Normal walking reaches the real open doorway, exits to467.25530321733675/533.0683355038999/Y4.103228084178134, returns through that opening and reaches468.17929545937716/536.0214617408844/Y3.9288164399052112 inside. Before/after mounted samples report no player–NPC physical overlap. These samples do not prove continuous all-pair or anatomy-versus-wall clearance; the existing static-world proxy is unchanged. The source household retains13 people and the mounted sample has11 profiles including the player. The roster cap is unchanged; no all13-rendered claim is made.

Normal Save/Main Menu parks20:37:13/953. All seven non-position protected groups remain exact against the original20:27:52 pre-walk save, including NPC records and memory. A true full document reload, normal Continue/To Player and resave at20:38:23 preserve all nine PRESENT protected groups exactly and the complete953-message prefix. No page errors occur. An independent downward query excludes player/resident/companion geometry: the upward-facing site floor is at3.9288164369416685 under accepted feet3.9288164399052112, a2.96e-9m gap. A separate invisible input plane sits about3.1cm higher; it is not misreported as floor support. This qualifies the final sampled standing floor, not the full route. Final normal Save/Main Menu retains20:39:49/954 at those earned inside feet, with original identities and prior archives preserved.

The entrance repair is now played in both directions, but complete circulation is open. One further interior approach stops against another resident. Close camera obstruction still clips the building and can push an actual meeting nameplate outside the viewport; ordinary orbit changes presentation without moving feet. No new NPC contact, role, memory answer or story is claimed from that failed presentation attempt. All earlier factual NPC memory remains exact. The three10ft common-room conflicts and the fourteen sampled households with pre-existing standing issues still need upstream layout/admission work. Next inspect the close-camera and physical nameplate presentation against actual measured geometry, then qualify returning contact naturally; retain the broader capacity defects rather than declaring the town complete.

Ignored proof: entry-relocation-source-checks.json, entry-station-relocation-capacity.json, entry-relocation-first-door-steps.json, entry-relocation-exit-steps.json, entry-relocation-street-steps.json, entry-relocation-return-door-steps.json, entry-relocation-return-inside-steps.json, entry-relocation-meeting-approach.json, entry-relocation-earned-reload-proof.json, entry-relocation-player-floor-ray.json and entry-relocation-final-park-state/storage.json under .agent/scratch/gameplay-flow/replies/.


## Library click priority verified in actual play

Verified: 2026-10-29. GroundMovePlane now yields both pointer-down and release to
another interactive event object in front of the actual terrain ray. The flat
input plane can be above a desk on sloping ground, so its nearer hit cannot own
that desk click. Existing gesture cancellation, actual terrain conversion and
collision movement remain. The observed library ray measures2.934m to the input
plane,3.838m to the desk and5.379m to terrain. No actor, building geometry, owned
goods or source identity changes. Twenty-one focused cases pass; three changed
paths typecheck with zero errors/suppressed diagnostics. Two headers remain
current; one test is outside the graph and one Scene dependent is not written.

Actual fresh Desk hover/click opens the correct card while four settled live
body/root/native-feet samples stay exact. The named chronicle remains a Library
reading copy without a price; held D stays stationary and Close works. A fresh
visible Shelf hover/click opens its own card with the same two owned clay pots,
without moving or transferring goods. This does not retrospectively resolve
the earlier Shelf hint/Rosa card overlap at another view. A floor click starts
movement but stops after0.02m on collision; arrival is not qualified. Ordinary
WASD then reaches the previously inspected aisle. Normal Save/full document
reload/explicit manual Load/resave retains20 PRESENT groups and986 messages
exactly, with rendered remount inspected and no page/console errors. Exact
receipts live under .agent/scratch/gameplay-flow/towns/library-click-priority-*.
This qualifies the desk click repair and the played library interactions;
connected routines, general crowding/clearance and daylight lighting remain open.


The same allocator also serves civic work, so the unchanged final source is checked against institutionOccupancy.test.ts. All nine cases pass, including the actual saved Menaikon main-temple blueprint, retained person/body identity, entry admission and street ownership until arrival. These are separate from the29 housing/body cases: the distinct focused union is38 cases across four suites. This does not establish a complete autonomous commute or new priest service. The parent also inspects the final native receipt through the normal1440px embedded Planmap view; the whole saved game remains exact across that read-only QA and its context is closed. The source release, native954 park and remaining camera/nameplate/layout work are unchanged. Receipts: entry-relocation-milestone.json and entry-relocation-final-planmap-qa.json.


## Measured meeting labels and walking camera projection

At the retained earned feet, an ordinary orbit shows the spouse body at1.68027m tall. The fixed2.15m label anchor projects to y−96px; its actual button is above the viewport at y−104px. A same-pose projection at measured height plus0.15m instead falls at y60.6px. The structure sightline is clear and the arm is1.18845m in that observation. This separates the excessive label anchor from physical wall admission. Another issue is independent: the scene keeps near1m/far60000m while the camera owner permits a legal sub-meter arm; an actual0.82m arm fixture clips a half-meter-away point outside the frustum. Source geometry and body clearance are not changed to repair projection.

The candidate uses the existing resident body callback to place its label0.15m above measured height, retaining2.15m only while measurement is absent or invalid. Html exposes a DOM ref; a typecheck catches the initial ref mismatch and the final code uses its actual Three-group onUpdate hook. Presence, range/source admission and native pointer handling remain owned by the existing interaction code. The existing camera visibility owner temporarily scales the player-follow near plane to the actual arm, with a0.05m floor and the source near plane as ceiling. It keeps far depth and pose, restores source projection for overview/panning/unmount, and preserves a later owner. No parallel camera, body reduction, wall fade or input bypass is added.

The baseline has five real failures and ten passes. The final focused union is73 cases across six suites; after the Html hook correction49 cases pass, and after the adaptive-plane refinement the affected22-camera subset passes. These overlap and are not summed. All five changed paths typecheck with zero errors and zero suppressed imported diagnostics; the final three camera paths repeat cleanly after the refinement. One five-path header wave reports three source headers current, two tests outside the graph and eight dependents deliberately unwritten. Native appearance, physical returning contact and final progress reload remain PENDING at this receipt. Normal Save/Main Menu parks20:46:49/954 at unchanged earned feet468.17929545937716/536.0214617408844/Y3.9288164399052112; all nine protected groups are exact against the prior954 park.

Ignored proof: npc-label-baseline-initial.json, npc-label-baseline-orbit.json/png, npc-label-source-checks.json and npc-label-before-adoption-state/storage.json under .agent/scratch/gameplay-flow/replies/.


The refreshed saved-game page serves all three new source modules as HTTP200 JavaScript. The standard1440x900 client completes and its image is inspected; no browser-error artifact is produced. Actual Continue/To Player retains earned feet. The Html anchor is measured at about1.83038m for the spouse, and the live follow camera uses an adaptive near plane (about0.24703m in the normal2.47032m arm) with far60000m unchanged. An ordinary orbit can still move the person and label out of frame; a normal To Player reframe provides a visible, enabled name chip. This is a qualified interaction view, not every-angle camera acceptance.

Normal Meet opens Faelan Ironsmith's desktop two-column profile at the reached house. It shows age86, town role priest and spouse Sten, age81; founding household records remain separately labeled. Normal Talk recognizes the earlier conversation. The direct replies confirm the prior meeting, state both household duty and priest role, and name Sten as spouse. Settled profile and reply images are inspected. The initial profile image preceded the React commit and is not used as rendered profile proof. No forced click, injected actor pose or clock, identity substitution or provider change is used. The observed POST-request list stays empty.

The source-fresh adoption Save20:51:16 preserves all nine PRESENT groups exactly against the20:46:49 pre-adoption save and the complete954-message prefix. Across actual contact, all eight non-memory protected groups remain exact and feet do not move. All75 NPC memories retain every prior known fact and interaction array exactly; only Faelan's last-interaction and discussed-topic timestamps change. The original first-meeting fact remains byte-exact with exactly one player_met_npc fact. This proves first-contact preservation and factual returning contact; it does not prove rich conversation history or personal quests.

After the real questions, normal Save/Main Menu20:58:29/957, true full document reload, normal Continue/To Player and resave20:58:44 preserve all nine PRESENT groups exactly and all957 prior messages as an exact prefix, with no page errors. A normal Town Cell switch restores near1m/far60000m; To Player restores the adaptive follow plane. Reopening the physical profile after reload still shows prior contact without moving the player. Final normal Save/Main Menu21:04:29/958 keeps the same earned feet468.17929545937716/536.0214617408844/Y3.9288164399052112, and all nine groups still match the post-reload save. Earlier archives remain preserved.

A byte-inverse preservation audit confirms all previous camera/controller and actor code outside the intended projection/label changes is exact; Controller CRLF and actor/helper LF stay intact. Source motion, clearances, schedules and geometry are not rewritten. The73-case source result, five clean scoped paths and header receipt remain the bounded verification scope. Whole-room camera composition, continuous physical clearance, pre-existing cramped layouts and complete job/home routes remain open.

The next memory iteration should extend existing owners rather than build a parallel store. The live identity/family questions leave NPC interaction arrays unchanged. Source dialogueService attaches durable NpcDialoguePublication metadata only to household_work; useDialogueSystem stores the direct last response and discussed-topic date for other personal replies. Trace the existing systems/social/npcDialogueMemory contract and last-response reducer before deciding how new identity/family statements should enter dated NPC recall. Preserve existing facts and never backfill old display-only speech as new memories. Rich personal stories, useful services and willing recruitment remain open.

Ignored proof: npc-label-adopted-initial.png, npc-label-adopted-orbit.json/png, npc-label-normal-reframe.png, npc-label-cold-adoption-proof.json, npc-label-return-memory.txt/png, npc-label-family-reply.txt/png, npc-label-profile-settled.txt/png, npc-label-contact-proof.json, npc-label-earned-reload-proof.json, npc-label-modes-and-return-proof.json, npc-label-source-preservation.json and npc-label-final-park-state/storage.json under .agent/scratch/gameplay-flow/replies/.


## Library workplace handoff: source candidate, native replay pending

Verified: 2026-10-29. Source-authored library proprietors now use the same
derived civicWorkplace mechanism as the saved priest. institutionWorkplaceRoster
requires one reciprocal library/proprietor-home link, one matching adult head,
no existing trade or retirement, live-source eligibility and a qualified public
ground-floor study desk. The existing priest holder wins a responsibility conflict.
The librarian retains their original household/body packets; no replacement
worker, business ID, inventory, memory or geometry is generated. groundChunkLoader
qualifies the source blueprint before projection, then residentDoorRoutes supplies
the same measured street route and arrival delay to the interior owner.

This repairs a concrete ownership contradiction exposed in actual play: Rosa's
library packet worked08–17 while her street record was an unassigned resident.
At18:00 the observed body jumped32.71837952m to the real home door. The exact
captured source experiment reproduces that failure; the candidate changes only
her derived duty and yields1.199/1.2m boundary steps plus43.968s owed travel, with
all original inputs exact.63 affected cases/four suites and six scoped paths
pass. A six-file inverse audit preserves unrelated changes; the scoped header
wave leaves80 dependents unwritten. Repaired native routine replay remains
pending. Earlier library click/reading/owned-pot qualification remains separate;
the completed evening reload preserves20 PRESENT groups and1000-message prefix
plus2 inspected ambient messages. General physical route/floor support is not
inferred from this schedule projection. TRACKER carries the exact live receipt.


## Library workplace current-source adoption

Verified: 2026-10-29. Controlled OWN3015 source adoption is complete from the
earned evening, without an older-morning restore. Actual published ground now
contains the same Rosa209/b80:head with civicWorkplace librarian/library30. Her
original library work and home meal packets remain, with43.968011s arrival owed
at08:00 and18:00 respectively. No clock override is present. This verifies the
production projection and handoff fields, not a witnessed repaired commute.

Normal full document reload/explicit latest manual Load/resave preserves all20
PRESENT groups exactly and all1002 prior messages as an exact prefix plus4 new
messages. No page or console errors occur. The rendered frontage is inspected.
Latest manual1793287415949/day8 18:11:13 remains at490.630902/463.040291/Y2.754412,
with1ration/1water/20.75GP/9HP; normal Main Menu parks the same browser profile.
Own preview85152 replaces terminal13327; no peer preview is restarted. Earlier
source-adoption-next statements describe the previous checkpoint. Next resume
this earned evening, use normal rest/wait and public routes to approach a later
shift, then watch actual doors, street movement, body/floor support and arrival.
GF-G91 remains OPEN until that played route and earned-progress reload pass.
General indoor routes, stairs, crowded layouts and connected household routines
remain required. Proof: library-workplace-adopted-actual-fields.json,
library-workplace-source-adoption-proof.json and library-workplace-source-adopted.png
in ignored .agent/scratch/gameplay-flow/towns/.


## Delivered identity and family statements retain their own history

Verified: 2026-10-29. New factual introductions and family answers now enter the
existing per-NPC interactions array through SET_LAST_NPC_INTERACTION. The shared
npcPersonalStatements resolver supplies both the spoken words and the admitted
source snapshot. The reducer rechecks the active speaker, discussed topic, world
and saved life, exact words and current source before publishing display and
history together. Unresolved legacy family speech remains available but receives
no attributed publication. Authored overrides and work-report publication retain
their existing owners. No old last-response text is backfilled.

Identity and family recall topics quote the latest actually delivered statement
for that saved life. Later family deaths, office changes and work changes do not
rewrite the original words or date. Recall creates no new publication. Repeated
identical delivery retains the original interaction and date. Original known
facts, including first contact, are preserved. This provides conversation history;
full personal stories, household responsibilities and motivated recruitment remain open.

Source qualification:106 affected tests/four suites pass, including20 new
personal-history cases; six changed paths typecheck with zero in-scope or suppressed
errors. One scoped header wave updates three headers, leaves two current, skips
the test outside the graph and deliberately leaves10 dependents unwritten.
The reducer change outside prior source is only the publisher import/call rename;
the pre-existing hook test remains exact.

Native1440x900 Continue/To Player/physical Meet/Talk now delivers Faelan's priest
introduction and Sten spouse account, then both exact-word recall controls work.
Nine PRESENT protected groups remain exact across cold adoption. The two new
saved interactions carry canonical speaker life141 and spouse140, preserving the
original first-meeting fact. No provider POST or new page error occurs. Normal Save/Main Menu21:07:30/960, full document reload and normal Continue/
To Player preserve all nine PRESENT groups exactly and the entire960-message
prefix. Reopened physical Meet/Talk recalls the saved family words. Repeating
both original questions retains exactly two history records, including their
original dates, with one byte-exact first-meeting fact. Eight non-memory groups
and every other NPC memory remain exact; no provider POST or new page error is
observed. Final normal park21:08:50/962 retains the same earned feet
468.17929545937716/536.0214617408844/Y3.9288164399052112. The standard client also
passes in an isolated1440x900 empty context; its menu image and the actual reply/
recall images are inspected. Earlier save-success toast observation timed out;
the normal Save action is confirmed by the saved state and Game Saved! log entry.

Next inspect a useful continuation of this conversation: the current priest's
actual workplace/duty, reusing existing civicWorkplace and local-direction owners.
The present directions resolver only locates NPC-owned business plots, so public
office titles alone cannot establish a service, workplace direction or quest.
No services or personal stakes are inferred from the priest title. Proof remains
ignored under .agent/scratch/gameplay-flow/replies/: personal-memory-source-proof.json,
personal-memory-contact-proof.json, personal-memory-earned-reload-proof.json,
personal-memory-repeat-proof.json, personal-memory-final-park-state/storage.json
and the inspected delivery/recall PNGs.


Actual follow-up confirms the next useful-interaction gap: Faelan's normal
I need directions answer is only "You're in Menaikon." It names no temple or duty.
Source npcLocalDirections resolves owned business plots only, while the separate
institutionWorkplaceRoster already projects the admitted current priest onto the
qualified temple selected by institutionPlotForRole. Audit that existing join
before adding conversation guidance. No workplace presence, service, new route or
quest is implied by a title alone.

A fresh Continue initially places Faelan's chip above the viewport in a short
1.734m arm; arbitrary panning/rotation does not qualify contact. Normal Town Cell/
To Player and wheel input recover a visible chip at a measured2.347m arm, then
ordinary physical Meet/Talk delivers the town-only reply. This keeps every-angle
camera composition and crowded-room circulation open. Normal save/Main Menu now
parks21:13:13/963 at the same earned feet; both personal history records, all75
prior fact arrays and eight non-memory groups remain exact. No new page error or
provider POST occurs. Proof: personal-next-direction-contact-view.png,
personal-next-direction-normal-wide.png, personal-next-priest-directions.txt/png,
personal-next-priest-directions-proof.json and personal-next-priest-directions-park-state/storage.json
in the same ignored scratch directory. This963 park supersedes the earlier962
park for continuation; the962 memory milestone archives remain preserved.


## Town Day 9: earned morning and partial library arrival

Verified: 2026-10-29. Sana continued from the earned Day8 evening. Normal
three-hour Wait preserved all20 PRESENT protected groups and1006 prior messages
as an exact prefix. One eligible eight-hour Long Rest consumed the remaining
one ration and one water unit, added one journal entry, advanced the existing
town/business simulation and disposition decay, and reached Day9 05:12. Feet,
gold20.75, party, source identity, quests and Rosa's memory were preserved. No
supplies were granted. True full document reload/explicit latest manual Load
then preserved all20 PRESENT groups exactly; rendered morning was inspected
with no page or console errors. This is street rest, not a paid inn/bed claim.

Normal Wait then approached the next08:00 shift. A bounded read-only live watch
recorded339 samples from07:59:19 to08:01:57, maximum observation gap1326ms and
one unchanged player position. Rosa Colewick209/b80:head first appeared in the
nearby street at08:00:30 and moved to the original library station. One stable
body UUID and at most one matching body were observed; largest horizontal step
was1.20000000009m per game second. The previous32.718m closing jump was not
reproduced on this observed incoming segment. No clock, pose or dispatch was
injected. Home departure and the full street leg were outside this observation.

Timed rendered captures were inspected. The camera missed much of the approach,
and the08:00:45 view still showed Rosa's chip through the library wall. Scene
position continuity does not prove wall/door/furniture clearance or a convincing
visible commute. GF-G91 stays OPEN. Next inspect the library again on foot,
obtain supplies through actual services, and qualify a later natural departure
with a useful street view and normal saved-progress reload. Keep general indoor
routes, household meals/leisure/sleep, stairs and crowded circulation open.
Proof: rosa-next-rest-proof.json, rosa-next-rest-reload-proof.json,
rosa-day9-incoming-analysis.json/jsonl and timed PNGs in ignored
.agent/scratch/gameplay-flow/towns/. Latest task checkpoint/continuation guide
names the current earned manual; never restore the previous evening or morning.


## Current priests can locate the canonical temple

Verified: 2026-10-29. The existing global_directions question now gives a current
admitted priest the source temple's compass area when no registered business
answer applies. npcLocalDirections reuses householdFamilyAt/householdInstitutionRole
for saved identity/current office and institutionPlotForRole for the same canonical
building used by civicWorkplace. A disputed office, missing/ambiguous life,
foreign town, missing/duplicate/private plot, invalid footprint or span retains
the generic town answer or existing unavailable response. A deceased former
holder does not become the current speaker. Authored refusals and valid merchant
directions retain precedence; an inverse audit preserves the prior merchant and
other source bytes outside the inserted fallback/import/type changes.

This is public temple location, not a new routine assignment. Generated NPCs do
not need a copied civicWorkplace field or business ledger. Physical attendance,
station support, services and access remain owned by existing town systems.
The new wording promises no opening hours, route permission, safety, service,
quest or reward. Existing direction publication retains heard words and speaker
in the player Logbook without marking the temple visited.

144 affected cases/five suites pass, including24 new real-life/canonical-plot
cases and5 new UI/publication/Logbook cases. Three changed paths typecheck with
zero in-scope or suppressed errors. One scoped header wave updates the resolver,
skips both tests outside the graph and leaves dialogueService deliberately unwritten.

Actual1440x900 cold adoption from21:13:13/963 preserves nine PRESENT groups
exactly and the entire963-message prefix, with no new page errors. Normal
physical Meet/Talk now delivers: "You're in Menaikon. The temple is in the northern
part of town." This agrees with the existing same-world canonical temple168,
not a newly generated destination. Actual Logbook
rendering is inspected at1440x900: the single learned direction names Faelan,
the exact words and21:14:26 delivery time. Normal Save/Main Menu21:15:06/965,
full document reload and Continue/To Player retain nine PRESENT groups, the full
965-message prefix and the entire Logbook exactly. The reloaded Logbook again
renders that same entry. A new normal physical Meet/Talk repeats the direction;
normal resave leaves exactly one temple entry with its original words/time.
The two identity/family history records and all75 original fact arrays remain
exact. Eight non-memory groups remain exact; quest log, hidden sites, world facts
and businesses are PRESENT and unchanged. No new page error or provider POST is
observed. Final normal park21:15:31/966 keeps earned feet
468.17929545937716/536.0214617408844/Y3.9288164399052112. Earlier963 and965 archives
remain intact. Standard isolated1440x900 client also completes and its image is
inspected, separately from actual saved gameplay.

Next follow this heard northern-temple guidance through ordinary public streets
and doors, then inspect a useful temple interaction and its relationship to the
priest's real duty. Neither this source location nor the existing title alone
proves an available service or personal quest. The
broader duty, service, personal-story, route and recruitment goal stays open.
Proof is ignored under .agent/scratch/gameplay-flow/replies/: priest-guidance-source-proof.json,
priest-guidance-before-adoption-state/storage.json, priest-guidance-cold-adoption-proof.json
and priest-guidance-native-reply.txt/png. Final proof: priest-guidance-native-logbook.txt/png,
priest-guidance-earned-reload-proof.json, priest-guidance-reloaded-logbook.png,
priest-guidance-repeat-proof.json and priest-guidance-final-park-state/storage.json.


## Library next-day physical return and recognition

Verified: 2026-10-29. The Day9 return now includes ordinary player entry.
The first diagonal approach was blocked; aligning outside the same saved-open
door crossed the threshold and reached the finished floor. A short lateral
aisle approach reached494.38545591560273/463.3924169624093/Y2.84443031106152 near
Rosa's original library station. No actor lift, door deletion or movement bypass
was used. This qualifies this played entrance/aisle, not general indoor routing.

Camera composition remains awkward. The first name-chip click timed out because
the chip was outside the viewport. Ordinary orbit and left-drag pan recovered
both bodies and the chip while retaining exact feet. Actual Meet shows Rosa
Colewick, librarian, age52 and You have met before. Normal Talk recognizes the
earlier conversation; the family reply still names Ned as spouse and Pip and
Robin as children. Ambiguous household records remain unverified. The original
first-meeting fact is exact and no duplicate meeting fact was added. Only Rosa's
last-interaction/discussed-family timestamps changed in NPC memory. All other
NPC memories, party, inventory, gold, town state, quests and source identities
remain exact; player cell-local coordinates correctly follow the earned walk.

Normal Save/full document reload/explicit latest manual Load/resave preserves
all20 PRESENT groups and all1037 messages exactly. Rendered interior remount is
inspected; no page or console errors occur. Latest manual1793290444110,
Day9 08:15:23, retains the above feet,9HP/20.75GP and zero ration/
water units. Current continuation is this earned morning, not an older archive.
GF-G91 stays OPEN: the incoming segment is bounded, and the whole departure,
door/furniture clearance, visible street route and household return still need
actual play. Next leave by the real door, obtain supplies through actual open
services, and approach a later closing with a useful street view. Camera and
nameplate framing remain visible friction. Complete communities remain OPEN.
Proof: rosa-day9-contact-proof.json, rosa-day9-contact-reload-proof.json,
rosa-day9-contact-reloaded-native/storage.json, inspected repeat-card/family/
camera/remount PNGs in ignored .agent/scratch/gameplay-flow/towns/.


### Following the heard temple direction: current partial street leg

The qualified direction/reload milestone remains21:15:31/966 above. Subsequent
normal Continue and bounded WASD legs move from the earned household feet to
467.6380900950918/534.3029834299894/Y3.9215442991571297 at the doorway, then
467.5974674517486/531.6424533884771/Y4.097723189136622 on the frontage. The next
northbound leg reaches468.3487837570849/529.5885306395522/Y4.020684191451409 with
partial wall sliding. Rendered inspection shows nearby built frontage; this is
not proof of a defective wall or a completed route. Do not keep pushing the same
heading or remove collisions. Inspect the public street/corner and normal camera
view, then choose a clear route toward the already-heard northern temple.

Normal Save/Main Menu now parks21:20:05/967 at that last earned position.
All966 prior messages remain an exact prefix. Party, inventory, gold, generated
NPCs, town life, companions, Logbook, world facts/businesses, quests and hidden
sites are PRESENT and exact. Cell4337 remains the same; its local coordinates
change with the actual walked feet. All75 prior known-fact and interaction arrays
are exact. The sole other memory difference is Faelan's global_directions topic
date now21:15:31, matching the actual repeated question; no new fact or interaction
is added. This date difference is recorded separately from movement, without
assuming a new walking conversation. There is no page error or provider POST.
No pose/clock injection, forced click, collision override, archive restore or
unearned temple arrival occurs. The guide966 milestone and all earlier archives
remain intact; continue from this967 park.

Ignored proof: priest-guidance-route-door-attempt.json/png,
priest-guidance-route-street-attempt.json/png, priest-guidance-route-north-leg.json/png,
priest-guidance-route-park-proof.json, priest-guidance-route-memory-audit.json and
priest-guidance-route-park-state/storage.json under the same reply scratch home.


## Town provision revisit: actual entry, empty HUD blocks contact

Verified: 2026-10-29. Sana left the library through its real saved-open
door, followed public streets on foot with normal WASD and visible road clicks,
and reached The Shadowed Provisions/Fenna Hartham shop123. The initial2.5s helper
window falsely described delayed position observations as a block; normal replay
passed that segment. The ignored helper now requires repeated stable samples
and reports observation uncertainty. No game movement, geometry or clock rule
was changed. One road pick occurred before the camera settled and reached a
different actual point; the earned arrival was retained. Later picks waited for
three distinct stable camera frames. Neither map coordinates nor test queries
were treated as movement or arrival evidence.

Actual Open door changed source leaf0:3:x:2.2860:-4.5720 from closed to open.
Normal entry crossed onto the finished floor and approached the existing shop
counter. Latest manual1793294008339, Day9 08:59:18, stands at
419.1696047801274/447.76390313979493/Y3.637571530320363 with9HP/20.75GP and zero
ration/water units. The source shopkeeper is present, but no new meeting, stock
inspection or purchase is accepted yet. The tightly framed nameplate is partly
under the top HUD. A normal Meet click times out because the empty full-width
HUD row has pointer-events:auto. Actual elementFromPoint at719.495/25.962 returns
that blank row, not Fenna's button. Its painted controls sit elsewhere.

Next narrow the existing InWorldHUD header hit area to its title/control groups,
preserve their dropdowns and all prior source changes, then replay the actual
shop contact and paid provision service from this earned save. Tests support
the browser hit test and gameplay; they cannot establish the fix alone. Camera
framing, lighting, whole resident routes/GF-G91, household routines and the full
community goal remain OPEN. The earlier library checkpoint remains historical;
never restore it over this earned shop visit. Proof is ignored in towns scratch:
day9-fenna-hud-block-proof.json/png, day9-fenna-hud-blocked-native/storage.json,
day9-fenna-entry-0/1/2.json and the public route/click/observer receipts.


## Earned temple arrival and physical bench examination

Verified: 2026-10-29. Original Sana follows Faelan's heard temple direction through the public Town Plan, ordinary streets and the already-open northwest temple168 door. The existing street graph supplies a143.14766773011016m planned route; this is not a measured walked distance. All26 street waypoints (indices3 through28) are reached within0.2m using normal keyboard input. Physical entry reaches479.5764581284282/414.7635988011253/Y3.2791682869737486. Body feet and accepted player state agree exactly. No pose, clock, geometry, collision or archive override is used.

An ordinary click on the rendered nearby bench opens Bench / A bench in the nave. This proves same-room physical examination, not a useful service, story hook, permission, rest or attended priest. An onward step is blocked; a lateral ordinary walk reaches481.65867086728014/416.3396012505357 at the same floor height. After that step a wooden surface fills most of the camera. Normal To Player is used to recover framing; whole-room camera composition and circulation remain open. The bench currently offers only a description.

The first street reader accidentally retained the previous mount origin after normal Continue. It is rejected explicitly in temple-route-road-center-reader-rejected.json. The disposable reader is recalibrated to the actual967 load checkpoint and guards every subsequent sample against accepted feet; all reported qualified samples have mismatch0. No game state is changed by this correction.

Normal Save/Main Menu, full-document reload, Continue and resave preserve all14 compared PRESENT groups exactly and the complete970-message incoming prefix. Saved/hydrated clocks are0351-01-05T21:56:11.000Z/0351-01-05T21:56:45.000Z; time is reported separately. Current feet remain481.65867086728014/416.3396012505357/Y3.2791682869737486. No new page errors are observed. Frozen3034 predates the peer's public-room visit wave; no semantic discovery or peer feature acceptance is inferred.

Next diagnose the existing camera's wall-filled follow view at these earned feet, then continue an admitted nave route and a useful source-backed temple interaction. Useful services, actual priest duty, stories, personal quests, willing recruitment and the broader gameplay objective remain open. Proof: temple-route-canonical-street-path.json, temple-route-street-segment-*.json, temple-route-normal-door-entry.json/png, temple-public-bench-examination.png, temple-nave-aisle-east.png and temple-native-reload-proof.json under ignored .agent/scratch/gameplay-flow/replies/.


### Temple follow camera: measured null-clearance failure

Verified: 2026-10-29. After the qualified full reload, an ordinary right-drag orbit at the same earned temple feet puts the opaque pillar between the camera and player. The actual rendered image is inspected. A read-only query against the mounted scene reports nearest obstruction 0.09995167922801032m and cameraBeforeBuilding returns null. FreeRoamCameraController only writes a corrected eye inside its if(clearEye) branch, so this null result leaves the obstructed orbit in place. This identifies a concrete failure path; it is not a completed repair. Normal To Player recovers the earlier clear framing without movement. Next repair and verify the null-clearance follow-camera behavior against this native case, preserving player feet, source structure and movement intent. Proof: temple-camera-pillar-orbit.json/png and temple-final-clear-player-view.png in ignored replies scratch.


## Blocked temple camera orbits retain a clear view

Verified: 2026-10-29. FreeRoamCameraController now remembers a geometry-checked player view and checks the actual pose after MapControls applies orbit damping. If a stationary orbit becomes obstructed, the previous view is checked against current structure before reuse, and the rejected orbit's remaining damping is drained. During walking, a recalled arm may be used only on the same horizontal heading. Changed doors invalidate old clearance. Town commands and deliberate pans discard that view history. No player position, collider, source building, movement direction or save schema is changed. Fully enclosed situations without a valid prior view remain unqualified; the repair does not manufacture clearance.

Two new behavioral regressions first fail against the old controller: the null-clearance orbit leaves the eye behind a wall, and damping crosses a wall after the earlier check. Four new cases cover recovery, damping, changed doors and preserving moving headings. The existing pan test now checks that panning adds no sightline calls instead of assuming one internal check per preceding frame. Final50 distinct cases across five camera/movement suites pass; both scoped source/test paths report zero errors and zero suppressed diagnostics. Exact forward reconstruction preserves every prior controller byte outside the recorded additions; CRLF remains intact. No exported signature or import changes, dependency-header sync, broad suite, commit or push is needed for this wave.

Actual1440x900 original-Sana replay uses a controlled own-preview restart only after a normal22:04:30/972 Save/Main Menu. The same ordinary220px right-drag that hid the player behind the pillar now leaves a clear rendered player view. The final mounted-scene query reports no obstruction, and its clear position equals the rendered pose.47 passive pose samples are retained, without claiming every possible orbit or frame is clear. An opposite ordinary orbit also changes the view and retains exact feet. Parent inspects both rendered images. No dev pose setter, actor/state injection, forced click, geometry override or archive restore is used.

Source adoption also loads the peer's existing public-room discovery feature. It creates exactly one firsthand account for the actually reached temple168 ground-floor nave at22:04:46. All13 other compared groups remain exact; prior discovery entries remain intact. The sentence repeats in Menaikon because the fallback place name already contains the town. This actual wording is retained as earned history and reported to the discovery owner for future-writer repair. No meeting, priest attendance, rest, service, quest or story is granted by entering the public room.

Final normal Main Menu/full-document reload/Continue/To Player repeats the same blocked-orbit input successfully, then a normal Save preserves all14 PRESENT compared groups exactly and the complete973-message prefix. Saved/hydrated clocks are0351-01-05T22:06:48.000Z/0351-01-05T22:07:12.000Z; clock equality is not claimed. The single temple account remains exact with no duplicate. Earned feet are481.65867086728014/416.3396012505357/Y3.2791682869737486, with reader mismatch0 and no new page errors. Native final checkpoint is temple-camera-native-final-state/storage.json. Existing household identities, memories, inventory, quests and source geometry remain intact.

Next continue through an admitted nave route around the visible central obstruction and examine a useful source-backed temple furnishing or actual staffed interaction. The bench still offers only its description. Temple stories/services, actual priest duty, personal quests, willing recruitment, complete circulation, every-angle camera behavior and the full gameplay objective remain open. Ignored proof: temple-camera-red.txt, temple-camera-final-tests.txt, temple-camera-types.txt, temple-camera-source-preservation.json, temple-camera-repaired-pillar-orbit.json/png, temple-camera-clear-orbit.json, temple-camera-repaired-clear-orbit.png, temple-camera-adoption-parity.json and temple-camera-native-final-reload-proof.json in replies scratch.


## Town provision service: paid supplies survive full reload

Verified: 2026-10-29. This receipt supersedes the earlier pending HUD repair and
zero-supplies continuation. The broad connected-community goal remains OPEN.
The existing InWorldHUD header now passes scene clicks through empty spacing;
its title and Controls groups retain their own pointer targets. All prior source
bytes outside this change are preserved. Eight existing HUD tests and the one
scoped source typecheck pass (zero errors, zero suppressed diagnostics). Actual
native header-gap contact opens Fenna's remembered card; both header menus also
open normally. This qualifies that interception repair, not all camera framing.

From the earned shop123 floor, Sana meets the same adult Fenna Hartham, age51,
and uses Talk / Show me your wares. The Shadowed Provisions is open08:00–18:00.
Four normal one-item purchases buy two rations at53CP and two water-days at2CP:
110CP total,20.75GP to19.65GP. The old16 inventory records remain an exact prefix
of20. Only this shop's business stock and its keeper memory change; rations10→8,
water11→9, and earlier torch stock25 remains25. Source person81/b34:head,
visual roster/body84 and business npc_burg_675_plot_123 remain distinct domains;
no identity, household, keeper, ownership, geometry or schedule is replaced.

Normal Save/full document reload/explicit latest manual Load/resave preserves
all31 PRESENT compared fields exactly and all1053 messages exactly. Manual
1793296546051, Day9 09:19:06, retains419.1696047801274/447.76390313979493/
Y3.637571530320363,9HP,19.65GP, two ration units and two water-day units, the
saved-open source door, prior meetings, quests and finite stock. Rendered remount
is inspected. Reopening the real shop after reload confirms8/9/25 stock and
1PP/9GP/6SP/5CP; no repeat purchase is made. Its opening-hours banner returns.
The banner disappeared immediately after the earlier trades: this is bounded
display friction, not evidence of broken closed-hours enforcement. No page
errors occur; two502 resource errors remain unclassified, so console-clean is
not claimed for the reload.

Next leave by the real doorway with the purchased supplies and continue normal
public exploration toward useful furnishings and later whole resident routes.
GF-G23/GF-G60/GF-G91 remain open: body/door/furniture/street/home continuity,
family meals, leisure, sleep, stairs/crowding, privacy and later closing still
need representative actual play. Through-wall labels, tight framing and dark
interior composition remain visible. Never restore the earlier library or
HUD-blocked archive over this earned paid visit. Proof stays ignored under
.agent/scratch/gameplay-flow/towns/: fenna-hud-source-preservation.json,
fenna-hud-native-replay-proof.json, day9-fenna-paid-proof.json,
day9-fenna-paid-reload-proof.json, day9-fenna-paid-reloaded-native/storage.json,
and inspected day9-fenna-stock-reloaded.png/txt.


## Public benches open the normal short-rest review

Verified: 2026-10-29. The physical furnishing panel now offers Review short rest for a bench in a public room. It reuses publicBuildingRoom, extracted from the existing firsthand-visit eligibility rule, so a private household, secondary room, bedroom, altar or bed gains no seat action. The actual world, ground instance, saved building history, current room/floor and fresh reached feet are checked again when the action is chosen. Opening the review grants no recovery or lodging. The existing rest dialog and handler still own time, Hit Dice, eligibility, confirmation and finish-based limits; see [Rest and recovery](rest-and-recovery.md).

Source owners are publicBuildingDiscovery.ts, publicSeatRest.tsx and World3DWrapper.tsx. A native walk-away replay first exposes a hidden refusal behind the old furnishing card. The new seat handler now closes that stale card before showing its refusal. The corrected1440x900 replay visibly shows Move closer to examine this furnishing, no old panel and no rest dialog. Existing library/workbench handlers are not changed by this correction. Private seats, remote/other-floor feet and stale furnishing identity have focused guard cases.

Original Sana navigates the north aisle and around the visible obstruction using ordinary keyboard controls, reaches481.1306219818625/419.796233308131 on the same nave floor, and returns to the physically examined bench. The first eastward route is blocked by the room boundary; this is not treated as defective collision. Source geometry, body clearance and accepted positions are never overridden. The public floor-plan audit uses the selected temple168 blueprint; the full saved state confirms no building-event history at that plot.

Native bench review/cancel and controlled source adoption preserve all18 compared PRESENT saved groups exactly. One ordinary confirmed rest uses zero Hit Dice because Sana has9/9HP. Its tracker changes0to1 and its finish timestamp equals the actual commitment clock plus one hour. All17 other compared groups, including the complete party, inventory, gold, NPC memories, relationships, quests, discoveries and faith/catalog records, remain exact. The log adds the normal rest message and normal save messages. diceSaveCounter, save timestamp, clock and ambient debug log also change and are reported separately; no new recovery or RNG claim is inferred from those fields.

The live developer probe is a summary, not a complete GameState. An observation helper tries to read party from it after the real rest completes and throws in Node; the rest is not repeated. The full canonical saves verify the transaction. The two summary artifacts named public-seat-commit-before/after-state.json are explicitly marked as non-restorable in public-seat-observation-helper-correction.json. Use the actual IndexedDB-derived state/storage receipts. The earlier makeCellLocationId error is already documented at19:52:45/948; the fresh bench error listener remains empty. Ollama is currently unreachable and its normal dependency notice is acknowledged without changing providers; no generated conversation or console-clean result is claimed.

The same bench review then displays the actual remaining cooldown in hours/minutes with Begin Rest disabled. No second rest is performed. Final normal Save/Main Menu/full-document reload/Continue/To Player and resave preserve all18 PRESENT compared groups and the complete979-message prefix exactly,0351-01-05T23:37:51.000Z→0351-01-05T23:40:39.000Z. The1-rest tracker and its original finish time persist. The same physical bench still opens the disabled cooldown review after reload, and the one temple account remains exact without duplication. Current earned feet are480.5491282398312/416.0403379957804/Y3.2791682869737486, reader mismatch0, with no new page errors. The rest is not a seated-animation or every-angle camera qualification.

Source validation:67of68 distinct cases pass across five affected suites. The one failure is an independently reproduced existing LongRestModal supply-summary assertion in RestModal.test.tsx; that file imports none of the new bench modules. It is reported to the recovery owner, not relabeled green. Four scoped source/test paths have0errors/0suppressed; the refusal correction has a clean one-path rerun and20-case affected subset. One scoped header wave updates three source files, skips the test outside the graph and leaves two dependents unwritten. Exact reconstruction preserves all prior Combat/Travel wrapper and public-visit/copy bytes outside owned edits and scoped headers. No broad test suite, commit or push is run.

The saved religion audit finds four generic temple catalogs at generic_city, generic_mountain, generic_village and generic_graveyard. None identifies this world/cell/burg675/plot168. OPEN_TEMPLE still generates from VillageActionContext, while the physical altar uses the Worldforge plot. Do not attach a generic deity, magic effect, price or priest skill to this building by assumption. A current, living priest still needs an actual identity/capability/service connection. The public bench is useful independently of that missing connection.

Next connect this specific temple to verified faith, current clergy and useful service/story data, preserving the earned late-night rest and prior attributed memories. The paid undercity account remains reported information, not proof that Faelan witnessed it. Temple staff/services, personal stories and quests, willing recruitment, complete circulation, seated poses, lighting and the full gameplay goal remain open. Proof is ignored in replies scratch: public-seat-native-action-panel-clear.png, public-seat-native-rest-review.png, public-seat-adoption-cancel-parity.json, public-seat-native-rest-proof.json, public-seat-native-cooldown.json/png, public-seat-refusal-visible-proof.json, public-seat-walked-away-refusal-visible.png and public-seat-final-reload-proof.json. Final canonical save: public-seat-final-state/storage.json.


## Town continuation: earned shop exit and exterior reload

Verified: 2026-10-29. After the paid-service reload, normal Meet/Talk/reopen
confirms the same keeper,8/9/25 ration/water/torch stock and19.65GP. No further
purchase occurs. The first diagonal departure is refused. A normal southward
reapproach across the floor, then eastward movement through the saved-open door,
reaches the exterior at421.6216294999215/449.13821516155417/Y3.7730638193714885.
No collider, furnishing, pose or movement override is used. The blocked diagonal
does not establish that every furniture route is sound.

Manual1793297757546, Day9 09:31:43, retains the complete1053-message prefix plus
five normal messages, paid inventory, funds and business stock. Normal Main Menu,
full document reload, dependency-notice Continue, explicit latest manual Load,
To Player and Save yield manual1793297996783, Day9 09:32:16.
All31 PRESENT fields and all1058 messages are EXACT across this reload. The
rendered exterior remount is inspected. Four reproduced502 responses are now
identified as /api/ollama/tags model discovery; no page errors occur. The earlier
two reload warnings were not individually identified. Local inference readiness
and a console-clean startup are not claimed.

Parent1440×1024 rendered Planmap town focus, Back/reopen, canonical links and same
derived iframe pass with no horizontal overflow or page errors. Its separate QA
context leaves the gameplay manual byte-exact and is closed. The shared view
continues to derive from these records, not another task store.

Town Plan identifies Fenna's home34 (display house35) and existing school11
(display civic12), with adult schoolmaster Pell Ashhall and furnished studies.
Those are inspected plans only: no private entry permission, school visit,
teacher attendance, pupil schedule, furnishing use or lesson is accepted. Next
continue from this earned exterior, use public streets toward the existing
school's real entrance, inspect its access and useful furnishings, and follow
later whole resident routes. Full community life/GF-G23/GF-G60/GF-G91, household
privacy, meals/leisure/sleep, stairs, crowding, dark frontage and nameplate
occlusion remain OPEN. Never replace this state with an older zero-supply copy.
Ignored proof: day9-fenna-exit-floor/reapproach/door.json, inspected exit-door
and outside-reloaded PNGs, day9-fenna-outside-proof.json,
day9-fenna-outside-reload-proof.json, day9-fenna-outside-reloaded-native/storage.json,
fenna-paid-planmap-qa.json, fenna-paid-planmap-final.png, and household/school plan
observations in towns scratch.


## Physical temple dedications use the town's actual faith

Verified: 2026-10-29. A reached public main-temple altar now offers Read dedication. The existing Worldforge burg cell supplies its generated faith, form and optional associated deity. The same canonical institution selector used for the priest's workplace identifies the main temple. A unique living town priest supplies the listed clergy. Missing, dead, future or disputed office holders do not become a replacement NPC. Secondary shrines remain unresolved. The generated faith is not substituted with a generic deity catalog, and neither a priest title nor a dedication grants spellcasting, services, favor, attendance, consent, a meeting or a quest.

The reading becomes LOCATION-sourced Lore Uncovered in the existing Discovery Log and adventure-log mirror, using the actual game date. Its identity includes world, source building, faith and listed clergy. Rereading retains the first account; changed clergy can add a later account without rewriting the old one. Other lore remains append-only and the existing newest-200 retention rule remains. The action validates current selection, world, ground, building history, floor, room and fresh physical reach after its lazy source import. An obsolete selection cannot publish knowledge or replace a newly selected card. Refusal closes the old card before showing its reason.

Native desktop1440×900 source adoption preserves18 PRESENT saved groups exactly,0351-01-05T23:56:16→23:57:40. Ordinary nave walking reaches481.05592650588636/419.63965292977764/Y3.2791682869737486. Actual selection and reading reveal Elladan Pantheon, polytheism, associated deity Nauclea, The Blue Eagle, and current priest Faelan Ironsmith. The single account is dated23:59:59. Midnight then legitimately advances the town/business/rest-day state and rebuilds the ground. A stale reread is refused and preserves the original account. Fresh selection and rereading in the rebuilt scene at00:01:32 retain exactly one byte-identical dedication, including the first date and wording. Every older discovery remains retained. The observer's old coordinate origin intentionally throws after the real scene remount; a read-only correction uses the current saved accepted feet and the scene's actual zero local body, without changing game state, position or camera.

An ordinary walk away produces Move closer to examine this furnishing; no duplicate account is added. The first screenshot catches the pending state, so it is not claimed as rendered refusal proof. Normal return stops at481.05592650588636/418.99134332983675/Y3.2791682869737486, then Save/Main Menu retains00:02:59 and the one original account. The following final qualification supersedes this earlier pending state. Darkness, block-like altar dressing, cramped camera views, complete circulation, useful clergy services, personal stories and recruitment remain open. Ollama remains unreachable; no generated conversation or console-clean startup is claimed.

Validation: a meaningful baseline reducer failure reproduced duplicate reread entries. The repaired wave passes53 cases across five affected suites, seven scoped paths with0errors/0suppressed, and a15-case copy follow-up. The final wrapper copy change has a clean one-path type rerun. One scoped dependency-header pass updates three source files, leaves the reducer header unchanged and skips three tests outside the graph; four dependent files are reported but not written. An inverse audit preserves all prior wrapper source outside these additions, the article correction and its header; every old reducer-test byte and each file's original line endings are retained. No full-repository check, commit, push or memory mining is claimed.

Ignored proof in .agent/scratch/gameplay-flow/replies: temple-dedication-source-audit.json, temple-dedication-log-red.txt, temple-dedication-adoption-proof.json, temple-dedication-altar-approach.json/png, temple-dedication-altar-selected.png, temple-dedication-first-read.png and first-read-state.json, temple-dedication-reread-proof.json, temple-dedication-midnight-reader-origin.json, temple-dedication-fresh-reread-proof.json/png, temple-dedication-walkaway-proof.json and temple-dedication-reload-before-state/storage.json. The before-source state is historical; continue from the latest earned save, never restore an older source park over it.


Final current-source native qualification: a stationary normal default-slot Save/Main Menu/full document reload/Continue/To Player/resave preserves all18 PRESENT groups exactly, 0351-01-06T00:06:10.000Z→0351-01-06T00:06:31.000Z, including body/cell, complete NPC memory, quests, faith/catalog records and the one dedication. All986 earlier messages remain an exact prefix. Accepted feet are481.05592650588636/419.66495132984807/Y3.2791682869737486, with actual remounted scene body0/0 and observer mismatch0. Native current-source altar reselect/read renders An altar and the actual dedication. The existing Discovery Log is opened and searched normally; its rendered one-entry result shows1/5/351,11:59:59PM and the original words. Opening the entry normally marks it read; the subsequent stationary reload preserves that read status. No new page errors occur. Final qualified full state/storage: temple-dedication-final-state/storage.json in ignored replies scratch.

The first post-walk reload observation is retained separately:16of18 groups and the old message prefix match, while the body/cell differ0.673608m from the autosave sampled just after walking. The loaded physical scene matches its own accepted feet. The observer had sampled autosave while normal Save Game writes the separate default slot; do not turn that first comparison into exact body persistence or silently discard it. The later stationary same-default-slot comparison above establishes all18 groups. Original saves and earned midnight progression remain preserved. See temple-dedication-first-reload-observation.json and temple-dedication-stationary-reload-proof.json. Rendered proof: temple-dedication-final-source-read.png and temple-dedication-logbook-reloaded.png.

Next improve the actual altar's physical dressing and readable lighting, then connect clergy capabilities and useful services/story only to real source data. Keep the full stories, personal quests, willing recruitment, world exploration and desktop UI goal active. The journal's long internal source ID remains a rendered UI gap; its current source owner has been notified. No new service or story completion is claimed.


The final reloaded Logbook is rendered and searched again, then normal Save/Main Menu parks the actual session at0351-01-06T00:07:43.000Z/988messages. All18 PRESENT groups remain exact against the qualified reload and its old message prefix is retained. Current continuation is temple-dedication-current-park-state/storage.json, superseding the qualified00:06:31 save only as the next earned continuation. No earlier archive is restored. Proof: temple-dedication-current-park-proof.json and temple-dedication-final-reloaded-logbook.png.


## School visit: real entry and first conversation; label repair awaits replay

Verified: 2026-10-29. Sana resumes the earned supplied exterior and walks public
streets to school11 (display civic12). The first disposable route helper omitted
the existing canonical town scale1.3797912885650496 and led to a normal wall stop.
That helper is INVALID, not a game-map defect. Replanning reuses transformTownPlan,
the existing adapter and agentPath; the real detour is retained. No map, clock,
pose, building or movement rule is overridden, and the plan is not arrival proof.

Normal Open door uses source leaf0:3:x:-2.2860:-4.5720 at542.3229248/428.3950840.
Actual walking crosses onto the4.086413237387271 ground floor. An inner approach
stops in the crowded doorway/stair area; broader circulation is not accepted.
Actual Meet/Talk reaches Pell Ashhall, schoolmaster age48, disposition50. His
first family conversation names spouse Bram Thornham and child Dob Ashhall and
offers family recall. The card retains other household records separately.
Saved life180/home71/bornDay-17518 and visual184/b71:head remain distinct identity
domains. No pupil routine, lesson, school service, furnishing use or complete
teacher commute is inferred from this contact or the floor plan.

Normal manual1793301137775, Day9 10:06:00, retains540.9010986105368/
429.12244673319907/Y4.086413237387271,9HP/19.65GP/two rations/two water-days,
the open school door, Pell's member-key memory and1061 messages. This earned
school save supersedes the earlier shop exterior. Further live time may advance;
save again before any controlled source adoption. No school reload acceptance yet.

Rendered school frontage incorrectly carries the old plot123 shop label through
the structure. Its actual range is121.792m against a20m limit, but the nameplate
reference remains the frozen shop entry only0.853m away. Ground mode passes no
continent position, so the component falls back to that fixed origin. The label
still belongs to the real shop; do not rename the school or merchant to hide it.

The source-only candidate reads the existing named rendered player root for
ground range at4Hz/25cm, caches/reacquires its identity, and keeps the explicit
continent anchor. All existing names, ranges, frontage logic, resident ownership,
movement and saves are preserved. Two new movement/replacement regressions fail
first on old code; final19 affected cases/two suites and both scoped paths pass
with zero errors/suppressed diagnostics. The one header pass reports unchanged;
its Scene dependent is not written. Only Nameplates and its test change, with
all prior source bytes recoverable by exact inverse. Source lease is released.
These checks do not prove the native fix. Replay/full reload are still PENDING.

Next continue useful school exploration while shared renderer/worker owners
finish their current changes, then save/park normally and adopt only at a stable
functional boundary in the owned preview. Verify the actual label withdrawal,
walk/revisit behavior and full earned-save continuity. Do not restore an older
shop copy. Source identities, privacy, children/retired residents, teacher agency
and all community requirements remain protected. GF-G23/GF-G60/GF-G91/full goal,
school usefulness/attendance over time, whole routes, meals/leisure/sleep, stairs,
crowding, dark rooms and through-wall NPC labels remain OPEN.

Ignored towns proof: corrected street-leg receipts; day9-school-door-hover.png,
threshold-entry/inner-hall PNGs; inspected Pell-card/family PNGs and text;
day9-school-before-label-repair-native/storage.json; school-frozen-label proof;
school-nameplate-red-receipt.json and source-preservation.json. Source checks:
Vitest handles71164 RED and10634 GREEN; scoped types51935; header49396 terminal.


## Altar dressing and the interior fill experiment

Verified: 2026-10-29. The actual temple's anonymous block now renders as stepped altar stone with a linen runner and open book. The existing shelf pattern supplies merged, memoized geometry and disposal. The original parent furnishing retains its canonical identity, examination callback and conservative collision; dressing adds no inventory, faith text, service, fuel or knowledge. No emblem is invented for the generated polytheism. The native scene contains one dressing mesh936vertices and its stone parent144vertices at the original altar position. This is a bounded local render observation, not a town-wide performance result.

The first readability candidate raises the existing one camera-inside fill from1.15to4.5. Actual1440×900 view shows the altar geometry but its book remains too dark. Runtime inspection proves that fill is active at4.5, camera z−5.7; all four scheduled hearth lights are off. Increasing power does not qualify readability. This failed visual candidate is retained in altar-dressing-first-native-view.png and altar-dressing-first-light-diagnosis.json. Its normal source adoption/Save/Main Menu preserves18 PRESENT groups exactly from the actual latest00:07:44/989 save to00:11:09, with no new page errors. The earned dedication, priest/family memory, quest state and original rest remain intact.

The revised experiment restores the original1.15power and reuses the same single fill. It anchors at the existing mounted player's upper body only when camera and body share the same source shell. Camera-only views and another-building bodies retain camera anchoring; an exterior or above-roof camera still disables the fill. Its cached body identity is reacquired after replacement, with missing-body searches bounded at4Hz. It changes no player pose, movement, world visibility state, hearth/window schedule or fuel. Two meaningful regressions first reproduce camera-only anchoring instead of the shared-room body. Five new source-boundary cases plus existing affected suites now pass32cases/four suites; all four scoped source/test paths are clean. A final18-case lighting rerun passes. The later native qualification below supersedes this pending state; source checks alone did not establish it.

Initial scoped header wave updates only the three owned source files; revised wave leaves those headers unchanged and skips the test outside the dependency graph. Five dependent files are reported and not written, including Economy's leased Wrapper. Exact inverse audits preserve every prior Scene/light/test byte outside the owned edits and headers, with original LF retained. Existing React DOM smoke tests emit Three intrinsic-tag warnings under their mock; those checks establish light count, not WebGL appearance. The baseline Vitest sandbox JSON path is unavailable on a later copy attempt; its observed2failed/16passed terminal result and baseline source are retained honestly in altar-dressing-fill-anchor-red-receipt.json and baseline.txt.

The earlier next action was native inspection and persistence qualification; the result and current next action follow below. Preserve the full gameplay objective: meaningful source-backed clergy usefulness, personal stories/quests/willing companions, exploration and logical desktop UI remain open. Existing journal internal source-ID presentation is separately reported to its owner. Ignore proof remains under .agent/scratch/gameplay-flow/replies; no repository-wide check, publication or memory mining is claimed.


### Qualified book interaction and overhead fill

Verified: 2026-10-29. Native1440×900 selection of the visible book's pages opens the existing Altar examination and Read dedication action. The whole-container parent retains its original source identity and reach checks. The delivered words still name Elladan Pantheon, Nauclea, The Blue Eagle, and Faelan Ironsmith. Rereading keeps exactly one original23:59:59 account; no inventory, NPC, quest, favor or service is granted.

The first same-building fill at body+1.5m does follow the actual body, but harshly lights the character from below. That look is rejected. The final source keeps the original1.15power and one-fill budget, placing it2.7m above the body only when camera and body share a source building shell. Camera-only and outside/roof gates remain. Actual final light is at local0/5.979168286973749/0 while the accepted body is0/3.2791682869737486/0; all four scheduled hearth lights remain off. The close rendered view shows the book, runner and stepped stone without the earlier underlighting. The wider night view remains dim. This qualifies a bounded close-view improvement, not general room lighting, every angle, multi-floor behavior or town-wide performance. No fuel or world-visibility rule is changed.

Normal default-slot Save/Main Menu/full document reload/Continue/To Player/resave preserves all18 PRESENT groups exactly,0351-01-06T00:20:27.000Z→0351-01-06T00:22:08.000Z, with all991 prior messages as an exact prefix. Body/cell, inventory, memories, people, quests, faith/catalog state, the earned rest and original dedication remain exact. The carried-light ledger also stays present and exact,0active sources before/after. Physical remount is481.05592650588636/419.66495132984807/Y3.2791682869737486, observer mismatch0. The rebuilt scene contains one936-vertex book/runner mesh and its144-vertex stone parent; a second physical page click/read succeeds after reload. No new page errors occur. Final qualified save: altar-dressing-final-state/storage.json.

Validation remains32 distinct affected cases/four suites and four clean scoped paths; the overhead-height refinement has a clean one-path type rerun. The18-case lighting follow-up passes. Inverse source/test preservation and original LF pass after the final height refinement. The rejected power and chest-height candidates, meaningful2-RED baseline, and their bounded evidence stay preserved rather than being relabeled accepted. Final proof: altar-dressing-final-adoption-proof.json, altar-dressing-final-reload-proof.json, altar-dressing-final-runtime-light-proof.json, altar-dressing-final-reloaded-close.png and altar-dressing-final-reloaded-read.png in ignored replies scratch.

Next use existing systems for legitimate night preparation and useful source-backed clergy/story encounters. GroundCarriedTorch already projects actually burning owned torches from carriedItemLight; do not build a parallel light owner or grant a free flame. The actual Sana save currently has no canonical torch/tinderbox and no active carried flame. This is a source/gear observation, not native acceptance of the torch flow. Inspect actual local wares, permissions and service hours, then continue personal stories, quests and willing companions. Wide-view night lighting, circulation, seating/poses, complete NPC lives and exploration remain open. The full desktop gameplay goal stays active.


Final normal reloaded book reread/Save/Main Menu parks the default slot at0351-01-06T00:28:25.000Z/993messages. All18 PRESENT groups and the qualified reload's old message prefix remain exact. Continue from altar-dressing-current-park-state/storage.json or the actual later native slot; never restore an older archived candidate over earned progress. The original player remains at481.05592650588636/419.66495132984807/Y3.2791682869737486. Proof: altar-dressing-current-park-proof.json. No additional rest, light ignition, service or quest is performed.


## School revisit, moving nameplates and earned inn exterior

Verified: 2026-10-29. This receipt supersedes the earlier pending school replay.
The actual hall-side desk attempt correctly refuses examination from another
room. Walking through the real Hall-to-Study doorway at541.324/431.470 reaches
541.6759315/431.9984893/Y4.0864132. A normal physical desk click then returns
"A desk in the study." This is examination only, not a lesson or school service.
The floor plan's school Hall also carries lodger2..9 allocations and beds while
the teacher's household lives elsewhere. Appropriate civic allocation or boarding
intent remains unverified; no household, furnishing or building is deleted.

Fresh earned school Save/full document reload/explicit manual Load/resave
1793302562044->1793302922489 preserves all31 PRESENT protected groups and all1062
messages exactly. Actual Pell revisit says "You have met before" and retains
the same family and source identity domains. No pupil attendance or whole teacher
commute is inferred. Sana exits the actual internal/front doors normally and
closes the school front leaf0:3:x:-2.2860:-4.5720; saved door state is false.

The nameplate repair now has native moving-body evidence, beyond source tests.
On the public school-to-inn walk the fixed scene origin remains541.6759315/
431.9984893. Inn10 frontage543.2626631/456.3338591 is24.387m from that origin,
outside its20m range. The same rendered player walks into16.590m actual range:
14 absent samples become38 present samples, and the inspected rendered label
reads the existing saved business name, The Shadowed Sundries. The old frozen
origin rule would still hide it. Source IDs, business ownership, label ranges,
frontages, movement and saved data remain unchanged. All prior source bytes are
recoverable by exact inverse; current source hash matches the qualified candidate.
Validation remains two meaningful RED regressions,19 GREEN cases/two suites,
two clean scoped paths and one unchanged dependency-header pass.

Normal walking continues to544.3841946485605/458.1886319260542/Y3.7904218562221654,
outside inn10. Save1793304739234 Day9 10:55:32/Main Menu/full document reload/
explicit latest manual Load/resave1793305550835 at10:56:01 preserves all31
PRESENT protected groups and all1064 messages exactly, including gold19.65,
memories, people, businesses, supplies and closed school door. The remounted
body and inspected screenshot retain the earned location; no page errors occur.
The reloaded image remains a wide overview. Before reload, normal To Player
also leaves the camera target at an earlier street corner despite the correct
actual body/focus getter. That close-framing failure is OPEN and reported to the
existing camera owner; no cause or camera fix is claimed by this receipt.

Next continue from the latest earned inn exterior, qualify ground camera framing,
then enter the supported inn normally and inspect actual furnishings, willing
residents, opening hours and services. Gwen meeting, booking, food and inn service
are NOT yet accepted. The nameplate fix covers range, not through-wall occlusion.
GF-G23/GF-G60/GF-G91 and the full community goal remain OPEN: useful civic life,
whole commutes, stairs/crowding, privacy, meals/family/leisure/sleep and repeat
visits across times of day still require connected native evidence.

Ignored proof: day9-school-study-desk-result.png/txt; school-pell-revisit-card.png;
day9-school-source-adoption-proof.json; day9-nameplate-native-moving-proof.json;
day9-inn10-label-range-crossing.png; day9-school-final-reload-proof.json;
day9-school-final-reloaded-native/storage.json; day9-inn10-reloaded-native.png.
All images cited as inspected were viewed; a generated screenshot alone is not
acceptance. No full suite, build, push, new service or completed community claim.

## Morning clergy attendance and remembered conversation

Verified: 2026-10-29. Original Sana uses the ordinary eight-hour Wait at temple168, reaching Day6 morning without a rest, purchase, light ignition or body override. Party, full inventory and20.77GP remain exact. Current feet remain481.05592650588636/419.66495132984807/Y3.2791682869737486. Four routine discoveries are recorded as emitted activity, not accepted new story knowledge. Rest remains refused on occupied property; waiting is separately allowed.

Normal To Player/zoom reveals Faelan at the temple station. Actual Meet/Talk recognizes the prior meeting. The family recall says Yesterday and quotes the original Sten Ironsmith spouse statement exactly. The ordinary retained undercity-account topic then makes one configured local phi4-mini:3.8b-q4_K_M request with CPU placement,4096 context and100-token cap. Thinking is still visible at59 seconds; the delivered reply is observed by84 seconds. This interval is an observation bound, not an exact inference benchmark. The reply declines confirmation and calls the story hearsay, but adds vague curious happenings flavor without a source; broad factual dialogue quality remains unaccepted. No new route, named person, quest, reward or threat clear is granted.

The previously installed local Ollama0.32.0 is now running in one owned loopback child with cloud disabled and pruning disabled. No model download, paid call or saved provider/model/compute change was made. An earlier automatic-GPU smoke request timed out after90 seconds; a corrected short CPU request matching the game succeeded in30.344 seconds. Neither short readiness nor this one native reply proves all role models or comfortable conversational latency. The actual delivered speech survives in ollamaInteractionLog only. The transient lastNpcResponse resets on reload, and all prior npcMemory interactions stay exact: this generated exchange creates no durable NPC conversation memory. Source useDialogueSystem publishes generated responses without the dialogue metadata required by publishSpokenNpcReply. The prompt also retains founding age78 while the current admitted resident description is age86. Provider logging is not character recall; both gaps remain open.

Normal manual Save at0351-01-06T08:40:45.000Z/1001 messages, full document reload, Continue Journey and a new same-default-slot Save at0351-01-06T08:41:39.000Z/1003 retain all18 PRESENT groups exactly and the entire1001-message prefix. The provider-log response is exact, separately from the cleared transient display and missing generated conversation memory. An initial read400ms after Save still saw the old manual slot; only the later settled08:41:39/1003 read qualifies this receipt. The initial Continue pointer timeout left MAIN_MENU; normal focus/Enter then actually resumed. Neither observation failure was counted as completed play. No save import, rollback, rerolled reply, provider substitution or old-profile replacement is used.

Next repair current-life grounding and actually delivered generated-conversation memory through the existing dialogue publication/context owner, preserving attribution rather than asserting generated words as true world facts. Then make the reached clergy useful through the existing dialogue-topic/context system: the physically read dedication currently has no ordinary discussion option. Reuse the actual faith/office join and retained source account; do not invent personal belief, ritual powers, corroborated undercity history or a quest. Improve and measure actual configured dialogue latency with new evidence before another request. Full NPC lives, stories, recruitment and connected exploration remain open.

Ignored proof in .agent/scratch/gameplay-flow/replies/: owned-local-ollama-game-cpu-inference.json, clergy-morning-before-state.json, clergy-morning-after-wait-state.json, clergy-morning-generated-proof.json, clergy-morning-manual-state/storage.json and clergy-morning-reload-proof.json. Actual desktop morning-station, yesterday-recall and generated-reply captures were inspected. This wave changes records only; no new game-source check, build, push or full-suite claim. MemPalace CLI is unavailable; no mining is claimed.


## Inn entrance: real door opens; standing clearance blocks entry

Verified: 2026-10-29. Actual public walking2.59m away from the inn frontage
restores a clear To Player view. The inspected lane/Sana/sign view qualifies that
local recovery only. Orbiting near walls still retracts closely; framing remains
an open town problem. Final school projection was also inspected inside Planmap
at1440x1024: correct shared snapshot, four canonical links, Back works, no inner
or outer overflow/page errors, and native manual bytes unchanged.

The first real inn10 door click at546.2155203/460.0199576/Y3.9227885 refuses
"Approach this door on the same floor." A normal closer approach around the sign
reaches544.4971730/456.7648484/Y3.5178205 and opens the source door normally.
Hover changes Open door to Close door, and actual PlayerAvatar.openDoors contains
wf-plot-675-10/0:3:x:-2.2860:-3.8100. The earlier refusal is valid at its farther,
higher approach; it is not evidence for weakening the interaction guard.

Actual attempted threshold crossing then blocks at543.9670092/456.6260552/
Y3.3506015. A normal sideways approach also stops outside. No interior entry,
Gwen meeting, furnishing use, booking, meal or inn service is accepted. Names
seen through walls do not establish contact. Source saved business remains
The Shadowed Sundries; Gwen and household roles/ages are unchanged.

Read-only use of the existing actual ground, open-door set and mounted walking
surfaces confirms standingBodyHeight1.8531429259165852 cannot cross the center
approach. A diagnostic1m body-height-only solver comparison passes the same
smooth3.391->3.107m terrain path. This is a causal clearance probe, not gameplay:
Sana's actual height, body, pose and ground are never changed. The exterior head
above the doorway begins at5.0724847m; higher approach soil leaves too little
standing clearance. Six bounded parallel solver probes also stop outside, but
do not prove every possible route impossible. Existing pad grading classifies
grid indices by(cell+.5)*1.524 while groundSurfaceY/sampleGroundChunk interpolate
at integer grid nodes. That possible pad-placement mismatch needs a controlled
experiment before any source change. Existing addBuildingEntryApproaches handles
positive floor gaps only; do not add a private collision exception or discard
the physical head, terrain, source door, ownership or real figure dimensions.

Normal Save1793306893173/Day9 11:17:40/Main Menu/full document reload/explicit
latest manual Load/resave1793307086551 at11:18:11 retains all31 PRESENT protected
groups and all1066 messages exactly, including19.65GP and the now-open inn door.
The inspected remount remains543.4558786574586/457.5568755835412/Y3.4634404459868318
outside the inn. No page errors occur. This latest earned checkpoint supersedes
the earlier inn exterior and school copies; never restore those over it.

Next repair or qualify the real street-to-door standing clearance through the
existing pad/entry systems, coordinate with the current terrain-route owner,
then replay actual entry and useful inn life. Preserve current source geometry
and earned feet during diagnosis; any revised physical approach must be rendered
and normally walked, then saved/reloaded. GF-G60 and full community goal remain
OPEN. No source fix, new test, grade change or inn-service success is claimed.

Ignored proof: day9-inn10-public-backoff.png; close-door-hover/open-door/threshold-
entry captures; day9-inn10-entry-diagnostic.json; day9-inn10-entry-cause.json;
day9-inn10-open-blocked-reload-proof.json; day9-inn10-open-blocked-reloaded-native/
storage.json; day9-inn10-open-blocked-reloaded.png. Actual cited rendered checks
were viewed. Temporary proof stays ignored; no build, push or mining claim.

## Generated exchanges become attributed conversation memory

Verified: 2026-10-29. The original Sana morning play exposed two real defects: Faelan's generated reply was saved only in provider logs, and the model received founding age78 against the current resident's86. This repair extends the existing NPC interaction publisher and prompt context; it introduces no parallel memory store. A newly delivered generated exchange records its exact answer, input, delivery date, request identity and admitted speaker-life key. A duplicate publication keeps the first record/date. Canceled, empty, failed, replaced, other-world and stale-profile replies cannot be published by the hook. Existing factual work/personal replies and display-only legacy callers keep their paths. No generated wording is promoted into known facts, trust, a quest, skill or reward. Old provider logs are not backfilled into meetings.

Household model prompts now read the same current-life description as the rendered profile and the admitted family resolver, while saved biographies, equipment, capabilities and original personality data remain unchanged. Authored/non-household profiles retain their existing context. Three recent same-life generated exchanges can enter later model context as attributed words with an explicit warning that they are not independent world evidence. A normal What did we last discuss? topic quotes the latest delivered answer exactly, without another model call or another historical publication. Changed world/life and future/malformed history cannot supply that recall.

Three semantic regressions fail against the old behavior before repair. Final affected checks total122 distinct cases across seven suites, including14 new regressions. The seven edited source/test paths and separate authored-NPC fixture path typecheck with zero in-scope or suppressed errors. Three existing unsafe test casts lacked the required world seed; fixtures now supply a real seed, preserving the model/ownership assertions. One scoped header wave updates2 source headers, leaves2 current, skips4 tests outside the graph, and leaves10 dependent headers unwritten. Eight pre-edit byte snapshots and owned diffs are retained; EOL form is unchanged with no mixed endings. No full suite/build/push is claimed.

Actual source adoption preserves18 PRESENT groups exactly from the latest earned08:44:12/1006 autosave to08:45:03/1007, with the old message prefix exact. No old save import or rollback is used. The default-sandbox Vite child advertised readiness but native navigation timed out and a bounded fetch returned EACCES. That exact owned child was stopped, and the same explicit loopback3034 preview was relaunched with host network access. Actual document and changed module then returned HTTP200 before normal Continue. Peer camera/compass source stability was checked; none of their source, geometry or movement code was edited by this wave.

Native1440x900 Meet/Talk at temple168 initially offers no generated recall for the old provider-only exchange. One ordinary retained-undercity-account selection sends local phi4-mini:3.8b-q4_K_M with the unchanged CPU/4096-context/100-token settings. The actual prompt contains current age86 and Sten, omits founding age78, and is1435 characters versus the prior2015. Response HTTP200 is observed after80.806 seconds; server metadata reports80.275 seconds total,65.696 loading,6.107 prompt evaluation and8.434 generation for53 tokens. A shorter prompt is proved; faster conversational latency is not. The response attributes the carried Senna account and expressly declines to confirm it. Its leading speaker label and curious flavor remain literal generated wording, not independent corroboration.

Exactly one generated interaction is appended for npc_burg_675_member_b54:spouse, living occupant141. All75 prior memories retain known facts and history prefixes;17 non-memory groups remain PRESENT and exact. Normal What did we last discuss? quotes the exact newly heard reply and leaves history unchanged, with only one total model request. After manual Save08:49:25/1011, full document reload, normal Continue/To Player and physically reopened Meet/Talk, that same record/date/request key and quoted words survive. Recontact refreshes recency and selected-topic timestamps normally; the receipt separates that from preserved facts and histories rather than claiming the entire touched NPC memory is unchanged. Final normal same-default-slot Save is0351-01-06T08:51:16.000Z/1015, with all17 non-memory groups and the1011-message prefix exact. Generated history remains one record; no duplicate recall entry or model call is made. No new page error is observed.

Next make the reached priest useful through source-backed discussion of the physically read temple dedication. Reuse the existing topics, actual faith/office join and retained account; invent no personal belief, ritual power, shared history, corroborated undercity origin or quest. Dialogue cold loading still needs work. These bounded memory/identity results do not complete natural conversation, meaningful services, personal stories, willing companions or the full coherent-world goal. Continue from the actual later native save, preserving all earlier archives.

Ignored evidence under .agent/scratch/gameplay-flow/replies/: generated-memory-checks.json; generated-memory-source-audit.json and owned diffs; generated-memory-native-adoption-proof.json; generated-memory-native-delivery-proof.json; generated-memory-native-recall-proof.json; generated-memory-final-reload-proof.json; generated-memory-manual-before-reload-state/storage.json and final saved archive. Actual desktop delivery, immediate recall and reloaded recall captures were inspected. Canonical records remain authoritative; the shared Planmap projection is refreshed separately. MemPalace CLI remains unavailable; no mining is claimed.


## Inn terrain-pad alignment: source checks pass; native replay pending

Verified: 2026-10-29. Exact read-only regeneration matches all733 actual inn10
parts and324 neighboring terrain samples and reproduces the standing blockage.
A controlled ignored integer-node experiment admits the real1.8531429m body onto
the2.9388847m floor while retaining every inn part, source door and the three
nearby building datums. This supports correcting the pad sampling coordinates,
not shortening Sana, ignoring the head, raising the opening or forcing movement.

The existing pad builder now opts into height-sample positions at integer grid
nodes, matching groundSurfaceY and rendered chunk sampling. Its prior cell-center
coverage shifted pads0.762m. Existing water/other footprint callers retain the
same default cell-center behavior. No collision, standing-height, door-access,
building-part, schedule or saved-identity rule changes. The two existing files
retain all prior bytes by exact inverse, including interrupted river work; source
LF and existing test CRLF remain. One meaningful entrance regression fails first
on old source; final66 affected cases/four suites and three scoped paths pass
with0 errors/0 suppressed. Header pass is0 updated/1 unchanged; two tests are
outside the graph and69 dependents are not written. Source lease is released.

Actual old-source walking returns through the public lane to552.6378178147963/
443.70661962626576/Y3.016992116814958. Normal manual1793308497556, Day9
11:41:16, retains19.65GP/1067messages and the normally opened inn door. The
rendered street checkpoint is inspected. Verify the exact actual point against
both source versions before a controlled own-preview restart; do not migrate
feet when the soil changes. This earned street save supersedes earlier exterior
copies. Source adoption, physical entrance and new fullreload are PENDING.

Next qualify the candidate from this fresh earned save, then normally return,
walk the real open threshold, use supported inn furnishings/services and verify
native save/fullreload. Preserve any refusal and actual costs. No inn entry,
Gwen meeting, booking, meal or service is accepted yet; complete communities,
GF-G60 and the full goal remain OPEN. Tests do not replace this replay.

Ignored proof: inn10-runtime-pad-fixture.json; inn10-pad-regeneration-proof.json;
inn10-pad-node-counterfactual-from-backup.json; pad-before source/test copies;
pad-preservation receipts; pad-checks.json; pad-staging-walk-*; inspected
pad-staging-street-native.png; pad-staging-native/storage.json. One intermediate
scratch comparison was rerun after the source edit and compared repaired worlds;
it is superseded by the exact pre-edit-backup comparison, which re-verifies all
324 baseline samples. No production acceptance is inferred from that artifact.

## Clergy facts expose repeated-answer recall

Verified: 2026-10-29. The original Sana now plays two source-backed questions at temple 168: the physically read Elladan Pantheon dedication, including Nauclea, The Blue Eagle, and Faelan's actual succession to priest 378 days ago. The office chapter comes from chronicle event 204, subject 141 and predecessor 288. A shared name does not identify that predecessor with the seller named in the carried undercity account. No personal belief, magical power, service, quest or rumor confirmation is granted. The context questions lead the ordinary topic list; no model POST is used. Two exact attributed interactions are added to the existing history, preserving the earlier three records and known facts. Desktop topic, dedication and career images were inspected.

Source adoption preserves all 18 PRESENT groups from the earned 08:54:40/1018 autosave, with the full incoming message prefix and accepted feet exact. The reached body remains 481.05592650588636/419.66495132984807/Y3.2791682869737486, observer mismatch zero. No old save import, body override or source-geometry edit is used.

A further native experiment exposes a real memory defect: after repeating the dedication, What did we last discuss? incorrectly quotes the later first-published career answer. Repeated words correctly keep their first date, but first-publication order is not most-recent delivery. The exact native failure is preserved, not accepted as correct recall. One new semantic regression fails before the repair. The candidate now retains a last-delivered reference inside existing NPC memory while keeping the original words, source, date and history array intact; no second memory store or old-provider-log backfill. The affected suite passes 153 distinct cases across seven suites. Final seven-path types/header follow-up and native adoption/repetition/full reload remain pending at this record.

Next adopt that recency repair from the actual earned later save, repeat the older dedication after the career answer, and prove exact last-answer recall and original-record preservation through a full reload. Only then promote this candidate to bounded acceptance. Useful NPC lives, story hooks, services, personal quests, willing companions and the complete coherent-world goal remain active. Proof is ignored under .agent/scratch/gameplay-flow/replies/: clergy-statements-native-adoption-proof.json, clergy-statements-first-play-proof.json, clergy-statements-recency-native-red.json/png and clergy-statements-before-recency-fix-state/storage.json.


## Played entrance repair, Gwen and paid supplies

Verified: 2026-10-29. flattenBuildingTerrainPads opts into integer height-sample
coordinates in the existing quad helper. The bilinear sampler and rendered
chunk sampler already locate array samples there; pad coverage previously used
centers0.762m away, leaving raised soil under a correct door head. Other cell-
coverage users retain their default center test, including existing water code.
No movement, height, clearance, source-part or door-access exception is added.
Existing datums/parts and saved identities remain; this is a real soil correction.
Later shared GG-533 terrain-patch metadata edits preserve every owned pad span.
The qualified preview remains frozen on the tested prior source; that separate
wave is not accepted by this receipt and is not overwritten or restarted here.

The exact native inn fixture matches324 old heights/733parts. The adopted real
world retains the whole inn data, with67 soil samples corrected. Actual standing
entry and farther interior walking now work, and the paid General Store visit
survives fullreload with31 PRESENT groups/1081messages exact.66 affected cases/
four suites/three clean scoped paths support this bounded gameplay evidence.
This does not qualify every town, waterfront edge, prop or indoor circulation.

Saved business type/stock preservation remains intentional. Lodging separately
requires real guest-room beds and a source keeper on duty. Plot10's workplace
blueprint instead allocates upper bedrooms to children/head/spouse whose home is
elsewhere, with one unassigned bedroom and eight bed pieces in total. The real
UI consequently offers no guest bed. Preserve private permissions while tracing
nonresidential household allocation; do not silently reclassify a saved shop or
grant an unassigned bedroom. Native Map review changes neither actual feet nor
protected state. Mechanic receipts and current continuation are in TRACKER's
matching section; full connected routines, stairs, room use and lighting remain open.

## Source-backed clergy conversation

Verified: 2026-10-29. Ordinary physical priest Talk now offers the player's retained temple dedication and the living priest's canonical succession history. Exact source identity, current office and historical reading validation gate the statements. The original Sana plays both questions, repeats dedication after career and correctly recalls dedication through a full reload, without duplicating history or granting world facts. Seventeen PRESENT non-memory groups,75 NPC facts/histories,74 other complete memories and the last-delivery reference remain exact. Useful religious services and routine/quest acceptance remain open. The detailed receipt is [Clergy discussion and repeated-answer recall verified](../../projects/gameplay-flow/TRACKER.md#clergy-discussion-and-repeated-answer-recall-verified); the memory contract is in [NPCs / Companions](npcs-companions.md#spoken-dialogue-content-and-delivery-order).

## Separate workplace rooms and paid guest permission

Verified: 2026-10-29. The town household brief now marks a separate workplace
with residential:false while retaining the full proprietor slots, trade and
source home. Room programming excludes that remote family's sleeping and servant
quarters. Upper floors use the existing building-type filler: guest rooms for
an inn and studies for a school. Basements and legacy/residential behavior stay
unchanged. The brief memo digest distinguishes explicit scope without changing
legacy keys. No occupation, household, permission or saved-business migration
is introduced. The existing bounded stair planner is retained.

The played Menaikon inn10 has eight genuine unassigned guest beds, and school11
has no beds or family sleeping claims. Home71's entire plan hash stays exact.
Actual Sana reenters the inn, receives Gwen's Room1/floor1 offer and pays5SP;
14.64GP becomes14.14GP without moving or recovering. Existing business/stock,
inventory, party and NPC memories stay exact across payment. Normal full reload
retains31 PRESENT groups and1087messages exactly. Sana then climbs both real
return flights, from floor2.938885 through landing4.462885 to upper5.986885.
Walking fully onto the landing before turning clears the central guard without
changing geometry or movement rules. A further normal full reload preserves
31 PRESENT groups and1088messages exactly at the upper threshold.

The rendered upper plan and source door graph expose another GF-G60 issue:
Room2 is guest accommodation on the route from the stairs to paid Room1.
Existing private-room door weighting and ground-floor public-hall programming
are the reuse points; do not waive privacy or invalidate paid bed1:0/room0.
Bed arrival/use, sleep, school room replay and whole daily routines remain open.
See the matching TRACKER section for the source and gameplay evidence boundary.

## Lead figure screen coverage in an interior camera

Verified: 2026-10-31. FreeRoamCameraController supplies its actual perspective camera to createPlayerCameraSelfVisibility. In an enabled player-follow view, the helper projects the bounds of the visible lead meshes, excluding the projected shadow and hidden equipment. A central figure covering more than 55 percent of viewport height receives the existing camera-owned silhouette. Coverage below 45 percent restores the source materials; the older near-body distance hysteresis still applies. Offscreen figures and callers without perspective evidence keep the existing proximity behavior.

The helper changes only its own material clones, including the named entity-ink alpha. It does not hide or move the physical figure, change wall/door geometry, fade residents or companions, or rewrite an appearance update. Leaving player follow restores the source-owned appearance. The actual open-door and closed-door replay demonstrates why a solid leaf can still obstruct an NPC after the lead silhouette becomes readable. Ordinary door use and To Player then recover a longer arm and restore the opaque figure.

The affected 47 cases and three scoped type paths pass. Earned normal source adoption and final full reload each preserve 18 PRESENT groups and all 10 recorded geometry hashes. This bounds the material repair; actual dark-room lighting, narrow interior sightlines and label usability remain open under GF-G60/GF-G92. See [The lead figure no longer hides the inn conversation](../../projects/gameplay-flow/TRACKER.md#the-lead-figure-no-longer-hides-the-inn-conversation).

## Neutral interior fill calibration

Verified: 2026-10-31. InteriorLights retains its single neutral camera-inside fill with the existing same-shell player anchor, 2.7 m vertical placement, 14 m range, decay 2 and smooth admission fade. The target power is 24. This is a render-side readability aid, separate from the source hearth schedule and four-light hearth cap. No world light is lit, fuel consumed or game fact created by entering its admitted view.

The current noon inn replay compares the original 1.15, rejected 8 and 64 candidates, and the final 24 setting. Actual Town Cell makes the fill invisible; To Player restores it. The invisible instance may retain a nonzero intensity property from its last visible frame. Check its visibility as well as its stored intensity. Current native adoption and full reload retain 18 checked groups, the message prefix, the closed door and ten geometry hashes. Eighteen lighting checks and one scoped type path pass.

This qualifies the current inn and natural hour, not every room or night. Narrow camera sightlines and the played Examine hearth hover opening a resident profile remain under GF-G60/GF-G92. A clear pointer reaches the existing Hearth inspection normally; no new hearth action or inventory effect is implemented. See [Readable inn lighting and a misleading furnishing hover](../../projects/gameplay-flow/TRACKER.md#readable-inn-lighting-and-a-misleading-furnishing-hover).

## Resident body hover ownership

Verified: 2026-10-31. InteriorOccupants gives an interactable resident body the same hover admission as its existing primary-click owner. The group stops hover propagation, so R3F clears farther furnishing hover records; the body owns a pointer cursor until leaving, unmounting or losing interaction. Unadmitted street residents and bodies without a resident callback do not consume hover. Nonprimary pointer-down remains available to camera gestures. This does not alter actor motion, interaction reach, geometry, privacy or current business ownership.

Actual desktop play qualifies an innkeeper in front of a hearth: resident hover no longer advertises the farther hearth, primary selection opens the resident, a clear hearth still opens its inspection, and a right drag changes only camera pose. Forty-one affected checks and two scoped type paths pass. Full Save/reload preserves 18 checked state groups and 10 geometry hashes. The cramped room and blocked southward passage remain open. See [Resident hover now agrees with the clicked person](../../projects/gameplay-flow/TRACKER.md#resident-hover-now-agrees-with-the-clicked-person).

## Public common-room seating after household layout

Verified: 2026-10-31. householdFurnish retains its established furniture and bed-layout pass, then attempts one bench in each main common room that lacks one. It uses the same full-size footprints, clipped cells, door/stair approaches and 0.8 m walking graph. It appends the seat after stable room ordering; old furnishing indices, saved container joins and manifests retain their original meaning. Private halls and other purposes do not enter this pass. A room without enough physical clearance remains without a seat.

The canonical Menaikon inn, plot 35 in seed 1793146029630, appends a rotated bench at ground-floor index 7 without moving any of its prior furniture, rooms, walls, doors or stairs. Actual desktop play reaches it, opens its existing PublicSeatRestAction and completes the normal one-hour, zero-dice rest. No seated animation is added; the simple furnishing model and cramped camera remain open. The action reuses current-room reach checks and normal rest review rather than bypassing rest limits, lodging or privacy. Reload keeps the earned rest count and the next review refuses an early repeat. Twenty-six affected cases, two scoped type paths and native 18-group reload are qualified. See [A real public seat and an earned inn rest](../../projects/gameplay-flow/TRACKER.md#a-real-public-seat-and-an-earned-inn-rest).

## Nearby town door actions

Door state (GG-580). Verified: 2026-11-02 (unit tests and a headless World3D
demo profile). The scene keeps the live door state in one store per scene
(`groundDoorStore.ts`): the player's saved opens merged with the doors that
residents use now, and the resident names at each door. `GroundFurnishingContext`
carries the store as `doors` and holds no door values, because every building
reads that context. Each `BuildingDoor` subscribes to its own door key, so a
resident at one door renders that leaf only. `NearbyBuildingDoor` and the
resident actors read the store in their frame loops. The movement solver
(`groundBuildingMotion.buildingsFor`) keeps one set of solids per state of each
building's own doors, so a door change rebuilds only that building.

Verified: 2026-10-31. NearbyBuildingDoor derives candidate entries from mounted canonical town buildings and samples the actual supported footfall at ten hertz. It nominates one leaf within 1.5 m and the existing floor tolerance, independent of camera target, orbit or a requested movement destination. World3DWrapper displays its ordinary desktop action using the shared Button. The dungeon view's nearby-door controls are the reused presentation pattern.

Activation rechecks the current source, footfall, pause state, displayed open/close state and resident use before calling the existing GroundFurnishingContext onDoor route. The original asynchronous handler remains authoritative for the refreshed plan, fresh actual body, room and swing clearance. Candidate range alone is not admission or permission to enter a household. Commitments, combat, workbench use and suspended scenes hide the prompt. Unmount and range withdrawal clear it. Transient resident opens remain separate from player-saved state.

Actual desktop play opens the inn door, walks onto exterior ground, preserves the threshold close refusal, steps clear and closes it. The card withdraws with distance. A private resident contact is refused from the street; her identity and memories do not change. Twenty-nine checks and four scoped type paths are clean. Final normal Save/reload retains 18 groups, the met list and ten source geometry hashes exactly. Camera comfort and public-contact discoverability remain open. See [A nearby door action reaches the street](../../projects/gameplay-flow/TRACKER.md#a-nearby-door-action-reaches-the-street).

## Vertical clearance notices

Verified: 2026-10-31. resolveHorizontalMotion annotates an actual winning overhead contact during supported walking when it blocks the upper half of the measured standing figure. A mixed/full-body wall contact retains the generic refusal. resolveGroundWalk also names its existing low-ceiling rejection. GroundWaterWalk carries that reason through its ordinary movement budget. PlayerAvatar then explains the actual lack of clearance and suggests stowing tall gear or seeking a higher opening. Steep slopes retain their own notice. No source part, body width/height threshold, footing, door state or access permission changes.

The current standing envelope includes actual equipped gear. Its authoritative player mapping is described in [Entity Studio](entity-studio.md#empty-player-equipment-is-an-explicit-render-choice). Actual Golden Barrel play validates staff-equipped refusal and the notice, followed by normal stow and passage onto the public floor. Thirty-seven affected building/water movement cases cover overhead, ordinary walls, standing bodies and the retained movement rules. The [native receipt](../../projects/gameplay-flow/TRACKER.md#stowed-gear-clears-a-real-inn-doorway) separates this from the still-unaccepted indoor camera and furniture access.

## Workplace fallback stairs preserve doorway circulation

Verified: 2026-10-31. generateBuilding retains existing return-stair admission. When a nonresidential workplace retains its legacy compact flight, it now checks its reserved cell against stairDoorCells for every floor. If the original conflicts, a deterministic candidate search prefers the ground main room and proximity to the original; each candidate must avoid all doorway cells and leave its owning room connected on every floor. The furnishing pass reserves the chosen cell. If none qualifies, generation retains the original rather than deleting rooms or floors. Residential and briefless plans keep their established behavior.

This changes fallback stair placement and fitted furnishings, not door identity, room boundaries, floor footprint, storey count, collision policy or access rights. The actual Grangengen library entry remains x7.5ft,y0,axis x. Its three studies and all basement/upper room identities remain. Native normal walking enters the real ground floor; the first visit and mounted XYZ survive a21-group full reload.25generator tests and2scoped type paths are clean. Compact climbing, wider-world adoption at accepted poses and camera comfort remain unqualified. See [A library entrance with room to walk inside](../../projects/gameplay-flow/TRACKER.md#a-library-entrance-with-room-to-walk-inside).

## Nearby furnishings and household conversation ownership

Verified: 2026-10-31. NearbyFurnishing indexes mounted town furnishing parts once per source set and deduplicates multi-box identities. At ten-hertz sampling it uses actual feet for floor/radius nomination, loads only nearby canonical building plans through the wrapper's lazy current-world/history resolver, and applies furnishingReachError for room, floor, range and original piece identity. Cached async plans belong to their current source generation. Activation rechecks mounted candidates and feet before delegating to the existing examination owner; permission, reading, rest and owned goods retain their established checks.

World3DWrapper places the shared Button actions in a desktop dock with nearby doors. Inspection and resident profiles suppress the furnishing prompt. Paused/suspended/combat scenes withdraw it; retained callbacks after walking, unloading, source change, pause or unmount cannot select a piece. The same wrapper commitment hold now includes isDialogueInterfaceOpen, the household dialogue path, alongside companion conversation and reading/rest. It withholds physical interactions and walking until the conversation closes.

Actual library play reaches and reads the existing staffed chronicle, meets Gwen and recalls her original source family words after reload. Native household dialogue initially permits movement; the repaired W/D replay preserves feet/camera exactly, and close restores actual walking.44affected tests and5unique scoped type paths pass. Two native21-group fullreloads retain all checked state and mounted XYZ. Source-appropriate holdings, dungeon-history access, NPC personal quests, compact climbing and camera comfort remain open. See [A readable chronicle and a librarian who remembers](../../projects/gameplay-flow/TRACKER.md#a-readable-chronicle-and-a-librarian-who-remembers).

### Reached object location and focus

Verified: 2026-10-31. The nearby publisher adds a view-only detail string after the shared physical admission: current room purpose, world compass bearing to the rendered part center and rounded nearest-surface distance in feet. Its publication signature includes that hint so ordinary movement can refresh the description without changing object identity. Activation still re-reads the original candidate, source plan and actual feet.

NearbyFurnishingChoices keeps the shared Button action and lets pointer hover or keyboard focus nominate one building/floor/furnishing key. Leaving a pointer choice restores any remaining keyboard focus; removed choices and unmount withdraw it. World3DWrapper carries this transient focus through World3DScene's existing GroundFurnishingContext. FurnishingFocusMarker renders a depth-tested outline at that original part's local pose. The site group supplies the existing rotation/origin; the outline has no raycast or collision role and its geometry is disposed on replacement/unmount. No persistent state, access, goods or schedule changes.

Sixteen affected cases and eight clean scoped paths cover source guards, moving/rotated hints and selection/focus identity. A captured actual Stamstad bench pair has inspected 1440-pixel pointer/keyboard and bundled-client component renders. This implementation remains unadopted in the protected campaign pending coherent GF-G93 source compatibility; these captures do not qualify native gameplay selection or whole-world performance. See [native return and candidate limits](../../projects/gameplay-flow/TRACKER.md#the-temple-return-stays-intact-and-furnishing-choices-gain-an-identity).

## Source-owned ordinary library volumes

Verified: 2026-10-31. containerManifests retains its original goods rolls, then appends6–12Book items only for shelf furnishings in study rooms of library plans. A separate library-books:<level>:<index> stream preserves old rows, neighboring draws and all owners. Non-library and cellar/storage output is unchanged. This is new canonical generated stock, not authored subject matter or an accuracy/access/skill grant.

ShelfDisplay reuses its existing ledger cover/page/spine geometry for ordinary book. It gives those new volumes visible bays before bulky legacy supplies while keeping its existing six-bay budget, full-source examination and no-invention rule for absent stock. Existing shelves without Book keep their prior render order. Geometry remains inside the existing catalog footprint in all four facings.

Actual Grangengen library receives59books across6study shelves, with all15old manifests' identities/owners and entries exact and the same complete plan/household. Native examination and a camera-only side view show six books on the reached shelf beside its preserved supplies. Mounted render counts agree; full reload retains21state groups/XYZ and the complete regenerated manifest.9affected checks and4scoped type paths pass. Generic Book accuracy, subjects, equipment classification, useful world-history accounts and camera comfort remain separate. See [Library volumes belong on the shelves](../../projects/gameplay-flow/TRACKER.md#library-volumes-belong-on-the-shelves).


## Source-bound regional library accounts

Verified: 2026-10-31. libraryCollectionForVisit requires an owned-book civic library and derives a bounded collection from its present realm's world chronicle and existing public town waterworks. It does not generate dungeon plans or expose their logs, creatures or entrances. The physical desk producer retains its actual reach/staff-arrival checks and supplies full-world, plot, furnishing, accepted-position and history context. currentLibraryCollection rechecks context, source history, current town, valid public desk and opening hours; old reading copies have no new collection grant.

Explicit Read alone emits frozen LORE_DISCOVERY through ADD_DISCOVERY_ENTRY. Full-world/library/source/content identity preserves first reading dates and read state on repeats; changed source words remain a distinct account. No locationId/hiddenSiteId flag, travel, quest, reward, goods transfer or consent is emitted. The reader binds selection to the exact world/library/words. Broadsheet retains frozen keepsake/live-news behavior. DiscoveryLogPane gives these accounts readable library attribution while preserving complete saved provenance.

Native Grangengen has four Hafrostia histories and Menina's municipal register. Three explicit readings, journal selection and repeat-read behavior are desktop inspected;23PRESENT groups/XYZ, original memories and source plan/household/manifests survive full reload.44affected checks and13unique scoped paths pass. Representative collections, actual journey/entrance access, furnished circulation and camera comfort remain open. See [Regional library accounts with a memory](../../projects/gameplay-flow/TRACKER.md#regional-library-accounts-with-a-memory).


## Building comfort and furnished-space framing

Verified: 2026-10-31. The explicit building-comfort lane extends the existing household brief, room program, real-size furnishing, stair, economy and interaction owners. Its acceptance and current gameplay evidence live in [the gameplay tracker](../../projects/gameplay-flow/TRACKER.md#building-comfort-first-inn-replay), with GF-G110 open.

playerCameraFrame now tries a three-meter horizontal arm between four and two when the actual mounted structure supplies the sightline query. A played Howling Shield passage admits3but rejects4; previously the camera unnecessarily collapsed to2. Existing no-scene walking sweep, terrain/opaque-structure rejection and all physical geometry remain unchanged.18affected cases and two clean scoped paths support the repair. Normal fullreload/explicitLoad/resave retain32present state groups and the exact inn plan. The inspected desktop remains cramped and can put the innkeeper's head in the foreground; no general interior or camera acceptance follows. GF-G93 source migration remains a separate unresolved requirement before established layouts are changed.

The same building lane subsequently plays an actual common-room/front-door street exit and re-entry with normal leaf operation, retaining the swing refusal and blocked approaches. Fullreload/explicit manualLoad/resave preserve32PRESENTgroups, exact returned feet and the closed townSim building35 door. This is one public route, not general comfortable interiors or NPC/stair acceptance. See [the doorway receipt](../../projects/gameplay-flow/TRACKER.md#building-comfort-normal-inn-doorway-round-trip).


### Clear compressed lead view and exact guest-bed actions

Verified: 2026-10-31. playerCameraSelfVisibility suppresses color/depth writes on lead-only owned clones during compressed/crowded follow views, retaining visible geometry and positive opacity for physical measurements. This replaces the layered8%alpha haze; blobShadow is excluded from crowding evidence but suppressed with the body. Clear/map views restore exact originals. Residents/companions and world materials remain unchanged. GuestBedRestAction reuses the existing guest catalogue/active reservation and exact level/index/room reference to show use only for the booked guest bed. The original handler still owns fresh reach and rest admission. Native paid stair ascent, wrong-bed refusal/hint, exact bed rest, desktop haze removal and32-group fullreload are documented in [the current building milestone](../../projects/gameplay-flow/TRACKER.md#building-comfort-paid-stairs-truthful-beds-and-clear-close-view). The adjoining-room access and wealthy household bed shortage remain open; no layout/ownership migration is performed by these presentation changes.


### Bed appearance and established building sources

Verified: 2026-10-31. BedDisplay replaces the bed box rendering with merged colored timber, mattress, blanket and pillow geometry inside the same1x2x0.6m catalog envelope. interiorParts adds optional original bedFacing; Scene applies the same site reflection used by asymmetric shelf detail. The source part still owns collision/pick, floor/index/room, booking and permission. No movable goods are created.67affected cases/5clean scoped paths and inspected native/fullreload32group parity support this bounded presentation change; household-specific luxury and actual usable clearance remain open.

The event/door/evolution journals do not themselves freeze complete original rooms, furniture, households or manifests. The observed-source records below now retain exact seen foundations, while blueprintForPlot and current physical/interaction readers still reconstruct through the generator. Consumer adoption, deliberate structural migration and historical GF93 repair remain unfinished; the renderer change above does not qualify them. See [current source audit](../../projects/gameplay-flow/TRACKER.md#building-comfort-recognizable-beds-and-saved-source-boundary).


### Physically observed building-source capture

Verified: 2026-10-31. TownSimState.buildingSources optionally stores version1 ObservedBuildingSource records by canonical plot. Old saves omit them. Successful ordinary furnishing reach compares the mounted worker blueprintSignature to the current inspection plan, then captures a JSON-owned complete plan, ordered named household when present, exact generated container manifests/owners, workplace scope, world/burg/plot/cell, observation time, accepted XYZ and site transform. The provenance is observed, never a fabricated historical original. The signature is a source-drift detector, not cryptographic authority or permission. Older workers without it can still inspect but cannot establish the record.

RETAIN_OBSERVED_BUILDING_SOURCE rechecks world/cell/history/current accepted feet, including a real height, and appends only when no record exists. It preserves all prior town fields and every other game field. Later inspection cannot overwrite the first source. Capturing grants no item, access, rest, meeting, movement or fictional renovation. Existing daily town advancement continues and retains the record. Recording alone does not yet make rendering, occupancy, examination or goods consume that source, nor reconcile later life/structural events against it; these remain the immediate dependency before layout changes. [ADR0012](../../adr/0012-observed-building-source-retention.md) records this bounded persistence decision.

Native normal bed examination in the retained Howling Shield captures3floors/26furnishings/9ordered household members/17manifests owned byb34,30,185JSONbytes, at0351-01-07T00:11:23Z. All31other checked groups and all pre-existing town state remain exact after adding onlyplot35. Ordinary fullreload/Resume/explicitmanualLoad/re-examine/resave00:12:55to00:14:25 preserves32PRESENTgroups and the complete record byte-for-byte; its timestamp is not rewritten. Exact feet, used paid night, gold20.27 and belongings remain. Nine affected tests/3suites and8scoped paths plus final test recheck are clean. No consumer-retention, migration, representative-building or full-goal acceptance follows from this capture foundation.

### Retained-source readers and compatibility boundary

Verified: 2026-10-31. readObservedBuildingSource validates the full world/burg/plot, canonical town seed, complete plan signature and original manifest floor/index/kind/owner joins. It returns independent saved plan/household/workplace/manifests. blueprintForPlot bypasses fresh generation for an observed source. The worker and loader carry the registry; occupancy and interior projection reject a mismatched precomputed plan. Normal physical visits, the map inspector, rest/lodging, attendance, discovery and library readers receive that same source. Capturing an identical mounted foundation does not restart the walking scene. Above-ground height uses maximum floor level, excluding basements.

Equal event digests preserve the observed plan exactly, including equivalent journal compaction. Later condition history replays through the existing applyHistory owner. New structural masses currently require an explicit retained-source migration and surface a refusal. Compaction preserves those pending events rather than rerolling them; a fold preceding the observation anchor likewise waits. This interim boundary does not complete structural migration, future household evolution, whole-town placement retention or historical recovery. Layout changes still require reference/ownership/accepted-position-safe admission. Native32-group adoption and113 unique affected cases are bounded evidence, recorded in [the live-reader milestone](../../projects/gameplay-flow/TRACKER.md#building-comfort-retained-sources-now-drive-live-readers).

### Recorded bedside-storage clearance correction

Verified: 2026-10-31. buildingLayoutRepair extends the existing catalog footprint and observed-source readers with bedside-storage-clearance-v1. It moves only an existing chest toward the opposite room wall when the real bed/chest gap is below0.8m and the new gap reaches that width. Full catalog rectangles must remain inside actual room cells with wall margin, clear other furniture, doorway approaches, stair shafts and landings. A body-width room graph checks doorway connectivity and reachable furnishings; unsupported cases retain their layout. Rooms, beds, doors, furnishing indices, household identity, manifests and owners are not regenerated. No global generator recipe changes.

ObservedBuildingSource keeps its complete original observation immutable and optionally appends a version1 furnishingRepair receipt: exact from/to floor/index/room/kind moves, recipe, admitted time and accepted XYZ. The reader recomputes the exact proposal before applying it; changed/corrupt moves refuse. The existing town reducer admits only the current full world/source/cell for a single-person party outside a3m margin around the building. Missing height, inside/stair poses and unadmitted companion positions defer. The physical wrapper also requires fresh mounted feet, exact state acknowledgement, one second stationary and no pending click route. Only a newly admitted repair rebuilds the source scene. This is a bounded furniture correction, not structural migration or a fictional renovation event.

Native Howling Shield correction moves upstairs room0/chestindex1 fromx6.2842519685to8.7157480315ft, retainingy1.9404199475androtation90. The gap widens0.524to1.26512m. Ordinary descent, half-landing turn, street exit/return, door close, ascent and bedroom walking pass; the body reaches the former chest volume. Normal examination retains2sewing kits/3tallow candles/1silver/2gold owned byb34 and grants no take or new rest. Parent VIEWED the turned desktop aisle. Independent guest access, actual other-room clearance, GF-G113 capacity, multi-person admission, structural and future-household migration remain open. The new receipt and exact reload proof belong in the owning gameplay tracker.


### Recorded independent guest circulation correction

Verified: 2026-10-31. guestCirculation extends existing roomWithCells, buildWalls/mergeWallRuns, solveRoof, catalog footprints and roomFurnishingsReachable with a bounded left-return-guest-circulation-v1 proposal. It recognizes the inspected30by25ft inn family, adds two rear footprint cells within the same envelope and creates a public upper landing/hall connected to all four retained guest rooms. Bed/chest floor/index/kind/room joins, ownership manifests, household, original entry, site origin and stairs remain. Full furniture-cell rectangles and half-foot body-route sampling reject blocked proposals. Thick retained masonry and thin partitions remain distinct merge groups. History targets remap only to equivalent wall spans or coplanar roof regions.

ObservedBuildingSource optionally appends circulationRepair: version, recipe, foundation signature, complete frozen plan/signature, qualified door from/to keys, admitted time and accepted XYZ. Read validation checks original references and manifests and consumes that frozen plan rather than a future proposal recipe. Existing source and furnishingRepair are immutable. The town reducer requires the full current source and mounted signature, one-person party, world/cell/tile/height agreement and outside3m envelope. Door aliases retain original keys and refuse conflicting destinations. The wrapper requires fresh actual/acknowledged stationary feet and no click route. Only admitted correction signatures invalidate the relevant source caches/scene. Unsupported families, party walls and unhandled live structural histories retain their foundation. This is a compatibility correction, not a world-history renovation.

The real first rebuild exposed patched-wall history on the old outer wing wall now enclosed. buildBuildingHistoryParts now draws patches on retained inner masonry too; other exterior evidence and missing-target guards stay. Production history projection preflights admission. The complete interior-parts test and same-save native reload exercise that path; no old checkpoint replaces the failed revision. Native normal entry/stairs/all four independent room visits, owned chest examination and final32present-group fullreload are qualified for675/35. Tight door/stair approaches, a striped wall artifact, NPC movement, other households/wealth/occupations, capacity and broader migration remain unfinished. [Owning receipt](../../projects/gameplay-flow/TRACKER.md#building-comfort-independent-guest-routes-survive-a-structural-correction).


## Fitted civic building names in the walking world

Verified: 2026-10-31. groundChunkLoader reuses the already resolved fitted or retained blueprint.type to name library, school, shrine, guildhall, civic and temple landmarks. BUILDING_LABEL owns the shared population labels; the blueprint-only temple type uses Temple. Registered or deterministic trade names retain precedence. Private homes remain unnamed. The existing GroundWorld building name/unlabeled fields carry this presentation to chunk labels and NearbyBuildingDoor, including remapped ground windows. No new status store, geometry generation, discovery, person registration or access permission is introduced.

The actual Stamstad library's mounted parts and blueprint signature remain exact across adoption. The source-bound public desk route, chronicle and two regional-account readings are played; the door/world label reads Library and ordinary guarded opening/exit/close is verified.28-group save/reload retains accounts, possessions, memory and unused paid booking. Three selected production integration cases and two clean scoped paths cover civic labeling and preserved business/keeper naming; they are not a full generator-suite claim. Blank procedural fingerposts still have no destination text. See [native reading and civic naming](../../projects/gameplay-flow/TRACKER.md#a-staffed-library-lends-real-histories-and-has-a-visible-name).


### Facade dressing at concave wall returns

Verified: 2026-10-31. interiorParts facadeExposedSpans subtracts perpendicular wall volumes intersecting a run's outward facade-depth interval before placing facade posts or horizontal bands. At concave courtyard returns this keeps decorative trim out of adjoining masonry; otherwise a post can sit exactly on a bedroom inner face and flicker as a stripe. Convex corners, original wall structure, collision, frozen plans, histories and reference/ownership data remain unchanged. Four corner directions/two facade grammars and the actual retained inn are covered;76affected cases/two scoped paths pass. Matched native92degree before/after and fullreload32present-group exact continuity qualify the specific render repair. [Owning native receipt](../../projects/gameplay-flow/TRACKER.md#building-comfort-courtyard-trim-no-longer-stripes-a-bedroom-wall). Tight doors/stairs, NPC passing and representative household fit remain open.


### Measured household circulation is stricter than furnishing reach

Verified: 2026-10-31. The furnishing body-route graph uses0.8m passage and the geometry resolver uses a conservative0.6m square. PlayerAvatar and InteriorOccupants separately register actual mounted body bounds in ActorPersonalSpaceContext; clipActorStep protects those bodies after geometry admission. A route passing the first graph/geometry check can still fail around a resident. Actual home34 demonstrates a clear parent-to-child doorway blocked by yielding Ysolde against Sana's0.896×0.733m measured footprint. That evidence requires household/circulation planning to account for real turning and passing, not weakening actor collision. The existing sleeping-room claims also leave Loran in the hall with no furnishingIndex because nine people have eight beds. Normal table examination captures its full observed source, and32group exact reload preserves it. [Owning native diagnosis](../../projects/gameplay-flow/TRACKER.md#building-comfort-the-hartham-home-exposes-a-body-and-sleeping-space-shortfall). Source sleeping activities still render upright models; proper sleeping poses and furnished routines remain unfinished.


## Retained town layout reader and measured runtime precision

Verified: 2026-10-31. GF-G93 now has an explicit revision reader in canonicalTown: revision1 retains the earlier town engine/street network, while revision2 remains the default and preserves the approved eight-rule town-look direction. Plan and personality caches include Atlas identity, world seed, burg and revision. Unsupported revisions refuse. This is a reconstruction seam, not saved-world admission or relayout acceptance.

For protected Gwyn/Stamstad (world seed1793432134128, burg188), the new revision1 reader reproduces the captured normalized plan, artifact and founding roster byte-for-byte in the retained Chromium runtime. The normalized plan has65plots; the founding roster has237people, including original Tomas Dunfield/b20:head. These counts are distinct from the retained67ground buildings and226living/civic projection. No campaign data, player position, clock, permissions or world knowledge was changed for this pure calculation check.

The initial Node artifact hash failed. Recursive comparison found exactly49footprint coordinates differing by at most5.684341886080802e-14town units; all other artifact values and every founding roster record were exact. The Chromium reconstruction matches all three original hashes. The unit artifact check therefore rounds only footprint coordinates to a billionth of a town unit; normalized plan and entire founding roster remain exact hashes. The original captured references are unchanged.32affected cases across canonicalTown and townLayoutRevision pass;5source/test paths typecheck with0in-scope and0suppressed errors.

Limits: the retained browser has cached earlier dependencies, so this calculation is evidence for the new revision1 reader in that environment, not proof of a fresh coherent source cut or the latest revision2 world. The later saved-revision milestone below records new-town selection and revision-aware registration, roster, ground and merchant readers; the later building-reader milestone extends map/visit/service propagation; historical admission remains unfinished. Missing save revisions must not be guessed. Observed building anchors and saved people/families/jobs/possessions/access need guarded admission, and an intentional newer-layout migration still needs explicit joins and physical support verification. The resident selector and furnishing-target UI remain unadopted in Gwyn's campaign. Next establish that shared per-town revision/admission contract, then qualify native interactions and continue the meaningful character/exploration journey. The full gameplay goal remains open.

Ignored evidence: .agent/scratch/gameplay-flow/replies/town-layout-v1-reference-full.json, town-layout-v1-reference-hashes.json, town-layout-v1-browser-candidate.json, town-layout-v1-adapter-diff.json and town-layout-v1-reader-provenance.json. Raw recovery captures are never imported into saves.


## Saved town revisions reach registration and ground generation

Verified: 2026-10-31. New canonical TownSim registrations now record the selected layoutRevision before backstory simulation. Revision 2 remains the default. Explicit revision 1 survives daily advancement and JSON serialization. This uses the existing town save, not a second population or status store. [Decision and limits](../../adr/0013-saved-town-layout-revisions.md).

Growth hydration reads a known saved revision and preserves the original people, chronicle and building histories. An unversioned old town is left unresolved; re-registration does not guess a revision or attach growth from today's lots. History compaction keeps its complete chronological building prefix until the source is known. Explicit revision-1 compaction preserves replay. Daily life can continue without that storage optimization.

The existing read-only life projection now carries known layout selection through the main-thread/worker request. Ground plans and their water/deck geometry use the same revision. A production worker-core test emits the selected earlier artifact plan and exactly its building plot IDs, leaving supplied life data unchanged. Merchant generation reads the same saved selection; focused checks cover original plot joins and unchanged already-owned stock/identities. This is runtime generation evidence, not rendered campaign adoption.

Checks: registration/history suites finish with 14 passing cases and one existing century-lifecycle fixture failure. Worker generation adds 3 passing cases. Selected merchant identity checks pass 5 cases, with 6 unrelated cases explicitly excluded by the name filter. Across these four files: 22 pass, one existing failure, six skipped. Twelve affected source/test paths finish with zero scoped and zero suppressed type errors. The initial merchant test sort exposed two optional plotId type errors; the assertion was corrected and both its focused suite and scoped typecheck rerun successfully.

The retained century assertion expects a ruin event in the current seed 12345/burg 512's event tail. It fails before and after this wave: an isolated counterfactual uses captured pre-edit registration/compaction plus the unchanged registry, and the complete 100-year town state is byte-identical after excluding only the new layoutRevision field. Both hashes are 76d54d34e90a92baaa0c72c2ba90e20e98b94f6c099d1e4170891d5502930cb8; neither has a raw ruin or ruined folded snapshot. The assertion remains unchanged. This fixture needs requalification under the current default generation; it is not counted as a green lifecycle or silently rewritten to match the new output.

One scoped advisory wave updates four headers and leaves four unchanged; 102 dependent paths are reported without being written. A transient agentLife write required four attempts through writeFileWithRetry; its resulting change is limited to the owned life-projection type/comment and scoped advisory. Existing source changes remain preserved. Original 3034 and driver 46704 are still live; Gwyn remains paused on World Map at the retained temple-return checkpoint. A read-only IndexedDB check confirms the original Sana default wrapper is byte-identical.

Remaining GF-G93 work: guarded admission of missing historical revisions, consistent map/visit/service/directions and routine readers, a coherent source cut, all town/person/job/site/paid-room/goods/door joins, and physical support/full reload qualification. Unversioned ground and merchant callers still retain their earlier default behavior; this wave has not made their historical source safe. No existing campaign received a revision or migration, and the native resident-selector/furnishing-target candidates remain unadopted. Intentional adoption of the approved newer town layout and the full meaningful-life, companion-story, exploration and visual gameplay goal remain open.

Ignored proof: layout-registration-lifecycle-counterfactual.json, implementation/baseline helpers and registration-before-/ground-revision-before- source captures under .agent/scratch/gameplay-flow/replies/. Counterfactual inputs are disposable source copies, never campaign edits or imported world graphs.


## Household room programs, reference drafts and the reached poor-home boundary

Verified: 2026-10-31. Activity entry reservations consume BlueprintDoor.clearWidthFt through doorClearWidthFt for opening and inward sweep; omitted fields keep the established three-foot policy. Explicit mealForSlot room tags require a real table and keep a crowding shortage in its assigned room. Interior transit policy is unchanged. The pure householdLivingPlan proposal and householdLayoutReferences draft are not generator defaults or save-admission mechanisms. They check1.2m furnished room routes/full swings, age-aware grouping and24hour station capacity, and map original objects/beds/owned manifests without rolling extra goods. Removed/private-through door-state policy remains unresolved; added storage is empty and owned. See the [routine/reference gates](../../projects/gameplay-flow/TRACKER.md#building-comfort-daily-routines-and-original-possessions-gain-explicit-gates).

The independently started fixed-source Serganellori Greendown case demonstrates a different problem: poor25x15ft single-storey cottage, fourresidents/twobeds, with no bedding objects for two children, no kitchen seating, and a5x15ft internal corridor. Actual normal entry/door close/hall and corridor/kitchen passage, private-bed refusal, owned-barrel/table examination and31-group fullreload qualify this observation. Camera and alignment remain uncomfortable; no sleep/seat/NPC-passing or overall comfort is accepted. The fixture poorHome is the first physically captured source, not an inferred historical original. Existing richer home/inn fixtures and Sana32groups remain unchanged. [Played evidence and next design action](../../projects/gameplay-flow/TRACKER.md#building-comfort-a-poor-familys-hall-and-kitchen-are-reached-on-a-fixed-fresh-source).


## Building readers keep their source and routine reports respect life history

Verified: 2026-10-31. Known saved layout revisions now reach map plans/personality, building choices/visits, inspector and nearby furnishing resolution, building discovery, library collections, business attendance, lodging offers and reserved-bed checks. Library/discovery memo keys include the revision. Rest fallback generation also receives the saved life selection and observed building sources; its cache separates revision and foundation/repair fingerprints. Existing permission, ownership, reach, bed and submerged-footing rules remain active.

NPC routine reports use that selected founding roster and the existing member/home/name life checks. A resident known to be deceased or not yet born at either end of the interval does not produce movement news. Filtering happens before the report cap, so a dead first row cannot suppress a living worker later in the roster. Reused numeric IDs and ambiguous legacy names do not inherit another person's death. An existing unversioned town defers routine reports until source admission resolves its actual layout; daily life and saved history continue, without guessed journal memories. Unregistered towns retain their earlier callback behavior.

Desktop rendering exposed a separate inspector bug: after examining a desk, switching source reused its furnishing index and displayed a bed as examined. The inspector now clears the selected furnishing and returns to the ground floor when its world/building/revision/blueprint changes. A fresh choice is required. The repaired 1440 by 900 view shows no stale bed card; switching back restores the library and ground floor, and ordinary re-examination displays the actual desk card. Both source variants and the fresh card are VIEWED; page errors and horizontal overflow are zero. This is isolated component interaction, not native campaign examination, permission or movement proof.

Verification is reported by scope. The initial three suites had 42 pass and five failures. Three old building fixtures and the old inn-106 fixture fail against the captured pre-edit reader too: all eight sampled visits and both towns' choices are byte-identical before/after under the current default. Their assertions remain unchanged. The submerged-campsite case exceeded 60 seconds; a single-case rerun with a 120-second bound passes in 72.5 seconds. Final routine coverage passes all 13 cases, and the new source-switch inspector case passes with eight unrelated inspector cases explicitly excluded. Deduplicated coverage is 45 passing cases, four unchanged fixture failures and eight filtered cases across four files. Fifteen affected source/test paths finish with zero scoped and zero suppressed type errors; three unsupported testing-library query options were corrected and the affected test/type checks rerun. No full-suite green claim follows.

One scoped advisory wave updates three headers, leaves eight unchanged and reports 17 dependents without writing them. Existing source/record changes are preserved. The initial sandbox source capture fails with EPERM creating src/utils/__tests__; its partial reader-source-01 remains rejected without a manifest. Host captures reader-source-02 and reader-source-03 pass their source fences. The latter is manifest version 3, 11,065 files and 1,031,499,564 bytes, captured at 2026-10-31T20:38:29.632Z. All eleven changed production source files hash-match it. A later test-only query-option correction is outside that snapshot. These copies do not establish historical admission or deployment.

The required bundled browser smoke succeeds on the repaired fixed source and its desktop capture is VIEWED. The isolated contexts and both owned preview servers are closed; original 3034 and driver 46704 remain live. Gwyn stays paused on World Map at the temple-return checkpoint. A read-only IndexedDB check confirms original Sana's default wrapper is byte-identical. No campaign received a revision, source migration, new knowledge or player relocation.

The current-layout preview also exposes a seven-person Woodhill household at world 1793432134128/burg 188/plot 19 with a 10 by 5 ft ground floor. This is a generated-plan/desktop observation, not actual circulation proof. It is routed to building comfort for household-size coverage alongside their independently reached poor-home shortage. Do not enlarge every home indiscriminately or claim the current plan is navigable.

The later factual-reader/Local milestone completes the audited state-aware direction, institution, religion and reconstruction paths; next implement guarded admission of unknown historical revisions and verify all person/job/site/paid-room/goods/door joins and physical support on a coherent source. The native resident-selector and furnishing-target candidates remain unadopted. The approved newer town layout, meaningful NPC lives and companion stories, relevant exploration/dungeons/monsters and world/UI quality remain the full open goal. [Save decision](../../adr/0013-saved-town-layout-revisions.md).

Ignored evidence under .agent/scratch/gameplay-flow/replies/: layout-visit-default-counterfactual.json, layout-reader-rendered-proof.json, layout-reader-fixed-proof.json, reader-candidate-proof.json, before/fixed desktop PNGs, both smoke directories and all three source-copy attempts. Captured fixtures are never imported into campaign saves.


## Factual directions and Local reconstruction share saved town selection

Verified: 2026-10-31. Known saved revisions now select business and priest directions, temple identity, institutional temple/library statements and the crier's standing business. An existing unversioned town retains its verified name, career ledger and recorded headlines; it does not gain building directions, temple corroboration or profile errands from today's unrelated layout. Career history and daily life remain available. No missing revision is assigned by these readers.

Local generation previously still adapted its town with the current default while the worker ground pass selected an earlier revision. The bridge now receives read-only town layout metadata and separates Local cache entries by the selected revisions in that region. Default/current requests retain the old cache identity. Worker requests, rest fallback and local journey source reads pass their existing town records. Saved Atlas reconstruction receives the same selection before validating its focus. App hydration derives a stable metadata-only input: unrelated life changes preserve the current live receipt, while an older selected town cannot retain a current receipt merely because addresses match. The derived metadata is not another population or save store.

Verification: 103 cases pass across five factual-direction/institution/temple/crier suites. Eight more pass across the worker, Local cache/address and App hydration suites. All 111 cases in these eight suites pass; nineteen affected source/test paths finish with zero scoped and zero suppressed errors. The real earlier Stamstad Local has the retained 67 plots and a separate cache; a serialized earlier-layout Arvalhana focus restores its exact address, focus and canonical plan. The worker now checks both emitted Local and ground plans. Mocked hydration checks cover selection propagation, unchanged live receipt across unrelated life updates and refusing to reuse a current receipt for an older selection. This is source and reconstruction proof, not a native reload claim. Previously recorded fixture failures remain separate open debt.

A read-only what-if reconstructs Gwyn's retained Stamstad using the existing manual checkpoint inputs plus a proposal-only revision-1 field. It never edits or imports a campaign save. Compared with the observed 18:07:39 native recovery, all 67 building IDs remain, with no added or removed building. Checked anchors, corners, heights, entrances, interior dimensions, wall dimensions, ensembles, solved roofs, terrain terraces and every blueprint signature match at a numeric tolerance of 1e-8. The complete 226-person projected roster is equivalent. All 360,000 encoded terrain samples are within that tolerance; maximum encoded delta is 7.459033390944114e-13. The terrain sampler at saved feet is exactly 4.659089767934253 m, equal to the recorded saved Y. Original checkpoint and proposal inputs remain byte-identical after evaluation.

Thirty-three building parts arrays differ. A follow-up leaf comparison identifies only facade-to-facade parts: 168 x values, 86 widths, 151 z values and 86 depths. Part counts remain unchanged; no other checked field differs beyond the stated tolerance. The current walking solver lists facade among excluded dressing tags, and interiorParts has the previously qualified exposed-facade trim rule. This identifies the difference; it is not a new native collision/render acceptance. The first bare-Node diagnostic failed because import.meta.glob needs Vite. A disposable Vite-backed evaluator then produced the report and verified input immutability. Repeated diagnostic evaluations are not added to product-test totals.

One scoped dependency wave updates six headers and leaves five unchanged; 61 dependents are reported without being written. A transient atlasGroundRestore write took three attempts through writeFileWithRetry. Source helpers preserve prior edits and CRLF/LF choices. All captures, proposal inputs, diagnostic configuration and report are ignored under .agent/scratch/gameplay-flow/replies/, especially stamstad-revision-ground-comparison.json and the institution-before-/local-layout-before- snapshots. No captured world graph is imported into a save.

Next implement guarded historical source admission using authoritative saved observations and identity joins, then qualify the current source in ordinary native gameplay and full reload. The read-only comparison is encouraging evidence for Gwyn's specific retained town, not a generic old-save classifier. Do not infer all older saves use revision 1. Props, dynamic encounters, runtime collision/support, possessions, paid rooms, doors and historical knowledge still need their appropriate native/join evidence. Temple readings currently carry world/cell/plot source identities; intentional relayout must qualify those historical joins rather than corroborate another building from a reused plot number. Intentional newer-layout adoption and the full meaningful-life, companion-story, exploration/dungeon/monster and world/UI goal remain open. The original campaign has received no revision or migration.

## Modest shared-hall proposal and physically sized blueprint glyphs

Verified: 2026-10-31. householdLivingPlan now also proposes shared-hall-cottage-v1 for the reached detached25x15ft, single-floor, two-to-four-slot poor/common cottage whose family already shares hall0. It merges corridor1 into hall0, retains kitchen2, places individual full-size beds and modest kitchen seating, and moves/widens the entrance along the same front wall. Existing shell/roof/windows/hearth/masses/style/history/brief remain; geometry/history gates operate on a clone. Attached, private-room and home-work programs defer. Live generation retains its existing policy; guarded saved household admission now consumes this pure proposal as documented below.

HouseholdLivingProposal.referenceChanges explicitly describes validated publicRoomMerges and entranceRelocations. proposeHouseholdLayoutReferences accepts those optional joins, requires unchanged hall tags/cell union and the same exterior wall, and classifies the removed shared door as merged-opening with no target. Original furnishings/owned contents map uniquely; no goods are rerolled. The status requires archiving the old qualified state during future admission; no state migration currently consumes it. Existing rich private-through-door ambiguity remains an issue.

renderBlueprintSvg uses doorClearWidthFt for leaves/jambs/swings and FURNITURE dimensions for body silhouettes/rotation, retaining legacy3ft defaults, distinctive overlays and unfinished-kind fallback. This removes map-versus-physical width/bed-proportion disagreement; it does not alter collision or stored furnishing geometry.25household/reference tests and30renderer tests pass; six scoped paths are clean. The parent inspected the isolated canonical-renderer comparison; the modified cottage is not played/adopted. Native unchanged3043 exit/fullreload07:43:15→07:44:33 retains31groups/exactoutsideXYZ/source/people/property; separate Sana32groups are exact. See [owning evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-a-modest-shared-hall-gains-bedding-and-truthful-map-dimensions).

Next implement a frozen reference-safe saved revision and all consumers before coherent outside admission and native revisit/reload. Seated capacity, actual NPC passing/sleep, internal physical doors and desktop camera comfort remain open, alongside broader household/occupation/culture/ruler qualification.


## Historical town source qualification

Verified: 2026-10-31. town/historicalTownLayout.ts provides a pure qualification gate for unversioned TownSim state. Its producer must independently generate all supported candidate layouts without retained-source overrides, replaying each observed foundation's original history. The gate validates existing observed sources, compares full blueprint JSON and all five site fields, requires complete founding identity joins and existing destination plots, and requires a unique dated birth with saved parents for each person outside the founding roster. Current homes may differ from founding homes: marriage and household moves remain owned by TownSim. Both supported readers must be present and exactly one must match. Missing, ambiguous, damaged or unexplained evidence stays unresolved. A result does not assign layoutRevision, migrate buildings, prove job/physical continuity or authorize a mount.

The 28 focused cases and two scoped typed paths pass. An ignored independent evaluator using the real Gwyn/Stamstad checkpoint qualifies revision 1 from two observed foundations/sites and 237 founders; revision 2 fails both sites/blueprints and 958 of its 969 founding identities. Forty-two current home changes remain intact. Existing retained-override ground comparison remains useful retention evidence, separately from this independent qualification. No existing campaign is admitted. Load-time producer/transaction, physical support and native full reload remain required; see the gameplay tracker for evidence and the full open scope.

## Frozen household revision and guarded outside admission

Verified: 2026-10-31. ObservedBuildingSource.householdRevision is an optional version1 shared-hall-cottage-v1 receipt over the unchanged observation and any prior furnishing correction. householdLayoutRevision validates the stored plan/signatures, exact non-layout facts, original floor partition/history surface, physical body/door/furniture fit and explicit object/room/door/manifest references. It reads frozen coordinates without invoking the current room/roof recipe. The source reader supplies revised plan plus remapped owned manifests as one coherent result, retaining the same household. Compatible later conditions replay; new structural events still refuse pending their own migration.

ADMIT_HOUSEHOLD_LAYOUT_REVISION requires explicit known town revision, matching observed/mounted foundations and unchanged observation history, a single party member at acknowledged stationary outside feet with height, no affected paid booking and a drawable production history projection. Original door keys, merged opening and unknown legacy keys remain; only unambiguous aliases inherit state, with destination conflicts refusing the transaction. The first contract is the measured modest shared hall; rich/private-door, added-storey, future-family and multi-person changes are not admitted by this recipe. No player relocation or ownership grant occurs.

World3D worker rebuild/discovery/library/rest cache identities include the frozen planSignature, and structural revisions invalidate transient cards/targets.77affected source/revision/previous-repair cases plus3targeted cache cases pass;11scoped paths are clean. Actual Vite browser module import passes, with no native revised interior acceptance. The named old lodging106fixture remains RED under default and reader1; its expectations/calls are preserved after a disproved countercheck.

Nell's initial unversioned precondition is now resolved for the actually qualified revision2 case documented below. Other unknown towns still defer. Immutable3043fresh-source-02 supports the admitted household revision;01is archival, and3041Sana is unchanged. Current native manual08:16:30is inside the revised hall after all10furnishings and31-group exact reload. Exterior firewood/solid-prop/camera agreement, actual NPC passing/seating/sleep/internal leaves and the full representative objective remain open. See [actual native evidence and next defect](../../projects/gameplay-flow/TRACKER.md#building-comfort-the-revised-modest-cottage-is-entered-and-survives-reload).


## Historical source preflight in ordinary loading

Verified: 2026-10-31. SaveLoadCore uses the lightweight historicalTownLoadContract predicate to identify an observed unversioned town in the saved current cell. It dynamically calls loadHistoricalTownSource before publishing loaded play. The adapter sends a correlated one-shot request through the existing worldGenWorker and shared workerClient; generation runs off the main thread and all completion/error/abort paths dispose the owned worker. The producer independently reconstructs both layout candidates, qualifies immutable foundations and founders, then checks current NPC/business/job, observed interaction source, door, paid-bed, historical building and exterior support joins against the selected replay. It never uses retained overrides to identify the original candidate.

The host refuses stale inputs, invalid selection/count/height results and unexpected no-conclusion replies. Success copies only the selected town's layoutRevision. It writes no slot; normal later saving persists the field. Existing storage readiness, known/new saves and terminal GAME_OVER behavior remain. Source failures are reported as source-check failures rather than corrupt saves. This initial preflight admits only one exterior body at the exact saved terrain height with no covering water; interior/deck/party and unobserved unresolved histories remain unfinished. Native mounted support and save/reload proof are separate from preflight.

All88affected generation/join/worker/save/client cases and eight scoped paths pass. Isolated immutable-source browser verification qualifies Gwyn1 with unchanged input, metadata-only returned copy and no surviving worker. Read-only Nell export evaluation qualifies2; neither campaign receives the result. See the latest gameplay tracker chapter for exact receipts and native adoption limits.


## Native qualification of the historical load path

Verified:2026-10-31. Gwyn's established unversioned town188 now selects revision1through ordinary loadGame/preflight, normal autosave/manual saving and full document reload. The host never receives a substituted population or terrain graph. In the controlled native source handover, original/new terrain, town plans and projected people match exactly, with67building identities and all checked collision hashes preserved.33facade dressing hashes differ as previously qualified. Initial TownSim JSON differs only by the selected revision; legitimate current homes and other towns remain intact.

After normal exterior walking and a temple door open/close, ordinary18:50:54save/fullreload/Continue/18:51:12resave retains exact walked feet, town revision and a byte-identical complete new town graph.134of139top-level save groups are exact; remaining differences are clock, normal save counter/timestamp/message and debug timing. Fourteen present named gameplay groups, including people/memory/possessions/paid rooms/history/travel, are separately exact. Original Sana remains byte-identical. This is native evidence for that exterior single-body source case, not generic old-save admission or newer-layout acceptance.

The parent retains the old3034server and uses a context-specific asset forwarder to immutable3044only for Gwyn. That server/context route is part of the current verification source, not a deployed public site. Actual temple doorway traversal, camera comfort and furnishing reach remain unresolved despite a working toggle and supported street movement; the threshold stop and unchanged right-drag pose need diagnosis. See the latest gameplay tracker chapter for exact source/process/checkpoint receipts and next native action.

## Native modest household adoption and exterior-prop intrusion

Verified:2026-10-31. Nell world1793476023582/cell4079/town850/plot0 now selects revision2through the owning normal saved-town load path. A prior exact read-only worker check qualifies1observation/36founders/exactsavedY; ordinary reload/Resume/manualLoad repeats the gate on immutable fresh-source-02/v3 atlocalhost3043. The same acknowledged stationary outside pose admits householdRevision shared-hall-cottage-v1 over immutable observed19hrjr4. Revised plan4ymiq5, original source/household/owned manifests, accepted feet and old door keys are retained.02is the adopted native application source;01is archival and must not replace it for the current profile.3041Sana remains separate and unchanged.

Normal entranceClose/Open/entry/insideClose, both-way kitchen opening and every furnishing index0..9 are physically reached/examined. Four beds remain private, both original barrels show exact owned stacks and offer noTake; new bench/chair/table/hearth cards resolve the correct indexes. No goods/access/rest is granted.08:15:19→08:16:30full documentreload/manualLoad/resave preserves31groups/exacthallXYZ472.57470729781323/489.8174913216476/Y4.722837280319517; separateSana32groups are exact. Native2560x1305CSS captures are VIEWED. Actual seating/sleep/NPC passing/internal leaves and overall camera comfort remain open.

Actual scenic firewood exposes a separate collision/layout boundary. placeBuildingSideProps uses center-only CtxBuilding and1.5CELL_METERS clusters; the reached woodpile at472.358912923433/488.4628858281934 is plan7.902254592714987/6.242248626365065 inside the shared hall. Rendered woodpile-log rays identify the foreground planks; catalog weight400lb/halfcover/blocksMovement disagrees with a route that can approach its center at ordinary floor height. Furniture-only1.2m gates do not cover this exterior prop. Next extend existing placement with real footprints/clear routes and preserve prop delta/destruction/loot identities during any deliberate saved-source correction; do not erase dressing or relocate the player. Camera right-drag rejection remains a separate observed solver issue.

Current renderBlueprintSvg also reverses the screen rotation sign so bed pillow/head ends match the positive-Y3DbedGeometry in all four orientations.34renderer+1bed model checks and2scoped paths pass;81source/admission/cache cases/11paths remain clean (116unique/13paths combined, including the actual persisted poorHouseholdRevision fixture). The corrected isolated diagram is VIEWED; immutable02is unchanged and does not yet include this glyph follow-up. The existing named inn106fixture remains RED rather than losing its assertions. [Owning native/source/prop evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-the-revised-modest-cottage-is-entered-and-survives-reload).

Native household reload audit refinement (Verified:2026-10-31): all139top-level groups were compared across the deliberate08:15:19 to08:16:30full reload.135are exact; only diceSaveCounter, gameTime, banterDebugLog and saveTimestamp differ. All31present protected groups remain exact. The actual accepted frozen receipt now has a retained-source regression in the existing observed-building fixture; this does not adopt any new runtime source or repair exterior props.

## Measured exterior-prop repair proposal

Verified:2026-11-01. props/exteriorPropRepair.ts is a pure staged correction owner, not a generator or save migration. It checks the whole caller-measured prop disc against filled building polygons, expanded route segments/endcaps, neighbouring measured discs and ground-window bounds. Bounded quarter-metre/64-direction sampling preserves appearance and returns the old coordinate-based tactical source address with a deep copy of the original. Clear sources are retained; unsupported or unplaceable geometry remains unresolved. A proposed move removes the old surface fit so terrain seating cannot be inferred from its former location. Current native generation/collision/readers do not consume this proposal yet.

The played Nell six-log instance vertices measure maximum horizontal radius0.8674684969740052m. A retained regression captures23mounted footprints, four roads and the revised doorway approach; it yields the footprint-clear469.8213397867784/485.3708440147425 candidate with original source address prop:woodpile:47236:48846:5611.11tests/2scoped paths pass. Other prop bounds and destination support are deliberately unqualified; no candidate has been applied. Native walking currently constructs solids from building parts in groundBuildingMotion and separates actors through actorPersonalSpace, without using these catalog props as solids. Future rendered bounds/collision/source integration must preserve accepted feet and object identity, not merely reposition scenery. [Owning evidence and admission limits](../../projects/gameplay-flow/TRACKER.md#building-comfort-exterior-dressing-gains-a-measured-retained-identity-repair-proposal).


Player-camera/temple native follow-up (Verified:2026-11-01): post-damping obstruction now attempts a shorter eye on the requested new heading before old-heading fallback; damping is drained and the actual eye rechecked without moving focus/feet.29focused checks/two scoped paths are clean. This does not solve all native orbit sectors: exact-foot and interior attempts still stop. Ordinary aligned temple66entry, inside doorclose and reached public navebench/Cancel of real shortrest review are verified at1440x900. Fullreload/resave preserves insidefeet488.8070550247393/474.7653280399462/Y4.798373711307528, captured town graph,134of139groups and14named gameplay groups; separate Sana exact. No rest/permission/reward/newNPCmeeting or performance acceptance follows. Read the [owning evidence and next camera investigation](../../projects/gameplay-flow/TRACKER.md#camera-keeps-a-feasible-requested-turn-gwyn-reaches-the-temple-nave-bench). Current Gwyn source3045is a one-controller derivative of adopted3044; preserve its context-specific forwarder and existing saved source. Visible indoor firewood remains under the separate prop investigation.

## Retained prop readers and native rendered geometry

Verified:2026-11-01. props/propSchema.propSourceId is the common address reader for GroundProps provenance, exteriorPropRepair and groundChunkLoader tactical targets. New optional retainedSourceId keeps a moved source address stable while worldMeters reflects its current pose; old generated props keep byte-identical coordinate addresses. Repair admission must still prove the retained ID against the original receipt. No prop mutation save operation or ownership rule is introduced by this reader field.

GroundProps attaches source metadata alongside every simple/composed instance matrix. groundPropGeometry.measureRenderedGroundProps reads actual transformed vertices once after layout, including parent transforms, yaw/lean/scale and all material-batched pieces. It reports missing/stale/nonfinite/duplicate sources, keeps adjacent props distinct and limits vertex work by canonical-source focus. Callers must refuse issues and still establish destination support and safe source admission; a bounds snapshot is not movement permission.

Native03has22measured nearby props with no issues; the original six-log pile radius0.867468496974m is reproduced. All35ground fields stay exact over02to03and fullreload, including8576props/23buildings.37affected tests/9scoped paths pass. The existing town placement gate rejects the first measured-neighbour-clear destination as a floater (0/1passed/contact0.16); a returned surface fit alone cannot authorize it. Its nominal class hull is not proof of actual lower-hull contact. Current manual08:21:11/insideXYZ/all31protected groups survive normal load/reload exactly;03at3043/PID49892is the required current native source. [Source handover, refusal and remaining gates](../../projects/gameplay-flow/TRACKER.md#building-comfort-live-prop-identity-and-measured-neighbours-survive-a-source-handover).


## Native nave camera and altar continuity

Verified: 2026-11-01. At Gwyn's retained temple 66, three settled native orbit drags change the view without moving his feet. Read-only seven-point visibility measurements meet real mounted walls and columns; they do not justify weakening the sightline owner. The tighter entrance and lead-visibility problems remain separate open observations. No camera source is changed in this pass.

The 30 by 30 foot nave's eleven mixed-orientation benches pass the existing 0.8 meter furniture/door-envelope check but fail 1.2 meters. That helper excludes columns and props. A preview using actual mounted resolveGroundWalk finds nine supported segments around the seating; all are then walked with ordinary WASD. The public altar is reached and reread. Its single 18:25:10 faith/clergy entry remains exact, without awarding a meeting or service. Full reload/resave at 18:57:36 preserves exact altar XYZ, the captured town graph, 134 of 139 groups and all 14 named gameplay groups. Future seating correction needs explicit retained-source handling; the observed layout is not regenerated. [Owning evidence and next actual interaction](../../projects/gameplay-flow/TRACKER.md#the-nave-camera-turns-and-the-reached-altar-preserves-its-earlier-account).

## Terrain-filtered prop proposals and actual triangle contact

Verified:2026-11-01. exteriorPropRepair optionally takes a pure seating evaluator; rejection resumes bounded deterministic sampling, and returned values may add only a finite surface fit. groundPropGeometry captures an actually mounted prop into pose-local triangles with its real scale retained and source/appearance bound. groundPropSupport checks actual triangle lower intersections with the existing town contact/penetration/slope tolerances; empty projected gaps are not replaced by a solid box. These helpers authorize neither saved changes nor ownership.

Native04finds a supported woodpile site only after207nominal refusals. Existing gate1/1and actual7contacts/ratio1pass; a separate every-vertex diagnostic is0.06893ft penetration. The current worktree additionally strengthens the verifier to inspect every vertex; this follow-up is not retrofitted into04. The visible woodpile is still unmoved. Current normal outside manual08:23:57and source04/exec67144supersede the earlier inside03resume; a further ordinary retreat is needed for the existing3metre repair envelope. [Actual supported-site evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-terrain-feedback-finds-a-supported-real-mesh-woodpile-site).


## Retained exterior woodpile corrections

Verified: 2026-11-01. ObservedBuildingSource may retain ordered exteriorPropRevisions separately from its immutable plan, household and furnishing manifests. exteriorPropRevision binds the original prop address, nearby25meter baseline, predecessor receipts, accepted player/character/source and shared woodpile-v1 render recipe. Freeze checks the actually captured triangles against that recipe; replay reruns nominal and triangle support checks before replacing exactly one addressed prop. The reducer requires current history/world/cell, acknowledged stationary outside supported footing and unchanged character. Ground generation applies checked receipts after its original prop gate. Retained source identity survives changed coordinates. GroundProps shares the original six-log recipe; the existing walking solver derives solids only for a retained woodpile-v1 correction. These checks grant neither ownership nor permission. ADR0014 records compatibility and refusal rules; FNV signatures detect drift and are not cryptographic authentication.

Source05 freezes these owners over accepted04 with only an explicit owned overlay. Actual native admission, corrected-object passage and reload remain pending. [Owning evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-isolated-saved-prop-implementation-and-normal-retreat).


Native retained-prop qualification (Verified:2026-11-01): worldGenCore forwards the same buildingSources snapshot to both stages; omitting it in Stage B admitted a receipt but drew the old prop in native05. Source06fixes that boundary. Nell's corrected woodpile keeps its original address/recipe; actual rendered support passes. Onlypropschanges from the earlier35field baseline, and substituting the one original on a copy restores all8576props exactly. Normal return/entry reaches the former indoor pile center. Inside save/fullreload/resave keeps all35current ground hashes, completeTownSim and exactfeet. Source06/3043/server27357 is required for that saved case. Native blocked-contact and privatebed checks are bounded; fullbodywidth/camera/NPC use and fresh-generation footprint placement remain open. [Owning native evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-retained-woodpile-correction-survives-native-re-entry-and-reload).


## Shared prop render recipes and camera sampling

Verified:2026-11-01. propRenderRecipeV1 owns the existing GroundProps palette, geometry factory, composed pieces and simple scales/lifts. propShapeV1 yields actual scaled pose-local triangles for the same art, handling world-vertical lift under lean and preserving the legacy scene-origin scale hash. Unknown shapes refuse; batch callers own and dispose their geometry library. The renderer reads that same source. This enables actual footprint/contact inputs without guessing from sizeClass. Native isolated31batch equality and28model comparisons qualify the extraction, not a new placement algorithm. groundToPlacementContext still projects only building centers, and fresh/established campaign version selection remains unwired.

WebGL N8AO now uses medium sampling:16AO/8denoise samples. Existing radius7m/falloff3.5/intensity3.2/half-resolution and groundDPR0.75 remain. This reduces observed coarse floor/bedding shading in controlled native comparisons; small GIF quantization and source texture detail are separate. Bounded frame costs do not accept performance. Current user save is on08/3043/server70898 at470.63971280330503/490.4073382328218/Y4.722837280319517 after full document reload and exact property/feet checks. [Evidence and source decision](../../projects/gameplay-flow/TRACKER.md#building-comfort-exact-prop-recipes-and-a-cleaner-reported-camera-view).



## Prospective exterior placement and source boundary

Verified: 2026-11-01. The ground loader accepts optional propGenerationRevision and propSources. Missing revision or1 preserves legacy props and omits propSource; unsupported versions refuse. Revision2 requires an atlas cell and addresses a source by world, cell, window origin and extents. A retained source verifies its terrain and property signatures and accounting before returning copies, without invoking placement. Fresh revision2 candidates use shared props-v1 art, frozen effective scale, actual vertex/contact geometry, full building/road/entry clearance and existing terrain tolerances. First-candidate refusals remain explicit in the source report. The nominal legacy gate still describes original candidates; the separate prospective report describes this added admission.

The worker forwards revision, sources and anchor cell through both stages and returns the first source beside StageB props. The client attaches it to the same ground object and retains request correlation and disposal behavior. This path remains unselected by normal campaigns: GameState persistence and new-campaign actions are not yet wired. Later building changes must preserve established props or refuse conflicting revisions through an explicit migration. The serving-building association is still lost at scatter emission and must be retained before relocation can qualify household/workplace land use. Three-town structural checks do not qualify native play, loading performance, body collision or saved gameplay. [Evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-prospective-yard-geometry-and-retained-source-worker-boundary).



## Fresh prop affiliations and original lots

Verified: 2026-11-01. toArtifactPlan accepts retainPropParcels as an opt-in sidecar option. It copies original ward/civic polygons at the same plot-id assignment; normal artifact plans keep their previous shape. The canonical town wrapper forwards this option, and only revision2 ground assembly requests propParcelM on its buildings. It describes the original lot before the building setback, rather than a newly inferred ownership region.

Fresh prop context enables emission affiliation. Building dressing/loading pools identify their serving building; courts, market pools and docks keep distinct anchors. The metadata changes no RNG draw or candidate order. propLandConstraint checks an entire conservative model disc inside its known lot/shared area/dock and refuses a missing source. Dock stock reads the rendered top before first slope fitting and during final seating. Affiliation does not grant ownership or interaction permission. propGenerationSource validates and copies accepted affiliations and declined-intent affiliations through JSON without rerolling a retained window.

These constraints are implemented but not selected or saved by normal campaigns. The three-town check reveals that most building supply/ornament candidates cannot fit current lots, models and clearances; it does not qualify complete household/work storage. Resolve that capacity problem before activation, then complete source persistence, later-building guards, collision/combat parity and native save/reload. [Evidence and next action](../../projects/gameplay-flow/TRACKER.md#building-comfort-source-affiliations-reveal-real-yard-capacity-limits).



Fresh capacity diagnosis (Verified:2026-11-01): ground cornersM describe the adapted plot, while wallWidthM/wallDepthM and SiteParts describe the fitted building. They can differ materially. The current prospective exclusion still treats the whole plot as filled and uses a conservative prop disc; these are not exact mounted-footprint tests. The next fresh-only experiment should use mounted structural and actual prop footprints inside the retained original lot. Accepted legacy exterior-repair contexts remain versioned and unchanged.



## Fresh actual-footprint clearance

Verified: 2026-11-01. freshPropClearance indexes mounted ground-floor slabs, low exterior walls, stairs, arcade columns and complete ground-floor door sweeps through sitePartScenePosition. Separate floor rectangles preserve open corners. A missing structural packet falls back explicitly to plot corners; malformed structure refuses. exteriorRouteExclusions is the unchanged shared road/front-door policy. Retained exterior-repair contexts still use their original geometry and bounded search order.

propFootprint checks oriented convex model hulls against structural polygons, route capsules and source land domains, including crossings of concave lot edges. prospectivePropPlacement derives these hulls from the shared recipe's actual scaled vertices, yaw and lean. Bounded library-owned caches reuse rigid art and pose projections; propWorldVerticalLiftV1 preserves the existing simple-form world-Y lift convention. Ground support still runs against the existing contact/penetration tolerances after clearance. Fresh tilt axes normalize signed zero before first source establishment so JSON replay is strict; legacy fitting and source readers are unchanged.

This candidate remains unselected and unpersisted by normal campaigns. It recovers more source-lot props but does not establish complete household/work storage, general three-dimensional object/body collision, upper-overhang clearance or native play/reload. The ground adapter's coarse role/wealth projection and remaining supply intent are the next household-facing work. [Evidence](../../projects/gameplay-flow/TRACKER.md#building-comfort-actual-ground-structure-and-oriented-prop-footprints).




### Fresh prop purpose and household means

Verified: 2026-11-01. When propGenerationRevision is2, groundChunkLoader attaches propUse from the same resolved blueprint passed to interior projection and occupancy. freshBuildingPropUse in bridge/groundProps maps its building type to the existing placement vocabulary and takes wealth from the household brief before architectural style. This preserves proprietor-home means across districts. The prop adapter uses these facts only in the fresh path; supplied registered business types override blueprint tavern signals. Default/legacy generation omits propUse and retains the old role/market-distance projection. Retained prop-window sources bypass regeneration as before. This candidate has no default campaign selection or GameState persistence yet.

The rural bridge is incomplete: townEngine farmsteads do not become building plots in townPlanAdapter. farmCrops already owns stable crop assignment, and placementEngine already has crop-specific kits, but this ground path lacks their source farmhouse/parcel relationship. Missing facts are left absent rather than inferred from proximity. A farm's physical household, work land and necessary storage still require coherent integration and normal-play verification.




Fresh search uses source-land bounds only for conservative rejection before expensive model projection. The broad model radius must lie wholly outside those bounds to skip a candidate. Exact lot containment, mounted structure, route/door clearance, neighbor hulls and all-vertex support still decide every surviving candidate. The three-town regression keeps identical final counts and exact retained replay after this optimization.




### Candidate rural household and field sources

Verified:2026-11-01. Town layout revision3is an explicitly selected candidate; CURRENT_TOWN_LAYOUT_REVISION remains2. canonicalTown passes ruralHouseholdSources only for3. Both ward and lane town finish paths forward it to assignTownPopulation. Its isolated rural-household-occupancy stream sizes one family per visible marker (at most8), while representedPopulation retains the marker's share of all rural people. This avoids converting a legibility-capped population marker into dozens of children in one house. Farm ids/positions, urban wards and demographic accounting stay unchanged; old1/2sources preserve their prior family inputs exactly.

New Farmstead.farmParcelIndex refers to the farm-only parcel list used during population emission. assignFarmCrops follows that source ordinal and cropForFarmParcel supplies one stable crop for households sharing that field. The ordinal remains intact when earlier fields are malformed; unavailable explicit joins refuse. Legacy sources omit the field and keep their old nearest-centroid display. These facts describe use, not legal ownership.

Revision3does not yet provide physical farm-building plots, yards, approaches, normal campaign activation or migration. townPlanAdapter still emits only ward/civic buildings. Two of64source farm points in the largest surveyed town lie outside their assigned fields; physical authoring must validate actual footprints and routes rather than assume point membership. Extend the adapter/household/roster/routine bridges with stable appended ids after that planning. This candidate version is distinct from the immutable application-source cuts08/09; live08has not adopted it.




### Candidate homestead geometry and agricultural parent sources

Verified:2026-11-01. Only explicit town-layout3asks stripFarmParcels to retain each pre-strip agricultural parent id/polygon. Farm crop identity still follows the worked strip ordinal; yard planning can use the copied parent domain. No owner/access right is inferred. Legacy/default source fields keep geometry, RNG, order and absent metadata. Parent polygons and ruralHomesteads are copied through transformTownPlan, including house/yard coordinates, original source point, planned center, approach width/points and nested refusal counters.

canonicalTown calls town/ruralHomesteads after candidate3generation. The pure planner budgets house envelopes by household count, retains reserved farm plot ids and reports every unplaced intent. It searches in the field grain, permits direct or bent eight-foot approaches, reserves the wall enclosure and existing lots/yards, and joins the safe outside public road network. It can reuse only the portion of an earlier approach that is clear of that earlier yard, retaining acyclic farm ancestry and the original public street root. Original street choices remain available; shared paths do not replace them merely by being closer. This is bounded source planning, not a global route solver.

The current candidate still fails coverage:11/12,7/64,17/18and11/17in the four checked settlements. The larger town has both enclosure and building-lot approach conflicts. Diagnose land allocation, joint packing and route limitations before treating rural housing as available. No artifact farm buildings/streets, cultivation exclusions, terrain admission, furnished capacity, legal access or native adoption are supplied by this planner. Those existing downstream systems must consume the same source identities after the coverage gate is resolved.



### Candidate bounded rural obstacle routing

Verified:2026-11-01. Candidate3homesteads retain the cheap direct/bent search, then call ruralApproachRoute for up to four clear house/yard/apron candidates. A local geometric index includes actual lots, reserved civic structures, wall enclosure and prior private yards. Stable bounded A* tries20/10/5foot grid steps with3000expansions per attempt; full eight-foot segments, one-foot obstacle separation and square turns remain mandatory. Safe smoothing rechecks complete edges. Street joins may project to another clear point on the same selected public source or prior shared track rather than require exact grid alignment with one seed point. The source root and acyclic shared ancestry remain authoritative. These are construction proposals, never edits to accepted campaign positions.

Current source coverage is11/12,28/64,18/18and11/17;68of111households. Only four of the larger town's36declined homes reach obstacle routing after cheap placement, so the next source dependency is house/yard/apron allocation and packing as well as remaining routes.59focused cases and independent115-leg/turn/civic/junction checks are source proof. Actual artifacts, cultivation/prop exclusions, furnishing, terrain, rights, save integration and native adoption remain absent. Default revision2and immutable application08are unchanged.



### Candidate frontage-first rural packing

Verified:2026-11-01. ruralHomesteads snapshots the original admitted public road segments before shared tracks are appended. It orders source households by their source-marker distance to that network, with stable farm-id ties. Each household's sampled centers prefer that same public frontage, then proximity to its retained source marker. This reduces early scattered yards and long approaches that reserve later home sites. Shared tracks still supplement route access; they do not change the placement ranking. Envelope dimensions, household facts, field/crop ids, public roots and all clearance rules remain unchanged. Only explicit candidate3uses this planner; accepted buildings/default2and immutable app08do not move.

Four-town coverage is77/111, leaving30largest-town and4smaller-town intents. Exact-output source instrumentation attributes25declines to earlier yard reservations, seven more to approaches and two to final yard/route admission across the sampled choices. Current parent-land envelopes alone demand89.32%and72.70%of two larger-town agricultural parents before roads, urban conflicts and cultivation. Joint packing must therefore be evaluated with a coherent source allocation for homes, work land and circulation; geometric house coverage alone cannot qualify farm livelihoods. Native artifacts, terrain, furnishing, rights, exclusions and campaign adoption remain downstream.



### Explicit rural artifact bridge and reservations

Verified:2026-11-01. toArtifactPlan.includeRuralHomesteads is a prototype-only option, absent from normal runtime calls. ruralHomesteadArtifacts appends admitted farm house footprints and eight-foot tracks with reserved farm-ordinal ids while keeping urban records exact. Source f-id/occupants/field joins must match, collisions refuse, and every admitted/refused intent is retained. pop uses farmstead/residential/common and the original homeId so householdForPlot matches the source map's existing named farm family. Styles preserve that common household input; no ownership/access grant follows. Artifact ruralSources copies homesteads and admitted worked strips/crops; retained prop parcels use the actual yard.

clearsRuralHomeReservations excludes complete cultivation/unaffiliated-scatter hulls from yards, round full-width route legs and reserved square bends. ruralCultivationFits also requires the actual worked strip. Physical ground/crop/prop consumers do not yet apply this API. Runtime generateTownRoster still filters role house, so farm residents also require an explicit attendance extension before prototype adoption. Normal defaults and accepted app08are unchanged.

Four-town source adaptation preserves all urban records and77named families while retaining34unplaced intents. Actual-culture buildingPlotInput/blueprintForPlot probing finds34of77admitted homes with fewer beds than members, even with all household slots retained. The remaining43are not qualified by that count. Repair farm sleeping layouts and install runtime exclusions/source/roster bridges before bounded fresh-profile native entry/use/reload; all wider packing, livelihood, culture, furnishing and migration gates remain open.



### Explicit rural-family interior recipe

Verified:2026-11-01. The opt-in rural artifact packet stamps rural-family-v1; buildingPlotInput forwards it only for its admitted farms and omits it for retained observed sources. Ordinary input/memo behavior remains exact. The explicit constructor fills the same allocated envelope, uses balanced rooms with shared entry on frontage, explores at most six deterministic partition trials and compares assigned-room bed deficits, room-graph private access, actual shared seats and a coarse circulation screen. A weak memo keyed by canonical first-trial plan avoids repeating selection for other readers. Saved observed foundations bypass generation before this policy can run.

Household seating appends catalog benches/chairs to shared halls/kitchens using existing hull, route and actual return-stair reservations; ordinary public seating behavior is preserved. All77surveyed admitted families retain slots, assigned beds and shared-seat capacity with graph privacy checks. However69still fail the independent quarter-foot1.2meter body/door geometry audit, including one sweep overlap, and family sleeping-group appropriateness is not qualified. Runtime roster, actual exclusion/source consumers, native gameplay and adoption remain absent. Historical played-home/library/inn regressions explicitly use their verified original town-layout1 rather than current default2buildings at the same indices; old/new constructor outputs are exact for both versions.



### Rural shared-circulation experiment boundary

Verified:2026-11-01. The application rural-family-v1 recipe is unchanged. Disposable alternative constructors explore the same reserved envelope with a five-foot shared corridor, separate hall/kitchen and parent/child sleeping rooms, strict1.2-meter furniture collision and four-foot door reservations. Experimental approach targets must align with the furnisher's half-foot-offset walking nodes; integer offsets falsely reject rooms. Custom sleeping assignments must consume generic bedroom queues to prevent duplicate household claims. Replace only private-through bedroom openings; redundant doors can destroy usable furniture space. All77experimental families pass the existing fine room geometry, additional corridor checks, unique claims and public access. Three still lack a seat and seven a table. These are source experiments, with no reusable application policy, native passage, actual stair/camera qualification or migration admission yet. Existing application geometry refusals remain authoritative.



### Explicit household furnishing clearance

Verified: 2026-11-01. HouseholdFurnishingOptions extends the existing building and seating fitters with an optional walkingWidthM, reserveDoorSweeps and reachAllFurniture. Call-local caches use the same profile throughout room fitting, child-overflow trials and added seating. Explicit approach targets stay on half-foot-offset graph nodes; width-only admission reserves body depth, while full leaf reservation covers at least its complete width and depth. Explicit reach uses the body half-width plus 20 centimeters; ordinary generation preserves its legacy reach and search order. This remains a one-foot placement screen, not actual wall/stair/camera or permission qualification.

Default and compact-bed output is byte-identical in eight historical home/inn comparisons. The explicit 1.2-meter/full-door/all-object mode reproduces the disposable 77-home survey. Shared hall and bedroom proportions remain experimental: larger sibling groups get larger rooms, supplying beds/tables/seats with existing fine geometry passes, but one older-child/parent overflow remains age-blind. HouseholdBrief preserves ageBand, not exact age. An explicit age-aware adapter must preserve the named source household and retained foundations before using exact ages in layout decisions. No normal runtime source activation or accepted-save migration follows from these fitting options.



### Integrated explicit rural room and stair program

Verified: 2026-11-01. The dormant rural-family-v1 constructor uses planRuralFamilyGround for supported rectangular head/spouse/child households, consumes their sleeping queues once, assigns larger sibling groups wider rooms and replaces private-through bedroom doors with shared access. Structural/non-family cases retain the existing partition fallback. A bounded twelve-trial selection balances sleeping claims, privacy, stair clearance, basic living, seats and a half-foot circulation screen. Later trials can deepen shared living space from 15 to 20 feet within the same lot.

HouseholdFurnishingOptions adds an explicit walkingGridStepFt (1, .5 or .25 feet), bounded seatingTrials (up to 16) and a sharedTableRoom. Defaults retain the legacy one-foot grid, original room recipes and one seating pass. Strict farm fitting uses the same full 1.2-meter body across room packing, stair trials and appended seats. Small households share a kitchen table while dry provisions can occupy either shared room. Every accepted source trial still needs actual beds, warmth, table, provision barrel and shared seat capacity. These are source-level gates, not lawful access, dining animation or crop-specific stock guarantees.

returnStairCandidates accepts an optional minimum body width. Its legacy four-cell shape remains exact; the wider profile reserves six cells (15 by 10 feet) with 4.5-foot flights, 10-foot runs, 5-foot landings and ten rises per half-storey. planHouseholdReturnStair receives explicit furnishing/minimum-door options, sizes new portals before fitting and refuses a supplied body that cannot fit the actual flight/landing. Mesh-data tests cover the complete opening, positive construction and upper-floor alignment. Normal movement, collision, handrail clearance and camera use need in-app verification.

All 77 source-cohort farms now pass the reported room/body/claim/access/living screens, including 23 wider basement stairs; this sample does not cover above-ground farm storeys. Normal runtime still does not enable rural artifacts, observed foundations bypass new generation, and default town-layout 2 remains unchanged. Farm roster, ground/crop/prop/source consumers and actual approach-to-entry alignment remain adoption dependencies. No accepted source, possessions or player position are rewritten.

### Explicit farm roster and founding family continuity

Verified: 2026-11-01. generateTownRoster calls appendRuralHouseholds after all urban job and servant generation. Only explicit rural-family-v1/version-one admitted home/field joins qualify. Source household resolution supplies original members, stable householdMemberId keys and exact age/race/role/occupation metadata. Farm IDs map to a separate deterministic numeric range, and collisions or inconsistent joins fail rather than renumbering established people. Broad roster occupation remains resident; metadata supplies neither ownership nor a physically qualified work destination.

assignFamilies runs existing generation on urban occupants unchanged, then joins source farm head/spouse/child relationships with exact ages and reciprocal links. These are founding facts; evolved TownLife remains authoritative. householdResidentForKey resolves non-building keys only against one exact saved member match. Life-status and householdFamilyAt reuse this bridge while retaining existing birth/death, genealogy and identity guards. Unknown and ambiguous records are not guessed.

Source fixtures cover TownSim initialization and JSON continuity. Normal runtime still does not enable the rural artifact lane; ground/crop/prop/source and track-entry consumers remain adoption dependencies. Native gameplay, field work and full application reload require separate in-app evidence.

### Explicit farm crop and prop reservation consumers

Verified: 2026-11-01. groundToPlacementContext adds a crop only for fresh prop affiliations with one explicit rural-family-v1 home/site/field/burg join. The existing farm crop working-kit recipe consumes it. Legacy context and missing or ambiguous joins retain no crop signal. No ownership, goods quantity or field attendance follows from this signal.

propLandConstraint composes the existing serving-land rule with clearsRuralHomeReservations for explicit rural source towns. It converts window-local meter hulls back through boundsFeet into canonical source feet. All unrelated yards and full-width approaches remain reserved. A unique serving plot may use its own yard; that exception never removes its approach reservation. Missing projection and ambiguous serving identities refuse. Existing source bounds, actual-model terrain seating and building circulation remain authoritative. Retained accepted props do not run this first-placement search. Cultivation, real source adoption/retention, generated-entry alignment and normal in-app gameplay remain separate dependencies.

### Fresh rural track and corridor entrance anchor

Verified: 2026-11-01. ruralHouseGeometry owns the five-foot spine-column/frontage offset shared by planRuralFamilyGround and planRuralHomesteads. In even-column rectangles the corridor center sits 2.5 feet from the facade midpoint; odd-column rectangles retain the midpoint. The planner converts this real-foot offset into its source scale and uses it before straight/bent/searched full-width route admission. The room program retains its existing partition and furnishings.

Real buildInterior entry parts projected through physicalResidentDoor qualify the resulting source endpoints. This is a fresh rectangular source-program rule, not a replacement for retained-source/structural actual door projection. Corrected route admission can change unaccepted sites and which household intents fit; retain every decline and record the admission delta before any source adoption. Cultivation still has no production caller of ruralCultivationFits. In-app gameplay and full reload remain separate acceptance gates.

### Rural source land representation limits

Verified: 2026-11-01. assignTownPopulation still distributes representative farm markers round-robin across farm parcels. The explicit household source adds real family counts and field indexes but does not allocate physical parent land by house/yard demand. planRuralHomesteads keeps yards in their source parent and records declined intents rather than manufacturing land.

A necessary current-profile bound sums each family's required rectangular house/yard footprint within its assigned parent; this ignores tracks, neighbor gaps and crop space, so it cannot overstate those additional requirements. Held-out parent totals can already exceed 100% in aggregate. Improving bounded routes or redistributing within those same parents cannot solve an aggregate area deficit. This identifies a source allocation/representation dependency before cultivated ground and physical adoption. It neither proves global unreachability nor authorizes source reassignment, smaller families or accepted-save migration. Current projected/source interior success remains separate from native gameplay and full reload evidence.

### Separate fresh farm home ground from the working field

Verified: 2026-11-01. planRuralHomesteads finishes original agricultural-parent attempts first, then queues up to four nearby sufficiently large classified scrub parcels per refused household. Original admitted sites keep their complete geometry/order before any fallback is tried. New home ground records yardSource.kind as scrub-parcel with its exact outskirt index; farmParcelIndex, crop, sourceCenter and family identity remain the original work/household source. Pasture is not proposed for home ground.

The same full-footprint yard and public-approach admission runs for fallback sites. buildRuralHomesteadArtifacts verifies that every declared field/parent/scrub source exists and contains the yard, then retains separate working-field and home-ground facts. These are source siting records, not legal title, home-to-field route qualification or physically admitted terrain. Canonical generation runs in normalized coordinates at the recorded scale and is transformed once; regenerating an affine-transformed plan can change candidate ordering and is not canonical-source parity. Existing source2/retained-source behavior remains unchanged. Residual area shortage and cultivation/native/reload gates remain unresolved.

### Body-aware prosperous household proposals

Verified: 2026-11-01. proposeHouseholdLivingPlan defaults supported wealthy 30-by-20-foot townhouse drafts to public-landing-household-v2. It reserves the standard six-cell wide return stair before assigning two private sleeping wings per upper floor. A full-depth shared spine and open stair landing connect both rooms without using a flight as ordinary floor. The measured nine-person household needs four explicit proposed stories; maxStoreys can refuse that height. Actual ages must be supplied for child slots. The earlier v1 geometry remains an explicit legacy profile, while modest cottage proposals retain their prior complete output.

householdLivingGeometryIssues includes minimum body width for flights/landings, actual connected floor portals and private-room conflicts. Corridor reach subtracts every adjacent shaft before the quarter-foot, 1.2-meter audit. Furniture, bedding and door sweeps retain their existing checks. A previously clear room result alone cannot qualify stairs. These are single-body source gates, not native passage, headroom/rail/camera or NPC passing proof.

The new wealthy proposal has separate source and migration results: furnishing/manifest ownership joins can pass while old circulation rooms and doors remain unresolved. The existing saved-cottage freeze path refuses this recipe; structural/height/site feasibility and an outside-position, reference-complete, native/reload admission remain required before replacing an established home.

### Explicit circulation and door ambiguity in layout references

Verified: 2026-11-01. HouseholdLayoutReferenceChanges optionally carries circulationAliases separate from the existing exact corridor-to-hall merge and entrance-relocation contracts. Each alias requires the same blueprint source origin and floor, source/target corridor purpose, no sleeping claims or beds, complete containment of old cells in the target, and unique nonconflicting intent. Supported wealthy v2 proposals name only unique retained corridor regions. These joins preserve identity inside a household; they confer no building, bedroom or container access.

A door with exactly one candidate remains aliased. Multiple candidates are ambiguous and remain issues; private-through-private doors remain privacy-change with no guessed targets. The existing saved-state helper accepts only one unambiguous target or an already-qualified merged opening and refuses conflicting destination values. Reference drafting never writes saved booleans. Furnishing, named-bed and owned-content joins remain independent of door privacy and site/structural admission.

### Explicit shared kitchen door references

Verified: 2026-11-01. HouseholdLayoutReferenceChanges optionally carries kitchenDoorAliases for deliberate same-floor internal gate replacements. The mapper independently requires the same source frame, exactly two non-sleeping shared endpoints on each leaf, exactly one uniquely retained kitchen, no bed in either endpoint, and unique source/target intent. This can connect a retained kitchen to a revised shared landing instead of its former hall. Without explicit intent, ordinary room-pair mapping still reports a removed gate. Exterior and private-room gates cannot use this contract.

The alias records a qualified doorway identity only. Reference drafting does not initialize or copy live booleans, grant access, admit a building source or authorize private-door changes. Existing saved-state application retains original keys and refuses ambiguous or conflicting targets. The wealthy recipe still has four unresolved private-through cases and remains excluded from the cottage-only freeze path. Source, site/height/structure and native in-app/full-reload gates remain separate.

### Review private openings before admitting new bedroom access

Verified: 2026-11-01. HouseholdLayoutReferences optionally includes privateDoorReviews for private-through-private source openings. Reviews carry original room/member indices, destination room/member indices and unique corridor-entry candidates; they never turn those candidates into aliases. Duplicate names remain separate identities. Retain-original-key-only records the proposed handling of historical booleans; the mapper performs no saved-state write. Privacy-policy, current-state and operable-leaf/native blockers remain mandatory, with additional missing/ambiguous-entry and unresolved-claim diagnostics. Cottage references omit this optional field.

Without an explicit doorLeafProfile, buildInteriorParts emits only the ground exterior operable leaf and groundDoorInteraction rejects non-entry source doors. The opt-in profile below extends those paths, but private blueprint openings alone still do not prove closable or permission-aware doors. Resident circulation, saved-state continuity and native verification remain prerequisites for admitting wealthy private-opening changes. Existing private beds and container access remain governed separately; a review grants no rights.

### Versioned private leaves and player room operation

Verified: 2026-11-01. BlueprintPlan.doorLeafProfile is optional. Omitted profiles preserve existing open interior passages. The explicit private-room-leaves-v1 profile resolves one corridor-fed private bedroom entry in doors.ts, including servant rooms, and refuses unsupported private-through routes, claims/beds in shared circulation, nonunique entries, insufficient body width or a swing that does not enter the real private room cells. The ordinary door generator and its random streams are unchanged.

Only an explicit privateDoorLeaves option on the body-aware wealthy proposal emits public-landing-household-v3. Cottage and legacy profile requests refuse, as does implicit re-proposal of a profiled source. Existing v2 output remains exact. buildInteriorParts emits canonical privateRoomId-tagged leaves at their actual floor elevations; existing BuildingDoor and doorPartForState share render/swing/collision geometry. Default absent booleans read closed for these new candidate leaves; the profile does not write saved booleans. The cottage-only admission rejects v3.

The physical handler retains source identity, same-floor, room, reach and swing guards. Shared-side private operation needs current room consent. Occupied-side exit is allowed when a stay expires. lodgingRoomDoorAccess supplies only exact current paid guest room keys after checking reservation/party/place/world, keeper/business/plot and current guest-bed references. It excludes family rooms and stale furnishing indices. Door operation grants no bed rest, ownership, container goods or private-room consent elsewhere. No household consent is inferred from proximity.

Opt-in resident private-door requests now use source claims and actual bodies as described below. Full room/stair navigation and multi-body swing clearance remain unqualified; exterior commuting retains its existing transient policy. V3 has no normal-play caller or saved-source admission. Four old private opening reviews remain blocked, and source/height/structure/state continuity and actual in-app/full-reload proof still govern adoption. Current tests also expose an inherited default inn106 guest-bed fixture mismatch, reproduced under pre-change source; it must not be used as proof of working native lodging.

### Resident private-door claims and actual bodies

Verified: 2026-11-01. With private-room-leaves-v1 only, buildingOccupancy adds source roomId values and resident privateDoorAccess records to its day schedule. Claims join computeOccupancy slot tags to householdMemberIdentity and canonical leaf IDs; display names, visitor indices and bed array resemblance do not grant access. Duplicate room claims refuse, missing claims grant none, and visitor rows receive no resident record. Ground packet construction carries this optional metadata to BuildingOccupantRender. Unprofiled schedules and packets omit it; ten pre-change schedule comparisons are exact.

createResidentDoorSampler accepts the current rendered-body ledger callback supplied by World3DScene. Private operation needs matching live roster/member/name/home/site/room/leaf identity, real feet on the matching source floor and endpoint-room cells, physical reach and a schedule transition involving the claimed room. Identity is rechecked after cache construction. Same-room activities and shared-space passers-by are not requests. Active use and restoration now require the all-body turning checks and known-open evidence below. New operation refuses a turn intersecting any body. The checks use existing measured body boxes/yaw; radius-only bodies receive a conservative standing box. Player opens remain separately saved and merged; no player consent or goods are granted.

This does not qualify full indoor routes. occupantMotionAtClock still uses straight source schedule segments, and native multi-body swing clearance is not yet qualified. Source-level all-body turning checks are described below. V3 remains opt-in and unadopted. A repaired bounded loader test distinguishes ordinary day shifts, evening public-house shifts and retired owners without asserting that off-window plots are physically represented. Native room/stair passage, camera/use/full reload, old-opening privacy/state continuity and site/structure admission remain separate required gates.

### Shared private-door turning clearance

Verified: 2026-11-01. doorBodyClearance composes siteDoorLocalPoseAtFraction with existing actorSpaceOverlaps. It checks the quarter turn against measured body boxes/yaw and height; radius-only bodies use conservative standing boxes. Twelve angular intervals and a corner-travel expansion cover between-sample motion. Boolean render endpoints remain exact, and the shared pose helper adds no animation. Invalid or missing body measurements refuse clearance.

Private player operations require a current scene-owned player body record matching reached feet. World3DScene supplies ground-instance-bound live ledger readers on door receipts; their body source becomes unavailable on unmount or when that ground instance changes. World3DWrapper reads it after source resolution, and groundDoorInteraction preserves identity, floor, room, consent, reach and egress checks before requiring complete turning clearance. This query grants no room, bed or container permission.

Resident requests use the same full live ledger. Candidate claim packets include cloned full endpoint-room approach cells, permitting a hinge-side stance rather than an arbitrary two-cell portal restriction. The resident still needs exact claim/member/home/leaf identity, actual source floor support and leaf-distance reach. Incomplete old candidate packets refuse. Known-open safety holds cover any remaining body in the turn, even when the requesting resident has gone; missing measurements defer closing. Observed or previously admitted open evidence is required, superseding feet-only recovery. No unknown saved boolean is initialized, and player-saved opens stay separate.

The source checks do not qualify complete resident routes or native usability. Straight indoor schedule segments remain; reachable approach stances, room/stair path following, real multi-body passage/camera/UI and full reload/transient-door continuity still gate adoption. The current v3/private-room-leaves-v1 profile is an unadopted prototype; source sharing/consent, old reference changes and site/structure admission remain unresolved.


### Supported indoor route queries and explicit width

Verified: 2026-11-01. The physical route query now uses the existing supported walking solver with an explicit horizontal clearance radius. Existing runtime callers retain the exact 0.3-meter half-width default; the candidate route checks request 0.6 meters. This is a horizontal envelope, not the full asymmetric rendered body/yaw or a new support-footprint solver. No runtime caller enables it, no resident is moved, and no saved source or permission is changed.

findGroundInteriorRoute is a bounded pure query over resolveGroundWalk. Routes require current door state, explicit admitted-region policy and bounded grid parameters. Every segment checks physical support, stairs, solids and headroom. Failure distinguishes search exhaustion from no route on this grid; neither proves no continuous route exists. The helper opens no door and grants no room or object access. It does not yet plan door operations, include changing NPC bodies, choose a reachable swing-clear stance or replace straight occupant schedule segments.

There are 36 passing focused checks: 26 retained groundBuildingMotion cases and ten groundInteriorRoute cases. Five furnished Hartham variants cover ascent and descent, yaw 0/0.73, both reflected source orientations and a level-two to level-three climb. Every returned physical substep is replayed through the same solver; source plans, furniture and endpoints remain unchanged. Tests also cover obstacle detours, room-policy refusal, invalid dimensions, unsupported starts, search exhaustion, a one-meter gap refused for the 1.2-meter envelope, and radius-cache isolation. Six of nine older groundStairMotion cases fail identically with the original pre-change solver overlay; those inherited fixture/geometry failures remain unresolved and are not accepted stair evidence.

Next extend the existing resident motion/door owner to consume supported room/stair routes and reachable operation stances, with fresh body/door evidence, room consent and safe refusal when a route changes. Keep actual in-app player/NPC passage, camera/UI/use, full reload and transient-door continuity as required separate gates. The in-app driver remains unavailable; no external browser fallback or live app reload is used. V3/private-room-leaves-v1 remains unadopted. Old private-reference changes, saved sharing/consent/fresh and convergent states, site/height/structure, rural land and 268 unplaced household intents, cultivation/work/storage/retention and the full wealth/family/culture/occupation/ruler matrix remain open.


### Profiled resident physical routes and operating stances

Verified: 2026-11-01. The opt-in private-room-leaves-v1 occupancy packet now carries cloned source routeRooms and routeStairs. Shared household rooms and the exact member sleeping claim are admitted; other private bedrooms/guest rooms are excluded even when a leaf is open. Recorded stair shafts and landing cells cover intermediate supported heights. Missing older candidate metadata or borrowed member identity refuses instead of inferring a route. Unprofiled occupancy and the existing street schedule sampler retain their behavior.

InteriorOccupants now connects profiled home residents to advanceResidentInteriorRoute after matching the current roster member/name/home/site. It starts from accepted live feet, targets the hourly source station, and follows physical support at bounded walking speed rather than snapping when the clock advances or the destination changes floors. The query uses a conservative horizontal envelope covering all measured body corners; understating that width and malformed live body data refuse. This can over-refuse a narrow route and is not an exact asymmetric body mesh/yaw solver. Door/grid/source/surface/body changes invalidate or recheck relevant path evidence. Current bodies and physical solids are checked again at every followed segment; blocked residents wait/replan. A static refusal is not repeatedly searched without changed evidence.

For a required closed claimed leaf, the follower seeks an admitted operating stance before the blocked room destination. Candidates need source room/floor policy, physical route reach, opposing supported clearance sweeps and the existing all-body full-turn query. Opposing sweeps reject positions inside walls or furniture before costly grid searches. Only the existing resident door sampler may open the leaf after reading the reached body; the follower writes no door boolean and grants no player access. After observed opening it replans to the station. A body already on the destination side is not sent back merely because the door closes behind it.

There are 93 passing affected checks across five suites: ten new controller cases, 38 InteriorOccupants cases, 24 private resident-door cases, five exterior resident-door cases and 16 building occupancy cases. The ten controller cases pass again after the final width/cache/stance repairs. They cover furniture detours, new body blocking and recovery, accepted-foot preservation after source/clock changes, invalid bodies and understated width, unchanged refusals, private-room exclusion, rotated/reflected stances, actual door-owner admission and bystander refusal, and a furnished supported stair ascent. The previously missing landing-cell permission is repaired without widening household access. Four changed source/test paths pass scoped typecheck. Mock Three/DOM warnings are test-environment output, not a whole-app console claim.

A bounded source timing experiment for the same 37-point Hartham approach measured 3079.1437 ms cold and 3153.7113 ms warm before the opposing stance probes, then 61.8607 ms cold and 14.9714 ms warm after them. These are isolated synchronous query timings, not rendered FPS or a frame-budget acceptance. Cold/plural-resident planning can still exceed a desktop frame budget; measure and, where needed, spread planning work across frames before source adoption.

This is candidate integration, not normal-play or save adoption. No production proposal caller enables v3, no immutable source09 is created, and source08/live player state, goods and saved permissions are unchanged. Street/interior ownership and body-budget prediction still use the existing schedule sampler; an OUT handoff can occur before a delayed physical body reaches its frontage. Safe physical handoff, rebuild/transient continuity, actual measured-body turns/passing, camera/grain/UI/object use and full reload remain open. The in-app driver is unavailable; no external browser fallback occurs. Preserve four old private-reference issues, fresh/convergent saved states, consent/site/height/structure gates, six baseline-identical old stair fixture failures, inherited inn106 mismatch, rural land/268 unplaced household intents, cultivation/work/storage/retention and the full wealth/family/culture/occupation/ruler matrix.

Next qualify the opt-in routes against every represented household station and actual measured body, fix any unreachable endpoints/layouts, bound cold/plural-resident planning and make street handoffs depend on actual physical arrival before native in-app passage/camera/use/full-reload acceptance. Do not admit a saved candidate or force feet to make the schedule appear complete.


### Household representation and measured station/turn evidence

Verified: 2026-11-01. The audit exposed a regression in the new opt-in actor branch: requiring a bounded-roster join could hide an otherwise genuine source household member on first mount. InteriorOccupants now retains its visible source body and all-body collision ledger entry while route authority is unavailable. heldResidentFoot prioritizes accepted feet, then actually observed group placement, then the prior retained placement; the initial source station is used only when no placement has ever been known. Later clock/destination changes do not relocate that body. Initial representation is not physical-support acceptance, and body-budget visibility remains separate. The hold grants no room/door permission and does not bypass existing exact roster/claim checks. Four children still need lawful route/door joins before the household routine can qualify.

The current Hartham candidate audit covers all nine original household members, 34 distinct destinations and 171 HOME hour slots. It rebuilds current canonical body recipes through recipeFromOccupant, generateEntityBlueprint and assembleEntity/gameBodyOptions at the renderer options, samples t=0/0.5/1 with the standing-body measurement owner, and compares canonical physical parts with both the route envelope and measured boxes. This is headless source/geometry evidence, not mounted WebGPU/native visual proof or an accepted source08 body golden. Five current roster names/member identities join; four children use the bridge's existing3403/3404/3405/3406 render recipe fallback because they have no bounded-roster row. No people or roster IDs are created/renumbered.

All25 non-sleeping targets clear the measured standing boxes at the source idle facing. Five of those targets refuse under the larger conservative circular/square route envelope. Those refusals alone are not proof that furniture needs relocation. A source-derived barrel-side regression is clear at yaw0 but overlaps at yaw45 degrees, and the existing turning guard refuses a quarter turn. Standing, turning and continuous route clearance must remain separate claims. The nine sleeping destinations still point to bed centers and overlap standing-body collision; this requires real bed approach/arrival plus the future sleeping pose/support owner, not removal of beds or fictitious arrival.

Disposable larger-radius and kitchen-furniture experiments are rejected. Adult .65m/child .4m allowances exposed four service-kitchen no-clear-space states; table/bench changes reduced them but still produced a wall refusal. They do not justify replacing an original source layout whose25 measured idle boxes are clear. Original v2/v3 furniture, household, occupancy allocation and property/reference joins remain unchanged. This new evidence changes the next action from moving furniture to qualifying measured-body translation, orientation and turns first. It does not lower the usable-space standard or dismiss source crowding.

There are75 passing affected checks across three suites (13 residentInteriorMotion,38 InteriorOccupants and24 residentPrivateDoorUse), plus three scoped source/test paths with zero errors or suppressed imports. The one advisory sync finds both source headers current, skips the test outside its graph and leaves five dependent headers untouched. No rendered visibility, camera, whole-app console or full reload claim follows from those tests.

V3 remains unadopted and no normal proposal caller enables it. No source09, live app refresh, external browser, player-foot/save/goods/permission write or household regeneration occurs. The in-app driver is still unavailable. Keep source08 and the four old private-reference issues, saved sharing/consent/fresh and convergent states, site/height/structure, six baseline-identical stair fixture failures, inherited inn106 mismatch, rural land/268 unplaced household intents, cultivation/work/storage/retention and the full wealth/family/culture/occupation/ruler matrix open. Targeted MemPalace mining is skipped because its CLI is unavailable.

Next extend the existing physical walking/route owner to honor the measured body bounds and facing through translation and continuous turns, retaining accepted feet and refusing unknown geometry. Recheck every station and route with those bounds before changing furniture. Then resolve the four real household/roster joins without renumbering people, bed approach/posture, physical frontage handoffs, cold/plural planning and native in-app body/NPC/camera/use/full-reload acceptance.


### Measured walking boxes and continuous static turns

Verified: 2026-11-01. resolveGroundWalk now accepts an optional GroundBodyFootprint in the existing owner. It reuses the actor separating-axis sweep against canonical building/door/retained-prop solids, preserving asymmetric offsets, measured facing and explicit margins. Shared sweep metadata exposes the winning world contact normal for sliding. Existing callers retain their radius/default behavior; accepted idle feet and the old nearest-exit recovery are unchanged. A new isGroundBodyClear query does not treat that old recovery rule as proof of a clear stance. canGroundBodyTurn reuses the sampled corner-travel guard with zero structural height tolerance, so short head contacts still refuse. Malformed measured bounds or canonical solid data refuse new admission; no mesh or save is resized.

InteriorRouteQuery can carry a fixed measured facing. The opt-in resident follower supplies its current reported box, checks a complete turn against people and static geometry before changing facing, then sweeps translation with that actual orientation. A blocked turn can retain facing and sidestep; a safe earlier turn can precede entry to a tighter station. Every followed segment still checks support, current bodies, current doors and the admitted region. This does not implement orientation-state path search. Low risers retain the legacy 8 cm foot proxy and point support; mounted deck collision remains a conservative radius fallback. These limits remain qualification gates.

A box query is evidence about the supplied source frame and pose. The fixed-facing grid does not prove that no route requiring a different orientation exists. Headless body reconstruction is not a native body golden. Current default-town plot identity must not be substituted for an incompatible observed home; the Hartham diagnostic now preserves recorded recipe IDs separately from fresh canonical joins. See TRACKER.md#building-comfort-measured-body-translation-and-continuous-turns for source versions, 153 focused cases,25 standing targets/18 stair queries and remaining gates.


### Resumable resident routes and door approaches

Verified: 2026-11-01. groundInteriorRoute exposes a lazy task with work/time slices; its diagnostic batch export drains the same steps. The opt-in resident controller holds accepted feet until a result is available. Door candidate validation and approach routes share this owner. InteriorOccupants supplies one 2 ms/128-unit allowance per render frame across nearby residents, using16-unit/0.5ms peer quanta and allowing a sole job the unclaimed remainder, with fairness based on work consumed. Earlier jobs can continue only after current-frame actor validation; their results wait for that actor to revalidate before use. Time is cooperative; an atomic geometry/door query or cold cache can overrun.

Pending jobs snapshot bodies and are cancelled on source/policy, door, body dimension/facing, destination or accepted-position changes; unmount/loss of authority cancels them too. Current static/dynamic collisions and privacy are rechecked while following each real step. Crowd motion no longer erases a pending frozen proposal. Its candidate route never grants movement; every actual step and turn checks current bodies. Geometry/region packets remain immutable source contracts. Batch diagnostics are still synchronous and must stay off live frame paths.

See TRACKER.md#building-comfort-resumable-resident-route-planning for114 distinct affected checks, source hashes and remaining gates. Native rendering, FPS, full routines, bed arrival/posture, saved-source/household compatibility and adoption remain separate acceptance requirements.


### Crowd snapshots and current-body walking admission

Verified: 2026-11-01. Pending resident route/door-approach proposals retain their frozen crowd instead of restarting whenever a bystander moves. Source/policy, door, own dimensions/facing, destination, support-source and accepted-foot changes still cancel. A completed path is only a candidate: the physical follower sweeps each turn/translation against current people, canonical solids and source-permitted rooms. The separate door owner still checks current bodies/claims before operation. Refusals remember the searched crowd fingerprint so changed crowds can retry. This does not implement reciprocal avoidance or ensure opposing trips finish.

The isolated recorded-body stair comparison removes distant-motion starvation, but nine first-movement waits of36.6–65.6 simulated seconds expose a serious remaining planning-latency gap. See TRACKER.md#building-comfort-planning-progress-through-moving-crowds for exact fixture/version limits, failed initial harness, passing reduced comparison and68 affected checks. It does not qualify real frame time, a cohabiting household, native passage or save/reload.


### Planning allowance use and distant ceiling bounds

Verified: 2026-11-01. The shared resident budget may continue any job validated by its actor in this frame; it must wait for unvalidated older jobs and never advances bodies itself. A sole job uses the unclaimed128-unit/2ms allowance. Completed candidates stay associated with the exact job until its own actor checks source, body, doors and accepted feet again. Budget call work/time include all tasks run by that call. Cancellation, aging and least-work-served fairness remain.

Measured walking rejects distant overhead slabs with a conservative radius covering every rotated/asymmetric body corner and explicit margin before the existing exact contact test. Nearby ceilings, support stepping, solids, dimensions and privacy are unchanged. The single furnished-stair comparison retains every route point/distance/expansion and the same22,866 probes.100 affected checks pass. Work-only improvement is separate from the serious remaining real-clock latency and cooperative overruns; see TRACKER.md#building-comfort-full-planning-allowance-and-conservative-ceiling-culling. Native/shared-household/fullreload and adoption remain unqualified.


### Indexed canonical support and contact candidates

Verified: 2026-11-01. groundBuildingMotion retains1m rectangle bins with the existing immutable building/door-state packet. Support points, swept-body/ceiling ranges and standing/turning circle bounds select candidates, keeping source order before exact tests. Wide/unknown rectangles and large/unsafe queries retain fallback scans. Range memoization is capped at256 entries per index; weak building keys follow the existing cache lifetime. No support height,0.04m sampling, measured anatomy/margin, contact/turn rule, mounted-surface callback, loaded-overlap recovery or privacy policy is changed.

Candidate selection is not admission or a saved-building migration. The direct furnished route and7776 independent pre-index decisions remain exact;94 focused cases pass. The remaining physical probe count, serious real-budget latency and sampled atomic/cold/GC overruns are separate gates. See TRACKER.md#building-comfort-indexed-canonical-support-and-contact-candidates for source hashes, fixtures and limits. Native cohabiting households, camera/use/fullreload, source compatibility and adoption remain unqualified.


### Bounded wider stair proposals with complete fine fallback

Verified: 2026-11-01. InteriorRouteQuery may declare coarseSearch with a2–8 integer step multiplier and its own positive node allowance. After direct-route preference, vertical trips over0.5m may try that source-aligned grid using identical0.04m supported physical traces, body/margin and admitted-region checks. Failure preserves the entire original fine-node allowance; expansion reporting sums both passes. Default/same-floor behavior remains unchanged. Settings are cloned for pending tasks and included in resident invalidation. InteriorOccupants opts its existing private-room-leaf physical controller into factor4/128 extra nodes before3000 fine nodes; this grants no room/door/container/bed rights.

Coarse refusal is not proof of no route. Radius-only and shifted-grid tests preserve valid fine routes. Source-household permission replay validates108 wider routes against108 fine counterparts across nine recorded bodies, three floor pairs, directions and transforms; the measured route increase is at most5.583percent. A shared door-state object matches normal mounted cache identity; independent sets remain a stress variant. See TRACKER.md#building-comfort-bounded-wider-stair-proposals-with-complete-fine-fallback for131 focused checks, source versions and remaining timed/cohabiting/native/adoption gates.


### Existing-body contact recovery in opt-in resident routes

Verified: 2026-11-01. advanceResidentInteriorRoute now checks existing actor contact before returning at-station or proposing a crowd-admitted route. It reuses yieldActorStep with unchanged facing and a supported same-floor probe: every at-most0.04m increment checks the measured ground body, current all-body clip and source room policy. Normal1.2m/s and0.1s-clamped time apply. The existing0.08m vertical recovery bound refuses floor jumps. Accepted feet are returned for the caller; no other actor, door, save or permission is written. Missing source authority or malformed neighboring geometry holds position.

Blocked local recovery uses a transient fingerprint of accepted feet, current crowd/facing and step allowance, cleared by existing source/body/door invalidation. This avoids identical repeated probes; it is not reciprocal crowd avoidance, orientation search or a completed routine. Source-only cohabitation clears one initial child contact but0/9 supper-to-evening trips finishes in4000frames. Seven evening goals begin occupied, and three idle-facing station pairs recur through the day. Keep measured station capacity, destination dependencies, bed poses, saved-source joins and native camera/NPC/use/full reload open. See TRACKER.md#building-comfort-cohabiting-station-audit-and-bounded-contact-recovery in docs/projects/gameplay-flow/ for source hashes and79 focused checks. Rendering grain/haze remains unverified in the current loaded in-app view; no rendering defaults change in this milestone.


### Approaching occupied resident stations

Verified: 2026-11-01. The opt-in resident controller distinguishes a frozen route proposal from permission to move. For normal station routes, bodies overlapping the destination may be omitted from the proposal snapshot. Other aisle bodies remain; door-operating stance proposals retain all bodies. The current all-body turn/step checks and original source region still govern actual movement and arrival.

When an actual step is blocked, the controller retains the route only if removing destination occupants clears that exact step in a separate diagnostic clip. Static or unrelated aisle obstructions retain replanning. It never moves another actor or changes doors, ownership or access. This is waiting for space, not reciprocal crowd negotiation. Four of nine source household trips finish within4000frames; all nine crowd-free fixed-facing queries find routes. Five failures, measured station capacity, actual facing, source joins, bed posture and native in-app camera/use/full reload remain open. See docs/projects/gameplay-flow/TRACKER.md#building-comfort-approach-occupied-stations-without-crossing-their-occupants for81 focused checks, source versions and proof limits.


### Whole-route refusal and changes of facing

Verified: 2026-11-01. Resident room routes still use frozen-body proposals with destination-specific omission, followed by current all-body physical steps and turns. A general source-only fallback was tested and rejected; it is not production behavior. Whole-route refusal can coexist with a clear short translation, and a route found at a different facing is not authority to assign that facing.

In the retained cohabiting fixture, four blocked residents have clear first0.02m route steps. The spouse has five legal short translations but no route at its current -135-degree facing. A route query at the original idle facing succeeds, while the checked turn to that facing is refused at the current feet. The current fixed-facing search does not establish a safe maneuver to a turn stance. See docs/projects/gameplay-flow/TRACKER.md#building-comfort-rejected-crowd-fallback-and-measured-maneuver-limits for the unchanged production source versions, two-direction experiment and limits. No native passage, source adoption or camera acceptance follows from these probes.


### Current pose-search and capacity limits

Verified: 2026-11-01. Production still uses fixed-facing route proposals, live turn/step checks and destination-specific waiting. Experimental partial routes, facing preview and pose-state queries are not shipped APIs or behavior. Source diagnostics show that full household outcomes can regress despite clear local steps and valid individual routes. Whole-fixture scale controls are also nonmonotonic and include furniture scaling; they do not establish a valid furnishing program or accepted envelope.

Keep actual body, furnishing geometry, simultaneous movement and station capacity as separate evidence until normal play joins them. Current production source versions and all rejected candidates are recorded in docs/projects/gameplay-flow/TRACKER.md#building-comfort-maneuver-and-density-controls-with-the-in-app-setting-identified. Native verification is pending the corrected WF-G372 setting dependency; no source adoption, rendered camera acceptance or broader household qualification follows from these diagnostics.
