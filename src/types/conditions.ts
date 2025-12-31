/**
 * @file src/types/conditions.ts
 * Defines the standard conditions that can affect creatures in the game.
 * Source: PHB 2014 / PHB 2024
 */

/**
 * Standard D&D 5e conditions that alter a creature's capabilities.
 */
export enum ConditionType {
  Blinded = 'Blinded',
  Charmed = 'Charmed',
  Deafened = 'Deafened',
  Exhaustion = 'Exhaustion',
  Frightened = 'Frightened',
  Grappled = 'Grappled',
  Incapacitated = 'Incapacitated',
  Invisible = 'Invisible',
  Paralyzed = 'Paralyzed',
  Petrified = 'Petrified',
  Poisoned = 'Poisoned',
  Prone = 'Prone',
  Restrained = 'Restrained',
  Stunned = 'Stunned',
  Unconscious = 'Unconscious',
  /**
   * Non-standard condition: Target is on fire.
   * Mechanically treated as a condition for tracking duration and removal.
   */
  Ignited = 'Ignited',
}

/**
 * Metadata and mechanical summary for a condition.
 */
export interface ConditionTraits {
  /** Brief description of what the condition represents. */
  description: string;
  /** Summary of mechanical effects (e.g., "Disadvantage on attacks"). */
  mechanics: string[];
  /** Whether this condition automatically ends if the creature takes damage (e.g., some charm effects). */
  endsOnDamage?: boolean;
  /** Whether this condition incapacitates the creature (prevents actions/reactions). */
  isIncapacitating?: boolean;
}

/**
 * Definitions for all standard conditions.
 * Source: PHB Appendix A: Conditions
 */
export const ConditionDefinitions: Record<ConditionType, ConditionTraits> = {
  [ConditionType.Blinded]: {
    description: "You can't see and automatically fail ability checks that require sight.",
    mechanics: [
      "Auto-fail sight-based ability checks",
      "Attack rolls against you have Advantage",
      "Your attack rolls have Disadvantage",
    ],
  },
  [ConditionType.Charmed]: {
    description: "You are charmed by another creature.",
    mechanics: [
      "Can't attack the charmer",
      "Can't target the charmer with harmful abilities",
      "Charmer has Advantage on social checks against you",
    ],
  },
  [ConditionType.Deafened]: {
    description: "You can't hear and automatically fail ability checks that require hearing.",
    mechanics: [
      "Auto-fail hearing-based ability checks",
    ],
  },
  [ConditionType.Exhaustion]: {
    description: "You are physically or mentally drained.",
    mechanics: [
      "Disadvantage on ability checks (Level 1)",
      "Speed halved (Level 2)",
      "Disadvantage on attacks/saves (Level 3)",
      "Hit point maximum halved (Level 4)",
      "Speed reduced to 0 (Level 5)",
      "Death (Level 6)",
    ],
  },
  [ConditionType.Frightened]: {
    description: "You are terrified of the source of your fear.",
    mechanics: [
      "Disadvantage on ability checks and attack rolls while source is visible",
      "Can't willingly move closer to the source",
    ],
  },
  [ConditionType.Grappled]: {
    description: "You are held by another creature or effect.",
    mechanics: [
      "Speed becomes 0",
      "Can't benefit from bonuses to speed",
      "Ends if grappler is incapacitated or moved out of reach",
    ],
  },
  [ConditionType.Incapacitated]: {
    description: "You can't take actions or reactions.",
    mechanics: [
      "Can't take Actions",
      "Can't take Bonus Actions",
      "Can't take Reactions",
    ],
    isIncapacitating: true,
  },
  [ConditionType.Invisible]: {
    description: "You are impossible to see without magical aid.",
    mechanics: [
      "Heavily Obscured for the purpose of hiding",
      "Attack rolls against you have Disadvantage",
      "Your attack rolls have Advantage",
    ],
  },
  [ConditionType.Paralyzed]: {
    description: "You are frozen in place, unable to move or act.",
    mechanics: [
      "Incapacitated (no actions/reactions)",
      "Can't move or speak",
      "Auto-fail Strength and Dexterity saves",
      "Attack rolls against you have Advantage",
      "Any hit from within 5 feet is a Critical Hit",
    ],
    isIncapacitating: true,
  },
  [ConditionType.Petrified]: {
    description: "You are transformed into a solid inanimate substance (usually stone).",
    mechanics: [
      "Incapacitated (no actions/reactions)",
      "Can't move or speak",
      "Unaware of surroundings",
      "Attack rolls against you have Advantage",
      "Auto-fail Strength and Dexterity saves",
      "Resistance to all damage",
      "Immune to poison and disease",
      "Weight increases by factor of 10",
    ],
    isIncapacitating: true,
  },
  [ConditionType.Poisoned]: {
    description: "You are suffering from a toxin or venom.",
    mechanics: [
      "Disadvantage on attack rolls",
      "Disadvantage on ability checks",
    ],
  },
  [ConditionType.Prone]: {
    description: "You are lying on the ground.",
    mechanics: [
      "Only movement option is to crawl (spend extra movement)",
      "Disadvantage on attack rolls",
      "Attack rolls against you have Advantage if attacker is within 5 feet",
      "Attack rolls against you have Disadvantage if attacker is further than 5 feet",
    ],
  },
  [ConditionType.Restrained]: {
    description: "You are physically bound or entangled.",
    mechanics: [
      "Speed becomes 0",
      "Can't benefit from bonuses to speed",
      "Attack rolls against you have Advantage",
      "Your attack rolls have Disadvantage",
      "Disadvantage on Dexterity saves",
    ],
  },
  [ConditionType.Stunned]: {
    description: "You are dazed and unable to act.",
    mechanics: [
      "Incapacitated (no actions/reactions)",
      "Can't move",
      "Speak only falteringly",
      "Auto-fail Strength and Dexterity saves",
      "Attack rolls against you have Advantage",
    ],
    isIncapacitating: true,
  },
  [ConditionType.Unconscious]: {
    description: "You are knocked out.",
    mechanics: [
      "Incapacitated (no actions/reactions)",
      "Can't move or speak",
      "Unaware of surroundings",
      "Drop what you're holding",
      "Fall Prone",
      "Auto-fail Strength and Dexterity saves",
      "Attack rolls against you have Advantage",
      "Any hit from within 5 feet is a Critical Hit",
    ],
    isIncapacitating: true,
  },
  [ConditionType.Ignited]: {
    description: "You are on fire.",
    mechanics: [
      "Take fire damage at the start of each turn",
      "Can usually be extinguished as an Action",
    ],
  },
};
