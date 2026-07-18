# Worldforge — Procedural World Pipeline (Absorbed 2026-07-14)

Preserved essential specification and decisions from absorbed `docs/projects/worldforge/` folder.

## Vision (Interview 2026-06-10/11)

One generation pipeline from Azgaar continental atlas down to single bedrooms, with every layer derived deterministically from above and a living simulation inhabiting the result.

## Decision Record

| Topic | Decision |
|---|---|
| Azgaar | Port FMG algorithms into Aralia |
| Zoom topology | Discrete layers with named scales |
| 2D?3D | Hybrid live-where-it-matters approach |
| Gameplay | Full simulation presence required |
| Town quality | All four Watabou virtues |
| Town gen | RealmSmith evolution |
| Art | Procedural-realistic |
| Assets | Procedural shaders + AI-generated only |

## Current gap authority

This absorbed specification and Plan Map topic `shipped-cartography` are the
tracked Worldforge authority. The former `docs/projects/worldforge/` material is
intentionally absent and must not be recreated. The Wave 4 classification table
below replaces the stale claim that `wf-interiors` owns eleven Worldforge gaps.

## Atlas-to-Ground Authority (Wave 1, 2026-07-17)

- Native Atlas descent now hands the established PLAYING `World3DWrapper` one
  transient `AtlasGroundDrilldown` receipt containing the selected atlas cell,
  exact retained Region and Local object references, focus coordinates and
  provenance, and the Local return target.
- PLAYING builds Ground from those exact objects, preserving its avatar,
  movement, NPC/business interactions, HUD, combat handoff, and existing
  `worldViewMode` transition. Returning from 3D remounts the same Local hierarchy.
- Classic-map entry remains cell-addressed and unchanged. The direct
  `?phase=world3d&ground=1` reconstruction route is explicitly developer-only.
- Focused proof lives in `atlasGroundDrilldown.test.ts`, `AtlasDemo.test.ts`,
  `World3DWrapper.atlasReceipt.test.ts`, and
  `TransitionController.lifecycle.test.tsx`.

## Atlas-to-Ground Persistence (Wave 2, 2026-07-17)

- Canonical game state now saves `AtlasGroundAddress` schema version 1: world
  seed, land-cell id, Region and Local seed paths and bounds, focus kind/source
  id/feet coordinates, and the Local return tier. Generated Region/Local object
  graphs remain transient and never enter save JSON.
- Load normalizes the compact schema with backward-compatible `null` for older
  saves. App hydration replays the same fixed native pipeline
  (`getBridgeAtlas` -> `generateRegion` -> `generateLocal`), validates cell,
  seed paths, Region/Local bounds, focus membership, and world ownership, then
  rebuilds the Wave 1 runtime receipt before PLAYING 3D can mount.
- Malformed, future-version, or stale addresses fail closed to native Atlas;
  they never fall through to the Classic cell-centred approximation. Classic
  2D/3D saves with no Atlas address and the developer-only direct URL retain
  their established behavior.
- Focused proof covers save-service JSON round trip, legacy absence, corrupt
  schema healing, exact generator replay after reload, stale lineage rejection,
  PLAYING receipt consumption, and exact Local return hierarchy in
  `saveLoadService.test.ts`, `atlasGroundDrilldown.test.ts`,
  `World3DWrapper.atlasReceipt.test.ts`, and `AtlasDemo.test.ts`.
- Wave 3 remains additive to this contract; it does not replace the compact
  address or generator replay with another world representation.

## Atlas-to-Ground Gameplay Continuity (Wave 3, 2026-07-17)

- Canonical ground movement now maintains a separate versioned
  `AtlasGroundPosition` receipt beside the Wave 2 address. It carries the exact
  address lineage plus current Local metres, so Atlas entry spawns at the
  selected focus, movement and seamless building/interior traversal update the
  canonical position, combat returns to that position, and a mismatched,
  malformed, or future-version receipt fails closed to the selected focus.
