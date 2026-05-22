/*
  Static dashboard controller.

  The browser owns all rendering here. The Symphony process only supplies JSON
  from stable API endpoints, so changing this file updates the dashboard after a
  normal browser refresh and does not restart active Codex worker sessions.

  The lower half of this file deliberately translates Codex protocol events into
  operator-friendly phrases. The API still exposes raw event data for debugging,
  but the dashboard should answer "what is the worker doing?" without making the
  user read JSON-RPC payloads, ANSI terminal codes, or repeated token updates.
*/

const refreshNote = document.getElementById('refresh-note');
const refreshStatus = document.getElementById('refresh-status');
const statsCard = document.getElementById('stats-card');
const taskIntakeRoot = document.getElementById('task-intake-root');
const usageRoot = document.getElementById('usage-root');
const approvalRoot = document.getElementById('approval-root');
const runningRoot = document.getElementById('running-root');
const retryingRoot = document.getElementById('retrying-root');
const activityRoot = document.getElementById('activity-root');
const manualRefreshButton = document.getElementById('manual-refresh');
const dispatchToggleButton = document.getElementById('dispatch-toggle');
const themeToggleButton = document.getElementById('theme-toggle');

const THEME_STORAGE_KEY = 'symphony-dashboard-theme';
const TASK_NAVIGATOR_FILTER_STORAGE_KEY = 'symphony-task-navigator-filter';
const TASK_NAVIGATOR_FILTERS = ['all', 'needs_input', 'open', 'completed', 'archived'];
const TASK_INTAKE_INTERACTION_HOLD_MS = 4000;
let taskNavigatorFilter = readStoredTaskNavigatorFilter();
let taskIntakeInteractionHoldUntil = 0;

initializeThemeToggle();

manualRefreshButton?.addEventListener('click', () => {
  refreshDashboard({ manual: true });
});

dispatchToggleButton?.addEventListener('click', async () => {
  const nextEnabled = dispatchToggleButton.getAttribute('aria-pressed') !== 'true';
  await setDispatchEnabled(nextEnabled);
});

themeToggleButton?.addEventListener('click', () => {
  const currentTheme = getActiveTheme();
  setDashboardTheme(currentTheme === 'dark' ? 'light' : 'dark', { persist: true });
});

approvalRoot?.addEventListener('click', async event => {
  const button = event.target?.closest?.('button[data-decision]');
  if (!button) return;

  const panel = button.closest('[data-issue]');
  const identifier = panel?.getAttribute('data-issue');
  const decision = button.getAttribute('data-decision');
  if (!identifier || !decision) return;

  await sendApprovalDecision(identifier, decision, button);
});

taskIntakeRoot?.addEventListener('submit', async event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === 'observed-pr-form') {
    event.preventDefault();
    await watchObservedPullRequest(form);
    return;
  }

  if (form.id !== 'task-draft-form') return;

  event.preventDefault();
  await createTaskDraft(form);
});

taskIntakeRoot?.addEventListener('click', async event => {
  holdTaskIntakeAutoRefresh();

  const filterButton = event.target?.closest?.('button[data-task-filter]');
  if (filterButton) {
    setTaskNavigatorFilter(filterButton.getAttribute('data-task-filter'));
    return;
  }

  const button = event.target?.closest?.('button[data-task-action]');
  if (!button) return;

  const action = button.getAttribute('data-task-action');
  if (action === 'check-git') {
    await refreshTaskIntake({ forcePreflight: true });
  }

  if (action === 'bulk-refresh-jules') {
    await bulkRefreshJules(button);
  }

  if (action === 'record-git-disposition') {
    await recordGitDisposition(button);
  }

  if (action === 'record-task-nudge') {
    await recordTaskNudge(button);
  }

  if (action === 'record-task-message') {
    await recordTaskMessage(button);
  }

  if (action === 'record-operator-preferences') {
    await recordOperatorPreferences(button);
  }

  if (action === 'refresh-due-task-nudges') {
    await runDueTaskNudges(button);
  }

  if (action === 'promote-draft') {
    const draftId = button.getAttribute('data-draft-id');
    if (draftId) {
      await promoteTaskDraft(draftId, button);
    }
  }

  if (action === 'create-linear') {
    const draftId = button.getAttribute('data-draft-id');
    if (draftId) {
      await createLinearTrackingIssue(draftId, button);
    }
  }

  if (action === 'stage-manifest') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await stageJulesManifest(handoffId, button);
    }
  }

  if (action === 'launch-jules') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await launchJulesHandoff(handoffId, button);
    }
  }

  if (action === 'refresh-jules') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await refreshJulesHandoff(handoffId, button);
    }
  }

  if (action === 'send-jules-message') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await sendJulesOperatorMessage(handoffId, button);
    }
  }

  if (action === 'record-roi-estimate') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await recordDelegationRoiEstimate(handoffId, button);
    }
  }

  if (action === 'record-roi-foreman-usage') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await recordDelegationRoiForemanUsage(handoffId, button);
    }
  }

  if (action === 'record-operator-answer') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await recordOperatorAnswer(handoffId, button);
    }
  }

  if (action === 'execute-repair-lane') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await executeSelectedRepairLane(handoffId, button);
    }
  }

  if (action === 'record-repair-push-result') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await recordRepairPushResult(handoffId, button);
    }
  }

  if (action === 'record-deployment-evidence') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await recordDeploymentEvidence(handoffId, button);
    }
  }

  if (action === 'approve-jules-plan') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await approveJulesPlan(handoffId, button);
    }
  }

  if (action === 'refresh-pr') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await refreshPullRequestStatus(handoffId, button);
    }
  }

  if (action === 'create-observed-follow-up') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await createObservedPullRequestFollowUp(handoffId, button);
    }
  }

  if (action === 'refresh-local-sync') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await refreshLocalSyncStatus(handoffId, button);
    }
  }

  if (action === 'sync-local') {
    const handoffId = button.getAttribute('data-handoff-id');
    if (handoffId) {
      await syncLocalMaster(handoffId, button);
    }
  }
});

taskIntakeRoot?.addEventListener('pointerover', holdTaskIntakeAutoRefresh);
taskIntakeRoot?.addEventListener('pointerdown', holdTaskIntakeAutoRefresh);
taskIntakeRoot?.addEventListener('focusin', holdTaskIntakeAutoRefresh);

let liveRefreshFallback = null;
let liveRefreshTimer = null;

refreshDashboard();
startLiveRefresh();

function initializeThemeToggle() {
  // The HTML head applies the saved data-theme early; this controller keeps the
  // button label and ARIA state in sync with that same source of truth.
  const savedTheme = readStoredTheme();
  if (savedTheme === 'light' || savedTheme === 'dark') {
    setDashboardTheme(savedTheme, { persist: false });
    return;
  }

  updateThemeToggle(getActiveTheme());
}

function getActiveTheme() {
  const explicitTheme = document.documentElement?.dataset?.theme;
  if (explicitTheme === 'light' || explicitTheme === 'dark') return explicitTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setDashboardTheme(theme, options = {}) {
  if (document.documentElement?.dataset) {
    document.documentElement.dataset.theme = theme;
  }

  if (options.persist) {
    writeStoredTheme(theme);
  }

  updateThemeToggle(theme);
}

function readStoredTheme() {
  // Some dashboard verifiers execute this browser controller inside a Node VM
  // where localStorage does not exist. Treat that as "no saved preference" so
  // the real browser keeps persistence while headless contract checks can still
  // load the same file.
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTheme(theme) {
  // Browser privacy settings can also block storage. The toggle should still
  // change the current page colors even if persistence is unavailable.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Keep the active in-memory theme and skip persistence.
  }
}

function readStoredTaskNavigatorFilter() {
  // The task filter is only a display preference. If storage is unavailable or
  // an old value is invalid, fall back to all tasks so no work disappears.
  try {
    const stored = typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(TASK_NAVIGATOR_FILTER_STORAGE_KEY);
    return normalizeTaskNavigatorFilter(stored);
  } catch {
    return 'all';
  }
}

function setTaskNavigatorFilter(filter) {
  taskNavigatorFilter = normalizeTaskNavigatorFilter(filter);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TASK_NAVIGATOR_FILTER_STORAGE_KEY, taskNavigatorFilter);
    }
  } catch {
    // Keep the in-memory filter for this page; persistence is optional.
  }

  refreshTaskIntake().catch(error => {
    setStatus(`Task filter changed, but dashboard refresh failed: ${error.message || error}`);
  });
}

function normalizeTaskNavigatorFilter(filter) {
  return TASK_NAVIGATOR_FILTERS.includes(filter) ? filter : 'all';
}

