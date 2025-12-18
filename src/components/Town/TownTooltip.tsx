import React from 'react';
import { Building } from '../../types/realmsmith';
import { BUILDING_DESCRIPTIONS } from '../../data/town/buildings';

interface TownTooltipProps {
    hoveredBuilding: Building;
    hoverPos: { x: number, y: number };
}

export const TownTooltip: React.FC<TownTooltipProps> = ({ hoveredBuilding, hoverPos }) => {
    return (
        <div
            className="absolute z-40 pointer-events-none bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3 text-left min-w-[200px]"
            style={{
                top: hoverPos.y + 15,
                left: hoverPos.x + 15,
                // Keep tooltip on screen if near edge
                transform: hoverPos.x > window.innerWidth - 250 ? 'translateX(-100%)' : 'none'
            }}
        >
            <h3 className="text-yellow-400 font-serif font-bold text-lg">
                {BUILDING_DESCRIPTIONS[hoveredBuilding.type]?.name || 'Unknown Building'}
            </h3>
            <div className="h-px bg-gray-700 my-2"></div>
            <p className="text-gray-300 text-sm italic">
                {BUILDING_DESCRIPTIONS[hoveredBuilding.type]?.desc}
            </p>
            <div className="mt-2 text-xs text-gray-500 font-mono">
                Size: {hoveredBuilding.width * 5}ft x {hoveredBuilding.height * 5}ft
            </div>
            <div className="mt-2 text-xs text-blue-400 font-bold">
                Click to Interact
            </div>
        </div>
    );
};
