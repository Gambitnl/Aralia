/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/RelationshipsPane.tsx
 * Lists all known companions and their status.
 */

import React from 'react';
import { Companion } from '../../types/companions';
import { CompanionCard } from '../ui/CompanionCard';

interface RelationshipsPaneProps {
  companions: Record<string, Companion>;
}

export const RelationshipsPane: React.FC<RelationshipsPaneProps> = ({ companions }) => {
  const companionList = Object.values(companions);

  if (companionList.length === 0) {
    return (
        <div className="p-8 text-center text-gray-500 italic">
            You have not met any potential companions yet.
        </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-1">
      <div className="border-b-2 border-amber-500 pb-2 mb-4">
        <h2 className="text-2xl font-bold text-amber-400 font-cinzel text-center tracking-wide">Relationships</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companionList.map(companion => (
            <CompanionCard key={companion.id} companion={companion} />
        ))}
      </div>
    </div>
  );
};
