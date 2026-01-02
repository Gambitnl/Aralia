/**
 * @file src/utils/entityIntegrationUtils.ts
 * Shared utility for integrating EntityResolverService with the game state.
 * Handles the "Scan Text -> Resolve -> Register in Redux" loop.
 */

import type { Dispatch } from 'react';
import { GameState, Location, Faction, NPC } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { EntityResolverService } from '../../services/EntityResolverService';
import { AddGeminiLogFn } from '../../hooks/actions/actionHandlerTypes';

/**
 * Service Integration:
 * Scans the provided text for entity references, ensures they exist (creating stubs if needed),
 * and dispatches actions to register any newly created entities into the game state.
 *
 * @param text The narrative text to scan (e.g. from AI).
 * @param gameState Current game state.
 * @param dispatch Redux dispatch function.
 * @param addGeminiLog Function to log AI/System events.
 */
export async function resolveAndRegisterEntities(
  text: string,
  gameState: GameState,
  dispatch: Dispatch<AppAction>,
  addGeminiLog: AddGeminiLogFn
): Promise<void> {
  try {
    const entitiesToResolve = EntityResolverService.resolveEntitiesInText(text, gameState);

    for (const ref of entitiesToResolve) {
      // Ensure they exist (create stubs if needed)
      const result = await EntityResolverService.ensureEntityExists(ref.type, ref.normalizedName, gameState);

      if (result.created && result.entity) {
        // Register the new entity in the state
        switch (result.type) {
          case 'location':
            dispatch({
              type: 'REGISTER_DYNAMIC_ENTITY',
              payload: { entityType: 'location', entity: result.entity as Location }
            });
            break;
          case 'faction':
            dispatch({
              type: 'REGISTER_DYNAMIC_ENTITY',
              payload: { entityType: 'faction', entity: result.entity as Faction }
            });
            break;
          case 'npc':
            dispatch({
              type: 'REGISTER_DYNAMIC_ENTITY',
              payload: { entityType: 'npc', entity: result.entity as NPC }
            });
            break;
        }

        addGeminiLog(
          'EntityResolver',
          `Created new ${result.type}: ${ref.normalizedName}`,
          JSON.stringify(result.entity)
        );
      }
    }
  } catch (error) {
    console.error("Entity Resolution Error:", error);
    // We swallow the error to prevent blocking the main game flow,
    // but we log it.
  }
}
