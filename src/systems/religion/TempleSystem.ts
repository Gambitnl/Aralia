// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 06:13:08
 * Dependents: systems/religion/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Dispatch } from 'react';
import {
  TempleService,
  TempleServiceLegacyEffect,
  TempleStructuredEffect,
  GameState
} from '../../types';
import { AppAction } from '../../state/actionTypes';
import { canAffordService, getDivineStanding } from '../../utils/religionUtils';
import { logger } from '../../utils/logger';
import { generateId } from '../../utils/core/idGenerator';

export interface ServiceResult {
  success: boolean;
  message: string;
  effectApplied?: string;
  costDeducted?: number;
}

type TempleEffectContext = {
  service: TempleService;
  gameState: GameState;
  deityId: string;
  dispatch: Dispatch<AppAction>;
};

type TempleLegacyExactEffect = Exclude<
  TempleServiceLegacyEffect,
  | `grant_blessing_${string}`
  | `grant_favor_${string}`
  | `restore_hp_${string}`
  | `remove_condition_${string}`
  | `Spell: ${string}`
>;

type TempleEffectResolution = {
  message: string;
};

/**
 * Legacy service strings still need a narrow compatibility map so seeded temple
 * data and older saves keep working while the structured effect branch becomes
 * explicit about what is and is not a heal.
 */
const LEGACY_TEMPLE_EFFECT_HANDLERS: Record<
  TempleLegacyExactEffect,
  (context: TempleEffectContext) => TempleEffectResolution
> = {
  grant_blessing_minor: ({ dispatch }) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: generateId(),
        type: 'success',
        message: 'You feel a warm presence. (Minor Blessing granted)'
      }
    });
    return { message: 'You have been blessed.' };
  },
  heal_20_hp: ({ gameState, dispatch }) => {
    // Preserve the existing healing behavior for the legacy temple seed.
    gameState.party.forEach(char => {
      dispatch({
        type: 'HEAL_CHARACTER',
        payload: { characterId: char.id, amount: 20 }
      });
    });
    return { message: 'The divine light heals your wounds.' };
  },
  remove_curse: ({ dispatch }) => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: generateId(),
        type: 'info',
        message: 'A cleansing wave washes over you.'
      }
    });
    return { message: 'You feel a heavy burden lift.' };
  },
  'Divine Intervention': () => ({
    message: 'The deity acknowledges your plea. (Narrative Event Triggered)'
  }),
  'Prevent Undeath': () => ({
    message: 'The rite shields the dead from rising again.'
  })
};

/**
 * Structured service effects are handled by their discriminant, not by a
 * "heal-first" fallback. That keeps future temple services from inheriting the
 * wrong behavior just because they are object-shaped.
 */
const resolveStructuredTempleEffect = (
  effect: TempleStructuredEffect,
  context: TempleEffectContext
): TempleEffectResolution => {
  const { dispatch, gameState } = context;

  switch (effect.type) {
    case 'heal': {
      const amount = effect.value || 10;
      gameState.party.forEach(char => {
        dispatch({
          type: 'HEAL_CHARACTER',
          payload: { characterId: char.id, amount }
        });
      });
      return { message: effect.description || `Party healed for ${amount} HP.` };
    }

    case 'buff': {
      const message = effect.description || 'A protective blessing settles over the party.';
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: generateId(),
          type: 'info',
          message
        }
      });
      return { message };
    }

    case 'cure': {
      const message = effect.description || 'A cleansing rite washes away afflictions.';
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: generateId(),
          type: 'info',
          message
        }
      });
      return { message };
    }

    case 'identify':
      return {
        message: effect.description || 'The temple reveals the nature of the unknown.'
      };

    case 'quest':
      return {
        message: effect.description || 'A sacred quest is revealed.'
      };

    case 'favor':
      return {
        message: effect.description || 'The deity acknowledges your devotion.'
      };

    case 'restoration': {
      if (effect.subtype === 'heal') {
        const amount = effect.value || 10;
        gameState.party.forEach(char => {
          dispatch({
            type: 'HEAL_CHARACTER',
            payload: { characterId: char.id, amount }
          });
        });
        return {
          message: effect.description || `Party restored for ${amount} HP.`
        };
      }

      const message = effect.description || 'A restorative rite settles over the party.';
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: generateId(),
          type: 'info',
          message
        }
      });
      return { message };
    }
  }

  return { message: 'Service completed.' };
};

