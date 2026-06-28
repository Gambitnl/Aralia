// Agora → Cockpit activity bridge.
//
// Mirrors meaningful Agora coordination events into the operator cockpit's
// activity feed file (`.agent/orchestration/activity.jsonl`), so the existing
// cockpit (misc/agent_matrix.html → Aralia-operator-dashboard) surfaces
// peer-agent presence/locks/tasks/messages alongside external-agent dispatch —
// one shared feed, no cockpit restructuring required.
//
// Lines are written in the cockpit's own shape: one JSON object per line,
// `{ at, kind:'note', agent:'agora', title, detail, ... }`. Heartbeat-class
// events (agent.touch) are filtered out so the feed isn't spammed.
//
// `formatActivityNote` is a PURE function (event + resolvers → note | null) and
// is unit-tested. `attachActivityMirror` wires it to a live store + file.

import fs from 'node:fs';
import path from 'node:path';

const shortId = (id) => (id ? String(id).slice(0, 8) : 'someone');

function lockTokens(lock) {
  const toks = [...(lock?.paths || []), ...(lock?.globs || [])];
  if (!toks.length) return 'a resource';
  if (toks.length <= 2) return toks.join(', ');
  return `${toks.slice(0, 2).join(', ')} +${toks.length - 2} more`;
}

/**
 * Translate one Agora store Event into a cockpit activity note.
 * @param {{seq:number,type:string,payload:object,ts:number}} event
 * @param {{handleFor?:(id:string)=>string|undefined, taskFor?:(id:string)=>object|null}} resolvers
 * @returns {object|null} note object, or null to skip this event
 */
export function formatActivityNote(event, { handleFor, taskFor } = {}) {
  const H = (id) => (handleFor && handleFor(id)) || shortId(id);
  const T = (id) => (taskFor && taskFor(id)) || null;
  const p = event?.payload || {};
  let title = null;
  let detail = '';

  switch (event?.type) {
    case 'agent.register': {
      const a = p.agent || {};
      title = `${a.handle || H(a.id)} joined the Agora`;
      detail = a.note || '';
      break;
    }
    case 'lock.acquire': {
      const lk = p.lock || {};
      title = `${H(lk.agentId)} locked ${lockTokens(lk)}`;
      detail = lk.reason || '';
      break;
    }
    case 'lock.release': {
      title = `${H(p.agentId)} released a lock`;
      break;
    }
    case 'lock.expired': {
      title = `${H(p.agentId)}'s lock expired`;
      break;
    }
    case 'task.create': {
      const t = p.task || {};
      title = `${H(t.createdBy)} posted task: ${t.title || shortId(t.id)}`;
      break;
    }
    case 'task.claim': {
      const t = T(p.taskId);
      title = `${H(p.agentId)} claimed: ${t?.title || shortId(p.taskId)}`;
      break;
    }
    case 'task.state': {
      const t = T(p.taskId);
      title = `task "${t?.title || shortId(p.taskId)}" → ${p.state}`;
      break;
    }
    case 'task.handoff': {
      const t = T(p.taskId);
      title = `${H(p.agentId)} handed "${t?.title || shortId(p.taskId)}" to ${H(p.toAgentId)}`;
      break;
    }
    case 'message.post': {
      const m = p.message || {};
      const to = m.to === 'all' ? 'all' : `@${H(m.to)}`;
      title = `${H(m.from)} → ${to}`;
      detail = m.body || '';
      break;
    }
    default:
      // agent.touch and any unknown/internal events are intentionally skipped.
      return null;
  }

  return {
    at: typeof event.ts === 'number' ? event.ts : Date.now(),
    kind: 'note',
    agent: 'agora',
    title,
    detail,
    source: 'agora',
    eventType: event.type,
    seq: event.seq,
  };
}

/**
 * Subscribe to a live store and append formatted notes to the cockpit feed file.
 * Best-effort: a write failure never throws into the store's emit path.
 * @returns {() => void} detach function (unsubscribes)
 */
export function attachActivityMirror({ store, file }) {
  if (!store || !file) throw new Error('attachActivityMirror requires { store, file }');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch {
    /* dir may already exist / be unwritable — appends below are best-effort */
  }

  const handleFor = (id) => store.listAgents().find((a) => a.id === id)?.handle;
  const taskFor = (id) => store.listTasks().find((t) => t.id === id) || null;

  return store.subscribe((event) => {
    let note;
    try {
      note = formatActivityNote(event, { handleFor, taskFor });
    } catch {
      return; // never let a formatting bug break the store's fan-out
    }
    if (!note) return;
    try {
      fs.appendFileSync(file, JSON.stringify(note) + '\n');
    } catch {
      /* feed is best-effort — never fail a coordination op over it */
    }
  });
}