- Retained Region town keepers are included in the existing 3D interaction cast
  and route through the established NPC dialogue and business actions. No
  parallel NPC, interior, combat, or PLAYING implementation was introduced;
  Classic-map 2D/3D and the labelled developer shortcut remain unchanged.
- Hidden-place discoveries now optionally carry versioned Atlas provenance:
  world seed, atlas cell, Region/Local seed paths and bounds, site/source
  identity, exact Local metres, and absolute feet. Their stable identity is
  scoped to that lineage, avoiding collisions between Locals, and the same saved
  record renders on native Atlas/Local maps after ground -> Atlas -> ground and
  save/reload. Older Classic discoveries remain readable; corrupt or stale new
  provenance is discarded rather than approximated.
- Focused proof is 87 passing Vitest assertions across
  `atlasGroundContinuity.test.ts`, `World3DWrapper.atlasReceipt.test.ts`,
  `AtlasDemo.test.ts`, `worldReducer.test.ts`,
  `appState.combatPersistence.test.ts`, and `saveLoadService.test.ts`, plus the
  passing TSD suite. The real embedded journey descended L0 -> Cell #3122 ->
  L2 Local `4,712,600,2,676,197 ft` -> retained PLAYING 3D, then returned to the
  same L2 hierarchy. Inspected desktop and 390 x 844 captures are under
  `.agent/scratch/worldforge-wave3-{desktop,mobile}-{local,ground}.png`, with
  the post-ground hierarchy additionally captured in
  `.agent/scratch/worldforge-wave3-desktop-return.png`; there were zero relevant
  console errors (only the existing missing-favicon 404).
- Wave 4 owns canonical place names, hierarchy labels/depth presentation,
  visual identity, and broader framing polish. It must preserve Waves 1-3:
  exact retained artifacts, compact fail-closed reconstruction, gameplay
  position continuity, provenance pins, Classic behavior, the developer route,
  and future hierarchy depth. Wave 3 intentionally did not redesign those
  surfaces.

## Atlas-to-Ground Identity and Correspondence (Wave 4, 2026-07-17)

- `RegionTownSite.identity` is the owning generated identity for an Atlas burg:
  stable source kind/id, canonical display name, settlement type, biome id, and
  road, river, and coast relationships. Current generation always stamps it;
  the optional field only keeps older fixtures and replay inputs readable.
- `canonicalArtifactTownForSiteFromAtlas` generates the town once from the exact
  retained Atlas/Region site and copies that identity onto `LocalArtifact.townPlan`.
  Local labels, hierarchy breadcrumbs, the Ground entry action, PLAYING HUD,
  retained ground-town/NPC context, hidden-site provenance, and the same Local
  return therefore read one artifact-owned name/source rather than inventing
  display names independently. Wave 2 replay takes the same adapter path.
- The Local canvas now draws the exact town-plan streets and building footprints
  consumed by Ground, over the retained biome terrain, water, rivers, and roads.
  Its selected marker, canonical label, architecture colors, source receipt, and
  relationship chips make the chosen place recognizable before and after entry.
  Ground retains the same terrain palette, hydrology/route inputs, town geometry,
  focus marker/spawn, settlement type, and source identity in its scene and HUD.
- The responsive hierarchy names each semantic tier explicitly: World -> Cell ->
  Region -> Local -> town/site -> Ground. `aria-current` distinguishes the
  current tier while the selected artifact and next action remain separately
  labelled. The crumb builder is additive, so deeper future tiers can append
  without treating Ground as a hard-coded terminal depth.
- Classic PLAYING 2D/3D behavior is unchanged. The direct URL remains visibly
  labelled a developer shortcut into this same canonical pipeline.

### Wave 4 deterministic proof

