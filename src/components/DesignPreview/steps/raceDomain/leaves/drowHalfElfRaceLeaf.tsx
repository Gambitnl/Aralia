import React, { useState } from 'react';
import { applyRacialSpellGrantsByLevel } from '../../../../../utils/character/characterUtils';
import {
  calculateProficiencyBonus,
  rollSavingThrow,
  type SaveAdvantageModifier,
  type SavingThrowResult,
} from '../../../../../utils/character/savingThrowUtils';
import { createPlayerCombatCharacter } from '../../../../../utils/combat/combatUtils';
import { createQuickCharacter } from '../../../../../utils/sandbox/quickCharacterGenerator';
import { Button } from '../../../../ui/Button';
import type { CombatCharacter } from '../../../../../types/combat';
import type { PlayerCharacter, Race } from '../../../../../types';
import type { RaceDomainLeafProps, RaceDomainLeafRegistration } from '../raceDomainTypes';

/**
 * This file gives the canonical Drow Half-Elf one inspectable Fey Ancestry save
 * transaction in the Race domain.
 *
 * It builds a disposable actor through production character assembly, keeps the
 * parser's Fey Ancestry projection visible, and sends an ordinary save and a
 * Charmed-context save through the native saving-throw and dice helpers. The
 * parser has no condition-context field, so one small adapter narrows only the
 * canonical Fey Ancestry text to the `charmed` effect tag used by the helper.
 *
 * Called by: RaceDomainShell.tsx through automatic ./leaves discovery.
 * Depends on: canonical Drow Half-Elf data, production actor assembly, the
 * racial parser, native saving-throw/dice helpers, and the Race domain contract.
 */

// ============================================================================
// Canonical Drow Half-Elf Facts
// ============================================================================
// These readers always use the Race supplied by the shell. A missing or changed
// canonical fact rejects the demo instead of allowing copied prose to drift.
// ============================================================================

export const DROW_HALF_ELF_ACTOR_ID = 'drow-half-elf-fey-ancestry-actor';
export const DROW_HALF_ELF_SCENARIO_LEVEL = 5;
export const DROW_HALF_ELF_CHARMED_SAVE_DC = 15;

const DROW_HALF_ELF_VISION_TRAIT = 'Vision';
const DROW_HALF_ELF_FEY_ANCESTRY_TRAIT = 'Fey Ancestry';
const DROW_HALF_ELF_SKILL_VERSATILITY_TRAIT = 'Skill Versatility';
const DROW_HALF_ELF_MAGIC_TRAIT = 'Drow Magic';

/** Find one named trait without importing a sibling leaf or duplicating data. */
export function getCanonicalDrowHalfElfTrait(race: Race, traitName: string): string | null {
  return race.traits.find(trait => trait.trim().startsWith(`${traitName}:`)) ?? null;
}

/** Return the canonical 60-foot Vision wording used by the facts panel. */
export function getCanonicalDrowHalfElfVisionTrait(race: Race): string | null {
  return getCanonicalDrowHalfElfTrait(race, DROW_HALF_ELF_VISION_TRAIT);
}

/** Return the canonical Fey Ancestry wording used by the save adapter. */
export function getCanonicalDrowHalfElfFeyAncestryTrait(race: Race): string | null {
  return getCanonicalDrowHalfElfTrait(race, DROW_HALF_ELF_FEY_ANCESTRY_TRAIT);
}

/** Return the canonical Skill Versatility wording without choosing a skill. */
export function getCanonicalDrowHalfElfSkillVersatilityTrait(race: Race): string | null {
  return getCanonicalDrowHalfElfTrait(race, DROW_HALF_ELF_SKILL_VERSATILITY_TRAIT);
}

/** Return the canonical Drow Magic wording without claiming a cast. */
export function getCanonicalDrowHalfElfMagicTrait(race: Race): string | null {
  return getCanonicalDrowHalfElfTrait(race, DROW_HALF_ELF_MAGIC_TRAIT);
}