const resolveLegacyTempleEffect = (
  effect: TempleServiceLegacyEffect,
  context: TempleEffectContext
): TempleEffectResolution => {
  const { gameState, dispatch } = context;

  if (effect in LEGACY_TEMPLE_EFFECT_HANDLERS) {
    return LEGACY_TEMPLE_EFFECT_HANDLERS[effect as TempleLegacyExactEffect](context);
  }

  if (effect.startsWith('grant_blessing_')) {
    return { message: 'You receive a specific divine blessing.' };
  }

  if (effect.startsWith('grant_favor_')) {
    return { message: 'Your offering is received with favor.' };
  }

  if (effect.startsWith('restore_hp_')) {
    // Procedural village temples use compact restore IDs. Until they receive
    // structured service objects, keep them in the legacy adapter and preserve
    // the intended healing behavior instead of routing them to the unknown path.
    gameState.party.forEach(char => {
      const missingHp = Math.max((char.maxHp ?? char.hp) - char.hp, 0);
      dispatch({
        type: 'HEAL_CHARACTER',
        payload: { characterId: char.id, amount: missingHp }
      });
    });
    return { message: 'The temple restores the party to health.' };
  }

  if (effect.startsWith('remove_condition_')) {
    return { message: 'The temple performs a cleansing rite.' };
  }

  if (effect.startsWith('Spell: ')) {
    return { message: 'The temple channels a sacred spell rite.' };
  }

  logger.warn(`Unknown temple effect string: ${effect}`);
  return { message: 'The ritual concludes.' };
};

/**
 * System to handle Temple interactions, service validation, and effect application.
 */
export class TempleSystem {

  /**
   * Validates if a party/character can request a service.
   */
  static validateServiceRequest(
    service: TempleService,
    gameState: GameState,
    deityId: string
  ): { allowed: boolean; reason?: string } {
    // RALPH: Divine Gatekeeper.
    // Checks both "Material Wealth" (Gold) and "Spiritual Standing" (Favor).
    // Some high-tier services (Resurrection, Greater Blessing) require specific reputation levels (e.g. 'Devoted').

    // 1. Check Gold & Favor (using utility)
    const currentFavor = gameState.divineFavor[deityId]?.score || 0;
    const affordability = canAffordService(service, gameState.gold, currentFavor);

    if (!affordability.allowed) {
      // Enhance the reason if it's about favor
      if (affordability.reason?.includes('favor')) {
        const minFavor = service.minFavor || 0;
        return {
          allowed: false,
          reason: `Requires '${getDivineStanding(minFavor)}' standing with deity (${minFavor} favor).`
        };
      }
      return affordability;
    }

    // 2. Check Complex Requirements (Items, Quests)
    if (service.requirement) {
      // Item cost check
      if (service.requirement.itemCost) {
        const { itemId, count } = service.requirement.itemCost;
        const ownedCount = gameState.inventory.filter(i => i.id === itemId).length;
        const hasItem = ownedCount >= count;
        if (!hasItem) return { allowed: false, reason: `Missing required item offering.` };
      }
      // Quest requirement check would go here
    }

    return { allowed: true };
  }

  /**
   * Performs the service transaction: deducts gold and applies effects.
   */
  static performService(
    service: TempleService,
    gameState: GameState,
    deityId: string,
    dispatch: Dispatch<AppAction>
  ): ServiceResult {
    // Re-validate just in case
    const validation = this.validateServiceRequest(service, gameState, deityId);
    if (!validation.allowed) {
      return { success: false, message: validation.reason || 'Service denied.' };
    }

    // 1. Deduct Gold
    if (service.costGp && service.costGp > 0) {
      dispatch({
        type: 'REMOVE_GOLD',
        payload: service.costGp
      });
    }

    // 2. Apply Effect
    const effectResult = this.resolveServiceEffect(service, gameState, deityId, dispatch);

    // 3. Log/Notify
    logger.info(`Temple Service Performed: ${service.name} (${service.id})`, { deityId, cost: service.costGp });

    // Handle effect logging safely
    let effectLogString: string;
    if (typeof service.effect === 'string') {
      effectLogString = service.effect;
    } else {
      effectLogString = JSON.stringify(service.effect);
    }

    return {
      success: true,
      message: effectResult.message,
      costDeducted: service.costGp,
      effectApplied: effectLogString
    };
  }

  /**
   * Resolves the effect string/object into actual game actions.
   */
  private static resolveServiceEffect(
    service: TempleService,
    gameState: GameState,
    deityId: string,
    dispatch: Dispatch<AppAction>
  ): TempleEffectResolution {
    const effect = service.effect;

    const context: TempleEffectContext = {
      service,
      gameState,
      deityId,
      dispatch
    };

    // Handle string effects (legacy/data stubs) through an adapter so older
    // temple rows stay compatible while the structured path grows independently.
    if (typeof effect === 'string') {
      return resolveLegacyTempleEffect(effect, context);
    }

    // Handle structured effects explicitly so the object path is not heal-only.
    if (typeof effect === 'object') {
      return resolveStructuredTempleEffect(effect, context);
    }

    return { message: 'Service completed.' };
  }
}
