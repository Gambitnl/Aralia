/**
 * Curated navigation for the Idea Board, separate from historical assessments.
 * Categories describe a technique; projects describe where it may be useful.
 * A connection is research relevance, never ownership, adoption, or a dependency.
 * Evidence names an existing assessment or roadmap topic. Suggested connections
 * remain visibly tentative until a project-specific assessment establishes them.
 */
export const categories = [
  { id: 'appearance', name: 'Character appearance', description: 'Faces, hair, and visible identity' },
  { id: 'motion', name: 'Assets & animation', description: 'Geometry, rigs, and movement' },
  { id: 'world', name: 'World & environments', description: 'Water, terrain, and living landscapes' },
  { id: 'effects', name: 'Combat effects', description: 'Readable abilities and visual timing' },
  { id: 'authoring', name: 'Authoring & review', description: 'Staging, inspection, and creative tools' },
];

export const projects = [
  { id: 'aralia', name: 'Aralia', description: 'Procedural role-playing game', scopes: [
    { id: 'world', name: 'World & environments', evidence: 'public/planmap/topics.json: ocean-surface, interactive-3d-world' },
    { id: 'combat', name: 'Combat presentation', evidence: 'public/planmap/topics.json: combat-3d-visual-quality' },
    { id: 'characters', name: 'Character Creator', evidence: 'public/planmap/topics.json: character-creator' },
    { id: 'review', name: 'Design Preview', evidence: 'IB-0006: current assessment, fit.complements' },
  ] },
  // The standalone Studio's documented local entry point (Entity-Generator/README.md).
  { id: 'entity-studio', name: 'Entity Studio', url: 'http://127.0.0.1:5173/', description: 'Entity authoring and review; standalone carve-out', scopes: [
    { id: 'assets', name: 'Asset creation', evidence: 'docs/architecture/domains/entity-studio.md: Entity Forge, Hero Lab' },
    { id: 'motion', name: 'Rigging & motion', evidence: 'docs/architecture/domains/entity-studio.md: Part Lab, Entity Debug' },
    { id: 'review', name: 'Visual review', evidence: 'docs/architecture/domains/entity-studio.md: Entity Debug' },
  ] },
  { id: 'dd-generator', name: 'D&D Character Generator', description: 'Separate saved project; relevance is not yet assessed', scopes: [
    { id: 'characters', name: 'Character exploration', evidence: 'Codex saved project inventory verified 2026-09-21; mappings are suggestions only' },
  ] },
  { id: 'crimson-ledger', name: 'Crimson Ledger', url: 'https://crimson-ledger-forge.the1gambit.chatgpt.site/', description: 'Character Forge and campaign tools; research links are suggestions, not adopted work', scopes: [
    { id: 'creator', name: 'Character creation', evidence: 'Crimson Ledger: Current, Standard, and Atelier creator views' },
    { id: 'campaigns', name: 'Campaigns & play', evidence: 'Crimson Ledger: DM and Player portals' },
  ] },
];

const connection = (project, scope, level, why, evidence) => ({ project, scope, level, why, evidence });
const aralia = (scope, why, id) => connection('aralia', scope, 'recorded', why, `${id}: current assessment, fit.complements and fit.couldHelp`);
const studio = (scope, why, id) => connection('entity-studio', scope, 'recorded', why, `${id}: current assessment, fit.complements`);
const generator = (why) => connection('dd-generator', 'characters', 'suggested', why, 'Project exists in the saved project inventory; no project-specific assessment yet.');
const ledger = (why, evidence) => connection('crimson-ledger', 'creator', 'suggested', why, evidence);

