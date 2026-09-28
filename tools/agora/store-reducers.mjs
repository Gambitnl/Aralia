// tools/agora/store-reducers.mjs
// The event reducers and the state helpers they use, shared by two processes:
//   - store.mjs, the single writer, applies them live and on journal replay;
//   - readonly-store.mjs, the read-only surface, applies them to the journal
//     tail in memory, so a record newer than the last snapshot is not invisible
//     to it (WF-G168, measured in Stage 1 of the campaign trial, design §72).
//
// Nothing here touches a file, a clock, or a network. A reducer is given an
// event payload and mutates the in-memory state it was created over. The
// read-only surface's assertNoWritePath reads this file too.
//
// The reducer and helper bodies were MOVED from store.mjs unchanged on
// 2026-09-13. Keep one copy: a second copy of a reducer is how replay drifts.

// Pet snapshots are stored in several records; cloning prevents one reducer
// from accidentally changing an agent, task, and history view at once.
export function clonePet(pet) {
  return pet ? JSON.parse(JSON.stringify(pet)) : null;
}

export function normalizeCategoryInput(category) {
  if (typeof category !== 'string') return '';
  const v = category.trim().toLowerCase();
  if (!v) return '';
  return v.replace(/[^a-z0-9:_-]/g, ' ').replace(/\s+/g, '-');
}

