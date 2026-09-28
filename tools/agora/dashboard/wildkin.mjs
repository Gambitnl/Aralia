import { campaignKeys, pathIsWildkin, scopeRecords } from './wildkin-scope.mjs';

const $ = (id) => document.getElementById(id);
const POLL_MS = 30_000;
let scopedTasks = [];
let scopedCampaigns = [];
let scopedLocks = [];
let scopedReservations = [];
let scopedMessages = [];
let activeAgents = [];
let allAgents = [];
let allMessages = [];
let lastMessageSeq = 0;
let sourceTasks = [];
let sourceCampaigns = [];
let sourceLocks = [];
let sourceReservations = [];
let lastRefreshAt = 0;
let nextPollAt = Date.now() + POLL_MS;
let sseConnected = false;
let failedCoreSources = 0;
let refreshing = false;
let eventRefreshTimer;

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text != null) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function short(value, limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

function updateCounts() {
  $('count-tasks').textContent = String(scopedTasks.length);
  $('count-campaigns').textContent = String(scopedCampaigns.length);
  $('count-locks').textContent = String(scopedLocks.length);
  $('count-reservations').textContent = String(scopedReservations.length);
  $('count-messages').textContent = String(scopedMessages.length);
  $('campaign-count').textContent = String(scopedCampaigns.length);
  $('lock-count').textContent = String(scopedLocks.length);
  $('reservation-count').textContent = String(scopedReservations.length);
}

function renderTasks() {
  const host = $('task-list');
  const state = $('state-filter').value;
  const query = $('search').value.trim().toLowerCase();
  const stateMatches = (task) => state === 'all'
    || (state === 'active' && ['open', 'claimed', 'in_progress'].includes(task.state))
    || task.state === state;
  const rows = scopedTasks.filter((task) => stateMatches(task)
    && (!query || [task.title, task.body, task.category, task.id, ...(task.refs || []), ...(task.retraceFiles || [])]
      .join(' ').toLowerCase().includes(query)));
  const order = { open: 0, claimed: 1, in_progress: 2, blocked: 3, done: 4 };
  rows.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9)
    || (a.priority ?? 99) - (b.priority ?? 99)
    || String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  $('task-count').textContent = String(scopedTasks.length);
  $('task-summary').textContent = `${rows.length} shown · ${scopedTasks.length} scoped`;
  host.replaceChildren();
  if (!rows.length) {
    const empty = node('div', null, 'empty');
    if (!scopedTasks.length) {
      empty.append(node('strong', 'No Wildkin repo tasks are on Agora yet.'));
      empty.append('Add a task reference beginning with ');
      empty.append(node('code', 'Wildkin/src/…'));
      empty.append(' or put Wildkin paths in a campaign’s paths or globs.');
    } else empty.textContent = query ? 'No scoped tasks match this search.' : 'No scoped tasks in this state.';
    host.append(empty);
    return;
  }
  for (const task of rows) {
    const row = node('article', null, 'task-row');
    const title = node('div', null, 'row-title');
    title.append(node('span', task.title || task.id || 'Untitled task'));
    title.append(node('span', task.state || 'unknown', `pill ${task.state || ''}`));
    row.append(title);
    const campaign = scopedCampaigns.find((candidate) => campaignKeys(candidate)
      .includes(String(task.campaignId || '').toLowerCase()));
    const meta = [task.id, task.category, `priority ${task.priority ?? '—'}`, campaign?.name || task.campaignId]
      .filter(Boolean).join(' · ');
    row.append(node('div', meta, 'row-meta'));
    if (task.body) row.append(node('p', short(task.body), 'row-note'));
    const taskPaths = [...(task.refs || []), ...(task.retraceFiles || [])].filter(pathIsWildkin);
    if (taskPaths.length) {
      const refs = node('div', null, 'refs');
      for (const ref of [...new Set(taskPaths)].slice(0, 6)) refs.append(node('span', ref, 'ref'));
      row.append(refs);
    }
    host.append(row);
  }
}

