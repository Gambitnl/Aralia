/**
 * This file translates Agora coordination activity into Codex pet animations.
 *
 * The dashboard imports these pure rules when it renders agents and tasks. Keeping
 * the policy separate from the browser markup makes every mapping testable and
 * gives future Agora views one authoritative answer for what a pet should be doing.
 *
 * Called by: dashboard/index.html and pet-actions.test.mjs
 * Depends on: the fixed Codex pet atlas contract (8 columns by 9 action rows)
 */

// ============================================================================
// Atlas Contract
// ============================================================================
// Every pet package uses these exact row and frame assignments. Durations are
// the sum of the authored frame timings, rounded to one complete animation loop.
// ============================================================================

export const PET_ACTIONS = Object.freeze({
  idle: Object.freeze({ row: 0, frames: 6, durationMs: 1100, label: 'idle' }),
  'running-right': Object.freeze({ row: 1, frames: 8, durationMs: 1060, label: 'taking a file lock' }),
  'running-left': Object.freeze({ row: 2, frames: 8, durationMs: 1060, label: 'leaving a file lock' }),
  waving: Object.freeze({ row: 3, frames: 4, durationMs: 700, label: 'communicating' }),
  jumping: Object.freeze({ row: 4, frames: 5, durationMs: 840, label: 'claiming or completing work' }),
  failed: Object.freeze({ row: 5, frames: 8, durationMs: 1220, label: 'blocked or failed' }),
  waiting: Object.freeze({ row: 6, frames: 6, durationMs: 1010, label: 'waiting' }),
  running: Object.freeze({ row: 7, frames: 6, durationMs: 820, label: 'working' }),
  review: Object.freeze({ row: 8, frames: 6, durationMs: 1030, label: 'reviewing or orchestrating' }),
});

// Short reactions remain visible for several loops, then the dashboard returns
// the pet to its steady state derived from the current Agora board snapshot.
export const PET_REACTION_MS = Object.freeze({
  'running-right': 2200,
  'running-left': 2200,
  waving: 2400,
  jumping: 2200,
  failed: 2800,
  waiting: 2200,
  running: 2200,
  review: 2400,
  idle: 1200,
});

// ============================================================================
// Presence And Activity Announcements
// ============================================================================
// Presence uses finite ceremonies instead of leaving the roster pets in a
// perpetual loop. Speech phases keep the pet stationary for at least three
// seconds, while directional walking and waving retain the authored motion.
// ============================================================================

const freezeCeremony = (steps) => Object.freeze(steps.map((step) => Object.freeze(step)));

export const PRESENCE_CEREMONIES = Object.freeze({
  'check-in': freezeCeremony([
    { phase: 'walk-in', action: 'running-right', position: 'mid', durationMs: 1100 },
    { phase: 'wave-hello', action: 'waving', position: 'mid', durationMs: 900 },
    { phase: 'announce-arrival', action: 'idle', position: 'mid', durationMs: 3200, speech: true },
    { phase: 'approach-pad', action: 'running-right', position: 'pad', durationMs: 900 },
    { phase: 'tap-in', action: 'waving', position: 'pad', durationMs: 700, tap: true },
  ]),
  'check-out': freezeCeremony([
    { phase: 'announce-departure', action: 'idle', position: 'pad', durationMs: 3200, speech: true },
    { phase: 'tap-out', action: 'waving', position: 'pad', durationMs: 700, tap: true },
    { phase: 'walk-back', action: 'running-left', position: 'mid', durationMs: 900 },
    { phase: 'wave-goodbye', action: 'waving', position: 'mid', durationMs: 900 },
    { phase: 'walk-out', action: 'running-left', position: 'end', durationMs: 1100 },
  ]),
  'task-claim': freezeCeremony([
    { phase: 'announce-task', action: 'idle', position: 'mid', durationMs: 3200, speech: true },
  ]),
});

