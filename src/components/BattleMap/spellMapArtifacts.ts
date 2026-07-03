// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 02/07/2026, 05:31:50
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/SpellArtifact3DMarker.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  ActiveAnimatedObject,
  ActiveExtradimensionalSpace,
  ActiveSpellEmanation,
  ActiveFireEffect,
  ActiveSpellForce,
  ActiveSpellGuardian,
  ActiveSpellHelper,
  ActiveSpellStructure,
  ActiveTruePolymorphTransformation,
  CombatCharacter,
  Position,
  SpellObjectImpact,
  SpellObjectRepair,
  SpellObjectAccessChange
} from '../../types/combat';

export interface SpellMapArtifacts {
  helpers?: ActiveSpellHelper[];
  forces?: ActiveSpellForce[];
  guardians?: ActiveSpellGuardian[];
  animatedObjects?: ActiveAnimatedObject[];
  structures?: ActiveSpellStructure[];
  extradimensionalSpaces?: ActiveExtradimensionalSpace[];
  emanations?: ActiveSpellEmanation[];
  objectImpacts?: SpellObjectImpact[];
  objectRepairs?: SpellObjectRepair[];
  objectAccessChanges?: SpellObjectAccessChange[];
  fireEffects?: ActiveFireEffect[];
  truePolymorphTransformations?: ActiveTruePolymorphTransformation[];
}

export interface SpellMapArtifactMarker {
  id: string;
  family: 'helper' | 'force' | 'guardian' | 'animated-object' | 'structure' | 'space' | 'emanation' | 'object-impact' | 'object-repair' | 'object-access' | 'fire-effect' | 'transformation';
  label: string;
  title: string;
  position: Position;
  radiusFeet?: number;
}

const normalizeLabel = (value: string, fallback: string) => {
  const words = value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return fallback;
  return words
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
};

const sourceName = (spellName: string | undefined, spellId: string) => spellName || spellId;

/**
 * Converts non-creature spell runtime records into one map-facing marker list.
 * The records remain owned by command/combat state; this helper only gives the
 * 2D and 3D renderers the same compact visual contract.
 */
