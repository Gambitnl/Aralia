import { relaxNodeCollisions } from './collision';
import { DOMAIN_COLORS, NODE_CATEGORIES, ROOT_X, ROOT_Y } from './constants';
import { buildFeaturesByGroup } from './feature-mapping';
import type { FeatureBucket } from './generation-types';
import { RoadmapNodeIdRegistry } from './id-validation';
import { loadProcessingDocs } from './manifest';
import { inferPillarForFeature } from './pillar-inference';
import { MAIN_PILLARS, type MainPillarId } from './pillars';
import { normalizeState, slug, summarizeDocs, toFeatureDrivenSubfeatureName } from './text';
import type { RoadmapEdge, RoadmapNode } from './types';

const EMPTY = { version: '2.1.0', root: 'aralia_chronicles', nodes: [] as RoadmapNode[], edges: [] as RoadmapEdge[] };
const PRIME_NODES_ONLY_VIEW = false;

const CURATED_SUBFEATURES: Record<string, Set<string>> = {
  '3d exploration & combat': new Set([
    '3D Exploration & Combat',
    'World Map > Visuals',
    'World Map > Navigation',
    'World Map > Submap Continuity',
    'World Map > Generation & Determinism',
    'World Map > Visuals > Continuous World Map View - No Visible Tile Grid',
    'World Map > Visuals > Azgaar Layer Controls > Political Borders (Toggleable)',
    'World Map > Navigation > Travel Precision Overlay Controls',
    'World Map > Generation & Determinism > Azgaar World Generation Backbone'
  ])
};

const CURATED_SUBFEATURE_DETAILS: Record<string, { layman: string; canonicalDocs: string[] }> = {
  '3D Exploration & Combat': {
    layman: 'Top-level branch for 3D traversal and combat work under World Exploration.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/3d-exploration-combat/INDEX.md'
    ]
  },
  'World Map > Visuals': {
    layman: 'Map appearance and readability controls.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/INDEX.md'
    ]
  },
  'World Map > Visuals > Azgaar Layer Controls > Political Borders (Toggleable)': {
    layman: 'Azgaar political border/state overlays are available as optional visual layers and are not forced always-on.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/azgaar-layer-controls-political-borders-toggleable.md'
    ]
  },
  'World Map > Navigation': {
    layman: 'World-map movement controls and precision travel interaction.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/INDEX.md'
    ]
  },
  'World Map > Navigation > Travel Precision Overlay Controls': {
    layman: 'Navigation overlays are available for precise movement and route clarity. Default behavior remains pending playtest with real cell visuals.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/navigation/travel-precision-overlay-controls.md'
    ]
  },
  'World Map > Submap Continuity': {
    layman: 'Contracts that keep world-map and submap behavior coherent.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/submap-continuity/INDEX.md'
    ]
  },
  'World Map > Generation & Determinism': {
    layman: 'World-generation source rules and deterministic behavior guarantees.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/INDEX.md'
    ]
  },
  'World Map > Generation & Determinism > Azgaar World Generation Backbone': {
    layman: 'World map data is generated using Azgaar as the primary engine, not a long-term simplified fallback.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/generation-determinism/azgaar-world-generation-backbone.md'
    ]
  },
  'World Map > Visuals > Continuous World Map View - No Visible Tile Grid': {
    layman: 'World map looks like one connected map image, not a visible square tile grid.',
    canonicalDocs: [
      'docs/tasks/3d-exploration/feature-capabilities/world-map/visuals/continuous-world-map-view-no-visible-tile-grid.md'
    ]
  }
};

const CURATED_REQUIRED_SUBFEATURES: Record<string, string[]> = {
  '3d exploration & combat': [
    '3D Exploration & Combat',
    'World Map > Visuals',
    'World Map > Navigation',
    'World Map > Submap Continuity',
    'World Map > Generation & Determinism'
  ]
};

