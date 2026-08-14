import React, { useMemo, useState } from 'react';
import { Button } from '../../../../../ui/Button';
import { CLASSES_DATA } from '../../../../../../data/classes';
import { classFeaturesForLevel } from '../../../../../../data/classes/classFeatureProgression';
import { findSubclass, subclassesForClass } from '../../../../../../data/classes/subclasses';
import { performLevelUp } from '../../../../../../utils/character';
import { createQuickCharacter } from '../../../../../../utils/sandbox/quickCharacterGenerator';
import type { PlayerCharacter } from '../../../../../../types/character';

/**
 * This component demonstrates the canonical Cleric Light Domain level-3 choice.
 * It exists to make the real level-2 checkpoint, exact subclass feature IDs, and
 * unsupported Light Domain runtime boundary visible in the Classes preview.
 * Called by: subclassDemoRegistry.ts through the Classes domain shell.
 * Depends on: canonical class/subclass data, classFeaturesForLevel, performLevelUp,
 * and the production quick-character assembler.
 */

// ============================================================================
// Deterministic progression fixture
// ============================================================================
// The fixture starts at level 1 and uses the production level-up path twice. The first
// step creates a subclass-free level-2 checkpoint; the second applies Light Domain at 3.
const CLERIC_ID = 'cleric';
const LIGHT_DOMAIN_ID = 'light_domain';
const LEVEL_THREE_XP = 900;

/** Resolve Light Domain through both canonical subclass lookup surfaces. */
function requireLightDomain() {
  const cleric = CLASSES_DATA[CLERIC_ID];
  const lightDomain = findSubclass(cleric.id, LIGHT_DOMAIN_ID);

  // A missing canonical option must stay a visible source failure rather than become a
  // copied label or UI-only feature definition.
  if (!lightDomain || !subclassesForClass(cleric.id).some(subclass => subclass.id === lightDomain.id)) {
    throw new Error('Canonical Cleric Light Domain subclass is required for this demo.');
  }

  return lightDomain;
}

/** Build the subclass-free level-2 checkpoint through the production level-up path. */
export function createLightDomainLevel2(): PlayerCharacter {
  const source = createQuickCharacter({
    classId: CLERIC_ID,
    raceId: 'human',
    level: 1,
    name: 'Light Domain Progression Tester',
    useRecommendedStats: true,
  });

  // A null result means the production disposable character fixture could not be built.
  if (!source) {
    throw new Error('Production quick character assembly failed for the Light Domain demo.');
  }

  // XP only makes the transition eligible; performLevelUp owns level and feature state.
  const level2 = performLevelUp({ ...source, xp: LEVEL_THREE_XP }, {});
  if (level2.level !== 2 || level2.subclassId !== undefined) {
    throw new Error('Canonical Cleric level-2 progression did not produce the expected baseline.');
  }

  return level2;
}

/** Apply the explicit canonical Light Domain choice at the level-3 milestone. */
export function createLightDomainLevel3(
  level2: PlayerCharacter = createLightDomainLevel2(),
): PlayerCharacter {
  const lightDomain = requireLightDomain();

  // Requiring the known checkpoint keeps repeated control clicks deterministic.
  if (level2.level !== 2) {
    throw new Error('Light Domain level-3 transition requires the level-2 baseline.');
  }

  const level3 = performLevelUp(
    { ...level2, xp: LEVEL_THREE_XP },
    { subclassId: lightDomain.id },
  );

  // Do not render a level-3 claim until production confirms the explicit choice.
  if (level3.level !== 3 || level3.subclassId !== lightDomain.id) {
    throw new Error('Canonical Cleric level-3 progression did not apply Light Domain.');
  }

  return level3;
}

/** Read exact feature objects from the canonical progression resolver. */
export function getLightDomainFeatures(character: PlayerCharacter) {
  return classFeaturesForLevel(
    CLASSES_DATA[CLERIC_ID],
    character.level ?? 1,
    character.subclassId,
  );
}

