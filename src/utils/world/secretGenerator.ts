/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/secretGenerator.ts
 * Generates procedural secrets for NPCs and Factions.
 */

import { v4 as uuidv4 } from 'uuid';
import { Secret } from '../../types/identity';
import { SeededRandom } from '../random/seededRandom';

// -----------------------------------------------------------------------------
// Data Tables
// -----------------------------------------------------------------------------

const SECRET_TEMPLATES = {
  political: [
    "is secretly funding the rebellion",
    "is blackmailing the High Justiciar",
    "plans to assassinate a rival",
    "forged their noble title documents",
    "is a spy for a foreign power",
    "knows the location of the missing heir",
    "bribed the magistrate to ignore a crime",
    "is plotting a coup against the leadership",
    "has promised their vote to two opposing sides",
    "is hiding a fugitive diplomat"
  ],
  military: [
    "sold army supplies to bandits",
    "retreated against orders, causing a massacre",
    "is planning to defect to the enemy",
    "sabotaged the city defenses",
    "knows a secret entrance to the castle",
    "falsified reports of enemy strength",
    "is hiding a cursed weapon",
    "executed prisoners of war illegally",
    "lost the regiment's payroll gambling",
    "is actually a deserter under a new name"
  ],
  personal: [
    "has an illegitimate child with a commoner",
    "is heavily in debt to a crime syndicate",
    "is suffering from a magical illness",
    "murdered their sibling for inheritance",
    "is a secret worshipper of a forbidden god",
    "is addicted to a rare narcotic",
    "stole a family heirloom from a relative",
    "is having an affair with a rival's spouse",
    "cannot actually read or write",
    "is being impersonated by a doppelganger"
  ],
  financial: [
    "is completely bankrupt and living on credit",
    "is laundering money for pirates",
    "owns a secret stake in an illegal fighting pit",
    "embezzled funds from the guild treasury",
    "uses slave labor in their mines",
    "trades in forbidden artifacts",
    "is evading all taxes through shell companies",
    "lost the family estate in a bet",
    "is funding a criminal enterprise",
    "counterfeits gold coins"
  ],
  magical: [
    "made a pact with a fiend for power",
    "is possessed by a minor demon",
    "keeps a dangerous monster in their basement",
    "uses mind-control magic on their staff",
    "is actually a polymorphed dragon",
    "is draining life force to stay young",
    "stole a grimoire from the academy",
    "is practicing necromancy",
    "was responsible for the magical plague",
    "is a construct believing it is human"
  ]
};

const SECRET_TAGS: Record<string, Secret['tags'][number]> = {
  political: 'political',
  military: 'military',
  personal: 'personal',
  financial: 'financial',
  magical: 'magical'
};

// -----------------------------------------------------------------------------
// Generator Logic
// -----------------------------------------------------------------------------

export interface SecretGenerationOptions {
  seed?: number;
  subjectId: string;
  subjectName?: string; // For formatting the text nicely
  category?: keyof typeof SECRET_TEMPLATES;
  minValue?: number;
  maxValue?: number;
}

// Deterministic UUID generator placeholder (since uuid v4 is random)
// In a real scenario, we might want a seeded ID generator, but for now we'll accept random IDs
// OR we can generate IDs based on seed if provided.
function generateId(rng?: SeededRandom): string {
    if (rng) {
        // Poor man's deterministic ID
        return `sec_${Math.floor(rng.next() * 1000000000)}`;
    }
    return uuidv4();
}

export function generateSecret(options: SecretGenerationOptions): Secret {
  const rng = new SeededRandom(options.seed || Math.random() * 10000);
  const categories = Object.keys(SECRET_TEMPLATES) as (keyof typeof SECRET_TEMPLATES)[];

  const category = options.category || rng.pick(categories);
  const template = rng.pick(SECRET_TEMPLATES[category]);

  const value = Math.floor(rng.next() * ((options.maxValue || 10) - (options.minValue || 1) + 1)) + (options.minValue || 1);

  // 30% chance a secret is just a rumor (unverified)
  const verified = rng.next() > 0.3;

  const content = options.subjectName
    ? `${options.subjectName} ${template}.`
    : `The subject ${template}.`;

  return {
    id: generateId(options.seed ? rng : undefined),
    subjectId: options.subjectId,
    content,
    verified,
    value,
    knownBy: [], // Initially known by no one (except the generator)
    tags: [SECRET_TAGS[category]]
  };
}