- 89 focused Vitest assertions pass across `generateRegion.test.ts`,
  `groundChunkLoader.test.ts`, `atlasGroundDrilldown.test.ts`,
  `AtlasDemo.test.ts`, `InWorldHUD.titleInfo.test.tsx`, and
  `World3DWrapper.atlasReceipt.test.ts`. They pin deterministic generated names,
  stable source identity, Region -> Local -> Ground continuity, hierarchy labels
  and current-tier state, responsive entry semantics, and PLAYING HUD context.
- Broad TypeScript remains a non-blocking repository backlog. The time-boxed run
  emitted no diagnostic naming a Wave 4 touched file before it was stopped.
- The real deterministic cartographer journey selected Atlas burg Courcot
  (`atlas-burg #1`) in Cell #5312, descended through its Region into the exact
  L2 Local plan, entered its retained Ground receipt/scene, and returned to the
  same Local at desktop and 390 x 844. Direct inspection confirmed matching
  streets/footprints, green biome terrain, river-linked context, selected marker,
  canonical label, source identity, Ground businesses, lineage, and return.
  Evidence: `.agent/scratch/worldforge-wave4-{desktop,mobile}-{local,ground,return}.png`.
- Mobile inspection exposed the expanded options sheet hiding the hierarchy and
  plan on first load. Wave 4 now starts that existing sheet collapsed below 640
  px while leaving its one-tap control and desktop default intact.
- No product error occurred during Local -> Ground -> return. Console residue was
  the existing missing `favicon.ico` 404, missing optional AI-key warnings,
  repeated Three.js `toNonIndexed` warnings, and expected WebGL context-loss on
  scene unmount. Two additional 404s were caused only by the proof operator's
  rejected dynamic-import probes and are not application requests.

### Remaining Worldforge gap classification

| Candidate | Wave 4 status | Durable disposition |
|---|---|---|
| Canonical town name (historical WF-G30) | Closed | The generated Region site owns the stable name/source and every Atlas/Local/Ground surface consumes it. |
| Visual correspondence | Closed for the canonical Atlas integration | Local and Ground share retained terrain/hydrology/routes and one exact town plan, palette, focus, footprints, and identity. Further art-direction polish remains expansion work, not a second mapping pipeline. |
| Travel cell identity / true travel flow (historical WF-G13-G15) | Open | Travel remains preview/centroid-oriented; it still needs authoritative cell identity plus committed travel, failure/cancel, cost, and arrival semantics. |
| Units | Open | Atlas pixels, absolute feet, Local feet/metres, and Ground metres have explicit bridges but no single durable units/reference-frame contract for future tiers. |
| Agent-walking rendered proof (historical WF-G9) | Open | The walking integration exists; a fresh end-to-end rendered agent movement proof remains due. See `docs/plans/2026-06-25-3d-agent-walking-integration.md`. |
| Roof lighting / occlusion | Open | Building/roof lighting belongs to the shared 3D building renderer, outside this Atlas identity wave; keep it routed there rather than special-casing Worldforge entry. |

These are Worldforge or adjacent owning-system gaps, not cross-project orphan
gaps, so Wave 4 does not duplicate them into `docs/projects/GLOBAL_GAPS.md`.

## Cold-start entrypoints

1. Start here for Waves 1-4 invariants and remaining limits.
2. Read `src/systems/worldforge/artifacts.ts`,
   `region/generateRegion.ts`, and `town/canonicalTown.ts` for generated identity
   and exact town ownership.
3. Read `bridge/legacySubmapBridge.ts`, `bridge/groundChunkLoader.ts`, and
   `leaf3d/atlasGroundDrilldown.ts` for replay, Ground adaptation, and provenance.
4. Read `components/Worldforge/AtlasDemo.tsx`, `localDraw.ts`, and
   `LocalMapView.tsx`, then `components/World3D/World3DWrapper.tsx` and
   `InWorldHUD.tsx`, for the native hierarchy and PLAYING presentation.
5. Re-run the six focused Wave 4 suites named above before expanding depth or
   changing identity. Never replace exact retained artifacts with a parallel
   Atlas or Ground approximation.

Full git history: `git log docs/projects/worldforge/GAPS.md`

