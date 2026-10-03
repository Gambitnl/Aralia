# Entity Studio

Verified: 2026-08-29

## Purpose

The **Entity Studio** domain encompasses Aralia's unified suite of procedural 3D entity authoring tools, debugging workspaces, part/geometry laboratories, and machine-learning hero model generators. Together, these systems compile, render, test, and optimize 3D creatures and humanoids.

Aralia treats this domain as an **expansion-first** workspace. The long-term architectural goal is to support a clean standalone carve-out of Entity Studio (Copy, not Move) so that it can be built and run independently, while Aralia's core game rendering remains fully functional and integrated with the shared 3D entity engine contract.

---

## Verified Current Entry Points (The Four Preview Surfaces)

Entity Studio is exposed inside Aralia's local developer toolset via four primary Design Preview panels. These files reside under `src/components/DesignPreview/steps/` and are gitignored by default as local-only workspaces.

### 1. Entity Forge
- **Entry Point File:** `src/components/DesignPreview/steps/PreviewEntityForge.tsx`
- **Child Scene Component:** `src/components/DesignPreview/steps/EntityForgeScene.tsx` (Lazy loaded)
- **URL Route:** `design.html?step=entityforge`
- **Purpose:** Allows developers to customize race, class, size, and seed configurations to preview walking models and mixed lineups. It provides an eyeball surface for skeleton pivot A/B comparisons (segmented vs. skinned body meshes). It also serves as the interface for text-to-creature plan generation.
- **Direct & Transitive Local Dependencies:**
  - `@/data/races` (`src/data/races.ts`)
  - `@/data/classes` (`src/data/classes.ts`)
  - `@/types/creatures` (`src/types/creatures.ts`)
  - `@/systems/entities3d/types` (`src/systems/entities3d/types.ts`)
  - `@/systems/entities3d/textPlan/planSchema` (`src/systems/entities3d/textPlan/planSchema.ts`)
  - `@/systems/entities3d/textPlan/compilePlan` (`src/systems/entities3d/textPlan/compilePlan.ts`)
  - `@/systems/entities3d/textPlan/fixtures` (`src/systems/entities3d/textPlan/fixtures.ts`)
  - `@/systems/entities3d/parts` (`src/systems/entities3d/parts/index.ts`)
  - `@/systems/entities3d/generateEntityBlueprint` (`src/systems/entities3d/generateEntityBlueprint.ts`)
  - `@/systems/entities3d/three/speciesSkeleton` (`src/systems/entities3d/three/speciesSkeleton.ts`)
  - `@/utils/random/seededRandom` (`src/utils/random/seededRandom.ts`)
  - `./EntityForgeScene` (Lazy loaded: `src/components/DesignPreview/steps/EntityForgeScene.tsx`)
    - `@react-three/fiber` / `@react-three/drei` / `three`
    - `@/systems/entities3d/three/Entity3D` (`src/systems/entities3d/three/Entity3D.tsx`)
    - `@/systems/entities3d/three/toon` (`src/systems/entities3d/three/toon.ts`)
    - `@/components/BattleMap/characters/characterActor/entityOverlays` (`src/components/BattleMap/characters/characterActor/entityOverlays.ts`)
    - `@/components/BattleMap/characters/characterActor/models` (`src/components/BattleMap/characters/characterActor/models.ts`)
    - `@/devtools/perf` (`src/devtools/perf/index.ts`)
- **Dev Service Endpoints consumed:**
  - `POST /devhub/api/creature-plan` (Triggers text-to-creature plan generation)
  - `GET /devhub/api/creature-plans` (Fetches plans library list)
  - `POST /devhub/api/creature-plan/approve` (Approve a draft plan for game bundling)

