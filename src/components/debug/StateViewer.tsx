/**
 * @file StateViewer.tsx
 * A collapsible state inspector for debugging game state.
 */
import React, { useState } from 'react';
import { GameState } from '../../types';

interface StateViewerProps {
  state: GameState;
}

const StateViewer: React.FC<StateViewerProps> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>('');

  const getValueAtPath = (obj: unknown, path: string): unknown => {
    if (!path) return obj;
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  const presetPaths = [
    { label: 'NPC Memory', path: 'npcMemory' },
    { label: 'Notoriety', path: 'notoriety' },
    { label: 'Local Heat', path: 'notoriety.localHeat' },
    { label: 'Current Location', path: 'currentLocationId' },
    { label: 'Gold', path: 'gold' },
    { label: 'Party', path: 'party' },
    { label: 'Inventory', path: 'inventory' },
    { label: 'Faction Standings', path: 'playerFactionStandings' },
    { label: 'Generated NPCs', path: 'generatedNpcs' },
  ];

  const currentValue = getValueAtPath(state, selectedPath);

  return (
    <div className="mt-4 pt-4 border-t border-gray-600">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-300 hover:text-white"
      >
        <span>State Inspector</span>
        <span className="text-xs text-gray-500">
          {isOpen ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Preset Quick Links */}
          <div className="flex flex-wrap gap-2">
            {presetPaths.map((preset) => (
              <button
                key={preset.path}
                onClick={() => setSelectedPath(preset.path)}
                className={`px-2 py-1 text-xs rounded ${
                  selectedPath === preset.path
                    ? 'bg-sky-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Path Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="state.path (e.g., npcMemory.merchant_1)"
              className="flex-1 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500"
            />
            <button
              onClick={() => setSelectedPath('')}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Clear
            </button>
          </div>

          {/* Value Display */}
          <div className="bg-gray-900 rounded p-3 max-h-64 overflow-auto">
            <div className="text-xs text-gray-500 mb-2">
              Path: <span className="text-sky-400">{selectedPath || 'root'}</span>
            </div>
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(currentValue, null, 2)}
            </pre>
          </div>

          {/* Copy to Clipboard */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(currentValue, null, 2));
            }}
            className="w-full py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
};

export default StateViewer;
