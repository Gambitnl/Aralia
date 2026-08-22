# Credits — third-party assets

Aralia ships these third-party assets. Keep each credit line with the game.
The in-game Credits panel (main menu → Credits) renders `src/data/credits.ts`.
Keep that file in step with this one.

## 3D models

- "Low Poly Hand" by ronildo.facanha (Sketchfab), CC-BY 4.0.
  Source: https://sketchfab.com/3d-models/low-poly-hand-3d-model-19c9ac5c369a468a95f081a3cc2ad4ac
  Use: the humanoid hand mesh of the entity engine
  (`src/systems/entities3d/three/referenceHandMesh.ts`, baked by
  `tools/entities3d/bakeReferenceHand.mjs`). The reference GLB also renders
  in the Entity Debug Part Lab.

## 2D token art

- Caeora painted VTT token packs (forest pack).
  Use: battle-map ground sprites (`src/components/BattleMap/spritePacks.ts`).

- "Lowpoly Basemeshes - 2026 - FBX" by Seifert (Peter_Seifert, Sketchfab), CC-BY 4.0.
  Source: https://sketchfab.com/3d-models/lowpoly-basemeshes-2026-fbx-514ca15af30446ebbacbb56628e26744
  Use: whole-body options in the Part Lab (design.html?step=partlab), split
  per model into public/references/basemesh/lowpoly-*.glb by
  tools/entities3d/splitBaseMeshes.mjs. Not a game asset.
- "Free Stylized Basemesh for Blender Sculpting" by dacancino (Sketchfab), CC-BY 4.0.
  Source: https://sketchfab.com/3d-models/free-stylized-basemesh-for-blender-sculpting-fc45334ab9fd4f24acb91eb7e17222b3
  Use: whole-body and head-kit options in the Part Lab, split into
  public/references/basemesh/stylized-*.glb by the same script. Not a game asset.