### 2. Entity Debug
- **Entry Point File:** `src/components/DesignPreview/steps/PreviewEntityDebug.tsx`
- **Child Scene Component:** `src/components/DesignPreview/steps/EntityDebugScene.tsx` (Lazy loaded)
- **URL Route:** `design.html?step=entitydebug`
- **Purpose:** Comprehensive instrumentation workspace. Supports anchor overlays (15 anchors), gait freezing, phase scrubbing, speed adjustment, turntable rotation, camera presets, and live performance metrics (FPS, draw calls, triangles, and rebuild costs). Shows the rendering "Hall of Shame" field guide panel.
- **Direct & Transitive Local Dependencies:**
  - `@/data/races` (`src/data/races.ts`)
  - `@/data/classes` (`src/data/classes.ts`)
  - `@/types/creatures` (`src/types/creatures.ts`)
  - `@/systems/entities3d/parts` (`src/systems/entities3d/parts/index.ts`)
  - `@/systems/entities3d/registry` (`src/systems/entities3d/registry.ts`)
  - `@/systems/entities3d/types` (`src/systems/entities3d/types.ts`)
  - `@/systems/entities3d/textPlan/planSchema` (`src/systems/entities3d/textPlan/planSchema.ts`)
  - `@/systems/entities3d/textPlan/fixtures` (`src/systems/entities3d/textPlan/fixtures.ts`)
  - `./entityDebugFocus` (`src/components/DesignPreview/steps/entityDebugFocus.ts`)
  - `../../../../docs/rendering-hall-of-shame.md?raw` (Vite raw asset import)
  - `../../ui/WindowFrame` (`src/components/DesignPreview/ui/WindowFrame.tsx`)
  - `./EntityDebugScene` (Lazy loaded: `src/components/DesignPreview/steps/EntityDebugScene.tsx`)
    - `@/systems/entities3d/three/speciesSkeleton` (`src/systems/entities3d/three/speciesSkeleton.ts`)
    - `@/systems/entities3d/three/assembleEntity` (`src/systems/entities3d/three/assembleEntity.ts`)
    - `@/systems/entities3d/three/gaits` (`src/systems/entities3d/three/gaits.ts`)
    - `@/systems/entities3d/three/toon` (`src/systems/entities3d/three/toon.ts`)
    - `@/components/BattleMap/characters/characterActor/entityOverlays`
    - `./partSpecimen` (`src/components/DesignPreview/steps/partSpecimen.tsx`)
  - `./EarthGolemImg2ThreeScene` (Lazy loaded reference scene: `src/components/DesignPreview/steps/EarthGolemImg2ThreeScene.tsx`)
    - `@/systems/entities3d/vendor/img2threejs/createEarthGolemModel` (`src/systems/entities3d/vendor/img2threejs/createEarthGolemModel.ts`)
- **Dev Service Endpoints consumed:**
  - `GET /devhub/api/creature-plans` (Loads plans for selector)

### 3. Part Lab
- **Entry Point File:** `src/components/DesignPreview/steps/PreviewPartLab.tsx`
- **Child Scene Component:** `src/components/DesignPreview/steps/PartLabScene.tsx` (Lazy loaded)
- **URL Route:** `design.html?step=partlab`
- **Purpose:** A clean stage focusing purely on modular part quality (hands, heads, feet). Permits swapping slots between candidates, toggling joint bone overlays, rendering base meshes, playing CC0 humanoid clips, and direct editing of skeleton joint locations (with live re-rigging triggers).
- **Direct & Transitive Local Dependencies:**
  - `@/data/races` (`src/data/races.ts`)
  - `@/data/classes` (`src/data/classes.ts`)
  - `@/systems/entities3d/parts` (`src/systems/entities3d/parts/index.ts`)
  - `@/systems/entities3d/types` (`src/systems/entities3d/types.ts`)
  - `@/systems/entities3d/three/partVariants` (`src/systems/entities3d/three/partVariants.ts`)
  - `@/systems/entities3d/three/baseMeshCatalog` (`src/systems/entities3d/three/baseMeshCatalog.ts`)
  - `./PartLabScene` (Lazy loaded: `src/components/DesignPreview/steps/PartLabScene.tsx`)
    - `@/systems/entities3d/generateEntityBlueprint` (`src/systems/entities3d/generateEntityBlueprint.ts`)
    - `@/systems/entities3d/three/assembleEntity` (`src/systems/entities3d/three/assembleEntity.ts`)
    - `@/systems/entities3d/three/skinnedBody` (`src/systems/entities3d/three/skinnedBody.ts`)
    - `@/systems/entities3d/three/toon` (`src/systems/entities3d/three/toon.ts`)
    - `@/systems/entities3d/three/skeletonBuilder` (`src/systems/entities3d/three/skeletonBuilder.ts`)
    - `@/systems/entities3d/anim/humanoidRetarget` (`src/systems/entities3d/anim/humanoidRetarget.ts`)
    - `./partSpecimen` (`src/components/DesignPreview/steps/partSpecimen.tsx` -> `buildPartGeometry`)
