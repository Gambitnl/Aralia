# Findings — World3D ground mode

Orchestrator notes for builders and for the world3d-ground critic. Kept separate from
`targets/world3d-ground.md` because the critic owns that file.

Each item below is a diagnosis with the measurement behind it, so nobody re-derives it or
"fixes" something that is deliberate.

---

## 1. The renderer is under-wired, not under-equipped

These are ALREADY in `package.json` and largely unused in the streamed world:

- `n8ao` — ambient occlusion (now wired, 2026-07-30)
- `@react-three/postprocessing` + `postprocessing` — effect chain
- `@takram/three-atmosphere` — physically based sky and **aerial perspective**
- `@takram/three-clouds` — cloud layer

Targets for aerial perspective and sky/sun/clouds are therefore **wiring jobs against
libraries we already ship**. No builder should propose adding a dependency for them.

`BattleMap3D.tsx` already runs a full N8AO + Bloom + ToneMapping + Vignette chain. Copy that
pattern rather than inventing one, and keep both of its recorded lessons:

- Use **N8AO**, not `postprocessing`'s `SSAOEffect`. SSAO needs `enableNormalPass`, and
  under WebGL2 with three r172 + `@react-three/postprocessing` 3.x that fires
  `GL_INVALID_OPERATION: Read and write depth stencil attachments cannot be the same image`
  every frame. N8AO reconstructs normals from depth, so it needs no NormalPass.
- **`ToneMapping` must be in the chain.** While `EffectComposer` is mounted it sets
  `gl.toneMapping = NoToneMapping`, silently disabling the `ACESFilmicToneMapping` set on
  the Canvas. Omitting it makes the surface read as raw, uncomposited 3D.

## 2. AO radius does not port between cameras

`aoRadius` is in world metres, so it must be re-measured per camera distance.

| aoRadius | Result on `wilds-ancient-forest` |
|---|---|
| 1.8 (BattleMap3D's value) | **No visible darkening at all** |
| 5 | Too faint to seat anything |
| 7 | Trunks, rocks and grass all read as seated — chosen |
| 8 | Grounds everything but muddies the ground cover |

Why 1.8 fails here: the exploration camera looks across ~100 m, and at `halfRes` that radius
falls inside a pixel. Any new surface with a different camera must measure, not copy.

## 3. Fog cannot serve both the near field and the far shells — do NOT just shrink fogFar

This is the trap on target #7 (aerial perspective).

Measured:

- `GROUND_FOG_NEAR = 600`, `GROUND_FOG_FAR = 15000` (`canopyInterior.ts:39-40`)
- Streamed world: `CHUNK_WORLD_SIZE = 128`, `LOAD_RADIUS = 4` → about **9 chunks ≈ 1,150 m
  across**, so the farthest visible streamed terrain sits roughly **500–600 m** from camera
- Far shells: `HORIZON_HALF_M = 20000` (`farShells.ts:75`) → the horizon reaches **20 km**

So fog begins at 600 m, which is at or past the far edge of the streamed chunks. **It never
engages on terrain the player actually looks at.** That is exactly why distant ground carries
the same tone as the foreground.

The tempting fix — pull `fogFar` in — would break the far-distance shells, whose whole
purpose is that the world edge is no longer visible. `fogFar: 15000` is doing that job
correctly.

Nor does a single `FogExp2` solve it. Tuned to give visible haze by 500 m (density ≈ 0.0008)
it reaches full opacity by about 5 km, which erases the 5–20 km mountain silhouettes. Linear
fog over a 15 km range gives only ~2% at 500 m — invisible. One fog curve cannot do both.

**Recommended route:** leave `scene.fog` to the shells, and get near-field aerial perspective
from a depth-aware pass instead. `@takram/three-atmosphere` implements real aerial
perspective and is already installed; an `EffectComposer` now exists in `World3DScene` to
hang it on. Failing that, a custom two-term fog in the terrain material.

## 4. Water: the material is fine, its environment is missing

`water/waterSurfaceMaterial.ts` already sets a scrolling ripple normal map, `roughness` 0.12,
`metalness` 0.25, `opacity` 0.92. Two specific reasons it still reads as flat paint:

1. **`metalness: 0.25` with no environment map.** A metallic surface reflects its
   surroundings and this scene provides none, so metalness only darkens. The scene does have
   a Preetham `Sky` dome — PMREM that into an environment and the sky becomes the reflector,
   which is physically the right answer for open water.
2. **No depth information.** Depth-tinted transparency and a soft shoreline both need the
   scene depth buffer. A constant-opacity quad can express neither, which is why the land
   edge is a hard straight line.

**Do not delete the `emissive` term to flatten-fix this.** It reads as wrong but the code
records it as a measured fix: without it, a lit-only water surface went grey at low sun.
Changing it requires re-measuring at dusk as well as midday.

## 5. Terrain facets are a style decision, not a defect

`World3DScene` sets `flatShading` explicitly on the terrain material. The visible triangles
are intentional low-poly styling.

Matching BG3 means **reversing a deliberate art direction for the whole game**, not fixing an
oversight. That is a call for Remy, and it should be raised as a direction question rather
than silently "fixed" by a builder. Flagged 2026-07-30; undecided.

Related: the terrain material takes `map={tex}` from `ForgeAssetContext`. Whether a ground
texture actually resolves in the captured scenarios is unverified — worth checking before
concluding the terrain is untexturable.