// ============================================================================
// Unsupported runtime boundary
// ============================================================================
// The canonical record is real, but the searched production systems do not expose
// subclass-aware Warding Flare or Light Domain spell preparation. Generic reaction
// economy and spell-list behavior are intentionally not treated as subclass proof.
export const LIGHT_DOMAIN_RUNTIME_BOUNDARY =
  'Unsupported boundary: canonical Warding Flare (warding_flare) and Domain Spells (light_domain_spells) are present, but no executable subclass-aware Warding Flare reaction, attack-disadvantage, resource-spend, or Light Domain prepared-spell transaction was found. Generic reaction economy and spell-list paths are not subclass proof. The glossary also describes Radiance of the Dawn and later Light Domain features, but this production class record does not grant feature IDs for them. This demo does not simulate reaction choice, resource spend, prepared spells, damage, or combat results.';

// ============================================================================
// Light Domain demonstration surface
// ============================================================================
// The component owns only the production-derived progression checkpoint. It never
// becomes a second reaction resolver, spell-preparation system, or combat engine.
export const LightDomainDemo: React.FC = () => {
  const [character, setCharacter] = useState<PlayerCharacter>(() => createLightDomainLevel2());
  const features = useMemo(() => getLightDomainFeatures(character), [character]);
  const lightDomain = requireLightDomain();
  const isLevel3 = character.level === 3 && character.subclassId === lightDomain.id;
  const wardingFlare = features.find(feature => feature.id === 'warding_flare');
  const lightDomainSpells = features.find(feature => feature.id === 'light_domain_spells');

  // Reset returns to a fresh production-derived level-2 checkpoint.
  const reset = (): void => setCharacter(createLightDomainLevel2());

  // Rebuild from that checkpoint before applying the explicit subclass choice.
  const chooseLightDomain = (): void => setCharacter(createLightDomainLevel3());

  return (
    <section
      aria-label="Light Domain progression demonstration"
      data-testid="light-domain-progression-demo"
      className="mt-4 rounded border border-amber-400/40 bg-amber-950/20 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            Canonical progression demo
          </p>
          <h3 className="mt-1 text-base font-semibold">Light Domain</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Cleric level 2 baseline to the level 3 Light Domain choice.
          </p>
        </div>
        <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
          Cleric - Light Domain
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Light Domain progression controls">
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
          onClick={chooseLightDomain}
          className="rounded border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
        >
          Choose Light Domain / Level 3
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
          <dd data-testid="light-domain-level" className="mt-1 font-mono text-lg font-bold text-slate-100">
            {character.level}
          </dd>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
          <dt className="text-slate-500">Subclass choice</dt>
          <dd data-testid="light-domain-subclass" className="mt-1 font-semibold text-amber-200">
            {character.subclassId ? lightDomain.name : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
        <p className="text-xs font-semibold text-slate-300">Canonical granted features</p>
        <ul data-testid="light-domain-feature-list" className="mt-2 space-y-1 text-xs text-slate-200">
          {features.map(feature => (
            <li key={feature.id}>
              <code className="text-amber-200">{feature.id}</code> - {feature.name}
            </li>
          ))}
        </ul>
      </div>

      <p
        data-testid="light-domain-grant-status"
        className="mt-3 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-amber-100"
      >
        {isLevel3
          ? `Canonical grants present: ${wardingFlare?.id} - ${wardingFlare?.name}; ${lightDomainSpells?.id} - ${lightDomainSpells?.name}.`
          : 'Canonical grants absent before the level-3 subclass choice: warding_flare and light_domain_spells.'}
      </p>

      <p
        data-testid="light-domain-transition-log"
        className="mt-3 border-l-2 border-slate-600 pl-2 text-xs leading-relaxed text-slate-300"
      >
        {isLevel3
          ? "Transition: Level 2 -> Level 3 via performLevelUp({ subclassId: 'light_domain' }); canonical feature grants are present."
          : 'Transition: Level 1 -> Level 2 via performLevelUp() without a subclass choice; the level-3 feature grants are absent.'}
      </p>

      <p
        data-testid="light-domain-runtime-boundary"
        className="mt-3 rounded border border-rose-400/40 bg-rose-950/20 p-2 text-xs leading-relaxed text-rose-100"
      >
        {LIGHT_DOMAIN_RUNTIME_BOUNDARY}
      </p>
    </section>
  );
};

export default LightDomainDemo;