function renderCampaigns() {
  const host = $('campaign-list');
  const rows = [...scopedCampaigns].sort((a, b) =>
    (a.state === 'done') - (b.state === 'done') || String(a.name || a.id).localeCompare(String(b.name || b.id)));
  $('campaign-count').textContent = String(rows.length);
  host.replaceChildren();
  if (!rows.length) {
    host.append(node('div', 'No campaigns currently include Wildkin repo paths.', 'empty'));
    return;
  }
  for (const campaign of rows) {
    const row = node('article', null, 'side-row');
    const title = node('div', null, 'row-title');
    title.append(node('span', campaign.name || campaign.id));
    title.append(node('span', campaign.state || 'unknown', `pill ${campaign.state === 'done' ? 'done' : ''}`));
    row.append(title);
    if (campaign.scope) row.append(node('p', short(campaign.scope), 'row-note'));
    const paths = [...(campaign.paths || []), ...(campaign.globs || [])].filter(pathIsWildkin);
    if (paths.length) row.append(node('div', paths.join(' · '), 'row-meta'));
    host.append(row);
  }
}

function renderLocks() {
  const host = $('lock-list');
  $('lock-count').textContent = String(scopedLocks.length);
  host.replaceChildren();
  if (!scopedLocks.length) {
    host.append(node('div', 'No active locks on Wildkin paths.', 'empty'));
    return;
  }
  for (const lock of scopedLocks) {
    const row = node('article', null, 'side-row');
    const values = [...(lock.paths || []), ...(lock.globs || [])].filter(pathIsWildkin);
    row.append(node('div', lock.handle || lock.agentName || agentLabel(lock.agentId), 'row-title'));
    if (values.length) row.append(node('div', values.join(' · '), 'row-meta'));
    if (lock.reason) row.append(node('p', short(lock.reason, 180), 'row-note'));
    host.append(row);
  }
}

function agentLabel(id) {
  const agent = allAgents.find((candidate) => candidate.id === id);
  return agent?.handle || agent?.name || id || 'Unknown agent';
}

function renderReservations() {
  const host = $('reservation-list');
  $('reservation-count').textContent = String(scopedReservations.length);
  host.replaceChildren();
  if (!scopedReservations.length) {
    host.append(node('div', 'No reservations on Wildkin paths.', 'empty'));
    return;
  }
  for (const reservation of scopedReservations) {
    const row = node('article', null, 'side-row');
    const title = node('div', null, 'row-title');
    title.append(node('span', agentLabel(reservation.agentId)));
    title.append(node('span', `queue #${reservation.position || 1}`, 'pill'));
    row.append(title);
    const values = [...(reservation.paths || []), ...(reservation.globs || [])].filter(pathIsWildkin);
    if (values.length) row.append(node('div', values.join(' · '), 'row-meta'));
    if (reservation.reason) row.append(node('p', short(reservation.reason, 240), 'row-note'));
    host.append(row);
  }
}

function renderMessageChannel(channel, hostId, countId) {
  const host = $(hostId);
  const rows = scopedMessages
    .filter((message) => (message.channel || 'main') === channel)
    .sort((a, b) => (b.seq || 0) - (a.seq || 0));
  $(countId).textContent = String(rows.length);
  host.replaceChildren();
  if (!rows.length) {
    const kind = channel === 'command' ? 'command traffic' : 'messages';
    const empty = node('div', `No Wildkin ${kind} yet. Agora messages have no repo field, so this panel shows only posts naming Wildkin or a scoped task/campaign ID.`, 'empty');
    host.append(empty);
    return;
  }
  if (rows.length > 100) host.append(node('div', `Showing the latest 100 of ${rows.length} scoped posts.`, 'feed-summary'));
  for (const message of rows.slice(0, 100)) {
    const row = node('article', null, 'side-row');
    const title = node('div', null, 'row-title');
    title.append(node('span', agentLabel(message.from)));
    if (message.to && message.to !== 'all') title.append(node('span', `to ${agentLabel(message.to)}`, 'pill'));
    row.append(title);
    if (message.createdAt) row.append(node('div', new Date(message.createdAt).toLocaleString(), 'row-meta'));
    row.append(node('p', message.body || '(empty message)', 'row-note'));
    host.append(row);
  }
}

