/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/secretGenerator.ts
 * Generates procedural secrets for NPCs and Factions.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: utils/world/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

// -----------------------------------------------------------------------------
// Deterministic secret ids (agora-7687)
// -----------------------------------------------------------------------------
//
// WHAT CHANGED: 'seed' was optional. Without one, generateSecret seeded itself
// from Math.random() and stamped the secret with a uuidv4, so the same world
// re-generated different secrets with different ids on every load. With one, the
// id was `sec_` plus one draw off the same stream that had already picked the
// category and template, so two subjects sharing a seed collided on the id while
// two secrets about the SAME subject were indistinguishable by id alone.
//
// The seed is now required, the uuid and Math.random paths are gone, and the id
// is a hash over the secret's own identity (seed, subject, category, content).
// The same world seed and subject therefore reproduce the same secret and the
// same id across sessions, and different subjects cannot collide.
//
// WHAT IS PRESERVED: the Secret shape, the template tables, the category and
// value roll order, and the 30% rumor chance are all unchanged.
//
// MIGRATION: `seed` is now required. The function had no callers in src/ at the
// time of this change, so no call site needed updating; a new caller must pass
// the world/run seed it wants the secret to be reproducible against.

export interface SecretGenerationOptions {
  /**
   * REQUIRED. The deterministic stream this secret is drawn from - normally the
   * world seed mixed with whatever produced the subject.
   */
  seed: number;
  subjectId: string;
  subjectName?: string; // For formatting the text nicely
  category?: keyof typeof SECRET_TEMPLATES;
  minValue?: number;
  maxValue?: number;
}

/**
 * FNV-1a over the secret's identifying parts, rendered base36.
 *
 * Deliberately NOT a draw off the generator's own stream: the id must depend on
 * WHICH secret this is (subject, category, content), not on how many numbers the
 * generator happened to consume before reaching it.
 */
function generateId(parts: (string | number)[]): string {
  const text = parts.join('|');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'sec_' + (hash >>> 0).toString(36).padStart(7, '0');
}

export function generateSecret(options: SecretGenerationOptions): Secret {
  const rng = new SeededRandom(options.seed);
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
    id: generateId([options.seed, options.subjectId, category, template]),
    subjectId: options.subjectId,
    content,
    verified,
    value,
    knownBy: [], // Initially known by no one (except the generator)
    tags: [SECRET_TAGS[category]]
  };
}
