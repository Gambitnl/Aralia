import React, { useState, useMemo } from 'react';
import { DeformableScene } from '../../ThreeDModal/Experimental/DeformableScene';

export const PreviewEnvironment: React.FC = () => {
  const [timeOfDay, setTimeOfDay] = useState(12);

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-gray-100">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-900/80">
        <h2 className="text-sm font-bold text-emerald-400">Environmental Prototype</h2>
        
        <div className="flex items-center gap-2">
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
        <DeformableScene />
        
        {/* Controls Overlay */}
        <div className="absolute right-0 top-0 h-full w-[300px] bg-gray-950/90 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Deformation Tools</h3>
          <div className="space-y-4">
            <div className="p-3 bg-gray-900 rounded border border-gray-700">
              <div className="text-xs font-bold text-amber-400 mb-1">Mold Earth (Brush)</div>
              <ul className="text-xs text-gray-300 space-y-1 list-disc ml-4">
                <li><kbd className="bg-gray-800 px-1 rounded">Click</kbd> to Raise terrain</li>
                <li><kbd className="bg-gray-800 px-1 rounded">Shift + Click</kbd> to Lower terrain</li>
              </ul>
            </div>
            <div className="text-xs text-gray-500 italic">
              Physics simulation (height adherence) validated via manager sampling.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
