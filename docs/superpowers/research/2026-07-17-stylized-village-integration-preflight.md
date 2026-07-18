# Stylized Village integration preflight

**Date:** 2026-07-17  
**Work type:** ARALIA_PRODUCT  
**Asset:** [Stylized Village by Hivemind](https://www.fab.com/listings/587858fc-892c-4594-a5e0-3d243b00531d)  
**Status:** blocked at acquisition, licence and distribution gate

## Outcome

Do not write integration code or place asset files in this repository yet.

The public listing proves that the collection is an Unreal Engine package. It
does not prove that Aralia has acquired it, which licence tier applies, or that
the source files are available locally. The Aralia GitHub repository is public.
That makes a normal `public/assets` import unsafe until the distribution boundary
has been confirmed for a browser game and a public source repository.

The production architecture can support an asset-backed presentation path. It
must sit behind WorldForge's existing render contracts. It must not replace the
town, blueprint, interaction or collision sources of truth.

## Evidence collected

### Public listing

The listing states:

- Unreal Engine is the only included format
- the scene was made for Unreal Engine 5
- Lumen and Nanite are supported for Unreal Engine 5.0 or later
- the collection contains 248 meshes
- the advertised scene includes a main town, forests, seaside docks, a mushroom
  forest, foliage and stylised effects
- `Allows usage with AI` is `No`

These are marketing-level facts. They are not an asset inventory. They do not
prove the contents of an acquired archive.

Fab's [Standard License summary](https://www.fab.com/eula) says that assets may
be modified and distributed as part of an incorporated project. It also says
that assets must not be redistributed on a standalone basis. The summary says
it is not the binding legal text. It does not settle whether converted GLB files
in a public Git repository, or directly retrievable model files in a browser
build, are sufficiently incorporated. Do not claim legal certainty from it.

Fab's [licensing documentation](https://dev.epicgames.com/documentation/en-us/fab/licenses-and-pricing-in-fab)
says that Standard has Personal and Professional price tiers, and that the
correct tier depends on the buyer's gross commercial revenue in the previous 12
months. Only the buyer can establish the correct tier and entitlement.

The same documentation says the NoAI tag means the asset must not be used for
generative-AI data collection. This task has a stricter boundary: do not upload
meshes, textures, source packages, screenshots, renders or embeddings to an
external AI service. That stricter boundary controls this work.

### Local availability

No matching source package was found in these inspected locations:

- `C:\ProgramData\Epic\EpicGamesLauncher\VaultCache` — absent
- `C:\Users\Gambit\Documents\Unreal Projects` — absent
- `C:\Users\Gambit\Downloads` — no matching Unreal or Hivemind package
- `C:\Users\Gambit\Desktop` — no matching package
- `F:\Assets` — absent
- `F:\Unreal` — absent
- `F:\Repos` — no matching Hivemind, listing-id or Stylized Village source
- common Epic Games installation and launcher-manifest locations — absent

The machine has local Unreal cache folders for 4.21, 4.25 and 5.1. That does not
prove that the collection is installed or that a usable Unreal editor is
currently available.

This search does not prove that the user's Fab account lacks an entitlement. No
account was opened or changed.

#### User-provided `F:\Side Assets` path

A later user message supplied `F:\Side Assets`. A recursive metadata-only audit
found 868 files totalling about 133 MB:

- 853 PNG files
- 6 JPG files
- 6 internet shortcuts
- 2 macOS metadata files
- 1 Windows shortcut

The folders are named Battlefield Assets, Deadly Dungeons Free Pack, Desert,
Forest and Rustic Furniture Assets 2 Free Pack. They contain two-dimensional
map/token art. No `.uproject`, `.uasset`, `.umap`, FBX, OBJ, GLB or GLTF file is
present. No filename identifies Hivemind, the Fab listing ID or Stylized Village.

The readable forest licence shortcuts point to CC BY-NC-SA 4.0 and a Venatus
Maps Patreon page. That licence and publisher do not match the requested Fab
collection. The other packs do not provide sufficient licence evidence in this
folder.

**Decision:** reject `F:\Side Assets` as the source for this goal. Do not import
these unrelated raster packs as a substitute for the missing 3D collection.

### Repository distribution

`gh repo view` reports `Gambitnl/Aralia` as `PUBLIC`.

Aralia already keeps MIT-licensed GLB and texture examples under
`public/assets/ez-tree-lab`, with a local `LICENSE.txt` and source links. That is
a useful provenance pattern. It is not a precedent for placing restricted Fab
content in a public repository.

## Architecture decision

### Sources of truth that must remain unchanged

The live game already follows the required path:

`Character Creation -> Start Point Selection -> PLAYING -> World3DWrapper`

`World3DWrapper` resolves the authoritative entry cell and starts the worker-
backed WorldForge ground pipeline. WorldForge generates the canonical town once,
replays player deltas, builds each plot's blueprint and interior, and emits the
`GroundWorld` and chunk-site render contracts.

The pack may only supply renderer-side presentation. It must not decide:

- town layout, roads or paths
- building type or footprint
- entrances or interiors
- collision or walkability
- occupants, encounters or interactions
- persistence or procedural seeds

### Existing presentation seams

The strongest building seam is `SiteBuilding` in
`src/components/World3D/World3DScene.tsx`. It already chooses between detailed
near-player procedural parts and a cheaper distant shell. The current 18-metre
enterable-detail rule is a useful honesty and performance boundary.

The strongest prop seam is `GroundProps`. It maps stable gameplay `defId` values
to renderer-owned forms and instances repeated props without changing the
authoritative prop catalogue.

The procedural tree layer follows the same pattern: canonical scatter positions
remain authoritative while shared geometry is instanced by species and variant.

Existing `LabRocks` and `LabGrass` components show local GLB loading, DRACO use,
cloning, grounding and instancing. They are implementation references, not a
licence shortcut.

### Preview decision

The existing `3D Town` preview is not enough. It compares a two-dimensional
`TownPlan` with a separate synthetic `townMesh` extrusion renderer. It does not
exercise production `World3DScene` or the proposed asset adapter.

Use a dedicated `Village Asset Lab`, or extend the newer Building Identity Lab,
so the preview consumes the same blueprint and presentation adapter as the live
scene. The preview must compare procedural and asset-backed rendering side by
side and cover the checks in the task specification.

## Critic findings

### BLOCKER — no acquired source or entitlement evidence

**Evidence:** no matching local package was found, and no Fab account was
accessed. The public listing is not proof of acquisition.

**Correction:** the user must acquire the collection under the correct tier and
provide a local source path outside the repository, plus non-secret entitlement
evidence naming the listing, acquisition date, licence class and selected tier.

### BLOCKER — public-repository and browser distribution are unresolved

**Evidence:** Aralia is public. Fab permits incorporated project distribution but
forbids standalone redistribution. A public GLB path is directly retrievable.

**Correction:** do not commit raw or converted Fab files. Obtain written
confirmation from Epic or Hivemind for the proposed browser-delivery treatment,
or choose an approved packaging and delivery boundary that keeps the repository
compliant. Record the decision before conversion.

### BLOCKER — current chunk-site data does not preserve an exact doorway

**Evidence:** the site contract retains `doorZSign`, footprint and procedural
parts, but not a structured entrance coordinate suitable for checking an asset
door against the blueprint.

**Correction:** preserve exact blueprint entrance metadata through
`GroundWorld.buildings` and chunk sites before approving an enterable exterior
skin. Until then, a building asset can only be a distant shell or a clearly
non-enterable background building.

### BLOCKER — external AI cannot perform the licensed visual review

**Evidence:** the task forbids uploading source assets and renders to external AI
services. Matrix workers are model-backed external lanes.

**Correction:** keep all asset conversion and screenshots local. Use a human
reviewer for the actual asset screenshots and rendered eye test. A Matrix worker
may change bounded code and tests, but must not open, inspect, encode or transmit
the proprietary files or their renders.

### MAJOR — no explicit asset-backed renderer mode exists

**Evidence:** the current wrapper distinguishes ground and legacy modes. It does
not distinguish procedural and asset-backed presentation.

**Correction:** add a development-only presentation selector with explicit
`procedural` and `village-assets` modes. Missing expected models must produce a
visible development error. Do not silently switch back to procedural mode.

### MAJOR — naive per-building GLTF cloning will fail at town scale

**Evidence:** production streams a 9 by 9 chunk window, caps concurrent loads,
limits DPR to 0.65 to 0.75 in ground mode, and already uses distance-gated
interiors and instanced props and vegetation.

**Correction:** catalogue assets by compatible building type and LOD. Instance
repeated props and foliage. Keep detailed interiors procedural and near-player.
Measure the exact baseline before enabling the first asset family.

### MAJOR — source units and preview units disagree

**Evidence:** live ground contracts use metres, blueprint models use feet, and
the existing town preview rescales a synthetic plan.

**Correction:** every catalogue record must store source units, converted metre
bounds, axes, pivot, scale, rotation, footprint, storeys and doorway coordinates.

### GOOD — WorldForge already has a clean presentation boundary

`GroundWorld`, chunk sites, stable prop IDs, `SiteBuilding`, `GroundProps` and
the instanced vegetation layers provide suitable adapter seams. The integration
does not need a second town generator.

## Candidate first slice after the gates clear

Do not select a specific mesh before inspecting the acquired archive.

The safest candidate shape is one building family mapped to one existing Aralia
building type as a distant LOD shell. Near the player, keep the exact procedural
exterior and interior until entrance, footprint and collision alignment are
proved. This tests conversion, catalogue lookup, loading errors, scale, lighting,
LOD and performance without falsifying gameplay.

The catalogue record must include at least:

- source asset identity and derivative checksum
- compatible Aralia building types
- source units and converted metre bounds
- footprint and storeys
- doorway coordinates and facing
- pivot, scale and rotation
- enterable or non-enterable status
- collision proxy identity
- material family and texture set
- supplied and generated LODs
- prop anchors
- conversion result and rejection or deferral reason

The first slice must remain within the goal's stricter budget: stable 60 FPS and
no more than a 10% median-FPS regression or 2 ms added median frame time against
the same seed, route, viewport and camera path.

## Matrix worker boundary

Kilo's free route is the only worker currently marked ready in both the Agent
Matrix offering ledger and Agora registry. Codex remains the supervisor. Gemini
is deprecated. Other candidates have registry or wiring conflicts.

The first preflight found the dashboard offline. A continuation check started
the local dashboard and queried its live APIs. `kilo-cli` reported
`supervision-ready`, `worker-ready`, `free-model-available`, and a trial-verified
`kilo/kilo-auto/free` route. Agora independently reported Kilo as a ready worker
with the same free-only constraint. The Matrix reported zero active sessions.
This resolves worker availability, but it does not permit dispatch before the
asset and licence gates clear.

Do not dispatch a worker until the critic has approved a local asset treatment.
The worker packet must be inline and include every field required by the goal.
The worker must remain code-and-doc-only: it may consume approved catalogue
metadata but must not read or transmit Fab binaries, textures or renders.

## Exact decision gate

The next action belongs to the user:

1. Acquire the listing personally under the correct Fab tier. Do not ask an
   agent to accept the licence or change the account.
2. Download it to a local directory outside `F:\Repos\Aralia`.
3. Provide the absolute path and non-secret entitlement details: listing ID,
   acquisition date, Standard or legacy licence, and Personal or Professional
   tier.
4. Provide written Epic or Hivemind confirmation for the proposed browser
   delivery of converted derivatives, or choose another approved distribution
   boundary.
5. Confirm that a human will perform the local visual review because the asset
   and its renders cannot be sent to an external AI reviewer.

Until those points are satisfied, inventory, conversion, Design Preview proof,
Matrix dispatch and live integration remain incomplete.

## Code evidence

- `src/App.tsx:1030-1042`, `2132-2222` — normal journey and live wrapper
- `src/components/World3D/World3DWrapper.tsx:284-476`, `1469-1498` — canonical
  entry, worker-backed loading and explicit world-generation errors
- `src/systems/worldforge/bridge/groundChunkLoader.ts:1545-1713`,
  `1954-2044` — canonical town generation, styling and blueprint build
- `src/components/World3D/World3DScene.tsx:421-622` — `SiteBuilding` and
  near-player detail boundary
- `src/components/World3D/World3DScene.tsx:923` — live DPR limit
- `src/components/World3D/GroundProps.tsx:68-164`, `353-391` — prop adapter and
  instancing pattern
- `src/components/DesignPreview/DesignPreviewPage.tsx:137`, `533` — current
  `town3d` preview entry
- `src/components/DesignPreview/steps/PreviewTown3D.tsx:13-134` — current
  side-by-side plan preview
- `src/components/DesignPreview/steps/Town3DScene.tsx:10-96` — synthetic town
  renderer rather than production scene
- `src/systems/world3d/types.ts:295-345` — current site contract and doorway gap
- `src/systems/worldforge/interior/blueprintTypes.ts:174-175`, `730-743` — exact
  blueprint entry and door data exists upstream
