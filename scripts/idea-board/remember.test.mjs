/**
 * Proves personal collection transfer, provenance preservation, and the actual
 * capture/review controls using disposable data. No user browser storage is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseIdeaRoute } from '../../public/idea-board/lib.mjs';
import { emptyRemember, mergeRemember, parseRememberPayload, saveRemember, readRemember, REMEMBER_KEY, REMEMBER_BACKUP_KEY } from '../../public/idea-board/remember-store.mjs';

const idea = (id = 'legacy') => ({ id, title: 'Legacy thought', note: 'Keep exact notes', scope: 'Work', project: 'Example project', theme: 'Research', status: 'investigating', date: '2026-08-29', reviewed: 1234, next: 'A small experiment', implementationStatus: 'Partially implemented', implementationEvidence: 'Historical evidence, not acceptance', source: [{ id: 'chat-original', title: 'Exact source title', date: '2026-08-01' }], extraProvenance: { preserved: true } });
const memoryStorage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) }; };

test('Remember route coexists with stable research and revision routes', () => {
  assert.equal(parseIdeaRoute('#/remember?transfer=abc').view, 'remember');
  assert.equal(parseIdeaRoute('#/ideas/IB-0001').view, 'record');
  assert.equal(parseIdeaRoute('#/ideas/IB-0001/revisions/IB-0001-R001').view, 'revision');
});
test('legacy and previous export formats preserve every personal field', () => {
  const original = idea();
  for (const payload of [[original], { personalIdeas: [original], researchSnapshot: { records: ['must not import'] } }, { rawIdeas: JSON.stringify([original]) }, { version: 1, ideas: [original], trash: [] }]) {
    assert.deepEqual(parseRememberPayload(payload).ideas, [original]);
  }
  assert.throws(() => parseRememberPayload([{ id: 'bad' }]));
  assert.throws(() => parseRememberPayload([{ ...original, source: 'not an array' }]));
});
test('repeated imports are idempotent and conflicting versions survive separately', () => {
  const old = idea(); const changed = { ...old, note: 'New edits on destination' };
  const current = { ...emptyRemember(), ideas: [changed] };
  const first = mergeRemember(current, [old]);
  assert.equal(first.conflicts, 1); assert.equal(first.next.ideas.length, 2);
  assert.equal(first.next.ideas[0].note, changed.note);
  assert.equal(first.next.ideas[1].note, old.note);
  assert.deepEqual(first.next.ideas[1].source, old.source);
  assert.equal(mergeRemember(first.next, [old]).added, 0);
  assert.deepEqual(current.ideas, [changed]);
});
test('trash survives backups; re-import does not resurrect an identical deleted idea', () => {
  const current = { ...emptyRemember(), trash: [idea()] };
  const next = mergeRemember(current, [idea()]).next;
  assert.equal(next.ideas.length, 0); assert.equal(next.trash.length, 1);
  assert.equal(parseRememberPayload(current).trash.length, 1);
});
test('known projects transfer even when no idea currently uses them', () => {
  const result = mergeRemember(emptyRemember(), { personalIdeas: [], projects: ['One', 'Two'] });
  assert.deepEqual(result.next.projects, ['One', 'Two']);
  assert.deepEqual(mergeRemember(result.next, {personalIdeas:[],projects:['Two','Three']}).next.projects,['One','Two','Three']);
});
test('saved state is verified and the previous collection remains exportable', () => {
  const storage = memoryStorage(); const first = { ...emptyRemember(), ideas: [idea()] };
  saveRemember(storage, first);
  saveRemember(storage, { ...first, ideas: [...first.ideas, idea('another')] });
  assert.deepEqual(JSON.parse(storage.getItem(REMEMBER_BACKUP_KEY)), first);
  assert.equal(readRemember(storage).ideas.length, 2);
  assert.throws(() => saveRemember({ getItem:()=>null,setItem:()=>{throw new Error('quota');} }, first), /quota/);
  storage.setItem(REMEMBER_KEY, '{corrupt'); assert.throws(() => readRemember(storage));
});

test('native capture, edit, review, filter, archive, trash, restore and transfer acknowledgement', async () => {
  const dom = new JSDOM('<div id="test-root"></div>', { url: 'http://localhost:9999/index.html#/remember' });
  const names = ['window','document','localStorage','location','FormData'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis,name)]));
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  dom.window.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');};
  try {
    const { mountRemember } = await import('../../public/idea-board/remember.mjs');
    const root = document.querySelector('#test-root');
    saveRemember(localStorage, { ...emptyRemember(), ideas: [idea()] });
    mountRemember(root);
    const click = selector => { const node=root.querySelector(selector); assert.ok(node, selector); node.click(); };
    click('[data-action=capture]');
    root.querySelector('[name=title]').value = 'New personal thought';
    root.querySelector('[name=note]').value = '<img src=x onerror=alert(1)>';
    root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(readRemember(localStorage).ideas.length, 2);
    assert.equal(root.querySelectorAll('img').length, 0);
    click('[data-view=review]'); assert.equal(root.querySelectorAll('.remember-card').length,1);
    click('[data-action=keep]'); assert.equal(root.querySelectorAll('.remember-card').length,0);
    click('[data-view=garden]');
    click('[data-id="legacy"] [data-action=edit]'); root.querySelector('[name=title]').value='Edited legacy';
    root.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    assert.deepEqual(readRemember(localStorage).ideas.find(i=>i.id==='legacy').source,idea().source);
    assert.deepEqual(readRemember(localStorage).ideas.find(i=>i.id==='legacy').extraProvenance,{preserved:true});
    click('[data-id="legacy"] [data-action=archive]'); click('[data-view=archived]');
    assert.equal(root.querySelectorAll('.remember-card').length,1);
    click('[data-action=delete]'); click('[data-view=trash]'); click('[data-action=restore]');
    assert.equal(readRemember(localStorage).trash.length,0);
    click('[data-view=archived]'); assert.equal(root.querySelectorAll('.remember-card').length,1);
    click('[data-action=unarchive]'); click('[data-view=garden]');
    const search=root.querySelector('#remember-search'); search.value='Edited legacy'; search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(root.querySelectorAll('.remember-card').length,1);
    const nonce='12345678-1234-1234-1234-123456789012';
    dom.window.location.hash='#/remember?transfer='+nonce;
    const replies=[]; const opener={postMessage:message=>replies.push(message)}; dom.window.opener=opener;
    const transfer={type:'remember-transfer-data',nonce,payload:{personalIdeas:[idea('transferred')]}};
    dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'https://evil.example',source:opener,data:transfer}));
    assert.equal(replies.length,0);
    dom.window.dispatchEvent(new dom.window.MessageEvent('message',{origin:'null',source:opener,data:transfer}));
    assert.equal(replies[0].type,'remember-transfer-saved');
    assert.ok(readRemember(localStorage).ideas.some(i=>i.id==='transferred'));
  } finally {
    dom.window.close();
    for (const name of names) { const descriptor=previous.get(name); if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]; }
  }
});