- **Dev Service Endpoints consumed:**
  - `GET /devhub/api/partlab/landmarks?id=<id>` (Loads stored joint landmarks file)
  - `POST /devhub/api/partlab/landmarks` (Saves updated landmarks to `.landmarks.json`)
  - `POST /devhub/api/partlab/rerig` (Runs re-rigging tool to regenerate armature weights)

### 4. Hero Lab
- **Entry Point File:** `src/components/DesignPreview/steps/PreviewHeroLab.tsx`
- **URL Route:** `design.html?step=herolab`
- **Purpose:** Serves as the dashboard control panel for the Hugging Face creature styling pipeline. Tracks image-to-3D jobs via Gradio client connection to Microsoft TRELLIS.2 Space, previews generated high-detail meshes side-by-side with procedural bases, and triggers guarded asset promotions.
- **Direct & Transitive Local Dependencies:**
  - `lucide-react` (icon kit)
  - `@/systems/entities3d/parts` (`src/systems/entities3d/parts/index.ts`)
  - `@/systems/entities3d/types` (`src/systems/entities3d/types.ts`)
  - `@/systems/entities3d/textPlan/planSchema` (`src/systems/entities3d/textPlan/planSchema.ts`)
  - `./EntityDebugScene` (Lazy loaded: `src/components/DesignPreview/steps/EntityDebugScene.tsx`)
  - `@/systems/entities3d/library/acceptedEntities` (`src/systems/entities3d/library/acceptedEntities.ts`)
- **Dev Service Endpoints consumed:**
  - `GET /devhub/api/creature-plans` (Populates creature selections)
  - `POST /devhub/api/hero-lab/jobs` (Starts remote Hugging Face extraction)
  - `GET /devhub/api/hero-lab/jobs/:id` (Tracks remote job stages and progress)
  - `POST /devhub/api/hero-lab/jobs/:id/promote` (Promotes raw mesh and registers it)
  - `POST /devhub/api/hero-lab/jobs/:id/retry` (Retries failed Hugging Face pipeline runs)
  - `GET /devhub/api/hero-lab/jobs/:id/artifacts/:artifactType` (Reads reference/master/hero assets)

---

## Shared Engine Modules (`src/systems/entities3d/`)

The shared engine contains modular parts, skeletons, and shaders that compile and render blueprints.