const getCuratedDetails = (subfeatureName: string) => {
  const direct = CURATED_SUBFEATURE_DETAILS[subfeatureName];
  if (direct) return direct;
  const lower = subfeatureName.toLowerCase();
  const key = Object.keys(CURATED_SUBFEATURE_DETAILS).find((candidate) => candidate.toLowerCase() === lower);
  return key ? CURATED_SUBFEATURE_DETAILS[key] : undefined;
};

const isCuratedSubfeature = (featureName: string, subfeatureName: string) => {
  const allowed = CURATED_SUBFEATURES[featureName.toLowerCase()];
  if (!allowed) return false;
  if (allowed.has(subfeatureName)) return true;
  const lower = subfeatureName.toLowerCase();
  for (const candidate of allowed) {
    if (candidate.toLowerCase() === lower) return true;
  }
  return false;
};

const buildSubfeatureDescription = (subfeatureName: string, relatedDocs: string[]) => {
  const details = getCuratedDetails(subfeatureName);
  if (!details) return `Related doc(s): ${summarizeDocs(relatedDocs)}`;
  return `${details.layman}\n\nRelated doc(s): ${summarizeDocs(relatedDocs)}`;
};

export function generateRoadmapData() {
  const docs = loadProcessingDocs();
  if (docs.length === 0) return EMPTY;

  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];
  const nodeIds = new RoadmapNodeIdRegistry();

  const rootId = 'aralia_chronicles';
  nodeIds.register(rootId, 'root: Aralia Game Roadmap');
  nodes.push({
    id: rootId,
    label: 'Aralia Game Roadmap',
    type: 'root',
    category: NODE_CATEGORIES.trunk,
    sourceKind: 'system',
    feature: 'Game Feature Roadmap',
    featureCategory: 'Program Governance',
    status: 'active',
    initialX: ROOT_X,
    initialY: ROOT_Y,
    color: '#fbbf24',
    description: 'Feature-first roadmap generated from processed game documentation.'
  });

  const featuresByGroup = buildFeaturesByGroup(docs);
  const featuresByPillar = new Map<MainPillarId, FeatureBucket[]>();
  for (const pillar of MAIN_PILLARS) featuresByPillar.set(pillar.id, []);

  for (const feature of featuresByGroup.values()) {
    const pillarId = inferPillarForFeature(feature);
    const arr = featuresByPillar.get(pillarId) ?? [];
    arr.push(feature);
    featuresByPillar.set(pillarId, arr);
  }

  for (const arr of featuresByPillar.values()) {
    arr.sort((a, b) => a.feature.localeCompare(b.feature));
  }

  let pillarIndex = 0;

  for (const pillar of MAIN_PILLARS) {
    const pillarFeatures = featuresByPillar.get(pillar.id) ?? [];
    const docCount = pillarFeatures.reduce((sum, feature) => sum + feature.docs.length, 0);
    const x = ROOT_X + (pillarIndex % 3 - 1) * 520;
    const y = ROOT_Y + 280 + Math.floor(pillarIndex / 3) * 420;
    pillarIndex += 1;
    const pillarNodeId = `pillar_${slug(pillar.id)}`;
    const pillarStatus: RoadmapNode['status'] = pillarFeatures.length > 0 ? 'active' : 'planned';
    nodeIds.register(pillarNodeId, `pillar: ${pillar.label}`);

    nodes.push({
      id: pillarNodeId,
      label: pillar.label,
      type: 'project',
      category: NODE_CATEGORIES.pillar,
      sourceKind: 'registry',
      feature: pillar.label,
      featureCategory: pillar.label,
      status: pillarStatus,
      initialX: x,
      initialY: y,
      color: DOMAIN_COLORS.default,
      description: `${pillar.summary} Mapped features: ${pillarFeatures.length}. Processed docs: ${docCount}.`
    });
    edges.push({ from: rootId, to: pillarNodeId, type: 'containment' });

    if (PRIME_NODES_ONLY_VIEW) {
      continue;
    }

    let subIndex = 0;
    for (const feature of pillarFeatures) {
      const featureSubfeatures = new Map<string, {
        name: string;
        state: RoadmapNode['status'];
        score: number;
        sourceDocs: Set<string>;
        canonicalDocs: Set<string>;
      }>();

      for (const doc of feature.docs) {
        for (const sub of doc.subFeatures ?? []) {
          const displayName = toFeatureDrivenSubfeatureName(sub.name, feature.feature, doc.sourcePath);
          if (!displayName) continue;
          if (!isCuratedSubfeature(feature.feature, displayName)) continue;
          const key = displayName.toLowerCase();
          const state = normalizeState(sub.state);
          const current = featureSubfeatures.get(key);
          if (!current) {
            featureSubfeatures.set(key, {
              name: displayName,
              state,
              score: 1,
              sourceDocs: new Set([doc.sourcePath]),
              canonicalDocs: new Set([sub.canonicalPath || doc.canonicalPath || doc.sourcePath])
            });
          } else {
            if (current.state !== 'done' && state === 'done') {
              current.state = 'done';
            } else if (current.state === 'planned' && state === 'active') {
              current.state = 'active';
            }
            current.score += 1;
            current.sourceDocs.add(doc.sourcePath);
            current.canonicalDocs.add(sub.canonicalPath || doc.canonicalPath || doc.sourcePath);
          }
        }
      }

      const scoredSubfeatures = Array.from(featureSubfeatures.values())
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

      const requiredSubfeatures = CURATED_REQUIRED_SUBFEATURES[feature.feature.toLowerCase()] ?? [];
      for (const requiredName of requiredSubfeatures) {
        if (scoredSubfeatures.some((sub) => sub.name === requiredName)) continue;
        const details = getCuratedDetails(requiredName);
        const docsFallback = feature.docs.map((doc) => doc.sourcePath);
        const canonicalFallback = feature.docs.map((doc) => doc.canonicalPath || doc.sourcePath);
        scoredSubfeatures.unshift({
          name: requiredName,
          state: 'active',
          score: 999,
          sourceDocs: new Set(details?.canonicalDocs?.length ? details.canonicalDocs : docsFallback),
          canonicalDocs: new Set(details?.canonicalDocs?.length ? details.canonicalDocs : canonicalFallback)
        });
      }

      for (const sub of scoredSubfeatures) {
        const curatedDetails = getCuratedDetails(sub.name);
        const sourceDocs = curatedDetails?.canonicalDocs?.length
          ? curatedDetails.canonicalDocs
          : Array.from(sub.sourceDocs).sort();
        const canonicalDocs = curatedDetails?.canonicalDocs?.length
          ? curatedDetails.canonicalDocs
          : Array.from(sub.canonicalDocs).sort();
        const subId = `sub_${slug(pillarNodeId)}_${slug(sub.name)}`;
        nodeIds.register(
          subId,
          `subfeature: pillar="${pillar.label}" feature="${feature.feature}" label="${sub.name}"`
        );

        nodes.push({
          id: subId,
          label: sub.name,
          type: 'milestone',
          category: NODE_CATEGORIES.feature,
          sourceKind: 'registry',
          feature: feature.feature,
          featureCategory: pillar.label,
          status: sub.state,
          initialX: x - 180 + (subIndex % 3) * 180,
          initialY: y + 170 + Math.floor(subIndex / 3) * 120,
          color: DOMAIN_COLORS.default,
          description: buildSubfeatureDescription(sub.name, canonicalDocs),
          sourceDocs,
          canonicalDocs,
          link: canonicalDocs[0]
        });
        edges.push({ from: pillarNodeId, to: subId, type: 'containment' });
        subIndex += 1;
      }
    }
  }

  relaxNodeCollisions(nodes);
  return { version: '2.1.0', root: rootId, nodes, edges };
}