function updateThemeToggle(theme) {
  if (!themeToggleButton) return;

  const isDark = theme === 'dark';
  if (typeof themeToggleButton.setAttribute === 'function') {
    themeToggleButton.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }
  themeToggleButton.textContent = isDark ? 'Light mode' : 'Dark mode';
  themeToggleButton.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

function startLiveRefresh() {
  // Prefer the server event stream for near-live dashboard updates. If the
  // browser or server cannot keep the stream open, fall back to the older
  // interval so the dashboard still works without forcing a server restart.
  if (typeof EventSource === 'undefined') {
    liveRefreshFallback = setInterval(refreshDashboard, 5000);
    setStatus('Live stream unavailable; polling every 5 seconds.');
    return;
  }

  const events = new EventSource('/api/v1/events');
  const activateFallback = () => {
    events.close();
    if (!liveRefreshFallback) {
      liveRefreshFallback = setInterval(refreshDashboard, 5000);
    }
    setStatus('Live stream disconnected; polling every 5 seconds.');
  };

  events.addEventListener('open', () => {
    setStatus('Live dashboard stream connected.');
  });

  events.addEventListener('dashboard', () => {
    clearTimeout(liveRefreshTimer);
    liveRefreshTimer = setTimeout(() => {
      refreshDashboard({ source: 'event-stream' });
    }, 150);
  });

  events.addEventListener('error', activateFallback);
}

async function refreshDashboard(options = {}) {
  const scrollSnapshot = captureDashboardScroll();

  try {
    setStatus(options.manual ? 'Refreshing now.' : 'Refreshing details.');

    // Pull the lightweight overview first, then fetch full activity only for
    // currently visible issues. This keeps the dashboard responsive while still
    // giving the operator the useful worker trail.
    const state = await fetchJson('/api/v1/state');
    const activeIds = [
      ...state.running.map(issue => issue.issue_identifier),
      ...state.retrying.map(issue => issue.issue_identifier),
    ];
    const detailsById = await fetchIssueDetails(activeIds);

    renderDispatchControl(state.dispatch_control);
    renderStats(state);
    await refreshTaskIntake({ skipIfEditing: !options.manual });
    renderUsageTracker(state, detailsById);
    renderApprovals(activeIds, detailsById, state);
    renderRunning(state.running, detailsById);
    renderRetrying(state.retrying);
    renderActivity(activeIds, detailsById);

    const cadence = options.source === 'event-stream'
      ? 'Live from Symphony'
      : 'Refreshes every 5 seconds';
    const updatedAt = formatDashboardTimestamp(state.generated_at);
    refreshNote.firstChild.nodeValue =
      `${cadence}. Updated ${updatedAt}. `;
    setStatus('Updated details only.');
    restoreDashboardScroll(scrollSnapshot);
  } catch (err) {
    setStatus(`Refresh failed: ${err.message}`);
    restoreDashboardScroll(scrollSnapshot);
  }
}

function captureDashboardScroll() {
  // Polling refreshes replace several large sections above the user's current
  // viewport. Remember the vertical position before rendering so the dashboard
  // behaves like live-updating panels instead of a page that jumps to the top.
  if (typeof window === 'undefined') return null;

  return {
    x: window.scrollX ?? window.pageXOffset ?? 0,
    y: window.scrollY ?? window.pageYOffset ?? 0,
  };
}

function restoreDashboardScroll(snapshot) {
  if (!snapshot || typeof window === 'undefined') return;

  // Defer until the browser has applied the newly-rendered section heights.
  // This keeps the same reading position even when worker rows or activity
  // details above the viewport grow during a live refresh.
  setTimeout(() => {
    const maxScroll = Math.max(
      0,
      (document.documentElement?.scrollHeight ?? 0) - (window.innerHeight ?? 0),
      (document.body?.scrollHeight ?? 0) - (window.innerHeight ?? 0)
    );
    window.scrollTo(snapshot.x, Math.min(snapshot.y, maxScroll || snapshot.y));
  }, 0);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function setDispatchEnabled(enabled) {
  if (!dispatchToggleButton) return;

  dispatchToggleButton.disabled = true;
  setStatus(enabled ? 'Enabling worker dispatch.' : 'Pausing worker dispatch.');

  try {
    const control = await postJson('/api/v1/dispatch-control', { enabled });
    renderDispatchControl(control);
    await refreshDashboard({ manual: true });
    setStatus(enabled ? 'Worker dispatch enabled.' : 'Worker dispatch paused.');
  } catch (err) {
    setStatus(`Dispatch toggle failed: ${err.message}`);
  } finally {
    dispatchToggleButton.disabled = false;
  }
}

function renderDispatchControl(control) {
  if (!dispatchToggleButton) return;

  const enabled = Boolean(control?.enabled);
  const status = enabled ? 'enabled' : 'paused';

  // The visible toggle mirrors backend state only. It never stores a local
  // preference, because process startup must remain default-off even if the
  // operator enabled dispatch in a previous dashboard session.
  dispatchToggleButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  dispatchToggleButton.dataset.status = status;
  dispatchToggleButton.textContent = enabled ? 'Dispatch on' : 'Dispatch paused';
  dispatchToggleButton.title = control?.summary || (enabled
    ? 'Symphony may assign eligible workers.'
    : 'Symphony will not assign new workers until this is enabled.');
}

async function fetchIssueDetails(identifiers) {
  const entries = await Promise.all(identifiers.map(async identifier => {
    try {
      return [identifier, await fetchJson(`/api/v1/${encodeURIComponent(identifier)}`)];
    } catch {
      return [identifier, null];
    }
  }));

  return Object.fromEntries(entries);
}

async function refreshTaskIntake(options = {}) {
  if (!taskIntakeRoot) return;

  if (options.skipIfEditing && shouldHoldTaskIntakeAutoRefresh()) {
    // Automatic polling should never erase the operator's half-written Jules
    // task or replace a button while the operator is aiming at it. Manual
    // actions still refresh this section because those clicks are explicit
    // workflow decisions.
    return;
  }

  const snapshot = options.forcePreflight
    ? { drafts: null, preflight: await postJson('/api/v1/git-preflight', {}) }
    : await fetchJson('/api/v1/task-drafts');

  // When the operator manually rechecks Git, keep the queue visible by fetching
  // the draft list after the hard gate has been refreshed.
  const finalSnapshot = snapshot.drafts === null
    ? await fetchJson('/api/v1/task-drafts')
    : snapshot;

  renderTaskIntake(finalSnapshot);
}

function holdTaskIntakeAutoRefresh() {
  // The task intake panel contains the current human decision surface. When a
  // pointer or keyboard focus enters it, pause automatic repainting briefly so
  // a visible action cannot disappear between the operator seeing it and
  // clicking it.
  taskIntakeInteractionHoldUntil = Date.now() + TASK_INTAKE_INTERACTION_HOLD_MS;
}

function isTaskIntakeInteractionActive() {
  return isEditingInside(taskIntakeRoot) || Date.now() < taskIntakeInteractionHoldUntil;
}

function shouldHoldTaskIntakeAutoRefresh() {
  // The current-boundary action is the control the operator is being asked to
  // use next. When it is visible, automatic repainting would trade freshness
  // for a moving target, so the task panel waits for an explicit click or manual
  // refresh before replacing that button or evidence link.
  return isTaskIntakeInteractionActive()
    || Boolean(taskIntakeRoot?.querySelector?.('[data-current-foreman-action="true"]'));
}

function isEditingInside(root) {
  const active = document.activeElement;
  if (!active || !root.contains(active)) return false;

  const tag = active.tagName;
  return tag === 'INPUT'
    || tag === 'TEXTAREA'
    || tag === 'SELECT'
    || active.isContentEditable === true;
}

async function createTaskDraft(form) {
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus('Saving Jules task draft.');

  try {
    const payload = {
      title: String(new FormData(form).get('title') || ''),
      body: String(new FormData(form).get('body') || ''),
      expectedFiles: String(new FormData(form).get('expectedFiles') || ''),
      verificationCommands: String(new FormData(form).get('verificationCommands') || ''),
    };
    const snapshot = await postJson('/api/v1/task-drafts', payload);
    form.reset();
    renderTaskIntake(snapshot);
    setStatus('Saved task draft locally.');
  } catch (err) {
    setStatus(`Task draft failed: ${err.message}`);
  } finally {
    submit.disabled = false;
  }
}

async function watchObservedPullRequest(form) {
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setStatus('Adding existing GitHub PR to the Symphony watch list.');

  try {
    const data = new FormData(form);
    const payload = {
      prUrl: String(data.get('prUrl') || ''),
      title: String(data.get('title') || ''),
      expectedFiles: String(data.get('expectedFiles') || ''),
      verificationCommands: String(data.get('verificationCommands') || ''),
    };
    const snapshot = await postJson('/api/v1/observed-prs', payload);
    form.reset();
    renderTaskIntake(snapshot);
    setStatus('Watching existing PR without changing GitHub, Jules, or local Git.');
  } catch (err) {
    setStatus(`Observed PR watch failed: ${err.message}`);
  } finally {
    submit.disabled = false;
  }
}

async function recordGitDisposition(button) {
  const card = button.closest('[data-git-disposition-category]');
  const category = card?.getAttribute('data-git-disposition-category');
  const decision = card?.querySelector('[data-git-disposition-decision]')?.value || '';
  const note = card?.querySelector('[data-git-disposition-note]')?.value || '';
  if (!category || !decision) {
    setStatus('Choose a Git disposition decision before recording it.');
    return;
  }

  button.disabled = true;
  setStatus('Recording Git disposition intent.');

  try {
    const snapshot = await postJson('/api/v1/git-disposition', { category, decision, note });
    renderTaskIntake(snapshot);
    setStatus('Recorded Git disposition intent. Git state was not changed.');
  } catch (err) {
    setStatus(`Git disposition was not recorded: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordTaskNudge(button) {
  const subjectId = button.getAttribute('data-subject-id') || '';
  const subjectKind = button.getAttribute('data-subject-kind') || 'queue';
  const action = button.getAttribute('data-nudge-action') || '';
  const phase = button.getAttribute('data-nudge-phase') || 'routing';
  const pauseSeconds = Number(button.getAttribute('data-pause-seconds') || 0);

  if (!subjectId || !action) {
    setStatus('No task routing subject is available to record.');
    return;
  }

  button.disabled = true;
  setStatus('Recording task nudge evidence.');

  try {
    const snapshot = await postJson('/api/v1/task-nudges', {
      subjectId,
      subjectKind,
      action,
      phase,
      pauseSeconds,
      note: button.getAttribute('data-nudge-note') || '',
    });
    renderTaskIntake(snapshot);
    setStatus('Recorded task nudge evidence. No worker or external system was changed.');
  } catch (err) {
    setStatus(`Task nudge was not recorded: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordTaskMessage(button) {
  const taskId = button.getAttribute('data-task-id') || '';
  const taskMessageUrl = button.getAttribute('data-task-message-url') || '';
  const card = button.closest('[data-task-detail-preview]');
  const author = card?.querySelector('select[data-task-message-author]')?.value === 'codex_foreman'
    ? 'codex_foreman'
    : 'operator';
  const textarea = card?.querySelector('textarea[data-task-message-body]');
  const body = String(textarea?.value || '').trim();

  if (!taskId || !taskMessageUrl) {
    setStatus('Task message cannot be recorded because the task link is missing.');
    return;
  }

  if (!body) {
    setStatus('Write a task message before recording it.');
    return;
  }

  button.disabled = true;
  setStatus('Recording task message locally.');

  try {
    // This is dashboard chat, not Jules feedback. It records the operator/Codex
    // foreman conversation on the local Symphony task so future agents can
    // resume from structured notes instead of terminal scrollback.
    const snapshot = await postJson(taskMessageUrl, { author, body });
    if (textarea) textarea.value = '';
    renderTaskIntake(snapshot);
    setStatus('Recorded task message locally.');
  } catch (err) {
    setStatus(`Task message failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function runDueTaskNudges(button) {
  button.disabled = true;
  setStatus('Running due task nudge refreshes.');

  try {
    const snapshot = await postJson('/api/v1/task-nudges/refresh-due', {});
    renderTaskIntake(snapshot);
    const summary = snapshot.taskNudgeRefresh
      ? `${snapshot.taskNudgeRefresh.localSyncRefreshes} local sync refresh(es), ${snapshot.taskNudgeRefresh.pullRequestRefreshes} PR refresh(es), ${snapshot.taskNudgeRefresh.statusRefreshes} Jules status refresh(es), ${snapshot.taskNudgeRefresh.skipped} skipped.`
      : 'Due nudge refresh completed.';
    setStatus(summary);
  } catch (err) {
    setStatus(`Due nudge refresh failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function promoteTaskDraft(draftId, button) {
  button.disabled = true;
  setStatus('Preparing Jules handoff prompt.');

  try {
    const snapshot = await postJson(`/api/v1/task-drafts/${encodeURIComponent(draftId)}/promote`, {});
    renderTaskIntake(snapshot);
    setStatus('Prepared local Jules handoff prompt.');
  } catch (err) {
    setStatus(`Jules handoff blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function createLinearTrackingIssue(draftId, button) {
  button.disabled = true;
  setStatus('Creating Linear tracking issue.');

  try {
    const snapshot = await postJson(`/api/v1/task-drafts/${encodeURIComponent(draftId)}/create-linear`, {});
    renderTaskIntake(snapshot);
    setStatus('Created Linear tracking issue for the Jules foreman worker.');
  } catch (err) {
    setStatus(`Linear issue creation blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function stageJulesManifest(handoffId, button) {
  button.disabled = true;
  setStatus('Writing Jules manifest.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/stage-manifest`, {});
    renderTaskIntake(snapshot);
    setStatus('Prepared Jules manifest for existing orchestrator.');
  } catch (err) {
    setStatus(`Manifest staging blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function launchJulesHandoff(handoffId, button) {
  button.disabled = true;
  setStatus('Launching Jules handoff through existing orchestrator.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/launch`, {});
    renderTaskIntake(snapshot);
    setStatus('Jules handoff launched. Dashboard recorded the session details.');
  } catch (err) {
    setStatus(`Jules launch blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function refreshJulesHandoff(handoffId, button) {
  button.disabled = true;
  setStatus('Refreshing Jules session status.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/refresh-status`, {});
    renderTaskIntake(snapshot);
    setStatus('Jules status refreshed from orchestrator records.');
  } catch (err) {
    setStatus(`Jules status refresh failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function sendJulesOperatorMessage(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const textarea = card?.querySelector('textarea[data-jules-message]');
  const body = String(textarea?.value || '').trim();
  if (!body) {
    setStatus('Write a message before sending it to Jules.');
    return;
  }

  button.disabled = true;
  setStatus('Sending operator message to Jules.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/message`, { body });
    if (textarea) textarea.value = '';
    renderTaskIntake(snapshot);
    setStatus('Operator message sent to Jules.');
  } catch (err) {
    setStatus(`Jules message failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordDelegationRoiEstimate(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const readNumber = name => {
    const value = String(card?.querySelector(`[data-roi-estimate="${name}"]`)?.value || '').trim();
    return value ? Number(value) : null;
  };
  const confidence = card?.querySelector('[data-roi-estimate="confidence"]')?.value || 'low';
  const method = String(card?.querySelector('[data-roi-estimate="method"]')?.value || '').trim();
  const caveats = String(card?.querySelector('[data-roi-estimate="caveats"]')?.value || '').trim();
  const payload = {
    estimatedLocalCodexImplementationTurns: readNumber('turns'),
    estimatedLocalCodexTokens: readNumber('tokens'),
    estimatedDebuggingCycles: readNumber('cycles'),
    confidence,
    method,
    caveats,
  };

  if (!method) {
    setStatus('Describe the estimate method before recording ROI evidence.');
    return;
  }

  button.disabled = true;
  setStatus('Recording Delegation ROI estimate.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/roi-estimate`, payload);
    renderTaskIntake(snapshot);
    setStatus('Recorded local Delegation ROI estimate.');
  } catch (err) {
    setStatus(`ROI estimate blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordDelegationRoiForemanUsage(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const readNumber = name => {
    const value = String(card?.querySelector(`[data-roi-foreman-usage="${name}"]`)?.value || '').trim();
    return value ? Number(value) : null;
  };
  const notes = String(card?.querySelector('[data-roi-foreman-usage="notes"]')?.value || '').trim();
  const source = card?.querySelector('[data-roi-foreman-usage="source"]')?.value || 'manual_codex_receipt';
  const payload = {
    inputTokens: readNumber('inputTokens'),
    outputTokens: readNumber('outputTokens'),
    totalTokens: readNumber('totalTokens'),
    activeRuntimeSeconds: readNumber('activeRuntimeSeconds'),
    foremanTurns: readNumber('foremanTurns'),
    source,
    notes,
    recordedBy: 'codex_foreman',
  };

  if (
    payload.totalTokens === null
    && payload.activeRuntimeSeconds === null
    && payload.foremanTurns === null
  ) {
    setStatus('Record at least one measured foreman usage value.');
    return;
  }

  button.disabled = true;
  setStatus('Recording task-scoped foreman usage.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/roi-foreman-usage`, payload);
    renderTaskIntake(snapshot);
    setStatus('Recorded local task-scoped foreman usage.');
  } catch (err) {
    setStatus(`Foreman usage recording blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordOperatorAnswer(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const selectedAction = card?.querySelector('[data-operator-answer="selectedAction"]')?.value || 'other';
  const answer = String(card?.querySelector('[data-operator-answer="answer"]')?.value || '').trim();

  if (!answer) {
    setStatus('Write the operator answer before recording it.');
    return;
  }

  button.disabled = true;
  setStatus('Recording operator answer.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/operator-answer`, {
      selectedAction,
      answer,
      answeredBy: 'operator',
    });
    renderTaskIntake(snapshot);
    setStatus('Recorded operator answer locally.');
  } catch (err) {
    setStatus(`Operator answer blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordOperatorPreferences(button) {
  const card = button.closest('[data-operator-preferences-card]');
  const enabledInput = card?.querySelector('[data-operator-preference="quietHours.enabled"]');
  const timeZone = String(card?.querySelector('[data-operator-preference="quietHours.timeZone"]')?.value || 'Europe/Amsterdam').trim();
  const startHour = Number(card?.querySelector('[data-operator-preference="quietHours.startHour"]')?.value || 1);
  const endHour = Number(card?.querySelector('[data-operator-preference="quietHours.endHour"]')?.value || 9);
  const weekdaysOnlyInput = card?.querySelector('[data-operator-preference="quietHours.weekdaysOnly"]');

  const payload = {
    quietHours: {
      enabled: Boolean(enabledInput?.checked),
      timeZone,
      startHour,
      endHour,
      weekdaysOnly: Boolean(weekdaysOnlyInput?.checked),
    },
  };

  // Preference edits only change Symphony's local waiting policy. They make
  // future operator questions quieter or louder without sending anything to
  // Jules, GitHub, Linear, local files, or Git.
  await postJson('/api/v1/operator-preferences', payload);
  setStatus('Operator preferences recorded locally.');
  await refreshTaskIntake();
}

async function executeSelectedRepairLane(handoffId, button) {
  button.disabled = true;
  setStatus('Executing selected repair lane locally.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/execute-repair-lane`, {});
    renderTaskIntake(snapshot);
    setStatus('Created local setup repair draft.');
  } catch (err) {
    setStatus(`Repair lane blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordRepairPushResult(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const status = card?.querySelector('[data-repair-push-result="status"]')?.value || 'pushed';
  const pushedCommit = String(card?.querySelector('[data-repair-push-result="pushedCommit"]')?.value || '').trim();
  const targetPullRequestHeadCommit = String(card?.querySelector('[data-repair-push-result="targetPullRequestHeadCommit"]')?.value || '').trim();
  const pushedAt = String(card?.querySelector('[data-repair-push-result="pushedAt"]')?.value || '').trim();
  const evidenceUrl = String(card?.querySelector('[data-repair-push-result="evidenceUrl"]')?.value || '').trim();
  const summary = String(card?.querySelector('[data-repair-push-result="summary"]')?.value || '').trim();

  if (!summary) {
    setStatus('Summarize the push result before recording it.');
    return;
  }

  button.disabled = true;
  setStatus('Recording repair push result.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/repair-push-result`, {
      status,
      pushedCommit,
      targetPullRequestHeadCommit,
      pushedAt,
      pushedBy: 'operator',
      evidenceUrl,
      summary,
    });
    renderTaskIntake(snapshot);
    setStatus('Recorded repair push result locally.');
  } catch (err) {
    setStatus(`Repair push result blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function recordDeploymentEvidence(handoffId, button) {
  const card = button.closest('[data-handoff-card]');
  const status = card?.querySelector('[data-deployment-evidence="status"]')?.value || 'passed';
  const source = card?.querySelector('[data-deployment-evidence="source"]')?.value || 'github_pages_latest_build';
  const evidenceUrl = String(card?.querySelector('[data-deployment-evidence="evidenceUrl"]')?.value || '').trim();
  const summary = String(card?.querySelector('[data-deployment-evidence="summary"]')?.value || '').trim();

  if (!summary) {
    setStatus('Summarize the deployment proof or waiver before recording it.');
    return;
  }

  button.disabled = true;
  setStatus('Recording deployment evidence.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/deployment-evidence`, {
      status,
      source,
      evidenceUrl,
      summary,
      recordedBy: 'operator',
    });
    renderTaskIntake(snapshot);
    setStatus('Recorded deployment evidence locally.');
  } catch (err) {
    setStatus(`Deployment evidence blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function approveJulesPlan(handoffId, button) {
  button.disabled = true;
  setStatus('Approving Jules plan.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/approve-plan`, {});
    renderTaskIntake(snapshot);
    setStatus('Jules plan approved.');
  } catch (err) {
    setStatus(`Jules plan approval failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function refreshPullRequestStatus(handoffId, button) {
  button.disabled = true;
  setStatus('Refreshing GitHub PR checks.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/refresh-pr`, {});
    renderTaskIntake(snapshot);
    setStatus('GitHub PR status refreshed.');
  } catch (err) {
    setStatus(`GitHub PR refresh failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function createObservedPullRequestFollowUp(handoffId, button) {
  button.disabled = true;
  setStatus('Creating a separate follow-up draft from observed PR evidence.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/create-follow-up-draft`, {});
    renderTaskIntake(snapshot);
    setStatus('Created a separate dashboard draft; the observed PR remains read-only evidence.');
  } catch (err) {
    setStatus(`Observed PR follow-up draft failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function refreshLocalSyncStatus(handoffId, button) {
  button.disabled = true;
  setStatus('Checking local sync readiness.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/refresh-local-sync`, {});
    renderTaskIntake(snapshot);
    setStatus('Local sync readiness refreshed.');
  } catch (err) {
    setStatus(`Local sync check failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function syncLocalMaster(handoffId, button) {
  button.disabled = true;
  setStatus('Syncing local master with GitHub.');

  try {
    const snapshot = await postJson(`/api/v1/jules-handoffs/${encodeURIComponent(handoffId)}/sync-local`, {});
    renderTaskIntake(snapshot);
    setStatus('Local master sync completed.');
  } catch (err) {
    setStatus(`Local sync blocked: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function bulkRefreshJules(button) {
  button.disabled = true;
  setStatus('Refreshing all tracked Jules handoffs.');

  try {
    const snapshot = await postJson('/api/v1/jules-handoffs/refresh-all', {});
    renderTaskIntake(snapshot);
    const summary = snapshot.bulkRefresh
      ? `${snapshot.bulkRefresh.statusRefreshes} Jules status refresh(es), ${snapshot.bulkRefresh.pullRequestRefreshes} PR refresh(es), ${snapshot.bulkRefresh.failures.length} failure(s).`
      : 'Bulk refresh completed.';
    setStatus(summary);
  } catch (err) {
    setStatus(`Bulk Jules refresh failed: ${err.message}`);
    await refreshTaskIntake();
  } finally {
    button.disabled = false;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `${url} returned ${response.status}`);
  return body;
}

async function sendApprovalDecision(identifier, decision, button) {
  button.disabled = true;
  setStatus(`Sending ${decision} decision for ${identifier}.`);

  try {
    const response = await fetch(`/api/v1/${encodeURIComponent(identifier)}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error?.message || `Approval returned ${response.status}`);
    }
    setStatus(payload.message || `Sent ${decision} decision for ${identifier}.`);
    await refreshDashboard();
  } catch (err) {
    button.disabled = false;
    setStatus(`Approval failed: ${err.message}`);
  }
}

function renderStats(state) {
  const dashboard = state.dashboard || {};
  const controlSurface = dashboard.state_url
    ? `<details class="control-surface">
        <summary>Control surface</summary>
        <div class="control-surface-body">
          <span>Local API links for foremen and operators.</span>
          <code>${escapeHtml(dashboard.state_url)}</code>
        <!-- These URLs are for foreman workers and operators. Keeping them
             visible on demand makes the local dashboard API discoverable
             without letting endpoint names dominate the operator's first
             viewport during a Jules monitoring pass. -->
          ${dashboard.task_drafts_url ? `<small>Task queue: <code>${escapeHtml(dashboard.task_drafts_url)}</code></small>` : ''}
          ${dashboard.git_preflight_url ? `<small>Git sync: <code>${escapeHtml(dashboard.git_preflight_url)}</code></small>` : ''}
          ${dashboard.dispatch_control_url ? `<small>Dispatch gate: <code>${escapeHtml(dashboard.dispatch_control_url)}</code></small>` : ''}
          ${dashboard.jules_refresh_all_url ? `<small>Refresh all Jules: <code>${escapeHtml(dashboard.jules_refresh_all_url)}</code></small>` : ''}
          ${dashboard.events_url ? `<small>Live updates: <code>${escapeHtml(dashboard.events_url)}</code></small>` : ''}
        </div>
      </details>`
    : '';

  statsCard.innerHTML = [
    stat('Running', state.counts.running),
    stat('Retrying', state.counts.retrying),
    stat('Completed Since Start', state.counts.completed_since_start),
    stat('Total Tokens', Number(state.codex_totals.total_tokens).toLocaleString()),
    stat('Total Runtime', `${state.codex_totals.seconds_running}s`),
    renderWorkerRoster(state.worker_roster),
    controlSurface,
  ].join('');
}

function formatDashboardTimestamp(value) {
  // Operators need to know whether the dashboard is fresh, not parse a raw ISO
  // timestamp. Keep seconds for live debugging but drop milliseconds and the
  // long date unless the browser cannot parse the server value.
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'unknown';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function renderWorkerRoster(roster) {
  const workers = Array.isArray(roster) ? roster : [];
  if (!workers.length) return '';

  const needsApproval = workers.some(worker => Boolean(worker.waiting_on_approval));
  const rows = workers.slice(0, 6).map(worker => {
    const designation = worker.designation || 'unassigned worker';
    const issue = worker.issue_identifier || 'unknown issue';
    const workspace = worker.workspace_path || 'workspace not created yet';
    const thread = worker.thread_id || 'thread not initialized yet';
    const assignment = formatWorkerModelAssignment(worker);
    const statusLabel = worker.waiting_on_approval
      ? 'approval needed'
      : worker.status || 'worker';
    const statusClass = worker.waiting_on_approval
      ? 'approval'
      : worker.status === 'retrying'
        ? 'retrying'
        : 'running';
    const approvalDetail = worker.waiting_on_approval
      ? `<small>Approval: ${escapeHtml(worker.approval_summary || 'Waiting for operator approval')}</small>`
      : '';

    // The roster is for human orientation when several agents exist at once:
    // it answers which designation belongs to which issue, workspace, thread,
    // and approval pause without requiring the operator to open every issue row.
    return `<li>
      <div>
        <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
        <a href="${escapeAttribute(worker.detail_url || '#')}"><code>${escapeHtml(designation)}</code></a>
      </div>
      <small>${escapeHtml(issue)} · ${escapeHtml(formatTimestamp(worker.last_activity_at))}</small>
      ${approvalDetail}
      <small>Model: <code>${escapeHtml(assignment)}</code></small>
      <small>Workspace: <code>${escapeHtml(workspace)}</code></small>
      <small>Thread: <code>${escapeHtml(thread)}</code></small>
    </li>`;
  }).join('');

  const more = workers.length > 6
    ? `<small>${escapeHtml(workers.length - 6)} more worker(s) hidden.</small>`
    : '';

  return `<details class="worker-roster" ${needsApproval ? 'open' : ''}>
    <summary>
      <strong>Worker roster</strong>
      <span>${escapeHtml(`${workers.length} assigned worker${workers.length === 1 ? '' : 's'}${needsApproval ? '; approval needed' : ''}`)}</span>
    </summary>
    <ol>${rows}</ol>
    ${more}
  </details>`;
}

function renderTaskIntake(snapshot) {
  const preflight = snapshot.preflight || {};
  const gitDisposition = snapshot.gitDisposition || null;
  const capabilities = snapshot.capabilities || {};
  const drafts = Array.isArray(snapshot.drafts) ? snapshot.drafts : [];
  const handoffs = Array.isArray(snapshot.handoffs) ? snapshot.handoffs : [];
  const pendingHumanInputCount = handoffs.filter(handoff => Boolean(handoff.operatorQuestion)).length;
  const operatorPlan = buildTaskOperatorPlan(preflight, drafts, handoffs, capabilities);
  const taskRouting = renderTaskRouting(snapshot.taskRouting, snapshot.taskNudges);
  const bulkRefresh = snapshot.bulkRefresh || null;
  const taskNudgeRefresh = snapshot.taskNudgeRefresh || null;
  const gateClass = preflight.ok ? 'ready' : 'blocked';
  const blockers = Array.isArray(preflight.blockers) && preflight.blockers.length
    ? `<ul class="gate-blockers">${preflight.blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="gate-ok">GitHub base is current enough for a future Jules handoff.</p>';
  const remediation = renderPreflightRemediation(preflight);
  const syncDecisionBoard = renderSyncDecisionBoard(preflight, gitDisposition);
  const gitDispositionReview = renderGitDispositionReviewPacket(snapshot.git_disposition_review);
  const resolutionPacket = renderGitResolutionPacket(preflight.resolutionPacket);
  const gitSyncPlan = renderGitSyncPlan(snapshot.gitSyncPlan);
  const middlemanPath = renderMiddlemanPath(snapshot.middleman_path);
  const draftRows = drafts.length
    ? drafts.map(draft => taskDraftCard(draft, preflight, capabilities)).join('')
    : '<li class="task-draft empty">No task drafts yet.</li>';
  const handoffRows = handoffs.length
    ? handoffs.map(handoff => handoffCard(handoff)).join('')
    : '<li class="task-draft empty">No Jules handoffs prepared yet.</li>';
  const bulkRefreshSummary = renderBulkRefreshSummary(bulkRefresh);
  const taskNudgeRefreshSummary = renderTaskNudgeRefreshSummary(taskNudgeRefresh);
  const conflictWatch = renderCrossHandoffConflictWatch(snapshot.conflict_watch, handoffs);
  const kickoffSequence = renderJulesKickoffSequence(preflight, drafts, handoffs, capabilities);
  const kickoffGuide = renderKickoffGuide(capabilities.kickoffGuide);
  const queueNextAction = renderQueueNextAction(snapshot.next_action);
  const handoffStatusBoard = renderHandoffStatusBoard(handoffs);
  const taskNavigator = renderTaskNavigator(drafts, handoffs);
  const taskForms = `
    <div class="task-intake-grid">
      <form id="task-draft-form" class="task-form">
        <label>
          <span>Title</span>
          <input name="title" type="text" placeholder="Short task name" required>
        </label>
        <label>
          <span>Task details</span>
          <textarea name="body" rows="7" placeholder="Describe what Jules should eventually do, expected files, constraints, and verification." required></textarea>
        </label>
        <label>
          <span>Expected files / write scopes</span>
          <textarea name="expectedFiles" rows="4" placeholder="One path per line, e.g. src/components/Widget.tsx"></textarea>
        </label>
        <label>
          <span>Test commands</span>
          <textarea name="verificationCommands" rows="4" placeholder="One command per line, e.g. npm.cmd run build"></textarea>
        </label>
        <button type="submit">Save Draft</button>
      </form>

      <form id="observed-pr-form" class="task-form">
        <h3>Watch Existing PR</h3>
        <p class="usage-summary">Track a real GitHub PR for checks, Scout conflicts, comments, and learning without claiming this dashboard launched it.</p>
        <label>
          <span>Pull request URL</span>
          <input name="prUrl" type="url" placeholder="https://github.com/Gambitnl/Aralia/pull/929" required>
        </label>
        <label>
          <span>Watch title</span>
          <input name="title" type="text" placeholder="Optional label for this PR">
        </label>
        <label>
          <span>Expected files / watch scope</span>
          <textarea name="expectedFiles" rows="3" placeholder="One path per line, used for scope/risk comparison after refresh."></textarea>
        </label>
        <label>
          <span>Evidence commands</span>
          <textarea name="verificationCommands" rows="3" placeholder="One command per line, e.g. gh pr checks 929 --repo Gambitnl/Aralia"></textarea>
        </label>
        <button type="submit">Watch PR</button>
      </form>
    </div>`;
  const focusStrip = renderDashboardFocusStrip({
    drafts,
    handoffs,
    operatorPlan,
    path: snapshot.middleman_path,
    pendingHumanInputCount,
    preflight,
    queueNextAction: snapshot.next_action,
    taskRouting: snapshot.taskRouting,
  });
  const syncGate = `
    <div class="sync-gate ${escapeAttribute(gateClass)}">
      <div class="sync-gate-header">
        <span class="badge ${preflight.ok ? 'running' : 'approval'}">${preflight.ok ? 'ready' : 'blocked'}</span>
        <strong>GitHub Sync Gate</strong>
      </div>
      <p>${escapeHtml(preflight.summary || 'GitHub sync has not been checked yet.')}</p>
      <dl>
        <div><dt>Base</dt><dd>${escapeHtml(preflight.baseBranch || 'master')}</dd></div>
        <div><dt>Remote</dt><dd>${escapeHtml(preflight.remoteBranch || 'origin/master')}</dd></div>
        <div><dt>Local commit</dt><dd title="${escapeAttribute(preflight.localCommit || 'unknown')}">${escapeHtml(shortCommit(preflight.localCommit))}</dd></div>
        <div><dt>GitHub commit</dt><dd title="${escapeAttribute(preflight.remoteCommit || 'unknown')}">${escapeHtml(shortCommit(preflight.remoteCommit))}</dd></div>
        <div><dt>Ahead / Behind</dt><dd>${escapeHtml(`${preflight.ahead ?? '?'} / ${preflight.behind ?? '?'}`)}</dd></div>
        <div><dt>Dirty / Untracked</dt><dd>${escapeHtml(`${preflight.dirtyFiles ?? '?'} / ${preflight.untrackedFiles ?? '?'}`)}</dd></div>
      </dl>
      ${blockers}
      ${syncDecisionBoard}
      ${gitDispositionReview}
      ${gitSyncPlan}
      ${resolutionPacket}
      ${remediation}
      <small>Checked ${escapeHtml(preflight.checkedAt ? formatTimestamp(preflight.checkedAt) : 'not yet')}.</small>
    </div>`;
  const records = `
    <h3>Local Task Drafts</h3>
    <ol class="task-draft-list">${draftRows}</ol>

    <h3>Tracked Jules Handoffs and Observed PRs</h3>
    <ol class="task-draft-list">${handoffRows}</ol>`;

  // This is the first operator-facing step of the Jules middleman workflow.
  // It intentionally saves drafts locally and disables handoff whenever GitHub
  // is not synced, because Jules will work from the remote repository rather
  // than from unpushed local files.
  const nextHtml = `
    <div class="section-heading">
      <div>
        <h2>Symphony Workflow</h2>
        <p class="usage-summary">Use this page as the human operating surface for Jules handoffs, PR review, and local-return evidence.</p>
        ${pendingHumanInputCount ? `<span class="badge pending-human-input">Needs your input: ${escapeHtml(String(pendingHumanInputCount))}</span>` : ''}
      </div>
      <div class="heading-actions">
        <button type="button" data-task-action="check-git">Check GitHub Sync</button>
        <button type="button" ${handoffs.length ? '' : 'disabled'} data-task-action="bulk-refresh-jules" title="${escapeAttribute(handoffs.length ? 'Refresh status and PR data for all tracked Jules handoffs.' : 'No Jules handoffs exist yet.')}">Refresh All Jules</button>
      </div>
    </div>

    ${focusStrip}

    ${taskNavigator}

    ${renderOperatorPreferences(snapshot.operatorPreferences)}

    ${renderForemanConsole({
      path: snapshot.middleman_path,
      operatorPlan: renderTaskOperatorPlan(operatorPlan),
      middlemanPath,
      taskRouting,
      queueNextAction,
      kickoffSequence,
      handoffStatusBoard,
      kickoffGuide,
      taskNudgeRefreshSummary,
      bulkRefreshSummary,
      conflictWatch,
      taskForms,
      syncGate,
      records,
    })}`;

  // If a live refresh returns the same visible task surface, leave the existing
  // nodes in place. This preserves hover, focus, and pending click targets
  // instead of replacing an identical button with a fresh element.
  if (taskIntakeRoot.innerHTML === nextHtml) return;

  taskIntakeRoot.innerHTML = nextHtml;
}

function renderDashboardFocusStrip({ drafts, handoffs, operatorPlan, path, pendingHumanInputCount, preflight, queueNextAction, taskRouting }) {
  const action = path?.foremanAction ?? {};
  const status = path?.status || action.status || queueNextAction?.tone || operatorPlan?.tone || 'waiting';
  const boundary = path?.currentBoundaryLabel || action.boundaryLabel || queueNextAction?.label || 'Task queue';
  const actionLabel = action.label || queueNextAction?.label || taskRouting?.nextAction?.label || operatorPlan?.title || 'Review dashboard state';
  const proof = path?.nextExpectedProof || action.expectedProof || 'Record the next durable receipt.';
  const runControl = renderForemanRunControl(action);
  const preflightLabel = preflight?.ok ? 'GitHub synced' : 'Git sync blocked';
  const prCount = handoffs.filter(handoff => Boolean(handoff.githubPullRequestUrl)).length;
  const runningHandoffs = handoffs.filter(handoff => !['MERGED', 'CLOSED', 'ARCHIVED'].includes(String(handoff.githubPullRequestState || handoff.status || '').toUpperCase())).length;
  const badgeClass = status === 'ready' || status === 'complete' ? 'running' : status === 'blocked' ? 'approval' : 'retrying';

  // This strip is the dashboard's at-a-glance operator brief. It does not
  // replace the receipt panels below; it compresses the same middleman, Git,
  // draft, and PR facts into the first viewport so the user sees the live
  // decision before opening any detailed drawer.
  return `<section class="dashboard-focus-strip ${escapeAttribute(status)}" aria-label="Current dashboard focus">
    <div class="focus-main">
      <span class="badge ${badgeClass}">${escapeHtml(status)}</span>
      <div>
        <strong>${escapeHtml(boundary)}</strong>
        <span>${escapeHtml(actionLabel)}</span>
      </div>
    </div>
    <div class="focus-proof">
      <span>Next proof</span>
      <strong>${escapeHtml(proof)}</strong>
      ${runControl ? `<div class="focus-action">${runControl}</div>` : ''}
    </div>
    <dl class="focus-metrics">
      <div><dt>Git</dt><dd>${escapeHtml(preflightLabel)}</dd></div>
      <div><dt>Drafts</dt><dd>${escapeHtml(String(drafts.length))}</dd></div>
      <div><dt>PRs</dt><dd>${escapeHtml(`${prCount}/${handoffs.length}`)}</dd></div>
      <div><dt>Input</dt><dd>${escapeHtml(String(pendingHumanInputCount))}</dd></div>
      <div><dt>Active</dt><dd>${escapeHtml(String(runningHandoffs))}</dd></div>
    </dl>
  </section>`;
}

function renderForemanConsole(parts) {
  const gitSafety = [
    parts.syncGate,
    parts.operatorPlan,
    parts.taskRouting,
    parts.middlemanPath,
  ].filter(Boolean).join('');
  const julesLifecycle = [
    renderBrowserFollowAlongGuidance(),
    parts.kickoffSequence,
    parts.kickoffGuide,
    parts.taskNudgeRefreshSummary,
    parts.bulkRefreshSummary,
  ].filter(Boolean).join('');
  const prAndReturn = [
    parts.handoffStatusBoard,
    parts.conflictWatch,
  ].filter(Boolean).join('');

  // The foreman console is the dashboard's new hierarchy layer. It does not
  // remove any controls or packets; it makes the current boundary primary and
  // tucks the supporting evidence into job-based groups so the operator can
  // decide what matters now before scanning every receipt.
  const gitSafetyNeedsAttention = shouldOpenGitSafetyGroup({
    gitSafety,
    path: parts.path,
  });

  return `<div class="foreman-console">
    ${renderForemanCurrentBoundary(parts.path, parts.queueNextAction, parts.taskRouting)}
    <div class="foreman-detail-grid">
      ${renderForemanDetailGroup('Git Safety', 'Preflight, disposition, sync plan, and the global path evidence.', gitSafety, gitSafetyNeedsAttention)}
      ${renderForemanDetailGroup('Jules Lifecycle', 'Kickoff, launch/session preparation, and timed nudge receipts.', julesLifecycle)}
      ${renderForemanDetailGroup('PR Review And Local Return', 'Handoff board, Scout/Core conflict watch, PR review, and local-return context.', prAndReturn)}
      ${renderForemanDetailGroup('Task Intake And Records', 'Draft new work, watch existing PRs, and review stored drafts/handoffs.', `${parts.taskForms}${parts.records}`)}
    </div>
  </div>`;
}

function shouldOpenGitSafetyGroup({ gitSafety, path }) {
  // The Git Safety drawer normally stays compact so the dashboard first screen
  // is not dominated by raw receipts. When the active blocker is Git sync or a
  // disposition decision, however, the operator must see the actual control
  // without guessing that it is hidden under a collapsed evidence drawer.
  const boundaryText = [
    path?.currentBoundaryLabel,
    path?.foremanAction?.boundaryLabel,
    path?.foremanAction?.label,
    path?.foremanAction?.instruction,
    path?.foremanAction?.blockedReason,
  ].filter(Boolean).join(' ');
  const safetyText = String(gitSafety || '');
  return /GitHub sync|Check GitHub Sync|Git disposition|Sync Decision Board|Guarded Git sync plan|blocked_by_disposition/i.test(`${boundaryText} ${safetyText}`);
}

function renderBrowserFollowAlongGuidance() {
  // This guidance records the current browser-tooling lesson without turning
  // the browser itself into Symphony state. Future foremen need to know that a
  // direct Playwright transport failure is not the same as Jules being
  // unobservable, while the real task evidence still belongs in handoff packets.
  return `<section class="browser-followalong-guidance" aria-label="Browser Follow-along">
    <h3>Browser Follow-along</h3>
    <p><strong>Use the Codex Browser plugin bridge first.</strong></p>
    <p>Direct Playwright MCP can report Transport closed while Jules visible state can still be read from the signed-in in-app browser tab.</p>
    <p class="usage-summary">Terminal Playwright is only repeatable local dashboard verification; live Jules follow-along belongs in the operator-visible Codex app browser.</p>
    <p class="usage-summary"><a href="/api/v1/browser-tooling-health">Browser tooling health JSON</a></p>
  </section>`;
}

function renderForemanCurrentBoundary(path, queueNextAction, taskRouting) {
  const action = path?.foremanAction ?? {};
  const status = path?.status || action.status || queueNextAction?.tone || 'waiting';
  const boundary = path?.currentBoundaryLabel || action.boundaryLabel || queueNextAction?.label || 'Task queue';
  const actionLabel = action.label || queueNextAction?.label || taskRouting?.label || 'Review dashboard state';
  const expectedProof = path?.nextExpectedProof || action.expectedProof || 'Capture the next boundary receipt.';
  const safety = action.safety || 'read_only';
  const canRun = action.canRunNow ? 'Ready' : 'Blocked';
  const method = action.method || queueNextAction?.method || 'NONE';
  const instruction = action.instruction || queueNextAction?.summary || 'Review the grouped evidence below before advancing.';
  const endpoints = [
    action.evidenceEndpoint ? `<a href="${escapeAttribute(action.evidenceEndpoint)}">Evidence</a>` : '',
    action.recordEndpoint ? `<a href="${escapeAttribute(action.recordEndpoint)}">Record</a>` : '',
    renderForemanRunControl(action),
  ].filter(Boolean).join(' ');

  // This panel answers "what now?" before showing the rest of the dashboard.
  // It is derived from the middleman path packet, so it preserves the same
  // blocker, safety class, and expected-proof language used by /proof.
  return `<section class="foreman-current-boundary ${escapeAttribute(status)}" aria-label="Current Foreman Boundary">
    <div>
      <span class="badge ${escapeAttribute(status)}">${escapeHtml(status)}</span>
      <span class="foreman-eyebrow">What needs attention now</span>
    </div>
    <h3>${escapeHtml(boundary)}</h3>
    <div class="foreman-action-summary">
      <div>
        <span>Action</span>
        <strong>${escapeHtml(actionLabel)}</strong>
      </div>
      <p>${escapeHtml(instruction)}</p>
    </div>
    <dl>
      <div><dt>Safety</dt><dd>${escapeHtml(safety)}</dd></div>
      <div><dt>Method</dt><dd>${escapeHtml(method)}</dd></div>
      <div><dt>Run state</dt><dd>${canRun}</dd></div>
      <div><dt>Next proof</dt><dd>${escapeHtml(expectedProof)}</dd></div>
    </dl>
    ${action.blockedReason ? `<p class="usage-summary">${escapeHtml(action.blockedReason)}</p>` : ''}
    ${endpoints ? `<p class="foreman-links">${endpoints}</p>` : ''}
  </section>`;
}

function renderForemanRunControl(action) {
  if (!action?.endpoint) return '';

  const refreshMatch = String(action.endpoint).match(/\/api\/v1\/jules-handoffs\/([^/]+)\/refresh-status$/);
  if (action.method === 'POST' && action.canRunNow && refreshMatch) {
    // The current-boundary panel should be operable by a human foreman, not just
    // a list of API URLs. For active Jules monitoring, reuse the existing
    // guarded dashboard button path so the visible UI owns the refresh action.
    return `<button class="primary-dashboard-action" type="button" data-current-foreman-action="true" data-task-action="refresh-jules" data-handoff-id="${escapeAttribute(decodeURIComponent(refreshMatch[1]))}">Refresh Jules Status</button>`;
  }

  const prRefreshMatch = String(action.endpoint).match(/\/api\/v1\/jules-handoffs\/([^/]+)\/refresh-pr$/);
  if (action.method === 'POST' && action.canRunNow && prRefreshMatch) {
    // PR review is also a safe external-read boundary. Exposing it as a button
    // keeps the operator on the dashboard path instead of making them open a
    // raw POST endpoint that a browser cannot execute as the intended action.
    return `<button class="primary-dashboard-action" type="button" data-current-foreman-action="true" data-task-action="refresh-pr" data-handoff-id="${escapeAttribute(decodeURIComponent(prRefreshMatch[1]))}">Refresh GitHub PR</button>`;
  }

  const localSyncRefreshMatch = String(action.endpoint).match(/\/api\/v1\/jules-handoffs\/([^/]+)\/refresh-local-sync$/);
  if (action.method === 'POST' && action.canRunNow && localSyncRefreshMatch) {
    // After a PR merges, the next safe human action is a readiness check, not
    // the final Git pull. This keeps the current-boundary button aligned with
    // the two-step local return path.
    return `<button class="primary-dashboard-action" type="button" data-current-foreman-action="true" data-task-action="refresh-local-sync" data-handoff-id="${escapeAttribute(decodeURIComponent(localSyncRefreshMatch[1]))}">Check Local Sync</button>`;
  }

  return `<a class="primary-dashboard-action" data-current-foreman-action="true" href="${escapeAttribute(action.endpoint)}">${action.method === 'POST' ? 'Endpoint' : 'Open'}</a>`;
}

function renderForemanDetailGroup(title, summary, body, open = false) {
  if (!body) return '';

  // Detail groups keep the existing safety surfaces available without making
  // all of them fight for first-screen priority. The current boundary above is
  // the primary decision surface; these groups are the supporting evidence.
  return `<details class="foreman-detail-group" ${open ? 'open' : ''}>
    <summary>
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(summary)}</small>
    </summary>
    <div>${body}</div>
  </details>`;
}

function renderKickoffGuide(guide) {
  if (!guide) return '';

  const steps = Array.isArray(guide.steps) && guide.steps.length
    ? `<ol>${guide.steps.map(step => `<li><span>${escapeHtml(step.label || '')}</span><small>${escapeHtml(step.detail || '')}</small></li>`).join('')}</ol>`
    : '';
  const fields = guide.fields && typeof guide.fields === 'object'
    ? Object.entries(guide.fields).map(([name, detail]) => `<div><dt>${escapeHtml(fieldGuideLabel(name))}</dt><dd>${escapeHtml(detail)}</dd></div>`).join('')
    : '';

  // The kickoff guide is the plain-language counterpart to the API links and
  // next-action objects. It explains what each dashboard field means so the
  // operator does not need Linear/Jules vocabulary before starting a task.
  return `<details class="kickoff-guide">
    <summary>${escapeHtml(guide.title || 'How to start a Jules task')}</summary>
    <p>${escapeHtml(guide.summary || '')}</p>
    ${steps}
    ${fields ? `<dl>${fields}</dl>` : ''}
  </details>`;
}

function fieldGuideLabel(name) {
  const labels = {
    title: 'Title',
    body: 'Task details',
    expectedFiles: 'Expected files / write scopes',
    verificationCommands: 'Test commands',
  };
  return labels[name] || String(name);
}

function renderTaskRouting(routing, taskNudges) {
  if (!routing) return '';

  const reasons = Array.isArray(routing.reasons) ? routing.reasons : [];
  const candidates = Array.isArray(routing.candidates) ? routing.candidates : [];
  const action = routing.nextAction || {};
  const tone = routing.route === 'blocked' || action.code === 'ask_operator'
    ? 'blocked'
    : action.code === 'wait' || action.code === 'nudge' || action.code === 'refresh'
      ? 'waiting'
      : 'ready';
  const badge = tone === 'ready' ? 'running' : tone === 'waiting' ? 'retrying' : 'approval';
  const subjectKind = candidates.find(candidate => candidate.id === routing.subjectId)?.kind || 'queue';
  const phase = inferNudgePhase(routing);
  const nudgeNote = `Recorded ${action.code || 'routing'} for ${routing.subjectTitle || routing.subjectId || 'task queue'}.`;
  const recordButton = routing.subjectId && action.code
    ? `<button type="button"
        data-task-action="record-task-nudge"
        data-subject-id="${escapeAttribute(routing.subjectId)}"
        data-subject-kind="${escapeAttribute(subjectKind)}"
        data-nudge-action="${escapeAttribute(action.code)}"
        data-nudge-phase="${escapeAttribute(phase)}"
        data-pause-seconds="${escapeAttribute(action.pauseSeconds || 0)}"
        data-nudge-note="${escapeAttribute(nudgeNote)}">Record task nudge</button>`
    : '';

  // This panel is Symphony acting as task tracker instead of just launcher. It
  // names whether the current task should wait, nudge an external boundary,
  // ask Jules, or stay local with Codex, without dispatching either worker.
  // The ledger button records that routing decision as evidence; it does not
  // perform the action, so pause-aware tracking stays separate from mutation.
  return `<section class="task-routing ${escapeAttribute(tone)}" aria-label="Task routing and nudge plan">
    <div>
      <span class="badge ${badge}">${escapeHtml(routing.route || 'routing')}</span>
      <strong>Task routing and nudge plan</strong>
      ${routing.subjectTitle ? `<small>${escapeHtml(routing.subjectTitle)}</small>` : ''}
    </div>
    <p>${escapeHtml(routing.summary || '')}</p>
    <div class="routing-next-action">
      <strong>${escapeHtml(action.label || 'Next action')}</strong>
      <span>${escapeHtml(action.detail || '')}</span>
      <small>${escapeHtml(formatNudgeCadence(action))}</small>
      ${recordButton}
    </div>
    ${renderWorkerModeRecommendation(routing.workerMode)}
    ${reasons.length ? `<ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
    ${renderTaskNudgeLedger(taskNudges)}
    ${candidates.length ? `<details><summary>Routing candidates</summary><ol>${candidates.map(candidate => `<li>
      <span>${escapeHtml(candidate.title || candidate.id)}</span>
      <small>${escapeHtml(candidate.kind || 'task')} · ${escapeHtml(candidate.route || 'unknown')} · ${escapeHtml(candidate.reason || '')}</small>
    </li>`).join('')}</ol></details>` : ''}
  </section>`;
}

function renderWorkerModeRecommendation(workerMode) {
  if (!workerMode) return '';

  const signals = workerMode.complexitySignals || {};
  const signalRows = [
    ['Files', signals.expectedFileCount ?? 0],
    ['Checks', signals.verificationCommandCount ?? 0],
    ['Risk words', signals.riskyKeywordCount ?? 0],
    ['External boundary', signals.externalBoundary ? 'yes' : 'no'],
    ['Blocked', signals.blocked ? 'yes' : 'no'],
    ['Dashboard-started', signals.dashboardStarted ? 'yes' : 'no'],
  ];
  const reasons = Array.isArray(workerMode.reasons) ? workerMode.reasons : [];

  // This packet is the plain-English bridge between routing and Codex worker
  // setup. It recommends the mode/model/reasoning combination, but it also says
  // that explicit WORKFLOW.md config still wins so automatic advice does not
  // silently replace operator intent.
  return `<div class="worker-mode-packet ${escapeAttribute(workerMode.mode || 'operator_only')}" aria-label="Worker mode recommendation">
    <div>
      <span class="badge ${workerMode.canDispatchNow ? 'running' : 'approval'}">${escapeHtml(workerMode.mode || 'operator_only')}</span>
      <strong>Worker mode recommendation</strong>
      <small>${escapeHtml(workerMode.summary || '')}</small>
    </div>
    <dl>
      <div><dt>Model</dt><dd>${escapeHtml(workerMode.recommendedModel || 'default')}</dd></div>
      <div><dt>Reasoning</dt><dd>${escapeHtml(workerMode.recommendedReasoningEffort || 'default')}</dd></div>
      <div><dt>Dispatch</dt><dd>${workerMode.canDispatchNow ? 'allowed after gates' : 'not now'}</dd></div>
    </dl>
    <div class="worker-mode-signals">
      ${signalRows.map(([label, value]) => `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`).join('')}
    </div>
    ${reasons.length ? `<ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
    <p>${escapeHtml(workerMode.overridePolicy || '')}</p>
  </div>`;
}

function renderMiddlemanPath(path) {
  if (!path) return '';

  const stages = Array.isArray(path.stages) ? path.stages : [];
  const foremanAction = path.foremanAction || null;
  const foremanActionPanel = foremanAction ? `<div class="routing-next-action">
    <strong>Foreman action: ${escapeHtml(foremanAction.label || 'No action')}</strong>
    <span>${escapeHtml(foremanAction.instruction || '')}</span>
    <small>Safety: ${escapeHtml(foremanAction.safety || 'operator_only')} · ${escapeHtml(foremanAction.method || 'NONE')} · ${foremanAction.canRunNow ? 'can run now' : 'not runnable now'}</small>
    ${foremanAction.endpoint ? `<code>${escapeHtml(foremanAction.endpoint)}</code>` : ''}
    ${foremanAction.evidenceEndpoint ? `<code>Evidence: ${escapeHtml(foremanAction.evidenceEndpoint)}</code>` : ''}
    ${foremanAction.recordEndpoint ? `<code>Record: ${escapeHtml(foremanAction.recordEndpoint)}</code>` : ''}
    ${foremanAction.blockedReason ? `<p>${escapeHtml(foremanAction.blockedReason)}</p>` : ''}
  </div>` : '';
  const rows = stages.map(stage => {
    const mutationFlags = [
      stage.mutatesGitIfRun ? 'mutates Git if run' : '',
      stage.mutatesExternalSystemsIfRun ? 'mutates external systems if run' : '',
      stage.mutatesLocalFilesIfRun ? 'mutates local files if run' : '',
    ].filter(Boolean).join('; ') || 'read-only if run';
    const blockers = Array.isArray(stage.blockedBy) && stage.blockedBy.length
      ? `<ul>${stage.blockedBy.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`
      : '';

    return `<li class="${escapeAttribute(stage.status || 'waiting')}">
      <div>
        <span class="badge ${middlemanStageBadge(stage.status)}">${escapeHtml(stage.status || 'waiting')}</span>
        <strong>${escapeHtml(stage.label || stage.id || 'Boundary')}</strong>
        ${stage.sourceTitle ? `<small>${escapeHtml(stage.sourceTitle)}</small>` : ''}
      </div>
      <p>${escapeHtml(stage.detail || '')}</p>
      <small>${stage.canRunNow ? 'can run now' : 'not runnable now'} · ${escapeHtml(mutationFlags)}</small>
      ${stage.receipt ? `<code>${escapeHtml(stage.receipt)}</code>` : ''}
      ${stage.endpoint ? `<code>${escapeHtml(stage.method || 'GET')} ${escapeHtml(stage.endpoint)}</code>` : ''}
      <p class="usage-summary">Expected proof: ${escapeHtml(stage.expectedProof || '')}</p>
      ${blockers}
    </li>`;
  }).join('');

  // The middleman path is the whole workflow ladder in one panel. It is read
  // from the same API packet workers see, so a human and a headless foreman can
  // agree on the current boundary before anyone creates Linear issues, starts
  // Jules, refreshes GitHub, asks Scout/Core, or mutates local Git.
  return `<section class="task-routing middleman-path ${escapeAttribute(path.status || 'waiting')}" aria-label="Middleman path">
    <div>
      <span class="badge ${middlemanStageBadge(path.status)}">${escapeHtml(path.status || 'waiting')}</span>
      <strong>Middleman Path</strong>
      <small>Current boundary: ${escapeHtml(path.currentBoundaryLabel || path.currentBoundary || 'unknown')}</small>
    </div>
    <p>${escapeHtml(path.summary || '')}</p>
    <p class="usage-summary">Next expected proof: ${escapeHtml(path.nextExpectedProof || '')}</p>
    ${foremanActionPanel}
    ${rows ? `<ol>${rows}</ol>` : '<p>No path stages are available yet.</p>'}
    <p class="usage-summary">${escapeHtml(path.safetyNote || '')}</p>
  </section>`;
}

function middlemanStageBadge(status) {
  if (status === 'complete' || status === 'active' || status === 'observed' || status === 'ready') return 'running';
  if (status === 'blocked') return 'approval';
  return 'retrying';
}

function renderTaskNudgeLedger(taskNudges) {
  const recent = Array.isArray(taskNudges?.recent) ? taskNudges.recent : [];
  const summary = taskNudges?.summary || 'No durable nudge evidence recorded yet.';

  // The ledger is the visible memory for pauses, refreshes, and nudges. It lets
  // the operator see that Symphony waited intentionally instead of silently
  // looping or forgetting why the next check should happen later.
  return `<div class="task-nudge-ledger" aria-label="Task nudge ledger">
    <div>
      <strong>Task nudge ledger</strong>
      <small>${escapeHtml(summary)}</small>
    </div>
    ${renderTaskNudgeScheduler(taskNudges?.scheduler)}
    ${recent.length ? `<ol>${recent.map(record => `<li>
      <span>${escapeHtml(record.action)} / ${escapeHtml(record.phase)}</span>
      <small>${escapeHtml(record.subjectTitle || record.subjectId)} Â· ${escapeHtml(formatTimestamp(record.createdAt))} Â· ${escapeHtml(formatNudgeCadence(record))}</small>
      ${record.note ? `<p>${escapeHtml(record.note)}</p>` : ''}
    </li>`).join('')}</ol>` : '<p>No nudge records yet.</p>'}
  </div>`;
}

function renderTaskNudgeScheduler(scheduler) {
  if (!scheduler) return '';

  const due = Array.isArray(scheduler.due) ? scheduler.due : [];
  const waiting = Array.isArray(scheduler.waiting) ? scheduler.waiting : [];
  const blocked = Array.isArray(scheduler.blocked) ? scheduler.blocked : [];
  const status = scheduler.status || 'idle';
  const rows = [
    ...due.map(item => renderTaskNudgeScheduleItem(item, 'due')),
    ...waiting.slice(0, 3).map(item => renderTaskNudgeScheduleItem(item, 'waiting')),
    ...blocked.slice(0, 3).map(item => renderTaskNudgeScheduleItem(item, 'blocked')),
  ].join('');

  // The scheduler is the "should I check now?" layer. It classifies recorded
  // nudges as due, waiting, or operator-blocked without performing any refresh,
  // launch, Linear, Jules, GitHub, or Git action by itself.
  return `<section class="task-nudge-scheduler ${escapeAttribute(status)}" aria-label="Nudge scheduler">
    <div>
      <strong>Nudge scheduler</strong>
      <small>${escapeHtml(scheduler.summary || '')}</small>
    </div>
    <p>${escapeHtml(scheduler.dueCount || 0)} due · ${escapeHtml(scheduler.waitingCount || 0)} waiting · ${escapeHtml(scheduler.blockedCount || 0)} operator-blocked</p>
    <button type="button" ${due.length ? '' : 'disabled'} data-task-action="refresh-due-task-nudges" title="${escapeAttribute(due.length ? 'Refresh due external-read task nudges without launching local-state actions.' : 'No due task nudges are ready to refresh.')}">Run due refreshes</button>
    ${scheduler.nextDueAt ? `<p>Next due: ${escapeHtml(formatTimestamp(scheduler.nextDueAt))}</p>` : ''}
    ${rows ? `<ol>${rows}</ol>` : '<p>No scheduled nudge records.</p>'}
  </section>`;
}

function renderTaskNudgeScheduleItem(item, tone) {
  const packet = item.actionPacket || {};

  return `<li class="${escapeAttribute(tone)}">
    <span>${escapeHtml(item.action || 'nudge')} / ${escapeHtml(item.phase || 'routing')}</span>
    <small>${escapeHtml(item.subjectTitle || item.subjectId || 'task')} · ${escapeHtml(item.summary || '')}</small>
    <div class="task-nudge-action-packet">
      <strong>Action packet</strong>
      <small>${escapeHtml(packet.label || 'No action packet')} · ${escapeHtml(packet.method || 'NONE')} · ${escapeHtml(packet.safety || 'operator_only')} · ${packet.canRunNow ? 'ready' : 'not ready'}</small>
      ${packet.endpoint ? `<code>${escapeHtml(packet.endpoint)}</code>` : ''}
      ${packet.blockedReason ? `<p>${escapeHtml(packet.blockedReason)}</p>` : ''}
    </div>
  </li>`;
}

function renderTaskNudgeRefreshSummary(result) {
  if (!result) return '';

  const rows = Array.isArray(result.results) && result.results.length
    ? `<ul>${result.results.map(item => `<li>
      <strong>${escapeHtml(item.status || 'checked')}</strong>
      ${escapeHtml(item.subjectTitle || item.subjectId || 'task')}: ${escapeHtml(item.summary || '')}
      ${item.error ? `<small>${escapeHtml(item.error)}</small>` : ''}
    </li>`).join('')}</ul>`
    : '<p>No due nudge refresh results were reported.</p>';

  // This panel is the visible receipt for a measured foreman wake-up. It shows
  // which due external-read boundaries were refreshed and which due actions
  // stayed skipped because they still need deliberate operator/local-state work.
  return `<div class="operator-plan compact ${result.failures?.length ? 'blocked' : 'ready'}">
    <div>
      <span class="badge ${result.failures?.length ? 'approval' : 'running'}">Due nudge refresh</span>
      <strong>Due nudge refresh</strong>
      <small>${escapeHtml(formatTimestamp(result.checkedAt))}</small>
    </div>
    <p>${escapeHtml(result.dueCount || 0)} due checked; ${escapeHtml(result.statusRefreshes || 0)} Jules status refresh(es), ${escapeHtml(result.pullRequestRefreshes || 0)} PR refresh(es), ${escapeHtml(result.localSyncRefreshes || 0)} local sync refresh(es), ${escapeHtml(result.skipped || 0)} skipped.</p>
    ${rows}
  </div>`;
}

function inferNudgePhase(routing) {
  const action = routing?.nextAction?.code;
  if (routing?.route === 'blocked') return 'git_sync';
  if (action === 'send_to_jules' && routing?.route === 'jules_plan') return 'jules_plan';
  if (action === 'send_to_jules') return 'jules_execution';
  if (action === 'refresh') return 'github_pr';
  if (action === 'nudge') return 'jules_execution';
  if (action === 'assign_local_agent') return 'routing';
  return 'routing';
}

function formatNudgeCadence(action) {
  const seconds = Number(action?.pauseSeconds ?? 0);
  if (action?.nextNudgeAt) {
    return `Pause ${formatDuration(seconds)}; next nudge ${formatTimestamp(action.nextNudgeAt)}.`;
  }
  if (seconds > 0) return `Pause ${formatDuration(seconds)} before refreshing.`;
  return 'No automatic wait required.';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 seconds';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function renderBulkRefreshSummary(result) {
  if (!result) return '';

  const failures = Array.isArray(result.failures) ? result.failures : [];
  const failureList = failures.length
    ? `<ul>${failures.map(failure => `<li><strong>${escapeHtml(failure.title || failure.handoffId)}</strong> ${escapeHtml(failure.phase)}: ${escapeHtml(failure.error)}</li>`).join('')}</ul>`
    : '<p>No refresh failures reported.</p>';

  // Bulk refresh matters once several Jules handoffs are active. The summary
  // tells the operator what was actually refreshed and which handoffs still
  // need individual attention.
  return `<div class="operator-plan compact ${failures.length ? 'blocked' : 'ready'}">
    <div>
      <span class="badge ${failures.length ? 'approval' : 'running'}">bulk refresh</span>
      <strong>Jules refresh summary</strong>
      <small>${escapeHtml(formatTimestamp(result.checkedAt))}</small>
    </div>
    <p>${escapeHtml(result.statusRefreshes || 0)} status refresh(es), ${escapeHtml(result.pullRequestRefreshes || 0)} PR refresh(es), ${escapeHtml(result.localSyncRefreshes || 0)} local sync check(s), ${escapeHtml(result.skipped || 0)} handoff(s) skipped.</p>
    ${failureList}
  </div>`;
}

function renderHandoffStatusBoard(handoffs = []) {
  const activeHandoffs = Array.isArray(handoffs) ? handoffs : [];
  if (!activeHandoffs.length) return '';

  const rows = activeHandoffs.slice(0, 8).map(handoff => {
    const session = describeHandoffSession(handoff);
    const pr = describeHandoffPullRequest(handoff);
    const checks = describeHandoffChecks(handoff);
    const risk = describeHandoffRisk(handoff);
    const scoutCore = describeHandoffScoutCore(handoff);
    const localSync = describeHandoffLocalSync(handoff);
    const next = handoff.next_action || handoff.githubPullRequestNextAction || handoff.localSyncStatus?.nextAction || null;
    const tone = boardToneForHandoff(handoff, checks, risk, localSync);

    // This row is the scan-friendly counterpart to the detailed handoff card.
    // It keeps the Jules session, GitHub PR, Scout/Core review, local sync, and
    // next dashboard action in one place so the operator can babysit several
    // delegations without opening Linear or raw JSON first.
    return `<li class="${escapeAttribute(tone)}">
      <div class="handoff-status-heading">
        <span class="badge ${tone === 'blocked' ? 'approval' : tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(tone)}</span>
        <strong>${escapeHtml(handoff.title || handoff.id || 'Untitled handoff')}</strong>
      </div>
      <div class="handoff-status-grid">
        ${statusBoardFact('Session', session.label, session.href)}
        ${statusBoardFact('PR', pr.label, pr.href)}
        ${statusBoardFact('Checks', checks.label)}
        ${statusBoardFact('Risk', risk.label)}
        ${statusBoardFact('Scout/Core', scoutCore.label)}
        ${statusBoardFact('Local sync', localSync.label)}
        ${statusBoardFact('Next', next?.label || next?.code || 'Refresh status')}
      </div>
      ${next?.summary ? `<p>${escapeHtml(next.summary)}</p>` : ''}
    </li>`;
  }).join('');

  const more = activeHandoffs.length > 8
    ? `<small>${escapeHtml(activeHandoffs.length - 8)} more handoff(s) hidden; use the cards below for the full list.</small>`
    : '';

  // The board deliberately summarizes existing handoff facts instead of
  // creating another lifecycle source of truth. The detailed cards remain the
  // editing and command surface; this panel is the dashboard-first overview.
  return `<div class="handoff-status-board">
    <div>
      <span class="badge running">handoffs</span>
      <strong>Jules handoff status board</strong>
      <small>Session, PR, Scout/Core, and local-sync state for active delegations.</small>
    </div>
    <ol>${rows}</ol>
    ${more}
  </div>`;
}

function statusBoardFact(label, value, href = null) {
  const renderedValue = href
    ? `<a href="${escapeAttribute(href)}">${escapeHtml(value)}</a>`
    : escapeHtml(value);

  return `<div>
    <span class="handoff-status-label">${escapeHtml(label)}:</span>
    <span class="handoff-status-value">${renderedValue}</span>
  </div>`;
}

function describeHandoffSession(handoff) {
  const state = handoff.julesState || (handoff.julesSessionId ? 'session created' : handoff.status || 'not launched');
  return {
    label: state,
    href: handoff.julesSessionUrl || null,
  };
}

function describeHandoffPullRequest(handoff) {
  const state = handoff.githubPullRequestState || (handoff.githubPullRequestUrl ? 'PR captured' : 'waiting');
  return {
    label: state,
    href: handoff.githubPullRequestUrl || null,
  };
}

function describeHandoffChecks(handoff) {
  const checks = handoff.githubPullRequestChecks;
  if (!checks) return { label: handoff.githubPullRequestUrl ? 'not refreshed' : 'waiting for PR' };

  const parts = [
    checks.conclusion || 'unknown',
    Number(checks.failing) > 0 ? `${checks.failing} failing` : null,
    Number(checks.pending) > 0 ? `${checks.pending} pending` : null,
  ].filter(Boolean);

  return { label: parts.join(', ') };
}

function describeHandoffRisk(handoff) {
  const risk = handoff.githubPullRequestRisk || handoff.githubPullRequestFiles || null;
  if (!risk) return { label: handoff.githubPullRequestUrl ? 'not refreshed' : 'waiting for PR' };

  return { label: risk.level || risk.risk || 'unknown' };
}

function describeHandoffScoutCore(handoff) {
  if (handoff.scoutCoreStatus?.status) return { label: handoff.scoutCoreStatus.status };
  if (handoff.githubPullRequestState === 'MERGED') return { label: 'core_merged' };
  if (!handoff.githubPullRequestUrl) return { label: 'waiting_for_pr' };
  if (!handoff.lastPullRequestRefreshAt) return { label: 'refresh_pr_checks' };
  if (handoff.githubPullRequestMergeable === 'CONFLICTING') return { label: 'scout_conflict_bridge' };
  if (handoff.githubPullRequestChecks?.conclusion === 'passing') return { label: 'scout_bridge_then_core' };
  return { label: 'scout_review_required' };
}

function describeHandoffLocalSync(handoff) {
  const status = handoff.localSyncStatus;
  if (!status) {
    return {
      label: handoff.githubPullRequestState === 'MERGED' ? 'check_local_sync' : 'waiting_for_merge',
    };
  }

  return { label: status.status || (status.safeToPull ? 'sync_local_master' : status.upToDate ? 'current' : 'blocked') };
}

function boardToneForHandoff(handoff, checks, risk, localSync) {
  const blockedStates = new Set(['launch_failed', 'status_refresh_failed', 'base_commit_stale', 'blocked_by_git_sync']);
  if (blockedStates.has(handoff.status)) return 'blocked';
  if (handoff.julesState === 'AWAITING_PLAN_APPROVAL' || handoff.julesState === 'AWAITING_USER_FEEDBACK') return 'blocked';
  if (handoff.githubPullRequestMergeable === 'CONFLICTING') return 'blocked';
  if (/failing|failure|blocked/i.test(checks.label)) return 'blocked';
  if (/high/i.test(risk.label)) return 'blocked';
  if (/blocked/i.test(localSync.label)) return 'blocked';
  if (handoff.localSyncStatus?.upToDate || handoff.lastLocalSyncAt) return 'ready';
  return 'waiting';
}

function renderCrossHandoffConflictWatch(conflictWatch, handoffs = []) {
  if (conflictWatch && typeof conflictWatch === 'object') {
    return renderApiConflictWatch(conflictWatch);
  }

  const records = [];
  const poisonPatterns = [
    /^package-lock\.json$/,
    /^pnpm-lock\.yaml$/,
    /^yarn\.lock$/,
    /^package\.json$/,
    /^tsconfig[^/]*\.json$/,
    /^vite\.config\./,
    /^src\/data\/items\/index\.ts$/,
    /^src\/data\//,
    /^src\/state\//,
    /^src\/hooks\//,
    /^src\/systems\//,
  ];

  for (const handoff of handoffs) {
    const files = Array.isArray(handoff.githubPullRequestFiles?.files)
      ? handoff.githubPullRequestFiles.files
      : [];

    for (const file of files) {
      const path = String(file.path || '').replace(/\\/g, '/');
      if (!path) continue;

      records.push({
        path,
        handoffTitle: handoff.title,
        prUrl: handoff.githubPullRequestUrl,
        risk: file.risk || 'low',
        reason: file.reason || null,
        poison: poisonPatterns.some(pattern => pattern.test(path)),
      });
    }
  }

  const byPath = new Map();
  for (const record of records) {
    const existing = byPath.get(record.path) || [];
    existing.push(record);
    byPath.set(record.path, existing);
  }

  const overlaps = [...byPath.entries()]
    .filter(([, entries]) => new Set(entries.map(entry => entry.handoffTitle)).size > 1)
    .slice(0, 12);
  const poisonFiles = records
    .filter(record => record.poison || record.risk !== 'low')
    .slice(0, 12);

  if (!overlaps.length && !poisonFiles.length) {
    if (!records.length) return '';

    return `<div class="operator-plan compact ready conflict-watch">
      <div>
        <span class="badge running">conflicts</span>
        <strong>Cross-handoff conflict watch</strong>
      </div>
      <p>No overlapping or conflict-prone PR files are visible from refreshed Jules handoffs.</p>
    </div>`;
  }

  const overlapList = overlaps.length
    ? `<div>
        <strong>Overlapping files</strong>
        <ul>${overlaps.map(([path, entries]) => {
          return `<li><code>${escapeHtml(path)}</code><span>${renderConflictHandoffLinks(entries)}</span></li>`;
        }).join('')}</ul>
      </div>`
    : '';
  const poisonList = poisonFiles.length
    ? `<div>
        <strong>Conflict-prone files</strong>
        <ul>${poisonFiles.map(record => {
          const detail = `${record.handoffTitle}${record.reason ? `: ${record.reason}` : ''}`;
          return `<li class="${escapeAttribute(record.risk === 'high' || record.poison ? 'failed' : 'waiting')}"><code>${escapeHtml(record.path)}</code><span>${renderConflictRecordLink(record, detail)}</span></li>`;
        }).join('')}</ul>
      </div>`
    : '';

  // This panel catches the conflict pattern that appears only when several
  // Jules PRs are active at once: two otherwise valid tasks touching the same
  // shared file, lockfile, registry, or generated artifact. Scout should bridge
  // these before Core treats any one PR as independently merge-ready.
  return `<div class="operator-plan compact ${overlaps.length ? 'blocked' : 'waiting'} conflict-watch">
    <div>
      <span class="badge ${overlaps.length ? 'approval' : 'retrying'}">conflicts</span>
      <strong>Cross-handoff conflict watch</strong>
    </div>
    <p>${escapeHtml(overlaps.length ? 'Scout should bridge overlapping PR files before Core merges.' : 'No overlaps yet, but conflict-prone files still need Scout attention.')}</p>
    ${overlapList}
    ${poisonList}
  </div>`;
}

function renderApiConflictWatch(conflictWatch) {
  const overlapFiles = Array.isArray(conflictWatch.overlap_files) ? conflictWatch.overlap_files : [];
  const riskFiles = Array.isArray(conflictWatch.risk_files) ? conflictWatch.risk_files : [];
  const status = conflictWatch.status || 'clear';

  if (!overlapFiles.length && !riskFiles.length && status === 'clear') {
    return '';
  }

  const overlapList = overlapFiles.length
    ? `<div>
        <strong>Overlapping files</strong>
        <ul>${overlapFiles.slice(0, 12).map(item => {
          const handoffs = Array.isArray(item.handoffs) ? item.handoffs : [];
          return `<li><code>${escapeHtml(item.path || '(unknown file)')}</code><span>${renderConflictHandoffLinks(handoffs)}</span></li>`;
        }).join('')}</ul>
      </div>`
    : '';
  const riskList = riskFiles.length
    ? `<div>
        <strong>Conflict-prone files</strong>
        <ul>${riskFiles.slice(0, 12).map(item => {
          const detail = `${item.title || item.handoff_id || 'Jules handoff'}${item.reason ? `: ${item.reason}` : ''}`;
          return `<li class="${escapeAttribute(item.risk === 'high' ? 'failed' : 'waiting')}"><code>${escapeHtml(item.path || '(unknown file)')}</code><span>${renderConflictRecordLink(item, detail)}</span></li>`;
        }).join('')}</ul>
      </div>`
    : '';
  const tone = status === 'blocked' ? 'blocked' : status === 'attention' ? 'waiting' : 'ready';
  const badge = status === 'blocked' ? 'approval' : status === 'attention' ? 'retrying' : 'running';

  // The API owns this summary so the browser and headless foremen are looking
  // at the same conflict-watch contract. The older client-side calculation
  // remains as a fallback for snapshots from older servers.
  return `<div class="operator-plan compact ${tone} conflict-watch">
    <div>
      <span class="badge ${badge}">conflicts</span>
      <strong>Cross-handoff conflict watch</strong>
    </div>
    <p>${escapeHtml(conflictWatch.summary || 'No overlapping or conflict-prone active Jules PR files are visible.')}</p>
    ${overlapList}
    ${riskList}
  </div>`;
}

function renderConflictHandoffLinks(handoffs) {
  const links = Array.isArray(handoffs) ? handoffs : [];

  if (!links.length) {
    return escapeHtml('Unknown Jules handoff');
  }

  // Conflict-watch rows are meant to be an operator launchpad, not just a
  // warning label. Keep the title readable while preserving direct PR links so
  // Scout/Core can open the exact Jules PRs that need bridging.
  return links.map(handoff => {
    const label = handoff.title || handoff.handoffTitle || handoff.id || handoff.handoff_id || 'Jules handoff';
    const url = handoff.pull_request_url || handoff.prUrl || handoff.githubPullRequestUrl || null;
    return renderConflictRecordLink({ pull_request_url: url, prUrl: url }, label);
  }).join(', ');
}

function renderConflictRecordLink(record, label) {
  const title = label || record.title || record.handoffTitle || record.handoff_id || 'Jules handoff';
  const url = record.pull_request_url || record.prUrl || record.githubPullRequestUrl || null;

  if (!url) {
    return escapeHtml(title);
  }

  return `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`;
}

function renderPreflightRemediation(preflight) {
  const remediation = Array.isArray(preflight.remediation) ? preflight.remediation : [];
  const dirtySamples = Array.isArray(preflight.dirtyFileSamples) ? preflight.dirtyFileSamples : [];
  const untrackedSamples = Array.isArray(preflight.untrackedFileSamples) ? preflight.untrackedFileSamples : [];
  const commands = preflight.commands || {};
  const nextAction = renderPreflightNextAction(preflight.nextAction);
  const commandRows = [
    commands.status ? ['Review local changes', commands.status] : null,
    commands.showLocalCommit ? ['Show local base commit', commands.showLocalCommit] : null,
    commands.showRemoteCommit ? ['Show GitHub base commit', commands.showRemoteCommit] : null,
    commands.inspectDivergence ? ['Inspect branch difference', commands.inspectDivergence] : null,
    commands.pullFastForward ? ['Fast-forward after local changes are safe', commands.pullFastForward] : null,
    commands.pushBase ? ['Push intended base commits', commands.pushBase] : null,
  ].filter(Boolean);

  if (!nextAction && !remediation.length && !dirtySamples.length && !untrackedSamples.length && !commandRows.length) return '';

  // This panel is the "why can't Jules start?" explanation. It keeps the sync
  // gate practical by showing a few exact files and commands without requiring
  // the user to decode terminal output or remember Git syntax.
  return `<details class="sync-remediation" ${preflight.ok ? '' : 'open'}>
    <summary>How to unblock Jules</summary>
    ${nextAction}
    ${remediation.length ? `<ol>${remediation.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}
    ${dirtySamples.length ? fileSampleList('Tracked changes blocking Jules', dirtySamples, preflight.dirtyFiles) : ''}
    ${untrackedSamples.length ? fileSampleList('Untracked files blocking Jules', untrackedSamples, preflight.untrackedFiles) : ''}
    ${commandRows.length ? `<dl class="command-list">${commandRows.map(([label, command]) => `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(command)}</code></dd></div>`).join('')}</dl>` : ''}
  </details>`;
}

function renderSyncDecisionBoard(preflight, gitDisposition) {
  if (preflight?.ok) return '';

  const ahead = Number(preflight?.ahead ?? 0);
  const behind = Number(preflight?.behind ?? 0);
  const dirtyFiles = Number(preflight?.dirtyFiles ?? 0);
  const untrackedFiles = Number(preflight?.untrackedFiles ?? 0);
  const commands = preflight?.commands || {};
  const dispositionByCategory = new Map(
    Array.isArray(gitDisposition?.categories)
      ? gitDisposition.categories.map(item => [item.category, item])
      : []
  );
  const cards = [];

  // This board names the ownership decisions that must happen before any
  // automated Git repair. It preserves user-owned local work by separating
  // "what should happen to this work?" from the lower-level Git commands in
  // the remediation details below.
  if (ahead > 0) {
    cards.push({
      category: 'local_commits',
      title: 'Local-only commits',
      count: `${ahead} commit${ahead === 1 ? '' : 's'}`,
      decision: 'Decide whether Jules and GitHub should see these local commits, or whether they belong on a different branch before the base is synced.',
      command: commands.inspectDivergence || commands.pushBase || '',
    });
  }

  if (dirtyFiles > 0) {
    cards.push({
      category: 'tracked_changes',
      title: 'Tracked edits and deletions',
      count: `${dirtyFiles} file${dirtyFiles === 1 ? '' : 's'}`,
      decision: 'Decide whether each tracked edit belongs to the Jules base, should be stashed for later, or should be reverted only after explicit ownership approval.',
      command: commands.status || '',
    });
  }

  if (untrackedFiles > 0) {
    cards.push({
      category: 'untracked_artifacts',
      title: 'Untracked artifacts',
      count: `${untrackedFiles} entr${untrackedFiles === 1 ? 'y' : 'ies'}`,
      decision: 'Decide which new artifacts are source, docs, generated proof, ignored output, or discardable scratch before creating any handoff.',
      command: commands.status || '',
    });
  }

  if (behind > 0) {
    cards.push({
      category: 'remote_commits',
      title: 'Remote-only commits',
      count: `${behind} commit${behind === 1 ? '' : 's'}`,
      decision: 'Fast-forward only after local commits and working-tree changes are intentionally handled, so GitHub updates do not bury user-owned work.',
      command: commands.pullFastForward || '',
    });
  }

  if (!cards.length) return '';

  return `<section class="sync-decision-board" aria-label="Git sync decision board">
    <div>
      <strong>Sync Decision Board</strong>
      <p>Resolve these ownership questions before creating a Linear issue or launching Jules.</p>
      ${gitDisposition?.summary ? `<p>${escapeHtml(gitDisposition.summary)}</p>` : ''}
    </div>
    <div class="sync-decision-grid">
      ${cards.map(card => {
        const disposition = dispositionByCategory.get(card.category) || {};
        return `<article class="sync-decision-card" data-git-disposition-category="${escapeAttribute(card.category)}">
        <span>${escapeHtml(card.count)}</span>
        <h4>${escapeHtml(card.title)}</h4>
        <p>${escapeHtml(card.decision)}</p>
        <p><strong>Recorded:</strong> ${escapeHtml(disposition.decisionLabel || 'Not decided')}</p>
        ${disposition.note ? `<p class="sync-disposition-note">${escapeHtml(disposition.note)}</p>` : ''}
        ${card.command ? `<code>${escapeHtml(card.command)}</code>` : ''}
        <label>
          <span>Record Git disposition</span>
          <select data-git-disposition-decision>
            ${gitDispositionOptions(disposition.decision)}
          </select>
        </label>
        <label>
          <span>Disposition note</span>
          <textarea data-git-disposition-note rows="3" placeholder="What should happen to this category before sync?">${escapeHtml(disposition.note || '')}</textarea>
        </label>
        <small>This records operator intent only. It does not change Git and does not bypass the sync gate.</small>
        <button type="button" data-task-action="record-git-disposition">Record Git disposition</button>
      </article>`;
      }).join('')}
    </div>
  </section>`;
}

function gitDispositionOptions(selected) {
  const options = [
    ['', 'Choose disposition'],
    ['commit_for_jules_base', 'Commit for Jules base'],
    ['keep_local', 'Keep local'],
    ['generated_proof', 'Generated proof'],
    ['ignore', 'Ignore'],
    ['needs_review', 'Needs review'],
    ['integrate_after_local_safe', 'Integrate after local work is safe'],
  ];

  return options
    .map(([value, label]) => `<option value="${escapeAttribute(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

function renderGitDispositionReviewPacket(review) {
  if (!review) return '';

  const categories = Array.isArray(review.categories) ? review.categories : [];
  const blockers = Array.isArray(review.blockers) ? review.blockers : [];
  const required = Array.isArray(review.requiredCategories) ? review.requiredCategories : [];
  const link = review.recordDispositionUrl || '/api/v1/git-disposition';

  // The review packet is the human-readable bridge between raw Git facts and
  // the guarded sync plan. It keeps evidence, missing decisions, and the
  // non-mutating promise in one place before any operator follows Git commands.
  return `<section class="sync-decision-board">
    <div>
      <strong>Git Disposition Review</strong>
      <p>${escapeHtml(review.summary || '')}</p>
      <small>Status: ${escapeHtml(review.status || 'unknown')} · Mutates Git: ${review.mutatesGit === false ? 'no' : 'unknown'} · Record endpoint: <code>${escapeHtml(link)}</code></small>
    </div>
    ${required.length ? `<p><strong>Required decisions:</strong> ${required.map(item => `<code>${escapeHtml(formatGitDispositionCategory(item))}</code>`).join(', ')}</p>` : '<p><strong>Required decisions:</strong> none</p>'}
    ${blockers.length ? `<ul class="gate-blockers">${blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    <div class="sync-decision-grid">
      ${categories.map(category => {
        const evidence = Array.isArray(category.evidence) ? category.evidence.slice(0, 4) : [];
        const candidateBreakdown = category.category === 'untracked_artifacts'
          ? ` · source candidates: ${Number(category.sourceCandidates ?? 0)} · generated candidates: ${Number(category.generatedCandidates ?? 0)}`
          : '';
        return `<article class="sync-decision-card">
          <span>${escapeHtml(String(category.evidenceCount ?? evidence.length))}</span>
          <h4>${escapeHtml(category.label || formatGitDispositionCategory(category.category))}</h4>
          <p><strong>${escapeHtml(category.status || 'unknown')}</strong> · ${escapeHtml(category.currentDecisionLabel || 'Not decided')}${candidateBreakdown}</p>
          ${category.note ? `<p class="sync-disposition-note">${escapeHtml(category.note)}</p>` : ''}
          ${evidence.length ? `<ul>${evidence.map(item => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>` : '<p>No evidence entries captured for this category.</p>'}
          <small>${escapeHtml(category.question || '')}</small>
        </article>`;
      }).join('')}
    </div>
    <small>${escapeHtml(review.safetyNote || 'Read-only review packet.')}</small>
  </section>`;
}

function renderGitSyncPlan(plan) {
  if (!plan) return '';

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const blockers = Array.isArray(plan.blockers) ? plan.blockers : [];
  const required = Array.isArray(plan.requiredDispositions) ? plan.requiredDispositions : [];
  const tone = plan.canExecute ? 'ready' : plan.status === 'ready' ? 'ready' : 'blocked';
  const badge = plan.canExecute ? 'running' : plan.status === 'ready' ? 'running' : 'approval';

  // The sync plan is intentionally a guarded human execution plan, not an
  // automation hook. It converts recorded dispositions into ordered commands
  // while preserving the rule that Symphony does not mutate Git from this panel.
  return `<section class="git-sync-plan ${escapeAttribute(tone)}" aria-label="Guarded Git sync plan">
    <div>
      <span class="badge ${badge}">${escapeHtml(plan.status || 'sync_plan')}</span>
      <strong>Guarded Git sync plan</strong>
    </div>
    <p>${escapeHtml(plan.summary || '')}</p>
    ${required.length ? `<p><strong>Waiting on:</strong> ${required.map(item => `<code>${escapeHtml(formatGitDispositionCategory(item))}</code>`).join(', ')}</p>` : ''}
    ${blockers.length ? `<ul class="gate-blockers">${blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    <ol>
      ${steps.map(step => `<li class="${escapeAttribute(step.destructive ? 'destructive' : 'read-only')}">
        <span>${escapeHtml(step.label || step.kind || 'Sync step')}</span>
        <small>${escapeHtml(step.detail || '')}</small>
        ${step.command ? `<code>${escapeHtml(step.command)}</code>` : ''}
      </li>`).join('')}
    </ol>
    <small>Read-only plan: ${plan.mutatesGit === false ? 'yes' : 'unknown'}. Mutating commands remain human-operated outside this panel.</small>
    ${renderGitSyncExecutionPacket(plan.executionPacket)}
  </section>`;
}

function renderGitSyncExecutionPacket(packet) {
  if (!packet) return '';

  const readOnlyCommands = Array.isArray(packet.readOnlyCommands) ? packet.readOnlyCommands : [];
  const mutatingCommands = Array.isArray(packet.mutatingCommands) ? packet.mutatingCommands : [];
  const verificationCommands = Array.isArray(packet.verificationCommands) ? packet.verificationCommands : [];
  const blockedReasons = Array.isArray(packet.blockedReasons) ? packet.blockedReasons : [];
  const requiredDispositions = Array.isArray(packet.requiredDispositions) ? packet.requiredDispositions : [];
  const safetyChecklist = Array.isArray(packet.safetyChecklist) ? packet.safetyChecklist : [];

  // The execution packet is the operator handoff for the Git blocker. It keeps
  // read-only inspection, human-run mutating commands, and follow-up proof in
  // separate lists so nobody has to infer what is safe from a mixed command log.
  return `<div class="git-sync-execution-packet">
    <div>
      <strong>Execution packet</strong>
      <small>${escapeHtml(packet.packageId || 'git-sync')} · ${packet.canExecute ? 'ready for human execution' : 'not executable'} · human confirmation required</small>
    </div>
    <p>${escapeHtml(packet.summary || '')}</p>
    ${requiredDispositions.length ? `<p><strong>Required decisions:</strong> ${requiredDispositions.map(item => `<code>${escapeHtml(formatGitDispositionCategory(item))}</code>`).join(', ')}</p>` : ''}
    ${blockedReasons.length ? `<ul class="gate-blockers">${blockedReasons.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    ${readOnlyCommands.length ? `<div><strong>Read-only commands</strong><ol>${readOnlyCommands.map(command => `<li><code>${escapeHtml(command)}</code></li>`).join('')}</ol></div>` : ''}
    ${mutatingCommands.length ? `<div><strong>Human-run mutating commands</strong><ol>${mutatingCommands.map(command => `<li><code>${escapeHtml(command)}</code></li>`).join('')}</ol></div>` : '<p>No mutating commands are exposed until the packet is executable.</p>'}
    ${verificationCommands.length ? `<div><strong>Proof commands after execution</strong><ol>${verificationCommands.map(command => `<li><code>${escapeHtml(command)}</code></li>`).join('')}</ol></div>` : ''}
    ${renderGitSyncPacketReceipts(packet)}
    ${safetyChecklist.length ? `<div><strong>Safety checklist</strong><ol>${safetyChecklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div>` : ''}
    <small>Expected next proof: ${escapeHtml(packet.expectedNextProof || 'Re-run Check GitHub Sync.')}</small>
  </div>`;
}

function renderGitSyncPacketReceipts(packet) {
  const preflight = packet.preflightReceipt || null;
  const decision = packet.decisionReceipt || null;
  const categories = Array.isArray(decision?.categories) ? decision.categories : [];

  // The receipts make the command packet auditable. They show which Git facts
  // and which human disposition decisions produced the runbook, so a stale
  // packet is easier to spot before anyone leaves the dashboard to run Git.
  return `<div class="git-sync-receipts">
    ${preflight ? `<section>
      <strong>Preflight receipt</strong>
      <p>${escapeHtml(preflight.summary || '')}</p>
      <p><small>${escapeHtml(preflight.baseBranch || 'base')} / ${escapeHtml(preflight.remoteBranch || 'remote')} / checked ${escapeHtml(preflight.checkedAt || 'unknown')}</small></p>
      ${Array.isArray(preflight.blockers) && preflight.blockers.length ? `<ul class="gate-blockers">${preflight.blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    </section>` : ''}
    ${decision ? `<section>
      <strong>Decision receipt</strong>
      <p>${escapeHtml(decision.summary || '')}</p>
      <p><small>${decision.readyForHumanSync ? 'Ready for human sync attempt' : 'Still missing concrete decisions'} / updated ${escapeHtml(decision.updatedAt || 'not recorded')}</small></p>
      ${categories.length ? `<ul>${categories.map(category => `<li><code>${escapeHtml(formatGitDispositionCategory(category.category))}</code>: ${escapeHtml(category.decisionLabel || 'Not decided')}${category.note ? ` - ${escapeHtml(category.note)}` : ''}</li>`).join('')}</ul>` : ''}
    </section>` : ''}
  </div>`;
}

function formatGitDispositionCategory(category) {
  const labels = {
    local_commits: 'Local-only commits',
    tracked_changes: 'Tracked edits and deletions',
    untracked_artifacts: 'Untracked artifacts',
    remote_commits: 'Remote-only commits',
  };
  return labels[category] || String(category || '');
}

function renderGitResolutionPacket(packet) {
  if (!packet) return '';

  const localCommits = Array.isArray(packet.localCommits) ? packet.localCommits : [];
  const remoteCommits = Array.isArray(packet.remoteCommits) ? packet.remoteCommits : [];
  const trackedFiles = Array.isArray(packet.trackedFiles) ? packet.trackedFiles : [];
  const untrackedFiles = Array.isArray(packet.untrackedFiles) ? packet.untrackedFiles : [];
  const details = Array.isArray(packet.details) ? packet.details : [];
  const commands = packet.commands || {};

  // The resolution packet is the durable read-only dossier for the sync gate:
  // it names the real commits and files that need disposition while preserving
  // the hard rule that the dashboard must not mutate Git to explain a blocker.
  return `<details class="git-resolution-packet" open>
    <summary>Git resolution packet</summary>
    <p>${escapeHtml(packet.summary || 'Read-only Git resolution details are available.')}</p>
    <div class="git-resolution-grid">
      ${resolutionCommitList('Local-only commits', localCommits)}
      ${resolutionCommitList('Remote-only commits', remoteCommits)}
      ${resolutionFileList('Tracked files', trackedFiles)}
      ${resolutionFileList('Untracked files', untrackedFiles)}
    </div>
    ${details.length ? `<ul class="git-resolution-details">${details.map(detail => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}
    <dl class="command-list">
      ${commands.fullStatus ? `<div><dt>Full status</dt><dd><code>${escapeHtml(commands.fullStatus)}</code></dd></div>` : ''}
      ${commands.inspectDivergence ? `<div><dt>Commit split</dt><dd><code>${escapeHtml(commands.inspectDivergence)}</code></dd></div>` : ''}
    </dl>
    <small>Generated ${escapeHtml(packet.generatedAt ? formatTimestamp(packet.generatedAt) : 'with the latest preflight')}. Read-only: ${packet.mutatesGit === false ? 'yes' : 'unknown'}.</small>
  </details>`;
}

function resolutionCommitList(label, commits) {
  const visible = commits.slice(0, 12);
  const hidden = commits.length > visible.length
    ? `<li class="muted">... ${escapeHtml(commits.length - visible.length)} more commit(s) not shown</li>`
    : '';
  const rows = visible.length
    ? visible.map(commit => `<li><code>${escapeHtml(shortCommit(commit.hash))}</code><span>${escapeHtml(commit.message || '(no subject)')}</span></li>`).join('')
    : '<li class="muted">None visible.</li>';

  return `<section>
    <strong>${escapeHtml(label)}</strong>
    <ol>${rows}${hidden}</ol>
  </section>`;
}

function resolutionFileList(label, files) {
  const visible = files.slice(0, 24);
  const hidden = files.length > visible.length
    ? `<li class="muted">... ${escapeHtml(files.length - visible.length)} more file(s) not shown</li>`
    : '';
  const rows = visible.length
    ? visible.map(file => `<li><code>${escapeHtml(file.status || '')}</code><span>${escapeHtml(file.path || '')}</span></li>`).join('')
    : '<li class="muted">None visible.</li>';

  return `<section>
    <strong>${escapeHtml(label)}</strong>
    <ol>${rows}${hidden}</ol>
  </section>`;
}

function renderPreflightNextAction(action) {
  if (!action) return '';

  const steps = Array.isArray(action.steps) && action.steps.length
    ? `<ol>${action.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  const command = action.command
    ? `<p class="sync-action-command"><strong>Command:</strong> <code>${escapeHtml(action.command)}</code></p>`
    : '';

  // The API now gives one compact Git action for headless foremen. Rendering
  // it here keeps the browser dashboard aligned with the worker-facing JSON,
  // so humans and agents see the same next safe move before Jules starts.
  return `<div class="sync-next-action ${escapeAttribute(action.tone || 'blocked')}">
    <div>
      <span class="badge ${action.tone === 'ready' ? 'running' : 'approval'}">${escapeHtml(action.code || 'git')}</span>
      <strong>Next Git action: ${escapeHtml(action.label || 'Inspect Git State')}</strong>
    </div>
    <p>${escapeHtml(action.summary || '')}</p>
    ${command}
    ${steps}
  </div>`;
}

function fileSampleList(label, files, totalCount) {
  const hidden = Number(totalCount) > files.length
    ? `<li class="muted">... ${Number(totalCount) - files.length} more not shown</li>`
    : '';

  return `<div class="file-samples">
    <strong>${escapeHtml(label)}</strong>
    <ul>${files.map(file => `<li><code>${escapeHtml(file)}</code></li>`).join('')}${hidden}</ul>
  </div>`;
}

function renderJulesKickoffSequence(preflight, drafts, handoffs, capabilities = {}) {
  const hasDraft = drafts.length > 0;
  const hasLinearIssue = drafts.some(draft => Boolean(draft.linearIssueIdentifier));
  const hasHandoff = handoffs.length > 0;
  const hasManifest = handoffs.some(handoff => Boolean(handoff.manifestPath));
  const hasLaunched = handoffs.some(handoff => handoff.status === 'sent_to_jules' || Boolean(handoff.julesSessionId));
  const gitReady = Boolean(preflight?.ok);
  const canCreateLinearIssue = Boolean(capabilities.canCreateLinearIssue);
  const linearIssueRequired = Boolean(capabilities.requiresLinearIssueForHandoff);

  const steps = [
    {
      label: 'Check GitHub Sync',
      done: gitReady,
      blocked: false,
      detail: gitReady ? 'GitHub is ready for Jules.' : 'Resolve the sync gate before cloud work starts.',
    },
    {
      label: 'Save Draft',
      done: hasDraft,
      blocked: !gitReady,
      detail: 'Capture the task in dashboard wording first.',
    },
    {
      label: 'Create Linear Issue',
      done: hasLinearIssue,
      blocked: !gitReady || !hasDraft || !canCreateLinearIssue,
      detail: canCreateLinearIssue
        ? 'Create the tracked issue that a Symphony foreman can claim.'
        : 'Unavailable unless this workflow is connected to Linear.',
    },
    {
      label: 'Prepare Handoff',
      done: hasHandoff,
      blocked: !gitReady || !hasDraft || (linearIssueRequired && !hasLinearIssue),
      detail: linearIssueRequired && !hasLinearIssue
        ? 'Create the Linear tracking issue first, then generate the bounded Jules prompt.'
        : 'Generate the bounded Jules prompt from the draft.',
    },
    {
      label: 'Stage Jules Manifest',
      done: hasManifest,
      blocked: !gitReady || !hasHandoff,
      detail: 'Write the local .jules manifest for review.',
    },
    {
      label: 'Launch Jules',
      done: hasLaunched,
      blocked: !gitReady || !hasManifest,
      detail: 'Start the cloud Jules session and monitor PR/check/local-sync status.',
    },
  ];

  // This sequence is intentionally redundant with the buttons on each card.
  // It translates the Linear/Jules choreography into one ordered path so the
  // operator does not need to understand Linear projects, manifests, or PR
  // polling before starting the next task.
  return `<div class="kickoff-sequence">
    <div>
      <span class="badge ${gitReady ? 'running' : 'approval'}">kickoff</span>
      <strong>Kickoff sequence</strong>
    </div>
    <ol>${steps.map(step => {
      const state = step.done ? 'done' : step.blocked ? 'blocked' : 'next';
      return `<li class="${escapeAttribute(state)}">
        <span>${escapeHtml(step.label)}</span>
        <small>${escapeHtml(step.detail)}</small>
      </li>`;
    }).join('')}</ol>
  </div>`;
}

function buildTaskOperatorPlan(preflight, drafts, handoffs, capabilities = {}) {
  const activeHandoff = [...handoffs].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
  const hasDrafts = drafts.length > 0;
  const requiresLinearIssue = Boolean(capabilities.requiresLinearIssueForHandoff);
  const hasDraftWithoutLinearIssue = drafts.some(draft => !draft.linearIssueIdentifier);

  // This plan is dashboard-only guidance. It does not change orchestration
  // state; it turns the existing draft, Git, Jules, PR, and local-sync fields
  // into the short "what now?" answer the operator needs between refreshes.
  if (!preflight?.ok) {
    return {
      tone: 'blocked',
      title: 'Sync GitHub before Jules starts',
      summary: preflight?.summary || 'The GitHub sync gate has not passed yet.',
      steps: [
        'Commit or intentionally set aside local changes that should not go to Jules.',
        'Push intended local commits to GitHub.',
        'Return to local master and re-run the GitHub sync check.',
      ],
    };
  }

  if (!hasDrafts && !activeHandoff) {
    return {
      tone: 'waiting',
      title: 'Draft the next Jules task',
      summary: 'GitHub is ready. The next step is to describe a bounded task for Jules.',
      steps: [
        'Write a task title and plain-language task details.',
        'Name expected files, constraints, and verification if you already know them.',
        'Save the draft before preparing a Jules handoff.',
      ],
    };
  }

  if (requiresLinearIssue && hasDraftWithoutLinearIssue && !activeHandoff) {
    return {
      tone: 'ready',
      title: 'Create a Linear issue for the draft',
      summary: 'The draft is saved. Create the Linear tracking issue next so a Symphony foreman can claim and babysit the Jules work.',
      steps: [
        'Review the draft wording and write scope.',
        'Click Create Linear Issue on the draft card.',
        'Prepare Handoff only after the Linear issue is linked.',
      ],
    };
  }

  if (!activeHandoff) {
    return {
      tone: 'ready',
      title: 'Prepare a handoff from a draft',
      summary: 'At least one local task draft is ready to become a Jules handoff.',
      steps: [
        'Review the draft wording.',
        'Click Prepare Handoff to generate the bounded Jules prompt.',
        'Stage the manifest only after the prompt looks right.',
      ],
    };
  }

  return buildHandoffOperatorPlan(activeHandoff);
}

function renderTaskOperatorPlan(plan) {
  return `<div class="operator-plan ${escapeAttribute(plan.tone)}">
    <div>
      <span class="badge ${plan.tone === 'blocked' ? 'approval' : plan.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(plan.tone)}</span>
      <strong>${escapeHtml(plan.title)}</strong>
    </div>
    <p>${escapeHtml(plan.summary)}</p>
    <ol>${plan.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
  </div>`;
}

function renderQueueNextAction(action) {
  if (!action) return '';

  const steps = Array.isArray(action.steps) && action.steps.length
    ? `<ol>${action.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  const source = action.source_type
    ? `<small>Source: ${escapeHtml(action.source_type)}${action.source_id ? ` ${escapeHtml(action.source_id)}` : ''}</small>`
    : '';
  const endpoint = action.url
    ? `<p><strong>Endpoint:</strong> ${action.method ? `<span class="method-pill">${escapeHtml(action.method)}</span>` : ''} <code>${escapeHtml(action.url)}</code></p>`
    : '';
  const conflictContext = renderQueueConflictContext(action);
  const sessionContext = renderActionJulesSession(action);
  const pullRequestContext = renderActionPullRequest(action);
  const commandContext = renderActionCommand(action);
  const requestBodyContext = renderActionRequestBody(action);

  // This is the one-action summary for the whole task queue. Individual cards
  // still show their own action, but this panel gives the operator and foreman
  // the highest-priority next move without scanning every draft and handoff.
  return `<div class="queue-next-action ${escapeAttribute(action.tone || 'waiting')}">
    <div>
      <span class="badge ${action.tone === 'blocked' ? 'approval' : action.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(action.code || 'next')}</span>
      <strong>Queue next action: ${escapeHtml(action.label || 'Review next step')}</strong>
      ${source}
    </div>
    <p>${escapeHtml(action.summary || '')}</p>
    ${endpoint}
    ${sessionContext}
    ${pullRequestContext}
    ${commandContext}
    ${requestBodyContext}
    ${conflictContext}
    ${steps}
  </div>`;
}

function renderQueueConflictContext(action) {
  const prUrls = Array.isArray(action.affected_pr_urls) ? action.affected_pr_urls.filter(Boolean).slice(0, 12) : [];
  const overlapFiles = Array.isArray(action.overlap_file_paths) ? action.overlap_file_paths.filter(Boolean).slice(0, 12) : [];
  const riskFiles = Array.isArray(action.risk_file_paths) ? action.risk_file_paths.filter(Boolean).slice(0, 12) : [];

  if (!prUrls.length && !overlapFiles.length && !riskFiles.length) {
    return '';
  }

  const prLinks = prUrls.length
    ? `<div>
        <strong>Affected Jules PRs</strong>
        <ul>${prUrls.map((url, index) => `<li><a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">PR ${index + 1}</a></li>`).join('')}</ul>
      </div>`
    : '';
  const overlapList = overlapFiles.length
    ? `<div>
        <strong>Overlapping files</strong>
        <ul>${overlapFiles.map(path => `<li><code>${escapeHtml(path)}</code></li>`).join('')}</ul>
      </div>`
    : '';
  const riskList = riskFiles.length
    ? `<div>
        <strong>Conflict-prone files</strong>
        <ul>${riskFiles.map(path => `<li><code>${escapeHtml(path)}</code></li>`).join('')}</ul>
      </div>`
    : '';

  // This block mirrors the worker-facing queue action. It keeps the top
  // dashboard instruction actionable when multiple Jules PRs need Scout
  // arbitration before Core validates or merges either branch.
  return `<div class="queue-conflict-context">
    ${prLinks}
    ${overlapList}
    ${riskList}
  </div>`;
}

function taskDraftCard(draft, preflight, capabilities = {}) {
  const blocked = !preflight?.ok;
  const hasLinearIssue = Boolean(draft.linearIssueIdentifier);
  const canCreateLinearIssue = Boolean(capabilities.canCreateLinearIssue);
  const linearIssueRequired = Boolean(capabilities.requiresLinearIssueForHandoff);
  const linearUnavailableReason = capabilities.linearIssueCreationBlocker || 'Linear issue creation is unavailable in this workflow.';
  const statusLabel = blocked ? 'Blocked by Git Sync' : 'Ready for Handoff';
  const linearLink = hasLinearIssue
    ? `<p><strong>Linear:</strong> ${draft.linearIssueUrl ? `<a href="${escapeAttribute(draft.linearIssueUrl)}">${escapeHtml(draft.linearIssueIdentifier)}</a>` : escapeHtml(draft.linearIssueIdentifier)}</p>`
    : canCreateLinearIssue
      ? '<p class="usage-summary">No Linear tracking issue has been created from this draft yet.</p>'
      : `<p class="usage-summary">${escapeHtml(linearUnavailableReason)}</p>`;
  const linearPreview = draft.linear_issue_preview
    ? `<div class="expected-files">
        <strong>Linear issue preview</strong>
        <p>Can create now: ${draft.linear_issue_preview.canCreateNow ? 'yes' : 'no'}; mutates external systems: ${draft.linear_issue_preview.mutatesExternalSystems ? 'yes' : 'no'}.</p>
        <p class="usage-summary">${escapeHtml(draft.linear_issue_preview.safetyNote || 'Preview only; no Linear issue has been created.')}</p>
        ${draft.links?.linearIssuePreview ? `<a href="${escapeAttribute(draft.links.linearIssuePreview)}">Open issue packet</a>` : ''}
      </div>`
    : '';
  const manifestPreview = draft.jules_manifest_preview
    ? `<div class="expected-files">
        <strong>Jules manifest preview</strong>
        <p>Can stage now: ${draft.jules_manifest_preview.canStageNow ? 'yes' : 'no'}; mutates local files: ${draft.jules_manifest_preview.mutatesLocalFiles ? 'yes' : 'no'}.</p>
        <p class="usage-summary">${escapeHtml(draft.jules_manifest_preview.manifestPath || 'Manifest path will be assigned during staging.')}</p>
        ${draft.links?.julesManifestPreview ? `<a href="${escapeAttribute(draft.links.julesManifestPreview)}">Open manifest packet</a>` : ''}
      </div>`
    : '';
  const readinessPacket = draft.handoff_readiness
    ? `<div class="expected-files">
        <strong>Handoff readiness</strong>
        <p>Status: ${escapeHtml(draft.handoff_readiness.status)}; mutates Git: ${draft.handoff_readiness.mutatesGit ? 'yes' : 'no'}; mutates external systems: ${draft.handoff_readiness.mutatesExternalSystems ? 'yes' : 'no'}; mutates local files: ${draft.handoff_readiness.mutatesLocalFiles ? 'yes' : 'no'}.</p>
        <p class="usage-summary">${escapeHtml(draft.handoff_readiness.summary || 'Readiness packet has not produced a summary yet.')}</p>
        ${renderHandoffPassPath(draft.handoff_readiness.passPath)}
        ${draft.links?.handoffReadiness ? `<a href="${escapeAttribute(draft.links.handoffReadiness)}">Open handoff readiness</a>` : ''}
      </div>`
    : '';
  const linearDisabled = blocked || hasLinearIssue || !canCreateLinearIssue;
  const linearTitle = blocked
    ? 'GitHub sync must pass before Symphony creates a Linear issue that a foreman worker can claim.'
    : hasLinearIssue
      ? 'This draft is already linked to a Linear issue.'
      : canCreateLinearIssue
        ? 'Create a Linear tracking issue in the configured Symphony project.'
        : linearUnavailableReason;
  const expectedFiles = renderExpectedFiles(draft.expectedFiles);
  const verification = renderVerificationCommands(draft.verificationCommands);
  const nextAction = renderCardNextAction(draft.next_action);
  const promoteBlockedByLinear = linearIssueRequired && !hasLinearIssue;
  const promoteDisabled = blocked || promoteBlockedByLinear;
  const promoteTitle = blocked
    ? 'GitHub sync must pass before a Jules handoff can be prepared.'
    : promoteBlockedByLinear
      ? 'Create the Linear issue first so a Symphony foreman can claim and track this task.'
      : 'Create a local Jules handoff prompt for review.';

  return `<li id="task-draft-${escapeAttribute(draft.id)}" class="task-draft ${blocked ? 'blocked' : 'ready'}">
    <div>
      <span class="badge ${blocked ? 'approval' : 'running'}">${escapeHtml(statusLabel)}</span>
      <strong>${escapeHtml(draft.title)}</strong>
      <small>Created ${escapeHtml(formatTimestamp(draft.createdAt))}</small>
    </div>
    <p>${escapeHtml(draft.body)}</p>
    ${expectedFiles}
    ${verification}
    ${nextAction}
    ${linearLink}
    ${linearPreview}
    ${manifestPreview}
    ${readinessPacket}
    <button type="button" ${linearDisabled ? 'disabled' : ''} data-task-action="create-linear" data-draft-id="${escapeAttribute(draft.id)}" title="${escapeAttribute(linearTitle)}">
      Create Linear Issue
    </button>
    <button type="button" ${promoteDisabled ? 'disabled' : ''} data-task-action="promote-draft" data-draft-id="${escapeAttribute(draft.id)}" title="${escapeAttribute(promoteTitle)}">
      Prepare Handoff
    </button>
  </li>`;
}

function renderExpectedFiles(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) {
    // An empty write-scope list is intentionally restrictive, not permissive.
    // The Jules manifest falls back to a worklog-only scope so cloud workers
    // cannot freely edit the repository without the operator naming boundaries.
    return `<div class="expected-files empty-scope">
      <strong>Expected files / write scopes</strong>
      <p>No editable files are declared. This Jules handoff is analysis-only until you add expected files or explicit write scopes.</p>
    </div>`;
  }

  // Expected files become the Jules manifest write scope. Showing them on both
  // draft and handoff cards lets the operator see the remote-edit boundary
  // before launching Jules and later compare PR changes against that boundary.
  return `<div class="expected-files">
    <strong>Expected files / write scopes</strong>
    <ul>${list.map(file => `<li><code>${escapeHtml(file)}</code></li>`).join('')}</ul>
  </div>`;
}

function renderVerificationCommands(commands) {
  const list = Array.isArray(commands) ? commands.filter(Boolean) : [];
  if (!list.length) return '';

  // These commands are captured at task intake time because Jules runs remotely
  // and later returns through Scout/Core review. Keeping the requested checks
  // visible on draft and handoff cards makes the acceptance criteria survive
  // Linear, Jules, GitHub PRs, and local sync.
  return `<div class="verification-commands">
    <strong>Requested test commands</strong>
    <ul>${list.map(command => `<li><code>${escapeHtml(command)}</code></li>`).join('')}</ul>
  </div>`;
}

function renderHandoffPassPath(passPath) {
  if (!passPath) return '';

  const actions = Array.isArray(passPath.actions) ? passPath.actions : [];

  // The pass path is the readable bridge after Git sync clears. It shows which
  // boundary is current, which later mutation is still waiting, and what receipt
  // should exist before the foreman advances to the next step.
  return `<div class="handoff-pass-path">
    <strong>Pass path</strong>
    <p>Current boundary: <code>${escapeHtml(passPath.currentBoundary || 'unknown')}</code>; next proof: ${escapeHtml(passPath.nextExpectedProof || 'Capture the next boundary receipt.')}</p>
    ${actions.length ? `<ol>${actions.map(action => {
      const blockers = Array.isArray(action.blockedBy) && action.blockedBy.length
        ? `<ul>${action.blockedBy.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      const mutationFlags = [
        action.mutatesGitIfRun ? 'mutates Git if run' : '',
        action.mutatesExternalSystemsIfRun ? 'mutates external systems if run' : '',
        action.mutatesLocalFilesIfRun ? 'mutates local files if run' : '',
      ].filter(Boolean).join('; ') || 'read-only if run';
      return `<li class="${escapeAttribute(action.status || 'waiting')}">
        <span>${escapeHtml(action.label || action.id || 'Boundary')}</span>
        <small>${escapeHtml(action.status || 'unknown')} / ${action.canRunNow ? 'can run now' : 'waiting'} / ${escapeHtml(mutationFlags)}</small>
        ${action.receipt ? `<em>${escapeHtml(action.receipt)}</em>` : ''}
        ${blockers}
      </li>`;
    }).join('')}</ol>` : ''}
  </div>`;
}

function renderCardNextAction(action) {
  if (!action) return '';

  const steps = Array.isArray(action.steps) && action.steps.length
    ? `<ol>${action.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  const url = action.url
    ? `<p><strong>Endpoint:</strong> ${action.method ? `<span class="method-pill">${escapeHtml(action.method)}</span>` : ''} <code>${escapeHtml(action.url)}</code></p>`
    : '';
  const sessionContext = renderActionJulesSession(action);
  const pullRequestContext = renderActionPullRequest(action);
  const commandContext = renderActionCommand(action);
  const requestBodyContext = renderActionRequestBody(action);

  // Drafts and handoffs now carry a machine-readable next action for headless
  // foremen. Rendering the same object on the cards keeps the browser path and
  // API path aligned, instead of making the user infer state from disabled
  // buttons while workers read a clearer JSON contract.
  return `<div class="card-next-action ${escapeAttribute(action.tone || 'waiting')}">
    <div>
      <span class="badge ${action.tone === 'blocked' ? 'approval' : action.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(action.code || 'next')}</span>
      <strong>Next dashboard action: ${escapeHtml(action.label || 'Review next step')}</strong>
    </div>
    <p>${escapeHtml(action.summary || '')}</p>
    ${url}
    ${sessionContext}
    ${pullRequestContext}
    ${commandContext}
    ${requestBodyContext}
    ${steps}
  </div>`;
}

function renderActionRequestBody(action) {
  const schema = action.request_body_schema || action.requestBodySchema || null;
  const example = action.request_body_example || action.requestBodyExample || null;

  if (!schema && !example) return '';

  const schemaText = schema ? stableJson(schema) : null;
  const exampleText = example ? stableJson(example) : null;

  // Some next actions are direct POST instructions for headless foremen as
  // well as browser users. Showing the body contract avoids endpoint guessing
  // and keeps the dashboard aligned with the API's machine-readable action.
  return `<details class="action-request-body" open>
    <summary>Request body</summary>
    ${schemaText ? `<p><strong>Schema:</strong> <code>${escapeHtml(schemaText)}</code></p>` : ''}
    ${exampleText ? `<p><strong>Example:</strong> <code>${escapeHtml(exampleText)}</code></p>` : ''}
  </details>`;
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort()).replace(/":/g, '": ');
}

function renderActionJulesSession(action) {
  const sessionUrl = action.jules_session_url || action.julesSessionUrl || null;
  const sessionId = action.jules_session_id || action.julesSessionId || null;

  if (!sessionUrl && !sessionId) {
    return '';
  }

  // Plan approval has two different destinations: inspect the Jules cloud
  // session, then send approval through Symphony's local endpoint. Showing both
  // on the same next-action card keeps the approval decision legible.
  return `<p class="action-session-link"><strong>Jules session:</strong> ${
    sessionUrl
      ? `<a href="${escapeAttribute(sessionUrl)}" target="_blank" rel="noreferrer">${escapeHtml(sessionId || sessionUrl)}</a>`
      : escapeHtml(sessionId)
  }</p>`;
}

function renderActionPullRequest(action) {
  const pullRequestUrl = action.github_pull_request_url || action.githubPullRequestUrl || action.pull_request_url || null;

  if (!pullRequestUrl) {
    return '';
  }

  // PR actions often point at a local Symphony endpoint for refresh or sync,
  // while the decision itself depends on GitHub checks, conflicts, and review
  // state. Showing the PR beside the endpoint keeps those two surfaces tied
  // together for both browser operators and worker foremen.
  return `<p class="action-pr-link"><strong>GitHub PR:</strong> <a href="${escapeAttribute(pullRequestUrl)}" target="_blank" rel="noreferrer">${escapeHtml(pullRequestUrl)}</a></p>`;
}

function renderActionCommand(action) {
  const command = action.command || action.shell_command || null;

  if (!command) {
    return '';
  }

  // PR-readiness actions can name a Scout/Core command while still pointing at
  // a local Symphony endpoint for refresh. Showing the command prevents the
  // dashboard from hiding the real review/validation work behind a generic
  // refresh button.
  return `<p class="action-command"><strong>Command:</strong> <code>${escapeHtml(command)}</code></p>`;
}

function handoffCard(handoff) {
  const observed = handoff.status === 'observed_pr';
  const sent = handoff.status === 'sent_to_jules';
  const blocked = handoff.status === 'blocked_by_git_sync';
  const baseStale = handoff.status === 'base_commit_stale';
  const launchFailed = handoff.status === 'launch_failed';
  const refreshFailed = handoff.status === 'status_refresh_failed';
  const manifestReady = handoff.status === 'manifest_ready';
  const canLaunch = (manifestReady || launchFailed) && !observed && !sent && !blocked && !baseStale && !refreshFailed;
  const badgeClass = sent || manifestReady ? 'running' : blocked || baseStale || launchFailed || refreshFailed ? 'approval' : 'running';
  const statusLabel = observed
    ? 'Observed PR'
    : sent
    ? 'Sent to Jules'
    : manifestReady
      ? 'Manifest Ready'
      : baseStale
        ? 'Base Commit Stale'
      : launchFailed
        ? 'Launch Failed'
      : refreshFailed
        ? 'Status Refresh Failed'
      : blocked
        ? 'Blocked by Git Sync'
        : 'Ready for Manifest';
  const manifestDetail = handoff.manifestPath || handoff.launchCommand
    ? `<div class="handoff-manifest">
        <p><strong>Manifest:</strong> <code>${escapeHtml(handoff.manifestPath || '')}</code></p>
        <p><strong>GitHub base:</strong> <code title="${escapeAttribute(handoff.gitPreflight?.remoteCommit || 'unknown')}">${escapeHtml(handoff.gitPreflight?.remoteBranch || 'origin/master')} @ ${escapeHtml(shortCommit(handoff.gitPreflight?.remoteCommit))}</code></p>
        <p><strong>Launch command:</strong> <code>${escapeHtml(handoff.launchCommand || '')}</code></p>
      </div>`
    : '';
  // Handoffs can outlive the original draft card, so repeat the Linear link
  // here. This keeps the dashboard, worker issue, Jules session, and PR tied
  // together even after the operator is focused on launch/check/sync status.
  const linearDetail = handoff.linearIssueIdentifier || handoff.linearIssueUrl || handoff.linearIssueId
    ? `<div class="handoff-manifest">
        <p><strong>Linear:</strong> ${handoff.linearIssueUrl ? `<a href="${escapeAttribute(handoff.linearIssueUrl)}">${escapeHtml(handoff.linearIssueIdentifier || handoff.linearIssueUrl)}</a>` : escapeHtml(handoff.linearIssueIdentifier || handoff.linearIssueId || '')}</p>
        ${handoff.linearIssueCreatedAt ? `<p><strong>Tracking issue created:</strong> ${escapeHtml(formatTimestamp(handoff.linearIssueCreatedAt))}</p>` : ''}
      </div>`
    : '';
  const expectedFileDetail = renderExpectedFiles(handoff.expectedFiles);
  const verificationDetail = renderVerificationCommands(handoff.verificationCommands);
  const nextActionDetail = renderCardNextAction(handoff.next_action);
  const lifecycleDetail = renderHandoffLifecycle(handoff);
  const baseDriftDetail = renderBaseCommitDrift(handoff);
  const launchReceiptDetail = renderLaunchGitHubReceipt(handoff);
  const launchReadinessDetail = renderJulesLaunchReadiness(handoff.launch_readiness);
  const operatorQuestionDetail = renderOperatorQuestion(handoff.operatorQuestion, handoff.id, handoff.operatorAnswers);
  const timelineDetail = renderHandoffTimeline(handoff.handoffTimeline);
  const julesStateReconciliationDetail = renderJulesStateReconciliation(handoff.julesStateReconciliation);
  const repairPushReadinessDetail = renderRepairPushReadiness(handoff.repairPushReadiness);
  const repairPushResultDetail = renderRepairPushResult(handoff.repairPushResult);
  const julesDetail = handoff.julesSessionId || handoff.julesSessionUrl || handoff.githubPullRequestUrl || handoff.julesState
    ? `<div class="handoff-manifest">
        <p><strong>Jules state:</strong> ${escapeHtml(handoff.julesState || 'session created')}</p>
        <p><strong>Session:</strong> ${handoff.julesSessionUrl ? `<a href="${escapeAttribute(handoff.julesSessionUrl)}">${escapeHtml(handoff.julesSessionId || handoff.julesSessionUrl)}</a>` : escapeHtml(handoff.julesSessionId || '')}</p>
        ${handoff.githubPullRequestUrl ? `<p><strong>PR:</strong> <a href="${escapeAttribute(handoff.githubPullRequestUrl)}">${escapeHtml(handoff.githubPullRequestUrl)}</a></p>` : ''}
      </div>`
    : '';
  const launchOutput = handoff.launchError || handoff.launchOutput
    ? `<details>
        <summary>${escapeHtml(handoff.launchError ? 'Launch error' : 'Launch output')}</summary>
        <pre>${escapeHtml(handoff.launchError || handoff.launchOutput || '')}</pre>
      </details>`
    : '';
  const readinessDetail = renderJulesReadiness(handoff);
  const operatorPlan = renderHandoffOperatorPlan(handoff);
  const pullRequestDetail = renderPullRequestReadiness(handoff);
  const scoutCoreDetail = renderScoutCoreReadiness(handoff);
  const operatorMessageDetail = renderJulesOperatorMessages(handoff);
  const planApprovalDetail = renderJulesPlanApprovals(handoff);
  const deploymentDetail = renderDeploymentReadiness(handoff.deployment_readiness);
  const localSyncDetail = renderLocalSyncReadiness(handoff);
  const delegationRoiDetail = renderDelegationRoiLedger(handoff.delegationRoiLedger, handoff.id);
  const commandDetail = handoff.statusCommand || handoff.reviewCommand || handoff.pullCommand || handoff.recordsPath
    ? `<details>
        <summary>Foreman commands</summary>
        <pre>${escapeHtml([
          handoff.recordsPath ? `Records: ${handoff.recordsPath}` : '',
          handoff.statusCommand ? `Refresh: ${handoff.statusCommand}` : '',
          handoff.reviewCommand ? `Review: ${handoff.reviewCommand}` : '',
          handoff.pullCommand ? `Pull completed work: ${handoff.pullCommand}` : '',
          handoff.pullRequestViewCommand ? `Inspect PR: ${handoff.pullRequestViewCommand}` : '',
          handoff.pullRequestChecksCommand ? `Check PR: ${handoff.pullRequestChecksCommand}` : '',
          handoff.scoutReviewCommand ? `Scout bridge review: ${handoff.scoutReviewCommand}` : '',
          handoff.coreValidationCommand ? `Core validation: ${handoff.coreValidationCommand}` : '',
          handoff.pullRequestMergeCommand ? `Merge PR: ${handoff.pullRequestMergeCommand}` : '',
          handoff.coreMergeCommand ? `Core merge: ${handoff.coreMergeCommand}` : '',
          handoff.localSyncCommand ? `Sync local master after merge: ${handoff.localSyncCommand}` : '',
        ].filter(Boolean).join('\n'))}</pre>
      </details>`
    : '';
  const lastRefresh = handoff.lastStatusRefreshAt
    ? `<small>Last Jules refresh ${escapeHtml(formatTimestamp(handoff.lastStatusRefreshAt))}</small>`
    : '';

  return `<li id="task-handoff-${escapeAttribute(handoff.id)}" class="task-draft ${blocked || baseStale || launchFailed || refreshFailed ? 'blocked' : 'ready'}" data-handoff-card="${escapeAttribute(handoff.id)}">
    <div>
      <span class="badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
      <strong>${escapeHtml(handoff.title)}</strong>
      <small>Prepared ${escapeHtml(formatTimestamp(handoff.createdAt))}</small>
      ${lastRefresh}
    </div>
    ${manifestDetail}
    ${linearDetail}
    ${lifecycleDetail}
    ${baseDriftDetail}
    ${operatorQuestionDetail}
    ${timelineDetail}
    ${julesStateReconciliationDetail}
    ${repairPushReadinessDetail}
    ${repairPushResultDetail}
    ${julesDetail}
    ${expectedFileDetail}
    ${verificationDetail}
    ${nextActionDetail}
    ${operatorPlan}
    ${launchReceiptDetail}
    ${launchReadinessDetail}
    ${readinessDetail}
    ${planApprovalDetail}
    ${operatorMessageDetail}
    ${pullRequestDetail}
    ${scoutCoreDetail}
    ${deploymentDetail}
    ${localSyncDetail}
    ${delegationRoiDetail}
    ${launchOutput}
    ${commandDetail}
    <details>
      <summary>Jules prompt preview</summary>
      <pre>${escapeHtml(handoff.prompt)}</pre>
    </details>
    <button type="button" ${observed || blocked || manifestReady || sent ? 'disabled' : ''} data-task-action="stage-manifest" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(observed ? 'Observed PRs are watch-only and were not created by this dashboard run.' : blocked ? 'GitHub sync must pass before a Jules manifest can be staged.' : baseStale ? 'Re-stage the manifest so its prompt and starting commit match current GitHub.' : manifestReady ? 'Manifest has already been written for the existing Jules orchestrator.' : 'Write a .jules/orchestrator manifest for this handoff.')}">
      Stage Jules Manifest
    </button>
    <button type="button" ${canLaunch ? '' : 'disabled'} data-task-action="launch-jules" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(canLaunch ? 'Launch this manifest through the existing Jules orchestrator.' : 'Stage a manifest and pass the GitHub sync gate before launching Jules.')}">
      Launch Jules
    </button>
    <button type="button" ${handoff.runId ? '' : 'disabled'} data-task-action="refresh-jules" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(handoff.runId ? 'Refresh this Jules run from the existing orchestrator records.' : 'Stage or launch a Jules run before refreshing status.')}">
      Refresh Jules Status
    </button>
    <button type="button" ${handoff.julesSessionId ? '' : 'disabled'} data-task-action="send-jules-message" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(handoff.julesSessionId ? 'Send this note to the tracked Jules session.' : 'Jules session id is required before a message can be sent.')}">
      Send Jules Note
    </button>
    <button type="button" ${handoff.julesSessionId && handoff.julesState === 'AWAITING_PLAN_APPROVAL' ? '' : 'disabled'} data-task-action="approve-jules-plan" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(handoff.julesSessionId && handoff.julesState === 'AWAITING_PLAN_APPROVAL' ? 'Approve the plan currently waiting in Jules.' : 'This is only enabled when Jules reports AWAITING_PLAN_APPROVAL.')}">
      Approve Jules Plan
    </button>
    <button type="button" ${handoff.githubPullRequestUrl ? '' : 'disabled'} data-task-action="refresh-pr" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(handoff.githubPullRequestUrl ? observed ? 'Refresh GitHub PR state, checks, comments, and Scout conflicts for this watched PR.' : 'Refresh GitHub PR state and checks for this Jules handoff.' : 'Jules has not reported a PR URL yet.')}">
      ${observed ? 'Refresh Observed PR' : 'Refresh PR Checks'}
    </button>
    <button type="button" ${observed && handoff.githubPullRequestUrl ? '' : 'disabled'} data-task-action="create-observed-follow-up" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(observed ? 'Create a separate dashboard draft from this observed PR evidence without repairing or commenting on the old PR.' : 'Follow-up drafts are only available for read-only observed PR records.')}">
      Create Follow-up Draft
    </button>
    <button type="button" ${handoff.githubPullRequestUrl ? '' : 'disabled'}
      data-task-action="record-task-nudge"
      data-subject-id="${escapeAttribute(handoff.id)}"
      data-subject-kind="handoff"
      data-nudge-action="refresh"
      data-nudge-phase="github_pr"
      data-pause-seconds="300"
      data-nudge-note="${escapeAttribute(observed ? 'Schedule a read-only observed PR evidence refresh; do not repair this historical PR.' : 'Schedule a read-only GitHub PR refresh after checks or review may have changed.')}">
      ${observed ? 'Schedule Observed PR Refresh' : 'Schedule PR Refresh'}
    </button>
    <button type="button" ${handoff.githubPullRequestUrl && !observed ? '' : 'disabled'} data-task-action="refresh-local-sync" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(observed ? 'Observed PRs are read-only learning records; local sync belongs to a dashboard-started merged handoff.' : handoff.githubPullRequestUrl ? 'Check whether local master can safely fast-forward after the Jules PR merges.' : 'Jules has not reported a PR URL yet.')}">
      Check Local Sync
    </button>
    <button type="button" ${handoff.localSyncStatus?.safeToPull ? '' : 'disabled'} data-task-action="sync-local" data-handoff-id="${escapeAttribute(handoff.id)}" title="${escapeAttribute(handoff.localSyncStatus?.safeToPull ? 'Run the guarded fast-forward pull for local master.' : 'Local sync must be safe before this action is enabled.')}">
      Sync Local Master
    </button>
  </li>`;
}

function renderTaskNavigator(drafts = [], handoffs = []) {
  const handoffByDraftId = new Map(
    handoffs
      .filter(handoff => handoff?.draftId)
      .map(handoff => [handoff.draftId, handoff]),
  );
  const records = [
    ...drafts.map(draft => buildTaskNavigatorRecord('draft', draft, { handoffByDraftId })),
    ...handoffs.map(handoff => buildTaskNavigatorRecord('handoff', handoff)),
  ].sort((a, b) => {
    const priority = { needs_input: 0, open: 1, completed: 2, archived: 3 };
    const priorityDelta = (priority[a.bucket] ?? 9) - (priority[b.bucket] ?? 9);
    if (priorityDelta !== 0) return priorityDelta;

    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });

  if (!records.length) {
    return `<section class="task-navigator empty" aria-label="Task navigator">
      <div>
        <h3>Task navigator</h3>
        <p class="usage-summary">No local Symphony tasks are recorded yet.</p>
      </div>
    </section>`;
  }

  const pendingInput = records.filter(record => record.bucket === 'needs_input').length;
  const open = records.filter(record => record.bucket === 'open' || record.bucket === 'needs_input').length;
  const completed = records.filter(record => record.bucket === 'completed').length;
  const archived = records.filter(record => record.bucket === 'archived').length;
  const activeFilter = normalizeTaskNavigatorFilter(taskNavigatorFilter);
  const visibleRecords = records.filter(record => taskNavigatorRecordMatchesFilter(record, activeFilter));
  const filters = [
    { id: 'all', label: 'All tasks', count: records.length },
    { id: 'needs_input', label: 'Needs input', count: pendingInput },
    { id: 'open', label: 'Open', count: open },
    { id: 'completed', label: 'Completed', count: completed },
    { id: 'archived', label: 'Archived', count: archived },
  ];

  // The navigator is deliberately derived from the same draft/handoff cards
  // rendered below. It is a map, not a second task store, so the dashboard does
  // not split truth between "summary task" state and detailed receipt state.
  return `<section class="task-navigator" aria-label="Task navigator">
    <div class="task-navigator-header">
      <div>
        <h3>Task navigator</h3>
        <p class="usage-summary">Jump to the task record that needs attention before reading the full receipt stack.</p>
      </div>
      <div class="task-navigator-counts">
        <span class="badge">All tasks: ${escapeHtml(String(records.length))}</span>
        <span class="badge pending-human-input">Needs input: ${escapeHtml(String(pendingInput))}</span>
        <span class="badge running">Open: ${escapeHtml(String(open))}</span>
        <span class="badge">Completed: ${escapeHtml(String(completed))}</span>
        ${archived ? `<span class="badge">Archived: ${escapeHtml(String(archived))}</span>` : ''}
      </div>
    </div>
    <div class="task-navigator-filters" role="toolbar" aria-label="Task navigator filters">
      ${filters.map(filter => `<button type="button"
        data-task-filter="${escapeAttribute(filter.id)}"
        aria-pressed="${filter.id === activeFilter ? 'true' : 'false'}">
        ${escapeHtml(filter.label)} (${escapeHtml(String(filter.count))})
      </button>`).join('')}
    </div>
    <p class="usage-summary">Filter: ${escapeHtml(taskNavigatorFilterLabel(activeFilter))}</p>
    ${renderTaskDetailPreview(visibleRecords[0])}
    <ol>
      ${visibleRecords.length ? visibleRecords.map(record => `<li class="${escapeAttribute(record.bucket)}" data-task-record-kind="${escapeAttribute(record.kind)}">
        <a href="#${escapeAttribute(record.anchor)}">${escapeHtml(record.title)}</a>
        <span class="badge ${escapeAttribute(record.badgeClass)}">${escapeHtml(record.statusLabel)}</span>
        <small>${escapeHtml(record.kind === 'draft' ? 'Draft' : 'Handoff')} · ${escapeHtml(record.updatedAt ? formatTimestamp(record.updatedAt) : 'no timestamp')}</small>
        <p>${escapeHtml(record.summary)}</p>
      </li>`).join('') : `<li class="empty" data-task-record-kind="empty">
        <p>No tasks match this filter.</p>
      </li>`}
    </ol>
  </section>`;
}

function renderTaskDetailPreview(record) {
  if (!record) return '';

  const links = [
    record.taskPageUrl ? `<a href="${escapeAttribute(record.taskPageUrl)}">Task page</a>` : '',
    record.taskDetailUrl ? `<a href="${escapeAttribute(record.taskDetailUrl)}">Task detail JSON</a>` : '',
    record.linearIssueUrl ? `<a href="${escapeAttribute(record.linearIssueUrl)}">Linear issue</a>` : '',
    record.julesSessionUrl ? `<a href="${escapeAttribute(record.julesSessionUrl)}">Jules session</a>` : '',
    record.githubPullRequestUrl ? `<a href="${escapeAttribute(record.githubPullRequestUrl)}">GitHub PR</a>` : '',
  ].filter(Boolean).join(' ');
  const timelineCount = Number(record.timelineEventCount || 0);
  const expectedFiles = Number(record.expectedFileCount || 0);
  const verificationCommands = Number(record.verificationCommandCount || 0);
  const taskMessages = Number(record.taskMessageCount || 0);
  const disposition = record.taskDisposition?.state || 'active';
  const taskMessageUrl = record.taskDetailUrl
    ? `${record.taskDetailUrl.replace(/\/$/, '')}/messages`
    : '';

  // This is the first single-task detail slice. It is intentionally read-only
  // and compact: the full receipt card still owns the deep controls below, while
  // this preview lets the operator understand the selected task before jumping.
  return `<details class="task-detail-preview" ${record.needsInput ? 'open' : ''} aria-label="Task detail" data-task-detail-preview="${escapeAttribute(record.id)}">
    <summary>
      <span>
        <span class="badge ${escapeAttribute(record.badgeClass)}">${escapeHtml(record.statusLabel)}</span>
        <strong>Task detail</strong>
      </span>
      <small>${escapeHtml(record.needsInput ? 'Open because this task needs input.' : 'Closed to keep the dashboard scan-first.')}</small>
    </summary>
    <h4>${escapeHtml(record.title)}</h4>
    <p>${escapeHtml(record.summary)}</p>
    <dl>
      <div><dt>Kind</dt><dd>${escapeHtml(record.kind === 'draft' ? 'Draft' : 'Handoff')}</dd></div>
      <div><dt>Current boundary</dt><dd>${escapeHtml(record.currentBoundary || record.statusLabel || 'Unknown')}</dd></div>
      <div><dt>Updated</dt><dd>${escapeHtml(record.updatedAt ? formatTimestamp(record.updatedAt) : 'No timestamp')}</dd></div>
      <div><dt>Timeline events</dt><dd>${escapeHtml(`Timeline events: ${timelineCount}`)}</dd></div>
      <div><dt>Task messages</dt><dd>${escapeHtml(String(taskMessages))}</dd></div>
      <div><dt>Task filing</dt><dd>${escapeHtml(disposition)}</dd></div>
      <div><dt>Expected files</dt><dd>${escapeHtml(String(expectedFiles))}</dd></div>
      <div><dt>Verification commands</dt><dd>${escapeHtml(String(verificationCommands))}</dd></div>
    </dl>
    ${record.needsInput ? '<p class="usage-summary"><strong>Needs human input</strong></p>' : ''}
    ${links ? `<p class="task-detail-links">${links}</p>` : ''}
    <label>Task message author
      <select data-task-message-author>
        <option value="operator">Operator</option>
        <option value="codex_foreman">Codex foreman</option>
      </select>
    </label>
    <label>Task message
      <textarea rows="2" data-task-message-body placeholder="Record a local note for this task. This does not send feedback to Jules."></textarea>
    </label>
    <button type="button"
      data-task-action="record-task-message"
      data-task-id="${escapeAttribute(record.id)}"
      data-task-message-url="${escapeAttribute(taskMessageUrl)}">
      Record Task Message
    </button>
    <p><a href="#${escapeAttribute(record.anchor)}">Open full receipt</a></p>
  </details>`;
}

function taskNavigatorRecordMatchesFilter(record, filter) {
  if (filter === 'all') return true;
  if (filter === 'open') return record.bucket === 'open' || record.bucket === 'needs_input';
  return record.bucket === filter;
}

function taskNavigatorFilterLabel(filter) {
  const labels = {
    all: 'All tasks',
    needs_input: 'Needs input',
    open: 'Open',
    completed: 'Completed',
    archived: 'Archived',
  };
  return labels[filter] || labels.all;
}

function renderOperatorPreferences(preferences = {}) {
  const quiet = preferences.quietHours || {};
  const enabled = quiet.enabled !== false;
  const timeZone = quiet.timeZone || 'Europe/Amsterdam';
  const startHour = Number.isFinite(Number(quiet.startHour)) ? Number(quiet.startHour) : 1;
  const endHour = Number.isFinite(Number(quiet.endHour)) ? Number(quiet.endHour) : 9;
  const weekdaysOnly = quiet.weekdaysOnly !== false;

  // This card makes the human-blocker waiting policy visible and editable. The
  // resulting preference is still just local Symphony state; it does not notify
  // the operator or cross any Jules/GitHub/Linear/Git boundary by itself.
  return `<details class="handoff-readiness operator-preferences" data-operator-preferences-card>
    <summary>Operator Preferences</summary>
    <p class="usage-summary">Control when Symphony should quietly wait instead of repeatedly checking for a human answer.</p>
    <div class="form-grid">
      <label>
        <input type="checkbox" data-operator-preference="quietHours.enabled" ${enabled ? 'checked' : ''}>
        Quiet hours enabled
      </label>
      <label>Time zone
        <input type="text" data-operator-preference="quietHours.timeZone" value="${escapeAttribute(timeZone)}" placeholder="Europe/Amsterdam">
      </label>
      <label>Start hour
        <input type="number" min="0" max="23" step="1" data-operator-preference="quietHours.startHour" value="${escapeAttribute(String(startHour))}">
      </label>
      <label>End hour
        <input type="number" min="0" max="23" step="1" data-operator-preference="quietHours.endHour" value="${escapeAttribute(String(endHour))}">
      </label>
      <label>
        <input type="checkbox" data-operator-preference="quietHours.weekdaysOnly" ${weekdaysOnly ? 'checked' : ''}>
        Weekdays only
      </label>
    </div>
    <button type="button" data-task-action="record-operator-preferences">Record Operator Preferences</button>
    <p class="usage-summary">Current quiet-hours rule: ${escapeHtml(enabled ? `${weekdaysOnly ? 'weekday' : 'daily'} ${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00 ${timeZone}` : 'disabled')}.</p>
  </details>`;
}

function buildTaskNavigatorRecord(kind, item, context = {}) {
  const title = item.title || item.id || 'Untitled Symphony task';
  const id = item.id || title;
  const updatedAt = item.updatedAt || item.createdAt || null;

  if (kind === 'draft') {
    const waitingOnLinear = !item.linearIssueIdentifier && item.next_action?.code === 'create_linear_issue';
    const promotedHandoff = context.handoffByDraftId?.get?.(id) || null;
    const summary = item.next_action?.summary || item.body || 'Draft is waiting for the next Symphony gate.';
    const disposition = item.taskDisposition?.state || 'active';
    const disposed = disposition !== 'active' || Boolean(promotedHandoff);
    const promotedSummary = promotedHandoff
      ? `Promoted to handoff ${promotedHandoff.id}; the live handoff now owns the next action.`
      : null;

    return {
      kind,
      id,
      title,
      updatedAt,
      anchor: `task-draft-${id}`,
      bucket: disposition === 'completed' ? 'completed' : disposed ? 'archived' : 'open',
      badgeClass: disposed ? 'approval' : waitingOnLinear ? 'approval' : 'running',
      statusLabel: promotedHandoff ? 'promoted' : disposed ? disposition : waitingOnLinear ? 'open draft' : 'open',
      summary: promotedSummary || (disposed && item.taskDisposition?.reason ? item.taskDisposition.reason : summary),
      currentBoundary: item.next_action?.label || item.status || 'Draft',
      expectedFileCount: Array.isArray(item.expectedFiles) ? item.expectedFiles.length : 0,
      verificationCommandCount: Array.isArray(item.verificationCommands) ? item.verificationCommands.length : 0,
      timelineEventCount: 0,
      taskMessageCount: Array.isArray(item.taskMessages) ? item.taskMessages.length : 0,
      taskDisposition: item.taskDisposition || null,
      needsInput: false,
      taskDetailUrl: item.links?.taskDetail || `/api/v1/tasks/${encodeURIComponent(id)}`,
      taskPageUrl: item.links?.page || `/tasks/${encodeURIComponent(id)}`,
      linearIssueUrl: item.linearIssueUrl || null,
    };
  }

  const disposition = item.taskDisposition?.state || 'active';
  const operatorQuestion = item.operatorQuestion || null;
  const latestAnswer = Array.isArray(item.operatorAnswers) ? item.operatorAnswers[0] : null;
  const scoutBoundary = taskNavigatorScoutBoundary(item.scout_core_readiness);
  const operatorQuestionAnswered = Boolean(latestAnswer)
    && (!operatorQuestion?.plainLanguageQuestion || latestAnswer.sourceQuestion === operatorQuestion.plainLanguageQuestion)
    && (!operatorQuestion?.sourceStage || latestAnswer.sourceStage === operatorQuestion.sourceStage);
  // A task can keep its old question for audit history after an answer is
  // recorded. The navigator should only count it as "needs input" when the
  // current question is still unanswered; otherwise the dashboard sends the
  // foreman back to a decision that has already been filed.
  const needsInput = Boolean(operatorQuestion && !operatorQuestionAnswered);
  const merged = item.githubPullRequestState === 'MERGED';
  const closed = item.githubPullRequestState === 'CLOSED' || item.status === 'observed_pr';
  const bucket = disposition === 'completed'
    ? 'completed'
    : disposition === 'archived' || disposition === 'abandoned'
      ? 'archived'
      : needsInput
    ? 'needs_input'
    : merged
      ? 'completed'
      : closed
        ? 'archived'
        : 'open';
  const statusLabel = disposition !== 'active'
    ? disposition
    : needsInput
    ? 'needs operator input'
    : scoutBoundary
      ? scoutBoundary.statusLabel
    : merged
      ? 'completed'
      : closed
        ? 'archived'
        : item.next_action?.label || item.julesState || item.status || 'open';
  const summary = disposition !== 'active' && item.taskDisposition?.reason
    ? item.taskDisposition.reason
    : needsInput
    ? item.operatorQuestion?.plainLanguageSummary || item.operatorQuestion?.plainLanguageQuestion || 'This handoff needs an operator answer.'
    : scoutBoundary
      ? scoutBoundary.summary
    : item.next_action?.summary || item.julesStateReconciliation?.summary || 'Handoff is waiting for the next proof boundary.';

  return {
    kind,
    id,
    title,
    updatedAt,
    anchor: `task-handoff-${id}`,
    bucket,
    badgeClass: disposition !== 'active' ? 'approval' : needsInput ? 'pending-human-input' : merged ? 'running' : closed ? 'approval' : 'running',
    statusLabel,
    summary,
    currentBoundary: scoutBoundary?.currentBoundary || item.next_action?.label || item.julesState || item.githubPullRequestState || item.status || 'Handoff',
    expectedFileCount: Array.isArray(item.expectedFiles) ? item.expectedFiles.length : 0,
    verificationCommandCount: Array.isArray(item.verificationCommands) ? item.verificationCommands.length : 0,
    timelineEventCount: Array.isArray(item.handoffTimeline?.events) ? item.handoffTimeline.events.length : 0,
    taskMessageCount: Array.isArray(item.taskMessages) ? item.taskMessages.length : 0,
    taskDisposition: item.taskDisposition || null,
    needsInput,
    taskDetailUrl: item.links?.taskDetail || `/api/v1/tasks/${encodeURIComponent(id)}`,
    taskPageUrl: item.links?.page || `/tasks/${encodeURIComponent(id)}`,
    linearIssueUrl: item.linearIssueUrl || null,
    julesSessionUrl: item.julesSessionUrl || null,
    githubPullRequestUrl: item.githubPullRequestUrl || null,
  };
}

function taskNavigatorScoutBoundary(readiness) {
  if (!readiness || !['blocked_by_scout', 'ready_for_core', 'waiting_for_checks_rerun', 'merged'].includes(readiness.status)) {
    return null;
  }

  const firstBlocker = Array.isArray(readiness.blockers) ? readiness.blockers.find(Boolean) : null;
  const summary = firstBlocker || readiness.expectedNextProof || readiness.nextAction?.summary || 'Scout/Core review owns the next proof boundary.';

  // The navigator is the first scan surface a human sees. When the richer
  // Scout/Core packet already proves this handoff is in review, prefer that
  // packet over an older PR next-action label so stale check data cannot send
  // the operator back to the wrong phase.
  if (readiness.status === 'blocked_by_scout') {
    return {
      statusLabel: 'Scout/Core review',
      currentBoundary: 'Scout/Core review',
      summary,
    };
  }

  if (readiness.status === 'ready_for_core') {
    return {
      statusLabel: 'Core validation ready',
      currentBoundary: 'Core merge',
      summary,
    };
  }

  if (readiness.status === 'waiting_for_checks_rerun') {
    return {
      statusLabel: 'Wait for check rerun',
      currentBoundary: 'GitHub PR',
      summary,
    };
  }

  return {
    statusLabel: 'Check local sync',
    currentBoundary: 'Local sync',
    summary,
  };
}

function renderOperatorQuestion(question, handoffId, answers = []) {
  if (!question) return '';
  const isPushApproval = question.sourceStage === 'repair_push_approval';
  const actionLabel = isPushApproval ? 'Push decision' : 'Repair lane';
  const actionOptions = isPushApproval
    ? `<option value="approve_repair_push">Approve repair push</option>
        <option value="reject_repair_push">Reject repair push</option>
        <option value="wait_for_manual_repair">Wait for manual repair</option>
        <option value="other">Other</option>`
    : `<option value="create_setup_repair_task">Create setup repair task</option>
        <option value="send_jules_feedback">Send Jules feedback</option>
        <option value="wait_for_manual_repair">Wait for manual repair</option>
        <option value="refresh_after_repair">Refresh after repair</option>
        <option value="other">Other</option>`;
  const answerRows = Array.isArray(answers) && answers.length
    ? `<ul class="risk-reasons">${answers.map(answer => `<li>
        <strong>${escapeHtml(answer.selectedAction || 'operator answer')}</strong>
        <span>${escapeHtml(formatTimestamp(answer.answeredAt))}</span>
        <p>${escapeHtml(answer.answer || '')}</p>
      </li>`).join('')}</ul>`
    : '<p class="usage-summary">No operator answer has been recorded yet.</p>';

  // Operator questions turn a blocked technical packet into a single human
  // decision. Quiet-hours details are shown here so a foreman can stop waiting
  // noisily when the user is unlikely to answer.
  return `<details class="handoff-readiness operator-question pending-human-input" open>
    <summary>Needs your input</summary>
    <p><strong>${escapeHtml(question.plainLanguageQuestion || 'Symphony needs a decision before continuing.')}</strong></p>
    <p>${escapeHtml(question.plainLanguageSummary || '')}</p>
    <ul>
      ${readinessItem('Requested proof', question.requestedAction || 'Operator decision', true)}
      ${readinessItem('Can notify now', question.canNotifyNow ? 'Yes' : 'No', question.canNotifyNow, !question.canNotifyNow)}
      ${readinessItem('Quiet hours', question.quietHours?.appliesNow ? 'Active' : 'Not active', !question.quietHours?.appliesNow, question.quietHours?.appliesNow)}
      ${question.nextCheckAt ? readinessItem('Next check', formatTimestamp(question.nextCheckAt), true) : ''}
    </ul>
    <p class="usage-summary">${escapeHtml(question.quietHours?.summary || 'No quiet-hours guidance recorded.')}</p>
    <label>${escapeHtml(actionLabel)}
      <select data-operator-answer="selectedAction">
        ${actionOptions}
      </select>
    </label>
    <label>Operator answer
      <textarea rows="2" data-operator-answer="answer" placeholder="Plain-language decision for this blocker"></textarea>
    </label>
    <button type="button" data-task-action="record-operator-answer" data-handoff-id="${escapeAttribute(handoffId || question.handoffId || '')}">Record Operator Answer</button>
    ${isPushApproval ? '' : `<button type="button" ${answers.length ? '' : 'disabled'} data-task-action="execute-repair-lane" data-handoff-id="${escapeAttribute(handoffId || question.handoffId || '')}">Execute Selected Repair Lane</button>`}
    <strong>Recorded answers</strong>
    ${answerRows}
  </details>`;
}

function renderHandoffTimeline(timeline) {
  if (!timeline || !Array.isArray(timeline.events) || !timeline.events.length) return '';

  // The task timeline is the compact, chronological version of the handoff.
  // It does not replace the detailed panels below; it gives the operator and
  // future Codex foremen a fast answer to "what happened, in what order?"
  return `<details class="handoff-readiness handoff-timeline" open>
    <summary>Task timeline</summary>
    <p>${escapeHtml(timeline.summary || 'Timeline evidence recorded for this handoff.')}</p>
    <ol>
      ${timeline.events.map(event => `<li class="timeline-event ${escapeAttribute(event.status || 'recorded')}">
        <strong>${escapeHtml(event.label || event.stage || 'Timeline event')}</strong>
        <span>${escapeHtml(formatTimestamp(event.occurredAt))}</span>
        <em>${escapeHtml(event.source || 'symphony')}</em>
        <p>${escapeHtml(event.detail || '')}</p>
        ${event.url ? `<a href="${escapeAttribute(event.url)}">Open evidence</a>` : ''}
      </li>`).join('')}
    </ol>
    <p><strong>Next expected proof:</strong> ${escapeHtml(timeline.nextExpectedProof || 'Not recorded')}</p>
  </details>`;
}

function renderJulesStateReconciliation(reconciliation) {
  if (!reconciliation) return '';

  // This panel explains why Symphony may trust Jules API or GitHub evidence
  // over an older local Jules record. It is a read-only interpretation packet:
  // the refresh endpoints gather evidence, and this view tells the operator
  // which source settled or failed to settle the mismatch.
  return `<details class="handoff-readiness jules-state-reconciliation" open>
    <summary>Jules state reconciliation</summary>
    <p>${escapeHtml(reconciliation.summary || 'Jules state reconciliation has no summary yet.')}</p>
    <ul>
      ${readinessItem('Status', reconciliation.status || 'unknown', reconciliation.status === 'consistent' || reconciliation.status === 'reconciled_from_external_evidence', reconciliation.status === 'needs_browser_reconciliation')}
      ${readinessItem('Stored state incomplete', reconciliation.localStoredStateIncomplete ? 'Yes' : 'No', !reconciliation.localStoredStateIncomplete, reconciliation.localStoredStateIncomplete)}
      ${readinessItem('Needs browser check', reconciliation.requiresBrowserCheck ? 'Yes' : 'No', !reconciliation.requiresBrowserCheck, reconciliation.requiresBrowserCheck)}
      ${readinessItem('Mutates external systems', reconciliation.mutatesExternalSystems ? 'Yes' : 'No', !reconciliation.mutatesExternalSystems, reconciliation.mutatesExternalSystems)}
      ${readinessItem('Mutates local files', reconciliation.mutatesLocalFiles ? 'Yes' : 'No', !reconciliation.mutatesLocalFiles, reconciliation.mutatesLocalFiles)}
    </ul>
    <p><strong>Jules state:</strong> ${escapeHtml(reconciliation.storedJulesState || 'not recorded')}</p>
    <p><strong>Discovery source:</strong> ${escapeHtml(reconciliation.discoverySource || 'none')}</p>
    <p><strong>Matched by:</strong> ${escapeHtml(Array.isArray(reconciliation.matchedBy) && reconciliation.matchedBy.length ? reconciliation.matchedBy.join(', ') : 'not matched')}</p>
    ${reconciliation.sessionUrl ? `<p><strong>Session:</strong> <a href="${escapeAttribute(reconciliation.sessionUrl)}">${escapeHtml(reconciliation.sessionId || reconciliation.sessionUrl)}</a></p>` : ''}
    ${reconciliation.capturedPullRequestUrl ? `<p><strong>Captured PR:</strong> <a href="${escapeAttribute(reconciliation.capturedPullRequestUrl)}">${escapeHtml(reconciliation.capturedPullRequestUrl)}</a></p>` : ''}
    <p><strong>Next expected proof:</strong> ${escapeHtml(reconciliation.nextExpectedProof || 'Refresh Jules or GitHub evidence.')}</p>
  </details>`;
}

function renderRepairPushReadiness(readiness) {
  if (!readiness) return '';

  const changedFiles = Array.isArray(readiness.changedFiles) ? readiness.changedFiles : [];
  const verificationCommands = Array.isArray(readiness.verificationCommands) ? readiness.verificationCommands : [];
  const postPushFollowUp = readiness.postPushFollowUp || null;
  const postPushSequence = Array.isArray(postPushFollowUp?.expectedSequence) ? postPushFollowUp.expectedSequence : [];
  const defaultPushedAt = new Date().toISOString();

  // Repair push readiness is shown as a separate gate because the prepared
  // local commit is useful evidence, while the actual push still changes
  // GitHub and needs explicit operator approval. The post-push section names
  // the next read-only observations so the dashboard does not jump from "push"
  // straight to "merge" without check refresh and Scout/Core evidence.
  return `<details class="handoff-readiness repair-push-readiness" open>
    <summary>Repair push readiness</summary>
    <p>${escapeHtml(readiness.summary || 'A local repair commit is ready for operator review before push.')}</p>
    <ul>
      ${readinessItem('Status', readiness.status || 'awaiting_operator_push_approval', false, true)}
      ${readinessItem('Can push now', readiness.canPushNow ? 'Yes' : 'No', Boolean(readiness.canPushNow), !readiness.canPushNow)}
      ${readinessItem('Mutates GitHub if run', readiness.mutatesExternalSystemsIfRun ? 'Yes' : 'No', !readiness.mutatesExternalSystemsIfRun, readiness.mutatesExternalSystemsIfRun)}
      ${readinessItem('Mutates local files', readiness.mutatesLocalFiles ? 'Yes' : 'No', !readiness.mutatesLocalFiles, readiness.mutatesLocalFiles)}
      ${readinessItem('Freshness', readiness.freshnessStatus || 'unchecked', readiness.freshnessStatus === 'matches_current_pr_head', readiness.freshnessStatus === 'stale_pr_head')}
      ${readinessItem('Recorded', readiness.recordedAt ? formatTimestamp(readiness.recordedAt) : 'not recorded', Boolean(readiness.recordedAt), !readiness.recordedAt)}
    </ul>
    <p><strong>Branch:</strong> <code>${escapeHtml(readiness.branch || 'unknown')}</code></p>
    <p><strong>Commit:</strong> <code>${escapeHtml(readiness.commit || 'unknown')}</code></p>
    <p><strong>Repair base:</strong> <code>${escapeHtml(readiness.repairBaseCommit || 'unchecked')}</code></p>
    <p><strong>Current PR head:</strong> <code>${escapeHtml(readiness.targetPullRequestHeadCommit || 'unchecked')}</code></p>
    <p><strong>Worktree:</strong> <code>${escapeHtml(readiness.worktreePath || 'unknown')}</code></p>
    ${readiness.targetPullRequestUrl ? `<p><strong>PR:</strong> <a href="${escapeAttribute(readiness.targetPullRequestUrl)}">${escapeHtml(readiness.targetPullRequestUrl)}</a></p>` : ''}
    <p><strong>Push command:</strong> <code>${escapeHtml(readiness.pushCommand || '')}</code></p>
    <p class="usage-summary">${escapeHtml(readiness.freshnessSummary || 'Repair base freshness was not checked against the current PR head.')}</p>
    ${changedFiles.length ? `<strong>Changed files</strong><ul class="risk-reasons">${changedFiles.map(file => `<li><code>${escapeHtml(file)}</code></li>`).join('')}</ul>` : ''}
    ${verificationCommands.length ? `<strong>Local verification</strong><pre>${escapeHtml(verificationCommands.join('\n'))}</pre>` : ''}
    <p class="usage-summary">${escapeHtml(readiness.verificationSummary || '')}</p>
    ${postPushFollowUp ? `<div class="handoff-manifest">
      <strong>Post-push follow-up</strong>
      <p>${escapeHtml(postPushFollowUp.summary || 'Wait for GitHub checks, then refresh Symphony.')}</p>
      <ul>
        ${readinessItem('Mutates external systems', postPushFollowUp.mutatesExternalSystems ? 'Yes' : 'No', !postPushFollowUp.mutatesExternalSystems, postPushFollowUp.mutatesExternalSystems)}
        ${readinessItem('Mutates local files', postPushFollowUp.mutatesLocalFiles ? 'Yes' : 'No', !postPushFollowUp.mutatesLocalFiles, postPushFollowUp.mutatesLocalFiles)}
      </ul>
      ${postPushFollowUp.checksCommand ? `<p><strong>Check command:</strong> <code>${escapeHtml(postPushFollowUp.checksCommand)}</code></p>` : ''}
      ${postPushFollowUp.refreshEndpoint ? `<p><strong>Refresh endpoint:</strong> <code>${escapeHtml(postPushFollowUp.refreshEndpoint)}</code></p>` : ''}
      ${postPushSequence.length ? `<ol>${postPushSequence.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}
    </div>` : ''}
    <div class="handoff-manifest">
      <strong>Record Repair Push Result</strong>
      <p class="usage-summary">Use this only after the operator has pushed or attempted the repair outside Symphony. This records local evidence; it does not push, rerun checks, merge, pull, or edit files.</p>
      <label>Status
        <select data-repair-push-result="status">
          <option value="pushed">Pushed</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      <label>Pushed commit
        <input data-repair-push-result="pushedCommit" value="${escapeAttribute(readiness.commit || '')}" placeholder="Commit that was pushed" />
      </label>
      <label>PR head after push
        <input data-repair-push-result="targetPullRequestHeadCommit" value="${escapeAttribute(readiness.commit || '')}" placeholder="Observed PR head commit" />
      </label>
      <label>Pushed at
        <input data-repair-push-result="pushedAt" value="${escapeAttribute(defaultPushedAt)}" placeholder="ISO timestamp" />
      </label>
      <label>Evidence URL
        <input data-repair-push-result="evidenceUrl" value="${escapeAttribute(readiness.targetPullRequestUrl || '')}" placeholder="GitHub PR, push, or check URL" />
      </label>
      <label>Summary
        <textarea rows="2" data-repair-push-result="summary" placeholder="Plain-language result of the operator-owned push"></textarea>
      </label>
      <button type="button" data-task-action="record-repair-push-result" data-handoff-id="${escapeAttribute(readiness.handoffId || '')}">Record Repair Push Result</button>
    </div>
    <p><strong>Next expected proof:</strong> ${escapeHtml(readiness.nextExpectedProof || 'Operator-approved push, then refreshed GitHub checks.')}</p>
  </details>`;
}

function renderRepairPushResult(result) {
  if (!result) return '';

  // This panel is deliberately a receipt, not an action panel. It tells the
  // foreman that a human-approved push already happened and that the safe next
  // behavior is to watch GitHub checks and refresh Symphony state.
  return `<details class="handoff-readiness repair-push-result" open>
    <summary>Repair push result</summary>
    <p>${escapeHtml(result.summary || 'Repair push result was recorded locally.')}</p>
    <ul>
      ${readinessItem('Status', result.status || 'unknown', result.status === 'pushed', result.status === 'failed')}
      ${readinessItem('Next boundary', result.nextBoundary || 'github_checks_rerun', result.nextBoundary === 'github_checks_rerun', result.nextBoundary === 'repair_push_failed')}
      ${readinessItem('Mutates external systems', result.mutatesExternalSystems ? 'Yes' : 'No', !result.mutatesExternalSystems, result.mutatesExternalSystems)}
      ${readinessItem('Mutates local files', result.mutatesLocalFiles ? 'Yes' : 'No', !result.mutatesLocalFiles, result.mutatesLocalFiles)}
      ${readinessItem('Recorded', result.recordedAt ? formatTimestamp(result.recordedAt) : 'not recorded', Boolean(result.recordedAt), !result.recordedAt)}
    </ul>
    <p><strong>Pushed commit:</strong> <code>${escapeHtml(result.pushedCommit || 'unknown')}</code></p>
    <p><strong>Current PR head:</strong> <code>${escapeHtml(result.targetPullRequestHeadCommit || 'unknown')}</code></p>
    <p><strong>Pushed at:</strong> ${escapeHtml(result.pushedAt ? formatTimestamp(result.pushedAt) : 'unknown')}</p>
    ${result.evidenceUrl ? `<p><strong>Evidence:</strong> <a href="${escapeAttribute(result.evidenceUrl)}">${escapeHtml(result.evidenceUrl)}</a></p>` : ''}
    ${result.checksCommand ? `<p><strong>Check command:</strong> <code>${escapeHtml(result.checksCommand)}</code></p>` : ''}
    ${result.refreshEndpoint ? `<p><strong>Refresh endpoint:</strong> <code>${escapeHtml(result.refreshEndpoint)}</code></p>` : ''}
    <p><strong>Next expected proof:</strong> ${escapeHtml(result.nextExpectedProof || 'GitHub checks complete, then Symphony refreshes PR state.')}</p>
  </details>`;
}

function renderHandoffLifecycle(handoff) {
  const prMerged = handoff.githubPullRequestState === 'MERGED';
  const locallySynced = Boolean(handoff.lastLocalSyncAt || handoff.localSyncStatus?.upToDate);

  // The detailed panels below answer "why" and "what next"; this strip answers
  // the faster operator question, "where is this handoff in the Jules path?"
  // It reuses stored handoff facts rather than creating a second source of truth.
  const steps = [
    {
      label: 'Linear issue',
      done: Boolean(handoff.linearIssueIdentifier || handoff.linearIssueUrl || handoff.linearIssueId),
      detail: handoff.linearIssueIdentifier || 'not linked yet',
    },
    {
      label: 'Manifest',
      done: Boolean(handoff.manifestPath),
      detail: handoff.manifestPath ? 'staged' : 'not staged',
    },
    {
      label: 'Jules session',
      done: Boolean(handoff.julesSessionId || handoff.julesSessionUrl || handoff.julesState),
      detail: handoff.julesState || handoff.julesSessionId || 'not launched',
    },
    {
      label: 'Pull request',
      done: Boolean(handoff.githubPullRequestUrl),
      detail: prMerged ? 'merged' : handoff.githubPullRequestState || (handoff.githubPullRequestUrl ? 'captured' : 'waiting'),
    },
    {
      label: 'Local sync',
      done: locallySynced,
      detail: locallySynced ? 'Synced locally' : 'not synced yet',
    },
  ];

  return `<div class="handoff-lifecycle">
    <strong>Handoff lifecycle</strong>
    <ol>${steps.map(step => `<li class="${step.done ? 'done' : 'waiting'}">
      <span>${escapeHtml(step.label)}</span>
      <em>${escapeHtml(step.detail)}</em>
    </li>`).join('')}</ol>
  </div>`;
}

function renderLaunchGitHubReceipt(handoff) {
  const preflight = handoff.gitPreflight || {};
  const hasReceipt = Boolean(preflight.checkedAt || preflight.remoteCommit || handoff.launchedAt);
  if (!hasReceipt) return '';

  const remoteBranch = preflight.remoteBranch || 'origin/master';
  const remoteCommit = preflight.remoteCommit || 'unknown';
  const summary = preflight.summary || 'GitHub sync gate was checked for this Jules handoff.';

  // This receipt is the dashboard-visible proof that Jules was launched from a
  // known GitHub base. It complements the global sync gate by keeping the exact
  // branch, commit, gate time, and launch time attached to the handoff forever.
  return `<div class="handoff-readiness launch-receipt">
    <strong>Launch GitHub receipt</strong>
    <p>${escapeHtml(summary)}</p>
    <ul>
      ${readinessItem('GitHub base', `${remoteBranch} @ ${shortCommit(remoteCommit)}`, Boolean(preflight.ok), !preflight.ok)}
      ${readinessItem('Gate checked', preflight.checkedAt ? formatTimestamp(preflight.checkedAt) : 'not recorded', Boolean(preflight.checkedAt), !preflight.checkedAt)}
      ${readinessItem('Launched', handoff.launchedAt ? formatTimestamp(handoff.launchedAt) : 'not launched yet', Boolean(handoff.launchedAt), false)}
    </ul>
  </div>`;
}

function renderJulesLaunchReadiness(readiness) {
  if (!readiness) return '';

  const blockers = Array.isArray(readiness.blockers) ? readiness.blockers : [];
  const checklist = Array.isArray(readiness.safetyChecklist) ? readiness.safetyChecklist : [];

  // Launch readiness is the final read-only packet before the operator starts a
  // real Jules cloud session. It keeps the exact command, GitHub base, Linear
  // receipt, and expected post-launch proof beside the launch button.
  return `<div class="handoff-readiness launch-readiness">
    <strong>Launch readiness</strong>
    <p>Status: ${escapeHtml(readiness.status || 'unknown')}; can launch now: ${readiness.canLaunchNow ? 'yes' : 'no'}; mutates external systems if run: ${readiness.mutatesExternalSystemsIfRun ? 'yes' : 'no'}; mutates local files if run: ${readiness.mutatesLocalFilesIfRun ? 'yes' : 'no'}.</p>
    <ul>
      ${readinessItem('GitHub base', `${readiness.base?.branch || 'unknown'} @ ${shortCommit(readiness.base?.commit)}`, Boolean(readiness.base?.commit), false)}
      ${readinessItem('Linear issue', readiness.linearIssue?.identifier || 'not linked', Boolean(readiness.linearIssue?.identifier), false)}
      ${readinessItem('Manifest', readiness.manifestPath || 'not staged', Boolean(readiness.manifestPath), false)}
      ${readinessItem('Session receipt', readiness.sessionReceipt?.sessionId || 'not launched yet', Boolean(readiness.sessionReceipt?.sessionId), false)}
    </ul>
    ${readiness.launchCommand ? `<p><strong>Launch command:</strong> <code>${escapeHtml(readiness.launchCommand)}</code></p>` : ''}
    ${blockers.length ? `<ul class="gate-blockers">${blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    ${checklist.length ? `<details><summary>Launch safety checklist</summary><ol>${checklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></details>` : ''}
    <small>Expected next proof: ${escapeHtml(readiness.expectedNextProof || 'Capture the Jules session receipt after launch.')}</small>
  </div>`;
}

function renderBaseCommitDrift(handoff) {
  const drift = handoff.baseCommitDrift;
  if (!drift) return '';

  // This warning is the stale-manifest guard. A handoff may have been prepared
  // when origin/master pointed at one commit, then GitHub moved before the user
  // launched Jules. Re-staging rewrites both the manifest and prompt so Jules
  // starts from the commit the sync gate just verified.
  return `<div class="handoff-readiness base-drift-readiness">
    <strong>GitHub base moved</strong>
    <p>${escapeHtml(drift.summary || 'The prepared handoff is no longer based on the current GitHub commit.')}</p>
    <ul>
      ${readinessItem('Prepared base', `${drift.remoteBranch || 'origin/master'} @ ${shortCommit(drift.stagedRemoteCommit)}`, false, true)}
      ${readinessItem('Current GitHub base', `${drift.remoteBranch || 'origin/master'} @ ${shortCommit(drift.currentRemoteCommit)}`, true)}
      ${readinessItem('Required action', 'Stage Jules Manifest again before launch', false, true)}
    </ul>
  </div>`;
}

function buildHandoffOperatorPlan(handoff) {
  const observed = handoff.status === 'observed_pr';
  const hasManifest = Boolean(handoff.manifestPath);
  const hasSession = Boolean(handoff.julesSessionId || handoff.julesSessionUrl || handoff.julesState);
  const hasPr = Boolean(handoff.githubPullRequestUrl);
  const prMerged = handoff.githubPullRequestState === 'MERGED';
  const prBlocked = handoff.githubPullRequestState === 'CLOSED' || handoff.githubPullRequestMergeable === 'CONFLICTING' || handoff.githubPullRequestChecks?.conclusion === 'failing';

  // The handoff plan follows the real Jules flow: local prompt, local manifest,
  // cloud session, GitHub PR, then local fast-forward. Each branch points at the
  // next safest dashboard button instead of asking the user to infer it from
  // lower-level state fields.
  if (observed) {
    if (handoff.githubPullRequestState === 'CLOSED') {
      return {
        tone: 'waiting',
        title: 'Observed closed PR',
        summary: 'This watched PR is historical evidence, not active repair work. Keep it read-only and start a new bounded task if the lesson needs follow-up.',
        steps: [
          'Refresh Observed PR only to update evidence if GitHub comments changed.',
          'Review Scout conflict and external-review lanes for learning.',
          'Create a separate task draft for any new work instead of repairing this old PR.',
        ],
      };
    }

    if (!handoff.lastPullRequestRefreshAt) {
      return {
        tone: 'ready',
        title: 'Refresh the observed PR',
        summary: 'This card watches an existing GitHub PR without staging a manifest or launching Jules from this dashboard run.',
        steps: [
          'Click Refresh Observed PR.',
          'Review checks, comments, changed files, and Scout conflict lanes.',
          'Use the result for learning or bounded follow-up work.',
        ],
      };
    }

    if (handoff.githubPullRequestNextAction) {
      return {
        tone: handoff.githubPullRequestNextAction.tone || 'waiting',
        title: handoff.githubPullRequestNextAction.label || 'Review observed PR state',
        summary: handoff.githubPullRequestNextAction.summary || 'The watched PR has current GitHub evidence for review.',
        steps: Array.isArray(handoff.githubPullRequestNextAction.steps) && handoff.githubPullRequestNextAction.steps.length
          ? handoff.githubPullRequestNextAction.steps
          : ['Review the PR readiness panel.', 'Decide whether the evidence should become a new Jules task, local task, or documentation note.'],
      };
    }

    return {
      tone: prBlocked ? 'blocked' : prMerged ? 'ready' : 'waiting',
      title: prBlocked ? 'Observed PR needs attention' : prMerged ? 'Observed PR is merged' : 'Observe PR review state',
      summary: prBlocked
        ? 'GitHub reports a closed, conflicting, or failing watched PR state.'
        : 'The watched PR has current GitHub evidence; keep it read-only unless a new task is intentionally created.',
      steps: [
        'Review the PR readiness and comment routing panels.',
        'Refresh Observed PR after GitHub comments or checks change.',
        'Create a separate bounded task if this learning should become implementation work.',
      ],
    };
  }

  if (handoff.status === 'blocked_by_git_sync') {
    return {
      tone: 'blocked',
      title: 'Handoff paused by GitHub sync gate',
      summary: handoff.gitPreflight?.summary || 'GitHub sync must pass before this handoff can move.',
      steps: [
        'Clean or commit local work that Jules needs.',
        'Push the intended base to GitHub.',
        'Run Check GitHub Sync before staging or launching Jules.',
      ],
    };
  }

  if (handoff.status === 'base_commit_stale') {
    return {
      tone: 'blocked',
      title: 'Re-stage before launching Jules',
      summary: handoff.baseCommitDrift?.summary || 'GitHub moved after this handoff was prepared.',
      steps: [
        'Review the old and current GitHub base commits below.',
        'Click Stage Jules Manifest to refresh the prompt and manifest.',
        'Launch Jules only after the card returns to Manifest Ready.',
      ],
    };
  }

  if (!hasManifest) {
    return {
      tone: 'ready',
      title: 'Stage the Jules manifest',
      summary: 'The prompt exists locally, but the existing Jules orchestrator has not received a manifest yet.',
      steps: [
        'Review the prompt preview.',
        'Click Stage Jules Manifest.',
        'Confirm the recorded launch command points at the generated manifest.',
      ],
    };
  }

  if (handoff.status === 'launch_failed') {
    return {
      tone: 'blocked',
      title: 'Repair the Jules launch',
      summary: 'The manifest exists, but the Jules launch command failed.',
      steps: [
        'Open the launch error details.',
        'Fix the reported Jules or environment issue.',
        'Launch Jules again after the GitHub sync gate still passes.',
      ],
    };
  }

  if (!hasSession) {
    return {
      tone: 'ready',
      title: 'Launch Jules',
      summary: 'The manifest is ready. The next step starts the cloud Jules run.',
      steps: [
        'Click Launch Jules.',
        'Wait for the session id or Jules state to appear.',
        'Refresh Jules status if the session does not update automatically.',
      ],
    };
  }

  if (!hasPr) {
    return {
      tone: 'waiting',
      title: 'Watch Jules until a PR appears',
      summary: `Jules is tracked as ${handoff.julesState || 'running'}, but no PR URL has been captured yet.`,
      steps: [
        'Click Refresh Jules Status to read the latest orchestrator records.',
        'Use the session link if Jules needs plan approval or feedback.',
        'Wait for Symphony to capture a PR URL before checking GitHub status.',
      ],
    };
  }

  if (!handoff.lastPullRequestRefreshAt) {
    return {
      tone: 'ready',
      title: 'Refresh the GitHub PR',
      summary: 'A PR URL exists, but Symphony has not read checks, mergeability, or changed-file risk yet.',
      steps: [
        'Click Refresh PR Checks.',
        'Review mergeability, check status, and conflict-prone files.',
        'Only merge after the PR looks ready and expected.',
      ],
    };
  }

  if (prBlocked) {
    return {
      tone: 'blocked',
      title: 'Resolve PR blockers before merge',
      summary: 'GitHub reports a closed, conflicting, or failing PR state.',
      steps: [
        'Open the PR readiness panel.',
        'Inspect failed checks, conflicts, or risky changed files.',
        'Send follow-up work to Jules or handle the conflict before merging.',
      ],
    };
  }

  if (!prMerged) {
    return {
      tone: 'waiting',
      title: 'Bridge through Scout, then Core',
      summary: 'The PR is visible. Scout should inspect and bridge conflicts before Core validates or merges it.',
      steps: [
        'Refresh PR Checks so Scout sees current files, checks, and mergeability.',
        'Have Scout add arbitration comments for cross-PR or poison-file risk.',
        'Let Core validate and merge only after Scout marks the PR ready.',
        'Refresh PR Checks after merge so Symphony can unlock local sync.',
      ],
    };
  }

  if (!handoff.localSyncStatus) {
    return {
      tone: 'ready',
      title: 'Check local sync',
      summary: 'The PR is merged. Symphony needs one final local safety check before pulling.',
      steps: [
        'Click Check Local Sync.',
        'Confirm local master is clean, on master, and only behind GitHub.',
        'Use Sync Local Master only after the check says it is safe.',
      ],
    };
  }

  if (handoff.localSyncStatus.safeToPull) {
    return {
      tone: 'ready',
      title: 'Sync local master',
      summary: 'Local master can fast-forward from GitHub.',
      steps: [
        'Click Sync Local Master.',
        'Confirm the local sync output reports a successful fast-forward or pull.',
        'Start the next Jules task only after the local checkout is current.',
      ],
    };
  }

  if (handoff.localSyncStatus.upToDate) {
    return {
      tone: 'ready',
      title: 'Local checkout is current',
      summary: 'The merged Jules work is already present on local master.',
      steps: [
        'Review the local sync panel for the last check time.',
        'Use the dashboard to draft the next bounded Jules task.',
      ],
    };
  }

  return {
    tone: 'blocked',
    title: 'Local sync is blocked',
    summary: handoff.localSyncStatus.summary || 'Symphony found a local safety blocker.',
    steps: [
      'Read the local sync blockers.',
      'Clean, commit, or switch branches intentionally.',
      'Re-run Check Local Sync before pulling from GitHub.',
    ],
  };
}

function renderHandoffOperatorPlan(handoff) {
  const plan = buildHandoffOperatorPlan(handoff);
  return `<div class="operator-plan compact ${escapeAttribute(plan.tone)}">
    <div>
      <span class="badge ${plan.tone === 'blocked' ? 'approval' : plan.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(plan.tone)}</span>
      <strong>${escapeHtml(plan.title)}</strong>
    </div>
    <p>${escapeHtml(plan.summary)}</p>
    <ol>${plan.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
  </div>`;
}

function renderJulesReadiness(handoff) {
  if (!handoff.runId && !handoff.julesState && !handoff.githubPullRequestUrl) return '';

  const state = handoff.julesState || 'not launched';
  const hasPr = Boolean(handoff.githubPullRequestUrl);
  const completed = state === 'COMPLETED';
  const needsHuman = state === 'AWAITING_PLAN_APPROVAL' || state === 'AWAITING_USER_FEEDBACK';
  const failed = state === 'FAILED' || handoff.status === 'launch_failed' || handoff.status === 'status_refresh_failed';
  const protectedFiles = [
    'package-lock.json',
    'pnpm-lock.yaml',
    'tsconfig.tsbuildinfo',
    'tsconfig.node.tsbuildinfo',
    'dist',
  ];
  const items = [
    readinessItem('Jules session', handoff.julesSessionId ? `Tracked: ${handoff.julesSessionId}` : 'Not created yet', Boolean(handoff.julesSessionId)),
    readinessItem('Jules state', failed ? `Needs repair: ${state}` : needsHuman ? `Needs human input: ${state}` : state, completed || needsHuman || Boolean(handoff.julesSessionId), failed),
    readinessItem('Pull request', hasPr ? 'PR URL captured' : 'Waiting for Jules PR output', hasPr),
    readinessItem('Review command', handoff.reviewCommand ? 'Ready' : 'Waiting for manifest', Boolean(handoff.reviewCommand)),
    readinessItem('Local pull command', handoff.pullCommand ? 'Ready after review' : 'Waiting for session id', Boolean(handoff.pullCommand)),
  ].join('');

  // This panel is the local foreman checklist after Jules starts. It keeps PR,
  // review, pull, and poison-file awareness visible without requiring the user
  // to understand the lower-level Jules run records or GitHub workflow.
  return `<div class="handoff-readiness">
    <strong>Jules handoff readiness</strong>
    <ul>${items}</ul>
    <p><strong>Protected conflict-prone files:</strong> ${protectedFiles.map(item => `<code>${escapeHtml(item)}</code>`).join(', ')}</p>
  </div>`;
}

function renderJulesOperatorMessages(handoff) {
  const disabled = handoff.julesSessionId ? '' : 'disabled';
  const title = handoff.julesSessionId
    ? `Send feedback to Jules session ${handoff.julesSessionId}.`
    : 'Launch or refresh Jules before sending feedback.';
  const messages = Array.isArray(handoff.operatorMessages) ? handoff.operatorMessages : [];
  const recentMessages = messages.slice(0, 5);
  const messageList = recentMessages.length
    ? `<ul>${recentMessages.map(message => {
        const failed = message.status === 'failed';
        const output = message.error || message.output
          ? `<details><summary>${escapeHtml(failed ? 'Send error' : 'Send output')}</summary><pre>${escapeHtml(message.error || message.output || '')}</pre></details>`
          : '';
        return `<li class="${escapeAttribute(failed ? 'failed' : 'ok')}">
          <span>${escapeHtml(failed ? 'Failed' : 'Sent')} ${escapeHtml(formatTimestamp(message.createdAt))}</span>
          <em>${escapeHtml(message.body)}</em>
          ${output}
        </li>`;
      }).join('')}</ul>`
    : '<p>No operator notes sent to Jules yet.</p>';

  // This is the dashboard's feedback bridge into an existing Jules session. It
  // keeps the user out of terminal-only commands while preserving a visible
  // record of what was sent and whether the Jules API accepted it.
  return `<div class="handoff-readiness jules-message-panel">
    <strong>Operator notes to Jules</strong>
    <textarea ${disabled} data-jules-message rows="3" placeholder="${escapeAttribute(title)}"></textarea>
    <p class="usage-summary">${escapeHtml(title)}</p>
    ${messageList}
  </div>`;
}

function renderJulesPlanApprovals(handoff) {
  if (!handoff.julesSessionId && !handoff.planApprovals?.length) return '';

  const awaiting = handoff.julesState === 'AWAITING_PLAN_APPROVAL';
  const approvals = Array.isArray(handoff.planApprovals) ? handoff.planApprovals : [];
  const rows = [
    readinessItem('Jules state', handoff.julesState || 'Unknown', awaiting || Boolean(handoff.julesSessionId), false),
    readinessItem('Approve button', awaiting ? 'Enabled for current plan' : 'Disabled until Jules asks for plan approval', awaiting),
  ].join('');
  const approvalHistory = approvals.length
    ? `<ul>${approvals.slice(0, 5).map(approval => {
        const failed = approval.status === 'failed';
        const output = approval.error || approval.output
          ? `<details><summary>${escapeHtml(failed ? 'Approval error' : 'Approval output')}</summary><pre>${escapeHtml(approval.error || approval.output || '')}</pre></details>`
          : '';
        return `<li class="${escapeAttribute(failed ? 'failed' : 'ok')}">
          <span>${escapeHtml(failed ? 'Failed' : 'Approved')} ${escapeHtml(formatTimestamp(approval.createdAt))}</span>
          <em>${escapeHtml(approval.command || 'Jules approve command')}</em>
          ${output}
        </li>`;
      }).join('')}</ul>`
    : '<p>No Jules plan approvals recorded yet.</p>';

  // Plan approval is intentionally displayed separately from messages because
  // approving a Jules plan is a real workflow decision. The panel explains when
  // the button is enabled and records each approval attempt.
  return `<div class="handoff-readiness jules-approval-panel">
    <strong>Jules plan approval</strong>
    <p>Approve only when the Jules session is waiting on its plan. Ordinary feedback belongs in Operator notes.</p>
    <ul>${rows}</ul>
    ${approvalHistory}
  </div>`;
}

function readinessItem(label, detail, ok, failed = false) {
  const tone = failed ? 'failed' : ok ? 'ok' : 'waiting';
  return `<li class="${escapeAttribute(tone)}"><span>${escapeHtml(label)}</span><em>${escapeHtml(detail)}</em></li>`;
}

function renderPullRequestReadiness(handoff) {
  if (!handoff.githubPullRequestUrl && !handoff.githubPullRequestRefreshError) return '';

  const checks = handoff.githubPullRequestChecks;
  const fileSummary = handoff.githubPullRequestFiles;
  const checksLabel = checks
    ? `${checks.conclusion}: ${checks.passed}/${checks.total} passed, ${checks.failed} failed, ${checks.pending} pending`
    : 'Not refreshed yet';
  const mergeReady = handoff.githubPullRequestState === 'OPEN'
    && handoff.githubPullRequestIsDraft === false
    && handoff.githubPullRequestMergeable !== 'CONFLICTING'
    && checks?.conclusion === 'passing';
  const localSyncReady = handoff.githubPullRequestState === 'MERGED';
  const rows = [
    readinessItem('PR state', handoff.githubPullRequestState || 'Unknown', Boolean(handoff.githubPullRequestState), handoff.githubPullRequestState === 'CLOSED'),
    readinessItem('Draft', handoff.githubPullRequestIsDraft === null || handoff.githubPullRequestIsDraft === undefined ? 'Unknown' : handoff.githubPullRequestIsDraft ? 'Draft' : 'Ready for review', handoff.githubPullRequestIsDraft === false),
    readinessItem('Mergeable', handoff.githubPullRequestMergeable || 'Unknown', handoff.githubPullRequestMergeable && handoff.githubPullRequestMergeable !== 'CONFLICTING', handoff.githubPullRequestMergeable === 'CONFLICTING'),
    readinessItem('Checks', checksLabel, checks?.conclusion === 'passing', checks?.conclusion === 'failing'),
    readinessItem('Review decision', handoff.githubPullRequestReviewDecision || 'No review decision yet', handoff.githubPullRequestReviewDecision === 'APPROVED' || !handoff.githubPullRequestReviewDecision),
    readinessItem('Changed files', fileSummary ? `${fileSummary.total} files, ${fileSummary.additions}+ / ${fileSummary.deletions}-` : 'Not refreshed yet', Boolean(fileSummary), fileSummary?.risk === 'high'),
    readinessItem('Conflict risk', fileSummary ? fileSummary.risk : 'Unknown', fileSummary?.risk === 'low', fileSummary?.risk === 'high'),
    readinessItem('Merge readiness', mergeReady ? 'Looks merge-ready' : 'Not merge-ready yet', mergeReady),
    readinessItem('Local sync', localSyncReady ? `Run: ${handoff.localSyncCommand || 'git pull --ff-only origin master'}` : 'Wait until PR is merged', localSyncReady),
  ].join('');
  const riskReasons = fileSummary?.riskReasons?.length
    ? `<ul class="risk-reasons">${fileSummary.riskReasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`
    : '';
  const outOfScopeFiles = fileSummary?.outOfScopeFiles?.slice(0, 20) || [];
  const outOfScopeList = outOfScopeFiles.length
    ? `<details class="scope-violations" open>
        <summary>Files outside declared Jules scope</summary>
        <p>These files were not in the expected write scope captured before launch. Scout/Core should review them before merge or local sync.</p>
        <ul class="changed-file-list">${outOfScopeFiles.map(path => `<li class="high"><code>${escapeHtml(path)}</code><span>scope</span><em>Unexpected file</em></li>`).join('')}</ul>
      </details>`
    : '';
  const riskyFiles = fileSummary?.files?.filter(file => file.risk !== 'low').slice(0, 12) || [];
  const riskyFileList = riskyFiles.length
    ? `<details>
        <summary>Risky changed files</summary>
        <ul class="changed-file-list">${riskyFiles.map(file => {
          const detail = `${file.additions}+ / ${file.deletions}-`;
          return `<li class="${escapeAttribute(file.risk)}"><code>${escapeHtml(file.path)}</code><span>${escapeHtml(detail)}</span><em>${escapeHtml(file.reason || file.risk)}</em></li>`;
        }).join('')}</ul>
      </details>`
    : '';
  const checkArtifacts = renderPullRequestCheckArtifacts(checks);
  const checkBlockers = renderPullRequestCheckBlockers(checks);
  const feedbackSummary = renderPullRequestFeedbackSummary(handoff.githubPullRequestFeedback);
  const error = handoff.githubPullRequestRefreshError
    ? `<p class="pr-error">${escapeHtml(handoff.githubPullRequestRefreshError)}</p>`
    : '';
  const nextAction = renderPullRequestNextAction(handoff.githubPullRequestNextAction);
  const repairDecision = renderPullRequestRepairDecision(handoff.githubPullRequestRepairDecision);
  const lastRefresh = handoff.lastPullRequestRefreshAt
    ? `<small>Last PR refresh ${escapeHtml(formatTimestamp(handoff.lastPullRequestRefreshAt))}</small>`
    : '';

  // PR checks are the handoff from Jules cloud work back to GitHub and then
  // local master. This panel keeps that chain explicit: PR state, checks,
  // mergeability, and the command to sync local master after merge.
  return `<div class="handoff-readiness pr-readiness">
    <div><strong>GitHub PR readiness</strong>${lastRefresh}</div>
    <p><a href="${escapeAttribute(handoff.githubPullRequestUrl || '#')}">${escapeHtml(handoff.githubPullRequestUrl || 'PR URL unavailable')}</a></p>
    ${error}
    ${nextAction}
    ${repairDecision}
    <ul>${rows}</ul>
    ${riskReasons}
    ${checkBlockers}
    ${checkArtifacts}
    ${feedbackSummary}
    ${outOfScopeList}
    ${riskyFileList}
  </div>`;
}

function renderPullRequestRepairDecision(packet) {
  if (!packet || packet.status !== 'needs_operator_decision') return '';

  const evidence = Array.isArray(packet.evidence) && packet.evidence.length
    ? `<ul>${packet.evidence.slice(0, 8).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  const options = Array.isArray(packet.options) && packet.options.length
    ? `<ul>${packet.options.map(option => `<li>
        <strong>${escapeHtml(option.label || option.id || 'Repair option')}</strong>
        <span>${escapeHtml(option.description || '')}</span>
        <em>${escapeHtml(option.whenToUse || '')}</em>
        ${option.command ? `<code>${escapeHtml(option.command)}</code>` : ''}
        <small>Needs approval: ${option.requiresOperatorApproval ? 'yes' : 'unknown'} / external mutation if run: ${option.mutatesExternalSystemsIfRun ? 'yes' : 'no'} / local mutation if run: ${option.mutatesLocalFilesIfRun ? 'yes' : 'no'}</small>
      </li>`).join('')}</ul>`
    : '<p>No repair choices available yet.</p>';

  // This panel is the human-friendly fork after a failed PR check. It turns
  // "red checks" into an explicit routing decision without posting a PR comment,
  // changing workflow files, or touching the local checkout on its own.
  return `<details class="pr-repair-decision" open>
    <summary>Repair decision needed</summary>
    <p><strong>${escapeHtml(packet.question || 'Which repair lane should Symphony use?')}</strong></p>
    <p>${escapeHtml(packet.plainLanguageSummary || '')}</p>
    <p><em>${escapeHtml(packet.recommendedFirstStep || '')}</em></p>
    ${evidence}
    ${options}
    <p><small>Packet is read-only: external mutation ${packet.mutatesExternalSystems === false ? 'no' : 'unknown'}, local mutation ${packet.mutatesLocalFiles === false ? 'no' : 'unknown'}. Next proof: ${escapeHtml(packet.nextExpectedProof || '')}</small></p>
  </details>`;
}

function renderDelegationRoiLedger(ledger, handoffId) {
  if (!ledger) return '';

  const facts = ledger.measuredFacts || {};
  const tokens = facts.codexTokens || {};
  const foremanUsage = facts.taskScopedForemanUsage || {};
  const goalContextUsage = facts.goalContextForemanUsage || {};
  const estimate = ledger.estimatedAvoidedCodexWork || {};
  const signals = ledger.workflowValueSignals || {};
  const statusLabel = ledger.status === 'roi_unknown'
    ? 'ROI unknown'
    : ledger.status === 'candidate_savings'
      ? 'Candidate savings'
      : 'Not delegated';
  const factsRows = [
    readinessItem('Codex tokens', tokens.total === null || tokens.total === undefined ? `Missing (${tokens.source || 'unknown source'})` : `${tokens.total} total`, typeof tokens.total === 'number'),
    readinessItem('Codex runtime', facts.codexActiveRuntimeSeconds === null || facts.codexActiveRuntimeSeconds === undefined ? 'Missing' : `${facts.codexActiveRuntimeSeconds}s`, typeof facts.codexActiveRuntimeSeconds === 'number'),
    readinessItem('Task-scoped foreman tokens', foremanUsage.totalTokens === null || foremanUsage.totalTokens === undefined ? `Missing (${foremanUsage.source || 'unknown source'})` : `${foremanUsage.totalTokens} total`, typeof foremanUsage.totalTokens === 'number'),
    readinessItem('Task-scoped foreman turns', foremanUsage.foremanTurns === null || foremanUsage.foremanTurns === undefined ? 'Missing' : `${foremanUsage.foremanTurns}`, typeof foremanUsage.foremanTurns === 'number'),
    readinessItem('Task-scoped foreman receipts', String(foremanUsage.receiptCount ?? 0), true),
    readinessItem('Goal-context foreman tokens', goalContextUsage.totalTokens === null || goalContextUsage.totalTokens === undefined ? `Missing (${goalContextUsage.source || 'unknown source'})` : `${goalContextUsage.totalTokens} total`, typeof goalContextUsage.totalTokens === 'number'),
    readinessItem('Goal-context foreman receipts', String(goalContextUsage.receiptCount ?? 0), true),
    readinessItem('Foreman events', String(facts.codexForemanEventCount ?? 0), true),
    readinessItem('Jules elapsed', facts.julesElapsedSeconds === null || facts.julesElapsedSeconds === undefined ? 'Missing' : `${facts.julesElapsedSeconds}s`, typeof facts.julesElapsedSeconds === 'number'),
    readinessItem('GitHub elapsed', facts.githubElapsedSeconds === null || facts.githubElapsedSeconds === undefined ? 'Missing' : `${facts.githubElapsedSeconds}s`, typeof facts.githubElapsedSeconds === 'number'),
    readinessItem('Human interventions', String(facts.humanInterventionCount ?? 0), true),
  ].join('');
  const estimateRows = [
    readinessItem('Estimate status', estimate.status || 'missing_estimate', estimate.status === 'documented_estimate', estimate.status !== 'documented_estimate'),
    readinessItem('Local Codex turns avoided', estimate.estimatedLocalCodexImplementationTurns ?? 'Missing', typeof estimate.estimatedLocalCodexImplementationTurns === 'number'),
    readinessItem('Local Codex tokens avoided', estimate.estimatedLocalCodexTokens ?? 'Missing', typeof estimate.estimatedLocalCodexTokens === 'number'),
    readinessItem('Debugging cycles avoided', estimate.estimatedDebuggingCycles ?? 'Missing', typeof estimate.estimatedDebuggingCycles === 'number'),
    readinessItem('Confidence', estimate.confidence || 'missing', estimate.confidence && estimate.confidence !== 'missing', estimate.confidence === 'missing'),
  ].join('');
  const signalRows = [
    readinessItem('Delegated to Jules', signals.delegatedToJules ? 'Yes' : 'No', Boolean(signals.delegatedToJules), !signals.delegatedToJules),
    readinessItem('Jules produced PR', signals.julesProducedPullRequest ? 'Yes' : 'No', Boolean(signals.julesProducedPullRequest), !signals.julesProducedPullRequest),
    readinessItem('Scope stayed declared', signals.prStayedWithinDeclaredScope === null || signals.prStayedWithinDeclaredScope === undefined ? 'Unknown' : signals.prStayedWithinDeclaredScope ? 'Yes' : 'No', signals.prStayedWithinDeclaredScope === true, signals.prStayedWithinDeclaredScope === false),
    readinessItem('Local implementation avoided', signals.codexAvoidedLocalImplementation === null || signals.codexAvoidedLocalImplementation === undefined ? 'Unknown' : signals.codexAvoidedLocalImplementation ? 'Likely yes' : 'No', signals.codexAvoidedLocalImplementation === true),
    readinessItem('Stalled because', signals.stalledBecause || 'unknown', signals.stalledBecause === 'none', signals.stalledBecause && signals.stalledBecause !== 'none'),
  ].join('');
  const caveats = Array.isArray(estimate.caveats) && estimate.caveats.length
    ? `<ul class="risk-reasons">${estimate.caveats.map(caveat => `<li>${escapeHtml(caveat)}</li>`).join('')}</ul>`
    : '';
  const dataSources = Array.isArray(facts.dataSources) && facts.dataSources.length
    ? `<p class="usage-summary">Sources: ${facts.dataSources.map(source => escapeHtml(source)).join(', ')}</p>`
    : '';
  const estimateForm = handoffId
    ? `<details class="roi-estimate-form">
        <summary>Record avoided-work estimate</summary>
        <p class="usage-summary">This stores local counterfactual evidence only. It does not contact Jules, GitHub, Linear, or local Git.</p>
        <label>Local Codex turns avoided <input type="number" min="0" step="1" data-roi-estimate="turns" placeholder="optional"></label>
        <label>Local Codex tokens avoided <input type="number" min="0" step="1" data-roi-estimate="tokens" placeholder="optional"></label>
        <label>Debugging cycles avoided <input type="number" min="0" step="1" data-roi-estimate="cycles" placeholder="optional"></label>
        <label>Confidence
          <select data-roi-estimate="confidence">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>Estimate method <textarea rows="2" data-roi-estimate="method" placeholder="Example: compared against similar local Codex test-writing tasks"></textarea></label>
        <label>Caveats <textarea rows="2" data-roi-estimate="caveats" placeholder="One caveat per line"></textarea></label>
        <button type="button" data-task-action="record-roi-estimate" data-handoff-id="${escapeAttribute(handoffId)}">Record ROI Estimate</button>
      </details>`
    : '';
  const usageForm = handoffId
    ? `<details class="roi-estimate-form">
        <summary>Record task-scoped foreman usage</summary>
        <p class="usage-summary">This stores measured local Codex foreman usage for this task only. It does not contact Jules, GitHub, Linear, or local Git.</p>
        <label>Input tokens <input type="number" min="0" step="1" data-roi-foreman-usage="inputTokens" placeholder="optional"></label>
        <label>Output tokens <input type="number" min="0" step="1" data-roi-foreman-usage="outputTokens" placeholder="optional"></label>
        <label>Total tokens <input type="number" min="0" step="1" data-roi-foreman-usage="totalTokens" placeholder="optional"></label>
        <label>Active runtime seconds <input type="number" min="0" step="1" data-roi-foreman-usage="activeRuntimeSeconds" placeholder="optional"></label>
        <label>Foreman turns <input type="number" min="0" step="1" data-roi-foreman-usage="foremanTurns" placeholder="optional"></label>
        <label>Source
          <select data-roi-foreman-usage="source">
            <option value="manual_codex_receipt">Manual Codex receipt</option>
            <option value="codex_goal_context">Codex goal context</option>
            <option value="other_measured_source">Other measured source</option>
          </select>
        </label>
        <label>Notes <textarea rows="2" data-roi-foreman-usage="notes" placeholder="Where did this measured usage come from?"></textarea></label>
        <button type="button" data-task-action="record-roi-foreman-usage" data-handoff-id="${escapeAttribute(handoffId)}">Record Foreman Usage</button>
      </details>`
    : '';

  // The ROI panel is intentionally conservative: measured facts and estimates
  // are rendered in separate sections so Symphony can show useful delegation
  // evidence without overstating Codex usage savings.
  return `<details class="handoff-readiness delegation-roi-ledger" open>
    <summary>Delegation ROI ledger <span class="badge ${ledger.status === 'candidate_savings' ? 'running' : 'retrying'}">${escapeHtml(statusLabel)}</span></summary>
    <p>${escapeHtml(ledger.verdict || ledger.summary || 'Delegation ROI has not been calculated yet.')}</p>
    <div>
      <strong>Measured facts</strong>
      ${dataSources}
      <ul>${factsRows}</ul>
      ${usageForm}
    </div>
    <div>
      <strong>Estimated avoided Codex work</strong>
      <ul>${estimateRows}</ul>
      ${caveats}
      ${estimateForm}
    </div>
    <div>
      <strong>Workflow value signals</strong>
      <ul>${signalRows}</ul>
      ${signals.pullRequestUrl ? `<p><a href="${escapeAttribute(signals.pullRequestUrl)}" target="_blank" rel="noreferrer">${escapeHtml(signals.pullRequestUrl)}</a></p>` : ''}
    </div>
  </details>`;
}

function renderPullRequestFeedbackSummary(feedback) {
  if (!feedback || feedback.totalComments === 0) return '';

  const julesFeedback = Array.isArray(feedback.julesFeedback) ? feedback.julesFeedback : [];
  const scoutConflicts = Array.isArray(feedback.scoutConflictComments) ? feedback.scoutConflictComments : [];
  const externalComments = Array.isArray(feedback.externalReviewComments) ? feedback.externalReviewComments : [];
  const renderComment = comment => `<li>
    <strong>${escapeHtml(comment.author || 'unknown')}</strong>
    ${comment.url ? `<a href="${escapeAttribute(comment.url)}" target="_blank" rel="noreferrer">${escapeHtml(comment.source || 'comment')}</a>` : `<span>${escapeHtml(comment.source || 'comment')}</span>`}
    ${comment.createdAt ? `<small>${escapeHtml(formatTimestamp(comment.createdAt))}</small>` : ''}
    <em>${escapeHtml((comment.body || '').split(/\r?\n/)[0].slice(0, 160))}</em>
  </li>`;
  const renderScoutConflict = comment => `<li>
    <strong>${escapeHtml(comment.conflictFile || 'Unknown conflict file')}</strong>
    ${comment.priorityPullRequest ? `<span>overlaps PR #${escapeHtml(String(comment.priorityPullRequest))}</span>` : '<span>priority PR unknown</span>'}
    ${comment.url ? `<a href="${escapeAttribute(comment.url)}" target="_blank" rel="noreferrer">Scout comment</a>` : ''}
  </li>`;

  // PR comments from review agents are useful context, but they are not Jules
  // instructions unless the operator marks them with the explicit feedback tag.
  // The extra delivery note preserves a lesson from Package 3: a GitHub
  // comment can exist even when the active Jules session does not visibly show
  // the latest repair request, so the dashboard should not overstate proof.
  // Scout conflict comments stay visible in their own lane because they are
  // handoff blockers that the foreman needs to route before Core can merge.
  return `<details class="pr-feedback-summary" open>
    <summary>PR comment routing</summary>
    <p>${escapeHtml(feedback.summary || 'PR comments are available for review.')}</p>
    <p>Only explicitly marked feedback is treated as Jules course correction.</p>
    ${julesFeedback.length ? '<p class="muted">Marked feedback proves a GitHub PR comment exists. If the active Jules session does not visibly show the latest feedback, open the Jules session and send or confirm the same bounded repair request there before assuming a repair is underway.</p>' : ''}
    <div>
      <strong>Jules feedback comments</strong>
      ${julesFeedback.length ? `<ul>${julesFeedback.map(renderComment).join('')}</ul>` : '<p>No marked Jules feedback comments yet.</p>'}
    </div>
    <div>
      <strong>Scout conflict comments</strong>
      ${scoutConflicts.length ? `<ul>${scoutConflicts.slice(0, 12).map(renderScoutConflict).join('')}</ul>` : '<p>No Scout conflict comments captured.</p>'}
    </div>
    <div>
      <strong>External review comments</strong>
      ${externalComments.length ? `<ul>${externalComments.slice(0, 8).map(renderComment).join('')}</ul>` : '<p>No external review comments captured.</p>'}
    </div>
  </details>`;
}

function renderPullRequestCheckBlockers(checks) {
  const blockers = Array.isArray(checks?.blockers) ? checks.blockers : [];
  if (!blockers.length) return '';

  // Check blockers translate raw GitHub failures into foreman-level ownership
  // hints. They do not prove the root cause; they show the next safe evidence
  // step before the operator asks Jules, CI, or workflow config to repair it.
  return `<details class="check-blockers" open>
    <summary>Check blocker classification</summary>
    <ul>${blockers.map(blocker => {
      const evidence = Array.isArray(blocker.evidence) && blocker.evidence.length
        ? `<ul>${blocker.evidence.slice(0, 8).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';
      return `<li>
        <strong>${escapeHtml(blocker.category || 'unknown')}</strong>
        <span>${escapeHtml(blocker.summary || 'GitHub checks need review.')}</span>
        <em>${escapeHtml(blocker.nextAction || 'Inspect failed check logs before choosing a repair path.')}</em>
        ${evidence}
      </li>`;
    }).join('')}</ul>
  </details>`;
}

function renderPullRequestCheckArtifacts(checks) {
  const artifacts = Array.isArray(checks?.artifacts) ? checks.artifacts : [];
  if (!artifacts.length) return '';

  // CI artifacts are the machine-readable part of GitHub Actions feedback.
  // Showing them here lets Symphony foremen inspect the quality scan without
  // digging through raw workflow logs.
  return `<details class="check-artifacts" open>
    <summary>Check artifacts and summaries</summary>
    <ul>${artifacts.map(artifact => `<li>
      <strong>${escapeHtml(artifact.checkName || 'GitHub check')}</strong>
      <code>${escapeHtml(artifact.artifactName || 'artifact')}</code>
      <span>${escapeHtml(artifact.summary || 'Machine-readable CI artifact available from GitHub Actions.')}</span>
      ${artifact.detailsUrl ? `<a href="${escapeAttribute(artifact.detailsUrl)}" target="_blank" rel="noreferrer">Open check details</a>` : ''}
    </li>`).join('')}</ul>
    <p>Quality scan JSON artifact: quality-scan-json. GitHub step summary carries the grouped counts for human review.</p>
  </details>`;
}

function renderPullRequestNextAction(action) {
  if (!action) return '';

  const steps = Array.isArray(action.steps) && action.steps.length
    ? `<ol>${action.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  const command = action.command
    ? `<p><strong>Command:</strong> <code>${escapeHtml(action.command)}</code></p>`
    : '';
  const feedbackCommand = action.feedbackCommand
    ? `<p><strong>Jules PR feedback:</strong> <code>${escapeHtml(action.feedbackCommand)}</code></p>`
    : '';

  // The PR panel is where cloud Jules work returns to the local workflow.
  // Showing the next action here keeps the foreman lane explicit: wait for
  // checks, send Scout for risk, comment back to Jules, ask Core to validate,
  // or move to local sync.
  return `<div class="pr-next-action ${escapeAttribute(action.tone || 'waiting')}">
    <div>
      <span class="badge ${action.tone === 'blocked' ? 'approval' : action.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(action.code || 'pull_request')}</span>
      <strong>Next PR action: ${escapeHtml(action.label || 'Review pull request')}</strong>
    </div>
    <p>${escapeHtml(action.summary || '')}</p>
    ${command}
    ${feedbackCommand}
    ${steps}
  </div>`;
}

function renderScoutCoreReadiness(handoff) {
  if (!handoff.githubPullRequestUrl && !handoff.julesSessionId && !handoff.julesState) return '';

  if (handoff.scout_core_readiness) {
    const readiness = handoff.scout_core_readiness;
    const evidence = readiness.evidence || {};
    const rows = [
      readinessItem('Scout input', readiness.pr?.url ? 'PR URL captured' : 'Waiting for Jules PR', Boolean(readiness.pr?.url)),
      readinessItem('Scout freshness', readiness.pr?.lastRefreshAt ? `Refreshed ${formatTimestamp(readiness.pr.lastRefreshAt)}` : 'Refresh PR Checks first', Boolean(readiness.pr?.lastRefreshAt)),
      readinessItem('Check rerun', readiness.status === 'waiting_for_checks_rerun' ? 'Repair push recorded; wait for GitHub checks and refresh PR' : 'No repair-push wait recorded', readiness.status !== 'waiting_for_checks_rerun', readiness.status === 'waiting_for_checks_rerun'),
      readinessItem('Scout bridge', readiness.canScoutReviewNow ? `Ready; ${evidence.scoutConflictComments ?? 0} Scout conflict comment(s)` : 'Waiting for current PR data', readiness.canScoutReviewNow, readiness.status === 'blocked_by_scout'),
      readinessItem('Core validation', readiness.canCoreValidateNow ? 'Ready after Scout bridge' : readiness.status === 'merged' ? 'PR already merged' : 'Blocked until Scout bridge, checks, and mergeability are clear', readiness.canCoreValidateNow || readiness.status === 'merged'),
      readinessItem('Core merge', readiness.canCoreMergeNow ? `Use: ${readiness.coreMergeCommand || handoff.pullRequestMergeCommand || 'gh pr merge'}` : readiness.status === 'merged' ? 'Merge recorded by GitHub' : 'Not ready for merge', readiness.canCoreMergeNow || readiness.status === 'merged'),
      readinessItem('Local return', readiness.nextBoundary === 'local_sync' ? 'Check local sync next' : 'Wait until Core merge is complete', readiness.nextBoundary === 'local_sync'),
    ].join('');
    const blockers = readiness.blockers?.length
      ? `<ul class="risk-reasons">${readiness.blockers.map(blocker => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>`
      : '';
    const scoutCommand = readiness.scoutReviewCommand
      ? `<p><strong>Scout command:</strong> <code>${escapeHtml(readiness.scoutReviewCommand)}</code></p>`
      : '';
    const coreCommand = readiness.coreValidationCommand
      ? `<p><strong>Core validation:</strong> <code>${escapeHtml(readiness.coreValidationCommand)}</code></p>`
      : '';

    // The API packet is the single Scout/Core source of truth. Rendering it
    // here keeps the main dashboard aligned with /proof and prevents a second
    // local calculation from disagreeing about risky files, observed PRs, or
    // whether Core merge is allowed.
    return `<div class="handoff-readiness scout-core-readiness">
      <strong>Scout/Core review path <span class="badge ${escapeAttribute(readiness.status)}">${escapeHtml(readiness.status)}</span></strong>
      <p>${escapeHtml(readiness.expectedNextProof)}</p>
      <p class="usage-summary">Checks: ${escapeHtml(evidence.checksConclusion || 'unknown')}; file risk: ${escapeHtml(evidence.fileRisk || 'unknown')}; next boundary: ${escapeHtml(readiness.nextBoundary || 'github_pr')}</p>
      <ul>${rows}</ul>
      ${blockers}
      ${scoutCommand}
      ${coreCommand}
    </div>`;
  }

  const hasPr = Boolean(handoff.githubPullRequestUrl);
  const checks = handoff.githubPullRequestChecks;
  const files = handoff.githubPullRequestFiles;
  const hasRisk = files?.risk === 'medium' || files?.risk === 'high';
  const scoutCanBridge = hasPr && Boolean(handoff.lastPullRequestRefreshAt);
  const coreCanValidate = scoutCanBridge
    && handoff.githubPullRequestState === 'OPEN'
    && handoff.githubPullRequestIsDraft === false
    && handoff.githubPullRequestMergeable !== 'CONFLICTING'
    && checks?.conclusion === 'passing'
    && !hasRisk;
  const coreCanSync = handoff.githubPullRequestState === 'MERGED';
  const rows = [
    readinessItem('Scout input', hasPr ? 'PR URL captured' : 'Waiting for Jules PR', hasPr),
    readinessItem('Scout freshness', handoff.lastPullRequestRefreshAt ? `Refreshed ${formatTimestamp(handoff.lastPullRequestRefreshAt)}` : 'Refresh PR Checks first', Boolean(handoff.lastPullRequestRefreshAt)),
    readinessItem('Scout bridge', hasRisk ? 'Needs arbitration comments for risky files' : scoutCanBridge ? 'Ready to bridge or mark clear' : 'Waiting for current PR data', scoutCanBridge && !hasRisk, hasRisk),
    readinessItem('Core validation', coreCanValidate ? 'Ready after Scout bridge' : coreCanSync ? 'PR already merged' : 'Blocked until Scout bridge, checks, and mergeability are clear', coreCanValidate || coreCanSync),
    readinessItem('Core merge', coreCanValidate ? `Use: ${handoff.coreMergeCommand || handoff.pullRequestMergeCommand || 'gh pr merge'}` : coreCanSync ? 'Merge recorded by GitHub' : 'Not ready for merge', coreCanValidate || coreCanSync),
    readinessItem('Local return', coreCanSync ? 'Check local sync next' : 'Wait until Core merge is complete', coreCanSync),
  ].join('');
  const scoutCommand = handoff.scoutReviewCommand
    ? `<p><strong>Scout command:</strong> <code>${escapeHtml(handoff.scoutReviewCommand)}</code></p>`
    : '';
  const coreCommand = handoff.coreValidationCommand
    ? `<p><strong>Core validation:</strong> <code>${escapeHtml(handoff.coreValidationCommand)}</code></p>`
    : '';

  // This panel keeps Symphony aligned with the existing Aralia Jules roster:
  // Jules executes, Scout observes and bridges via comments, then Core validates
  // and merges. It prevents the dashboard from treating a merely green PR as a
  // complete local handoff.
  return `<div class="handoff-readiness scout-core-readiness">
    <strong>Scout/Core review path</strong>
    <p>Scout should inspect the PR and bridge conflicts before Core validates the merge. Local sync waits until GitHub reports the PR merged.</p>
    <ul>${rows}</ul>
    ${scoutCommand}
    ${coreCommand}
  </div>`;
}

function renderLocalSyncReadiness(handoff) {
  const status = handoff.localSyncStatus;
  if (!status && !handoff.localSyncOutput && !handoff.localSyncError) return '';

  const rows = status ? [
    readinessItem('Safe to pull', status.safeToPull ? 'Yes' : 'No', status.safeToPull, !status.safeToPull && !status.upToDate),
    readinessItem('Up to date', status.upToDate ? 'Yes' : 'No', status.upToDate),
    readinessItem('Branch', status.currentBranch || 'Unknown', status.currentBranch === status.baseBranch, status.currentBranch && status.currentBranch !== status.baseBranch),
    // Commit hashes are the receipt for the local return path. The operator can
    // see exactly which local checkout commit will fast-forward to which GitHub
    // commit before pressing the mutating sync button.
    readinessItem('Local commit', shortCommit(status.localCommit), Boolean(status.localCommit), !status.localCommit),
    readinessItem('GitHub commit', shortCommit(status.remoteCommit), Boolean(status.remoteCommit), !status.remoteCommit),
    readinessItem('Ahead / behind', `${status.ahead ?? '?'} / ${status.behind ?? '?'}`, status.safeToPull || status.upToDate, (status.ahead ?? 0) > 0),
    readinessItem('Dirty / untracked', `${status.dirtyFiles ?? '?'} / ${status.untrackedFiles ?? '?'}`, status.dirtyFiles === 0 && status.untrackedFiles === 0, (status.dirtyFiles ?? 0) > 0 || (status.untrackedFiles ?? 0) > 0),
  ].join('') : '';
  const blockers = status?.blockers?.length
    ? `<ul class="risk-reasons">${status.blockers.map(blocker => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>`
    : '';
  const nextAction = renderLocalSyncNextAction(status?.nextAction);
  // Blocked local sync should be actionable. Reuse the same remediation visual
  // language as the GitHub launch gate so the operator sees the exact next
  // steps before trying the mutating fast-forward pull.
  const remediation = status?.remediation?.length
    ? `<details class="sync-remediation" ${status.safeToPull || status.upToDate ? '' : 'open'}>
        <summary>How to unblock local sync</summary>
        <ol>${status.remediation.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
      </details>`
    : '';
  const output = handoff.localSyncError || handoff.localSyncOutput
    ? `<details>
        <summary>${escapeHtml(handoff.localSyncError ? 'Local sync error' : 'Local sync output')}</summary>
        <pre>${escapeHtml(handoff.localSyncError || handoff.localSyncOutput || '')}</pre>
      </details>`
    : '';
  const lastSync = handoff.lastLocalSyncAt
    ? `<small>Last local sync ${escapeHtml(formatTimestamp(handoff.lastLocalSyncAt))}</small>`
    : '';

  // This is the final bridge back from Jules/GitHub into the user's checkout.
  // It stays explicit about blockers so a fast-forward pull is never presented
  // as safe while local edits, local-only commits, or the wrong branch exist.
  return `<div class="handoff-readiness local-sync-readiness">
    <div><strong>Local sync readiness</strong>${lastSync}</div>
    <p>${escapeHtml(status?.summary || 'Local sync has not been checked yet.')}</p>
    ${blockers}
    ${nextAction}
    ${remediation}
    <ul>${rows}</ul>
    ${status?.pullCommand ? `<p><strong>Command:</strong> <code>${escapeHtml(status.pullCommand)}</code></p>` : ''}
    ${output}
  </div>`;
}

function renderDeploymentReadiness(readiness) {
  if (!readiness) return '';

  const blockers = Array.isArray(readiness.blockers) && readiness.blockers.length
    ? `<ul class="risk-reasons">${readiness.blockers.map(blocker => `<li>${escapeHtml(blocker)}</li>`).join('')}</ul>`
    : '';
  const commands = readiness.commands || {};
  const commandLines = [
    commands.latestPagesBuild ? `Latest Pages build: ${commands.latestPagesBuild}` : '',
    commands.recentDeployments ? `Recent deployments: ${commands.recentDeployments}` : '',
    commands.deploymentStatuses ? `Deployment statuses: ${commands.deploymentStatuses}` : '',
  ].filter(Boolean);
  const evidence = readiness.evidence
    ? `<div class="handoff-manifest">
        <p><strong>Recorded deployment evidence:</strong> ${escapeHtml(readiness.evidence.status || 'recorded')}</p>
        <p>${escapeHtml(readiness.evidence.summary || '')}</p>
        ${readiness.evidence.evidenceUrl ? `<p><a href="${escapeAttribute(readiness.evidence.evidenceUrl)}">${escapeHtml(readiness.evidence.evidenceUrl)}</a></p>` : ''}
      </div>`
    : '';

  // Deployment readiness lives between a merged PR and local sync. It gives the
  // operator read-only GitHub Pages/deployment checks before Symphony treats the
  // cloud work as safe to pull back into local master.
  return `<div class="handoff-readiness deployment-readiness">
    <strong>Deployment readiness</strong>
    <p>${escapeHtml(readiness.expectedNextProof || 'Check GitHub Pages deployment state before local sync.')}</p>
    <ul>
      ${readinessItem('Status', readiness.status || 'waiting', readiness.status === 'needs_check', readiness.status === 'waiting_for_merge')}
      ${readinessItem('Can refresh now', readiness.canRefreshNow ? 'Yes' : 'No', readiness.canRefreshNow, !readiness.canRefreshNow && readiness.status === 'needs_check')}
      ${readinessItem('Can proceed to local sync', readiness.canProceedToLocalSync ? 'Yes' : 'No', readiness.canProceedToLocalSync, !readiness.canProceedToLocalSync)}
      ${readinessItem('Mutates external systems', readiness.mutatesExternalSystemsIfRun ? 'Yes' : 'No', !readiness.mutatesExternalSystemsIfRun, readiness.mutatesExternalSystemsIfRun)}
      ${readinessItem('Mutates local files', readiness.mutatesLocalFilesIfRun ? 'Yes' : 'No', !readiness.mutatesLocalFilesIfRun, readiness.mutatesLocalFilesIfRun)}
    </ul>
    ${blockers}
    ${evidence}
    ${commandLines.length ? `<details><summary>Read-only deployment commands</summary><pre>${escapeHtml(commandLines.join('\n'))}</pre></details>` : ''}
    <label>Deployment result
      <select data-deployment-evidence="status">
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="waived">Waived by operator</option>
      </select>
    </label>
    <label>Evidence source
      <select data-deployment-evidence="source">
        <option value="github_pages_latest_build">GitHub Pages latest build</option>
        <option value="github_deployment_status">GitHub deployment status</option>
        <option value="operator_waiver">Operator waiver</option>
      </select>
    </label>
    <label>Evidence URL
      <input data-deployment-evidence="evidenceUrl" type="url" placeholder="https://github.com/.../deployments/..." value="${escapeAttribute(readiness.evidence?.evidenceUrl || '')}">
    </label>
    <label>Deployment summary
      <textarea rows="2" data-deployment-evidence="summary" placeholder="Plain-language deployment proof or waiver">${escapeHtml(readiness.evidence?.summary || '')}</textarea>
    </label>
    <button type="button" data-task-action="record-deployment-evidence" data-handoff-id="${escapeAttribute(readiness.handoffId || '')}">Record Deployment Evidence</button>
    <p class="usage-summary">${escapeHtml(readiness.safetyNote || '')}</p>
  </div>`;
}

function renderLocalSyncNextAction(action) {
  if (!action) return '';

  const steps = Array.isArray(action.steps) && action.steps.length
    ? `<ol>${action.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  const command = action.command
    ? `<p><strong>Command:</strong> <code>${escapeHtml(action.command)}</code></p>`
    : '';

  // The handoff card has a high-level next action, but local sync is the point
  // where Symphony may mutate the user's checkout. Render the local-sync
  // specific next action here so the fast-forward decision is explicit.
  return `<div class="local-sync-next-action ${escapeAttribute(action.tone || 'waiting')}">
    <div>
      <span class="badge ${action.tone === 'blocked' ? 'approval' : action.tone === 'ready' ? 'running' : 'retrying'}">${escapeHtml(action.code || 'local_sync')}</span>
      <strong>Next local sync action: ${escapeHtml(action.label || 'Review local sync')}</strong>
    </div>
    <p>${escapeHtml(action.summary || '')}</p>
    ${command}
    ${steps}
  </div>`;
}

function stat(label, value) {
  return `
    <div class="stat">
      <div>${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
    </div>`;
}

function renderUsageTracker(state, detailsById) {
  const snapshot = buildUsageSnapshot(state, detailsById);
  const shouldOpen = snapshot.bars.some(bar => ['warning', 'danger'].includes(bar.tone));

  // This tracker is intentionally a dashboard-only interpretation of values the
  // Codex app-server already emits. It does not enforce limits; it gives the
  // operator a quick "how much of the window is used?" read without digging
  // through raw rate-limit JSON or token update events.
  usageRoot.innerHTML = renderDashboardDensitySection({
    title: 'Usage Tracker',
    summary: snapshot.summary,
    meta: snapshot.sourceLabel,
    tone: shouldOpen ? 'urgent' : 'idle',
    open: shouldOpen,
    body: `<div class="usage-grid">${snapshot.bars.map(usageBar).join('')}</div>`,
  });
}

function renderDashboardDensitySection({ title, summary, meta = '', body, open = false, tone = 'idle', asCard = false }) {
  // The lower dashboard sections still carry important evidence, but idle
  // evidence should not compete with the current foreman boundary. This helper
  // turns those sections into summary-first drawers while allowing urgent states
  // to stay open and visually louder.
  const cardClass = asCard ? ' card' : '';
  const metaHtml = meta ? `<span class="usage-pill">${escapeHtml(meta)}</span>` : '';
  return `<details class="density-section ${escapeAttribute(tone)}${cardClass}" ${open ? 'open' : ''}>
    <summary>
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(summary)}</small>
      </span>
      ${metaHtml}
    </summary>
    <div class="density-section-body">${body}</div>
  </details>`;
}

function usageBar(bar) {
  const percent = clampPercent(bar.percent);

  return `<div class="usage-meter ${escapeAttribute(bar.tone)}">
    <div class="usage-meter-header">
      <strong>${escapeHtml(bar.label)}</strong>
      <span>${escapeHtml(formatPercent(percent))}</span>
    </div>
    <div class="usage-track" aria-label="${escapeAttribute(`${bar.label}: ${formatPercent(percent)}`)}">
      <div class="usage-fill" style="width: ${percent}%"></div>
    </div>
    <small>${escapeHtml(bar.detail)}</small>
  </div>`;
}

function buildUsageSnapshot(state, detailsById) {
  const rateLimits = state.rate_limits || findLatestRateLimit(detailsById);
  const tokenUsage = findLatestTokenUsage(detailsById);
  const bars = [];

  if (rateLimits?.primary) {
    bars.push({
      label: 'Primary window',
      percent: rateLimits.primary.usedPercent,
      detail: describeWindow(rateLimits.primary),
      tone: usageTone(rateLimits.primary.usedPercent),
    });
  }

  if (rateLimits?.secondary) {
    bars.push({
      label: 'Weekly window',
      percent: rateLimits.secondary.usedPercent,
      detail: describeWindow(rateLimits.secondary),
      tone: usageTone(rateLimits.secondary.usedPercent),
    });
  }

  if (tokenUsage?.contextPercent !== null && tokenUsage?.contextPercent !== undefined) {
    bars.push({
      label: 'Model context',
      percent: tokenUsage.contextPercent,
      detail: `${formatNumber(tokenUsage.totalTokens)} / ${formatNumber(tokenUsage.contextWindow)} tokens in latest context window`,
      tone: usageTone(tokenUsage.contextPercent),
    });
  }

  if (!bars.length) {
    bars.push({
      label: 'Waiting for Codex usage data',
      percent: 0,
      detail: 'No rate-limit event has been retained yet for the active worker.',
      tone: 'quiet',
    });
  }

  return {
    bars,
    sourceLabel: rateLimits ? 'live Codex limits' : tokenUsage ? 'token events only' : 'no live limits yet',
    summary: rateLimits
      ? [
          `Plan: ${rateLimits.planType || 'unknown'}`,
          formatCreditSummary(rateLimits.credits),
          rateLimits.rateLimitReachedType ? `limit reached: ${rateLimits.rateLimitReachedType}` : null,
        ].filter(Boolean).join('; ')
      : `Total runtime tokens: ${formatNumber(state.codex_totals?.total_tokens || 0)}`,
  };
}

function formatCreditSummary(credits) {
  if (!credits || typeof credits !== 'object') return null;

  const used = credits.usedUsd ?? credits.used_usd ?? credits.used ?? credits.consumedUsd ?? credits.consumed_usd;
  const remaining = credits.remainingUsd ?? credits.remaining_usd ?? credits.remaining ?? credits.balanceUsd ?? credits.balance_usd;
  const usedText = formatMoney(used);
  const remainingText = formatMoney(remaining);

  // Codex usage events have changed shape over time. Show whichever spend
  // fields are present, but do not invent currency data when the event only
  // reports rate-limit percentages.
  if (usedText && remainingText) return `credits: ${usedText} used / ${remainingText} remaining`;
  if (usedText) return `credits: ${usedText} used`;
  if (remainingText) return `credits: ${remainingText} remaining`;
  return null;
}

function formatMoney(value) {
  const amount = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN;

  if (!Number.isFinite(amount)) return null;
  return `$${amount.toFixed(2)}`;
}

function findLatestRateLimit(detailsById) {
  const entry = latestActivityEntry(detailsById, entry => entry.source_type === 'rateLimits');
  if (!entry?.detail) return null;

  return parseReadableRateLimit(entry.detail);
}

function findLatestTokenUsage(detailsById) {
  const entry = latestActivityEntry(detailsById, entry => entry.source_type === 'tokenUsage');
  if (!entry?.detail) return null;

  return parseReadableTokenUsage(entry.detail);
}

function latestActivityEntry(detailsById, predicate) {
  return Object.values(detailsById)
    .flatMap(details => Array.isArray(details?.activity) ? details.activity : [])
    .filter(predicate)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0] || null;
}

function parseReadableRateLimit(detail) {
  const primary = Number(detail.match(/Primary window used:\s*(\d+(?:\.\d+)?)%/i)?.[1]);
  const secondary = Number(detail.match(/Weekly window used:\s*(\d+(?:\.\d+)?)%/i)?.[1]);
  const planType = detail.match(/Plan:\s*([^\n]+)/i)?.[1]?.trim() || null;
  const creditsUsed = parseMoney(detail.match(/Credits used:\s*\$?([\d,]+(?:\.\d+)?)/i)?.[1]);
  const creditsRemaining = parseMoney(detail.match(/Credits remaining:\s*\$?([\d,]+(?:\.\d+)?)/i)?.[1]);

  return {
    planType,
    primary: Number.isFinite(primary) ? { usedPercent: primary } : null,
    secondary: Number.isFinite(secondary) ? { usedPercent: secondary } : null,
    // This parser is the fallback path when the server-level rate_limits
    // snapshot is missing but per-worker activity still has retained readable
    // usage text. Preserve credit fields there too so the spending summary does
    // not disappear after a refresh that only has activity history.
    credits: {
      usedUsd: creditsUsed,
      remainingUsd: creditsRemaining,
    },
    rateLimitReachedType: null,
  };
}

function parseMoney(value) {
  if (!value) return null;
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseReadableTokenUsage(detail) {
  const totalTokens = parseNumber(detail.match(/Total tokens:\s*([\d,]+)/i)?.[1]);
  const contextWindow = parseNumber(detail.match(/context window:\s*([\d,]+)/i)?.[1]);
  const contextPercent = contextWindow ? (totalTokens / contextWindow) * 100 : null;

  return {
    totalTokens,
    contextWindow,
    contextPercent,
  };
}

function describeWindow(window) {
  const reset = window?.resetsAt
    ? `resets ${formatResetTime(window.resetsAt)}`
    : 'reset time unavailable';
  const duration = window?.windowDurationMins
    ? `${window.windowDurationMins} minute window`
    : 'window size unavailable';

  return `${duration}; ${reset}`;
}

function usageTone(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'good';
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '0';
}

function parseNumber(value) {
  if (!value) return 0;
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatResetTime(epochSeconds) {
  const date = new Date(Number(epochSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return 'at unknown time';
  return date.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

function renderRunning(running, detailsById) {
  const rows = running.length
    ? running.map(issue => {
      const workerLabel = issue.worker_designation || issue.worker?.designation || 'unassigned';
      const badge = issue.waiting_on_approval
        ? '<span class="badge approval">approval needed</span>'
        : '<span class="badge running">running</span>';
      const statusText = issue.waiting_on_approval
        ? issue.approval_summary || 'Waiting for approval'
        : issue.state;

      const latest = readableIssueActivity(issue, detailsById[issue.issue_identifier]);

      return `<tr>
        <td><a href="${escapeAttribute(issue.detail_url)}">${escapeHtml(issue.issue_identifier)}</a></td>
        <td><code>${escapeHtml(workerLabel)}</code></td>
        <td>${badge} ${escapeHtml(statusText)}</td>
        <td>${escapeHtml(issue.turn_count)}</td>
        <td>${escapeHtml(issue.tokens.input_tokens)} / ${escapeHtml(issue.tokens.output_tokens)}</td>
        <td>${escapeHtml(latest.label)}<br><small>${escapeHtml(latest.sentAtLabel)}</small></td>
        <td><code>${escapeHtml(issue.workspace_path || 'not created yet')}</code></td>
        <td class="message">${escapeHtml(latest.detail)}${latest.timestamp ? `<br><small>Sent ${escapeHtml(formatTimestamp(latest.timestamp))}</small>` : ''}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="8">No running issues</td></tr>';

  const summary = running.length
    ? `${running.length} worker${running.length === 1 ? '' : 's'} currently running.`
    : 'No running issues.';

  runningRoot.innerHTML = renderDashboardDensitySection({
    title: 'Running Issues',
    summary,
    tone: running.length ? 'active' : 'idle',
    open: running.length > 0,
    body: `
    <p class="usage-summary">Workers are Symphony foremen: they should coordinate Jules handoffs, PR checks, and local sync unless the operator explicitly asks for local-only coding.</p>
    <table>
      <thead>
        <tr>
          <th>Issue</th>
          <th>Worker</th>
          <th>State</th>
          <th>Turn</th>
          <th>Tokens (In / Out)</th>
          <th>Last Event</th>
          <th>Workspace</th>
          <th>Last Message</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

function renderRetrying(retrying) {
  const rows = retrying.length
    ? retrying.map(issue => `<tr>
        <td><a href="${escapeAttribute(issue.detail_url)}">${escapeHtml(issue.issue_identifier)}</a></td>
        <td><code>${escapeHtml(issue.worker_designation || issue.worker?.designation || 'previous worker unknown')}</code></td>
        <td><span class="badge retrying">retrying</span> ${escapeHtml(issue.attempt)}</td>
        <td>${escapeHtml(issue.due_at)}</td>
        <td>${escapeHtml(issue.last_event || 'none')}</td>
        <td class="message">${escapeHtml(issue.error || 'normal continuation retry')}</td>
      </tr>`).join('')
    : '<tr><td colspan="6">No issues in retry queue</td></tr>';

  const summary = retrying.length
    ? `${retrying.length} issue${retrying.length === 1 ? '' : 's'} waiting for retry.`
    : 'No issues in retry queue.';

  retryingRoot.innerHTML = renderDashboardDensitySection({
    title: 'Retrying Issues',
    summary,
    tone: retrying.length ? 'urgent' : 'idle',
    open: retrying.length > 0,
    body: `
    <table>
      <thead>
        <tr>
          <th>Issue</th>
          <th>Worker</th>
          <th>Attempt</th>
          <th>Due At</th>
          <th>Last Event</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`,
  });
}

function renderApprovals(activeIds, detailsById, state) {
  const approvalPanels = activeIds
    .map(identifier => approvalPanel(identifier, detailsById[identifier]))
    .filter(Boolean)
    .join('');

  approvalRoot.innerHTML = approvalPanels || renderDashboardDensitySection({
    title: 'Routine Approval Rules',
    summary: 'No pending approvals.',
    meta: 'approval policy',
    tone: 'idle',
    asCard: true,
    body: approvalPolicyPanel(state),
  });
}

function approvalPolicyPanel(state) {
  const policy = state?.codex_policy || {};
  const tools = Array.isArray(policy.auto_approve_app_tools)
    ? policy.auto_approve_app_tools
    : [];
  const modelLabel = formatWorkerModelAssignment(policy);
  const autoList = tools.length
    ? `<ul>${tools.map(tool => `<li><code>${escapeHtml(tool)}</code><span>${escapeHtml(describeAutoApprovedTool(tool))}</span></li>`).join('')}</ul>`
    : '<p>No app tools are auto-approved.</p>';

  // This idle approval card answers the operator's "what will ask me?" question
  // before a worker is already blocked. Routine Linear status comments can be
  // auto-approved by workflow policy, while commands, file changes, permission
  // changes, and unlisted app tools still use the normal Codex approval path.
  return `<div class="approval-panel approval-policy-panel">
    <h2><span class="badge running">approval policy</span>Routine Approval Rules</h2>
    <p><strong>Worker model:</strong> <code>${escapeHtml(modelLabel)}</code></p>
    <p><strong>Codex policy:</strong> ${escapeHtml(policy.approval_policy || 'unknown')}</p>
    <p>Routine foreman status comments listed here should not interrupt the worker. Anything broader still needs an explicit approval surface.</p>
    ${autoList}
  </div>`;
}

function describeAutoApprovedTool(tool) {
  // The policy comes from WORKFLOW.md as an app-tool identifier because Codex
  // needs the exact machine name. The dashboard is for the operator, so known
  // routine foreman actions get a plain-language safety boundary beside the raw
  // identifier.
  if (tool === 'linear.save_comment' || tool === 'linear_save_comment') {
    return 'Status comments on the assigned Linear issue; broader Linear changes still need approval.';
  }

  return 'Routine workflow-listed app tool; unlisted tools still need approval.';
}

function approvalPanel(identifier, details) {
  if (!details?.waiting_on_approval) return '';

  const activity = Array.isArray(details.activity) ? details.activity : [];
  const approvalIndex = activity.findLastIndex(entry => entry?.kind === 'approval' && entry?.status === 'waiting');
  const approvalEntry = approvalIndex >= 0 ? activity[approvalIndex] : null;
  const actionEntry = approvalIndex >= 0
    ? activity.slice(0, approvalIndex).reverse().find(entry => {
      return entry?.status === 'inProgress' && ['tool_call', 'command', 'file_change'].includes(entry?.kind);
    })
    : activity.slice().reverse().find(entry => entry?.status === 'inProgress');

  const actionTitle = actionEntry?.title || details.approval_summary || approvalEntry?.title || 'Waiting for approval';
  const pending = details.pending_approval;
  const actionDetail = pending?.detail || actionEntry?.detail || approvalEntry?.detail || 'The worker paused before completing this action.';
  const actionKind = actionEntry?.kind || 'approval';
  const workerLabel = details.worker_designation || details.worker?.designation || 'worker unknown';
  const requestedAt = pending?.requested_at
    ? `<p><strong>Requested:</strong> ${escapeHtml(formatTimestamp(pending.requested_at))}</p>`
    : '';
  const actionControls = pending?.can_respond
    ? `<div class="approval-actions" data-issue="${escapeAttribute(identifier)}">
        <button type="button" data-decision="approve">Approve</button>
        <button type="button" data-decision="deny">Deny</button>
      </div>`
    : '<p class="approval-note">Symphony can explain this request, but this approval method is view-only until a safe response mapping is added.</p>';

  return `<div class="card approval-panel">
    <h2><span class="badge approval">approval needed</span><a href="/api/v1/${encodeURIComponent(identifier)}/activity">${escapeHtml(identifier)}</a></h2>
    <p><strong>Worker:</strong> <code>${escapeHtml(workerLabel)}</code></p>
    <p><strong>Pending action:</strong> ${escapeHtml(actionTitle)}</p>
    <p><strong>Action type:</strong> ${escapeHtml(actionKind)}</p>
    ${requestedAt}
    ${actionControls}
    <pre class="approval-detail">${escapeHtml(actionDetail)}</pre>
  </div>`;
}

function renderActivity(activeIds, detailsById) {
  activityRoot.innerHTML = activeIds.map(identifier => {
    const details = detailsById[identifier];
    if (!details?.activity?.length) return '';

    const workerHtml = renderWorkerIdentity(details);
    const filesHtml = (details.workspace?.recent_files ?? []).slice(0, 8).length
      ? `<h3>Recent Files</h3><ul class="file-feed">${
        details.workspace.recent_files.slice(0, 8).map(file => {
          return `<li><code>${escapeHtml(file.path)}</code> <small>${escapeHtml(file.modified_at)}</small></li>`;
        }).join('')
      }</ul>`
      : '';

    const readableEntries = buildReadableActivity(details.activity);
    const entries = readableEntries.length
      ? readableEntries.map(entry => {
        const status = entry.status
          ? `<span class="activity-status">${escapeHtml(entry.status)}</span>`
          : '';
        const detail = entry.detail
          ? `<pre>${escapeHtml(entry.detail)}</pre>`
          : '';

        return `<li class="activity-item ${escapeAttribute(entry.tone)}">
        <div>
          <span class="activity-kind">${escapeHtml(entry.label)}</span>
          <strong>${escapeHtml(entry.title)}</strong>
          ${status}
          <small>${escapeHtml(formatTimestamp(entry.timestamp))}</small>
        </div>
        ${detail}
      </li>`;
      }).join('')
      : '<li class="activity-item quiet">No readable worker activity yet.</li>';

    return `<div class="card">
      <h2>Activity: <a href="/api/v1/${encodeURIComponent(identifier)}/activity">${escapeHtml(identifier)}</a></h2>
      ${workerHtml}
      ${filesHtml}
      <ol class="activity-feed">${entries}</ol>
    </div>`;
  }).join('');
}

function renderWorkerIdentity(details) {
  const worker = details?.worker || {};
  const designation = details?.worker_designation || worker.designation;
  if (!designation) return '';

  const facts = [];
  const issue = details?.issue_identifier;
  const workspace = details?.workspace?.path;
  const approval = details?.waiting_on_approval
    ? details?.approval_summary || 'Waiting for operator approval'
    : null;

  // The activity card is where the operator reads what happened, so it also
  // needs the stable foreman callsign. That prevents multiple workers from
  // blending together when several Linear/Jules tasks are running at once. The
  // issue, workspace, and approval note preserve the same orientation even when
  // the operator starts from the activity feed instead of the roster table.
  if (issue) facts.push(`Issue ${issue}`);
  if (worker.run_number !== undefined && worker.run_number !== null) facts.push(`Run #${worker.run_number}`);
  if (worker.attempt !== undefined && worker.attempt !== null) facts.push(`Attempt ${worker.attempt}`);
  if (worker.thread_id) facts.push(`Thread ${worker.thread_id}`);
  if (worker.model || worker.reasoning_effort || details?.model || details?.reasoning_effort) {
    facts.push(`Model ${formatWorkerModelAssignment(worker.model || worker.reasoning_effort ? worker : details)}`);
  }
  if (workspace) facts.push(`Workspace ${workspace}`);
  if (worker.started_at) facts.push(`Started ${formatTimestamp(worker.started_at)}`);
  if (approval) facts.push(`Approval needed: ${approval}`);

  const factHtml = facts.length
    ? `<span>${facts.map(fact => escapeHtml(fact)).join('</span><span>')}</span>`
    : '<span>Symphony-assigned worker identity</span>';

  return `<div class="worker-identity">
    <strong>Foreman:</strong> <code>${escapeHtml(designation)}</code>
    <div>${factHtml}</div>
  </div>`;
}

function formatWorkerModelAssignment(source) {
  // Symphony may leave these unset intentionally so Codex app-server defaults
  // still work. Showing "default" is more useful than hiding the row because it
  // tells the operator no per-worker override was requested.
  const model = source?.model || 'default';
  const effort = source?.reasoning_effort || source?.reasoningEffort || 'default effort';
  return `${model} / ${effort}`;
}

function readableIssueActivity(issue, details) {
  const readableFromActivity = Array.isArray(details?.activity)
    ? preferredRunningActivity(details.activity)
    : null;

  if (readableFromActivity) {
    return {
      label: readableFromActivity.label,
      detail: summarizeRunningRowDetail(readableFromActivity),
      timestamp: readableFromActivity.timestamp,
      sentAtLabel: readableFromActivity.timestamp
        ? `${formatAge(Date.now() - new Date(readableFromActivity.timestamp).getTime())} ago`
        : 'time unknown',
    };
  }

  const source = issue.latest_activity || {
    kind: issue.last_event,
    title: issue.last_event,
    detail: issue.last_message,
    status: null,
  };
  const readable = humanizeActivity(source);
  const readableTimestamp = issue.last_message_at || issue.last_event_at;
  const sentAtLabel = issue.last_message_at
    ? `${formatAge(Date.now() - new Date(issue.last_message_at).getTime())} ago`
    : `${formatAge(issue.last_activity_age_ms)} ago`;

  // `last_event_at` advances for raw protocol traffic such as token and rate
  // limit updates. The running table is about the readable headline, so prefer
  // `last_message_at` when the API provides it and only fall back to raw event
  // age for older servers or rows without a readable message timestamp.
  return {
    label: readable.label || issue.last_event || 'activity',
    detail: readable.detail || readable.title || issue.last_message || '',
    timestamp: readableTimestamp,
    sentAtLabel,
  };
}

function preferredRunningActivity(activity) {
  const readable = activity
    .slice()
    .reverse()
    .map(humanizeActivity)
    .filter(entry => entry && entry.tone !== 'usage');

  // The live Codex stream arrives token by token. For the running-issue table,
  // a one-token "last message" like "RA" or "-" is actively misleading, so this
  // row prefers the newest complete agent note/final answer before falling back
  // to command or lifecycle events.
  return readable.find(entry => entry.isCompleteAgentMessage)
    || readable.find(entry => entry.tone === 'agent' && entry.detail.length > 80)
    || readable.find(entry => entry.tone === 'command')
    || readable[0]
    || null;
}

function summarizeRunningRowDetail(entry) {
  // The activity feed can keep command details for auditing, but the running
  // table is a glance surface. It should say what the worker is doing, not paste
  // the exact PowerShell invocation that produced the event.
  if (entry.tone === 'command') {
    return entry.operatorSummary || entry.title || 'Worker ran a local command.';
  }

  return entry.detail || entry.title || '';
}

function buildReadableActivity(activity) {
  const seen = new Set();
  const seenHumanText = new Set();

  // Work from newest to oldest, translate each event into a human-facing card,
  // and skip the low-signal protocol updates that otherwise bury real actions.
  return activity
    .slice()
    .reverse()
    .map(humanizeActivity)
    .filter(entry => entry && entry.detail !== '')
    .filter(entry => {
      if (entry.tone === 'usage') return false;

      const humanTextKey = normalizeForDedupe(entry.detail);

      // Codex often emits the same prose twice: once as streaming text and once
      // as the finished agent message. Keep the finished note and hide the echo.
      if (entry.tone === 'agent' && isRepeatedHumanText(humanTextKey, seenHumanText)) return false;
      if (entry.tone === 'agent') seenHumanText.add(humanTextKey);

      const key = `${entry.label}|${entry.title}|${humanTextKey.slice(0, 180)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14);
}

function humanizeActivity(entry) {
  if (!entry) return null;

  const cleanedDetail = cleanProtocolText(entry.detail || '');
  const cleanedTitle = cleanProtocolText(entry.title || '');

  if (entry.kind === 'usage') {
    return humanizeUsage(entry, cleanedTitle, cleanedDetail);
  }

  if (entry.kind === 'command') {
    return {
      ...baseReadable(entry, 'Command', 'command'),
      title: summarizeCommand(cleanedTitle),
      operatorSummary: summarizeCommandForOperator(cleanedTitle),
      detail: summarizeCommandDetail(cleanedTitle, cleanedDetail),
    };
  }

  if (entry.kind === 'assistant_message') {
    if (!cleanedDetail || isLowSignalAssistantDelta(cleanedDetail)) return null;
    if (looksLikeRawApiJson(cleanedDetail)) return null;
    const terminalLike = looksLikeTerminalOutput(cleanedDetail);
    const terminalTitle = terminalLike ? summarizeTerminalOutput(cleanedDetail) : null;
    if (terminalTitle === 'Symphony log output') return null;

    return {
      ...baseReadable(entry, entry.status === 'commentary' ? 'Agent note' : terminalLike ? 'Terminal output' : 'Agent output', 'agent'),
      isCompleteAgentMessage: ['commentary', 'final_answer'].includes(entry.status) || entry.source_type === 'agentMessage',
      title: entry.status === 'commentary'
        ? 'Agent explained its next step'
        : entry.status === 'final_answer'
          ? 'Agent final answer'
        : terminalLike
          ? terminalTitle
          : 'Agent streamed output',
      detail: limitText(cleanedDetail, terminalLike ? 900 : 1200),
    };
  }

  if (entry.kind === 'file_change') {
    return {
      ...baseReadable(entry, 'File change', 'file'),
      title: summarizeFileChange(cleanedDetail),
      detail: summarizeFileChangeDetail(cleanedDetail),
    };
  }

  if (entry.kind === 'approval') {
    return {
      ...baseReadable(entry, 'Approval', 'approval'),
      title: cleanedTitle || 'Worker is waiting for approval',
      detail: cleanedDetail || 'The worker paused before taking an action.',
    };
  }

  if (entry.kind === 'result') {
    return {
      ...baseReadable(entry, 'Result', 'result'),
      title: cleanedTitle || 'Turn result',
      detail: cleanedDetail || 'The worker completed a turn.',
    };
  }

  if (entry.kind === 'status') {
    return humanizeWorkerStatus(entry, cleanedDetail);
  }

  if (entry.kind === 'lifecycle') {
    return {
      ...baseReadable(entry, 'Lifecycle', 'lifecycle'),
      title: cleanedTitle || 'Worker lifecycle update',
      detail: cleanedDetail || 'The worker changed state.',
    };
  }

  return {
    ...baseReadable(entry, readableLabel(entry.kind), 'quiet'),
    title: cleanedTitle || readableLabel(entry.kind),
    detail: cleanedDetail,
  };
}

function humanizeWorkerStatus(entry, detail) {
  try {
    const status = JSON.parse(detail);
    const type = status?.type || 'unknown';
    const flags = Array.isArray(status?.activeFlags) && status.activeFlags.length
      ? status.activeFlags.join(', ')
      : 'none';

    return {
      ...baseReadable(entry, 'Worker state', 'lifecycle'),
      title: type === 'idle' ? 'Worker is idle between turns' : `Worker is ${type}`,
      detail: type === 'active' ? `Active flags: ${flags}` : `State: ${type}`,
    };
  } catch {
    return {
      ...baseReadable(entry, 'Worker state', 'lifecycle'),
      title: 'Worker status updated',
      detail,
    };
  }
}

function baseReadable(entry, label, tone) {
  return {
    label,
    tone,
    status: entry.status,
    timestamp: entry.timestamp,
  };
}

function humanizeUsage(entry, title, detail) {
  if (entry.source_type === 'rateLimits') {
    return {
      ...baseReadable(entry, 'Limits', 'usage'),
      title: 'Codex rate limit status',
      detail,
    };
  }

  return {
    ...baseReadable(entry, 'Tokens', 'usage'),
    title: title || 'Token usage updated',
    detail,
  };
}

function summarizeCommand(title) {
  const command = title.replace(/^"[^"]*powershell\.exe"\s+-Command\s+/i, '').trim();
  const unquoted = command.replace(/^['"]|['"]$/g, '');

  // Dashboard-aware workers call these local endpoints as their foreman control
  // surface. Naming the endpoint by purpose keeps the activity feed useful for
  // a human operator who should not have to decode raw Invoke-RestMethod URLs.
  const dashboardEndpointSummaries = [
    [/api\/v1\/jules-handoffs\/refresh-all/i, 'Refreshed tracked Jules handoffs'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/refresh-local-sync/i, 'Checked local sync readiness'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/sync-local/i, 'Synced Jules PR locally'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/refresh-pr/i, 'Checked Jules PR readiness'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/refresh-status/i, 'Checked Jules run status'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/approve-plan/i, 'Approved Jules plan'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/stage-manifest/i, 'Staged Jules manifest'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/launch/i, 'Launched Jules handoff'],
    [/api\/v1\/jules-handoffs\/[^/\s'"]+\/message/i, 'Sent operator note to Jules'],
    [/api\/v1\/git-preflight/i, 'Checked GitHub sync gate'],
    [/api\/v1\/task-drafts/i, 'Checked Jules task queue'],
  ];
  for (const [pattern, summary] of dashboardEndpointSummaries) {
    if (pattern.test(unquoted)) return summary;
  }

  if (/npm(?:\.cmd)?\s+run\s+build/i.test(unquoted)) return 'Ran build';
  if (/npm(?:\.cmd)?\s+run\s+start/i.test(unquoted)) return 'Started Symphony smoke run';
  if (/Stop-Process/i.test(unquoted)) return 'Stopped a local smoke-test process';
  if (/api\/v1\/MOCK-1\/activity/i.test(unquoted)) return 'Checked mock worker activity';
  if (/api\/v1\/MOCK-1/i.test(unquoted)) return 'Checked mock worker details';
  if (/api\/v1\/state/i.test(unquoted)) return 'Checked dashboard state';
  if (/Invoke-RestMethod|Invoke-WebRequest/i.test(unquoted)) return 'Checked a local dashboard/API endpoint';
  if (/netstat/i.test(unquoted)) return 'Checked whether a local port is listening';
  if (/USER\.local\.md/i.test(unquoted)) return 'Read user/project guidance';
  if (/Get-Content/i.test(unquoted)) return 'Read a local file';
  if (/rg\s+/i.test(unquoted)) return 'Searched local files';
  if (/git\s+diff/i.test(unquoted)) return 'Checked file changes';

  return firstSentence(unquoted, 90) || 'Ran command';
}

function summarizeCommandForOperator(title) {
  const summary = summarizeCommand(title);

  switch (summary) {
    case 'Read user/project guidance':
      return 'The worker is reading the project guidance file so it follows your local preferences.';
    case 'Checked mock worker activity':
      return 'The worker is reading the mock worker activity endpoint to verify what happened.';
    case 'Checked mock worker details':
      return 'The worker is checking the mock worker detail endpoint for status, errors, and approval state.';
    case 'Checked dashboard state':
      return 'The worker is checking the dashboard state endpoint for running/retry/completion status.';
    case 'Checked Jules task queue':
      return 'The worker is reading the Jules task queue so it can see drafts, handoffs, and available actions.';
    case 'Checked GitHub sync gate':
      return 'The worker is checking whether the current worktree and GitHub master are aligned before Jules starts cloud work.';
    case 'Refreshed tracked Jules handoffs':
      return 'The worker is refreshing every tracked Jules handoff so PR, check, conflict, and local-sync status stay current.';
    case 'Checked local sync readiness':
      return 'The worker is checking whether a merged Jules PR can be synced back into the local master branch cleanly.';
    case 'Checked Jules PR readiness':
      return 'The worker is checking the Jules pull request for changed files, checks, conflicts, and merge readiness.';
    case 'Checked Jules run status':
      return 'The worker is refreshing the Jules run status so the dashboard reflects the cloud task state.';
    case 'Approved Jules plan':
      return 'The worker approved the proposed Jules plan through the local dashboard control surface.';
    case 'Staged Jules manifest':
      return 'The worker staged the handoff manifest Jules will use for the cloud task.';
    case 'Launched Jules handoff':
      return 'The worker launched the staged Jules handoff after the local sync gate passed.';
    case 'Sent operator note to Jules':
      return 'The worker sent your dashboard note into the Jules handoff trail.';
    case 'Synced Jules PR locally':
      return 'The worker synced the merged Jules pull request back into the local repository.';
    case 'Started Symphony smoke run':
      return 'The worker started the local Symphony mock smoke test.';
    case 'Ran build':
      return 'The worker ran the TypeScript build.';
    case 'Checked whether a local port is listening':
      return 'The worker checked whether the local smoke-test port is open.';
    case 'Stopped a local smoke-test process':
      return 'The worker stopped the local smoke-test server after verification.';
    default:
      return summary;
  }
}

function summarizeCommandDetail(title, detail) {
  const parts = [];
  const command = cleanProtocolText(title).replace(/^"[^"]*powershell\.exe"\s+-Command\s+/i, '').trim();

  if (command) parts.push(`Command: ${firstSentence(command.replace(/^['"]|['"]$/g, ''), 180)}`);
  if (detail) parts.push(detail);

  return parts.join('\n');
}

function summarizeFileChange(detail) {
  const match = detail.match(/^diff --git a\/(.+?) b\//m);
  return match ? `Changed ${match[1]}` : 'File diff emitted';
}

function summarizeFileChangeDetail(detail) {
  const addedLines = detail
    .split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++'))
    .map(line => line.slice(1).trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!addedLines.length) return 'A file changed. Open the raw activity endpoint for the full diff.';

  return `Added/updated:\n- ${addedLines.join('\n- ')}${addedLines.length === 6 ? '\n... more diff lines hidden' : ''}`;
}

function cleanProtocolText(value) {
  return String(value ?? '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b[()][A-Za-z0-9]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLowSignalAssistantDelta(detail) {
  if (!detail.trim()) return true;
  if (/^\{[\s\S]*"threadId"[\s\S]*\}$/.test(detail)) return true;
  if (/^ts=\d{4}-\d{2}-\d{2}T/.test(detail)) return true;
  if (/^\s*[{}\[\],"]+\s*$/.test(detail)) return true;
  return detail.length < 4 && !/[A-Za-z0-9]/.test(detail);
}

function looksLikeRawApiJson(detail) {
  const trimmed = detail.trim();
  const compactJson = trimmed.startsWith('{') && trimmed.endsWith('}');

  // Full API captures are valuable evidence, but they are not a readable live
  // activity item. The command card already shows that the endpoint was checked.
  // Codex can also stream tiny protocol objects such as `{"rateLimits":...}`;
  // those are handled by the usage tracker, not by the human activity feed.
  return (
    compactJson
      && /"(generated_at|issue_identifier|timestamp|recent_events|activity|rateLimits|tokenUsage|threadId|turnId|itemId)"/.test(trimmed)
  ) || (
    /"(timestamp|kind|title|detail|source_type)"/.test(trimmed)
      && /"(orchestrator|turn|commandExecution)"/.test(trimmed)
  );
}

function looksLikeTerminalOutput(detail) {
  return /^> /.test(detail)
    || /^diff --git /m.test(detail)
    || /^## /m.test(detail)
    || /^[ MADRCU?!]{1,2}\s+\S+/m.test(detail)
    || /^#\s+\S+/m.test(detail)
    || /^(error|warning|ts=|cwd:)/im.test(detail)
    || /npm ERR!/i.test(detail);
}

function summarizeTerminalOutput(detail) {
  if (/ts=\d{4}-\d{2}-\d{2}T.+component="/.test(detail)) return 'Symphony log output';
  if (/^> symphony@.+ build/m.test(detail) || /> tsc/m.test(detail)) return 'Build output';
  if (/^diff --git /m.test(detail)) return 'File diff output';
  if (/^## /m.test(detail) || /^[ MADRCU?!]{1,2}\s+\S+/m.test(detail)) return 'Git status output';
  if (/^#\s+\S+/m.test(detail)) return 'File content output';
  if (/npm ERR!/i.test(detail)) return 'NPM error output';
  if (/^error:/im.test(detail)) return 'Command error output';
  return 'Command output';
}

function limitLines(value, maxLines) {
  const lines = String(value || '').split('\n');
  if (lines.length <= maxLines) return value;
  return `${lines.slice(0, maxLines).join('\n')}\n... ${lines.length - maxLines} more lines hidden`;
}

function limitText(value, maxLength) {
  const lineLimited = limitLines(value, 12);
  if (lineLimited.length <= maxLength) return lineLimited;
  return `${lineLimited.slice(0, maxLength - 1)}...`;
}

function firstSentence(value, maxLength) {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}...`;
}

function normalizeForDedupe(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/port\s*(\d+)/gi, 'port $1')
    .replace(/dashboard\s*(\d+)/gi, 'dashboard $1')
    .replace(/turn\s*(\d+)/gi, 'turn $1')
    .replace(/on\s*(\d+)/gi, 'on $1')
    .replace(/exited\s*(\d+)/gi, 'exited $1')
    .trim()
    .toLowerCase();
}

function isRepeatedHumanText(text, seenTexts) {
  if (!text) return true;
  for (const seen of seenTexts) {
    if (seen === text) return true;
    if (seen.length > 160 && seen.includes(text)) return true;
    if (text.length > 160 && text.includes(seen)) return true;
  }
  return false;
}

function readableLabel(kind) {
  return String(kind || 'activity')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortCommit(commit) {
  // The sync gate needs to be readable at dashboard scale while still proving
  // exactly which revision Jules will clone. The full hash stays available in
  // the browser tooltip, and the card shows the familiar short Git hash.
  const value = String(commit || '').trim();
  return value ? value.slice(0, 12) : 'unknown';
}

function formatAge(ageMs) {
  const age = typeof ageMs === 'number' ? ageMs : 0;
  if (age < 1000) return `${Math.max(0, Math.round(age))}ms`;
  if (age < 60000) return `${Math.round(age / 1000)}s`;
  return `${Math.round(age / 60000)}m`;
}

function setStatus(message) {
  if (refreshStatus) refreshStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
