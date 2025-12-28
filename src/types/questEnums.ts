/**
 * @file src/types/questEnums.ts
 * Shared enums for the Quest system to avoid circular dependencies.
 */

/**
 * The current state of a quest in the player's log.
 */
export enum QuestStatus {
  Unknown = 'Unknown',
  Available = 'Available', // Visible but not accepted
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed',
  Abandoned = 'Abandoned'
}
