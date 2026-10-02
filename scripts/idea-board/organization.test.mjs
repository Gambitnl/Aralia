/** Navigation must preserve discoverability without inventing project ownership. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { categories, projects, concepts, conceptFor, matchesProject, groupRecords, configurePlanmap, ideaProjectGroups } from '../../public/idea-board/organization.mjs';
const data = JSON.parse(await readFile(new URL('../../public/idea-board/records.json', import.meta.url)));
const plan = JSON.parse(await readFile(new URL('../../public/planmap/topics.json', import.meta.url)));
configurePlanmap(plan);

test('idea focus shows only the exact ID in every connected project and scope', () => {
  for (const id of ['IB-0002', 'IB-0010']) {
    const groups = ideaProjectGroups(data.records, id);
    assert.deepEqual(new Set(groups.map((group) => group.id)), new Set(concepts[id].connections.map((link) => `${link.project}/${link.scope}`)));
    assert.ok(groups.every((group) => group.records.length === 1 && group.records[0].id === id));
  }
  assert.equal(new Set(ideaProjectGroups(data.records, 'IB-0010').map((group) => group.projectId)).size, 4);
  assert.deepEqual(ideaProjectGroups(data.records, 'missing'), []);
});

test('every curated record and connection resolves, with an explanation and evidence', async () => {
  for (const [id, concept] of Object.entries(concepts)) {
    assert.ok(data.records.some((record) => record.id === id), id);
    assert.ok(categories.some((category) => category.id === concept.category));
    await access(new URL(`../../public/idea-board/assets/${concept.image}.webp`, import.meta.url));
    for (const link of concept.connections) {
      const project = projects.find((item) => item.id === link.project);
      const [scopeId, initiativeId] = link.scope.split('/');
      const scope = project?.scopes.find((scope) => scope.id === scopeId);
      assert.ok(scope);
      if (initiativeId) assert.ok(scope.initiatives.some((item) => item.id === initiativeId));
      assert.ok(['recorded', 'suggested'].includes(link.level));
      assert.ok(link.why.length > 15 && link.evidence.length > 15);
    }
  }
});

test('new records stay visible as unassigned in both lenses', () => {
  const future = { id: 'IB-9999', title: 'Future research' };
  assert.equal(conceptFor(future).title, future.title);
  assert.ok(matchesProject(future, 'unassigned'));
  for (const mode of ['project', 'category']) {
    assert.equal(groupRecords([future], mode)[0].records[0], future);
  }
});

test('category grouping partitions records exactly once while project grouping preserves coverage', () => {
  const categoryIds = groupRecords(data.records, 'category').flatMap((group) => group.records.map((record) => record.id));
  assert.equal(categoryIds.length, new Set(categoryIds).size);
  assert.deepEqual(new Set(categoryIds), new Set(data.records.map((record) => record.id)));
  const projectIds = groupRecords(data.records, 'project').flatMap((group) => group.records.map((record) => record.id));
  assert.deepEqual(new Set(projectIds), new Set(categoryIds));
});

test('scope filters do not leak other projects and preserve multi-project relevance', () => {
  const world = data.records.filter((record) => matchesProject(record, 'aralia/world'));
  assert.deepEqual(world.map((record) => record.id).sort(), ['IB-0001', 'IB-0002', 'IB-0003', 'IB-0004']);
  const motion = data.records.find((record) => record.id === 'IB-0007');
  assert.ok(matchesProject(motion, 'entity-studio/motion'));
  assert.ok(matchesProject(motion, 'aralia/character/character-creator'));
  assert.ok(!matchesProject(motion, 'aralia/world'));
  assert.ok(groupRecords(world, 'project', 'aralia/world').every((group) => group.id === 'aralia/world' || group.id.startsWith('aralia/world/')));
  const allAralia = groupRecords(data.records, 'project', 'aralia');
  assert.ok(allAralia.length >= 6);
  assert.ok(allAralia.every((group) => group.projectId === 'aralia'));
  assert.equal(new Set(allAralia.flatMap((group) => group.records.map((record) => record.id))).size, 11);
});

test('Planmap categories and initiatives include standalone projects and multi-category research', () => {
  const aralia = projects.find((project) => project.id === 'aralia');
  assert.deepEqual(aralia.scopes.map((scope) => scope.id), Object.keys(plan.campaigns));
  const initiativeIds = aralia.scopes.flatMap((scope) => scope.initiatives.map((item) => item.id));
  assert.ok(initiativeIds.includes('entity-studio-carveout'));
  assert.ok(initiativeIds.includes('agent-matrix-dashboard'));
  const ocean = data.records.find((record) => record.id === 'IB-0001');
  for (const selection of ['aralia/world', 'aralia/travel/ocean-surface', 'aralia/rendering']) assert.ok(matchesProject(ocean, selection));
  assert.ok(!matchesProject(ocean, 'aralia/travel/road-systems'));
  const size = concepts['IB-0001'].connections.length;
  configurePlanmap(plan);
  assert.equal(concepts['IB-0001'].connections.length, size);
});

test('separate generator project mappings are explicitly suggestions', () => {
  const links = Object.values(concepts).flatMap((concept) => concept.connections).filter((link) => link.project === 'dd-generator');
  assert.ok(links.length > 0);
  assert.ok(links.every((link) => link.level === 'suggested'));
});

test('Crimson Ledger is a separate project with tentative creator research', () => {
  const project = projects.find((item) => item.id === 'crimson-ledger');
  assert.equal(project?.name, 'Crimson Ledger');
  assert.deepEqual(project.scopes.map((scope) => scope.id), ['creator', 'campaigns']);
  const links = Object.values(concepts).flatMap((concept) => concept.connections).filter((link) => link.project === project.id);
  assert.deepEqual(links.length, 2);
  assert.ok(links.every((link) => link.scope === 'creator' && link.level === 'suggested'));
  assert.deepEqual(groupRecords(data.records, 'project', project.id).flatMap((group) => group.records.map((record) => record.id)).sort(), ['IB-0008', 'IB-0010']);
  assert.deepEqual(groupRecords(data.records, 'project', project.id + '/campaigns'), []);
  assert.ok(!matchesProject(data.records.find((record) => record.id === 'IB-0010'), project.id + '/campaigns'));
});
