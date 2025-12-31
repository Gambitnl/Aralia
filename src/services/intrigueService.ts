/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/intrigueService.ts
 * Service for managing Secrets, Rumors, and the flow of information.
 */

import { v4 as uuidv4 } from 'uuid';
import { Secret, SecretType, SecretSeverity, ActiveRumor, Leverage } from '../types/intrigue';

const SEVERITY_VALUES: Record<SecretSeverity, number> = {
  'trivial': 5,
  'damaging': 25,
  'ruinous': 60,
  'existential': 100
};

/**
 * Generates a new Secret about a subject.
 */
export const generateSecret = (
  subjectId: string,
  subjectName: string,
  type: SecretType,
  severity: SecretSeverity,
  content: string
): Secret => {
  const baseValue = SEVERITY_VALUES[severity];
  const variation = Math.floor(Math.random() * 10) - 5; // +/- 5

  return {
    id: uuidv4(),
    subjectId,
    subjectName,
    type,
    severity,
    content,
    verificationStatus: 'verified', // Generated secrets are true by default unless marked otherwise
    knownBy: [],
    creationTimestamp: Date.now(),
    lastUpdatedTimestamp: Date.now(),
    value: Math.max(1, baseValue + variation)
  };
};

/**
 * Creates a Rumor based on a (possibly fake) Secret.
 */
export const plantRumor = (
  secret: Secret,
  locationId: string,
  credibility: number = 50
): ActiveRumor => {
  return {
    id: uuidv4(),
    secretId: secret.id,
    locationId,
    virality: 10, // Starts low
    credibility, // Initial belief
    modifiers: []
  };
};

/**
 * Simulates the "telephone game" effect on a rumor, potentially distorting the content
 * if we were storing mutable content on the Rumor itself.
 * For now, it updates the virality and credibility.
 */
export const propagateRumor = (rumor: ActiveRumor): ActiveRumor => {
  const growth = Math.floor(Math.random() * 5);
  const decay = Math.floor(Math.random() * 2);

  return {
    ...rumor,
    virality: Math.min(100, rumor.virality + growth - decay),
    credibility: Math.max(0, Math.min(100, rumor.credibility + (Math.random() > 0.5 ? 1 : -1)))
  };
};

/**
 * Attempts to verify a rumor, turning it into a verified Secret for the investigator.
 * Returns true if successful.
 */
export const investigateRumor = (
  rumor: ActiveRumor,
  investigatorSkill: number,
  secretDifficulty: number // usually derived from severity
): boolean => {
  const roll = Math.floor(Math.random() * 20) + 1 + investigatorSkill;
  // Difficulty is modified by how credible the rumor is (easier to verify if everyone believes it?
  // Or harder to find truth if it's a lie? Let's say high credibility helps find *sources*).
  const dc = secretDifficulty - Math.floor(rumor.credibility / 10);

  return roll >= dc;
};

/**
 * Calculates the effectiveness of using a Secret as Leverage against a target.
 */
export const calculateLeverageValue = (secret: Secret, targetId: string): number => {
  // If the secret is about the target, it's most effective.
  if (secret.subjectId === targetId) {
    return secret.value;
  }

  // If it's about someone else, it might still be useful if the target cares about them.
  // TODO: Check relationship graph. For now, return reduced value.
  return Math.floor(secret.value * 0.25);
};

/**
 * Creates a Leverage object to track an active blackmail attempt.
 */
export const createLeverage = (secret: Secret, targetId: string, demand: string): Leverage => {
  const threat = calculateLeverageValue(secret, targetId);

  return {
    id: uuidv4(),
    secretId: secret.id,
    targetId,
    demand,
    threatLevel: threat,
    status: 'active'
  };
};
