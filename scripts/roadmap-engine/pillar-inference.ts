import { MAIN_PILLARS, type MainPillarId } from './pillars';
import type { FeatureBucket } from './generation-types';

const inferPillarFromText = (text: string): MainPillarId | null => {
  const normalized = text.toLowerCase();
  let best: { id: MainPillarId; score: number } | null = null;

  for (const pillar of MAIN_PILLARS) {
    let score = 0;
    for (const keyword of pillar.keywords) {
      if (normalized.includes(keyword)) score += 1;
    }
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { id: pillar.id, score };
    }
  }

  return best?.id ?? null;
};

export const inferPillarForFeature = (feature: FeatureBucket) => {
  const featureText = `${feature.feature} ${feature.featureGroup}`.toLowerCase();

  if (featureText.includes('3d-exploration') || featureText.includes('world-exploration') || featureText.includes('world')) {
    return 'world-exploration' as MainPillarId;
  }
  if (featureText.includes('spell')) return 'combat-systems' as MainPillarId;
  if (featureText.includes('weapon') || featureText.includes('combat') || featureText.includes('action-system')) {
    return 'combat-systems' as MainPillarId;
  }
  if (featureText.includes('character')) return 'character-systems' as MainPillarId;
  if (featureText.includes('ui')) return 'ui-player-surfaces' as MainPillarId;
  if (featureText.includes('glossary') || featureText.includes('compendium') || featureText.includes('reference')) {
    return 'content-reference' as MainPillarId;
  }
  if (featureText.includes('save') || featureText.includes('seed') || featureText.includes('determin') || featureText.includes('persistence') || featureText.includes('state')) {
    return 'data-persistence-determinism' as MainPillarId;
  }
  if (featureText.includes('quest') || featureText.includes('narrative')) return 'narrative-quest-systems' as MainPillarId;
  if (featureText.includes('social') || featureText.includes('party') || featureText.includes('faction') || featureText.includes('reputation')) {
    return 'social-party-systems' as MainPillarId;
  }
  if (featureText.includes('economy') || featureText.includes('progression') || featureText.includes('xp') || featureText.includes('loot')) {
    return 'economy-progression' as MainPillarId;
  }
  if (featureText.includes('testing') || featureText.includes('roadmap') || featureText.includes('tool') || featureText.includes('architecture') || featureText.includes('investigation')) {
    return 'technical-foundation-tooling' as MainPillarId;
  }

  const docText = feature.docs
    .flatMap((doc) => [doc.sourcePath, doc.featureGroup, doc.feature, ...(doc.subFeatures ?? []).slice(0, 30).map((sub) => sub.name)])
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();

  const inferred = inferPillarFromText(`${featureText} ${docText}`);
  return inferred ?? 'technical-foundation-tooling';
};
