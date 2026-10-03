/**
 * @file pendingJudgments.ts — the queue of things that need Remy's eye.
 *
 * This is data, not code. Add a subject when you build something whose success
 * only a person can confirm. Remove nothing: a judged subject keeps its verdict
 * so the reasoning survives, and re-appears by itself if its sources move.
 *
 * The rule for adding one: could a test decide this? If yes, write the test
 * instead. This queue is only for the questions a measurement cannot answer.
 */
import type { JudgmentSubject } from './verdicts';

export const PENDING_JUDGMENTS: readonly JudgmentSubject[] = [
  {
    id: 'understory-fern-shape',
    title: 'Fern shape on the forest floor',
    question: 'Does a fern read as a fern from 3 to 5 m?',
    surface: 'judge?subject=understory-fern-shape',
    against: 'The version before, which read as a small dark arrowhead',
    sources: [
      'src/systems/worldforge/vegetation/understoryMeshSource.ts',
      'src/components/World3D/vegetation/UnderstoryField.tsx',
    ],
    whyHuman:
      'Measurement said the first two versions were correct and both looked wrong. '
      + 'Aspect ratio went 4.8:1 to 1.7:1, which is a number, not a fern.',
  },
  {
    id: 'tree-trunk-value',
    title: 'Tree trunks and canopy at walking range',
    question: 'Do trunks read as wood, and does the crown hold together up close?',
    surface: 'judge?subject=tree-trunk-value',
    against: 'Before: trunks measured green-dominant and read as black holes',
    sources: [
      'src/systems/worldforge/vegetation/ezTreeMeshSource.ts',
      'src/components/World3D/vegetation/VegetationTreeField.tsx',
    ],
    whyHuman:
      'The hue reversal is measurable and already proven. Whether the near crown '
      + 'still shards when the camera sits inside it is not.',
  },
  {
    id: 'forest-floor-color',
    title: 'Forest floor against open land',
    question: 'Does the forest floor read as leaf litter, and does grassland stay green?',
    surface: 'judge?subject=forest-floor-color',
    against: 'Open savanna in the same light, as the control',
    sources: [
      'src/systems/world3d/terrainColor.ts',
      'src/systems/worldforge/bridge/groundWorldAdapter.ts',
      'src/components/World3D/World3DLighting.tsx',
    ],
    whyHuman:
      'Two changes landed on the same pixels: a darker forest palette and a '
      + 'warmer sun. The numbers moved correctly and can still look wrong together.',
  },
  {
    id: 'water-shoreline',
    title: 'Water edge, and water seen from below',
    question: 'Does the bank read as water meeting land rather than as paint?',
    surface: 'judge?subject=water-shoreline',
    against: 'Before: one flat blue with a razor edge, invisible from underneath',
    sources: [
      'src/systems/world3d/waterGeometry.ts',
      'src/components/World3D/water/waterSurfaceMaterial.ts',
    ],
    whyHuman:
      'The shallow opacity constant was set at dusk and never checked in daylight. '
      + 'No under-surface frame has ever been captured.',
  },
  {
    id: 'terrain-surface-noise',
    title: 'Material seams and close-range ground',
    question: 'Are the boundaries ragged now, and does the ground stop reading as plastic?',
    surface: 'judge?subject=terrain-surface-noise',
    against: 'Before: per-channel variation measured 0.25 percent — a flat plane',
    sources: [
      'src/components/World3D/terrain/terrainSurfaceNoise.ts',
      'src/components/World3D/World3DScene.tsx',
    ],
    whyHuman:
      'The author suspects the amplitude is too low and could not get a matched '
      + 'close-range capture. This one is genuinely unproven.',
  },
  {
    id: 'rock-scale',
    title: 'Stone size against trees and ferns',
    question: 'Do rocks read as stone at a believable size?',
    surface: 'judge?subject=rock-scale',
    against: 'Trees measured at 17 to 19 m in the same window',
    sources: ['src/components/World3D/GroundProps.tsx'],
    whyHuman:
      'Stone width dropped from 2.02 m to 0.87 m median. Whether that reads as '
      + 'knee-high rock or as gravel is a look, not a measurement.',
  },
  {
    id: 'bush-palette',
    title: 'Bushes against the canopy and the understory',
    question: 'Do bushes sit below the canopy in value, and are they a believable size?',
    surface: 'judge?subject=bush-palette',
    against: 'The tree canopy above them and the understory beside them',
    sources: ['src/systems/worldforge/bridge/groundChunkLoader.ts'],
    whyHuman:
      'These are the green blobs Remy reported as painted rocks. The palette is '
      + 'brighter than the canopy and the scale reaches 4.05 m. Not yet fixed.',
  },
];
