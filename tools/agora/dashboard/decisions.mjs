/**
 * Shows the owner's unanswered requests without changing board records.
 * Tasks and linked question sheets retain authority over answers and permissions.
 */
import { collectHumanRequests, sourceLinks, blockingDependents } from './decision-inbox.mjs';

const $ = (id) => document.getElementById(id);
let tasks = [], campaigns = [], requests = [], kind = 'decision', selectedId = new URLSearchParams(location.search).get('task');
let loading = false;
// Refreshes replace the visible brief with current board data. Keep the owner's
// reading choices separately, by task, so polling does not close their sections
// or carry another task's expanded sections into a newly selected request.
const disclosureStates = new Map();
let detailTaskId = null;
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function campaignName(id) {
  const campaign = campaigns.find((row) => row.id === id);
  return campaign?.name || campaign?.alias || id || 'Standalone';
}
function date(at) { return at ? new Date(at).toLocaleString() : 'Not recorded'; }
function section(title, text, { folded = false } = {}) {
  const block = node(folded ? 'details' : 'section');
  if (folded) {
    block.dataset.disclosure = title;
    block.open = disclosureStates.get(detailTaskId)?.get(title) ?? false;
  }
  block.append(node(folded ? 'summary' : 'h3', title), node('div', text || 'Not recorded.', 'prose'));
  return block;
}
function taskLink(task) {
  const link = node('a', 'Open task on board');
  link.href = '/?task=' + encodeURIComponent(task.id);
  return link;
}
function renderDetail(request) {
  const host = $('detail');
  if (detailTaskId) {
    const saved = disclosureStates.get(detailTaskId) || new Map();
    host.querySelectorAll('details[data-disclosure]').forEach((block) => saved.set(block.dataset.disclosure, block.open));
    disclosureStates.set(detailTaskId, saved);
  }
  detailTaskId = request?.task.id || null;
  host.replaceChildren();
  if (!request) { host.append(node('p', 'No matching requests.', 'empty')); return; }
  const { task, reason, explicit, stale } = request;
  host.append(node('p', explicit ? 'Registered human request' : 'Human blocker from the existing board', 'meta'), node('h2', task.title));
  const facts = node('dl', null, 'facts');
  const creator = task.creatorAgent?.handle || task.createdBy || 'Not recorded';
  for (const [label, value] of [['Campaign', campaignName(task.campaignId)], ['Raised by', creator], ['Updated', date(task.updatedAt)], ['State', task.state]]) {
    const pair = node('div'); pair.append(node('dt', label), node('dd', value)); facts.append(pair);
  }
  host.append(facts);
  if (stale) host.append(node('p', 'Needs a freshness check: this task has not been updated in over 14 days.', 'stale'));
  host.append(section('What is waiting on you', reason || task.body));
  const prose = host.lastElementChild.querySelector('.prose'); prose.classList.add('reason');
  const sources = node('section'); sources.append(node('h3', 'Sources'));
  const links = node('div', null, 'sources'); links.append(taskLink(task));
  sourceLinks(task).forEach((url) => {
    const link = node('a', new URL(url).hostname.includes('claude.ai') ? 'Open question sheet' : new URL(url).hostname + ' source');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
  });
  sources.append(links); host.append(sources);
  const downstream = blockingDependents(tasks, task.id);
  if (downstream.length) {
    const block = node('section'); block.append(node('h3', `${downstream.length} task${downstream.length === 1 ? '' : 's'} waiting on this`));
    const list = node('ul');
    downstream.forEach((row) => { const item = node('li', row.title + ' '); item.append(taskLink(row)); list.append(item); });
    block.append(list); host.append(block);
  }
  if (reason && task.body) host.append(section('Full work brief', task.body, { folded: true }));
  if (task.result) host.append(section('Progress and evidence', task.result, { folded: true }));
  if (task.refs?.length) host.append(section('References', task.refs.join('\n'), { folded: true }));
  host.append(node('p', 'Task ' + task.id, 'meta'));
}
function render() {
  const query = $('search').value.trim().toLowerCase();
  const filtered = requests.filter((row) => row.kind === kind
    && ($('campaign').value === 'all' || (row.task.campaignId || 'standalone') === $('campaign').value)
    && (!query || [row.task.title, row.task.body, row.reason, row.task.id, campaignName(row.task.campaignId)].join(' ').toLowerCase().includes(query)));
  const selected = filtered.find((row) => row.task.id === selectedId) || filtered[0];
  selectedId = selected?.task.id;
  const previousScroll = $('request-list').scrollTop;
  $('request-list').replaceChildren();
  if (!filtered.length) $('request-list').append(node('p', 'No matching requests.', 'empty'));
  filtered.forEach((request) => {
    const { task } = request;
    const button = node('button', null, 'request'); button.type = 'button';
    button.setAttribute('aria-pressed', String(task.id === selectedId));
    button.append(node('strong', task.title), node('span', campaignName(task.campaignId), 'meta'), node('span', date(task.updatedAt), 'meta'));
    if (request.stale) button.append(node('span', 'Needs freshness check', 'meta stale'));
    button.addEventListener('click', () => {
      selectedId = task.id;
      history.replaceState(null, '', '?task=' + encodeURIComponent(selectedId));
      render();
      $('request-list').querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    $('request-list').append(button);
  });
  $('request-list').scrollTop = previousScroll;
  renderDetail(selected);
}

async function read(url) {
  const reply = await fetch(url, { cache: 'no-store' });
  if (!reply.ok) throw new Error(url + ' returned ' + reply.status);
  return reply.json();
}
async function refresh() {
  if (loading) return;
  loading = true; $('refresh').disabled = true;
  try {
    // Tasks are the required source. A failed refresh keeps the last good list,
    // but labels it stale rather than presenting an outage as an empty inbox.
    const [board, efforts] = await Promise.all([read('/tasks'), read('/campaigns')]);
    tasks = board.tasks || []; campaigns = efforts.campaigns || []; requests = collectHumanRequests(tasks);
    const picked = requests.find((row) => row.task.id === selectedId);
    if (picked) kind = picked.kind;
    $('decision-count').textContent = requests.filter((row) => row.kind === 'decision').length;
    $('action-count').textContent = requests.filter((row) => row.kind === 'action').length;
    $('total').textContent = requests.length + ' requests need your attention';
    const currentCampaign = $('campaign').value;
    $('campaign').replaceChildren(new Option('All campaigns', 'all'));
    [...new Set(requests.map((row) => row.task.campaignId || 'standalone'))].sort().forEach((id) => $('campaign').append(new Option(campaignName(id === 'standalone' ? null : id), id)));
    if ([...$('campaign').options].some((option) => option.value === currentCampaign)) $('campaign').value = currentCampaign;
    $('status').textContent = 'Live board checked ' + new Date().toLocaleTimeString(); $('status').removeAttribute('data-error');
    document.querySelectorAll('[data-kind]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
    render();
  } catch (error) {
    $('status').textContent = 'Could not refresh the board. Displayed requests may be out of date. ' + error.message;
    $('status').setAttribute('data-error', 'true');
    if (!requests.length) { $('total').textContent = 'Board unavailable'; $('detail').replaceChildren(node('p', 'Requests could not be loaded.', 'empty')); }
  } finally { loading = false; $('refresh').disabled = false; }
}
document.querySelectorAll('[data-kind]').forEach((button) => button.addEventListener('click', () => {
  kind = button.dataset.kind; selectedId = null;
  document.querySelectorAll('[data-kind]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  render();
}));
$('campaign').addEventListener('change', render); $('search').addEventListener('input', render); $('refresh').addEventListener('click', refresh);
refresh(); setInterval(refresh, 30_000);
