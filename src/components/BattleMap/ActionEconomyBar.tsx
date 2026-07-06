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
  onExecuteAction: (action: CombatAction) => boolean | Promise<boolean>;
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

  const econItem = (used: boolean, icon: string, label: string, ariaLabel: string, remaining: string, color: string) => (
    <div className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-slate-700/70 bg-slate-800/60 py-1.5 transition-opacity ${used ? 'opacity-40' : 'opacity-100'}`}>
      <span className="text-xl leading-none" role="img" aria-label={ariaLabel}>{icon}</span>
      <span className={`text-[10px] font-bold uppercase tracking-wide ${used ? 'text-slate-500 line-through' : color}`}>{label}</span>
      <span className="text-[9px] font-semibold text-slate-400">{remaining}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-amber-900/40 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm p-3 space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400/90 mb-2">Actions</h3>

      {/* Action, Bonus, Reaction, Free */}
      <div className="flex gap-1.5 text-center">
        <Tooltip content="Action">{econItem(actionEconomy.action.used, '⚔', 'Action', 'Action', actionEconomy.action.used ? '0/1' : '1/1', 'text-rose-300')}</Tooltip>
        <Tooltip content="Bonus Action">{econItem(actionEconomy.bonusAction.used, '★', 'Bonus', 'Bonus Action', actionEconomy.bonusAction.used ? '0/1' : '1/1', 'text-amber-300')}</Tooltip>
        <Tooltip content="Reaction">{econItem(actionEconomy.reaction.used, '🛡', 'Reaction', 'Reaction', actionEconomy.reaction.used ? '0/1' : '1/1', 'text-sky-300')}</Tooltip>
        <Tooltip content="Free Object Interaction">{econItem(actionEconomy.freeActions <= 0, '🖐', 'Free', 'Free Object Interaction', '∞', 'text-emerald-300')}</Tooltip>
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
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 text-center block mb-1">Movement</span>
            <div className="w-full bg-slate-950 rounded-full h-4 shadow-inner overflow-hidden relative border border-slate-700">
              <motion.div
                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full"
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
