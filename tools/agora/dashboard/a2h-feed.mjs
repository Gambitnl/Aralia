/**
 * Agent-to-human (A2H) feed: messages that agents address to the human
 * operator in plain English. Each one names what the sender needs and the task
 * or campaign it is about, so the human can act on it without reading the
 * command channel.
 *
 * The feed reads ordinary Agora messages; it is not a second message store and
 * it needs no daemon change. A message counts only when its first line is the
 * tag line `A2H need=<decision|info|none> ref=<task-or-campaign-id>` and plain
 * text follows it. `client.mjs say --need <...> --ref <id> "<text>"` writes
 * that shape and refuses anything else.
 *
 * Exercised by: a2h-feed.test.mjs. Rendered by: index.html "To Remy" panel.
 */

export const A2H_NEEDS = Object.freeze({
  decision: 'Needs your decision',
  info: 'For your information',
  none: 'No action needed',
});

// The tag line. Keep in step with formatA2H in client-runtime.mjs.
const TAG_LINE = /^A2H\s+need=(decision|info|none)\s+ref=([A-Za-z0-9._:-]+)\s*$/;

/** Build the message body. Throws on a bad need, a bad ref, or empty text. */
export function formatA2H({ need, ref, text }) {
  if (!Object.hasOwn(A2H_NEEDS, need)) throw new Error(`need must be one of: ${Object.keys(A2H_NEEDS).join(', ')}`);
  if (!/^[A-Za-z0-9._:-]+$/.test(String(ref || ''))) throw new Error('ref must be a task or campaign id');
  const body = String(text || '').trim();
  if (!body) throw new Error('text must not be empty');
  return `A2H need=${need} ref=${ref}\n${body}`;
}

/** Parse a message body. Returns { need, ref, text } or null when it is not an A2H message. */
export function parseA2H(body) {
  const raw = String(body || '');
  const newline = raw.indexOf('\n');
  const first = (newline < 0 ? raw : raw.slice(0, newline)).trim();
  const match = TAG_LINE.exec(first);
  if (!match) return null;
  const text = newline < 0 ? '' : raw.slice(newline + 1).trim();
  if (!text) return null;
  return { need: match[1], ref: match[2], text };
}

// A human's reply to one feed message. The first line names the message it
// answers, so the asking agent can match the reply to its question.
const REPLY_LINE = /^A2H-REPLY\s+seq=(\d+)\s+ref=([A-Za-z0-9._:-]+)\s*$/;

/** Build a reply body for the feed message with this seq and ref. */
export function formatA2HReply({ seq, ref, text }) {
  if (!Number.isInteger(Number(seq)) || Number(seq) <= 0) throw new Error('seq must be the message number being answered');
  if (!/^[A-Za-z0-9._:-]+$/.test(String(ref || ''))) throw new Error('ref must be a task or campaign id');
  const body = String(text || '').trim();
  if (!body) throw new Error('the reply must not be empty');
  return `A2H-REPLY seq=${Number(seq)} ref=${ref}\n${body}`;
}

/** Parse a reply body. Returns { seq, ref, text } or null. */
export function parseA2HReply(body) {
  const raw = String(body || '');
  const newline = raw.indexOf('\n');
  const first = (newline < 0 ? raw : raw.slice(0, newline)).trim();
  const match = REPLY_LINE.exec(first);
  if (!match) return null;
  const text = newline < 0 ? '' : raw.slice(newline + 1).trim();
  if (!text) return null;
  return { seq: Number(match[1]), ref: match[2], text };
}

/** Which board record a ref names: 'task', 'campaign', or null when unknown. */
export function refKind(ref, { tasks = [], campaigns = [] } = {}) {
  if (tasks.some((task) => task.id === ref)) return 'task';
  if (campaigns.some((campaign) => campaign.id === ref)) return 'campaign';
  return null;
}

/**
 * The plain-words name of the referenced work. A raw id such as
 * 'agora-437d.9' tells the human nothing, so the feed leads with the task's
 * title or the campaign's scope and keeps the id as a small link.
 */
export function refTitle(ref, { tasks = [], campaigns = [] } = {}) {
  const task = tasks.find((entry) => entry.id === ref);
  if (task) return String(task.title || '').trim();
  const campaign = campaigns.find((entry) => entry.id === ref);
  if (campaign) return String(campaign.scope || campaign.wave || '').trim();
  return '';
}