// Illustrations depict broad concepts. They are not source captures or evidence
// of the external technique's quality. Multiple related ideas can share an image.
export const concepts = {
  'IB-0001': { title: 'Ocean surface', category: 'world', image: 'ocean', connections: [aralia('world', 'Ocean sampling, foam, and coast boundaries complement the existing open-ocean system.', 'IB-0001')] },
  'IB-0002': { title: 'Spline roads', category: 'world', image: 'terrain', connections: [aralia('world', 'A reversible authoring overlay could help inspect and correct generated road edges.', 'IB-0002')] },
  'IB-0003': { title: 'Surface detail', category: 'world', image: 'surface', connections: [aralia('world', 'Optional close-range detail could complement terrain, rock, and building materials.', 'IB-0003')] },
  'IB-0004': { title: 'Plant growth', category: 'world', image: 'plant', connections: [aralia('world', 'Offline morphology research could inform leaf and understory variation.', 'IB-0004')] },
  'IB-0005': { title: 'Ability effects', category: 'effects', image: 'effects', connections: [aralia('combat', 'Telegraph readability and effect authoring complement targeting and BattleMap overlays.', 'IB-0005')] },
  'IB-0006': { title: 'Cinematic review', category: 'authoring', image: 'camera', connections: [aralia('review', 'Repeatable cameras and shot lists support Design Preview visual review.', 'IB-0006'), connection('entity-studio', 'review', 'suggested', 'Shot composition may help entity reviews; a dedicated project assessment is still needed.', 'IB-0006: fit.couldHelp mentions entity review; Entity Studio domain defines review surfaces.')] },
  'IB-0007': { title: 'Neural motion', category: 'motion', image: 'rig', connections: [studio('motion', 'Candidate clips can be compared with existing rig and animation review.', 'IB-0007'), aralia('characters', 'The assessment names Character Atelier rigs and humanoid retargeting as complements.', 'IB-0007'), generator('Pose-transition research may inform a character workshop, subject to its actual rig and export needs.')] },
  'IB-0008': { title: 'Image-to-3D', category: 'motion', image: 'mesh', connections: [studio('assets', 'The assessment explicitly places generated candidates in Entity Studio review lanes.', 'IB-0008'), aralia('characters', 'Candidate generation could inform Character Atelier fitting and expression checks.', 'IB-0008'), generator('Candidate characters may be relevant; compatibility and project ownership are unassessed.'), ledger('Character model research could inform the optional Atelier presentation, without changing canonical character rules.', 'Crimson Ledger app/atelier-builder.tsx: optional Atelier creator view; IB-0008: image-to-3D assessment')] },
  'IB-0009': { title: 'Video-to-motion', category: 'motion', image: 'motion', connections: [studio('motion', 'Recovered motion could supply review candidates, without replacing canonical rigs.', 'IB-0009'), aralia('characters', 'The assessment names Character Atelier rigs and existing animation validation.', 'IB-0009'), generator('Reconstructed performance could be a reference, but no need or integration has been established.')] },
  'IB-0010': { title: 'Portrait rendering', category: 'appearance', image: 'portrait', connections: [aralia('characters', 'The assessment identifies Character Atelier head parts and a possible close-up portrait use case.', 'IB-0010'), connection('entity-studio', 'assets', 'suggested', 'Hair and facial detail may inform Part Lab, but the source is not a drop-in entity material.', 'IB-0010: fit.couldHelp; docs/architecture/domains/entity-studio.md: Part Lab'), generator('Appearance research may be useful; the separate project has not been assessed against this source.'), ledger('Portrait research may help the creator offer distinct character and species imagery; no art pipeline is adopted by this link.', 'Crimson Ledger app/standard-builder.tsx: portrait control; IB-0010: portrait-rendering assessment')] },
  'IB-0011': { title: 'Runtime cloth', category: 'motion', image: 'mesh', connections: [aralia('characters', 'The assessment names Character Atelier garments on skinned bodies as the only place a runtime garment pass would apply.', 'IB-0011'), connection('entity-studio', 'motion', 'suggested', 'A garment pass over posed entities may inform rig review; no Entity Studio assessment exists.', 'IB-0011: fit.couldHelp; docs/architecture/domains/entity-studio.md: Entity Debug'), connection('dd-generator', 'characters', 'suggested', 'The measured port lives in the Wildkin repository; whether that is the saved D&D Character Generator project is unconfirmed.', 'IB-0011: unknowns')] },
};

export function conceptFor(record) {
  // New records always remain discoverable even before anyone curates their home.
  return concepts[record.id] ?? { title: record.title, category: 'unassigned', image: null, connections: [] };
}

