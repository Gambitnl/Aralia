/**
 * Combat Messaging Hook
 * 
 * Manages the state and behavior of the combat messaging system.
 * Provides centralized control over message creation, filtering, and display.
 */

import { useState, useCallback, useMemo } from 'react';
import type { 
  CombatMessage, 
  CombatMessageType, 
  MessagePriority,
  CombatMessagingConfig,
  CombatMessageFilters,
  UseCombatMessagingReturn
} from '../../types/combatMessages';
import * as messageFactory from '../../utils/combat/messageFactory';

export function useCombatMessaging(): UseCombatMessagingReturn {
  // State
  const [messages, setMessages] = useState<CombatMessage[]>([]);
  const [config, setConfig] = useState<CombatMessagingConfig>({
    enableCombatLog: true,
    enableNotifications: true,
    enableVisualEffects: true,
    enableAudioCues: true,
    notificationDuration: 5000,
    maxConcurrentNotifications: 5,
    groupSimilarMessages: true,
    showFlavorText: true,
    minimumPriority: 'medium' as MessagePriority,
    excludedTypes: [],
    maxLogEntries: 100,
    enableVirtualScrolling: true
  });
  
  const [filters, setFilters] = useState<CombatMessageFilters>({
    types: [],
    priorities: [],
    sources: [],
    targets: [],
    searchText: ''
  });

  // Message Management
  const addMessage = useCallback((message: Omit<CombatMessage, 'id' | 'timestamp'>) => {
    const newMessage: CombatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    setMessages(prev => {
      // Limit total messages
      const updated = [...prev, newMessage];
      if (updated.length > config.maxLogEntries) {
        return updated.slice(-config.maxLogEntries);
      }
      return updated;
    });
  }, [config.maxLogEntries]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Filter Management
  const updateFilters = useCallback((newFilters: Partial<CombatMessageFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const updateConfig = useCallback((newConfig: Partial<CombatMessagingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Message Selectors
  const getMessagesByType = useCallback((type: CombatMessageType) => {
    return messages.filter(msg => msg.type === type);
  }, [messages]);

  const getMessagesByPriority = useCallback((priority: MessagePriority) => {
    return messages.filter(msg => msg.priority === priority);
  }, [messages]);

  const getRecentMessages = useCallback((count: number) => {
    return [...messages].slice(-count);
  }, [messages]);

  // Computed Values
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(msg.type)) {
        return false;
      }
      
      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(msg.priority)) {
        return false;
      }
      
      // Source filter
      if (filters.sources.length > 0 && msg.sourceEntityId && !filters.sources.includes(msg.sourceEntityId)) {
        return false;
      }
      
      // Target filter
      if (filters.targets.length > 0 && msg.targetEntityId && !filters.targets.includes(msg.targetEntityId)) {
        return false;
      }
      
      // Text search
      if (filters.searchText && 
          !msg.title.toLowerCase().includes(filters.searchText.toLowerCase()) &&
          !msg.description.toLowerCase().includes(filters.searchText.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [messages, filters]);

  const getMessageCount = useCallback(() => messages.length, [messages]);
  const hasActiveMessages = useCallback(() => messages.length > 0, [messages]);

  // Convenience Methods - keeping these for backward compatibility
  const addDamageMessage = useCallback((params: Parameters<typeof messageFactory.createDamageMessage>[0]) => {
    const message = messageFactory.createDamageMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  const addKillMessage = useCallback((params: Parameters<typeof messageFactory.createKillMessage>[0]) => {
    const message = messageFactory.createKillMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  const addMissMessage = useCallback((params: Parameters<typeof messageFactory.createMissMessage>[0]) => {
    const message = messageFactory.createMissMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  const addSpellMessage = useCallback((params: Parameters<typeof messageFactory.createSpellMessage>[0]) => {
    const message = messageFactory.createSpellMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  const addStatusMessage = useCallback((params: Parameters<typeof messageFactory.createStatusMessage>[0]) => {
    const message = messageFactory.createStatusMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  const addLevelUpMessage = useCallback((params: Parameters<typeof messageFactory.createLevelUpMessage>[0]) => {
    const message = messageFactory.createLevelUpMessage(params);
    addMessage(message);
    return message;
  }, [addMessage]);

  return {
    // State
    messages: filteredMessages,
    filters,
    config,
    
    // Actions
    addMessage,
    removeMessage,
    clearMessages,
    updateFilters,
    updateConfig,
    
    // Selectors
    getMessagesByType,
    getMessagesByPriority,
    getRecentMessages,
    
    // Utilities
    getMessageCount,
    hasActiveMessages,
    
    // Convenience Methods
    addDamageMessage,
    addKillMessage,
    addMissMessage,
    addSpellMessage,
    addStatusMessage,
    addLevelUpMessage,
    
    // Helpers
    getMessageColor: messageFactory.getMessageColor
  };
}