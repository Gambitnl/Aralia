/**
 * @file hooks/combat/actionExecutor/flowContextTypes.ts
 * The hook values each effectful action-executor flow reads (C2, agora-9ed9.2).
 * Field names match useActionExecutor's own names, so the moved flow bodies
 * read them unchanged. Every import here is type-only, so there is no runtime
 * import cycle with the hook.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:43
 * Dependents: hooks/combat/actionExecutor/moveExecutionFlow.ts, hooks/combat/actionExecutor/opportunityAttackFlow.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MutableRefObject } from 'react';
import type { CombatAction, CombatCharacter, CombatState } from '../../../types/combat';
import type { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import type { UseActionExecutorProps } from '../useActionExecutor';
import type { runOpportunityAttackFlow } from './opportunityAttackFlow';

type Props = UseActionExecutorProps;
type DropContext<T> = T extends (ctx: never, ...rest: infer R) => infer Out ? (...rest: R) => Out : never;

export interface OpportunityAttackFlowContext extends Pick<Props,
  'addDamageNumber' | 'characters' | 'executeReactionSpell' | 'mapData' | 'onCharacterUpdate' | 'onLogEntry' | 'requestReaction' | 'turnState'> {
  buildRiderState: (roster: CombatCharacter[]) => CombatState;
  resolveOnTargetAttackReactiveEffects: (
    action: CombatAction,
    attackingCharacter: CombatCharacter,
    targetId: string,
    resolvedAttackResult: NonNullable<CombatAction['attackResults']>[number] | undefined,
  ) => void;
}

export interface MoveExecutionFlowContext extends Pick<Props,
  'addDamageNumber' | 'characters' | 'handleDamage' | 'movementDebuffs' | 'onLogEntry' | 'processTileEffects'
  | 'setMovementDebuffs' | 'setSpellZones' | 'spellZones' | 'turnState'> {
  /** Passed as the ref object, so `.current` is still read at the moment of use. */
  areaEffectTrackerRef: MutableRefObject<AreaEffectTracker>;
  handleOpportunityAttacks: DropContext<typeof runOpportunityAttackFlow>;
}