function renderAgents(allAgents) {
  const agentIds = new Set();
  for (const task of scopedTasks) {
    if (['claimed', 'in_progress'].includes(task.state) && task.claimedBy) agentIds.add(task.claimedBy);
  }
  for (const lock of scopedLocks) if (lock.agentId) agentIds.add(lock.agentId);
  for (const reservation of scopedReservations) if (reservation.agentId) agentIds.add(reservation.agentId);
  activeAgents = allAgents.filter((agent) => agentIds.has(agent.id));
  $('agent-count').textContent = String(activeAgents.length);
  $('count-agents').textContent = String(activeAgents.length);
  const host = $('agent-list');
  host.replaceChildren();
  if (!activeAgents.length) {
    host.append(node('div', 'No agents currently hold Wildkin tasks or file locks.', 'empty'));
    return;
  }
  for (const agent of activeAgents) {
    const row = node('div', null, 'agent-line');
    row.append(node('span', null, 'agent-dot'));
    row.append(node('span', agent.handle || agent.name || agent.id, 'agent-name'));
    const heldTasks = scopedTasks.filter((task) => task.claimedBy === agent.id).length;
    const heldLocks = scopedLocks.filter((lock) => lock.agentId === agent.id).length;
    row.append(node('span', `${heldTasks} tasks · ${heldLocks} locks`, 'agent-detail'));
    host.append(row);
  }
}

function setConnection(state, message) {
  $('connection').dataset.state = state;
  $('connection-label').textContent = message;
}

function renderConnection() {
  if (failedCoreSources === 6) setConnection('offline', 'Agora unavailable');
  else if (failedCoreSources) setConnection('connected', `Partially available · ${failedCoreSources} source(s) failed`);
  else if (sseConnected) setConnection('connected', 'SSE connected');
  else setConnection('loading', 'reconnecting');
}

