import { Feat } from '../../types';
/**
 * ARCHITECTURAL CONTEXT:
 * This file serves as the 'Feats Repository' for Aralia. It is a static
 * data structure used by the Character Creator and Level-Up systems to
 * populate selection menus.
 *
 * Recent updates focus on 'Selectable Benefits'. Many feats (like Resilient
 * or Skilled) now support multiple ability score or skill options rather
 * than hardcoded values. This shift requires the consumer (UI) to handle
 * nested selection logic which is flagged via 'selectableAbilityScores'
 * or 'selectableSkillCount' properties.
 *
 * @file src/data/feats/featsData.ts
 */
export declare const FEATS_DATA: Feat[];
