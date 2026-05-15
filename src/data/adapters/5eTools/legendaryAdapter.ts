// Parses the `legendary` array from a 5eTools monster JSON into Aralia Ability objects.
// Action-point costs (e.g. "Costs 2 Actions") are handled centrally by actionsAdapter.ts.

import { Ability } from '../../../types/combat';
import { parse5eToolsAction } from './actionsAdapter';

export function parseLegendaryActions(legendary: any[] | undefined): Ability[] {
  if (!legendary) return [];
  return legendary.flatMap(entry => {
    const ability = parse5eToolsAction(entry, 'legendary');
    return ability ? [ability] : [];
  });
}
