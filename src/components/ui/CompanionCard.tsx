/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/components/ui/CompanionCard.tsx
 * Displays detailed information about a companion: relationships, approval, and goals.
 */

import React from 'react';
import { Companion, RelationshipLevel } from '../../types/companions';
import { assetUrl } from '../../config/env';

interface CompanionCardProps {
  companion: Companion;
  playerId?: string; // ID of the player to show relationship for (defaults to 'player')
}

const LEVEL_COLORS: Record<RelationshipLevel, string> = {
  hated: 'text-red-700',
  enemy: 'text-red-500',
  rival: 'text-orange-500',
  distrusted: 'text-orange-300',
  wary: 'text-yellow-300',
  stranger: 'text-gray-400',
  acquaintance: 'text-blue-300',
  friend: 'text-green-400',
  close: 'text-green-300',
  devoted: 'text-yellow-300',
  romance: 'text-pink-400'
};

const APPROVAL_GRADIENT = "bg-gradient-to-r from-red-900 via-gray-700 to-green-900";

export const CompanionCard: React.FC<CompanionCardProps> = ({ companion, playerId = 'player' }) => {
  const relationship = companion.relationships[playerId] || { level: 'stranger', approval: 0 };
  const { identity, personality, goals } = companion;

  // Calculate approval width (mapped from -100..100 to 0..100%)
  const approvalPercent = Math.max(0, Math.min(100, (relationship.approval + 100) / 2));

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg w-full">
      {/* Header: Name and Avatar */}
      <div className="flex gap-4 mb-4">
        <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-amber-600 flex items-center justify-center overflow-hidden shrink-0">
          {identity.avatarUrl ? (
            <img src={assetUrl(identity.avatarUrl)} alt={identity.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-cinzel text-amber-500">{identity.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-amber-100 truncate font-cinzel">{identity.name}</h3>
          <p className="text-xs text-gray-400">{identity.race} {identity.class} • {identity.background}</p>

          {/* Relationship Status */}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-bold uppercase tracking-wide ${LEVEL_COLORS[relationship.level]}`}>
              {relationship.level}
            </span>
            <span className="text-xs text-gray-500">({relationship.approval})</span>
          </div>
        </div>
      </div>

      {/* Approval Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Hated</span>
          <span>Neutral</span>
          <span>Loyal</span>
        </div>
        <div className={`h-3 w-full rounded-full ${APPROVAL_GRADIENT} relative border border-gray-700`}>
          {/* Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-500"
            style={{ left: `${approvalPercent}%` }}
          />
        </div>
      </div>

      {/* Goals */}
      <div className="mb-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1">Current Goals</h4>
        <ul className="space-y-2">
          {goals.filter(g => g.status === 'active' && !g.isSecret).length === 0 && (
            <li className="text-xs text-gray-500 italic">No active goals known.</li>
          )}
          {goals.filter(g => g.status === 'active' && !g.isSecret).map(goal => (
            <li key={goal.id} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">❖</span>
              <span>{goal.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Traits (Collapsible or small) */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1">Personality</h4>
        <div className="flex flex-wrap gap-2">
          {personality.values.slice(0, 3).map(val => (
            <span key={val} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full border border-gray-600">
              {val}
            </span>
          ))}
          {personality.quirks.slice(0, 1).map(quirk => (
            <span key={quirk} className="px-2 py-0.5 bg-gray-900 text-gray-400 text-xs rounded-full border border-gray-800 italic">
              &quot;{quirk}&quot;
            </span>
          ))}
        </div>
      </div>

      {/* Discovered Facts - Facts learned through banter and interactions */}
      {companion.discoveredFacts && companion.discoveredFacts.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1">
            What You&apos;ve Learned
          </h4>
          <ul className="space-y-1.5">
            {companion.discoveredFacts.slice(0, 5).map(fact => (
              <li key={fact.id} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-amber-500/70 mt-0.5 text-xs">
                  {fact.category === 'backstory' && '📜'}
                  {fact.category === 'family' && '👨‍👩‍👧'}
                  {fact.category === 'occupation' && '⚒️'}
                  {fact.category === 'belief' && '✨'}
                  {fact.category === 'relationship' && '🤝'}
                  {fact.category === 'preference' && '💜'}
                  {fact.category === 'other' && '📌'}
                </span>
                <span>{fact.fact}</span>
              </li>
            ))}
            {companion.discoveredFacts.length > 5 && (
              <li className="text-xs text-gray-500 italic pl-6">
                +{companion.discoveredFacts.length - 5} more facts...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