export function normalizeCategoryList(categories = []) {
  const input = Array.isArray(categories) ? categories : [categories];
  const out = [];
  const seen = new Set();
  for (const raw of input) {
    const n = normalizeCategoryInput(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** The empty in-memory state. Both processes start from this shape. */
export function createEmptyState() {
  return {
    aliases: new Map(),
    agents: new Map(),
    locks: new Map(),
    reservations: new Map(),
    reservationSeq: 0,
    tasks: new Map(),
    campaigns: new Map(),
    seats: new Map(),
    messages: [],
    seq: 0,
    messageSeq: 0,
  };
}

/** The helpers the reducers (and the store) resolve records through. */
export function createStateHelpers(state) {
  /** The canonical id for any name an object has ever had. An unknown name
   *  comes back unchanged, so callers keep their own not-found handling. */
  function canonicalId(id) {
    if (typeof id !== 'string' || !id) return id;
    const seen = new Set();
    let cur = id;
    while (state.aliases.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = state.aliases.get(cur);
    }
    return cur;
  }

  function getTask(id) {
    return state.tasks.get(canonicalId(id));
  }

  function getCampaign(id) {
    return state.campaigns.get(canonicalId(id));
  }

  function hasTask(id) {
    return state.tasks.has(canonicalId(id));
  }

  function hasCampaign(id) {
    return state.campaigns.has(canonicalId(id));
  }

  // Retrace file evidence must outlive the advisory locks that first exposed it.
  // Locks expire after 30 minutes, while an active task gets up to 120 minutes
  // before reap, so the task keeps a small union of every path/glob token seen
  // from its claimant's locks and checkpoints. This is candidate work scope,
  // not proof that every listed file was modified.
  function mergeRetraceFiles(task, ...groups) {
    const files = new Set(Array.isArray(task.retraceFiles) ? task.retraceFiles : []);
    for (const group of groups) {
      for (const file of Array.isArray(group) ? group : []) {
        if (typeof file === 'string' && file.trim()) files.add(file.trim());
      }
    }
    task.retraceFiles = [...files];
    return task.retraceFiles;
  }

  // A claim can happen before or after locks are acquired. Reading the current
  // lock set at claim/handoff time covers the lock-first order; the lock reducer
  // below covers locks acquired after the task already became active.
  function lockTokensForAgent(agentId) {
    const files = [];
    for (const lock of state.locks.values()) {
      if (lock.agentId !== agentId) continue;
      files.push(...(lock.paths || []), ...(lock.globs || []));
    }
    return files;
  }

  // ---------------------------------------------------------------------------
  // Mutation reducers — pure(ish): given an event payload, mutate in-memory state.
  // Keyed by event type. Used both for live mutations and journal replay so that
  // replay is guaranteed to reconstruct identical state.
  // ---------------------------------------------------------------------------
  /** WF-G103: move the campaign whenever its work moves.
   *
   *  Before this, `claimCampaign` stamped createdAt and updatedAt once and
   *  nothing ever wrote updatedAt again. Every one of 27 live campaigns
   *  reported an active life of ZERO days, so the "whole active period" window
   *  D-O chose could not contain a single task. Measured 2026-09-07: the full
   *  evidence ladder placed 0 of 189 orphan tasks, and the time half of rank 3
   *  was the reason.
   *
   *  Called from the reducers so replay reproduces the same spans. It only
   *  ever moves the stamp FORWARD: a replayed older event must not drag a
   *  campaign's last-activity time backwards.
   */
  function touchCampaign(campaignId, at) {
    if (!campaignId || !at) return;
    const c = state.campaigns.get(canonicalId(campaignId));
    if (c && at > (c.updatedAt || 0)) c.updatedAt = at;
  }


  return { canonicalId, getTask, getCampaign, hasTask, hasCampaign, touchCampaign, mergeRetraceFiles, lockTokensForAgent };
}

/** The reducers, keyed by event type, over one state object. */
export function createReducers(state, { canonicalId, getTask, getCampaign, touchCampaign, mergeRetraceFiles, lockTokensForAgent }) {
  const reducers = {
    'agent.register'(p) {
      state.agents.set(p.agent.id, { ...p.agent });
    },
    'agent.touch'(p) {
      const a = state.agents.get(p.agentId);
      if (!a) return;
      a.lastSeen = p.lastSeen;
      if (Number.isFinite(p.lastMeaningfulAt)) a.lastMeaningfulAt = p.lastMeaningfulAt;
      if (Number.isFinite(p.lastHeartbeatAt)) a.lastHeartbeatAt = p.lastHeartbeatAt;
    },
    'agent.drop'(p) {
      state.agents.delete(p.agentId);
    },
    'lock.acquire'(p) {
      state.locks.set(p.lock.id, { ...p.lock });
      // Remember this scope on every active task owned by the lock holder.
      // The association remains durable after `lock.expired` deletes the lock.
      const lockFiles = [...(p.lock.paths || []), ...(p.lock.globs || [])];
      for (const task of state.tasks.values()) {
        if (task.claimedBy !== p.lock.agentId || !['claimed', 'in_progress'].includes(task.state)) continue;
        mergeRetraceFiles(task, lockFiles);
      }
    },
    'lock.renew'(p) {
      const lock = state.locks.get(p.lockId);
      if (lock) lock.expiresAt = p.expiresAt;
    },
    'lock.release'(p) {
      state.locks.delete(p.lockId);
    },
    // WF-G121: the moment a head reservation was first found idle on a FREE file.
    'reservation.freeSince'(p) {
      const reservation = state.reservations.get(p.reservationId);
      if (reservation) reservation.freeSince = p.at || undefined;
    },
    // WF-G122: a lock loses some of its tokens but keeps its id and expiry.
    'lock.shrink'(p) {
      const lock = state.locks.get(p.lockId);
      if (lock) { lock.paths = p.paths; lock.globs = p.globs; }
    },
    'lock.expired'(p) {
      state.locks.delete(p.lockId);
    },
    // WF-G75: advisory-only event; no state change (the lock still exists).
    'lock.expiring'(p) {
      const lock = state.locks.get(p.lockId);
      if (lock) lock.expiringWarned = true;
    },
    'reservation.create'(p) {
      state.reservations.set(p.reservation.id, { ...p.reservation });
      if (p.reservation.queueSeq > state.reservationSeq) state.reservationSeq = p.reservation.queueSeq;
    },
    'reservation.release'(p) {
      state.reservations.delete(p.reservationId);
    },
    'reservation.fulfill'(p) {
      state.reservations.delete(p.reservationId);
    },
    'task.create'(p) {
      state.tasks.set(p.task.id, JSON.parse(JSON.stringify(p.task)));
      touchCampaign(p.task.campaignId, p.task.createdAt);
    },
    'task.claim'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      touchCampaign(t.campaignId, p.ts);
      t.state = 'claimed';
      t.claimedBy = p.agentId;
      t.claimedAgent = p.claimedAgent ? JSON.parse(JSON.stringify(p.claimedAgent)) : null;
      t.assignedPet = clonePet(p.pet);
      const agent = state.agents.get(p.agentId);
      if (agent && p.pet) agent.pet = clonePet(p.pet);
      mergeRetraceFiles(t, p.retraceFiles || lockTokensForAgent(p.agentId));
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.state'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      touchCampaign(t.campaignId, p.ts);
      t.state = p.state;
      if (p.result !== undefined) t.result = p.result;
      // These fields travel in the same journal event as the state change so a
      // crash cannot restore the prose while losing how that prose should be read.
      if (p.resultDisposition !== undefined) t.resultDisposition = p.resultDisposition;
      if (p.finding !== undefined) t.finding = p.finding;
      if (p.evidence !== undefined) t.evidence = p.evidence;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    // WF-G130: the authored fields of a task change in place; the id does not.
    'task.edit'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      for (const [key, value] of Object.entries(p.fields || {})) t[key] = value;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'task.release'(p) {
      // Reopen a claimed/in-progress task (dead-agent reap or explicit release).
      const t = getTask(p.taskId);
      if (!t) return;
      t.state = 'open';
      t.claimedBy = null;
      t.claimedAgent = null;
      t.assignedPet = null;
      t.updatedAt = p.ts;
      t.history.push(p.entry);
      // A reap carries a retrace dossier (agent-retrace, Wave 2). A clean retire
      // does not, so it neither stamps a crash dossier nor bumps reapCount.
      if (p.retrace) {
        t.retrace = p.retrace;
        t.reapCount = (t.reapCount || 0) + 1;
      }
    },
    'task.checkpoint'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      t.checkpoint = p.checkpoint; // latest-wins resumable note
      // Checkpoint file lists are self-reported evidence and remain part of the
      // task's recoverable scope even when a later checkpoint omits them.
      mergeRetraceFiles(t, p.checkpoint && p.checkpoint.files);
      t.updatedAt = p.ts;
    },
    'task.archived'(p) {
      // Board tidying: the task's full record lives in the archive JSONL; live
      // state (and therefore snapshot + replay) only needs the deletion.
      state.tasks.delete(p.taskId);
    },
    'task.handoff'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      t.claimedBy = p.toAgentId;
      t.claimedAgent = p.claimedAgent ? JSON.parse(JSON.stringify(p.claimedAgent)) : null;
      t.assignedPet = clonePet(p.pet);
      const agent = state.agents.get(p.toAgentId);
      if (agent && p.pet) agent.pet = clonePet(p.pet);
      mergeRetraceFiles(t, p.retraceFiles || lockTokensForAgent(p.toAgentId));
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    // D-K, D-O and r9q1: one event that records what each task's membership is
    // KNOWN to be, and how. It writes a guess only where a guess is honest,
    // and says so on the record rather than leaving it to be assumed.
    'task.membership'(p) {
      for (const change of p.changes || []) {
        const t = state.tasks.get(canonicalId(change.taskId));
        if (!t) continue;
        t.membership = change.membership;
        t.inferredFrom = change.inferredFrom || '';
        t.inferredAt = change.membership === 'recorded' ? '' : p.at;
        t.inferredCandidates = change.candidates || [];
        // A placed guess fills campaignId; ambiguous and unknown never do.
        // D-O: if more than one effort matches, pick NONE.
        if (change.membership === 'inferred' && change.campaignId) {
          t.campaignId = change.campaignId;
        }
        t.updatedAt = p.at;
        t.history.push({
          at: p.at,
          by: p.by,
          action: 'membership',
          membership: change.membership,
          from: change.inferredFrom || '',
        });
      }
    },
    // D-S: one event that renames every task and campaign to its short id and
    // records the old name as a permanent alias. It ADDS a name; nothing that
    // was ever written down stops resolving.
    'ids.migrate'(p) {
      for (const change of p.campaigns || []) {
        const c = state.campaigns.get(change.from);
        if (!c) continue;
        state.campaigns.delete(change.from);
        c.id = change.to;
        c.formerIds = [...(c.formerIds || []), change.from];
        // The slug becomes the campaign's NAME as well as its alias, so a
        // listing still tells a person what the campaign is.
        if (!c.name) c.name = change.name || change.from;
        state.campaigns.set(change.to, c);
        state.aliases.set(change.from, change.to);
      }
      for (const change of p.tasks || []) {
        const t = state.tasks.get(change.from);
        if (!t) continue;
        state.tasks.delete(change.from);
        t.id = change.to;
        t.formerIds = [...(t.formerIds || []), change.from];
        t.updatedAt = p.at;
        t.history.push({ at: p.at, by: p.by, action: 'id-migrated', from: change.from, to: change.to });
        state.tasks.set(change.to, t);
        state.aliases.set(change.from, change.to);
      }
      // Campaign ids that moved must be followed by the tasks that name them,
      // and by every dependency edge that points at a renamed task.
      const campaignMoves = new Map((p.campaigns || []).map((c) => [c.from, c.to]));
      const taskMoves = new Map((p.tasks || []).map((t) => [t.from, t.to]));
      for (const t of state.tasks.values()) {
        if (t.campaignId && campaignMoves.has(t.campaignId)) {
          t.campaignId = campaignMoves.get(t.campaignId);
        }
        t.deps = (t.deps || []).map((d) => (
          taskMoves.has(d.id) ? { ...d, id: taskMoves.get(d.id) } : d
        ));
      }
    },
    // D-AC: one event that closes every empty campaign it swept, and says on
    // each record why it closed. It edits no past event, and the campaign
    // keeps its whole history — closing is a state change, not a deletion.
    'campaign.sweep'(p) {
      for (const row of p.closing || []) {
        const c = state.campaigns.get(canonicalId(row.id));
        if (!c) continue;
        c.state = 'done';
        c.updatedAt = p.at;
        c.closedReason = `empty and unattended for ${row.ageDays} days (D-AC sweep, ${p.minAgeDays}-day limit)`;
        c.history.push({
          at: p.at,
          by: p.by,
          action: 'swept-closed',
          state: 'done',
          tasks: row.tasks,
          ageDays: row.ageDays,
        });
      }
    },
    // Which seat a session is sitting in. Its own event, so the link survives
    // replay — without it a campaign claimed later reads no durable owner.
    'agent.seat'(p) {
      const agent = state.agents.get(p.agentId);
      if (!agent) return;
      agent.seatId = p.seatId;
    },
    // D-L: a seat is created once and then outlives every session that holds
    // it. Creation is its own event, so the roster can be rebuilt by replay.
    'seat.create'(p) {
      state.seats.set(p.seat.id, JSON.parse(JSON.stringify(p.seat)));
    },
    // D-AB: a session takes the seat as it signs in, and gives it up when its
    // presence drops. Both directions are events, so the roster records who
    // held what and when, rather than only who holds it now.
    'seat.hold'(p) {
      const seat = state.seats.get(p.seatId);
      if (!seat) return;
      seat.holder = p.agentId;
      seat.heldSince = p.at;
      seat.updatedAt = p.at;
      seat.history.push({ at: p.at, action: 'held', by: p.agentId });
    },
    'seat.release'(p) {
      const seat = state.seats.get(p.seatId);
      if (!seat) return;
      seat.holder = null;
      seat.heldSince = null;
      seat.updatedAt = p.at;
      seat.history.push({ at: p.at, action: 'released', by: p.agentId, why: p.why || '' });
    },
    // D-L: the seat's memory. A successor reads what the last holder learned,
    // instead of inheriting an empty job.
    'seat.diary'(p) {
      const seat = state.seats.get(p.seatId);
      if (!seat) return;
      seat.diary.push({ at: p.at, by: p.agentId, text: p.text });
      seat.updatedAt = p.at;
    },
    // D-N: a rename is RECORDED, never overwritten. A seat that was renamed
    // keeps every name it has carried, because written records name the old
    // one and those records must keep resolving.
    'seat.rename'(p) {
      const seat = state.seats.get(p.seatId);
      if (!seat) return;
      seat.renames.push({ at: p.at, from: seat.name, to: p.name, by: p.by, why: p.why || '' });
      seat.formerNames = [...(seat.formerNames || []), seat.name];
      seat.name = p.name;
      seat.updatedAt = p.at;
      seat.history.push({ at: p.at, action: 'renamed', by: p.by, from: p.from, to: p.name });
    },
    // WF-G104: one event that rewrites a dependency id to the id its target
    // carries NOW. It edits no past event; the old id stays an alias forever.
    'task.deps.canonicalize'(p) {
      for (const change of p.changes || []) {
        const t2 = getTask(change.taskId);
        if (!t2) continue;
        t2.deps = JSON.parse(JSON.stringify(change.to));
        t2.updatedAt = p.at;
        t2.history.push({
          at: p.at, by: p.by, action: 'deps-renamed', from: change.from, to: change.to,
        });
      }
    },
    // D-T: one event that records every untyped dep it converted, and why.
    // Replay then reproduces the old shape followed by this migration, which
    // is the truth of what happened. No already-written event is touched.
    'task.deps.migrate'(p) {
      for (const change of p.changes || []) {
        const t2 = getTask(change.taskId);
        if (!t2) continue;
        t2.deps = JSON.parse(JSON.stringify(change.to));
        t2.updatedAt = p.at;
        t2.history.push({ at: p.at, by: p.by, action: 'deps-typed', from: change.from, to: change.to });
      }
    },
    'task.categories'(p) {
      const t = getTask(p.taskId);
      if (!t) return;
      t.category = normalizeCategoryInput(p.category || '');
      t.categories = normalizeCategoryList(p.categories);
      t.updatedAt = p.ts;
      t.history.push(p.entry);
    },
    'campaign.claim'(p) {
      state.campaigns.set(p.campaign.id, JSON.parse(JSON.stringify(p.campaign)));
      // The human name resolves to the code, on replay as well as live.
      if (p.campaign.name && p.campaign.name !== p.campaign.id) {
        state.aliases.set(p.campaign.name, p.campaign.id);
      }
    },
    'campaign.state'(p) {
      const c = getCampaign(p.campaignId);
      if (!c) return;
      c.state = p.state;
      c.updatedAt = p.ts;
      c.history.push(p.entry);
    },
    // §6: a charter is stored whole, with its revision appended. Any edit drops
    // earlier approvals: an approval is of the text that was read, not of
    // whatever the charter says later.
    'campaign.charter'(p) {
      const c = getCampaign(p.campaignId);
      if (!c) return;
      const prior = c.charter || null;
      c.charter = {
        status: 'needs-review',
        body: JSON.parse(JSON.stringify(p.body)),
        submittedAt: p.at,
        submittedBy: p.by,
        approvals: [],
        revisions: [...((prior && prior.revisions) || []), { at: p.at, by: p.by, summary: p.summary }],
      };
      c.updatedAt = p.at;
      c.history.push({ at: p.at, by: p.by, action: 'charter', from: prior ? prior.status : 'none', state: c.state, reason: p.summary });
    },
    'campaign.charter.approve'(p) {
      const c = getCampaign(p.campaignId);
      if (!c || !c.charter) return;
      c.charter.approvals.push({ at: p.at, by: p.by, role: p.role, note: p.note });
      const from = c.charter.status;
      c.charter.status = 'approved';
      c.updatedAt = p.at;
      c.history.push({ at: p.at, by: p.by, action: 'charter-approved', from, state: c.state, reason: p.note });
    },
    // §10 step 3: triage starts explicitly, and says why. The campaign state
    // does not change: whether `triage` is a state or a flag is open decision
    // D1, so the additive form is used and the record says which.
    'campaign.triage.start'(p) {
      const c = getCampaign(p.campaignId);
      if (!c) return;
      c.triage = { state: 'in-review', startedAt: p.at, startedBy: p.by, reason: p.reason, dispositions: {} };
      c.updatedAt = p.at;
      c.history.push({ at: p.at, by: p.by, action: 'triage-started', from: c.state, state: c.state, reason: p.reason });
    },
    // §10 steps 6-8: one task, one disposition, one event. The task patch and
    // the audit record travel together, so a crash cannot keep one without the other.
    'campaign.disposition'(p) {
      const c = getCampaign(p.campaignId);
      const t = getTask(p.taskId);
      if (!c || !t || !c.triage) return;
      for (const [key, value] of Object.entries(p.patch || {})) t[key] = value;
      t.updatedAt = p.at;
      t.history.push(p.entry);
      c.triage.dispositions[t.id] = JSON.parse(JSON.stringify(p.record));
      c.updatedAt = p.at;
      c.history.push({ at: p.at, by: p.by, action: 'disposition', task: t.id, disposition: p.record.disposition, from: p.record.from, state: c.state, reason: p.record.reason });
    },
    'campaign.triage.finish'(p) {
      const c = getCampaign(p.campaignId);
      if (!c || !c.triage) return;
      c.triage.state = 'applied';
      c.triage.finishedAt = p.at;
      c.triage.finishedBy = p.by;
      const previousOwner = c.agentId;
      c.agentId = p.by;
      if (p.seatId) c.seatId = p.seatId;
      c.updatedAt = p.at;
      c.history.push({ at: p.at, by: p.by, action: 'adopted', from: c.state, state: c.state, previousOwner, reason: p.reason, via: 'triage' });
    },
    'message.post'(p) {
      state.messages.push({ ...p.message });
      if (p.message.seq > state.messageSeq) state.messageSeq = p.message.seq;
    },
  };

  return reducers;
}

/** Fold a parsed snapshot into an empty state. Returns the snapshot seq. */
export function loadSnapshotInto(state, snap) {
    state.seq = snap.lastSeq || 0;
    state.messageSeq = snap.messageSeq || 0;
    for (const a of snap.agents || []) state.agents.set(a.id, a);
    for (const l of snap.locks || []) state.locks.set(l.id, l);
    for (const r of snap.reservations || []) state.reservations.set(r.id, r);
    state.reservationSeq = snap.reservationSeq || Math.max(0, ...[...state.reservations.values()].map((r) => r.queueSeq || 0));
    for (const t of snap.tasks || []) state.tasks.set(t.id, t);
    for (const c of snap.campaigns || []) state.campaigns.set(c.id, c);
    // A seat outlives every session by definition, so it must survive a
    // restart. A seat that vanished on restart would be a session wearing a
    // longer name, which is the exact thing seats exist to stop being.
    for (const s of snap.seats || []) state.seats.set(s.id, s);
    // Aliases are part of the durable record, not a runtime convenience: a
    // name that once appeared in a written result has to keep resolving after
    // every restart, or that result silently becomes wrong.
    for (const [from, to] of snap.aliases || []) state.aliases.set(from, to);
    state.messages = snap.messages || [];
  return state.seq;
}

/** Apply the journal text after a snapshot seq. A torn last line is skipped. */
/*
 *  `onError` is for the read-only surface only. The daemon passes none, so a
 *  reducer that throws still stops its replay exactly as before. The surface
 *  must never crash on a record it did not write: it reports the event it
 *  could not apply instead, so the gap is visible rather than hidden.
 */
export function applyJournalText(state, reducers, raw, snapshotSeq, { onError } = {}) {
    const lines = raw.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // skip a torn last line from a crash mid-write
      }
      if (event.seq <= snapshotSeq) continue; // already folded into snapshot
      const reducer = reducers[event.type];
      if (onError) {
        try {
          if (reducer) reducer(event.payload);
          else onError(event, new Error('no reducer for ' + event.type));
        } catch (e) {
          onError(event, e);
        }
      } else if (reducer) {
        reducer(event.payload);
      }
      if (event.seq > state.seq) state.seq = event.seq;
    }
  return state.seq;
}