```
src/systems/entities3d/
├── anim/
│   ├── clipStore.ts                   # AnimationClip registers and retarget metadata
│   └── humanoidRetarget.ts            # Mocap armature retarget mapping logic
├── library/
│   ├── acceptedEntities.ts            # Bundles approved plans using import.meta.glob
│   └── heroStore.ts                   # Node.js-only hero-job artifact storage API
├── parts/
│   ├── celestialParts.ts              # Halo, wing-feathers, divine details
│   ├── chainParts.ts                  # Procedural vertebrae and tail links
│   ├── gearArmor.ts                   # Helmets, pauldrons, shield mesh creators
│   ├── gearWeapons.ts                 # Swords, axes, bows, staffs mesh creators
│   ├── headParts.ts                   # Stylized eyes, horns, crests, jaws
│   ├── index.ts                       # Hub registering every procedural part
│   ├── organicParts.ts                # Claws, shells, crystal spikes, limbs
│   └── wingParts.ts                   # Insect, bat, feathered wings
├── textPlan/
│   ├── budgets.ts                     # Budget parameters (e.g. max triangles = 30k)
│   ├── compilePlan.ts                 # Compiles a body text structure into a Plan
│   ├── fixtures.ts                    # Hardcoded stress-test plans (centaur, dragon, etc.)
│   ├── heroImagePrompt.ts             # Compiles text descriptions to Stable Diffusion prompts
│   ├── planSchema.ts                  # Zod validation schema for creature plans
│   ├── planSize.ts                    # Derived size calculators for grid boundaries
│   └── spineProfile.ts                # Spinal segments profiles
├── three/
│   ├── Entity3D.d.ts / Entity3D.tsx   # React Three Fiber wrapper around assembleEntity
│   ├── assembleEntity.ts              # Vanilla JS/TS Three.js assembly manager
│   ├── baseMeshCatalog.ts             # Licensed base meshes definition catalog
│   ├── chainSkeleton.ts               # Procedural chain segment helpers
│   ├── crowdBake.ts                   # Bake static meshes for crowd optimization
│   ├── crystalGeometry.ts             # Specialized procedural crystal polygons
│   ├── fabrik.ts                      # Vanilla FABRIK Inverse Kinematics solver
│   ├── gaits.ts                       # Procedural locomotion step timing and gait loop
│   ├── gpu/
│   │   ├── gpuMaterialSwap.ts         # Material swapper for specialized GPU tasks
│   │   └── toonNodes.ts               # Three.js Node-material shader configurations
│   ├── headForms.ts                   # Wedge, muzzle, round, and skull geometry definers
│   ├── ik.ts                          # Procedural Inverse Kinematics drivers
│   ├── jointConstraints.ts            # Joint rotation limit clamps
│   ├── legs.ts                        # Leg placement calculators
│   ├── mergeReferenceHand.ts          # Integrates SDF hand mesh variants
│   ├── partVariants.ts                # Part swapper data mappings
│   ├── planSkeleton.ts                # Procedural skeleton nodes for plans
│   ├── referenceHandMesh.ts           # Imports the baked low-poly hand geometry
│   ├── segmentBody.ts                 # Generates segmented humanoid/creature parts
│   ├── skeletonBuilder.ts             # Generates Three.js skeletons from profiles
│   ├── skinnedBody.ts                 # Generates smooth skinned meshes
│   ├── skinnedClipPlayer.ts           # Animates skinned meshes with clips
│   ├── smoothBipedGeometry.ts         # Base smooth biped geometry generator
│   ├── speciesSkeleton.ts             # Gait setups for quad/hex/hop/fly/float species
│   ├── sweptTube.ts                   # Swept-tube geometry generator for limbs
│   └── toon.ts                        # Toon shader (6-step ramp, Fresnel rim lighting)
├── classKits.ts                       # Class kit gear setup mappings
├── creaturePlans.ts                   # Creature plans lookup and catalog
├── creatureProfiles.ts                # Pre-defined profiles for creature categories
├── generateEntityBlueprint.ts         # Compiles recipes into concrete blueprint specs
├── raceMap.ts                         # Maps races to base skeletons and colors
├── registry.ts                        # Engine parts registry
├── speciesProfiles.ts                 # Species configuration profile registry
├── types.ts                           # Shared type definitions
└── vendor/
    └── img2threejs/
        └── createEarthGolemModel.ts   # Vendored generated Earth Golem model
```

