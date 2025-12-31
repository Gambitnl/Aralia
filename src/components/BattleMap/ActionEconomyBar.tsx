/**
 * @file ActionEconomyBar.tsx
 * A component to display the character's current action economy status.
 */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CombatCharacter, CombatAction, AbilityCost } from '../../types/combat';
import Tooltip from '../Tooltip';
import { generateId } from '../../utils/combatUtils';

interface ActionEconomyBarProps {
  character: CombatCharacter;
  onExecuteAction: (action: CombatAction) => boolean;
}

const ActionEconomyBar: React.FC<ActionEconomyBarProps> = ({ character, onExecuteAction }) => {
  const shouldReduceMotion = useReducedMotion();
  const { actionEconomy, concentratingOn } = character;

  const movementPercentage = (actionEconomy.movement.total > 0)
    ? ((actionEconomy.movement.total - actionEconomy.movement.used) / actionEconomy.movement.total) * 100
    : 0;

  const handleSustain = () => {
    if (!concentratingOn?.sustainCost) return;

    // Check type of action needed
    // Assuming simple mapping for now. Trigger cost has type.
    const cost = concentratingOn.sustainCost; // { actionType: ..., optional: ... }

    // Construct AbilityCost-like object for validation (ActionEconomy system expects cost with type)
    // The cost object in CombatAction is AbilityCost.
    // sustainCost in ConcentrationState is { actionType: "..." }. 
    // We need to shape it as AbilityCost: { type: 'action' | 'bonus' | ... }

    const actionCost: AbilityCost = {
      type: cost.actionType === 'bonus_action' ? 'bonus' : cost.actionType
    };

    onExecuteAction({
      id: generateId(),
      type: 'sustain',
      characterId: character.id,
      cost: actionCost,
      timestamp: Date.now()
    });
  };

  const showSustainButton = concentratingOn && concentratingOn.sustainCost && !concentratingOn.sustainedThisTurn;
  const sustainCostLabel = concentratingOn?.sustainCost?.actionType === 'bonus_action' ? 'Bonus Action' : 'Action';

  return (
    <div className="bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 space-y-2">
      <h3 className="text-center text-sm font-bold text-amber-300 mb-2">Actions</h3>

      {/* Action, Bonus, Reaction */}
      <div className="flex justify-around text-center">
        <Tooltip content="Action">
          <div className={`p-1 flex flex-col items-center transition-opacity ${actionEconomy.action.used ? 'opacity-40' : 'opacity-100'}`}>
            <span className="text-2xl" role="img" aria-label="Action">⚔️</span>
            <span className={`text-xs font-bold ${actionEconomy.action.used ? 'text-gray-500 line-through' : 'text-red-400'}`}>Action</span>
          </div>
        </Tooltip>
        <Tooltip content="Bonus Action">
          <div className={`p-1 flex flex-col items-center transition-opacity ${actionEconomy.bonusAction.used ? 'opacity-40' : 'opacity-100'}`}>
            <span className="text-2xl" role="img" aria-label="Bonus Action">⭐</span>
            <span className={`text-xs font-bold ${actionEconomy.bonusAction.used ? 'text-gray-500 line-through' : 'text-yellow-400'}`}>Bonus</span>
          </div>
        </Tooltip>
        <Tooltip content="Reaction">
          <div className={`p-1 flex flex-col items-center transition-opacity ${actionEconomy.reaction.used ? 'opacity-40' : 'opacity-100'}`}>
            <span className="text-2xl" role="img" aria-label="Reaction">🛡️</span>
            <span className={`text-xs font-bold ${actionEconomy.reaction.used ? 'text-gray-500 line-through' : 'text-blue-400'}`}>Reaction</span>
          </div>
        </Tooltip>
        <Tooltip content="Free Object Interaction">
          <div className={`p-1 flex flex-col items-center transition-opacity ${actionEconomy.freeActions <= 0 ? 'opacity-40' : 'opacity-100'}`}>
            <span className="text-2xl" role="img" aria-label="Free Object Interaction">🖐️</span>
            <span className={`text-xs font-bold ${actionEconomy.freeActions <= 0 ? 'text-gray-500 line-through' : 'text-green-400'}`}>Free</span>
          </div>
        </Tooltip>
      </div>

      {/* Sustain Button */}
      {showSustainButton && (
        <div className="pt-2 border-t border-gray-600">
          <motion.button
            onClick={handleSustain}
            whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            className="w-full text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white py-1 px-2 rounded shadow flex items-center justify-center gap-1"
          >
            <span>🔄 Sustain {concentratingOn.spellName}</span>
            <span className="opacity-75">({sustainCostLabel})</span>
          </motion.button>
        </div>
      )}

      {/* Movement */}
      <div className="pt-2">
        <Tooltip content={`Movement: ${actionEconomy.movement.total - actionEconomy.movement.used} / ${actionEconomy.movement.total} ft remaining`}>
          <div>
            <span className="text-xs font-bold text-green-400 text-center block mb-1">Movement</span>
            <div className="w-full bg-gray-600 rounded-full h-4 shadow-inner overflow-hidden relative border border-gray-500">
              <motion.div
                className="bg-green-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${movementPercentage}%` }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
              ></motion.div>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[10px] font-medium text-white drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                  {actionEconomy.movement.total - actionEconomy.movement.used} / {actionEconomy.movement.total}
                </p>
              </div>
            </div>
          </div>
        </Tooltip>
      </div>

    </div>
  );
};

export default ActionEconomyBar;
