READ-ONLY analysis of the Aralia repo (you are in its root). Do NOT modify files.

TASK: In Worldforge ground mode, town streets are nearly invisible — thin dark ribbons that vanish against grass at walking scale.

READ: src/systems/worldforge/bridge/groundChunkLoader.ts (street polylines + widthM), src/components/World3D/World3DScene.tsx (RoadPiece, color #6f5a3e), src/systems/world3d/roadGeometry.ts (ribbon builder).

PROPOSE: a minimal change set to make streets read clearly at walking scale — consider width scaling, a lighter packed-dirt color, or edge treatment; pick what fits the existing pipeline.

OUTPUT FORMAT: short diagnosis, then unified diffs between the markers BEGIN_PROPOSAL and END_PROPOSAL.
