# Character Atelier

An interactive local recreation inspired by the [BG3 character creator video](https://www.youtube.com/watch?v=3cnYcEh0J5o), with real skinned GLB models assembled in Blender. The anatomical and clothing likeness remains approximate; the complete origin/species roster is tracked in [GAPS.md](../../docs/projects/character-atelier/GAPS.md).

## Run

From the Aralia root:

```powershell
npx.cmd vite --config scripts/character-atelier/vite.config.ts
```

Open `http://127.0.0.1:4178/Aralia/misc/character-atelier.html`.

The isolated Vite config starts this page without Aralia's operator-side services. It uses the repository's existing React, Three.js, Drei and Lucide dependencies. Class descriptions and existing icon assets are reused from Aralia. No additional npm packages are required. The page exports a JSON sheet; it does not create a game character or modify saves.

## Model sources

The reusable builder is `build_characters.py`. Blender 5.2 was verified at `F:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.

Inputs downloaded for this build:

- [MPFB source](https://github.com/makehumancommunity/mpfb2), MakeHuman's Blender human generator. Extract the source archive to `.agent/scratch/bg3-reference/mpfb-source/mpfb2-master`.
- [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html), the CC0 core skin, eyes, brows, lashes, teeth, hair, and shoe assets. Extract the asset pack to `.agent/scratch/bg3-reference/makehuman-assets`.
- The MakeHuman anatomical base and bundled targets are provided with MPFB. See the [MakeHuman asset license](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md).
- The woodland clearing was generated specifically for this recreation. It is an original raster background, not a frame extracted from the video.
- `public/assets/character-atelier/tabard-albedo.png` was made with the built-in image-generation tool and applied to the garment's own UV coordinates. The exact final prompt is preserved in [texture-prompt.txt](texture-prompt.txt).
- Garment meshes, piping, embroidery, shoulder plates, buckles and portable normal textures are authored in the builder. These are new approximations, not extracted Larian models.

With those inputs installed:

```powershell
& 'F:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python scripts\character-atelier\build_characters.py -- --variant high-elf
```

Other variants: `wood-elf`, `human`, `half-elf`, `drow`, `dwarf`, `halfling`, `gnome`, `tiefling`, `half-orc`, `githyanki`, `dragonborn`, `aasimar`, `goliath`. The fourteen recipes live in `src/devtools/characterAtelier/races.json`, shared by Blender and the picker. The three small folk use shortened legs and torsos with matching rest-bone deformation; the renderer preserves their relative stature and frames portraits by ancestry. The ten additions include custom beards, horns, a tail, tusks, reptilian head geometry, celestial inlays and stone markings. These remain approximate visual studies, not reference-identical anatomy. The existing four GLBs are preserved.

After exporting models, run Blender with `--background --python scripts/character-atelier/render_portraits.py` to rebuild the actual-model portraits used in the race picker. Add `-- dwarf tiefling` to render a subset.

Editable `.blend` scenes and GLB reimport render proofs are written to `.agent/scratch/bg3-reference/`. Runtime models are written to `public/assets/character-atelier/`. The script initializes MPFB only in its own Blender process and does not save global Blender preferences.

## Verification

```powershell
npx.cmd vitest run src/devtools/characterAtelier/choices.test.ts --maxWorkers=2
npx.cmd tsc -p scripts/character-atelier/tsconfig.json
python scripts/character-atelier/verify_assets.py
npx.cmd vite build --config scripts/character-atelier/vite.config.ts
```

The focused build writes only to ignored scratch. It omits copying Aralia's enormous public directory; run the source server above for the full local preview. Render captures must remain in ignored scratch. Visual acceptance of the target likeness is still outstanding.

## Skin tattoos and unobstructed inspection

Appearance > Skin offers None / Stone sigil, six ink colors and an opacity slider. The tattoo mask uses the humanoid skin UV layout and is multiplied into a copy of the original albedo, preserving skin detail and the existing normal/roughness response. Goliath defaults to the sigil; its GLB no longer contains raised marking meshes. Dragonborn's separately authored face does not yet share this UV layout. Tattoo settings are included in the exported appearance object. `tattoo_mask.py` regenerates the mask during the Goliath build; `render_portraits.py` applies the default ink to its thumbnail.

Hide UI expands the interactive canvas to the full page. Show UI or Escape restores the same creator selections. Drag and scroll continue to work while panels are hidden.

Additional visual reference: [BG3 race footage](https://www.youtube.com/watch?v=qTShRKRfcy8). Use its on-screen anatomy, skin, hair and wardrobe as visual evidence only; its rankings and spoken opinions are not product requirements.

## Garment fit and Dragonborn surface

The builder fits subdivided shoulder plates to the anatomical surface, smooths open sleeve and boot hems, adds cloth thickness and softer skirt folds, and transfers tabard weights across the body. The waist now uses a wide leather belt with narrow edging. All races use this garment pass; class-specific wardrobes are still a separate gap.

Dragonborn exports fuse the skull, muzzle and brows into continuous skin and omit the hidden human face/eye scaffold. Embedded scale pigment and normal maps cover the head, jaw and neck at a consistent density, with restrained color variation and roughness. Appearance > Skin provides eight scale colors. The anatomy is still an authored approximation; the newly supplied footage around 4:33 shows substantially more detailed facial plates and crests than this model.

For roster rebuilds, add `--skip-preview` to the builder command to skip disposable Cycles proof renders, then run `render_portraits.py` to refresh the picker portraits from the exported models.

`separate_plate_layers.py` gives overlapping shoulder tiers clearance in the exported GLB without changing skeletal weights. The builder calls it automatically; its asset marker prevents repeated displacement. The asset verifier checks that marker alongside the scale textures, removed human-eye scaffold, belt, and existing skeleton/animation contracts.