/** Confirm every canonical fact surfaced by this leaf is still present. */
export function hasCanonicalDrowHalfElfFeatures(race: Race): boolean {
  const vision = getCanonicalDrowHalfElfVisionTrait(race);
  const feyAncestry = getCanonicalDrowHalfElfFeyAncestryTrait(race);
  const skillVersatility = getCanonicalDrowHalfElfSkillVersatilityTrait(race);
  const drowMagic = getCanonicalDrowHalfElfMagicTrait(race);
  // Older saved or test Race records may omit optional ability bonuses. Treat
  // that absence as missing canonical support instead of inventing a bonus.
  const abilityBonuses = race.abilityBonuses ?? [];
  const charismaBonus = abilityBonuses.some(
    bonus => bonus.ability === 'Charisma' && bonus.bonus === 2,
  );
  const flexibleBonuses = abilityBonuses.some(
    bonus => bonus.ability === 'Any' && bonus.bonus === 1 && bonus.choiceCount === 2,
  );

  return race.id === 'half_elf_drow'
    && race.name === 'Drow Half-Elf'
    && !!vision
    && /60 feet/i.test(vision)
    && /darkness/i.test(vision)
    && !!feyAncestry
    && /advantage on saving throws/i.test(feyAncestry)
    && /charmed/i.test(feyAncestry)
    && /sleep/i.test(feyAncestry)
    && !!skillVersatility
    && /one skill of your choice/i.test(skillVersatility)
    && !!drowMagic
    && /dancing lights/i.test(drowMagic)
    && /3rd level/i.test(drowMagic)
    && /faerie fire/i.test(drowMagic)
    && /5th level/i.test(drowMagic)
    && /darkness/i.test(drowMagic)
    && /long rest/i.test(drowMagic)
    && /charisma is your spellcasting ability/i.test(drowMagic)
    && charismaBonus
    && flexibleBonuses;
}

/** Format canonical ability bonuses for the visible fact panel. */
export function getCanonicalDrowHalfElfAbilityBonusFacts(race: Race): readonly string[] {
  // Keep a missing optional field visibly empty rather than selecting a value.
  const abilityBonuses = race.abilityBonuses ?? [];
  return abilityBonuses.map(bonus => (
    bonus.ability === 'Any'
      ? `Any +${bonus.bonus} (choose ${bonus.choiceCount ?? 1})`
      : `${bonus.ability} +${bonus.bonus}`
  ));
}

// ============================================================================
// Narrow Fey Ancestry Context Adapter
// ============================================================================
// The racial parser is intentionally retained as the source of the raw
// modifier. Its text says "against being charmed", but the native save helper
// only receives effect tags such as `charmed`. This adapter supplies that one
// canonical-derived bridge and leaves sleep, sensing, and condition lifecycle
// outside the preview until their native systems expose the required context.
// ============================================================================

function isFeyAncestrySaveProjection(modifier: string): boolean {
  return /saving throws?/i.test(modifier) && /charm/i.test(modifier);
}

/** Return the structured native modifier for a canonical Charmed save. */
export function getDrowHalfElfFeyAncestrySaveAdapter(
  race: Race,
): SaveAdvantageModifier | null {
  const trait = getCanonicalDrowHalfElfFeyAncestryTrait(race);
  if (!trait || !/advantage on saving throws/i.test(trait) || !/charmed/i.test(trait)) {
    return null;
  }

  return {
    type: 'advantage',
    context: 'saving_throw',
    against: ['charmed'],
    source: 'Fey Ancestry (canonical Charmed context)',
  };
}

/** Prove that the production parser exposed the canonical free-text modifier. */
export function hasDrowHalfElfFeyAncestryParserProjection(
  character: Pick<PlayerCharacter, 'modifiers'> | Pick<CombatCharacter, 'modifiers'> | null,
): boolean {
  return character?.modifiers?.advantage.some(isFeyAncestrySaveProjection) ?? false;
}

/** Remove only the raw projection before the narrowed context comparison. */
export function applyDrowHalfElfFeyAncestryContext(
  actor: CombatCharacter,
): CombatCharacter {
  const modifiers = actor.modifiers ?? { advantage: [], disadvantage: [], bonuses: [] };
  const contextFreeAdvantages = modifiers.advantage.filter(
    modifier => !isFeyAncestrySaveProjection(modifier),
  );

  return {
    ...actor,
    modifiers: {
      ...modifiers,
      // The structured adapter is passed directly to rollSavingThrow below.
      // Keeping this list context-free prevents legacy free-text matching from
      // granting Fey Ancestry advantage on an unrelated ordinary save.
      advantage: contextFreeAdvantages,
      disadvantage: [...modifiers.disadvantage],
      bonuses: [...modifiers.bonuses],
    },
  };
}