// Planmap owns the Aralia browsing tree, including standalone initiatives.
// Research assessments remain unchanged; extra browsing connections are suggestions.
export function configurePlanmap(plan) {
  const araliaProject = projects.find((project) => project.id === 'aralia');
  araliaProject.scopes = Object.entries(plan.campaigns).map(([id, campaign]) => ({
    id, name: campaign.label, evidence: 'public/planmap/topics.json',
    initiatives: plan.topics.filter((topic) => topic.campaign === id && topic.status !== 'superseded')
      .map((topic) => ({ id: topic.id, name: topic.title })),
  }));
  const previous = { characters: 'character/character-creator', review: 'ui/design-preview', combat: 'combat/combat-3d-visual-quality' };
  const related = {
    'IB-0001': ['ocean-surface', 'interactive-3d-world'],
    'IB-0002': ['road-systems', 'interactive-3d-world'],
    'IB-0003': ['world-props'], 'IB-0004': ['forests', 'world-props'],
    'IB-0005': ['world-props'], 'IB-0006': ['design-preview', 'entity-studio-carveout'],
    'IB-0007': ['rig-bench', 'entity-generator-carveout'],
    'IB-0008': ['entity-generator-3d', 'entity-studio-carveout', 'entity-generator-carveout'],
    'IB-0009': ['rig-bench', 'entity-studio-carveout'],
    'IB-0010': ['entity-generator-3d', 'entity-studio-carveout'],
    'IB-0011': ['rig-bench', 'entity-generator-carveout'],
  };
  for (const [id, concept] of Object.entries(concepts)) {
    for (const link of concept.connections) if (link.project === 'aralia' && previous[link.scope]) link.scope = previous[link.scope];
    for (const topicId of related[id] ?? []) {
      const topic = plan.topics.find((item) => item.id === topicId && item.status !== 'superseded');
      if (!topic) continue;
      const scope = topic.campaign + '/' + topic.id;
      if (!concept.connections.some((link) => link.project === 'aralia' && (link.scope === scope || link.scope.startsWith(scope + '/')))) {
        concept.connections.push(connection('aralia', scope, 'suggested',
          concept.title + ' is relevant to research for ' + topic.title + '; this browsing connection does not indicate adoption.',
          'public/planmap/topics.json: ' + topic.id + '; concept from ' + id));
      }
    }
  }
}

// Show every exact research connection for one ID across all repositories.
// This bypasses browsing filters without inventing connections from shared titles.
export function ideaProjectGroups(records, id) {
  const record = records.find((item) => item.id === id);
  if (!record) return [];
  const links = conceptFor(record).connections;
  return [...new Set(links.map((link) => `${link.project}/${link.scope}`))].map((path) => {
    const [projectId] = path.split('/');
    const project = projects.find((item) => item.id === projectId);
    return { id: path, projectId, name: path, description: project?.description ?? '', records: [record] };
  }).concat(links.length ? [] : [{ id: 'unassigned', name: 'Unassigned', description: 'No project mapping yet', records: [record] }]);
}

export function matchesProject(record, selection) {
  const links = conceptFor(record).connections;
  if (!selection) return true;
  if (selection === 'unassigned') return links.length === 0;
  const [project, ...parts] = selection.split('/');
  const scope = parts.join('/');
  return links.some((link) => link.project === project && (!scope || link.scope === scope || link.scope.startsWith(scope + '/')));
}

export function groupRecords(records, mode, selection = '') {
  if (mode === 'category') {
    return [...categories, { id: 'unassigned', name: 'Unassigned', description: 'Awaiting a category' }]
      .map((category) => ({ ...category, records: records.filter((record) => conceptFor(record).category === category.id) }))
      .filter((group) => group.records.length);
  }
  const groups = projects.flatMap((project) => {
    if (selection && selection.split('/')[0] !== project.id) return [];
    if (project.id !== 'aralia' && !selection) return [{ ...project, records: records.filter((record) => matchesProject(record, project.id)) }];
    const selectedScope = selection.split('/')[1];
    return project.scopes.flatMap((scope) => {
      if (selectedScope && selectedScope !== scope.id) return [];
      const base = project.id + '/' + scope.id;
      const entries = selectedScope && scope.initiatives?.length
        ? [{ id: base, name: 'All ' + scope.name, description: 'All related ideas, including category-wide research' }, ...scope.initiatives.map((item) => ({ id: base + '/' + item.id, name: item.name }))]
        : [{ id: base, name: scope.name }];
      return entries.filter((entry) => selection.split('/').length < 3 || entry.id === selection).map((entry) => ({
        ...entry, projectId: project.id, name: project.name + ' / ' + entry.name,
        description: entry.description ?? project.description,
        records: records.filter((record) => matchesProject(record, entry.id)),
      }));
    });
  });
  if (!selection || selection === 'unassigned') groups.push({ id: 'unassigned', name: 'Unassigned', description: 'No project mapping yet', records: records.filter((record) => matchesProject(record, 'unassigned')) });
  return groups.filter((group) => group.records.length);
}
