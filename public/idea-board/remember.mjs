/**
 * Remember's personal inbox, now a native page inside the Idea Board.
 * Capture, review, project tags, archive, trash, and backups live in this browser.
 * Research remains in the existing Index; private chat-derived ideas are never
 * bundled into public files or submitted to a server. app.mjs mounts this page.
 */
import { emptyRemember, mergeRemember, readRemember, saveRemember, REMEMBER_KEY, REMEMBER_BACKUP_KEY } from './remember-store.mjs';

const scopes = ['Aralia', 'Personal', 'Work', 'Other'];
const statuses = ['fresh', 'investigating', 'someday', 'archived'];
const implementations = ['Unknown', 'Proposed', 'Investigating', 'Partially implemented', 'Implemented'];
const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const date = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date unknown';
const safeLink = value => /^https?:\/\//i.test(value || '') ? value : '';
const options = (values, selected) => [...new Set([...values, selected].filter(Boolean))].map(value => `<option ${value === selected ? 'selected' : ''}>${escape(value)}</option>`).join('');
let collection, loadError = '', notify = () => {}, mounted = false;
const filters = { query: '', scope: '', project: '', status: '', sort: 'newest', view: 'garden', layout: 'grid' };

function load() {
  try { collection = readRemember(localStorage); loadError = ''; }
  catch (error) { collection = emptyRemember(); loadError = `Saved ideas could not be loaded: ${error.message}. Existing data has not been changed.`; }
}
function persist(next) {
  if (loadError) throw new Error(loadError);
  // Re-read before every edit so another open tab cannot silently lose changes.
  saveRemember(localStorage, next); collection = next;
}
function modify(action) {
  const current = readRemember(localStorage); action(current); persist(current);
}
function download(value, filename = 'remember-backup.json') {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function receive(payload) {
  if (loadError) throw new Error(loadError);
  const merged = mergeRemember(readRemember(localStorage), payload);
  persist(merged.next);
  return `${merged.added} imported, ${merged.skipped} already present${merged.conflicts ? `; ${merged.conflicts} differing versions kept separately` : ''}.`;
}

// The old file opens this route with a one-use nonce. Only that exact opener
// can send a collection. The acknowledgement is sent after verified storage.
let pendingTransfer = null;
window.addEventListener('message', event => {
  const nonce = new URLSearchParams(location.hash.split('?')[1] || '').get('transfer');
  if (!nonce || !/^[a-zA-Z0-9-]{16,80}$/.test(nonce) || !window.opener || event.source !== window.opener || event.data?.nonce !== nonce) return;
  if (event.origin !== 'null' && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(event.origin)) return;
  const reply = message => event.source.postMessage({ ...message, nonce }, event.origin === 'null' ? '*' : event.origin);
  if (event.data.type === 'remember-transfer-ping') return reply({ type: 'remember-transfer-ready' });
  if (event.data.type !== 'remember-transfer-data') return;
  if (pendingTransfer === nonce) return;
  try {
    load(); const message = receive(event.data.payload); pendingTransfer = nonce;
    reply({ type: 'remember-transfer-saved', message, count: collection.ideas.length });
    location.hash = '#/remember'; notify(message);
  } catch (error) { reply({ type: 'remember-transfer-error', message: error.message }); notify(error.message); }
});

export function mountRemember(container) {
  mounted = true; load();
  if (!document.querySelector('#remember-css')) {
    const sheet = document.createElement('link'); sheet.id = 'remember-css'; sheet.rel = 'stylesheet'; sheet.href = new URL('./remember.css', import.meta.url); document.head.append(sheet);
  }
  const $ = selector => container.querySelector(selector);
  const draw = (message = '') => {
    if (!container.isConnected) return;
    const projects = [...new Set([...(collection.projects || []), ...collection.ideas.map(i => i.project)].filter(Boolean))].sort();
    const active = collection.ideas.filter(i => i.status !== 'archived');
    const count = { garden: active.length, review: active.filter(i => !i.reviewed).length, themes: new Set(active.map(i => i.theme || 'Unsorted')).size, archived: collection.ideas.length - active.length, trash: collection.trash.length };
    container.innerHTML = `<section class="remember-page">
      <div class="remember-heading"><div><span class="eyebrow">Your personal idea inbox</span><h2>Remember</h2><p>Catch loose thoughts. Decide what deserves your attention.</p></div><div class="remember-actions"><button class="btn btn-primary" data-action="capture">+ Capture idea</button><button class="btn" data-action="import">Import backup</button><button class="btn" data-action="export">Export backup</button></div></div>
      ${!collection.ideas.length && !collection.trash.length ? `<div class="remember-onboarding"><h3>A home for your next idea</h3><p>Capture a thought or import a Remember JSON backup. Imports retain notes, tags, evidence, and source references without overwriting existing ideas.</p></div>` : ''}
      <nav class="remember-tabs" aria-label="Remember views">${Object.entries({ garden: 'Idea garden', review: 'Review', themes: 'Themes', archived: 'Archive', trash: 'Trash' }).map(([key, label]) => `<button class="btn" data-view="${key}" aria-pressed="${filters.view === key}">${label} ${count[key]}</button>`).join('')}</nav>
      <div class="remember-filters"><label>Search<input id="remember-search" type="search" placeholder="Search your ideas…" value="${escape(filters.query)}"></label><label>Belongs to<select id="remember-scope"><option value="">All scopes</option>${options(scopes, filters.scope)}</select></label><label>Project<select id="remember-project"><option value="">All projects</option>${options(projects, filters.project)}</select></label><label>Status<select id="remember-status"><option value="">All statuses</option>${options(statuses, filters.status)}</select></label><label>Sort<select id="remember-sort">${[['newest','Newest first'],['oldest','Oldest first'],['theme','Theme A–Z'],['theme-desc','Theme Z–A']].map(([key,label]) => `<option value="${key}" ${key===filters.sort?'selected':''}>${label}</option>`).join('')}</select></label><button class="btn" data-action="layout">${filters.layout === 'grid' ? 'List view' : 'Grid view'}</button></div>
      <p class="remember-message" id="remember-message" role="status">${escape(loadError || message)}</p><div id="remember-cards" class="remember-grid ${filters.layout === 'list' ? 'list' : ''}"></div>
      <details><summary>Storage, transfer & recovery</summary><p>Saved in this browser at ${escape(location.origin)}. Export a backup before changing browser or address. Research assessments live in the <a href="#/">Index</a>; this page keeps your personal ideas.</p><p>Imports merge without overwriting existing ideas. Differing versions remain separate. Delete moves an idea to Trash, where Restore brings it back.</p><button class="btn" data-action="previous">Export previous saved copy</button></details>
      <input type="file" accept="application/json,.json" id="remember-import" hidden><dialog class="remember-dialog" id="remember-dialog"></dialog></section>`;
    cards();
    $('#remember-search').oninput = event => { filters.query = event.target.value; cards(); };
    for (const field of ['scope', 'project', 'status', 'sort']) $(`#remember-${field}`).onchange = event => { filters[field] = event.target.value; cards(); };
    $('#remember-import').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      try { if (file.size > 15 * 1024 * 1024) throw new Error('This backup exceeds 15 MB.'); draw(receive(JSON.parse(await file.text()))); }
      catch (error) { $('#remember-message').textContent = error.message; }
    };
    container.onclick = event => {
      const view = event.target.closest('[data-view]');
      if (view) { filters.view = view.dataset.view; filters.status = ''; if (filters.view === 'themes') filters.sort = 'theme'; if (filters.view === 'review') filters.sort = 'oldest'; draw(); return; }
      const button = event.target.closest('[data-action]'); if (!button) return;
      const id = button.closest('[data-id]')?.dataset.id;
      try {
        switch (button.dataset.action) {
          case 'capture': editor(); break;
          case 'edit': editor(collection.ideas.find(i => i.id === id)); break;
          case 'import': $('#remember-import').click(); break;
          case 'export': download(loadError ? localStorage.getItem(REMEMBER_KEY) : { ...collection, exportedAt: new Date().toISOString() }); break;
          case 'previous': { const raw = localStorage.getItem(REMEMBER_BACKUP_KEY); if (!raw) throw new Error('No previous saved copy yet.'); download(raw, 'remember-previous.json'); break; }
          case 'layout': filters.layout = filters.layout === 'grid' ? 'list' : 'grid'; draw(); break;
          case 'close': $('#remember-dialog').close(); break;
          case 'delete': modify(s => { const index = s.ideas.findIndex(i => i.id === id); if (index < 0) return; s.trash.push(...s.ideas.splice(index, 1)); }); draw('Moved to Trash. You can restore it there.'); break;
          case 'restore': modify(s => { const index = s.trash.findIndex(i => i.id === id); if (index < 0) return; s.ideas.push(...s.trash.splice(index, 1)); }); draw('Idea restored.'); break;
          case 'keep': case 'develop': case 'archive': case 'unarchive':
            modify(s => { const idea = s.ideas.find(i => i.id === id); if (!idea) return; if (button.dataset.action === 'archive') idea.status = 'archived'; else if (button.dataset.action === 'unarchive') idea.status = 'fresh'; else { idea.reviewed = Date.now(); if (button.dataset.action === 'develop') idea.status = 'investigating'; } }); draw('Idea updated.'); break;
        }
      } catch (error) { $('#remember-message').textContent = `Could not save: ${error.message}`; }
    };
  };
  function cards() {
    let rows = filters.view === 'trash' ? collection.trash : collection.ideas.filter(i => filters.view === 'archived' ? i.status === 'archived' : i.status !== 'archived');
    if (filters.view === 'review') rows = rows.filter(i => !i.reviewed);
    rows = rows.filter(i => (!filters.scope || (i.scope || 'Other') === filters.scope) && (!filters.project || i.project === filters.project) && (!filters.status || i.status === filters.status) && `${i.title} ${i.note||''} ${i.theme||''} ${i.project||''} ${i.next||''}`.toLowerCase().includes(filters.query.toLowerCase()));
    const age = i => Date.parse(i.date) || 0;
    rows.sort((a,b) => filters.sort === 'oldest' ? age(a)-age(b) : filters.sort.startsWith('theme') ? (filters.sort==='theme-desc'?-1:1)*String(a.theme||'').localeCompare(b.theme||'') || age(b)-age(a) : age(b)-age(a));
    $('#remember-cards').innerHTML = rows.map(i => `<article class="remember-card" data-id="${escape(i.id)}"><header><span class="pill">${escape(i.status||'fresh')}</span><time>${escape(date(i.date))}</time></header><h3>${escape(i.title)}</h3><p>${escape(i.note)}</p><div class="remember-meta"><span class="pill">${escape(i.scope||'Other')}</span>${i.project?`<span class="pill">${escape(i.project)}</span>`:''}<span class="pill">${escape(i.theme||'Unsorted')}</span></div><p>Implementation: ${escape(i.implementationStatus||'Unknown')}</p>${i.next?`<p>Next: ${escape(i.next)}</p>`:''}<div class="remember-card-footer">${filters.view==='trash'?'<button class="btn" data-action="restore">Restore</button>':`<button class="btn" data-action="edit">Open / edit</button>${filters.view==='review'?'<button class="btn" data-action="keep">Keep</button><button class="btn" data-action="develop">Investigate</button>':''}<button class="btn" data-action="${i.status==='archived'?'unarchive':'archive'}">${i.status==='archived'?'Unarchive':'Archive'}</button><button class="btn" data-action="delete">Delete</button>`}</div></article>`).join('') || '<div class="remember-onboarding"><h3>No ideas in this view</h3><p>Try another filter or capture a new thought.</p></div>';
  }
  function editor(idea) {
    const original = idea || { id: crypto.randomUUID(), title: '', note: '', scope: 'Personal', theme: 'Research', project: '', status: 'fresh', implementationStatus: 'Unknown', date: new Date().toISOString(), next: '' };
    const text = (name, label, multiline = false) => `<label>${label}${multiline?`<textarea name="${name}" rows="4">${escape(original[name])}</textarea>`:`<input name="${name}" value="${escape(original[name])}" ${name==='title'?'required':''} ${name==='project'?'list="remember-project-options"':''}>`}</label>`;
    $('#remember-dialog').innerHTML = `<form><h3>${idea?'Review idea':'Capture an idea'}</h3>${text('title','Idea title')}${text('note','Notes',true)}<div class="remember-form-row"><label>Belongs to<select name="scope">${options(scopes,original.scope||'Other')}</select></label>${text('project','Specific project (optional)')}${text('theme','Theme')}<label>Status<select name="status">${options(statuses,original.status||'fresh')}</select></label><label>Implementation status<select name="implementationStatus">${options(implementations,original.implementationStatus||'Unknown')}</select></label>${text('next','Next step')}</div>${text('implementationEvidence','Implementation evidence',true)}${text('sourceUrl','Source URL')}
      ${(original.source||[]).length?`<div class="remember-evidence"><b>Original sources</b><ul>${original.source.map(s=>`<li>${escape(s.title)} · ${escape(s.date)}<br>${escape(s.id)}</li>`).join('')}</ul></div>`:''}${safeLink(original.sourceUrl)?`<a href="${escape(original.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>`:''}
      <datalist id="remember-project-options">${options([...(collection.projects||[]),...collection.ideas.map(i=>i.project)],'')}</datalist><p id="remember-save-error" role="alert"></p><div class="remember-actions"><button class="btn" type="button" data-action="close">Cancel</button><button class="btn btn-primary" type="submit">Save idea</button></div></form>`;
    $('#remember-dialog').querySelector('form').onsubmit = event => {
      event.preventDefault();
      try {
        const fields = Object.fromEntries(new FormData(event.target)); fields.title = fields.title.trim();
        if (!fields.title) throw new Error('Add a title for your idea.');
        modify(s => { const index = s.ideas.findIndex(i=>i.id===original.id); const updated = { ...(index<0?original:s.ideas[index]), ...fields }; if(index<0)s.ideas.unshift(updated);else s.ideas[index]=updated; });
        $('#remember-dialog').close(); if (!idea) { filters.view='garden'; filters.query=''; filters.scope=''; filters.project=''; filters.status=''; } draw('Idea saved.');
      } catch(error) { $('#remember-save-error').textContent = error.message; }
    };
    $('#remember-dialog').showModal(); $('#remember-dialog').querySelector('[name=title]').focus();
  }
  notify = message => { if (container.isConnected) draw(message); };
  draw();
}

window.addEventListener('storage', event => {
  if (event.key === REMEMBER_KEY && mounted) { load(); notify('Collection updated in another tab.'); }
});
window.addEventListener('keydown', event => {
  const search = document.querySelector('#remember-search');
  if (search && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); }
});