// Feed filters (Remy, Agora 8318: "filter on 'needs my decisions'"). 'all'
// shows every item; each need key shows only that need.
export const A2H_FILTERS = Object.freeze(['all', 'decision', 'answered', 'info', 'none']);

export const A2H_FILTER_LABELS = Object.freeze({
  all: 'All',
  decision: 'Needs your decision',
  answered: 'Answered',
  info: 'For your information',
  none: 'No action needed',
});

/** True when a human has replied to this item at least once. */
export function isAnswered(item) {
  if (typeof item?.answered === 'boolean') return item.answered;
  return (item?.replies || []).some((reply) => reply.from?.role === 'human');
}

function matchesFilter(item, key) {
  if (key === 'all') return true;
  if (key === 'answered') return isAnswered(item);
  if (key === 'decision') return item.need === 'decision' && !isAnswered(item);
  return item.need === key;
}

/**
 * Apply the feed filter. `need` is one of A2H_FILTERS (an unknown value acts as
 * 'all'); `unansweredOnly` drops items a human already replied to. Returns the
 * kept items in their given order plus the count for each filter button, so a
 * button can show how many items it would keep before the human presses it.
 */
export function filterA2H(items, { need = 'all', unansweredOnly = false } = {}) {
  const pool = unansweredOnly ? items.filter((item) => !isAnswered(item)) : items;
  const counts = Object.fromEntries(A2H_FILTERS.map((key) => [key, pool.filter((item) => matchesFilter(item, key)).length]));
  const active = A2H_FILTERS.includes(need) ? need : 'all';
  return { items: active === 'all' ? pool : pool.filter((item) => matchesFilter(item, active)), counts, need: active };
}

/**
 * Collect A2H items, newest first. Messages from a human are never A2H items:
 * the feed is what agents send TO the human. Each item carries the sender's
 * handle, id, role and model, so the human sees who is asking.
 */
export function collectA2H(messages, { agents = [], tasks = [], campaigns = [] } = {}) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  // Replies thread under the message they answer, oldest first.
  const repliesBySeq = new Map();
  for (const message of messages) {
    const reply = parseA2HReply(message.body);
    if (!reply) continue;
    const sender = byId.get(message.from) || {};
    const list = repliesBySeq.get(reply.seq) || [];
    // Remy, Agora 8702: an agent answered his replies in the reply format, and
    // the feed labeled every sender it could not identify "You", so he seemed
    // to talk to himself. Only a registered human reply is "You"; any other
    // sender shows its handle, or "an agent" with its short id when the
    // registration is gone.
    const byHuman = sender.role === 'human';
    const label = byHuman ? 'You' : (sender.handle || `an agent (${String(message.from || '').slice(0, 8)})`);
    list.push({ id: message.id, seq: message.seq, createdAt: message.createdAt, text: reply.text, byHuman, label,
      from: { id: message.from, handle: sender.handle || '', role: sender.role || '' } });
    repliesBySeq.set(reply.seq, list);
  }
  for (const list of repliesBySeq.values()) list.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  return messages
    .map((message) => ({ message, parsed: parseA2H(message.body) }))
    .filter(({ message, parsed }) => parsed && byId.get(message.from)?.role !== 'human')
    .map(({ message, parsed }) => {
      const sender = byId.get(message.from) || {};
      const replies = repliesBySeq.get(message.seq) || [];
      const answered = replies.some((reply) => reply.from?.role === 'human');
      const needLabel = answered ? 'Answered · needs agent follow-up' : A2H_NEEDS[parsed.need];
      return {
        id: message.id,
        seq: message.seq,
        createdAt: message.createdAt,
        to: message.to,
        need: parsed.need,
        needLabel,
        answered,
        ref: parsed.ref,
        refKind: refKind(parsed.ref, { tasks, campaigns }),
        refTitle: refTitle(parsed.ref, { tasks, campaigns }),
        text: parsed.text,
        from: {
          id: message.from,
          handle: sender.handle || '',
          role: sender.role || '',
          model: sender.model || '',
          status: sender.status || 'gone',
        },
        replies,
      };
    })
    .sort((a, b) => (b.seq || 0) - (a.seq || 0));
}
