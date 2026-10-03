/**
 * An illustrated, keyboard-accessible map of the existing research collection.
 * Project and category views are two lenses on the same records. Filters never
 * change assessments. The original index and revision URLs remain available.
 * Group containers replace a force simulation so labels do not drift or collide.
 */
import { currentRevision, filterRecords, recordUrl, IDEA_KINDS, CONFIDENCE_LEVELS, ASSESSMENT_STATUSES } from './lib.mjs';
import { categories, projects, conceptFor, matchesProject, groupRecords, ideaProjectGroups } from './organization.mjs';

let focusedIdea = '';
let previousSelected = '';
const view = { mode: 'project', project: '', selected: 'IB-0010', query: '', status: '', kind: '', confidence: '', sort: 'newest', filtersOpen: false, projectMenuOpen: false };
const esc = (text) => String(text ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const badge = (status) => `<span class="orbit-status ${status === 'promising' ? 'promising' : status === 'worth watching' ? 'watching' : ''}">${esc(status)}</span>`;
const art = (concept, className = '') => concept.image ? `<img class="${className}" src="./assets/${esc(concept.image)}.webp" alt="" loading="lazy">` : '';
const select = (key, label, values) => `<label>${label}<select data-filter="${key}"><option value="">All</option>${values.map((value) => `<option ${view[key] === value ? 'selected' : ''} value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`;

// Project breadcrumbs use the same filters as the rail, with separate targets
// for the whole project and its narrower area of research.
function groupHeading(group, mode) {
  if (mode !== 'project') return esc(group.name);
  const [projectId, scopeId, initiativeId] = group.id.split('/');
  const project = projects.find((item) => item.id === projectId);
  const scope = project?.scopes.find((item) => item.id === scopeId);
  const initiative = scope?.initiatives?.find((item) => item.id === initiativeId);
  const button = (id, name) => `<button type="button" class="group-select" data-project="${esc(id)}" aria-label="Show ${esc(name)} ideas" aria-pressed="${view.project === id}">${esc(name)}</button>`;
  return button(projectId, project?.name ?? group.name) + (scope ? ` <span aria-hidden="true">/</span> ${button(projectId + '/' + scopeId, scope.name)}` : '') + (initiative ? ` <span aria-hidden="true">/</span> ${button(group.id, initiative.name)}` : '');
}

export function mountConstellation(host, data, openLedger) {
  const render = (focusKey = '', caret = null) => {
    view.filtersOpen = host.querySelector('.explore-filters')?.open ?? view.filtersOpen;
    let records = filterRecords(data.records, { query: view.query, status: view.status, kind: view.kind, confidence: view.confidence }).filter((record) => matchesProject(record, view.project));
    if (focusedIdea) records = data.records.filter((record) => record.id === focusedIdea);
    records.sort((a, b) => view.sort === 'title' ? a.title.localeCompare(b.title) : (view.sort === 'oldest' ? -1 : 1) * currentRevision(b).assessedAt.localeCompare(currentRevision(a).assessedAt));
    // Never leave the inspector showing an item excluded by the active filters.
    if (!records.some((record) => record.id === view.selected)) view.selected = records[0]?.id ?? '';
    const selected = records.find((record) => record.id === view.selected);
    const groups = focusedIdea ? ideaProjectGroups(data.records, focusedIdea) : groupRecords(records, view.mode, view.project);
    const displayMode = focusedIdea ? 'project' : view.mode;
    const visibleProjects = focusedIdea ? projects.filter((project) => records.some((record) => matchesProject(record, project.id))) : projects;
    const countFor = (selection) => (focusedIdea ? records : data.records).filter((record) => matchesProject(record, selection)).length;
    const navButton = (id, name, child = false) => `<button type="button" class="project-choice ${child ? 'project-child' : ''}" data-project="${id}" aria-pressed="${view.project === id}"><span>${esc(name)}</span><small>${countFor(id)}</small></button>`;
    host.innerHTML = `<div class="constellation-layout ${focusedIdea ? 'idea-focused' : ''}">
      <button type="button" class="mobile-project-toggle" data-toggle-projects aria-expanded="${view.projectMenuOpen}" aria-controls="explore-projects">${view.projectMenuOpen ? 'Hide projects' : 'Browse projects'}</button>
      <aside id="explore-projects" class="project-rail ${view.projectMenuOpen ? 'projects-open' : ''}" aria-label="Projects">
        <span class="orbit-eyebrow">Your research universe</span>
        <h2>Projects</h2>
        ${navButton('', 'All projects')}
        ${visibleProjects.map((project) => `<details class="project-tree" open><summary>${esc(project.name)}${project.url ? ` <a class="project-launch" href="${esc(project.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(project.name)} (new tab)" title="Open ${esc(project.name)} in a new tab">Open ↗</a>` : ''}</summary><p>${esc(project.description)}</p>${navButton(project.id, 'All in this project', true)}${project.scopes.filter((scope) => !focusedIdea || countFor(`${project.id}/${scope.id}`)).map((scope) => scope.initiatives ? `<div class="scope-branch">${navButton(`${project.id}/${scope.id}`, scope.name, true)}<details ${view.project.startsWith(`${project.id}/${scope.id}`) ? 'open' : ''}><summary>Initiatives (${scope.initiatives.length})</summary>${scope.initiatives.filter((item) => !focusedIdea || countFor(`${project.id}/${scope.id}/${item.id}`)).map((item) => navButton(`${project.id}/${scope.id}/${item.id}`, item.name, true)).join('')}</details></div>` : navButton(`${project.id}/${scope.id}`, scope.name, true)).join('')}</details>`).join('')}
        ${!focusedIdea || countFor('unassigned') ? navButton('unassigned', 'Unassigned') : ''}
        <div class="rail-note"><strong>A place for possibilities.</strong><p>Connections describe relevance, not adoption. Ideas can belong to several projects.</p></div>
      </aside>
      <section class="explore-space" aria-label="Idea constellation">
        <div class="explore-heading"><div><span class="orbit-eyebrow">Research in context</span><h2>Idea constellation</h2></div><span class="explore-count">${records.length} / ${data.records.length} ideas</span></div>
        <p class="explore-intro">Find the connections. Follow the evidence.</p>
        <div class="explore-toolbar"><div class="lens-switch" role="group" aria-label="Group ideas"><button type="button" data-mode="category" aria-pressed="${view.mode === 'category'}">By category</button><button type="button" data-mode="project" aria-pressed="${displayMode === 'project'}">By project</button></div><button class="index-link" type="button" data-ledger>List view</button></div>
        <label class="orbit-search"><span class="sr-only">Search ideas</span><input type="search" data-query placeholder="Search concepts, techniques, or IDs…" value="${esc(view.query)}"></label>
        <details class="explore-filters" ${view.filtersOpen || view.status || view.kind || view.confidence ? 'open' : ''}><summary>Filter & sort${view.status || view.kind || view.confidence ? ' · active' : ''}</summary><div>${select('status', 'Status', ASSESSMENT_STATUSES)}${select('kind', 'Source maturity', IDEA_KINDS)}${select('confidence', 'Confidence', CONFIDENCE_LEVELS)}<label>Sort<select data-filter="sort"><option value="newest" ${view.sort === 'newest' ? 'selected' : ''}>Newest assessment</option><option value="oldest" ${view.sort === 'oldest' ? 'selected' : ''}>Oldest assessment</option><option value="title" ${view.sort === 'title' ? 'selected' : ''}>Title A to Z</option></select></label></div></details>
        ${view.project || view.query || view.status || view.kind || view.confidence ? '<button class="reset-explore" type="button" data-reset>Clear filters and project selection</button>' : ''}
        <div class="idea-focus-banner" ${focusedIdea ? '' : 'hidden'}><div><strong>${esc(selected ? conceptFor(selected).title : '')} · ${esc(focusedIdea)}</strong><p>Only this idea, across all relevant projects and repos. Other filters are paused.</p></div><button type="button" data-exit-focus>Back to previous view</button></div><div class="constellation-groups">${groups.map((group, index) => `<section class="orbit-group tone-${index % 3}" aria-label="${esc(group.name)}"><header><span class="orbit-eyebrow">${displayMode === 'project' ? 'Project' : 'Category'}</span><h3>${groupHeading(group, displayMode)}</h3><p>${esc(group.description)}</p></header><div class="orbit-nodes">${group.records.map((record) => {
          const concept = conceptFor(record);
          const groupScope = group.id.split('/').slice(1).join('/');
          const relevant = concept.connections.filter((link) => link.project === (group.projectId ?? group.id) && (!groupScope || link.scope === groupScope || link.scope.startsWith(groupScope + '/')));
          const suggested = displayMode === 'project' && relevant.length && relevant.every((link) => link.level === 'suggested');
          return `<div class="idea-tile"><button type="button" class="idea-node ${suggested ? 'suggested-node' : ''}" data-record="${record.id}" data-group="${group.id}" aria-pressed="${record.id === view.selected}" aria-label="${esc(concept.title)} — ${record.id}${suggested ? ', suggested relevance' : ''}"><span class="node-image">${art(concept)}</span><strong>${esc(concept.title)}</strong><small>${esc(record.id)}${suggested ? ' · suggested' : ''}</small>${badge(currentRevision(record).status)}</button><button type="button" class="idea-projects-button" data-focus-idea="${record.id}" aria-label="Show ${esc(concept.title)} across projects" aria-pressed="${focusedIdea === record.id}">Show across projects</button></div>`;
        }).join('')}</div></section>`).join('') || '<div class="orbit-empty"><h3>No matching ideas</h3><p>Try another project or clear the filters.</p><button type="button" data-reset>Show all ideas</button></div>'}</div>
        <div class="map-key">${displayMode === 'project' ? '<span>Solid ring: recorded relevance</span><span>Dashed ring: suggested relevance</span>' : '<span>Each group describes a main concept.</span>'}<p>${displayMode === 'project' ? 'An idea may appear in several projects. Counts refer to unique ideas.' : 'Project connections remain in the inspector.'} Illustrations are conceptual.</p></div>
      </section>
      <aside class="idea-inspector" aria-label="Selected idea">${selected ? inspector(selected, data) : '<p>Select a matching idea to explore its evidence.</p>'}</aside>
    </div>`;

    // Re-rendered controls retain focus so keyboard navigation and live search
    // remain usable. Clicking a node leaves focus on that same project instance.
    if (focusKey) {
      const element = host.querySelector(focusKey);
      element?.focus({ preventScroll: true });
      if (caret !== null) element?.setSelectionRange?.(caret, caret);
    }
  };

  host.onclick = (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-focus-idea')) {
      if (!focusedIdea) previousSelected = view.selected;
      focusedIdea = button.dataset.focusIdea;
      view.selected = focusedIdea;
      render('[data-exit-focus]');
      host.querySelector('.idea-focus-banner')?.scrollIntoView({ block: 'start' });
      return;
    }
    if (button.hasAttribute('data-exit-focus')) {
      focusedIdea = '';
      view.selected = previousSelected;
      return render('[data-query]');
    }
    // Deliberate navigation exits the temporary cross-project view.
    if (button.hasAttribute('data-project') || button.hasAttribute('data-reset')) focusedIdea = '';
    if (button.hasAttribute('data-toggle-projects')) { view.projectMenuOpen = !view.projectMenuOpen; return render('[data-toggle-projects]'); }
    if (button.hasAttribute('data-ledger')) return openLedger();
    if (button.hasAttribute('data-reset')) {
      Object.assign(view, { project: '', query: '', status: '', kind: '', confidence: '' });
      return render('[data-query]');
    }
    if (button.hasAttribute('data-mode')) { view.mode = button.dataset.mode; return render(`[data-mode="${view.mode}"]`); }
    if (button.hasAttribute('data-project')) {
      view.project = button.dataset.project;
      render(`[data-project="${view.project}"]`);
      // A long project rail can outgrow the filtered results. Keep the new
      // results in view rather than leaving the reader below an empty center.
      host.querySelector('.explore-space')?.scrollIntoView({ block: 'start' });
      return;
    }
    if (button.hasAttribute('data-record')) {
      view.selected = button.dataset.record;
      render(`[data-record="${view.selected}"][data-group="${button.dataset.group}"]`);
      // The stacked mobile inspector should be discoverable after selection.
      if (window.matchMedia('(max-width: 760px)').matches) host.querySelector('.idea-inspector')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  host.oninput = (event) => {
    if (!event.target.hasAttribute('data-query')) return;
    view.query = event.target.value;
    render('[data-query]', event.target.selectionStart);
  };
  host.onchange = (event) => {
    const key = event.target.dataset.filter;
    if (!['status', 'kind', 'confidence', 'sort'].includes(key)) return;
    view[key] = event.target.value;
    render(`[data-filter="${key}"]`);
  };
  render();
}

function inspector(record, data) {
  const concept = conceptFor(record);
  const revision = currentRevision(record);
  const category = categories.find((item) => item.id === concept.category);
  return `<div class="inspector-top"><span class="orbit-eyebrow">Research idea</span><span>${esc(record.id)}</span></div>
    ${concept.image ? `<figure class="inspector-art">${art(concept)}<figcaption>Concept illustration</figcaption></figure>` : ''}
    <h2>${esc(concept.title)}</h2><p class="full-research-title">${esc(record.title)}</p>
    <div class="inspector-badges">${badge(revision.status)}<span>${esc(revision.confidence)} confidence</span><span>${esc(record.kind)}</span></div>
    <p class="inspector-summary">${esc(record.summary)}</p>
    <a class="assessment-cta" href="${recordUrl(record.id)}">Open assessment</a>
    <section><h3>Categories</h3><span class="category-label">${esc(category?.name ?? 'Unassigned')}</span><div class="inspector-tags">${record.tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div></section>
    <section><h3>Relevant projects</h3>${concept.connections.map((link) => {
      const project = projects.find((item) => item.id === link.project);
      const [scopeId, initiativeId] = link.scope.split('/');
      const scope = project.scopes.find((item) => item.id === scopeId);
      const initiative = scope?.initiatives?.find((item) => item.id === initiativeId);
      return `<details class="connection ${link.level}"><summary><span>${esc(project.name)}<small>${esc(scope?.name ?? link.scope)}${initiative ? ' / ' + esc(initiative.name) : ''}</small></span><em>${link.level === 'recorded' ? 'Recorded relevance' : 'Suggested'}</em></summary><p>${esc(link.why)}</p><p class="connection-evidence">Evidence: ${esc(link.evidence)}</p></details>`;
    }).join('') || '<p>No project connection has been assessed yet.</p>'}<p class="connection-note">Expand a connection to see why it belongs here.</p></section>
    <section><h3>Related research</h3>${(record.relatedIdeaIds ?? []).map((id) => data.records.find((item) => item.id === id)).filter(Boolean).map((item) => `<a class="related-research" href="${recordUrl(item.id)}">${esc(conceptFor(item).title)} <small>${esc(item.id)}</small></a>`).join('') || '<p>No explicit research links recorded.</p>'}</section>
    <div class="inspector-baseline"><span>Assessed ${esc(revision.assessedAt.slice(0, 10))}</span><span>Baseline ${esc(revision.projectBaseline.commit.slice(0, 9))}</span></div>`;
}
