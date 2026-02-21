import type { FeatureBucket, FeatureCategory, ProcessingDocument } from './generation-types';
import { slug, toTitleCase } from './text';

export const mapFeatureCategory = (doc: ProcessingDocument): FeatureCategory => {
  const source = doc.sourcePath.toLowerCase();
  if (source.includes('/spell-system-overhaul/') || source.includes('/spell-completeness-audit/')) return 'Spell Systems';
  if (source.includes('/3d-exploration/')) return 'Rendering & Runtime';

  const group = (doc.featureGroup || '').toLowerCase();
  if (group.includes('weapon-proficiency')) return 'Core Combat Systems';
  if (group.includes('combat-messaging')) return 'Core Combat Systems';
  if (group.includes('action-system')) return 'Core Combat Systems';
  if (group.includes('testing')) return 'Build & Infrastructure';
  if (group.includes('ui')) return 'UX & Interaction';
  if (group.includes('architecture')) return 'State Architecture';
  if (group.includes('economy')) return 'Economy Systems';
  if (group.includes('world')) return 'World Simulation';
  if (group.includes('character')) return 'Character Systems';
  if (group.includes('crime')) return 'Crime Systems';
  return 'Unmapped';
};

export const buildFeaturesByGroup = (docs: ProcessingDocument[]) => {
  const featuresByGroup = new Map<string, FeatureBucket>();

  for (const doc of docs) {
    const group = doc.featureGroup || slug(doc.feature || doc.sourcePath);
    const feature = toTitleCase((doc.feature || group).replace(/[_-]+/g, ' ').trim());
    const category = mapFeatureCategory(doc);
    const existing = featuresByGroup.get(group);
    if (existing) {
      existing.docs.push(doc);
    } else {
      featuresByGroup.set(group, {
        id: `feature_${slug(group)}`,
        featureGroup: group,
        feature,
        featureCategory: category,
        docs: [doc]
      });
    }
  }

  return featuresByGroup;
};