function renderRefreshMeta() {
  if (!lastRefreshAt) return;
  const at = new Date(lastRefreshAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const nextIn = Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
  $('updated-at').textContent = `refreshed at ${at} · next poll in ${nextIn}s`;
}

function renderHealth(health) {
  const uptime = Math.max(0, Number(health.uptime) || 0);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  $('hdr-meta').textContent = `v${health.version || '?'} · up ${hours ? `${hours}h ` : ''}${minutes}m · :${health.port || '?'}`;
  $('count-gaps').textContent = typeof health.counts?.gapsOpen === 'number'
    ? String(health.counts.gapsOpen) : '—';
}

async function request(path) {
  const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  $('refresh').disabled = true;
  $('refresh').textContent = 'Refreshing…';
  const results = await Promise.allSettled([
    request('/tasks'), request('/campaigns'), request('/locks'), request('/agents'),
    request('/reservations'), request(`/messages?channel=all&since=${lastMessageSeq}`),
    request('/health'), request('/pets'),
  ]);
  const [tasksResult, campaignsResult, locksResult, agentsResult, reservationsResult, messagesResult, healthResult, petsResult] = results;
  if (tasksResult.status === 'fulfilled') sourceTasks = tasksResult.value.tasks || [];
  if (campaignsResult.status === 'fulfilled') sourceCampaigns = campaignsResult.value.campaigns || [];
  if (locksResult.status === 'fulfilled') sourceLocks = locksResult.value.locks || [];
  if (agentsResult.status === 'fulfilled') allAgents = agentsResult.value.agents || [];
  if (reservationsResult.status === 'fulfilled') sourceReservations = reservationsResult.value.reservations || [];
  if (messagesResult.status === 'fulfilled') {
    for (const message of messagesResult.value.messages || []) {
      if (!allMessages.some((known) => known.id === message.id)) allMessages.push(message);
      lastMessageSeq = Math.max(lastMessageSeq, Number(message.seq) || 0);
    }
  }
  if (healthResult.status === 'fulfilled') renderHealth(healthResult.value);
  if (petsResult.status === 'fulfilled') $('pets-count').textContent = String((petsResult.value.pets || []).length);
  const scoped = scopeRecords(sourceTasks, sourceCampaigns, sourceLocks, sourceReservations, allMessages);
  scopedTasks = scoped.tasks;
  scopedCampaigns = scoped.campaigns;
  scopedLocks = scoped.locks;
  scopedReservations = scoped.reservations;
  scopedMessages = scoped.messages;
  updateCounts();
  renderTasks();
  renderCampaigns();
  renderLocks();
  renderReservations();
  renderMessageChannel('command', 'command-list', 'command-count');
  renderMessageChannel('main', 'message-list', 'message-count');
  renderAgents(allAgents);

  failedCoreSources = results.slice(0, 6).filter((result) => result.status === 'rejected').length;
  if (failedCoreSources < 6) lastRefreshAt = Date.now();
  renderConnection();
  renderRefreshMeta();
  $('refresh').disabled = false;
  $('refresh').textContent = 'Refresh';
  refreshing = false;
}

function scheduleEventRefresh() {
  if (eventRefreshTimer) return;
  eventRefreshTimer = window.setTimeout(() => {
    eventRefreshTimer = undefined;
    refresh();
  }, 250);
}

function connectEvents() {
  const stream = new EventSource('/events');
  stream.addEventListener('open', () => { sseConnected = true; renderConnection(); });
  stream.addEventListener('error', () => { sseConnected = false; renderConnection(); });
  stream.addEventListener('hello', scheduleEventRefresh);
  for (const name of [
    'agent.register', 'agent.drop', 'lock.acquire', 'lock.release', 'lock.expired',
    'reservation.create', 'reservation.release', 'reservation.fulfill',
    'campaign.claim', 'campaign.state', 'task.create', 'task.claim', 'task.state',
    'task.release', 'task.handoff', 'task.categories', 'task.checkpoint', 'message.post',
  ]) stream.addEventListener(name, scheduleEventRefresh);
}

$('refresh').addEventListener('click', refresh);
$('search').addEventListener('input', renderTasks);
$('state-filter').addEventListener('change', renderTasks);
function readCollapsePrefs(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
const wildkinCollapseKey = 'agora.wildkin.collapsedPanels.v1';
const ownCollapsePrefs = readCollapsePrefs(wildkinCollapseKey);
const collapsedPrefs = {
  ...readCollapsePrefs('agora.dashboard.collapsedPanels.v1'),
  ...ownCollapsePrefs,
};
for (const panel of document.querySelectorAll('main > .panel[data-panel-id]')) {
  const heading = panel.querySelector('h2');
  const panelId = panel.dataset.panelId;
  const initiallyCollapsed = Boolean(collapsedPrefs[panelId]);
  panel.classList.toggle('collapsed', initiallyCollapsed);
  heading.setAttribute('aria-expanded', String(!initiallyCollapsed));
  const toggle = () => {
    const collapsed = panel.classList.toggle('collapsed');
    heading.setAttribute('aria-expanded', String(!collapsed));
    ownCollapsePrefs[panelId] = collapsed;
    try { localStorage.setItem(wildkinCollapseKey, JSON.stringify(ownCollapsePrefs)); } catch {}
  };
  heading.addEventListener('click', toggle);
  heading.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  });
}
refresh();
connectEvents();
window.setInterval(renderRefreshMeta, 1000);
window.setInterval(() => { nextPollAt = Date.now() + POLL_MS; refresh(); }, POLL_MS);
