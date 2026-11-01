const { execSync } = require('child_process');
const out = execSync('node "tools/agora/gapIndex.mjs" --open-only', { encoding: 'utf8' });

// The gapIndex emits the JSON array to stdout. The summary line is NOT in the
// JSON; it was in an earlier version's stdout. This version writes pure JSON,
// so we infer counts from the JSON itself.

const json = JSON.parse(out);
const global = json.filter(g => g.project === 'global');
const spells = json.filter(g => g.project === 'spells');
const ideaboard = json.filter(g => g.project === 'idea-board');

function summarize(label, arr) {
  const open = arr.filter(g => g.status === 'open').length;
  const total = arr.length;
  console.log(`${label}: ${open} open / ${total} total`);
  return { open, total };
}

console.log('gapIndex JSON parsed OK;', json.length, 'gaps total');
const g = summarize('global', global);
const s = summarize('spells', spells);
const i = summarize('idea-board', ideaboard);

const totalOpen = g.open + s.open + i.open;
const totalAll = g.total + s.total + i.total;
console.log(`TOTAL across projects: ${totalOpen} open / ${totalAll} total`);

// Check that every item has the 12 expected schema fields
const required = ['id','status','classification','surface','owner','suggestedAgent','registeredBy','registrantAgentId','registrantTaskId','gap','evidence','nextAction','project','file'];
const bad = json.filter(g => required.some(f => g[f] === undefined));
console.log('rows missing required fields:', bad.length, bad.slice(0,3).map(g=>g.id));

// Check the GG-DEVHUB-TRACKER-COLS row specifically
const devhub = json.find(g => g.id === 'GG-DEVHUB-TRACKER-COLS');
console.log('GG-DEVHUB-TRACKER-COLS present:', !!devhub, devhub ? `status=${devhub.status}` : '');
