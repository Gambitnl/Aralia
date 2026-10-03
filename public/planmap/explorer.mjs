import { createDocLinkResolver } from './doc-link-derive.mjs';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, byId, links;
let campaign = '', subgroup = '', selected = '', mode = 'topics';
const depId = dep => typeof dep === 'string' ? dep : dep.id;
const status = t => `<span class="status ${esc(t.status)}">${esc(t.status || 'unknown')}</span>`;
const label = t => data.campaigns[t.campaign]?.label || t.campaign;
const card = t => `<button class="topic ${selected === t.id ? 'selected' : ''}" data-topic="${esc(t.id)}"><strong>${esc(t.title)}</strong><span class="meta">${status(t)}<span>${esc(label(t))}</span></span><span class="meta">${(t.features || []).length} steps · ${(t.deps || []).length} prerequisites</span></button>`;
function navigation() {
  $('campaigns').innerHTML = '<h2>Campaigns</h2>' + [['','All campaigns'], ...Object.entries(data.campaigns).map(([id,c])=>[id,c.label])].map(([id,name]) => `<button data-campaign="${esc(id)}" class="${campaign===id&&!subgroup?'selected':''}"><span>${esc(name)}</span><small>${data.topics.filter(t=>!id||t.campaign===id).length}</small></button>` + (id && campaign===id ? [...new Set(data.topics.filter(t=>t.campaign===id).map(t=>t.subcampaign || 'General'))].map(s=>`<button class="sub ${subgroup===s?'selected':''}" data-sub="${esc(s)}">${esc(s)}</button>`).join('') : '')).join('');
}
function detail() {
  const t = byId[selected]; $('detail').hidden = !t;
  if (!t) return;
  const doc = path => { try { return `<a href="${esc(links.href(path))}" target="_blank" rel="noopener">Open document</a>`; } catch { return '<span>Document link unavailable</span>'; } };
  $('detail').innerHTML = `<button class="close" aria-label="Close details">×</button><h2>${esc(t.title)}</h2><div class="meta">${status(t)}<span>${esc(label(t))}</span></div><p>${esc(t.sub || '')}</p>${t.status_note?`<p>${esc(t.status_note)}</p>`:''}${t.link?doc(t.link):''}<h3>Steps (${(t.features||[]).length})</h3><ol>${(t.features||[]).map(f=>`<li>${esc(f.title)}<div class="meta">${status(f)}${f.open?`${f.open} open questions`:''}</div>${f.link?doc(f.link):''}</li>`).join('')}</ol>`;
}
function render() {
  navigation(); detail();
  $('heading').textContent = subgroup || data.campaigns[campaign]?.label || 'All campaigns';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===mode)));
  const query=$('search').value.trim().toLowerCase();
  const topics=data.topics.filter(t=>(query || !campaign || t.campaign===campaign) && (query || !subgroup || (t.subcampaign||'General')===subgroup) && (!$('status').value || t.status===$('status').value) && (!query || `${t.title} ${t.sub||''}`.toLowerCase().includes(query)));
  if(mode==='dependencies') {
    const t=byId[selected];
    if(!t){$('content').innerHTML='<p class="empty">Select a topic</p><div class="grid">'+topics.map(card).join('')+'</div>';return;}
    // Relationships are read from the canonical data, never inferred from position.
    const requires=(t.deps||[]).map(d=>({topic:byId[depId(d)],dep:d}));
    const unlocks=data.topics.flatMap(x=>(x.deps||[]).filter(d=>depId(d)===t.id).map(d=>({topic:x,dep:d})));
    const column=items=>items.length?items.map(({topic,dep})=>(topic?card(topic):`<p>Missing topic: ${esc(depId(dep))}</p>`)+`<p class="relation">${esc(dep.kind==='chosen'?'Chosen order':'Hard prerequisite')}${dep.feature?` · Feature: ${esc(dep.feature)}`:''}${dep.why?`<br>${esc(dep.why)}`:''}</p>`).join(''):'<p class="empty">None</p>';
    $('content').innerHTML=`<div class="graph"><section><h2>Requires (${requires.length})</h2>${column(requires)}</section><span class="connector" aria-hidden="true">→</span><section><h2>Selected topic</h2>${card(t)}</section><span class="connector" aria-hidden="true">→</span><section><h2>Unlocks (${unlocks.length})</h2>${column(unlocks)}</section></div>`;
  } else if(mode==='history') {
    // Updated is explicitly a change date, not a fabricated completion date.
    const dated=[...topics].sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
    $('content').innerHTML='<h2 style="font-size:14px">Latest recorded changes</h2>'+dated.map(t=>`<div class="history-row"><time>${esc(t.updated||'Undated')}</time>${card(t)}</div>`).join('');
  } else $('content').innerHTML=topics.length?`<div class="meta" style="margin-bottom:16px">${topics.length} topics</div><div class="grid">${topics.map(card).join('')}</div>`:'<p class="empty">No matching topics.</p>';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!data)return;
  if(b.hasAttribute('data-campaign')){campaign=b.dataset.campaign;subgroup='';selected='';mode='topics';$('search').value='';}
  else if(b.hasAttribute('data-sub')){subgroup=b.dataset.sub;selected='';mode='topics';}
  else if(b.dataset.topic){selected=b.dataset.topic;history.replaceState(null,'',`#${encodeURIComponent(selected)}`);}
  else if(b.dataset.view)mode=b.dataset.view;
  else if(b.classList.contains('close')){selected='';history.replaceState(null,'',location.pathname);}
  else return;
  render();
});
$('search').addEventListener('input',()=>{mode='topics';render();});
$('status').addEventListener('change',render);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected='';render();}});
try {
  const response=await fetch('./topics.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();byId=Object.fromEntries(data.topics.map(t=>[t.id,t]));links=createDocLinkResolver();
  selected=decodeURIComponent(location.hash.slice(1));if(!byId[selected])selected='';
  campaign=selected?byId[selected].campaign:Object.keys(data.campaigns)[0];render();
} catch(error){$('content').textContent=`Roadmap could not load: ${error.message}. Reload to retry.`;}
