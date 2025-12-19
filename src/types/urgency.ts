
/**
 * @file src/types/urgency.ts
 * Defines types for the Deadline and Urgency system.
 */

export type ConsequenceType = 'QUEST_FAILURE' | 'REPUTATION_PENALTY' | 'LOG_MESSAGE' | 'GAME_OVER';

export interface DeadlineConsequence {
  type: ConsequenceType;
  payload?: {
    questId?: string;
    factionId?: string;
    reputationAmount?: number;
    message?: string;
  };
}

export interface Deadline {
  id: string;
  title: string;
  description: string;
  dueDate: number; // Timestamp (milliseconds since epoch or similar)
  consequences: DeadlineConsequence[];
  warningThresholds: number[]; // Hours remaining to trigger a warning
  warningsTriggered: number[]; // List of thresholds already triggered
  isCompleted: boolean; // If the player resolved it before the deadline
  isExpired: boolean; // If the deadline passed
  sourceId?: string; // ID of the quest or entity that created this deadline
}