// Registration events carry the arriving agent. Drop and task events use the
// last good snapshots because their compact SSE payloads carry only record ids.
export function presenceCeremonyForEvent(type, data = {}, priorAgents = [], priorTasks = []) {
  if (type === 'agent.register') {
    const agent = data && data.agent;
    return agent && agent.id && agent.pet
      ? { kind: 'check-in', initialPosition: 'start', agent, speech: `Hi! ${agent.handle} signing in!` }
      : null;
  }
  if (type === 'agent.drop') {
    const agent = priorAgents.find((candidate) => candidate && candidate.id === data.agentId);
    return agent && agent.pet
      ? { kind: 'check-out', initialPosition: 'pad', agent, speech: `${agent.handle} signing out!` }
      : null;
  }
  if (type === 'task.claim') {
    const agent = priorAgents.find((candidate) => candidate && candidate.id === data.agentId);
    const task = priorTasks.find((candidate) => candidate && candidate.id === data.taskId);
    const taskName = task && (task.title || task.id);
    return agent && agent.pet && taskName
      ? { kind: 'task-claim', initialPosition: 'mid', agent, speech: `I'm taking on task ${taskName}!` }
      : null;
  }
  return null;
}

// ============================================================================
// Steady Board State
// ============================================================================
// Task state has the strongest meaning. File work comes next, followed by a
// reservation queue and campaign supervision. With none of those, the pet rests.
// ============================================================================

export function taskPetAction(task) {
  const state = task && task.state;
  if (state === 'in_progress') return 'running';
  if (state === 'blocked') return 'failed';
  if (state === 'claimed') return 'waiting';
  if (state === 'done') return 'jumping';
  return 'idle';
}

export function steadyAgentPetAction({ agentId, tasks = [], locks = [], reservations = [], campaigns = [] } = {}) {
  if (!agentId) return 'idle';

  // Prefer the most urgent active task state when one agent has several records.
  // A blocked task must stay visible even if another claimed task is waiting.
  const ownedTasks = tasks.filter((task) => task && task.claimedBy === agentId);
  if (ownedTasks.some((task) => task.state === 'blocked')) return 'failed';
  if (ownedTasks.some((task) => task.state === 'in_progress')) return 'running';
  if (ownedTasks.some((task) => task.state === 'claimed')) return 'waiting';

  // A held lock means concrete file work is underway even when the task record
  // has not yet been advanced from its orchestration state.
  if (locks.some((lock) => lock && lock.agentId === agentId)) return 'running';
  if (reservations.some((reservation) => reservation && reservation.agentId === agentId)) return 'waiting';

  // Active campaign owners are inspecting and directing a wave, represented by
  // the atlas's focused review loop rather than a worker's busy loop.
  if (campaigns.some((campaign) => campaign && campaign.agentId === agentId && campaign.state === 'active')) return 'review';
  return 'idle';
}

// ============================================================================
// Live Event Reactions
// ============================================================================
// SSE events briefly override the steady state so momentary actions such as a
// message, handoff, or lock transition remain visible to the human operator.
// Each result names an agent and one valid atlas action.
// ============================================================================

export function petReactionsForEvent(type, data = {}) {
  const reactions = [];
  const add = (agentId, action) => {
    if (agentId && PET_ACTIONS[action]) reactions.push({ agentId, action });
  };

  switch (type) {
    case 'agent.register':
      add(data.agent && data.agent.id, 'waving');
      break;
    case 'lock.acquire':
      add(data.lock && data.lock.agentId, 'running-right');
      break;
    case 'lock.release':
      add(data.agentId, 'running-left');
      break;
    case 'lock.expired':
      add(data.agentId, 'failed');
      break;
    case 'reservation.create':
      add(data.reservation && data.reservation.agentId, 'waiting');
      break;
    case 'reservation.release':
      add(data.agentId, 'running-left');
      break;
    case 'reservation.fulfill':
      add(data.agentId, 'jumping');
      break;
    case 'campaign.claim':
      add(data.campaign && data.campaign.agentId, 'review');
      break;
    case 'campaign.state':
      add(data.agentId, data.state === 'blocked' ? 'failed' : 'review');
      break;
    case 'task.create':
      add(data.task && data.task.createdBy, 'review');
      break;
    case 'task.claim':
      add(data.agentId, 'jumping');
      break;
    case 'task.state':
      add(data.agentId, taskPetAction({ state: data.state }));
      break;
    case 'task.release':
      add(data.agentId, 'failed');
      break;
    case 'task.handoff':
      add(data.agentId, 'waving');
      add(data.toAgentId, 'jumping');
      break;
    case 'task.categories':
    case 'task.checkpoint':
      add(data.agentId, 'review');
      break;
    case 'message.post': {
      const message = data.message || data;
      add(message && message.from, 'waving');
      break;
    }
    default:
      break;
  }

  return reactions;
}
