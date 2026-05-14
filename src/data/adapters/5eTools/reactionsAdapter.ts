// Parses the `reaction` array from a 5eTools monster JSON into Aralia Ability objects.

import { Ability } from '../../../types/combat';
import { parse5eToolsAction } from './actionsAdapter';

export function parseReactions(reactions: any[] | undefined): Ability[] {
  if (!reactions) return [];
  return reactions.flatMap(r => {
    const ability = parse5eToolsAction(r, 'reaction');
    return ability ? [ability] : [];
  });
}
