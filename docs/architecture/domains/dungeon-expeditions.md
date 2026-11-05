# Dungeon expeditions

Verified: 2026-11-04

Worldforge owns each dungeon's source site, frozen seed path, history, geometry,
inhabitants and objects. Gameplay uses that source rather than a preview seed.
The integration goal and played evidence live in
[Gameplay Flow](../../projects/gameplay-flow/NORTH_STAR.md).

## Lighting and party sightlines (candidate)

The November 2 visual candidate keeps Three.js 0.172.0 and the existing WebGL
renderer. It does not install the newer WebGPU examples. Foreground structural
materials receive a narrow, opaque dithered camera-to-party cutaway; source
geometry, collision and shadow materials are unchanged. The ordinary camera
controls include Keep party visible and Soft lighting options.

Room-local spherical-harmonic diffuse data uses the installed Three.js
LightProbeGenerator. Only existing shadowed fixed fixtures contribute; carried
light and bodies are excluded. Room floor ownership prevents a global probe
from lighting adjacent rooms. The refined candidate captures one cube face per
frame and uses separate, reusable static shadow maps. Bakes are disposable,
cancel on movement and are not saved discoveries or rewards.

Five focused cases pass, and four production paths have zero scoped type errors
and zero suppressed imported errors. One header wave updates four production
files; two tests are outside the graph and two dependents remain unwritten.
The first native candidate visibly cuts foreground stone at 87,63. Ordinary
walking reaches 87,60/1524 mapped cells with 9/9 HP; room 20 produces nonzero
warm SH coefficients. The first synchronous bake stalls about 3.8 seconds,
so it is superseded by the incremental candidate. The incremental capture,
new options, performance and post-change save/full-reload continuity still need
native qualification. The inspected Design Preview render is supporting proof,
not a substitute for that gameplay check.

The retained browser closes before the next manual Save command can run. On
reopening the same profile, a read-only check finds a newer native autosave at
63,35/1686 cells, timestamp 1793574904843, beyond the last inputs sent here.
Its provenance is unresolved; preserve it and do not import an older proof or
overwrite it. The user has been asked whether this is their newer play.
The coordinated repository sync completed and the user resumed the goal.
November 4 verification preserves the newer checkpoint as authoritative; its
earlier unexplained movement remains unattributed. No fight, victory, new
claimed reward or completed expedition follows from this visual work.

## Legacy household links during source admission

The November 4 normal Continue refuses the current source before gameplay
mounts. A read-only producer observer first reports no matching historical
layout for either terrain reader. Reader 4 independently matches all 491 saved
founder IDs and names, and all 26 later residents have their saved birth evidence.
The mismatch is 473 absent optional householdMemberId fields in legacy people;
no recorded household link conflicts. Missing information is retained as missing.

The layout qualifier now accepts that absence while checking exact IDs/names,
unique source roles, recorded links, births, homes and observed foundations.
The following recorded-NPC join uses the independently qualified founding
roster's exact person ID when the saved link is absent. It does not match by
name alone, assign a household link, move a resident home, revive anyone or
rewrite NPC memory. Conflicting links and duplicate source or saved identities
still refuse. All business, keeper, door, bed, source and physical support checks
remain in their existing owners.

Two layout regressions and two NPC regressions fail before their repairs.
The affected suites then pass 36 and 32 cases respectively; four scoped files
have zero type errors and zero suppressed imported errors. Native replay after
the layout repair advances to the recorded-character join, confirming the first
boundary is repaired in the actual producer. The complete repaired producer and
ordinary native load still require qualification. Desktop lighting/options,
bake timing, gameplay and save/full-reload proof remain open.

