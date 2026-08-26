// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 17:48:54
 * Dependents: components/DesignPreview/steps/DevPlayerConfigurator.tsx, components/DesignPreview/steps/PreviewBattleMap.tsx, utils/combat/__tests__/combatUtils.devPlaytest.test.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Builds the disposable Dev Player used by the Battle Map design preview and
 * by the tracked combat playtest proof.
 *
 * This file lives in src/utils/character because tracked tests import it. A
 * tracked file must never import a local-only Design Preview file.
 *
 * Design Preview calls this file whenever its compact character lab changes a
 * race, class, level, or subclass. It reuses the ordinary quick-character
 * builder for real class and race data, then adds one explicit preview-only
 * flag. Combat reads that flag at its normal resource boundary, so saves and
 * normal character creation remain unchanged.
 */
import type { ClassFeature, FightingStyle, PlayerCharacter } from '../../types';
import { CLASSES_DATA } from '../../data/classes';
import { ACTIVE_RACES } from '../../data/races';
import { classFeaturesForLevel } from '../../data/classes/classFeatureProgression';
import { subclassesForClass } from '../../data/classes/subclasses';
import {
  AVAILABLE_CLASS_IDS,
  createQuickCharacter,
} from '../sandbox/quickCharacterGenerator';

// ============================================================================
// Preview Configuration
// ============================================================================
// This section describes the small, revisitable set of choices the Design
// Preview owns. It deliberately does not model a character-creation wizard.
// ============================================================================

export interface DevPlayerConfiguration {
  raceId: string;
  classId: string;
  level: number;
  subclassId?: string;
}

export interface DevPlayerReview {
  racialTraits: string[];
  classFeatures: ClassFeature[];
  fightingStyles: FightingStyle[];
  spellIds: string[];
}

export const DEFAULT_DEV_PLAYER_CONFIGURATION: DevPlayerConfiguration = {
  raceId: 'human',
  classId: 'fighter',
  level: 1,
};

// The character creator deliberately hides chooser-only base families such as
// the unspecialized Elf and Dragonborn records. The preview follows that same
// source-backed boundary instead of exposing internal helper races.
const SELECTABLE_DEV_PLAYER_RACE_IDS = new Set(
  ACTIVE_RACES.map((race) => race.id),
);

// ============================================================================
// Option Normalization
// ============================================================================
// A subclass is meaningful only after the shared level-three milestone. The
// normalizer clears stale or incompatible selections instead of inventing a
// fallback, leaving the choice optional and safe to revisit.
// ============================================================================

export function normalizeDevPlayerConfiguration(
  configuration: DevPlayerConfiguration,
): DevPlayerConfiguration {
  const classId = CLASSES_DATA[configuration.classId]
    ? configuration.classId
    : DEFAULT_DEV_PLAYER_CONFIGURATION.classId;
  const raceId = SELECTABLE_DEV_PLAYER_RACE_IDS.has(configuration.raceId)
    ? configuration.raceId
    : DEFAULT_DEV_PLAYER_CONFIGURATION.raceId;
  const level = Math.max(1, Math.min(20, Math.trunc(configuration.level) || 1));
  const subclassIsValid = Boolean(
    configuration.subclassId
      && level >= 3
      && subclassesForClass(classId).some(({ id }) => id === configuration.subclassId),
  );

  return {
    raceId,
    classId,
    level,
    ...(subclassIsValid ? { subclassId: configuration.subclassId } : {}),
  };
}

// ============================================================================
// Dev Player Builder
// ============================================================================
// This uses the existing sandbox character generator for all ordinary data,
// then declares the isolated preview exception and carries every class spell
// into the disposable spellbook for the combat adapter to hydrate.
// ============================================================================

export function buildDevPlayer(
  configuration: DevPlayerConfiguration,
): PlayerCharacter {
  const normalized = normalizeDevPlayerConfiguration(configuration);
  const character = createQuickCharacter({
    name: 'Dev Player',
    raceId: normalized.raceId,
    classId: normalized.classId,
    level: normalized.level,
    useRecommendedStats: true,
  });

  if (!character) {
    // The normalizer validates against the same source data. This guard keeps
    // the preview failure visible if that data contract ever changes.
    throw new Error('Dev Player could not be built from the selected preview data.');
  }

  const classSpellIds = character.class.spellcasting?.spellList ?? [];

  return {
    ...character,
    id: 'player',
    name: 'Dev Player',
    // The quick builder establishes the base class. Refresh its feature list
    // for the target level and optional subclass so the sheet and battle map
    // see the same source-backed progression as the lab review.
    class: {
      ...character.class,
      features: classFeaturesForLevel(
        character.class,
        normalized.level,
        normalized.subclassId,
      ),
    },
    ...(normalized.subclassId ? { subclassId: normalized.subclassId } : {}),
    devPlaytest: { unlimitedSpellSlots: true },
    // A full class spell list makes the sheet and combat handoff inspectable.
    // Combat additionally uses the explicit flag below, so no prepared/known
    // limit or slot pool can quietly reintroduce a preview restriction.
    ...(character.class.spellcasting
      ? {
          spellbook: {
            cantrips: [],
            knownSpells: [],
            preparedSpells: [...classSpellIds],
          },
        }
      : { spellbook: undefined }),
  };
}

// ============================================================================
// Data-Backed Review Surface
// ============================================================================
// The UI reads this snapshot to show only choices and facts that the current
// class and race data actually define. It is a review aid, not a second rules
// engine or a fake progression-completion state.
// ============================================================================

export function getDevPlayerReview(
  configuration: DevPlayerConfiguration,
): DevPlayerReview {
  const normalized = normalizeDevPlayerConfiguration(configuration);
  const character = buildDevPlayer(normalized);

  return {
    racialTraits: [...(character.race.traits ?? [])].sort((left, right) => left.localeCompare(right)),
    classFeatures: classFeaturesForLevel(
      character.class,
      normalized.level,
      normalized.subclassId,
    ),
    fightingStyles: [...(character.class.fightingStyles ?? [])]
      .filter((style) => (style.levelAvailable ?? 1) <= normalized.level)
      .sort((left, right) => left.name.localeCompare(right.name)),
    spellIds: [...(character.class.spellcasting?.spellList ?? [])]
      .sort((left, right) => left.localeCompare(right)),
  };
}

// The panel uses these source-derived lists rather than a hand-maintained copy.
export const DEV_PLAYER_CLASS_IDS = [...AVAILABLE_CLASS_IDS]
  .sort((left, right) => (CLASSES_DATA[left]?.name ?? left).localeCompare(CLASSES_DATA[right]?.name ?? right));
export const DEV_PLAYER_RACE_IDS = ACTIVE_RACES.map((race) => race.id);
