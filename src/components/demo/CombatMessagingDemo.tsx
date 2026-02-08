/**
 * Combat Messaging Demo Component
 * 
 * Demonstrates the unified combat messaging system in action.
 * Shows how different message types are created and displayed.
 */

import React, { useEffect } from 'react';
import { useCombatMessaging } from '../../hooks/combat/useCombatMessaging';
import type { CombatCharacter } from '../../types/combat';

// Mock combat characters for demonstration
const mockCharacters: Record<string, any> = {
  player: {
    id: 'player-1',
    name: 'Aeliana Moonwhisper',
    currentHP: 45,
    maxHP: 50,
    isPlayer: true
  },
  
  goblin: {
    id: 'goblin-1',
    name: 'Goblin Warrior',
    currentHP: 12,
    maxHP: 12,
    isPlayer: false
  },
  
  orc: {
    id: 'orc-1',
    name: 'Orc Berserker',
    currentHP: 0,
    maxHP: 35,
    isPlayer: false
  }
};

export const CombatMessagingDemo: React.FC = () => {
  const {
    messages,
    config,
    updateConfig,
    addDamageMessage,
    addKillMessage,
    addMissMessage,
    addSpellMessage,
    addStatusMessage,
    addLevelUpMessage,
    getMessageColor
  } = useCombatMessaging();

  // Demo sequence - simulate combat events
  useEffect(() => {
    const demoSequence = async () => {
      // Wait a bit for component to mount
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Round 1: Player attacks goblin
      addDamageMessage({
        source: mockCharacters.player,
        target: mockCharacters.goblin,
        damage: 8,
        damageType: 'slashing',
        weaponName: 'Longsword'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Round 2: Goblin misses player
      addMissMessage({
        attacker: mockCharacters.goblin,
        defender: mockCharacters.player
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Round 3: Player scores critical hit
      addDamageMessage({
        source: mockCharacters.player,
        target: mockCharacters.goblin,
        damage: 16,
        damageType: 'slashing',
        isCritical: true,
        weaponName: 'Longsword'
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Round 4: Goblin defeated
      addKillMessage({
        killer: mockCharacters.player,
        victim: mockCharacters.goblin
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Round 5: Fireball spell cast on orc
      addSpellMessage({
        caster: mockCharacters.player,
        target: mockCharacters.orc,
        spellName: 'Fireball',
        success: true
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Round 6: Orc takes damage and is defeated
      addDamageMessage({
        source: mockCharacters.player,
        target: mockCharacters.orc,
        damage: 28,
        damageType: 'fire',
        spellName: 'Fireball'
      });
      
      addKillMessage({
        killer: mockCharacters.player,
        victim: mockCharacters.orc
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Level up achievement
      addLevelUpMessage({
        character: mockCharacters.player,
        newLevel: 3
      });
    };
    
    demoSequence();
  }, [addDamageMessage, addKillMessage, addMissMessage, addSpellMessage, addStatusMessage, addLevelUpMessage]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-amber-400 mb-6">Combat Messaging System Demo</h1>
        
        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold text-blue-400 mb-3">Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.enableCombatLog}
                onChange={(e) => updateConfig({ enableCombatLog: e.target.checked })}
                className="rounded"
              />
              <span>Enable Combat Log</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.enableNotifications}
                onChange={(e) => updateConfig({ enableNotifications: e.target.checked })}
                className="rounded"
              />
              <span>Enable Notifications</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <select
                value={config.minimumPriority}
                onChange={(e) => updateConfig({ minimumPriority: e.target.value as any })}
                className="bg-gray-700 text-white rounded px-2 py-1"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
              </select>
              <span>Minimum Priority</span>
            </label>
          </div>
        </div>
        
        {/* Combat Log Display */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold text-green-400 mb-3">Combat Messages</h2>
          
          {messages.length === 0 ? (
            <p className="text-gray-400 italic">Waiting for combat events...</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {[...messages].reverse().map((message) => (
                <div 
                  key={message.id} 
                  className={`p-3 rounded border-l-4 ${
                    message.priority === 'critical' ? 'border-amber-500 bg-amber-900/20' :
                    message.priority === 'high' ? 'border-red-500 bg-red-900/20' :
                    message.priority === 'medium' ? 'border-blue-500 bg-blue-900/20' :
                    'border-gray-500 bg-gray-900/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className={`font-semibold ${getMessageColor(message.type)}`}>
                        {message.title}
                      </h3>
                      <p className="text-gray-300 text-sm mt-1">{message.description}</p>
                      {message.data.formattedValue && (
                        <p className="text-xs text-gray-500 mt-1">
                          Value: {message.data.formattedValue}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {new Date(message.timestamp).toLocaleTimeString()}
                      <br />
                      <span className="capitalize">{message.priority}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    {message.channels.map(channel => (
                      <span 
                        key={channel} 
                        className="text-xs px-2 py-1 bg-gray-700 rounded"
                      >
                        {channel.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">Message Types Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-400 rounded mr-2"></div>
              <span>Damage Dealt/Critical</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded mr-2"></div>
              <span>Healing Received</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-400 rounded mr-2"></div>
              <span>Status Applied</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
              <span>Spells/Abilities</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-400 rounded mr-2"></div>
              <span>Killing Blows</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-400 rounded mr-2"></div>
              <span>Level Ups</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};