
/**
 * @file ActionPane.tsx
 * This component displays available actions to the player, such as movement,
 * interacting with NPCs or items, looking around, and asking the Oracle.
 * It dynamically generates action buttons based on the current game context.
 */
import React, { useState } from 'react';
import { Location, Action, NPC, Item } from '../types';

interface ActionPaneProps {
  currentLocation: Location;
  npcsInLocation: NPC[];
  itemsInLocation: Item[];
  onAction: (action: Action) => void;
  disabled: boolean; // True if an action is currently being processed
}

/**
 * ActionButton component.
 * A styled button for player actions.
 * @param {object} props - Component props.
 * @param {Action} props.action - The action associated with this button.
 * @param {(action: Action) => void} props.onClick - Callback when button is clicked.
 * @param {boolean} props.disabled - Whether the button is disabled.
 * @param {string} [props.className] - Optional additional CSS classes.
 * @returns {React.FC} The rendered ActionButton.
 */
const ActionButton: React.FC<{ action: Action; onClick: (action: Action) => void; disabled: boolean, className?: string }> = ({ action, onClick, disabled, className = '' }) => {
  return (
    <button
      onClick={() => onClick(action)}
      disabled={disabled}
      className={`bg-sky-600 hover:bg-sky-500 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75 ${className}`}
      aria-label={action.label}
    >
      {action.label}
    </button>
  );
};

/**
 * ActionPane component.
 * Displays available actions to the player based on their current location,
 * present NPCs, and available items. Also includes a special "Ask the Oracle" action.
 * @param {ActionPaneProps} props - The props for the component.
 * @returns {React.FC} The rendered ActionPane component.
 */
const ActionPane: React.FC<ActionPaneProps> = ({ currentLocation, npcsInLocation, itemsInLocation, onAction, disabled }) => {
  const [isOracleInputVisible, setIsOracleInputVisible] = useState(false);
  const [oracleQuery, setOracleQuery] = useState('');

  const availableActions: Action[] = [];

  // Look around action
  availableActions.push({ type: 'look_around', label: 'Look Around' });

  // Movement actions based on current location exits
  Object.entries(currentLocation.exits).forEach(([direction, locationId]) => {
    availableActions.push({ type: 'move', label: `Go ${direction}`, targetId: locationId });
  });

  // NPC interaction actions
  npcsInLocation.forEach(npc => {
    availableActions.push({ type: 'talk', label: `Talk to ${npc.name}`, targetId: npc.id });
  });

  // Item interaction actions (e.g., take item)
  itemsInLocation.forEach(item => {
    availableActions.push({type: 'take_item', label: `Take ${item.name}`, targetId: item.id});
  });

  /**
   * Handles the click event for the "Ask the Oracle" button, showing the input field.
   */
  const handleAskOracleClick = () => {
    setIsOracleInputVisible(true);
  };

  /**
   * Updates the oracle query state as the user types.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event.
   */
  const handleOracleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOracleQuery(event.target.value);
  };

  /**
   * Submits the Oracle query if it's not empty and actions are not disabled.
   */
  const handleOracleSubmit = () => {
    if (oracleQuery.trim() && !disabled) {
      onAction({ type: 'ask_oracle', label: 'Ask the Oracle', payload: { query: oracleQuery.trim() } });
      setOracleQuery('');
      setIsOracleInputVisible(false);
    }
  };

  /**
   * Cancels the Oracle query input, hiding the input field and clearing the query.
   */
  const handleOracleCancel = () => {
    setOracleQuery('');
    setIsOracleInputVisible(false);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-2xl font-bold text-amber-400 mb-4 border-b-2 border-amber-500 pb-2">Actions</h2>

      {!isOracleInputVisible && (
        <ActionButton
          action={{ type: 'custom', label: 'Ask the Oracle' }}
          onClick={handleAskOracleClick}
          disabled={disabled}
          className="bg-purple-600 hover:bg-purple-500 focus:ring-purple-400 w-full mb-4"
        />
      )}

      {isOracleInputVisible && (
        <div className="mb-4 p-4 border border-purple-500 rounded-lg bg-gray-700/50">
          <label htmlFor="oracleQueryInput" className="block text-sm font-medium text-purple-300 mb-1">
            What wisdom do you seek from the Oracle?
          </label>
          <input
            type="text"
            id="oracleQueryInput"
            value={oracleQuery}
            onChange={handleOracleQueryChange}
            placeholder="e.g., What fate awaits me in the ruins?"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
            disabled={disabled}
            aria-label="Your question for the Oracle"
            onKeyDown={(e) => e.key === 'Enter' && handleOracleSubmit()}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleOracleSubmit}
              disabled={disabled || !oracleQuery.trim()}
              className="flex-grow bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors"
            >
              Submit Query
            </button>
            <button
              onClick={handleOracleCancel}
              disabled={disabled}
              className="flex-grow bg-gray-500 hover:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {availableActions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableActions.map((action) => (
            <ActionButton
              key={action.label + (action.targetId || '')}
              action={action}
              onClick={onAction}
              disabled={disabled || isOracleInputVisible} // Disable standard actions when Oracle input is visible
            />
          ))}
        </div>
      ) : (
        !isOracleInputVisible && <p className="text-gray-500 italic">No standard actions available right now.</p>
      )}
    </div>
  );
};

export default ActionPane;