// ============================================================================
// Production Actor And Deterministic Save Transaction
// ============================================================================
// The actor is created by the same quick-character and persistent-to-combat
// bridge used by sandbox scenarios. Only the RNG stream is pinned for proof;
// save ability, modifiers, proficiency, and dice selection remain native.
// ============================================================================

const DROW_HALF_ELF_ACTOR_CONFIG = {
  name: 'Drow Half-Elf Fey Ancestry Tester',
  raceId: 'half_elf_drow',
  classId: 'rogue',
  level: DROW_HALF_ELF_SCENARIO_LEVEL,
  stats: [10, 10, 10, 10, 12, 14] as [number, number, number, number, number, number],
};

export interface DrowHalfElfSaveSnapshot {
  condition: 'ordinary save' | 'avoid/end Charmed';
  d20Rolls: readonly number[];
  save: SavingThrowResult;
}

export interface DrowHalfElfSaveResolution {
  status: 'resolved' | 'rejected';
  reason: 'resolved' | 'canonical_trait_missing' | 'assembly_unavailable' | 'parser_projection_missing' | 'context_adapter_missing';
  ordinary: DrowHalfElfSaveSnapshot | null;
  charmed: DrowHalfElfSaveSnapshot | null;
}

export interface DrowHalfElfScenarioState {
  actor: CombatCharacter | null;
  outcome: string;
  lastResolution: DrowHalfElfSaveResolution | null;
}

/** Build a visible rejection without inventing partial mechanic state. */
function unavailableDrowHalfElfScenario(
  reason: DrowHalfElfSaveResolution['reason'],
  outcome: string,
): DrowHalfElfScenarioState {
  return {
    actor: null,
    outcome,
    lastResolution: {
      status: 'rejected',
      reason,
      ordinary: null,
      charmed: null,
    },
  };
}

/** Assemble and parse the production actor used by both save branches. */
export function createDrowHalfElfScenario(race: Race): DrowHalfElfScenarioState {
  if (!hasCanonicalDrowHalfElfFeatures(race)) {
    return unavailableDrowHalfElfScenario(
      'canonical_trait_missing',
      'Fey Ancestry unavailable: canonical Drow Half-Elf facts no longer contain the demonstrated rule set.',
    );
  }

  const quickCharacter = createQuickCharacter(DROW_HALF_ELF_ACTOR_CONFIG);
  if (!quickCharacter) {
    return unavailableDrowHalfElfScenario(
      'assembly_unavailable',
      'Fey Ancestry unavailable: production quick-character assembly rejected the canonical actor.',
    );
  }

  // This parser call is the source of the actor's racial spells and raw Fey
  // Ancestry modifier. The leaf never turns those grants into a spell cast.
  const parsedCharacter = applyRacialSpellGrantsByLevel(
    quickCharacter,
    DROW_HALF_ELF_SCENARIO_LEVEL,
  );
  if (!hasDrowHalfElfFeyAncestryParserProjection(parsedCharacter)) {
    return unavailableDrowHalfElfScenario(
      'parser_projection_missing',
      'Fey Ancestry unavailable: the production racial parser did not expose the canonical save projection.',
    );
  }

  // The native combat bridge supplies stats, save proficiencies, creature type,
  // and the parsed modifier list used by rollSavingThrow.
  const actor = createPlayerCombatCharacter(parsedCharacter);
  return {
    actor: {
      ...actor,
      id: DROW_HALF_ELF_ACTOR_ID,
    },
    outcome: 'Ready: production Drow Half-Elf actor; ordinary and Charmed-context saving throws are available.',
    lastResolution: null,
  };
}