export const buildSpellMapArtifactMarkers = (
  artifacts: SpellMapArtifacts | undefined,
  characters: CombatCharacter[] = []
): SpellMapArtifactMarker[] => {
  const casterById = new Map(characters.map(character => [character.id, character]));
  const markers: SpellMapArtifactMarker[] = [];

  for (const helper of artifacts?.helpers ?? []) {
    if (!helper.active) continue;
    markers.push({
      id: `helper-${helper.id}`,
      family: 'helper',
      label: normalizeLabel(helper.entityType || helper.kind, 'H'),
      title: `${sourceName(helper.spellName, helper.spellId)} helper: ${helper.entityType}`,
      position: helper.position
    });
  }

  for (const force of artifacts?.forces ?? []) {
    if (!force.active) continue;
    markers.push({
      id: `force-${force.id}`,
      family: 'force',
      label: normalizeLabel(force.entityType || force.kind, 'F'),
      title: `${sourceName(force.spellName, force.spellId)} force: ${force.entityType}`,
      position: force.position
    });
  }

  for (const guardian of artifacts?.guardians ?? []) {
    if (!guardian.active) continue;
    markers.push({
      id: `guardian-${guardian.id}`,
      family: 'guardian',
      label: normalizeLabel(guardian.kind, 'G'),
      title: `${sourceName(guardian.spellName, guardian.spellId)} guardian, ${guardian.threatRadiusFeet} ft threat`,
      position: guardian.position,
      radiusFeet: guardian.threatRadiusFeet
    });
  }

  for (const animatedObject of artifacts?.animatedObjects ?? []) {
    if (!animatedObject.active || !animatedObject.sourceObjectPosition) continue;
    markers.push({
      id: `animated-object-${animatedObject.id}`,
      family: 'animated-object',
      label: normalizeLabel(animatedObject.sourceObjectName || animatedObject.creatureType, 'AO'),
      title: `${sourceName(animatedObject.spellName, animatedObject.spellId)} animated object: ${animatedObject.sourceObjectName || animatedObject.sourceObjectId}`,
      position: animatedObject.sourceObjectPosition
    });
  }

  for (const structure of artifacts?.structures ?? []) {
    markers.push({
      id: `structure-${structure.id}`,
      family: 'structure',
      label: normalizeLabel(structure.kind, 'ST'),
      title: `${sourceName(structure.spellName, structure.spellId)} structure`,
      position: structure.originPosition,
      radiusFeet: structure.footprint.sizeFeet / 2
    });
  }

  for (const space of artifacts?.extradimensionalSpaces ?? []) {
    markers.push({
      id: `space-${space.id}`,
      family: 'space',
      label: space.doorState === 'open' ? 'DO' : 'DC',
      title: `${sourceName(space.spellName, space.spellId)} entrance: ${space.doorState}`,
      position: space.entrancePosition
    });
  }

  for (const emanation of artifacts?.emanations ?? []) {
    if (!emanation.active) continue;
    const caster = casterById.get(emanation.casterId);
    if (!caster) continue;
    markers.push({
      id: `emanation-${emanation.id}`,
      family: 'emanation',
      label: normalizeLabel(emanation.entityType || emanation.kind, 'EA'),
      title: `${sourceName(emanation.spellName, emanation.spellId)} emanation, ${emanation.radiusFeet} ft radius`,
      position: caster.position,
      radiusFeet: emanation.radiusFeet
    });
  }

  for (const impact of artifacts?.objectImpacts ?? []) {
    markers.push({
      id: `object-impact-${impact.id}`,
      family: 'object-impact',
      label: impact.damage?.type === 'fire' ? 'BURN' : 'HIT',
      title: `${sourceName(impact.sourceSpellName, impact.sourceSpellId)} hit ${impact.objectName ?? impact.objectId}${impact.damage ? ` for ${impact.damage.dice} ${impact.damage.type}` : ''}`,
      position: impact.position
    });
  }

  for (const repair of artifacts?.objectRepairs ?? []) {
    markers.push({
      id: `object-repair-${repair.id}`,
      family: 'object-repair',
      label: repair.outcome === 'repaired' ? 'MEND' : 'CHECK',
      title: `${sourceName(repair.sourceSpellName, repair.sourceSpellId)} ${repair.outcome.replace(/_/g, ' ')}: ${repair.objectName ?? repair.objectId}`,
      position: repair.position
    });
  }

  for (const accessChange of artifacts?.objectAccessChanges ?? []) {
    markers.push({
      id: `object-access-${accessChange.id}`,
      family: 'object-access',
      label: accessChange.outcome === 'magically_locked'
        ? 'LOCK'
        : accessChange.outcome === 'suppressed_magical_lock'
          ? 'SUPP'
          : 'OPEN',
      title: `${sourceName(accessChange.sourceSpellName, accessChange.sourceSpellId)} ${accessChange.outcome.replace(/_/g, ' ')}: ${accessChange.objectName ?? accessChange.objectId}`,
      position: accessChange.position
    });
  }

  for (const fireEffect of artifacts?.fireEffects ?? []) {
    markers.push({
      id: `fire-effect-${fireEffect.id}`,
      family: 'fire-effect',
      label: fireEffect.kind === 'ignited_object' ? 'FIRE' : 'HAZ',
      title: `${sourceName(fireEffect.sourceName, fireEffect.spellId)} ${fireEffect.kind.replace(/_/g, ' ')}${fireEffect.objectName ? `: ${fireEffect.objectName}` : ''}`,
      position: fireEffect.position,
      radiusFeet: fireEffect.area?.sizeFeet
    });
  }

  for (const transformation of artifacts?.truePolymorphTransformations ?? []) {
    const position = transformation.sourceObjectPosition ?? transformation.sourceCreaturePosition;
    if (!position) continue;

    const transformedName = transformation.transformedCreatureId
      ? 'creature'
      : transformation.transformedObjectName ?? transformation.transformedFormName ?? 'form';
    markers.push({
      id: `transformation-${transformation.id}`,
      family: 'transformation',
      label: transformation.mode === 'object_to_creature' ? 'OBJ>CR' : transformation.mode === 'creature_to_object' ? 'CR>OBJ' : 'FORM',
      title: `${sourceName(transformation.spellName, transformation.spellId)} transformation: ${transformation.sourceObjectName ?? transformation.sourceCreatureName ?? 'target'} into ${transformedName}`,
      position
    });
  }

  return markers;
};
