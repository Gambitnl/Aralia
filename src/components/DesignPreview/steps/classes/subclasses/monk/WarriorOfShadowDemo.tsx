import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { createPlayerCombatCharacter } from '../../../../../../utils/combat/combatUtils';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Monk Warrior of Shadow level-3 choice
 * and records what the production character and combat assemblers actually provide.
 * It exists to make Shadow Arts visible without pretending that generic spell,
 * darkness, or teleport helpers are already wired to this subclass.
 *
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, production level-up helpers, the quick
 * character fixture, and createPlayerCombatCharacter for native ability metadata.
 */

// ============================================================================
// Canonical progression and audit constants
// ============================================================================
// The level-2 checkpoint is shared with the other Monk leaf demos so the selected
// subclass is the only meaningful difference when the user advances the fixture.
const MONK_ID = 'monk';
const SHADOW_ID = 'shadow';
const LEVEL_THREE_XP = 900;

// These are the exact spell ids named by the canonical Shadow Arts description.
// They are an audit checklist, not a copied spell grant or a substitute runtime.
export const SHADOW_ARTS_SPELL_IDS = [
  'darkness',
  'darkvision',
  'pass-without-trace',
  'silence',
  'minor-illusion',
] as const;

// Resolve the subclass through both canonical lookup surfaces so the preview cannot
// silently replace missing game data with copied labels or feature definitions.
function requireWarriorOfShadow() {
  const monk = CLASSES_DATA[MONK_ID];
  const shadow = findSubclass(monk.id, SHADOW_ID);

  if (!shadow || !subclassesForClass(monk.id).some(subclass => subclass.id === shadow.id)) {
    throw new Error('Canonical Monk Warrior of Shadow subclass is required for this demo.');
  }

  return shadow;
}

// ============================================================================
// Deterministic level checkpoints
// ============================================================================
// Build the subclass-free level-2 checkpoint through the production character path.
export function createWarriorOfShadowLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: MONK_ID,
    raceId: 'human',
    level: 1,
    name: 'Shadow Arts Progression Tester',
    useRecommendedStats: true,
  });

  if (!source) {
    throw new Error('Production quick character assembly failed for the Shadow demo.');
  }

  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Monk level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

