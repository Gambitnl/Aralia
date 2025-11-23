/**
 * @file ActionEconomyBar.tsx
 * A component to display the character's current action economy status.
 */
import React from 'react';
import { ActionEconomyState } from '../../types/combat';
import Tooltip from '../Tooltip';

interface ActionEconomyBarProps {
  actionEconomy: ActionEconomyState;
}

const ActionEconomyBar: React.FC<ActionEconomyBarProps> = ({ actionEconomy }) => {
  
  const movementPercentage = (actionEconomy.movement.total > 0) 
    ? ((actionEconomy.movement.total - actionEconomy.movement.used) / actionEconomy.movement.total) * 100
    : 0;

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
      </div>

      {/* Movement */}
      <div className="pt-2">
        <Tooltip content={`Movement: ${actionEconomy.movement.total - actionEconomy.movement.used} / ${actionEconomy.movement.total} ft remaining`}>
            <div>
                <label className="text-xs font-bold text-green-400 text-center block mb-1">Movement</label>
                <div className="w-full bg-gray-600 rounded-full h-4 shadow-inner overflow-hidden relative border border-gray-500">
                    <div 
                        className="bg-green-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${movementPercentage}%`}}
                    ></div>
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