/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/debug/NobleHouseList.tsx
 * A debug component to visualize the procedural noble houses and their relationships.
 */

import React from 'react';
import { getAllFactions } from '../../utils/factionUtils';

interface NobleHouseListProps {
  worldSeed: number;
  onClose: () => void;
}

const NobleHouseList: React.FC<NobleHouseListProps> = ({ worldSeed, onClose }) => {
  const factions = getAllFactions(worldSeed);
  const nobleHouses = Object.values(factions).filter(f => f.type === 'NOBLE_HOUSE');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-[70] overflow-y-auto p-8 font-sans">
      <div className="max-w-7xl mx-auto relative">
        <button
            onClick={onClose}
            className="absolute top-0 right-0 text-gray-400 hover:text-white text-4xl"
            aria-label="Close"
        >
            &times;
        </button>

        <h2 className="text-3xl font-cinzel text-amber-400 mb-6 text-center">Noble Houses of Aralia</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nobleHouses.map(house => (
            <div
                key={house.id}
                className="bg-gray-800 border-2 rounded-lg p-6 flex flex-col gap-4 relative overflow-hidden"
                style={{ borderColor: house.colors.primary }}
            >
                {/* Banner Background Effect */}
                <div
                className="absolute top-0 right-0 w-32 h-32 opacity-10 transform rotate-12 translate-x-10 -translate-y-10 rounded-full"
                style={{ backgroundColor: house.colors.secondary }}
                />

                <div className="flex justify-between items-start z-10">
                <h3 className="text-xl font-bold text-white font-cinzel">{house.name}</h3>
                <div className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: house.colors.primary, borderColor: house.colors.secondary }} />
                </div>



                {/*
                  TODO(lint-intent): This text includes raw quotes/special characters that were likely meant as prose.
                  TODO(lint-intent): Decide whether to escape them, move text to a copy/localization layer, or pre-format it.
                  TODO(lint-intent): If the text is dynamic, consider formatting/escaping before render to preserve intent.
                */}
                <p className="text-amber-200 italic font-serif text-lg">&quot;{house.motto}&quot;</p>

                <p className="text-gray-300 text-sm">{house.description}</p>

                <div className="flex flex-wrap gap-2 my-2">
                    {house.values.map(val => (
                        <span key={val} className="px-2 py-1 bg-green-900 text-green-100 text-xs rounded-full uppercase tracking-wide">{val}</span>
                    ))}
                    {house.hates.map(hate => (
                        <span key={hate} className="px-2 py-1 bg-red-900 text-red-100 text-xs rounded-full uppercase tracking-wide">Hates: {hate}</span>
                    ))}
                </div>

                <div className="mt-auto space-y-2 text-sm border-t border-gray-700 pt-4">
                {house.allies.length > 0 && (
                    <div className="flex gap-2">
                        <span className="text-blue-400 font-semibold w-16">Allies:</span>
                        <div className="flex flex-col">
                            {house.allies.map(id => (
                                <span key={id} className="text-gray-400">
                                    {factions[id]?.name || id}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {house.enemies.length > 0 && (
                    <div className="flex gap-2">
                        <span className="text-red-400 font-semibold w-16">Enemies:</span>
                        <div className="flex flex-col">
                            {house.enemies.map(id => (
                                <span key={id} className="text-gray-400">
                                    {factions[id]?.name || id}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {house.rivals.length > 0 && (
                    <div className="flex gap-2">
                        <span className="text-yellow-400 font-semibold w-16">Rivals:</span>
                        <div className="flex flex-col">
                            {house.rivals.map(id => (
                                <span key={id} className="text-gray-400">
                                    {factions[id]?.name || id}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default NobleHouseList;