/** Resolve the ordinary baseline and the canonical Fey Ancestry save. */
export function resolveDrowHalfElfFeyAncestry(
  scenario: DrowHalfElfScenarioState,
  race: Race,
  rng: () => number = Math.random,
): DrowHalfElfScenarioState {
  const actor = scenario.actor;
  const adapter = getDrowHalfElfFeyAncestrySaveAdapter(race);
  if (!actor) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the production actor is unavailable.',
      lastResolution: { status: 'rejected', reason: 'assembly_unavailable', ordinary: null, charmed: null },
    };
  }
  if (!hasDrowHalfElfFeyAncestryParserProjection(actor)) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the parser-backed save projection is unavailable.',
      lastResolution: { status: 'rejected', reason: 'parser_projection_missing', ordinary: null, charmed: null },
    };
  }
  if (!adapter) {
    return {
      ...scenario,
      outcome: 'Fey Ancestry comparison rejected: the canonical Charmed context adapter is unavailable.',
      lastResolution: { status: 'rejected', reason: 'context_adapter_missing', ordinary: null, charmed: null },
    };
  }

  // Capture the raw d20 faces while the native helper decides how many dice to
  // roll and which face to keep. The ordinary branch consumes one face; the
  // Charmed branch consumes two because the canonical adapter grants advantage.
  const ordinaryRolls: number[] = [];
  const ordinaryActor = applyDrowHalfElfFeyAncestryContext(actor);
  const ordinarySave = rollSavingThrow(
    ordinaryActor,
    'Wisdom',
    DROW_HALF_ELF_CHARMED_SAVE_DC,
    undefined,
    { tags: ['ordinary save'] },
    undefined,
    {
      rng: () => {
        const value = rng();
        ordinaryRolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    },
  );

  const charmedRolls: number[] = [];
  const charmedActor = applyDrowHalfElfFeyAncestryContext(actor);
  const charmedSave = rollSavingThrow(
    charmedActor,
    'Wisdom',
    DROW_HALF_ELF_CHARMED_SAVE_DC,
    undefined,
    { tags: ['charmed'] },
    [adapter],
    {
      rng: () => {
        const value = rng();
        charmedRolls.push(Math.floor(value * 20) + 1);
        return value;
      },
    },
  );

  const ordinary: DrowHalfElfSaveSnapshot = {
    condition: 'ordinary save',
    d20Rolls: ordinaryRolls,
    save: ordinarySave,
  };
  const charmed: DrowHalfElfSaveSnapshot = {
    condition: 'avoid/end Charmed',
    d20Rolls: charmedRolls,
    save: charmedSave,
  };

  return {
    ...scenario,
    outcome: `Fey Ancestry resolved: ordinary save ${ordinarySave.total}; Charmed save kept ${charmedSave.roll} from ${charmedRolls.join(' / ')} for ${charmedSave.total}.`,
    lastResolution: { status: 'resolved', reason: 'resolved', ordinary, charmed },
  };
}

// ============================================================================
// Visible Race Leaf Surface
// ============================================================================
// The panel shows the tested transaction, the canonical facts, and the exact
// unsupported boundary. Reset is provided by the shell's keyed remount.
// ============================================================================

