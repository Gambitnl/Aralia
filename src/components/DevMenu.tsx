/**
 * @file DevMenu.tsx
 * This component displays a developer menu modal with various debug/utility actions.
 */
import React, { useEffect, useRef } from 'react';
import { GEMINI_TEXT_MODEL_FALLBACK_CHAIN } from '../config/geminiConfig';

type DevMenuActionType = 'main_menu' | 'char_creator' | 'save' | 'load' | 'toggle_log_viewer' | 'battle_map_demo' | 'generate_encounter' | 'toggle_party_editor' | 'toggle_npc_test_plan' | 'inspect_noble_houses';

interface DevMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDevAction: (actionType: DevMenuActionType) => void;
  hasNewRateLimitError: boolean;
  currentModelOverride: string | null;
  onModelChange: (model: string | null) => void;
}

const DevMenu: React.FC<DevMenuProps> = ({ isOpen, onClose, onDevAction, hasNewRateLimitError, currentModelOverride, onModelChange }) => {
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      firstFocusableElementRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onModelChange(value === 'default' ? null : value);
  };

  const devActionButtons: Array<{ label: string; action: DevMenuActionType; style?: string }> = [
    { label: 'Go to Main Menu', action: 'main_menu', style: 'bg-blue-600 hover:bg-blue-500' },
    { label: 'Go to Character Creator', action: 'char_creator', style: 'bg-green-600 hover:bg-green-500' },
    { label: 'Force Save Game', action: 'save', style: 'bg-yellow-500 hover:bg-yellow-400 text-gray-900' },
    { label: 'Force Load Game', action: 'load', style: 'bg-teal-500 hover:bg-teal-400' },
    { label: 'Battle Map Demo', action: 'battle_map_demo', style: 'bg-teal-600 hover:bg-teal-500' },
    { label: 'Edit Encounter Party', action: 'toggle_party_editor', style: 'bg-indigo-600 hover:bg-indigo-500' },
    { label: 'Generate Encounter', action: 'generate_encounter', style: 'bg-rose-600 hover:bg-rose-500' },
    { label: 'View Gemini Prompt Log', action: 'toggle_log_viewer', style: 'bg-purple-600 hover:bg-purple-500' },
    { label: 'NPC Interaction Test Plan', action: 'toggle_npc_test_plan', style: 'bg-cyan-600 hover:bg-cyan-500' },
    { label: 'Inspect Noble Houses', action: 'inspect_noble_houses', style: 'bg-orange-600 hover:bg-orange-500' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4" // Higher z-index than map/submap
      aria-modal="true"
      role="dialog"
      aria-labelledby="dev-menu-title"
    >
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 id="dev-menu-title" className="text-2xl font-bold text-amber-400 font-cinzel">
            Developer Menu
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-3xl"
            aria-label="Close developer menu"
          >
            &times;
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {devActionButtons.map((btn, index) => {
            const showBadge = btn.action === 'toggle_log_viewer' && hasNewRateLimitError;
            return (
              <button
                key={btn.action}
                ref={index === 0 ? firstFocusableElementRef : null}
                onClick={() => onDevAction(btn.action)}
                className={`relative w-full text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors text-lg ${btn.style || 'bg-gray-600 hover:bg-gray-500'}`}
              >
                {btn.label}
                {showBadge && (
                  <span className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-gray-800 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-600">
          <label htmlFor="model-selector" className="block text-sm font-medium text-sky-300 mb-2">
            Gemini Model Override
          </label>
          <select
            id="model-selector"
            value={currentModelOverride || 'default'}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
          >
            <option value="default">Default (Automatic Fallback)</option>
            {GEMINI_TEXT_MODEL_FALLBACK_CHAIN.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onClose}
          className="mt-6 bg-red-700 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg shadow"
          aria-label="Close developer menu"
        >
          Close Dev Menu
        </button>
      </div>
    </div>
  );
};

export default DevMenu;
