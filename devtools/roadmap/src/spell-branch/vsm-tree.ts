// devtools/roadmap/src/spell-branch/vsm-tree.ts
import type { SpellComponents, ComponentCombination } from './types';

/**
 * Maps the three component booleans to a named combination.
 * This is the value stored in the Requirements axis.
 *
 * Tree navigation in the UI (Verbal → Somatic → Material) is purely visual —
 * the underlying data uses these seven flat names.
 */
export function resolveComponentCombination(
  c: SpellComponents
): ComponentCombination {
  if (c.verbal && c.somatic && c.material) return 'verbal-somatic-material';
  if (c.verbal && c.somatic) return 'verbal-somatic';
  if (c.verbal && c.material) return 'verbal-material';
  if (c.somatic && c.material) return 'somatic-material';
  if (c.verbal) return 'verbal-only';
  if (c.somatic) return 'somatic-only';
  return 'material-only';
}

/**
 * Human-readable labels for each combination.
 * Used in the UI tree navigator to label axis values.
 */
export const VSM_COMBINATION_LABELS: Record<ComponentCombination, string> = {
  'verbal-only': 'Verbal only (V)',
  'somatic-only': 'Somatic only (S)',
  'material-only': 'Material only (M)',
  'verbal-somatic': 'Verbal + Somatic (V+S)',
  'verbal-material': 'Verbal + Material (V+M)',
  'somatic-material': 'Somatic + Material (S+M)',
  'verbal-somatic-material': 'Verbal + Somatic + Material (V+S+M)',
};

/**
 * The V/S/M tree structure used by the UI navigator.
 * Each node in the tree maps to a component combination at its leaves.
 * Dead-end paths (combinations not present in the current spell set)
 * are pruned at render time — not here.
 */
export const VSM_TREE = [
  {
    label: 'Verbal',
    children: [
      {
        label: '(+) Somatic',
        children: [
          { label: '(+) Material', combination: 'verbal-somatic-material' as ComponentCombination },
          { label: 'None', combination: 'verbal-somatic' as ComponentCombination },
        ],
      },
      { label: '(+) Material', combination: 'verbal-material' as ComponentCombination },
      { label: 'None', combination: 'verbal-only' as ComponentCombination },
    ],
  },
  {
    label: 'Somatic (no Verbal)',
    children: [
      { label: '(+) Material', combination: 'somatic-material' as ComponentCombination },
      { label: 'None', combination: 'somatic-only' as ComponentCombination },
    ],
  },
  { label: 'Material only', combination: 'material-only' as ComponentCombination },
] as const;