// Apply the explicit canonical Warrior of Shadow choice at the level-3 milestone.
export function createWarriorOfShadowLevel3(
  level2: PlayerCharacter = createWarriorOfShadowLevel2(),
): PlayerCharacter {
  const shadow = requireWarriorOfShadow();

  if (level2.level !== 2) {
    throw new Error('Warrior of Shadow level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: shadow.id },
  );

  if (level3.level !== 3 || level3.subclassId !== shadow.id) {
    throw new Error('Canonical Monk level-3 progression did not apply Warrior of Shadow.');
  }

  return level3;
}

// Read the exact feature objects granted by canonical class and subclass progression.
export function getWarriorOfShadowFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[MONK_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Native runtime audit
// ============================================================================
// Inspect only production-owned state. A missing value is useful evidence here:
// it tells the preview exactly which subclass-specific transaction is still absent.
export function getWarriorOfShadowNativeAudit(character: PlayerCharacter) {
  const combatCharacter = createPlayerCombatCharacter(character);
  const abilityIds = combatCharacter.abilities.map(ability => ability.id);
  const spellbookIds = [
    ...(character.spellbook?.cantrips ?? []),
    ...(character.spellbook?.knownSpells ?? []),
    ...(character.spellbook?.preparedSpells ?? []),
  ];

  return {
    abilityIds,
    darkvisionRange: character.darkvisionRange,
    focus: character.limitedUses?.monks_focus,
    spellbookIds,
    flurry: combatCharacter.abilities.find(ability => ability.id === 'flurry_of_blows'),
    hasShadowStep: abilityIds.includes('shadow_step'),
  };
}

// ============================================================================
// Honest subclass runtime boundary
// ============================================================================
// Production currently has generic spell and teleport infrastructure, but no
// subclass-aware Shadow Arts or Shadow Step transaction. The preview exposes the
// exact gap instead of adding a second combat engine with fabricated outcomes.
export const WARRIOR_OF_SHADOW_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Shadow Arts is granted at level 3 and names Darkness, Darkvision, Pass without Trace, Silence, and Minor Illusion, but no production path binds those grants to Warrior of Shadow, Focus payment, component bypass, movable Darkness, or magical-darkness vision. No subclass-bound Shadow Step ability validates dim light/darkness start and destination, 60-foot range, occupancy, or next-melee-attack advantage, and no level-11 Focus upgrade or level-17 Cloak of Shadows transaction is available. Generic spell, darkness, darkvision, teleport, and advantage helpers are not subclass proof. This demo does not simulate casting, Focus debit, spell persistence, vision, teleport, advantage, resource reset, or combat-log outcome.';

// ============================================================================
// Warrior of Shadow demonstration surface
// ============================================================================
// The component owns canonical progression, native metadata, a spell audit, and
// Reset. It intentionally has no fake cast, teleport, or attack controls.
export const WarriorOfShadowDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createWarriorOfShadowLevel2());
  const features = useMemo(() => getWarriorOfShadowFeatures(character), [character]);
  const native = useMemo(() => getWarriorOfShadowNativeAudit(character), [character]);
  const shadow = requireWarriorOfShadow();
  const isLevel3 = character.level === 3 && character.subclassId === shadow.id;
  const shadowArtsFeature = features.find(feature => feature.id === 'shadow_arts');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createWarriorOfShadowLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseShadow = (): void => setCharacter(createWarriorOfShadowLevel3());

  return (
    <section
      aria-label="Warrior of Shadow progression demonstration"
      data-testid="warrior-of-shadow-progression-demo"
      className="mt-4 rounded border border-violet-400/40 bg-violet-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Warrior of Shadow</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Monk level 2 baseline to the level 3 Warrior of Shadow choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Monk · Warrior of Shadow
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Warrior of Shadow progression controls">
        <Button
          type="button"
          variant={character.level === 2 ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={character.level === 2}
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Level 2 baseline
        </Button>
        <Button
          type="button"
          variant={isLevel3 ? 'action' : 'ghost'}
          size="sm"
          aria-pressed={isLevel3}
          onClick={chooseShadow}
          className="rounded border border-violet-300/70 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100"
        >
          Choose Shadow / Level 3
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
        >
          Reset
        </Button>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Level</dt>
          <dd data-testid="shadow-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="shadow-subclass" className="mt-1 font-semibold text-violet-200">
            {character.subclassId ? shadow.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="shadow-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-violet-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="shadow-grant-status"
        className="mt-3 border-l-2 border-violet-400 pl-2 text-xs leading-relaxed text-violet-100"
      >
        {isLevel3
          ? `Canonical grant present: ${shadowArtsFeature?.id} - ${shadowArtsFeature?.name}.`
          : 'Canonical subclass grant absent before the level-3 choice: shadow_arts.'}
      </p>

      <div
        data-testid="shadow-arts-audit"
        className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs"
      >
        <p className="font-semibold text-slate-300">Shadow Arts source and native audit</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {SHADOW_ARTS_SPELL_IDS.map(spellId => (
            <li key={spellId}>
              <code className="text-violet-200">{spellId}</code>
              <span className="ml-2 text-rose-200">
                {native.spellbookIds.includes(spellId) ? 'Native spellbook entry' : 'No subclass spell grant'}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Focus resource</dt>
            <dd data-testid="shadow-focus-audit" className="text-rose-200">
              {native.focus ? `${native.focus.current}/${native.focus.max}` : 'No native Focus resource binding'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Darkvision</dt>
            <dd data-testid="shadow-darkvision-audit" className="text-rose-200">
              {native.darkvisionRange > 0 ? `${native.darkvisionRange} feet` : 'No Shadow Arts darkvision mutation'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Shadow Step</dt>
            <dd data-testid="shadow-step-audit" className="text-rose-200">
              {native.hasShadowStep ? 'Native subclass ability' : 'No subclass-bound teleport ability'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Native Monk ability</dt>
            <dd className="text-slate-200">
              {native.flurry ? `${native.flurry.id} (${native.flurry.cost.type})` : 'No native Monk ability'}
            </dd>
          </div>
        </dl>
      </div>

      <p
        data-testid="shadow-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'shadow' }); canonical Shadow Arts grant is present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 Shadow Arts grant is absent.'}
      </p>

      <p
        data-testid="shadow-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {WARRIOR_OF_SHADOW_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default WarriorOfShadowDemo;
