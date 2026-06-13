READ-ONLY analysis of the Aralia repo (you are in its root). Do NOT modify files.

TASK: In Worldforge ground mode all vegetation renders as identical dark cones. Instancing: src/components/World3D/World3DScene.tsx VegetationPiece consumes buildGroundVegetation from src/systems/worldforge/bridge/groundChunkLoader.ts; artifact features carry kind (tree/bush) and numeric ids.

PROPOSE: deterministic variety — 2-3 shape/color variants, size distribution by id hash, bushes visually distinct from trees. Constraint: stay instanced-friendly (one instanced mesh today; propose per-kind instanced meshes or per-instance color attributes, whichever fits).

OUTPUT FORMAT: short diagnosis, then unified diffs between the markers BEGIN_PROPOSAL and END_PROPOSAL.
