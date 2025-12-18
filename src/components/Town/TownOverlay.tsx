import React from 'react';
import { Moon, Sun, Grid, ZoomIn, ZoomOut, Maximize, Settings } from 'lucide-react';

interface TownOverlayProps {
    isNight: boolean;
    setIsNight: (v: boolean) => void;
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    zoom: number;
    setZoom: (fn: (z: number) => number) => void;
    resetView: () => void;
    isDevDummyActive: boolean;
    showDevControls: boolean;
    setShowDevControls: (v: boolean) => void;
}

export const TownOverlay: React.FC<TownOverlayProps> = ({
    isNight,
    setIsNight,
    showGrid,
    setShowGrid,
    setZoom,
    resetView,
    isDevDummyActive,
    showDevControls,
    setShowDevControls,
}) => {
    return (
        <>
            {/* Top Left Controls - Dev Toggle + Info */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
                {isDevDummyActive && (
                    <button
                        type="button"
                        onClick={() => setShowDevControls(!showDevControls)}
                        className={`p-2 rounded-lg transition-colors shadow-lg border ${showDevControls ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                        title="Toggle Dev Controls"
                    >
                        <Settings size={20} />
                    </button>
                )}
                <div className="pointer-events-none opacity-60 flex items-center gap-2 bg-black/40 p-2 rounded text-xs text-gray-300">
                    <span>Scroll to Zoom</span>
                </div>
            </div>

            {/* Map Toggles (Top Right) */}
            <div className="absolute top-4 right-4 flex gap-2 z-20">
                <button
                    type="button"
                    onClick={() => setIsNight(!isNight)}
                    className={`p-2 rounded-lg transition-colors shadow-lg flex items-center gap-2 text-sm font-medium ${isNight ? 'bg-indigo-900 text-indigo-200 border border-indigo-500' : 'bg-yellow-100 text-orange-600 border border-yellow-300'}`}
                    title="Toggle Day/Night"
                >
                    {isNight ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button
                    type="button"
                    onClick={() => setShowGrid(!showGrid)}
                    className={`p-2 rounded-lg transition-colors shadow-lg border ${showGrid ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                    title="Toggle Grid"
                >
                    <Grid size={18} />
                </button>
            </div>

            {/* Zoom Controls (Bottom Right) */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-20 bg-gray-800/80 backdrop-blur p-1.5 rounded-lg border border-gray-700">
                <button type="button" onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom In">
                    <ZoomIn size={18} />
                </button>
                <button type="button" onClick={resetView} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Reset View">
                    <Maximize size={18} />
                </button>
                <button type="button" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom Out">
                    <ZoomOut size={18} />
                </button>
            </div>
        </>
    );
};
