import React, { useState } from 'react';
import { DeformableScene, ToolType } from '../../ThreeDModal/Experimental/DeformableScene';

export const PreviewEnvironment: React.FC = () => {
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [activeTool, setActiveTool] = useState<ToolType>('mold_earth');

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-gray-100">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-900/80">
        <h2 className="text-sm font-bold text-emerald-400 mr-4">Environmental Prototype</h2>
        
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 gap-1">
          <button 
            onClick={() => setActiveTool('mold_earth')}
            className={`px-3 py-1 rounded text-xs transition-colors ${activeTool === 'mold_earth' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Mold Earth
          </button>
          <button 
            onClick={() => setActiveTool('create_bonfire')}
            className={`px-3 py-1 rounded text-xs transition-colors ${activeTool === 'create_bonfire' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Bonfire
          </button>
          <button 
            onClick={() => setActiveTool('grease')}
            className={`px-3 py-1 rounded text-xs transition-colors ${activeTool === 'grease' ? 'bg-zinc-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
          >
            Grease
          </button>
          <button 
            onClick={() => setActiveTool('clear')}
            className="px-3 py-1 rounded text-xs text-red-400 hover:bg-red-900/30 transition-colors border border-transparent hover:border-red-900/50"
          >
            Reset All
          </button>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <label className="text-xs uppercase tracking-wide text-gray-400">Time</label>
          <input
            type="range"
            min={0}
            max={23}
            value={timeOfDay}
            onChange={(event) => setTimeOfDay(Number.parseInt(event.target.value, 10))}
          />
          <span className="text-sm text-gray-200">{timeOfDay}:00</span>
        </div>
      </div>

      <div className="flex-1 relative">
        <DeformableScene activeTool={activeTool} />
        
        {/* Controls Overlay */}
        <div className="absolute right-0 top-0 h-full w-[300px] bg-gray-950/90 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Prototype Instructions</h3>
          <div className="space-y-4">
            {activeTool === 'mold_earth' && (
              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                <div className="text-xs font-bold text-amber-400 mb-1">Mold Earth (Transmutation)</div>
                <ul className="text-xs text-gray-300 space-y-1 list-disc ml-4">
                  <li><kbd className="bg-gray-800 px-1 rounded">Click</kbd> to Raise terrain</li>
                  <li><kbd className="bg-gray-800 px-1 rounded">Shift + Click</kbd> to Lower terrain</li>
                  <li>Visual: Turns to dirt based on disturbance.</li>
                </ul>
              </div>
            )}
            {activeTool === 'create_bonfire' && (
              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                <div className="text-xs font-bold text-red-400 mb-1">Create Bonfire (Conjuration)</div>
                <ul className="text-xs text-gray-300 space-y-1 list-disc ml-4">
                  <li><kbd className="bg-gray-800 px-1 rounded">Click</kbd> to spawn fire.</li>
                  <li>Conforms to the deformed terrain surface.</li>
                </ul>
              </div>
            )}
            {activeTool === 'grease' && (
              <div className="p-3 bg-gray-900 rounded border border-gray-700">
                <div className="text-xs font-bold text-zinc-400 mb-1">Grease (Conjuration)</div>
                <ul className="text-xs text-gray-300 space-y-1 list-disc ml-4">
                  <li><kbd className="bg-gray-800 px-1 rounded">Click</kbd> to spawn slippery area.</li>
                  <li>Conforms to the deformed terrain surface.</li>
                </ul>
              </div>
            )}
            <div className="text-xs text-gray-500 italic">
              Physics height sampling remains accurate across all deformations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