All eight native payloads are byte-exact after the refused load and read-only
diagnosis; their sorted payload archive SHA-256 is
65c99bf73600d9282978a11db89d974565312e154dcebd967930ed65f61ccc79.
The current autosave remains 63,35/1686 cells, 9/9 HP and 20.69 gold. The original
profile is retained; no older proof was imported. The bounded source-check
window has ended and its shared runtime lease is released. No gameplay, render,
inference or test workload remains active from this pass. The
[save/load domain](save-load.md#legacy-household-link-compatibility) owns the
generic compatibility behavior.

### Mixed saved NPC source projections

The complete repaired producer still refuses npc_burg_675_plot_157: the newest
record calls the shopkeeper Joss Greendown, who has no matching saved villager.
Retained native records call the same NPC Sten Ironwell, matching saved person
228. The old and new TownSim populations are byte-exact. Party, inventory and
discoveries are also exact; source projections instead grow from 115 to 163
generated NPCs and from 111 to 159 businesses. Ten existing NPC identities
change, including Bram Ironton to Mara Hartcroft. Existing shared NPC memories
and business objects remain byte-exact. This drift was missed during the
earlier reload check; it is not accepted world progression.

A disposable proposal replaces only the three drifted projection registries
from the retained native witness, keeping all 138 other latest fields exact.
It still refuses an older record, npc_burg_675_plot_16 / Edmund Dunhall, which
already has no matching saved villager in the witness. That proposal is
rejected. It was never loaded into gameplay or saved. Restoring an older whole
campaign, renaming a person, deleting the 48 added projections or relaxing the
source guard is not an accepted remedy.

Static inspection identifies a recipe difference to measure next:
`computeBurgMerchants` scales the canonical plan before `toArtifactPlan` and
roster generation; `townRosterForBurg` and `buildTownSimStateForBurg` adapt the
unscaled plan. The adapter filters small plots before assigning IDs, and roster
capacity depends on generated bedrooms. A bounded read-only worker comparison
now confirms scale changes reader4 from 491 to 500 founders, with 481 numeric
ID/name disagreements against the saved census. Styling alone changes none.
However, neither reader4 recipe contains Edmund; both make plot16 a house.
Reader2 contains Edmund at b28:head, assigned as proprietor at plot29, while
its plot16 worker is Ned Stonedown. Its 1559 unscaled founders disagree with
the retained census. Thus scaling alone is disproved as Edmund's cause, and
none of these recipes qualifies his saved plot16 tavern. Full comparison proof
is ignored at `.agent/scratch/dungeon-expedition/nov4-compare-source-recipes-all-result.json`.

The comparison also exposed a prevention gap: the 2D registration hook waits
for source admission, while deferred 3D registration calls the shared merchant
owner directly. `computeBurgMerchants` now returns no NPC/business updates for
an existing town without a qualified layout. A fresh town without a life record
still registers normally. Two regressions failed before this guard; all 13
merchant cases now pass, including earlier-layout and stock preservation, and
both changed files type-check with zero errors or suppressed imported errors.
This prevents further default-layout projection through either caller; it does
not reconcile the already conflicting campaign or qualify a native reload.

The eight-slot offline audit narrows the first retained appearance: Edmund and
The Howling Dragon at plot16 are absent in the October29 1-hour, 15-minute and
30-minute checkpoints, and present in the November2 manual save and every newer
slot. The recorded tavern has foundedDay5 and no NPC facts or interactions.
This is a provenance boundary, not permission to erase the records. All eight
native data payloads remain byte-exact after these diagnostics, with the same
SHA256 65c99bf73600d9282978a11db89d974565312e154dcebd967930ed65f61ccc79.
The read-only proof is `nov4-native-preservation-and-npc16.json` in the same
ignored scratch directory.

### Pre-conflict proposal and retained trades

The bounded native-copy proposal uses only the three projection registries from
checkpoint1793306038449. All 138 other latest fields and the census remain
exact. It compares 67/63/72 NPC/business/memory entries with the latest
163/159/168. All shared businesses and memory records are byte-exact; eight
shared NPC records differ only in identity/biography fields. The 96 added memory
rows have no facts, interactions or goals. This audits a candidate, not authority
to erase records or change the campaign. No candidate was loaded or saved.

The first proposal passes NPC joins but exposes a separate compatibility error:
13 of the 30 retained businesses in burg675 differ from the newer fitted-use
trade rule, while all 30 match the earlier role-and-plot draw or current rule.
Git220b4db23 independently retains that earlier registration rule. Admission now
accepts those exact earlier trades without changing stock, owners or buildings;
all original workplace/keeper checks remain. All 35 affected cases pass,
including legacy-trade acceptance and unrelated-trade/wrong-owner refusal.
The positive and owner-boundary regressions failed before the fix. Both changed
files type-check with zero errors and zero suppressed imported errors.

After refreshing the owned3021 server with that tested repair, the disposable
producer clears the identity, business and other site joins but refuses the
latest saved feet under both terrain readers1 and2. Its input remains exact.
The proposal remains rejected and unapplied. Final native reads again preserve
all eight payloads and the same SHA256 above. Proof is
`nov4-preconflict-proposal-result.json` and
`nov4-preconflict-business-result.json` in ignored scratch.

### Exact return-support measurement

The bounded read-only reconstruction now measures both terrain readers at the
exact saved x468.56632298736395/z470.794030803515/y4.065515117089452. Both give
continuous terrain Y3.9926996844378215: 0.07281543265163082 meters below the
saved feet. Movement footing support is true and water evidence is valid/dry;
the exact source-height comparison is the refusal. Ordinary movement support
alone does not establish unchanged source geometry.

The latest exterior position, active dungeon return context and pre-conflict
checkpoint are exact matches, as are all seven retained active-visit slots.
The retained nearest-cell sampler instead gives Y3.9174446044921876, which also
fails to reproduce the saved feet. This disproves sampler selection alone as
the cause; no height tolerance or body correction is accepted. Diagnostic input
and all eight native payloads remain exact. Proof is
`nov4-exact-support-result.json` and `nov4-saved-return-pose-timeline.json` in
ignored scratch.

Structural comparison against Git220b4db23 finds one code difference in
`flattenBuildingTerrainPads`: the current call explicitly selects height-grid
nodes, while the retained call uses cell centers. All other function code is
identical after comments/formatting are removed. The comparison hashes and
retained function are archived in ignored `nov4-pad-source-comparison.json` and
`nov4-retained-pad-function.txt`. This comparison identifies the single source
variation tested in the next bounded experiment.

### Retained pad-grid cause reproduced

A disposable module restores only that retained grid argument in the served
ground builder. Both terrain readers then reproduce continuous ground
Y4.065515117089068 against saved Y4.065515117089452, a difference of
3.8458125573015423e-13 meters. Footing remains supported and dry. The exterior,
pre-conflict and active dungeon-return poses all give the same result. This
reproduces the 7.28-centimeter source change without moving Sana, increasing a
tolerance, altering application code or applying a recovery. Worker input and
all eight native payloads remain exact, with the same SHA256 above.

The experiment records one edit, served/candidate function hashes and every
measured point in ignored `nov4-retained-pad-result.json`. It proves the pad-grid
cause at the saved position. It does not qualify the whole world: both regional
readers match locally, and the original mixed NPC projections remain untouched.
No native recovery or complete source selection has been accepted.

### Versioned reader and recovery review

The retained foundation recipe is now implemented through the existing terrain
source identity, not another save store or global pad rollback. Sources 1 and 2
keep their prior recipes and new games still use 2. Source 3 uses regional reader 1
with retained center-index foundations; source 4 pairs regional reader 2 with those
foundations. Region provenance reaches ordinary ground, worker, Atlas and rest
builds; caches distinguish profiles without changing generation seeds.

Five regressions failed before implementation. The affected checks now pass 80
distinct cases: 8 source cases, 7 foundation cases, 37 admission cases,
20 worker transaction cases and 8 storage cases. All 11 changed TypeScript files report
zero errors and zero suppressed imported errors. One scoped header pass updated
only owned source headers; no dependent source or unrelated work was written.

The normal source-loading service and real worker validate an explicit source 3
proposal from the newest native payload: burg 675, town reader 4, 491 founders,
zero observed foundations and surface Y4.065515117089068. Its 137 other campaign
fields are exact. Town life is exact except the qualified layout marker; the
three proposed projection registries come from the audited pre-conflict witness.
Input remains exact. Proof and the non-importable, unapproved candidate are in
ignored `nov4-source3-service-proof.json` and
`nov4-source3-proposal-not-approved.json`.

Absent-source replay correctly refuses selection: sources 1 and 2 fail exact support,
while 3 and 4 both qualify. `nov4-profile-ambiguity-result.json` records that real
producer result. The reference audit finds no added NPC/business IDs outside
the three proposed registries; all 96 added memory rows are identical defaults
with no recorded facts, interactions or goals. A read-only recovery-store audit
finds no emergency, defeat, fallback autosave or session-cache payload at this
origin. All eight native IndexedDB payloads remain byte-exact with the same
SHA256 above. No new slot or profile was created, and no source choice or load
was applied to the native campaign.

A user choice is requested for an isolated recovery copy using source 3. That
copy would restore eight NPC records and omit 96 mismatched shop/NPC projections
while preserving the latest party, inventory, rewards and dungeon progress.
The original profile/saved payloads must remain intact. This is a proposed
explicit source choice, not a claim that regional history was uniquely inferred.
If approved, validate an isolated copy, use the normal save/load path, inspect
the actual desktop result, then verify ordinary save/full reload before resuming
expedition actions. Until that choice, no recovery application is authorized.
Lighting, incremental bake, actual expedition outcomes and full continuity
remain open; no new expedition outcome was played during this source repair.

## Existing owners

- `src/systems/worldforge/dungeon/world/dungeonSites.ts` enumerates source mouths.
- `deriveIdentity.ts` resolves a receipt and generates its exact source plan.
- `src/components/World3D/dungeonEntryRuntime.ts` validates entry and captures the world return pose.
- `DungeonExpeditionOverlay.tsx` reuses `Dungeon3DPreview.tsx` for movement and rendering.
- `dungeonLifecycle.ts` and `worldReducer.ts` persist level visits, map knowledge and stable progress IDs.
- `dungeonCombat.ts` projects source floor, walls, deployment and the registry monster into existing combat.
- `dungeonCombatResolution.ts` checks the source outcome before `END_BATTLE` settles party attrition and rewards.

## Rumor names and saved dungeon identity

Nearby legends resolve each shortlisted site through the same
`generateDungeonForIdentity(dungeonIdentityForSite(site), worldSeed)` path as
dungeon entry. This preserves the existing unsigned-root generation policy for
legacy interiors while validating site membership against the full world atlas.
Both rumor caches use the full seed; different full seeds can share a uint32 root.

Stable-ID dungeon offer synchronization refreshes only text for a matching event
and location. It retains first-seen time, expiry, spread and virality. Paid notes,
NPC memories and saved expedition records are separate historical knowledge and
are not rewritten. Ordinary chronicle rumors retain their existing deduplication.

The actual timestamp-seeded Sana save reproduces the earlier GF-G38 source audit:
the same Alrio expedition was called Erala by direct full-seed rumor generation.
The repaired native reload now projects Alrio while preserving party, inventory,
gold, NPC memory, discovered sites, expedition, town state and feet exactly.
Thirty-seven affected checks and four scoped type paths pass. This qualifies
identity and projection continuity, not a new route or dungeon outcome.

## Instance colors and visible creature habitat

The shared InstancedPieces primitives carry instanceColor but no geometry.color.
Their basic and standard materials therefore leave vertexColors disabled. Three
uses the independent instance-color input automatically; enabling the missing
vertex input multiplies away the diffuse color. This follows the existing masonry
material policy. The repair changes two material flags, not the source model,
lighting, geometry, visibility or encounter behavior. Native desktop comparison
at Alrio 90,65 restores the authored surface tint, and ordinary orbit/Follow me
preserves saved state. Twenty-two existing model/hazard checks and the scoped
renderer typecheck pass. The decoded served source map matches the current file.

That actual visit also exposes an unresolved source habitat gap. The visible
Water Weird spawn at 93,64 lies on Bloom; its surrounding 5 by 5 source cells have
no Water overlay and no pool prop lies within three cells. The runtime registry
keeps the CR 3 Water Bound trait. The source sewer apex tier can select this
creature without establishing final water occupancy. GF-G96 owns the observed
inconsistency. Do not infer a free kill, add a visual pool as a gameplay claim,
or silently regenerate a saved plan. Combat enforcement and the remedy's saved
world policy remain unqualified.

## Ordinary closed doors

`dungeonDoorActions.ts` accepts an ordinary closed leaf only when the party's
accepted floor square is adjacent. The overlay rechecks that accepted position.
The existing `openedRouteIds` ledger stores a level-specific door ID. A projection
changes that leaf to open for rendering, movement, the parchment and tactical
combat. It retains the source grid, rooms, traps, props and spawn objects. Opening
a leaf does not reset the party to its arrival square.

Unknown route IDs and other levels' IDs cannot open a leaf. Secret and bricked
doors retain their source states. Closing, locks, searching and demolition are
not implemented by this helper. The checked generated crypt fixture emits open
passages, so its mounted closed-leaf regression uses an explicit authored test
variant. No closed leaf was added to a live dungeon. Live door interaction remains
unaccepted.

## Camera framing

Actual northern-corridor play reached37,16. The Follow Me view hid most of the
party behind the near wall; source floor and directional controls remained
traversable. The repaired frame was inspected after full reload and ordinary
Continue at the same accepted position, on1280×800 and390×844 viewports. The
party is visible in both. A normal right-drag followed by Follow me restores
the same clear framing without moving the party. Sana remains at9/9HP.

`dungeonPlayerCamera.ts` follows the existing world camera's bounded-candidate
pattern against the dungeon renderer's structural boxes. It keeps the old frame
when clear and tries nearby directions, shorter arms and higher eyes when walls,
caps or closed leaves obstruct the party. It never changes footing or source
geometry. Inspection presets and manual MapControls remain available. Props and
unsupported ceiling forms are outside this wall-focused candidate. Rendered
verification covers this played corridor; other layouts remain subject to actual
play. The input hint now matches the existing controls:
drag to pan and right-drag to orbit.

The candidate passes four camera checks and its two source paths pass scoped
typechecking. Clicking the current preset again requests fresh framing after
manual orbiting. The next action returns to legitimate north-passage exploration.
Before restarting the private verification server, raw readonly IndexedDB
transactions confirmed both manual and automatic saves at37,16, with the actual
torch and rubble observations retained. Neither save contains a cleared
encounter or claimed reward. Earlier immediate helper reads were premature;
the settled stored transactions establish this checkpoint.

## Current limits

Normal chamber exploration reached45,11 with9/9HP,303 known floor cells,
no cleared encounter and no claimed reward. Settled raw manual and automatic
saves both retain that position. The chamber survey exposed a navigation gap:
discovery inks only the occupied cell and four neighbors, although the rendered
torchlit room is visible. This forces strip-by-strip mapping to find its exits.
The current bounded experiment extends the existing dungeonMap discovery owner
to remember floor within20ft when a fixed source torch lights it and both sight
rays are clear. Walls, closed leaves and sealed diagonal corners block rays.
Dark areas keep the existing near-footing behavior; carried light and character
vision are not invented. Five focused map checks and two-file scoped typechecking
pass. Full reload and ordinary Continue restored45,11 with9/9HP. The inspected
parchment records314 cells instead of303, preserving the distant concealed rooms
and the chamber's unlit center. Normal westward play then reached42,11 and321
known cells. Subsequent ordinary survey and pool examination reached16,6 with
463 known cells. Both settled saves retain the footing and the three source
object findings (torch, rubble, pool), with no clears or claimed rewards.
Full reload and ordinary Continue restore16,6,9/9HP and the rendered463-cell
parchment. The pool was left undrunk because examination establishes no safety.
This closes the bounded new-ink continuity check. No victory, reward or
whole-expedition acceptance follows from this map repair.

The standalone preview's developer cache/objective callbacks simulate progress;
production hides those controls. They do not establish earned inventory loot or
a completed story. The source
Water Weird fight has been played to defeat, with no reward. Fixture victory
coverage is separate from an actual won expedition.

Source mouths can be outside the town's retained Local. In the played Choux run,
the sewer is 9.12 km east of the party and the 914.4 m town window contains no
entrance. The Classic map's selected-Local entry discards that selection. Preserve
the site and repair navigation through the existing artifact/entry owners; do not
move or fabricate a convenient mouth. See GF-G37 and GF-G38 in the
[gap registry](../../projects/gameplay-flow/GAPS.md).

Traps, secrets, further furnishings, water hazards, full stair travel,
world consequences and complete victory/retreat/revisit/failure continuity still
require actual gameplay. This domain records current behavior, not acceptance.

## Active visit continuity and foreground controls

The active expedition renders in a body portal while the retained world scene is
suspended. The parchment marks the party only on known floor and pauses dungeon
input while open. The ordinary SystemMenu uses the existing action owner for
saving. Its portal must remain above the expedition; an actual phone click first
exposed the previous inverted layers. Distant stair controls are hidden. Return
to the world requires standing at the root page's actual entry square.

The existing progress ledger now carries optional `activeVisit` footing, depth,
entrance kind and frozen world return context. Save migration validates its shape.
Resume regenerates the canonical source stack and refuses unknown pages, blocked
floor and foreign worlds. It does not dispatch another entry or increment visits.
Retreat clears current footing while retaining discoveries, route openings,
source injuries, claimed rewards and unresolved encounters. After combat, only
the exact landing receipt consumes the older transient battle return. Existing
source HP takes precedence over the legacy return value.

An isolated byte-identical copy of the played Sana preparation Chronicle supplied
the production replay while Fianna's physical river departure remained blocked.
That Chronicle followed an ordinary restoration of a pre-fight save after a real
Water Weird defeat; it is not persisted post-defeat recovery. The replay exposed
and then repaired active exploration reload losing cell 8,25. Ordinary Save,
full document reload and Continue Journey now resume floor one at 8,25 directly,
with visit count 6, 176 known squares, 9 HP, 20.77 gold and 11 inventory entries.
Walking left to entry 7,25 then allowed the normal world return. These checks
grant no encounter clear, objective, treasure or reward acceptance. Desktop and
390 by 844 phone renders were inspected; proof remains in ignored scratch.

## Nearby source lighting and paper readability

Actual keyboard exploration followed the remembered Alrio passage from entry
7,25 to junction42,30. A read-only source check found an authored torch on that
exact junction, but the fixed overview budget spent its lights in distant rooms.
Gameplay now selects the nearest existing flame fixtures within the same ten-light
budget. Fixture positions, colors, source props and the overview's purpose-based
lighting remain unchanged. Fifteen scene-model checks pass, including source
immutability and bounded selection; three changed paths type-check.

After ordinary Save/full reload/Continue, rendered frames at42,30 show nearby
warm pools and unchanged9/9HP. Further normal northern exploration reached30,23,
216 remembered cells and standing-water traces. Another full reload retained
that branch and rendered phone viewport390x844 with no horizontal overflow.
The parchment now has an opaque base beneath its paper texture, verified from
the actual phone capture after an earlier CSS shorthand defeated the first fix.
These captures establish local readability, not general performance or a complete
visibility, lighting-resource, hazard, object or reward system. Later source-object
and cache receipts below supersede the earlier unawarded-cache checkpoint.

## Source objects and cache settlement under verification

`dungeonObjectActions.ts` offers source props only on observed floor within one
accepted cardinal step. Examination saves a source-specific finding without
moving the object or granting a reward. The actual adjacent Alrio torch at30,23
was examined through the normal control. Both the settled manual record and
autosave contain its finding. Full document reload and Continue preserve the
observation, visit7,216 known cells,9HP,20.77 gold and11 inventory entries. The
nearby-object panel folds so reading an object does not permanently cover the scene.

`dungeonObjectResolution.ts` regenerates the source and atomically settles the
finding, claimed cache ID and existing item instances. Requests provide no item,
quantity, plan or position. Terminal, downed, foreign, distant, unseen and replayed
requests cannot grant loot. Loose source coins are supported, but this Alrio plan
contains none; no convenient coin was inserted to demonstrate collection.

Alrio has three intended treasure rooms and no chest props. `dungeonCaches.ts`
completes that existing intent with fixed source-owned caches. It reuses existing
chests, preserves buried locations, uses a separate frozen contents stream, and
leaves previously plundered rooms empty. Unresolved occupants and hazards block
collection. Existing geometry and identities remain unchanged; derived cache
meshes are an explicit addition. Their contents and transaction policy are
recorded in [ADR0010](../../adr/0010-source-dungeon-cache-rewards.md).

Five cache-model, three object-kernel, three atomic-settlement and17 scene-model
checks pass. Six source and three test paths type-check. Production expedition
controls hide the standalone preview's progress simulators. No source encounter
was cleared by this work.

Normal parchment-led exploration through16,5→15,5 reached6,5 beside the existing
treasure-room9 maintenance cache. The normal Examine control revealed a closed
cache without disclosing its contents. Open and secure cache then recovered
eight gold pieces and rendered an open lid. Settled manual and automatic saves
contain19 inventory entries instead of11: exactly eight existing gold_piece
instances attributed to object.v1:[root identity]:cache:9. Purse gold remains
20.77. The finding is collected and one source treasure claim names room9.
No encounter was cleared or objective completed to supply this outcome.
Full reload and ordinary Continue restore6,5 with493 known cells and9HP.
The expanded cache panel remains secured with eight pieces recovered and no
collection action. Its open lid was inspected again. The ordinary character
sheet displays28GP7SP7CP in its existing coin pouch, accounting for the20.77
purse plus eight physical coins. Backpack rows intentionally omit coins.
Normal return used93 accepted cardinal steps through remembered floor back to
7,25. The ordinary Return to World Entrance control closed the expedition and
restored Menaikon's world controls, the source sewer grate and the working Bram
Ironton at The Shadowed Sundries. The party still has9/9HP and558 known cells.
The settled returned-world save retains the frozen X467.0899419417503,
Z470.830058058204 and supported Y3.931618905760101 in cell4337, eight physical
coins,558 known cells, one claim, no clears and a retreated visit without active
footing. The settled town render was inspected. Full reload/Continue stays
outside at Menaikon with the real sewer grate; a normal Enter Dungeon revisits
at7,25 with9HP and558 known cells. Another91 accepted steps through remembered
floor reach the same cache-adjacent6,5. The inspected open lid and expanded
secured-eight panel offer no collection action. Both settled revisit saves retain
exactly eight coins with the original sourceId and acquisition timestamp,
19 inventory entries,20.77 liquid gold, one claim and no clears. The root identity,
frozen world return and collected finding remain unchanged;559 cells are now
known. This verifies this cache did not replenish after exterior reload and
real-mouth revisit. Town consequences remain pending. Thirteen focused overlay/parchment checks also pass
after the discovery change; their fixture-key warning is not a live-play failure.
The economy owner found that merchant affordability currently reads only the
liquid purse, although this pouch also displays physical coins. A native
checkout with recovered coins remains unverified; preserve the eight source
items rather than adding a second purse credit or selling coins at a discount.

The second ordinary return reached Menaikon with 9 HP, 561 known cells, the
original eight coins and a retreated visit. An exact, validated copy of that
settled manual record was supplied to the economy owner for isolated GF-G70
qualification; the playable browser was retained. The source note names The
Howling Shield and Senna Ironstead. Its public inspector identifies her as a
retired, absent shopkeeper and refuses talk or trade. Her authorship does not
grant a new meeting, current shift, quest completion or confirmation that the
observed growth is unnatural or two centuries old.

The public list distinguishes the same-named shops and inns. After finding the
inspected keepers away, normal Wait advanced 15 hours without confirming a rest.
Roban Westsmith then appeared at work in The Shadowed Goods and its normal
trade controls became available. Native checkout bought one torch for 1 CP:
stock fell from 22 to 21 and liquid gold from 20.77 to 20.76. Readback retains
9 HP, two ration and two water units, all eight earned coins and the same ground
position. The ordinary Use Torch button then produced no light record, fuel
status or visible use outcome; the torch remains carried. GF-G74 tracks this
open preparation defect. The next experiment will reuse existing LightSource
records and world-time fuel consumption with explicit ignition and single-item
consumption, then verify actual dungeon rendering and save/full-reload fuel.
Owning a torch or a pack is not evidence of a lit flame.

The bounded carried-light repair now has 18 passing fuel, source-interaction and
visibility cases. Ignition consumes exactly one owned torch into the existing
Underdark light record. The existing world-time consumer burns that fuel. The
record retains the original item and a game-time expiry, including dates before
1970. Extinguishing returns that same item with only its remaining fuel; replay
cannot return it twice, and relighting cannot reset its duration. A tinderbox or
an actual reachable fixed source flame is required. The canonical object resolver
rechecks saved footing and flame identity without removing the fixed torch or
recording a treasure claim. Explicit carried bright light uses the existing
occluded map discovery path. Production controls and the rendered carried flame
have passed bounded actual ignition, rendering, expiry and reload checks described
below. The action payload extension was coordinated with the combat owner.
The nine initial source files and seven integration source/test files passed
scoped type checking. The compatible action payload extension is present.

Actual replay reached the previously observed fixed torch at 15,29 by twelve
ordinary steps from the root. Examine and Light a carried torch ignited the
purchased item. The inspected render gained the carried light. Saved inventory
decreased from 20 entries to 19; the light retained acquiredAt 1793207439725,
bearer Sana, its 20 ft bright/20 ft dim profile and a declining duration.
Extinguish returned exactly that item with 58.35 minutes of fuel. Relighting from
the same fixed flame retained that fuel. Normal Save, full reload and Continue
restored the same light ID at 15,29 with 57.62 minutes remaining, not a fresh hour.
Desktop rendering and the separated flame position were inspected. The temporary
small-viewport panel experiment was removed after the desktop priority correction;
the original desktop movement controls were restored and inspected.

Twelve normal return steps reached 7,25, adding four genuinely visible map cells
under the carried light (561 to 565). Return used the original entrance. The
ordinary town Wait one hour action exhausted the fuel. The settled manual save
has no light, no returned spent torch, 19 inventory entries, the same eight earned
coins, 20.76 liquid gold, 9 HP, two ration and two water units, retreated visit
state and the exact supported world return XYZ. Subsequent full reload retained
that expired state and exact return position. No rest recovery or provisions were
taken by this wait.

The existing sheet weight helper now counts the burning source item exactly once.
The actual sheet showed 64.66 lb before and after the second purchased torch was
lit; the burning status, weight and coin pouch were inspected together. After
extinguishing, the saved item retained 59.47 minutes and its second purchase
identity. A fresh reload preserved that unlit item. Ordinary Light then displayed
the in-sheet explanation directing the player to a tinderbox or the fixed-flame
action, without spending the item. The two affected UI paths pass scoped types.
This bounded proof does not establish complete equipment, hand occupancy or
general carried-light behavior.

The user clarified that Aralia is a desktop game. Desktop gameplay and rendered
verification are the priority. The small-viewport layout experiment was outside
that priority; its compact-panel and enlarged movement-button changes were
removed. Keep the desktop fuel controls, explicit ignition, item-weight repair
and separated torch position. Do not treat mobile adaptation as an expedition
acceptance requirement.

## Current source-surface investigation

After the desktop correction, actual play followed remembered floor and visible
openings through the southern channel into a broad fungal chamber. The scene and
parchment were inspected on desktop; 749 cells are remembered at the current
63,59 footing, with 9 HP and no encounter clear or new reward. Native WASD accepts
the same cells as the movement buttons. Saved world return XYZ remains unchanged.
The second legitimately purchased torch has declined to about 35 minutes; its
spent first-torch history and eight earned source coins remain distinct.

A nonspoiler source audit returned Alrio with 31 rooms, one spawn, no traps and
74 open doors. This is diagnostic generation evidence, not a claim that every
room was visited. The generator deliberately stamps monsters from historical
occupations rather than every room labeled combat. Do not fill empty rooms,
resurrect occupants, weaken the existing apex or change geometry to force a
victory. Recruitment and deeper levels remain legitimate preparation options.

The actual fungal floor exposes no Examine interaction. Nearby object controls
currently cover props and caches, so the clue's visible growth can be walked
over but not investigated through the same interface. The bounded GF-G76
candidate reuses that interaction and finding ledger for reachable observed
source surfaces. A connected source patch keeps one stable identity; only its
known current or adjacent floor is offered. Save normalization accepts inspected
root and child surface keys and rejects surface collection. Sixteen focused
object, reducer and lifecycle cases pass; five affected source/test paths have
zero scoped type errors. The single two-file dependency-header pass found both
unchanged and left ten dependent headers untouched. Actual desktop Examine at
63,59 recorded `object.v1:wf-dungeon-wf:2144667198/burg:675/dungeon:sewer:surface:bloom:5824`
as examined. The inspected result leaves species, age, cause and handling safety
undetermined. Successful ordinary manual Save at timestamp 1793216371790 stored
that finding. Full reload and Continue restored it at 63,59; a normal west step
to 62,59 showed the same observation without a duplicate Examine action. Desktop
captures were inspected after the loading layer cleared. The eight original
coins retain their source ID, acquisition timestamp and quantities; inventory,
gold, HP, supplies, unlit fuel and world-return XYZ remain unchanged. The repair
grants no species, toxicity, age, supernatural explanation, loot, cleared threat
or quest success. The current graphics candidate makes Bloom resemble plain
stone at this patch; distinct physical depiction remains with the renderer owner.

The latest manual Save attempt at 63,59 failed on this private server's stale
module graph: `coinPurseUtils.ts` lacked the newly requested
`CURRENCY_COPPER_VALUES` export. The current source does export it. Read-only
settled autosave and checkpoint records retain the exact footing, 749 map cells,
9 HP, eight source coins, 20.75 liquid gold, two ration and two water units, exact
world-return XYZ and the unlit second torch with 30.17 minutes remaining. Do not
count that failed manual action as save proof. A subsequent fresh source graph
resolved it, and the successful manual Save and reload receipt above is separate.
The duplicate loopback/wildcard listeners were identified by process command and
creation time. Only this task's verified wildcard process was stopped. After no
listener remained, a single explicit loopback server was started from this
checkout. Served source-map content for the inspection and currency modules
matched the current source files. An exact pre-inspection autosave backup remains
in ignored scratch (817651 bytes, SHA256
`e9d5ad4ee1de234340e0cbc1565d8f2f3d90713b8eedc4141ed6d646154e035d`).

A separate source audit raised a name-boundary follow-up for GF-G38: full-seed
site rumor generation and the preserved legacy unsigned-root runtime can name
an old sewer differently. This is source-level evidence; an actual paired
receipt/interior replay is still needed. Preserve existing paid account words,
site identities and legacy plans rather than silently renaming either branch.

The schedule inspection control opened demo burg 9001; it
was closed without changing its clock or using its actors as gameplay evidence.
The simulation clock override remained unset.

## Desktop low-fuel retreat

The same Sana expedition continued normally to 85,56 with 834 remembered cells.
The second purchased torch had 9.3 minutes remaining in the native save. The
player extinguished it with the ordinary control and chose preparation over a
deeper unlit expedition. A 119-step return used only already remembered floor
and ordinary movement buttons, reaching the actual mouth at 7,25. Nearby fixed
light added three visible cells during the walk; the final parchment has 837.
The desktop entrance render was inspected. No unseen source route was used.

Return to World Entrance produced a browser click timeout after the click was
performed. A fresh snapshot showed Menaikon, its source sewer grate and normal
world controls, so the action was not repeated. Normal Save then produced manual
timestamp 1793219099071. Read-only native storage confirms the exact original
world-return XYZ, 9 HP, 20.75 liquid gold, all eight original source coin items,
two rations and two water units, one claimed cache and no cleared encounters.
The single second torch is back in inventory with 8.533333333333333 minutes,
not a fresh hour. Bloom5824 remains examined and the active visit is absent.
This is a legitimate retreat with unresolved threats, not a dungeon victory.

Full document reload reached the Main Menu after the initial body observation
timed out. Normal Continue reopened Menaikon and its source entrance; the settled
desktop world render was inspected. The post-hydration autosave1793219316590
matches manual1793219099071 exactly across eight present, non-null groups: world
seed, player cell, ground body, full party, full inventory, gold, active lights
and the complete Alrio expedition record. Its phase is retreated, activeVisit
is absent and the original second torch retains the same acquisition timestamp
and 8.533333333333333 minutes. This proves this retreat's bounded continuity,
not all town actors or the complete expedition story.


## Lawful resupply after retreat

Actual town-plan inspection after the retreat shows Roban Westsmith and Edith
Ashbourne as deceased. Roban's Talk and Browse controls are disabled and the
panel says no successor is recorded. This does not rewrite his earlier two
torch transactions or imply that the expedition caused either death.

The same native town plan identifies Fenna Hartham, 56, working at shop123,
The Shadowed Provisions. Its normal Browse goods action opens her named General
Store during 08:00–18:00 hours. Three ordinary torch purchases at the posted
2 CP each reduce stock26→25→24→23 and liquid gold20.75→20.69. Each accepted
stock change was observed before the next click. Inventory20→23 includes three
new acquiredAt values1793219498241,1793219523511,1793219524722. The original
partly spent torch retains8.533333333333333 minutes; eight earned coins,9HP and
2+2 provisions remain. Native manual Save1793219544717 records the purchases.
The desktop merchant render was inspected. This is the existing town-map
transaction path, not proof of physical approach, a meeting or recruitment.

Full document reload and normal Continue preserve the resupply. Post-hydration
autosave1793219695059 matches manual1793219544717 in nine present, non-null
groups: world seed, cell, ground body, full party, full inventory, gold, active
lights, complete Alrio expedition and worldBusinesses. The merchant stock,
three distinct new torch items, original partial torch and paid prices remain
in those equal records. The returned desktop world render was inspected.

## Played approach to the unresolved Water Weird

The prepared branch reentered the same mouth7,25 and walked twelve remembered
steps to15,29. The inventory Light control refused without a tinderbox and
directed the player to the fixed-flame action. That source action lit the
existing partly spent torch first, preserving8.53 minutes; the three fresh
Fenna torches remained unlit. No pack contents or ignition tool were granted.

The remembered route returned to85,56. The actual southern outlet continued
through84,57→84,68→89,68→89,78. The lower room was surveyed to94,73; no usable
stair or encounter prompt appeared there. The inspected parchment showed the
earlier eastern outlet, and a remembered return to84,65 followed that outlet
to90,65, where field notes added observed spore shelf. Normal east steps then
reached93,65 and the actual Water Weird prompt: Deadly for the current party.
The player examined the adjacent spore shelf; its observation says it remains
in place. Normal west to92,65 kept distance and removed Engage. No attack,
initiative, encounter clear, loot, age/cause inference or quest success occurred.

Manual1793220668555 records92,65/953mapped cells,9HP,20.69,22inventory entries,
eight original earned coins,2+2 provisions and all three fresh torch items.
The old partial torch genuinely expired during play and active lights are empty.
The desktop approach and parchment captures were inspected. A large pink
Objective cone/ring overlaps this area despite no earned objective; it is a
current rendering problem, not story guidance. Coordinate its repair with the
Preview owners, preserving the actual creature and source geometry. The source
creature remains unresolved; do not force this solo Bard into a deadly fight.

Full document reload and normal Continue restored the saved approach at 92,65.
Post-hydration autosave1793220875514 matches manual1793220668555 across nine
present, non-null groups: world seed, cell, ground body, full party, full
inventory, gold, active lights, full Alrio expedition and worldBusinesses.
The settled desktop render was inspected. One normal east step revisited 93,65:
the same Water Weird still offers the Deadly warning, and the spore shelf shows
its saved observation without another Examine action. A normal west step then
returned to 92,65. No attack, reward or source-identity change was introduced.

## Gameplay waypoint boundary

Actual approach renders showed an unearned Objective label and ring overlapping
Sana and the source Water Weird. Dungeon3DPreview now supplies an internal
showPreviewObjective flag to its scene. Actual gameplay filters only the
generated Objective waypoint; Design Preview keeps it. The real entrance,
source encounter cone, creature identity, geometry, rewards and encounter
handlers are preserved. No source plan or exported signature changed.

The one-file scoped typecheck reports zero errors and zero suppressed imports.
CRLF was preserved. Only this task's verified Vite process was restarted; the
new loopback server serves the exact edited source. Full reload and normal
Continue restored92,65. After the loading layer cleared, the desktop render
showed the Objective label/ring absent, Sana present and the source encounter
cone plus Water Weird warning and Engage control retained. The new source also
includes the combat owner's current-visible engagement; no initiative or attack
was triggered during this check. Do not attribute concurrent material changes
to the waypoint repair.

Post-hydration autosave1793221893415 matches manual1793220668555 across the same
nine present groups, including the full expedition, party, inventory and town
businesses. The Water Weird remains unresolved. Its generic cone representation
does not depict an aquatic creature; that is a separate observed visual gap.
Keep the marker repair's acceptance bounded rather than calling creature
graphics, combat, deeper stairs or the full story complete.

## Source creature bodies and visibility

GF-G82 has a bounded exploration-body improvement through the existing entity
assembler. visibleDungeonCreatures uses the authoritative spawn cell, stable
combat event ID, current visibility and cleared-encounter records. Remembered
parchment alone does not reveal a creature. Gameplay figures replace inspection
cones; Design Preview retains them. Lazy loading reuses the monster registry.
Missing source family or size does not invent an appearance. Approved library
plans have priority over the new procedural body, matching the existing library
selection rule. No library entry was created or promoted.

Water Weird has an explicit translucent, legless planned body. EntityModel's
optional local bodyTech setting selects the existing continuous swept-tube path
for this body. Other callers keep their defaults, including the existing Earth
Elemental. No plan, spawn, footprint, stat, initiative or reward changed. Five
focused cases pass. Six changed source/test/declaration paths have clean scoped
type checks. Dependency headers were refreshed only on owned source paths.

Actual desktop replay rejected a legged serpent and a rigid-seamed column
before the continuous version was inspected at the same source position. Its
label clears Sana's. Four ordinary west steps from 92,65 to 88,65 hide both
figure and encounter card; four east steps restore the same Water Weird. The
party stays at 9 HP, with 953 mapped cells, 20.69 liquid gold, 22 inventory
entries, eight original earned coins and three fresh torches. No initiative,
attack, clear or new reward occurred.

Normal Save produced manual1793226101010. The final source graph was checked
against the owned files, then full document reload and normal Continue restored
92,65. The settled 1280-by-800 render was inspected. Post-hydration
autosave1793227809418 matches that manual in nine present, non-null groups:
world seed, player cell, ground body, full party, full inventory, gold, lights,
full Alrio expedition and worldBusinesses. The creature remains unresolved.

One startup failed because a cached weaponUtils module lacked hasTavernBrawler
while the current source exported it. Source-map hashes proved the mismatch;
only the owned Vite server was refreshed. Native data remained exact throughout.
A later screenshot timed out; bringing the same desktop page forward recovered
capture without changing game state. These technical failures are separate from
combat outcomes. Do not infer a compositor or performance fix.

The shared creatureAppearance policy now supplies the same explicit aquatic
plan to dungeonCreatureRecipe and recipeFromCombatant. CharacterBody and the
dungeon figure reuse the same local water materials and continuous body path.
Approved library plans keep priority; humanoids, other Elementals, source stats,
footprints, initiative and rewards retain their existing owners. Eighteen focused
cases pass, including equal exploration/combat recipes and blueprints, unchanged
source objects and the humanoid/Earth boundaries. Eight scoped TypeScript paths
report zero errors and zero suppressed diagnostics. Seven owned dependency
headers were refreshed; three dependents were deliberately not written.

After normal Save, full document reload initially exceeded the navigation
observer's 30-second wait. The same page subsequently reached Main Menu;
ordinary Continue loaded the retained expedition. No second navigation,
restoration or replacement save was used. The settled desktop 1280-by-800
render again shows the source Water Weird and Sana at92,65,953 mapped cells,
9HP,20.69 liquid,22 inventory entries,eight original coins and three fresh
torches. Manual1793229273866 and autosave1793229489027 match in all nine
present, non-null groups listed above. The figure remains basic; the large
movement/encounter overlay still obscures the desktop scene and needs repair.

This is shared source behavior, not an actual combat-render acceptance. No fight
was forced to inspect a model. Water-surface detail, animation, performance,
wider monster families and the full expedition story remain open. Preserve
approved-library priority, source identity and meaningful choices.

## Desktop expedition layout

The user clarified that Aralia is a desktop game. Actual inspection showed the
330-pixel floating movement/encounter card covering the playable scene. The
gameplay frame now gives its canvas and a 288-pixel navigation/encounter rail
separate desktop columns. The duplicate scene title is removed only from
gameplay; Design Preview and all existing game handlers remain unchanged.
The current source includes the other owner's entrance grate and marker work.

After full document reload and ordinary Continue, the settled 1280-by-800
render shows a 958-by-552 canvas beside a 288-by-552 rail, with no overlap.
Normal west to91,65 and east to92,65 movement still works; the same unresolved
Water Weird and Deadly warning remain. Manual1793229627357 and post-reload
autosave1793229779499 retain nine present groups exactly. HP9,20.69 liquid,
22 inventory entries,eight original earned coins,three fresh torches and953
mapped cells remain. One-file scoped types report zero errors and zero
suppressed diagnostics; the shared appearance wave's18cases/eight paths are
separate checks. No new fight, reward, clearance, geometry or performance
acceptance is claimed. Aquatic polish, legitimate party preparation and the
complete clue-to-expedition-to-return story remain open.

## Second maintenance cache and earned return

Sana's actual parchment at92,65 showed remembered stairs at94,65, the source
Water Weird's position. No passage through the creature or forced fight was
used. The remembered room25 treasure symbol at15,36 lay beyond current floor
ink. A route used only the parchment's rendered explored-cell markup:122
ordinary accepted steps to18,35, then west17,35,west16,35,south16,36. The final
approach revealed real floor, growing953 mapped cells to978; the symbol was
not an unreachable cache. A fixed torch was examined without consuming a
carried torch. Beside the visible cache, ordinary Examine reported concealed
contents. Normal Open and secure recovered eight gold pieces.

Pre-claim manual1793230583100 has22 inventory entries and eight old coins.
Post-claim manual1793230627491 has30 entries and16 coins. The old eight retain
source cache9 and acquiredAt1793202008360. The new eight have source
object.v1:wf-dungeon-wf:2144667198/burg:675/dungeon:sewer:cache:25 and
acquiredAt1793230596729. There are exactly two claimed room IDs,9 and25,
both findings collected, and no cleared encounters. Liquid gold stays20.69;
HP9,three fresh torches and two rations/two water stay unchanged. No duplicate
purse credit was added.

Full document reload and ordinary Continue retain16,36 and nine present,
non-null groups exactly: manual1793230627491 to auto1793230693538. Ordinary
north16,35/south16,36 revisit shows Secured, eight recovered, with zero Open
and secure actions. The settled desktop screenshot was inspected. This is
actual reward/revisit evidence, with no new source implementation or test claim.

A further24 normal steps through remembered floor reached the real7,25 mouth.
Return to World entered Menaikon at the frozen world return. Normal Save,
full document reload and Continue retain the exterior entrance and retreated
expedition, activeVisit absent. Manual1793230892878 and auto1793230981985
match all nine present groups exactly, including the full expedition, both
coin sources and worldBusinesses. Rendered town arrival was inspected. The
Water Weird remains unresolved; no victory, deeper floor, invented age/cause,
town meeting, recruitment or completed story is inferred from this return.

Town Plan's ordinary Find inns and taverns and building selector were then
used to inspect The Shadowed Salve, plot30. The displayed source identifies
Bram Whitebourne,19,taverner,working,with two children and household lodgers.
No Talk, hire, invitation, relocation or meeting was performed from that map.
The existing recruitment gate requires an established companion opportunity
for projected household residents. This bounded inspection does not prove
that all town recruitment opportunities are absent. Next preparation must use
a willing, source-backed opportunity while preserving work and family agency.

## Owned equipment preparation

Actual Party Roster still shows Sana alone. Dossiers has no spoken contacts.
The retained authored companion shells have neither meetings, public activity
nor whereabouts in this older Chronicle. New-world independent activities do
not initialize on Load. Their owner is developing an explicit inquiry command;
no person was placed, moved or recruited for this expedition. Reading the three
existing owned rumor receipts preserved their Ysolde/Senna sources: boarded
home42, reoccupied home22, and the original undercity-growth account. No new
source knowledge or proof of that account's age/cause was invented.

Preparing an owned dagger exposed a real inventory failure. Equip moved the
whole quantity2 starter stack into OffHand, and its item-ID-only payload could
select a different purchase. The existing EQUIP_ITEM reducer now moves one
unit, retains the spare with its original metadata, and accepts the clicked
source index/reference from InventoryList. A stale source refuses rather than
switching to another same-ID entry. Optional fields preserve legacy callers;
slot resolution, two-handed restrictions and derived-stat updates remain.
No saved gear is automatically rewritten. Ordinary Unequip returned the pair
and rapier to the pack before the repaired path was replayed.

Ten new regressions began with9 failures/1 pass. The fixed wave passes55
affected cases, including38 existing reducer and7 existing inventory cases;
the final10-case rerun overlaps these counts. Five scoped TypeScript paths
report zero errors and zero suppressed diagnostics after required descriptions
were added to the new fixtures. One scoped dependency pass found three source
headers unchanged and two tests outside the graph;14 dependents were not
written. Both actual served source maps match the owned files. Existing LF
source and CRLF action types are retained; scoped diff checks pass.

Actual replay after full reload selects the starter pair, puts one dagger in
MainHand and leaves its spare in the pack. Selecting the separate bought dagger
puts that exact acquiredAt1793146632354 unit into OffHand. The rapier stays in
the pack. Native manual1793232800103 has30 inventory entries, two equipped
daggers quantity1 each, one starter spare and the old rapier. Total weapon
units by provenance remain two starter daggers, one bought dagger and one
rapier. All16 earned cache coins, both claims,20.69 liquid,HP9,three torches
and supplies2/2 remain. No restoration, item injection or new purchase occurred.
The actual1280-by-800 sheet and roster were inspected: proficient dagger
melee/thrown attacks show+4; spell attack remains+1. The offhand sheet's
1d4+2 damage preview is not a resolved offhand attack and remains inGF-G81.

Normal Save, full document reload and Continue retain nine present groups
exactly: manual1793232800103 to auto1793232900526, including complete party,
inventory, expedition and worldBusinesses. The expedition remains retreated,
no active visit. This preparation does not make the solo Deadly encounter
safe, qualify combat damage or complete the full story. One cold reload
observation exceeded30seconds; the same page later settled without a second
navigation or save replacement.

The post-reload1280-by-800 character sheet was also inspected: both equipped
daggers render, with one spare and the retained rapier available in the pack.
An ordinary offhand Unequip and re-equip after reload restores the same
purchased dagger. Autosave1793233037689 still matches manual1793232800103
in all nine present groups. The native provenance totals remain two starter
daggers, one bought dagger and one rapier, with16 earned coins and both cache
claims unchanged. No encounter or companion action was taken during this
preparation replay. The companion owner confirmed that any old unplaced person
must wait for the supported explicit inquiry command; the new-world planner is
not learned player knowledge or authority to create a local meeting.

## Town footing during expedition preparation

Sana owns three unlit torches, but her retained Entertainer's Pack explicitly
contains no tinderbox. Seeking the known provisioner for ignition supplies
first exposed a technical map failure: the cached householdNpc module lacked
householdFamilyAt, while current source exported it. Source-map SHA comparison
proved servedb478678af37c5664e9a16c4a7d3e5aae162c9297ccf349e1e6304e082c07320f
versus currentacd47a9afe8ccb91d74ede7435074324189b8ad7d11156a92340556b072b8aa3.
Normal Escape closed the failed map; normal Save preserved current progress.
Only the owned verification server was refreshed. The new served source was
exact, and normal Load/Continue/Town Plan recovered the actual building picker.
Manual1793233678831 to auto1793233867609 preserves nine present groups exactly.
This is module-cache recovery, not a product-code or gameplay-failure repair.

The actual town plan then showed every plot but no party position. The new
townMapPosition adapter reuses acceptedGroundPoint and reverses the canonical
town bake's center/span affine. It binds world, cell and saved ground window,
requires the current town envelope, and never picks a nearby building or
snaps/moves the party. GameModals supplies current ground state to MapPane;
TownPlanView draws a readable, noninteractive dot in its own pan/zoom frame.
Standalone previews remain unmarked. No source plan, route, door, NPC,
discovery, reward or saved schema changes. Existing town source had1255CRLF
and16LF endings; its text was retained while writes normalized dominantCRLF.

Twenty-eight affected cases pass, including ten new projection/render cases
and18 existing town-view cases. Eight scoped paths report zero errors and zero
suppressed diagnostics. One owned advisory wave updated three source headers,
left one current, skipped declaration/test files outside the graph, and left
three dependents unwritten. Scoped diff checks pass.

Actual1280-by-800 Town Plan rendering shows one readable You dot at canonical
0.11875094191060588,-0.1187509417418625, representing the same frozen source
feet467.0899419417503/470.830058058204. Manual1793234724512 and post-refresh
auto1793234997153 retain nine present groups exactly. The actual public shop123
highlight is northwest of that dot. No physical shop approach, purchase,
meeting, relight, recruitment or dungeon outcome is inferred from viewing it.
Continue ordinary street movement and use the map to verify accepted progress;
keep willing help, the unresolved Water Weird/stairs and full story open.

## Selected building identity during physical preparation

The current desktop baseline is1920-by-1080 following the owner's correction;
earlier1280-by-800 captures are historical evidence, not the target layout.
Actual street walking with the new party marker exposed a separate navigation
fault. Selecting provisioner123 outlined the first engine polygon within50
units, which was house34. Sana legitimately walked to that wrong frontage and
opened its ground-floor door. Native manual1793236484073 records plot34 door
0:2:x:0.7620:-3.0480 open and feet434.57250870896974/453.14215021228443/
4.0567534453400205. No house entry, resident meeting or purchase is inferred.
The saved opening is retained; no timeline restoration concealed the mistake.

TownPlanView now traces the selected artifact's own footprint directly. It
does not guess a neighboring engine polygon or replace a missing source.
Source plans, physical buildings, doors, NPCs and the party marker are unchanged.
One focused selection case failed before the repair;22 affected cases pass
afterward, including existing town rendering and party-marker checks. Both
changed TypeScript paths report zero errors and zero suppressed diagnostics.
No exported signature or import changed; advisory-header sync was not needed.

Only the verified owned source server was refreshed. One full-reload observation
timed out; the same page later settled without repeated navigation or restart.
Normal Continue preserved all nine present groups exactly, manual1793236484073
to auto1793237025802. This includes actual walked feet, full party/inventory,
gold, lights, source expedition and businesses. Expedition remains retreated,
no active visit or clears;978 ink,16 earned coins/two claims and20.69 remain.
The new1920 desktop render shows shop123 at polygon
M-105.4,-69.0L-109.6,-44.4L-134.3,-48.6L-130.0,-73.3Z instead of the erroneous
house34 outline M-65.0,-49.2L-87.1,-37.4L-94.1,-50.7L-72.1,-62.4Z.

Ordinary walking around house34 then reached the actual signed provisioner
frontage. Its door opened through the normal approach gate. Both owned daggers
were normally put away before a further doorway step; this is preparation,
not a weapon-clearance causal proof. The marker then reached-112.78487576683388/
-51.21334376633318 and the rendered scene exposed Fenna's label. Physical
meeting, inventory conservation after stowing, goods inspection and a final
native reload were still unverified at that checkpoint; the receipts below
record the later played outcomes. No tool stock or companion placement was
fabricated; ignition and the complete expedition story remain open.

### Physical provisioner contact and retained preparation

Normal Meet Fenna Hartham admitted the actual shop123 contact, memberb34:head/
occupant84. Talk opened the existing dialogue and Show me your wares handed
off to the real open08:00–18:00 general store. The desktop merchant rendering
was inspected: ten real goods, torch stock23, no tinderbox. No transaction or
stock injection followed; Sana already owns three fresh torches. The next
supported ignition path is the retained dungeon's fixed flame.

Sana also chose Discuss this account for her legitimately bought Senna undercity
rumor. The local POST/api/ollama/generate failed net::ERR_ABORTED after Thinking.
The UI explicitly retained the choice/effects and offered Retry reply. No retry,
new speech, corroboration, cause, age or confirmed route is claimed. Meet's
profile56/historical household versus Talk51 is independently reproduced and
reported to its existing owner; this run does not repair that identity display.

Normal stowing conserves two starter dagger units, one purchased dagger with
acquiredAt1793146632354 and the original rapier. The pack now has32 entries
instead of30; both hand slots are empty. All16 physical cache coins,20.69 liquid,
9HP, three torches, no lights and both source claims remain. Normal Save and a
full document reload/Continue retain13 present groups exactly, manual1793238415494
to auto1793238696988: the original nine plus townSim, npcMemory, generatedNpcs
and companions. Actual feet419.60714925294735/449.3416964409838/
3.637571530320363 and the opened plot34 and123 leaves survive. No earlier save
or fabricated progress replaced them. The1920 reloaded interior render shows
Sana and Fenna but is markedly dark; interior visibility remains a product gap.
An occasionally visible Mara label proves no source activity, meeting or
recruitment; companion placement is unchanged across the native comparison.

### Earned return and fixed-flame ignition

Sana left shop123 through its actual open leaf by normally aligning with the
passage center, then walked the public streets back until the original sewer
entrance offered Enter Dungeon. No map teleport, source movement or borrowed
arrival was used. Normal inventory actions re-equipped one starter dagger in
Main Hand and the distinct purchased dagger in Off Hand, retaining the spare
starter dagger and original rapier. Native source-unit counts are conserved.

The same Alrio root was re-entered through the normal entrance. Twelve ordinary
remembered steps7,25→11,25→11,29→15,29 reached the previously examined fixed
torch. Opening Nearby objects exposed Light a carried torch. That action
consumed one actual Fenna item acquiredAt1793219498241 into light
7bbddb64-012d-4ab5-b33a-db9c52a4917e, bearer Sana. Two other fresh receipts
1793219523511/1793219524722 remain in inventory. Pack entries30→29. The fixed
torch remains; no new payment, cache claim or encounter clear occurred. The carried
flame and20ft bright/20ft dim presentation were inspected at1920-by-1080.

Normal Save/full document reload/Continue preserves twelve present groups
exactly, manual1793239872090→auto1793240138451. Active light metadata, source
item, bearer and expiry are also exact;59.400000000000034→57.78333333333346
fuel minutes equals97 seconds of actual game time, with9.24e-14 floating-point
error. It did not reset to60. Accepted footing remains15,29/floor0,978 ink,
two cache claims/16 physical coins,9HP,20.69 liquid and supplies2/2. The new
visit freezes the actual returned street feet458.9740689919303/468.3571348012636/
3.932385333703239, rather than fabricating the old departure point.

Final normal Save/Main Menu parks this same active expedition without a physical
retreat. Manual1793240311284 and auto1793240313595 retain the same twelve groups
and exact light metadata;54.916666666666956→54.883333333333624 minutes matches
the final two seconds exactly. Main Menu and Continue Journey are visibly
verified. No victory, deeper stair/hazard/secret play, new willing companion,
post-defeat recovery or complete clue-to-return story is accepted by this proof.

### North-branch investigation and a conserved retreat

Normal Continue resumed15,29 with the same finite light. Sana chose the nearby
unwalked north stub from her actual parchment, not a hidden source route.
Ordinary steps reached16,22, then25,22/25,24,13,24 and13,22. Two newly reached
fixed torches were normally examined and left in place. The parchment grew
978→1021:39 room squares plus four visible north-continuation cells23,18–21.
Both eastern and western corners were checked, but the room is not a complete
dead end. The rendered map reveals that unwalked north continuation at23,22.
An earlier broad dead-end description was corrected after inspecting the map;
no source geometry or opening was added to make the correction true.

Normal Save/full document reload/Continue preserves twelve present groups and
exact light metadata, manual1793241586265→auto1793241762636, accepted13,22.
Fuel42.81666666666764→41.16666666666774 matches99 game seconds within9.24e-14
minutes.1021 ink and both new object findings persist. No new reward, clear,
history corroboration, secret, hazard resolution or lower-floor claim follows.

Sana extinguished the carried torch beside a fixed flame to conserve its fuel,
then retraced23 normal cells to the actual7,25 mouth and returned to Menaikon.
Native manual1793242221646→auto1793242333933 retains13 present groups exactly.
The full returned inventory contains the same Fenna receipt1793219498241 at
36.95 minutes, two fresh torches, all16 earned coins,30 pack entries,20.69
liquid,9HP and supplies2/2. Both owned dagger units remain equipped; spare
starter dagger and rapier remain packed. No light remains active. Expedition
is retreated/no activeVisit,1021 ink/two claims/no clears, and the actual frozen
return458.9740689919303/468.3571348012636/Y3.932385333703239 is exact. The1920
parchment and town return were inspected. A15-second Town Plan readiness wait
timed out; the same loaded page later settled, with no repeat load or restart.

The source torch can currently coexist with two equipped daggers. Hand-use
semantics are unqualified and reported to the existing ignition owner; no
actual attack or two-weapon claim was made with that configuration. Extinguish
leaves the current two-dagger loadout without a third held object. The next
legitimate route is the observed north continuation, with a deliberate partial-
torch choice and hand preparation before entering darkness.

Identity diagnosis also separates an incidental Mara Thornbourne label from
the authored companions. Saved Mara is npc_burg_675_plot_122, householdb131:head,
a local taverner; no meeting or recruitment was inferred. The retained authored
companions are kaelen_thorne and elara_vance, both without publicActivity or
whereabouts. No initialization, placement or learned destination was injected.
Their owner retains the willing-help/inquiry path. Full story, earned victory,
deeper stairs/hazards and persisted failure aftermath remain open.

### Partial light, observed north continuation and readable rubble

After the conserved town retreat, Sana normally stowed the bought offhand
dagger, retained her main-hand starter dagger and re-entered the same source
mouth. At the remembered fixed flame, the existing source-choice UI displayed
two fresh torches and the original approximately37-minute torch. She deliberately
chose that partial receipt1793219498241; the two fresh receipts stayed packed.
This independently verifies the ignition owner's picker in actual1920×1080
play. Hand-use mechanics with two weapons and a torch remain unqualified.

Ordinary movement followed the parchment's north continuation via23,22 to23,15,
then the visible chamber to20,13. Explored ink grew1021→1046. The nearby source
rubble was normally examined. Its old tiny cube and generic examination text
were actual observed friction, not a substituted scene or generated objective.
The existing rubble composition now uses broken blocks and angular fragments;
the existing observation states only that loose broken stone lies on the floor.
Source age, cause and hidden history are not disclosed or invented. Source
anchors, scale, rotation, plan geometry, collision, encounter and reward owners
remain unchanged. The change reuses the existing instanced primitive batches.

The four affected suites pass38 distinct cases and four scoped files have zero
type errors or suppressed diagnostics. Exact served-source checks match both
changed source files. Actual1920×1080 renders show the pile and observation
before and after full reload. Sana normally stepped20,13→20,12→20,13, then
saved and fully reloaded through Continue. Native manual1793244897257 to
auto1793244956072 preserves all12 present state groups and exact light metadata.
Fuel26.183333333333948→25.816666666667302 matches22 game seconds within
2.14e-14 minutes; light2a57dda9-02ae-48df-860c-8fb66e41f90b retains its original
source receipt and bearer. The same1046 ink, examined rubble, two cache claims,
16 coins,30 pack entries,9HP,20.69 liquid and supplies2/2 remain. No rubble loot,
new clear, history corroboration or monster victory was awarded.

That checkpoint retained the active expedition at20,13 on source floor0. Main Menu parking after
normal Save is not a physical retreat. Next play should choose from the earned
parchment while conserving finite light and continue the willing-help path
through existing NPC systems. Unresolved Water Weird/stairs94,65, deeper
hazards, meaningful local consequences and persisted failure aftermath still
prevent acceptance of the complete expedition story. Desktop is the design
target; historical narrow screenshots do not establish layout acceptance.

### Eastern investigation, conserved relighting and an examined pool

Sana followed her inked parchment from20,13 via20,10/37,10/37,28 to46,28,
then the newly observed eastern opening to48,28. Each step used normal movement;
the route came from player-visible cells, not a hidden source plan. Reaching
the lit room exposed a northern continuation. Sana examined its fixed torch
and extinguished her carried light, conserving its original receipt at
18.916666666666668 minutes while checking the room's north edge. She returned
five remembered cells to48,24, examined a second fixed flame and deliberately
relit that same partial torch. Both fresh receipts remained packed.

The observed northern corridor led via53,24/53,20 into another room. Sana
checked its western edge, examined two more fixed torches, and approached a
visible floor feature through56,15/58,18/59,15. It is a real source pool,
normally examined at59,15. Its standing-water observation leaves drinking
safety unknown. Exploration grew1046→1172 ink; no history age or cause was
corroborated, and no cache, reward, encounter clear or forced fight occurred.

Actual desktop inspection found that the pool looked like a solid green plate.
Only the existing pool primitive composition changed: a low stone rim, inset
water and discontinuous surface highlights share the original0.72 local
footprint and existing instanced batches. Source transforms, plan geometry,
depth, collision, interactions and rewards stay unchanged.31 affected scene
cases pass, including five new pool cases; two scoped files have zero type
errors or suppressed diagnostics. Exact served-source and outside-patch guards
pass. The1920×1080 render was inspected after moving normally aside; the rim
and highlights are visible under the existing torchlight. This is a bounded
readability repair, not a fluid simulation or whole-dungeon atmosphere claim.

Native manual1793246162253→auto1793246916601 after full document reload and a
normal59,15→58,15→59,15 revisit preserves all12 present groups exactly, including
the pool finding, source expedition, inventory, party and NPC state. Relit
light2cbaa0bd-0b4c-4856-8be7-99d73e3d2ecd retains its original source/bearer and
expiry. Fuel14.58333333333343→12.666666666666668 matches115 game seconds within
9.60e-14 minutes.1172 ink,16 earned coins/two claims,30 pack entries,9HP and
20.69 liquid remain. Main-hand starter dagger/free offhand and two fresh torches
remain conserved. Normal Save/Main Menu parks the ACTIVE59,15 expedition;
parking remains distinct from physical retreat or persisted failure recovery.

This play also exposed an unresolved coherence gap: large water-basin room
landmarks are presentation-only purpose silhouettes, separate from reachable
source pool props. The walked37,10–15 approach offered no fixture interaction;
the renderer's purposeLandmarkParts confirms that ownership distinction. Do
not treat these landmarks as examined pools, safe water or completed objectives.
Reconcile their physical meaning through existing source systems without
inventing history, geometry or rewards. The earned parchment, finite light,
unresolved Water Weird/stairs94,65 and legitimate NPC-help path still govern
next play. Victory, deeper hazards and persistent failure aftermath remain open.

### Learned north loop and return to a changed source context

Sana followed the visible north stub59,15→59,7, normally examined its fixed
torch and extinguished the carried source light. She walked west through54,7
and48,7 to44,7, reconnecting with the earlier basin chamber. Two more fixed
torches were examined. The source geometry formed a real loop; it was neither
added nor inferred from a hidden plan. Ink grew1172→1213. The field notes still
separate Senna's purchased hearsay from found traces; they do not confirm the
account's two-century age or cause.

A69-step return route was checked against all1213 public inked cells before
normal walking. It uses the learned loop and known room crossings, not a pose
setter or an assertion that every crossing exactly retraced earlier footsteps.
Sana reached7,25 and normally returned to Menaikon. Native manual1793248185844
to auto1793248306028 after full document reload preserves13 present groups
exactly, including expedition, party, inventory, lights, physical body and NPC
state. The desktop town return was inspected. Current expedition is retreated,
no active visit,1213 ink/two claims9+25/no clears,16 earned coins,31 pack entries,
9HP and20.69 liquid. No light remains active. The original Fenna torch is packed
at9.133333333333159 minutes; both fresh receipts remain. Main-hand starter
dagger and free offhand are preserved, as are the two opened town leaves and
the actual frozen return458.9740689919303/468.3571348012636/Y3.932385333703239.

Normal public Town Plan inspection selected the original Howling Shield,
artifact35. Its current household record lists Senna Ironstead,86, retired
shopkeeper, deceased, and no successor. Talk and Browse are actually disabled;
the1920×1080 result was inspected without attempting remote contact. The paid
account remains owned. This establishes current unavailability, not when or
why Senna died, whether she was alive at the original purchase, or a consequence
caused by the expedition. That source chronology remains a coherence question.
No resurrection, succession or replacement source was invented.

Read-only native diagnosis confirms retained Kaelen and Elara have no current
whereabouts/publicActivity and the local dynamic encounter list is empty.
Existing recruitment deliberately refuses ordinary household residents without
a developed companion opportunity. The companion owner was asked for a concrete
old-save inquiry/encounter path; no new placement or invented travel consent was
used. Next play should find a living source through existing systems while
preserving those limits. Willing help, source chronology, decorative basin
interactions, deeper hazards, victory and persistent failure aftermath remain
open. This milestone changes gameplay and records only; no runtime code changed.

### Living keeper approach and reproduced porch refusal

Current desktop checkpoint: source exploration now parks Sana at Alrio floor1
cell91,44,1493 remembered squares and32 object findings. The actual eastward
route crossed the basin room, examined rubble and separate fungal patches,
reached the eastern wall89,35, then followed the open south branch to89,44 and
east to91,44. No hidden-plan route, encounter, new reward or supplied water was
used. Normal Save/Main Menu1793277748470 atday5 10:19:11 retains9HP,20.69 liquid,
16 physical coins/two claimed caches,1/1 provisions,30 packed entries and the
same active torch with14.150000000002409min. Seven native payloads are archived
in ignored scratch. The1493-ink terminal checkpoint is saved, not yet reloaded.

The prior1277-ink basin checkpoint is now independently full-reloaded:
1793274466927 to1793275223164 preserves18 PRESENT state groups exactly; the
same torch/expiry burns36.48333333333467 to35.75000000000138 over44 world
seconds. Source-corridor manual1793275759319, a coherent owned preview restart,
one full document reload and normal Continue to1793277034024 likewise preserve
18 present groups exactly at74,35/1417ink. Torch26.83333333333522 to
26.000000000001933 matches50 elapsed world seconds. No save import or rollback.

Actual play and source inspection exposed a missing seam: the generator emits
traps separately from furniture, but the3D scene and nearby-object boundary
did not consume those records. The checked candidate appends real source traps
only at the scene adapter, preserves all existing prop/cache indices and source
geography, and filters gameplay presentation by observed cells. Reached hazard
fixtures can be examined under stable source-trap IDs; root/child findings
survive normalization, and cannot become collection claims. Examination does
not disarm, trigger, bypass or clear a trap.45 distinct affected checks across
six suites and seven scoped type paths pass. One header wave reports four
current source headers/four tests skipped, with12 dependents unwritten.
Seven prior-file byte baselines are exact outside owned patches; a redundant
validation branch from partial patch application was removed and the six
lifecycle checks rerun successfully. No unrelated work was reverted.

The refreshed actual dungeon rendered on the desktop and normal navigation
continued. No source trap has yet been reached or examined in native play;
trap appearance/interaction acceptance and actual trigger/disarm/failure
mechanics remain open. The tested candidate is not a played hazard victory.
Growth still reads as dark flat surface panels in these renders; its species,
age, cause and safety remain unknown. The paid account's age stays hearsay.

The same derived snapshot is now exposed through Planmap's Project progress:
/Aralia/planmap/index.html?view=project-progress&focus=dungeon-expedition-focus.
Actual2560x1305 desktop inspection verifies the full-width frame, current
dungeon focus, no overflow, canonical links and Back. Those source URLs serve
the exact existing Markdown files. The loaded dungeon section matches the same
backing document; unrelated panels changed during whole-file hash reads, so
whole-file final equality is not claimed. All seven native save rows remain
unchanged, with zero page errors and zero non-GET requests. The existing dungeon
Planmap notes are current; three broken legacy source links now point to this
owning domain. Statuses and every non-owned roadmap byte remain unchanged.
AGENTS and the saved map URL now use the central entry. Integration is complete;
the ignored document is backing cache and canonical records retain authority.
Continue actual source investigation with finite light and the known return
route. Meaningful hazards/secrets/stairs, source-grounded history, appropriate
victories and persistent failure aftermath remain required; full loop open.

Earlier basin checkpoint: Sana was saved in the original Alrio Channels at
floor1 cell54,35, beside an examined basin, with1277 remembered squares. Normal
movement followed the earned parchment from17,29 to49,37, where north proved
closed and east open. Continuing east and then north revealed the basin. Bones
and fixed torches were examined en route. The bones response is still generic;
it does not identify an inhabitant, age or cause. The basin records standing
water with unknown drinking safety. No water, victory or new reward was granted.

The desktop navigation panel now reserves360px instead of288px and uses14px
interaction text with ordinary shared buttons. The world keeps its own column;
source geometry, object findings, movement callbacks and encounter guards are
unchanged. Actual2560x1305/DPR1.5 inspection shows a2166.67px dungeon canvas,
no panel overlap and no horizontal rail overflow. Four existing camera checks
and the changed-file scoped typecheck pass with zero diagnostics.

Normal Save/Main Menu at1793273793755, a coherent owner-preview restart, one
full document reload and normal Continue restore54,35/1272ink. Eighteen PRESENT
state groups are exact, including party, inventory, expedition, town, NPC
memory, logs and prior rewards. The same acquired torch1793219523511 retains
all identity fields and its expiry; fuel changes42.46666666666766 to
38.98333333333453 over209 in-world seconds, exactly matching elapsed time.
This is clock-qualified light continuity, not nineteen unchanged groups.

After the reload, actual ArrowRight reaches55,35 and inks five more squares.
The ordinary Move west button returns54,35 with the basin finding retained.
The rendered results were inspected. Normal Save/Main Menu1793274466927 at
day5 09:56:51 preserves1277ink and36.48333333333467min of the same burning
torch. Seven native payloads are archived in ignored scratch. This final
post-replay checkpoint is saved; its additional five squares have not yet had
a second reload. Inventory has30 packed entries because the active torch is
held by the light ledger. The two source caches9/25 and16 earned source coins,
20.69 liquid gold,9HP,1 ration/1 water, return context, unresolved Water Weird
and stairs94,65 remain. No encounter is cleared.

Continue investigation from this actual basin, preserving finite fuel and the
known return route. Improve source-grounded observations and meaningful object
or hazard choices; do not fabricate history, safe water, NPC help or rewards.
Victories, deeper hazards/secrets/stairs and persistent failure aftermath are
still required. The complete clue-to-expedition-to-return loop remains open.

Earlier entry milestone: Sana had normally re-entered the original Alrio
Channels at floor1 cell7,25 after the keeper encounter. Ordinary street walking
reached468.56632298736395/470.794030803515/Y4.065515117089452; normal Enter Dungeon
froze that actual return point. The source identity,1213 mapped cells, two cache
claims,16 physical coins,31 inventory entries,9HP,20.69 liquid and1/1 provisions
remain. No light is active and no encounter is cleared. The actual revisited
room and earned parchment were inspected; concealed branches remain unknown.

The desktop self-occlusion repair was replayed independently in Sana's actual
tavern121. Her existing spellbook was reviewed without selections, casting or
resource changes. The original Bram position was readable, so ordinary walking
continued toward the doorway until the real camera retracted to0.8604m and the
opaque avatar filled the view. This reached point was saved at
478.38138510095285/475.47244985623996/Y4.331548055857618. Normal Save/Main Menu,
coherent owner-preview refresh, one full document reload and normal Continue
retain all19 present groups exactly:1793269979382→1793270288627.

The town-owned controller now fades only the lead figure's cloned materials
near the camera. Actual Sana replay retains33 visible meshes and identical
mesh names/vertex counts. The32 body/gear meshes use opacity0.08; the shadow
stays opaque. All nine entity-ink clones have uA0.08. The floor and opened door
are visible through the silhouette.
Bram's materials remain opaque. The559-part source building packet is identical
before, after and following exit: SHA256b63ba2913736491d97cce4d3a5cd8893bc50039f29da51f6f06a39b09b9f5fba.
The body and camera heading match; ordinary framing gives different elevation
before/after, so this is not a pixel-identical comparison. The served ink-aware
helper matches the current functional body; only its advisory header differs.
The owner's33 focused cases/three scoped types support this played result.

Normal walking through the opened doorway and down the real stairs restores
all33 materials to opacity1. Those renders were inspected. Sana then normally
clicked the actual door leaf to close it and walked onto public ground. Door121
is now closed, while34/123 remain open. Street manual1793271312905 at09:11:37,
one full document reload and normal Continue to1793271476519 at09:12:29 preserve
all19 present groups exactly, including the closed door, original keeper memory,
inventory, party, expedition, logs and rest state. Body
477.78725390855675/470.59421740697246/Y3.601252663291512 remains exact. The reloaded
desktop street was inspected. No body/collider, NPC material, source geometry,
spell selection, model/provider, reward or combat outcome was changed.

Next, use the earned parchment to investigate an unvisited reachable branch.
Keep the Water Weird and stairs94,65 unresolved until a legitimate engagement
is appropriate. General interior composition/lighting, street leg burial,
overbroad grate card, source history, meaningful hazards/secrets/stairs,
victories, earned rewards and persistent failure aftermath remain open. This
camera milestone does not complete the expedition.

Previous desktop checkpoint: Sana had walked up the five physical entrance
parts and through the opened Shadowed Pestle doorway121 using ordinary controls.
The original554 building parts remain. The existing floor is4.331548055857618m;
no actor lift, terrain rewrite, collision bypass or forced meeting was used.
Normal manual1793260141297 saved the inside point
477.79653239075697/473.9889821385051/Y4.331548055857618. A subsequent full document
reload and normal Continue retained all13 present groups exactly against
auto1793262204956. The desktop entry and reloaded interior were inspected.

The local runtime loss required a separate recovery before this play: seven
original native save rows and preferences were copied exactly into an empty
persistent profile before navigating to the game. This is faithful archive
recovery, not reload proof or a gameplay rollback. The entry/reload above and
the later morning reload below were normal gameplay saves with no new import.

Subsequent morning play has now established physical first contact. Sana
re-entered through the original door and walked around its real opened leaf;
the refused direct approach was correct collision, not a missing passage. A
normal visible Meet click at475.6501347564253/474.7809874566068/Y4.331548055857618
opened the same43-year-old taverner's profile. Normal Talk opened Bram's actual
conversation and the carried Senna account topic. The native record resolves
npc_burg_675_plot_121, with exactly one direct player_met_npc fact for Sana and
disposition50. No home lookup, forced click, identity change or recruitment was
used. The physical profile and conversation renders were inspected.

The first Discuss this account request failed after90 seconds. The local service
returned499 when the client disconnected while the existing selected Stheno8B
model was still loading. The UI truthfully retained the choice and its effects
and offered Retry reply. Native archive3914503b contains the first meeting and
one discussed source-account topic, with unchanged HP9,20.69 and31 items. There
is no generated answer, corroboration of the two-century claim or new history
fact. An empty-prompt load of the same installed local model is a bounded
readiness diagnosis, not NPC speech or a second topic action.

The longer, empty-prompt readiness request also failed after300150ms; it did
not load the model or produce speech. No reply-only retry, model/provider swap,
compute-mode change or repeated paid-account action followed. Available GPU/RAM
was tight, but the exact loading failure remains unproved. Repeating this method
requires new evidence.

Normal Have we met before? answered that this was the first meeting. After End
Conversation and normal Save/Main Menu1793267295358 at08:38:58, an owner-only
coherent preview refresh, one full document reload and normal Continue retain
all19 present groups exactly against auto1793267701392 at08:39:27. The additional
checks cover adventure/discovery/quest logs, the failed Ollama interaction log,
last long rest and hidden-site records. The manual and older named payloads are
byte-identical through that reload; no archive was imported. The saved body,
one original first-meeting fact, discussed account, supplies and dungeon state
remain exact. Actual desktop reload rendering was inspected.

After the normal To Player mount settled, the same visible physical Meet/Talk
worked again. Bram recognized Sana from the earlier conversation; the factual
meeting topic answered that they had met before. These are source-backed
returning-contact acknowledgments, not generated knowledge about the dungeon.
Normal final Save/Main Menu1793268077825 at08:45:20 retains15 present nonmemory
groups exactly. The original first fact remains byte-identical and unique,
recency advances, disposition stays50 and the failed account topic is not
replayed. Seven native records are archived with SHA256
3edf522db462aea2c885482a4c2b48255033dfa68f7e02e3ac4c4dc7c736cd02.
This later acknowledgment/save is distinct from the earlier19-group reload.

Historical evening availability: the actual Meet control first refused because Sana was
too far away. Later ordinary approach did not establish a conversation. After
18:05, the public Pestle record said no keeper was on duty and disabled both
services. The Sundries inn independently gave the same availability refusal.
No departure time, home location or exact business hours were inferred. The
disabled, unbound Hald label is not evidence of a recruitable resident.

Normal Long Rest inside the tavern refused occupied property without a reserved
guest bed. Sana walked back through the door and down the stairs to public
ground at477.7235269443537/470.1585187262875/Y3.56338321314966. One normal six-hour
wait advanced18:11:17 to00:11:17, then an eight-hour camp rest completed at
08:11:17 on day5. Rations and water each fell2→1. HP9,20.69 liquid,16 physical
coins,31 inventory entries, three source torches and two cache claims remain;
no light, extra reward, lodging permission or restored NPC was granted. The
world crossed midnight normally. A visible Bram label returned in the morning,
which is not a meeting or on-duty proof.

Normal Save/Main Menu1793265204280 at08:12:26, one full document reload and normal
Continue preserve all13 present groups exactly against auto1793265434719 at
08:13:13. This includes body, party, inventory, gold, lights, expedition,
businesses, town state, NPC memory, generated people and companions. Opened
leaves34/121/123,1213 mapped cells, both claims and the unresolved Water Weird
and stairs remain. The morning desktop render was inspected at2560×1305.

The existing local-service proxy also recovered from a permanent refusal latch:
its unchanged routing now allows one incoming retry probe every two seconds.
Four focused cases, three scoped type paths and real502→200 transport checks
pass. This proves transport recovery, not an NPC reply. See developer-environment
and existing GG-15. No model, provider, installed model or credentials changed.

That checkpoint led to the independent camera replay and ordinary exit now
recorded above. Continue actual source Alrio investigation and legitimate
willing help. Keep street leg burial and
overbroad grate card open. Find legitimate willing help and continue the source
history, deeper hazards, stairs, victories, earned rewards and persistent failure
aftermath. Desktop is the design target. The complete expedition is not accepted.

Historical desktop approach before the hillside stair repair: Sana physically approached living public keeper
Bram Ironton's Shadowed Pestle, artifact121, after the Alrio return. Normal
doorway clicks first refused alignment and range, then opened the actual source
leaf121. This is not a meeting. Ordinary walking stopped at
477.4491157372059/472.54568459194763/Y3.9295064933166453 even after the stable
entry-tread source refresh. The mounted leaf bottom is4.209628055856782; the
roughly280mm difference is a diagnosis clue, not a measured support-floor claim.
The town owner is diagnosing this entrance's admission. No actor lift, wall
bypass, source replacement or forced NPC contact was used.

Before that refresh, normal walking backed over six meters into the street.
Manual1793252390035→auto1793252724573 preserves all13 present groups exactly.
The opened121 leaf joins the retained34/123 leaves; source identities,1213 ink,
two claims/16 coins,31 items,9HP,20.69 liquid, partial/fresh torches and unresolved
Water Weird/stairs remain. After the failed fresh replay, normal walking backed
out again. Manual1793253648779 parks at
477.7917852414679/469.61395961778715/Y3.4861707790107843, about4.16m from the
door. Seven native payloads are archived in ignored scratch; no technical
rollback or Chronicle restoration was used.

The1920×1080 porch render also reproduces the camera collapsing into Sana's
torso. A bounded read-only query of mounted geometry finds a six-meter arm
clear at shallow elevations, while steep elevations retract below two meters.
FreeRoamCameraController now tries three shallower checked arms along the same
heading, preserving the selected elevation/zoom for recovery and manual orbit
input. It changes no body, focus, walking direction or source geometry.24
affected camera cases and two scoped type paths pass with zero diagnostics.
The exact served camera source was checked after full document reload. Native
manual1793253648779→auto1793254536798 preserves all13 present groups exactly
before new walking. Actual1920×1080 replay then approaches the same blocked
doorway with a6.1727m arm and18-degree elevation, keeping Sana and the entrance
framed rather than filling the screen with her torso. Normal backout restores
the selected0.7960-radian elevation while preserving the same heading. These
renders were inspected. Normal Save/Main Menu1793255227552 now parks at
477.78733030932716/470.16649641482894/Y3.551259263746438. Seven native payloads
were archived and read back before the next geometry refresh. This qualifies
the porch case, not every indoor camera or the street leg-burial defect.

Read-only admission diagnosis confirms121 has no entry-approach parts. All six
candidate counts are dry and avoid neighboring plots. Counts1–3 exceed the
existing170mm construction riser; counts4–6 were rejected because their lower
treads intersect the downhill soil. The existing helper now tries its original
fully exposed construction first, then permits soil-contact treads only where
that original pass refused. The landing stays clear, fully buried treads are
omitted, and terrain, source parts, door, water/neighbor checks, maximum drop
and ordinary walking limits remain intact. Two new downhill cases fail before
the repair and pass after it; all nine original entry cases pass. Two changed
entry paths pass scoped types, giving35 distinct camera/entry cases and four
scoped paths across this wave. One header wave changes no source headers and
leaves five dependent paths unwritten.

The retained native675 packet comparison preserves all17 previously admitted
building packets byte-for-byte, including inn33's seven added parts. The new
candidate gives121 five real parts. Offline ordinary walking changes from
blocked to the existing4.331548055856783 floor in237 steps, with a largest
rise0.15496352156513016m. This is source diagnosis, not player traversal. The
retained packet has the same mounted121 center/corners/554 original parts,
door ID/XZ and floor; its older2.1m door height differs from the current2.1336m
and does not enter step derivation. This was source-only evidence at that
checkpoint. Actual entry and subsequent keeper availability are recorded above.
Aralia's design target is desktop; a wide viewport alone does not establish a
usable desktop layout. Bram contact, willing help, deeper hazards, victory and
persisted failure aftermath remain open.

## Source-preserving local journeys under verification

The embedded native Atlas now requests a reviewed local journey before changing
the ground window. `localGroundJourney.ts` starts from the saved body's original
window, routes across regional land and actual bridge or ford footprints, and
uses the existing travel executor for time, supply remainders, navigation, trip
events, exhaustion and encounters. It refuses foreign cells, stale reviews and
insufficient supplies. Classic selected-cell entry still needs the same travel
boundary; it is not proof of a legitimate local journey.

Survey windows explicitly disable the generator's camera-centered settlement
floor. Existing entry defaults and the actual departure and destination windows
remain unchanged. A regression checks equal default heightfields, preserved
roads, rivers and crossings, and water retained at an uninhabited survey center.
Local encounter extraction uses the retained Region and Local at the chosen
focus and arrival time, rather than a nearby road from another window.

The actual Fianna/Choux request was refused. Her body remained at its original
position, with 11 HP, 23 gold and ten inventory entries. Read-only diagnosis found
both endpoints in cell 2911 and above the terrain waterline, but the departure
body is only 4.91 ft from river 145's regional centerline, inside its 216.56 ft
bank width. Neither checked source region publishes a crossing. Regional bank
width alone cannot establish the current town's physical foot support. Inspect
that actual ground support and reach a source-backed bank or crossing before
another journey attempt. No journey, dungeon arrival, reward or victory follows
from the candidate's passing checks.
