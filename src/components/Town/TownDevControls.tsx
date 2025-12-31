import React from 'react';
import { RefreshCw, Download, TreeDeciduous, Home, Compass, BookOpen } from 'lucide-react';
import { BiomeType, TownDensity } from '../../types/realmsmith';
import type { Action } from '../../types';

interface TownDevControlsProps {
    seed: number;
    setSeed: (n: number) => void;
    handleRandomize: () => void;
    biome: BiomeType;
    setBiome: (b: BiomeType) => void;
    density: TownDensity;
    setDensity: (d: TownDensity) => void;
    connections: { north: boolean, east: boolean, south: boolean, west: boolean };
    toggleConnection: (dir: keyof TownDevControlsProps['connections']) => void;
    loading: boolean;
    generateMap: () => void;
    onAction: (action: Action) => void;
    handleDownload: () => void;
}

export const TownDevControls: React.FC<TownDevControlsProps> = ({
    seed,
    setSeed,
    handleRandomize,
    biome,
    setBiome,
    density,
    setDensity,
    connections,
    toggleConnection,
    loading,
    generateMap,
    onAction,
    handleDownload
}) => {
    return (
        /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
        TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
        TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
        */
        <div className="flex flex-wrap items-center gap-4 bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-700 w-full xl:w-auto">

            {/* Seed Control */}
            {/*
              TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
              TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
              TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
            */}
            <div className="flex flex-col">


                <label htmlFor="town-seed-input" className="text-xs text-gray-500 font-mono uppercase mb-1">Seed</label>
                <div className="flex gap-2">
                    <input
                        id="town-seed-input"
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                        className="bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-1 w-24 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button onClick={handleRandomize} title="Randomize" className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="h-8 w-px bg-gray-600 mx-1 hidden md:block"></div>

            {/* Biome Control */}
            {/*
              TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
              TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
              TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
            */}
            <div className="flex flex-col">


                <label htmlFor="town-biome-select" className="text-xs text-gray-500 font-mono uppercase mb-1 flex items-center gap-1"><TreeDeciduous size={10} /> Biome</label>
                <select
                    id="town-biome-select"
                    value={biome}
                    onChange={(e) => setBiome(e.target.value as BiomeType)}
                    className="bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500 max-w-[150px]"
                >
                    {Object.values(BiomeType).map((b) => (
                        <option key={b} value={b}>{b.replace('_', ' ')}</option>
                    ))}
                </select>
            </div>

            {/* Density Control */}
            {/*
              TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
              TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
              TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
            */}
            <div className="flex flex-col">


                <label htmlFor="town-density-select" className="text-xs text-gray-500 font-mono uppercase mb-1 flex items-center gap-1"><Home size={10} /> Density</label>
                <select
                    id="town-density-select"
                    value={density}
                    onChange={(e) => setDensity(e.target.value as TownDensity)}
                    className="bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                    <option value={TownDensity.VERY_SPARSE}>Very Sparse</option>
                    <option value={TownDensity.SPARSE}>Sparse</option>
                    <option value={TownDensity.MEDIUM}>Medium</option>
                    <option value={TownDensity.HIGH}>High</option>
                    <option value={TownDensity.EXTREME}>Extreme</option>
                </select>
            </div>

            <div className="h-8 w-px bg-gray-600 mx-1 hidden md:block"></div>

            {/* Connections Control */}
            <div className="flex flex-col">


                <span className="text-xs text-gray-500 font-mono uppercase mb-1 flex items-center gap-1"><Compass size={10} /> Exits</span>
                <div className="flex gap-1">
                    {['north', 'south', 'east', 'west'].map((dir) => (
                        <button
                            key={dir}
                            onClick={() => toggleConnection(dir as keyof TownDevControlsProps['connections'])}
                            className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold border ${connections[dir as keyof TownDevControlsProps['connections']]
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'
                                }`}
                            title={`Toggle ${dir} exit`}
                        >
                            {dir[0].toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-8 w-px bg-gray-600 mx-1 hidden md:block"></div>

            {/* Actions */}
            <button
                onClick={() => generateMap()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-bold shadow-lg ml-auto md:ml-0"
                disabled={loading}
            >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                <span className="hidden md:inline">Regenerate</span>
            </button>

            <button
                onClick={() => onAction({ type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Open Codex' })}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors font-bold"
                title="Open Codex"
            >
                <BookOpen size={18} />
            </button>

            <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg transition-colors font-bold"
                title="Download PNG"
            >
                <Download size={18} />
            </button>
        </div>
    );
};