function DrowHalfElfRaceLeafContent({ race, state, onScenarioEvent }: RaceDomainLeafProps) {
  const [scenario, setScenario] = useState(() => createDrowHalfElfScenario(race));
  const visionTrait = getCanonicalDrowHalfElfVisionTrait(race);
  const feyAncestryTrait = getCanonicalDrowHalfElfFeyAncestryTrait(race);
  const skillVersatilityTrait = getCanonicalDrowHalfElfSkillVersatilityTrait(race);
  const drowMagicTrait = getCanonicalDrowHalfElfMagicTrait(race);
  const abilityBonusFacts = getCanonicalDrowHalfElfAbilityBonusFacts(race);

  // Publish the same native result shown in the panel to the shell event log.
  const handleResolve = () => {
    const nextScenario = resolveDrowHalfElfFeyAncestry(scenario, race);
    setScenario(nextScenario);
    const resolution = nextScenario.lastResolution;
    if (resolution?.status === 'resolved') {
      onScenarioEvent(`Drow Half-Elf FEY ANCESTRY RESOLVED: ordinary ${resolution.ordinary?.save.total}; Charmed faces ${resolution.charmed?.d20Rolls.join(' / ')} kept ${resolution.charmed?.save.roll}; total ${resolution.charmed?.save.total}.`);
    } else {
      onScenarioEvent(`Drow Half-Elf FEY ANCESTRY REJECTED: ${nextScenario.outcome}`);
    }
  };

  return (
    <section aria-labelledby="drow-half-elf-race-title" data-testid="drow-half-elf-race-leaf">
      <h4 id="drow-half-elf-race-title">Drow Half-Elf · Fey Ancestry</h4>

      <p data-testid="drow-half-elf-actor">
        Actor: {scenario.actor?.name ?? 'missing'}; Level {scenario.actor?.level ?? 'unknown'}; PB +{scenario.actor ? calculateProficiencyBonus(scenario.actor.level) : 'unknown'}; Charisma {scenario.actor?.stats.charisma ?? 'unknown'}; parser Fey Ancestry projection {hasDrowHalfElfFeyAncestryParserProjection(scenario.actor) ? 'native' : 'missing'}.
      </p>

      <Button type="button" variant="primary" size="sm" onClick={handleResolve}>
        Resolve Fey Ancestry save
      </Button>

      <p aria-live="polite" role="status" data-testid="drow-half-elf-outcome">{scenario.outcome}</p>
      <div data-testid="drow-half-elf-save-result">
        {scenario.lastResolution?.status === 'resolved'
          ? <>
            <p>Ordinary context: d20 face {scenario.lastResolution.ordinary?.d20Rolls.join(' / ')}; Wisdom save total {scenario.lastResolution.ordinary?.save.total}.</p>
            <p>Avoid/end Charmed: d20 faces {scenario.lastResolution.charmed?.d20Rolls.join(' / ')}; kept {scenario.lastResolution.charmed?.save.roll}; Wisdom save total {scenario.lastResolution.charmed?.save.total}; advantage applied.</p>
          </>
          : 'No Fey Ancestry save comparison resolved yet.'}
      </div>

      <div data-testid="drow-half-elf-canonical-facts">
        <strong>Canonical Drow Half-Elf facts:</strong>
        <ul>
          <li>Vision: {visionTrait ?? 'unavailable'} Canonical 60-ft Darkvision is shown as a fact; sensing is not simulated.</li>
          <li>Fey Ancestry: {feyAncestryTrait ?? 'unavailable'} The Charmed save is the demonstrated transaction; sleep immunity is a fact-only boundary.</li>
          <li>Skill Versatility: {skillVersatilityTrait ?? 'unavailable'} The skill choice is not auto-selected.</li>
          <li>Ability bonuses: {abilityBonusFacts.join('; ') || 'unavailable'} No flexible ability choice is auto-selected.</li>
          <li data-testid="drow-half-elf-spell-gates">Drow Magic: {drowMagicTrait ?? 'unavailable'} The cantrip, level gates, Long Rest recovery, and Charisma are facts; no spell is cast.</li>
        </ul>
      </div>

      <p data-testid="drow-half-elf-boundary">
        Boundary: the parser supplies the raw Fey Ancestry projection, while this leaf derives only a canonical Charmed effect tag for the native save helper. It does not simulate condition application or removal, magic sleep immunity, sensing, skill selection, spell casting, or 2D/3D render proof.
      </p>
      <span hidden>{state.resetCount}</span>
    </section>
  );
}

/** The shell's resetCount remounts the actor and clears the prior resolution. */
export function DrowHalfElfRaceLeaf(props: RaceDomainLeafProps) {
  return <DrowHalfElfRaceLeafContent key={`${props.race.id}-${props.state.resetCount}`} {...props} />;
}

/** Automatic discovery consumes this exact named registration export. */
export const RACE_DOMAIN_LEAF: RaceDomainLeafRegistration = {
  id: 'drow-half-elf-fey-ancestry',
  raceId: 'half_elf_drow',
  label: 'Drow Half-Elf · Fey Ancestry',
  description: 'Production-backed ordinary versus Charmed saving throw comparison with canonical Drow Half-Elf facts and explicit unsupported boundaries.',
  Component: DrowHalfElfRaceLeaf,
};

export default RACE_DOMAIN_LEAF;