### Module Classification: Browser-Safe vs. Node-Only
- **Node-Only:** `src/systems/entities3d/library/heroStore.ts` (directly loads Node's `fs` and `path` to read/write jobs on disk).
- **Browser-Safe:** All other files in `src/systems/entities3d` are framework-agnostic vanilla TypeScript or React Three Fiber components. They do not reference Node APIs and run directly in the browser.

---

## Assets and Public References

Entity Studio interacts with multiple external assets served relative to `import.meta.env.BASE_URL`:

1. **Licensed Base Meshes (`public/references/basemesh/`):**
   - *Static GLBs:* `lowpoly-female.glb`, `lowpoly-male.glb`, `lowpoly-nogender.glb`, `stylized-figure-a.glb`, `stylized-figure-b.glb`, `stylized-head-kit.glb`, `hand-pro.glb`.
   - *Rigged GLBs (`*.rigged.glb`):* Extends meshes with a 39-bone biped skeleton.
   - *Pack-Rigged GLBs (`*.packrig.glb`):* Pre-rigged with the 66-joint armature to run clip animations natively.
   - *Landmarks Data (`*.landmarks.json`):* Coordinate files specifying key skeleton joint pivots.
   - *Original Model Packs (`original/`):* `lowpoly-2026.glb`, `stylized-basemesh.glb`.
2. **PBR Texture Maps (`public/img2threejs-earth/material-evidence/`):**
   - Used by the vendored img2threejs Earth Golem model.
   - Includes PBR albedo, AO, height, normal, and roughness maps for body rock, recessed seams, and crystal crown.
3. **Mocap Animations (`public/anim/humanoid/`):**
   - `human-base-animations.glb`: CC0 biped clips (Idle, Walk, victory, victory fist pump, Victory, Yes, victory fist pump, Victory, Yes, etc.).
4. **Hero Pipeline Output (`public/creatures3d/hero/`):**
   - User uploads and ML pipeline output: `fix00000/reference.png`, `fix00000/master.glb`, `fix00000/hero.glb` (optimized mesh), `fix00000/hero.json`.
5. **Approved Creature Plans Database (`src/data/creatures3d/plans/`):**
   - JSON creature plans compiled by the text-to-creature planner and approved by developer review (e.g. `barrow-wisp-fix00007.json`, `gelatinous-cube-fix00005.json`).

---

## Generated Artifacts and License/CREDITS Obligations

All third-party assets utilized within the Entity Studio boundaries are licensed under CC-BY 4.0 or Apache 2.0. These obligations are tracked in `CREDITS.md` and `src/data/credits.ts`:

1. **"Low Poly Hand" by ronildo.facanha (Sketchfab) - CC-BY 4.0**
   - *Use:* Baked into the humanoid hand mesh `src/systems/entities3d/three/referenceHandMesh.ts` by `tools/entities3d/bakeReferenceHand.mjs`.
2. **"Lowpoly Basemeshes - 2026 - FBX" by Peter_Seifert (Sketchfab) - CC-BY 4.0**
   - *Use:* Split into standalone body meshes under `public/references/basemesh/lowpoly-*.glb` for Part Lab.
3. **"Free Stylized Basemesh for Blender Sculpting" by dacancino (Sketchfab) - CC-BY 4.0**
   - *Use:* Split into figure and head-kit models under `public/references/basemesh/stylized-*.glb` for Part Lab.
4. **"Hand animation test" by GabrielNeias (Sketchfab) - CC-BY 4.0**
   - *Use:* Served as `public/references/basemesh/hand-pro.glb` as a rigging ground-truth reference model.
5. **"Earth Golem, Crystal Crown" by mohamedachrefelouafi (img2threejs) - Apache 2.0**
   - *Use:* Reference model inside `src/systems/entities3d/vendor/img2threejs/createEarthGolemModel.ts`.

---

## Node/Dev-only APIs, Scripts, and Package Dependencies

The dev server and tooling pipeline utilize specialized Node scripts, Blender integrations, and ML client libraries.

### 1. DevServer API Plugins (`scripts/vite-plugins/devhub/`)
Vite registers these plugins locally to serve the preview dashboards:
- `creaturePlanRoutes.ts`: Hooks up creature plan generation, listing, and approval.
- `heroLabRoutes.ts`: Orchestrates TRELLIS jobs, watches extraction state, and promotes candidate GLBs.
- `partLabRoutes.ts`: Loads/saves landmarks and calls Blender re-rigging tasks.

### 2. Local CLI Scripts (`tools/entities3d/` & `tools/creatureHero/`)
- `tools/entities3d/splitBaseMeshes.mjs`: Splits downloaded Sketchfab basemesh packs into individual components.
- `tools/entities3d/rigBaseMeshes.mjs`: Spawns background Blender processes to bind biped skeletons and pack-rig armatures.
- `tools/entities3d/bakeReferenceHand.mjs`: Bakes low-poly hand geometries into JSON meshes.
- `tools/entities3d/centerlineFit.mjs`: Fits joint locations against bone centerlines.
- `tools/blender/rig_basemesh.py`: Blender python script that applies bone-heat skin weights to body meshes.
- `tools/blender/tpose_basemesh.py`: Blender script that bakes arms-down meshes into T-poses.
- `tools/creatureHero/convert.py` / `convert.mjs`: Connects to `microsoft/TRELLIS.2` Space via Gradio client to process images.
- `tools/creatureHero/optimize.mjs`: Decimates raw generated meshes to fit the 30k polygon budget using `gltf-transform`.

### 3. Package Dependencies (`package.json`)
- **Dev-Only Packages:**
  - `@gradio/client` (interfaces with Hugging Face Space endpoints)
  - `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions` (glTF manipulation)
  - `meshoptimizer` (mesh simplification algorithms)
  - `@playwright/test` / `playwright` (headless browser captures)

---

## Protected Gameplay Consumers and Adapters

A key constraint of the Entity Studio architecture is that **no gameplay modules should depend on Design Preview steps**, but gameplay rendering **must depend on the core entities3d engine**. The following gameplay domains are **protected consumers** that must remain compatible and untouched during any carve-out:

### 1. Battle Map Character Rendering
- **Main Consumer:** `src/components/BattleMap/characters/characterActor/CharacterActor.tsx`
- **Mesh Viewport:** `src/components/BattleMap/characters/characterActor/EntityModel.tsx`
- **Adapter:** `src/systems/entities3d/recipeFromCombatant.ts`
  - Adapts `CombatCharacter` model values (names, tags, creatureTypes, size) to an `EntityRecipe`.
  - Directly queries `src/systems/entities3d/library/acceptedEntities` to check if a hand-approved creature layout wins priority over generic procedurals.

### 2. World3D Player/Occupant Rendering
- **Player Avatar:** `src/components/World3D/PlayerAvatar.tsx` (Renders the controlled player character using biped rigs).
- **Occupant Figures:** `src/components/World3D/OccupantFigure.tsx` (Renders villagers inside buildings).
- **NPC Scene Cast:** `src/components/World3D/SceneCast.tsx` (Renders casting spell effects or scene participants).
- **Demo & Wrapper shells:** `src/components/World3D/World3DDemo.tsx` & `World3DWrapper.tsx`.
- **Adapters:**
  - `src/systems/entities3d/recipeFromCharacter.ts`: Adapts `PlayerCharacter` or `RichNPC` equipped-items slots to an `EntityRecipe` with gear overrides.
  - `src/systems/entities3d/recipeFromOccupant.ts`: Adapts interior household members (`OccupantIdentity`) deterministically based on ancestry group.

---

## Classification Matrix and Standalone-Copy Boundaries

During sequential carve-out tasks (T2-T5), the files and directories must be classified as follows:

| Path | Primary Category | Standalone Candidate? | Rationale |
|---|---|---|---|
| `src/components/DesignPreview/steps/PreviewEntityForge.tsx` | Browser-Safe / UI | **Yes (Copy)** | Core Entity Studio authoring screen. |
| `src/components/DesignPreview/steps/EntityForgeScene.tsx` | Browser-Safe / UI | **Yes (Copy)** | Three.js view port for Entity Forge. |
| `src/components/DesignPreview/steps/PreviewEntityDebug.tsx` | Browser-Safe / UI | **Yes (Copy)** | Instrumentation dashboard UI. |
| `src/components/DesignPreview/steps/EntityDebugScene.tsx` | Browser-Safe / UI | **Yes (Copy)** | Three.js view port for debugger. |
| `src/components/DesignPreview/steps/PreviewPartLab.tsx` | Browser-Safe / UI | **Yes (Copy)** | Slot-quality review panel UI. |
| `src/components/DesignPreview/steps/PartLabScene.tsx` | Browser-Safe / UI | **Yes (Copy)** | Three.js view port for Part Lab. |
| `src/components/DesignPreview/steps/PreviewHeroLab.tsx` | Browser-Safe / UI | **Yes (Copy)** | TRELLIS image-to-3D generator UI. |
| `src/systems/entities3d/three/` (excluding adapters) | Browser-Safe / Engine | **Yes (Copy)** | Assembles skeletal meshes, gaits, toon materials. |
| `src/systems/entities3d/parts/` | Browser-Safe / Engine | **Yes (Copy)** | Standard catalog of procedural meshes. |
| `src/systems/entities3d/textPlan/` | Browser-Safe / Engine | **Yes (Copy)** | Text parser and validator. |
| `src/systems/entities3d/library/acceptedEntities.ts` | Browser-Safe / Engine | **No** | Aralia game-specific plan compilation bundler. |
| `src/systems/entities3d/library/heroStore.ts` | Node/Dev-only | **Yes (Copy)** | Crucial local file manager for jobs. |
| `src/systems/entities3d/recipeFromCombatant.ts` | Game-only Adapter | **No** | Protected gameplay adapter. |
| `src/systems/entities3d/recipeFromCharacter.ts` | Game-only Adapter | **No** | Protected gameplay adapter. |
| `src/systems/entities3d/recipeFromOccupant.ts` | Game-only Adapter | **No** | Protected gameplay adapter. |
| `src/components/BattleMap/` | Game-only Consumer | **No** | Core gameplay combat renderer. |
| `src/components/World3D/` (excluding previews) | Game-only Consumer | **No** | Core gameplay exploration renderer. |
| `public/references/basemesh/` | Static Asset | **Yes (Copy)** | Catalog models, rigs, and landmarks. |
| `public/img2threejs-earth/` | Static Asset | **Yes (Copy)** | Earth Golem PBR textures. |
| `tools/entities3d/` | Node/Dev-only Script | **Yes (Copy)** | Rigger, splitter, and baker scripts. |
| `tools/creatureHero/` | Node/Dev-only Script | **Yes (Copy)** | Hugging Face conversion & mesh optimizer. |
| `tools/blender/` | Python Script | **Yes (Copy)** | Blender skinning automations. |
| `scripts/vite-plugins/devhub/` (selected routes) | Node/Dev-only API | **Yes (Copy)** | Backend API handlers for plans and rigs. |

---

## Explicit Uncertainties

1. **Host Blender LTS Environment Variable Requirement:** The background rigging script (`rigBaseMeshes.mjs`) automatically scans default C:-G: program folders. However, custom non-standard developer environments must manually set `BLENDER_EXE`. Standalone bootstrap scripts should verify and report Blender status during setup.
2. **Hosted Hugging Face Space Liveness:** The `convert.py`/`convert.mjs` tools connect to the public `microsoft/TRELLIS.2` Space. Standalone setups rely on remote service liveness and free API quota availability.
3. **Vite Dynamic Import Watcher restarts:** Unpacking code from Design Preview into a standalone repository must ensure the Vite dev server's file watcher doesn't cause recursive restarts when editing plans (previously resolved by WF-G63).
