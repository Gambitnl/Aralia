/** The progress view is an existing generated snapshot, not another roadmap.
 * Planmap hosts that same document at desktop width; canonical records keep
 * their authority. Clones without the ignored snapshot still get source links. */
const base = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const link = document.getElementById('project-progress-link');
const panel = document.getElementById('project-progress');
const frame = document.getElementById('project-progress-frame');
const notice = document.getElementById('project-progress-notice');
const close = document.getElementById('project-progress-close');
let previousFocus;
let request;
let background = [];

for (const anchor of panel.querySelectorAll('[data-project-record]')) {
  anchor.href = `${base}/${anchor.dataset.projectRecord}`;
}
const href = new URL(location.href);
href.searchParams.set('view', 'project-progress');
link.href = href.href;

async function show() {
  if (!panel.hidden) return;
  previousFocus = document.activeElement;
  background = [...document.body.children].filter(node => node !== panel && node instanceof HTMLElement).map(node => [node, node.inert]);
  for (const [node] of background) node.inert = true;
  panel.hidden = false;
  document.body.style.overflow = 'hidden';
  close.focus();
  notice.hidden = false;
  notice.textContent = 'Opening the existing project snapshot…';
  const controller = new AbortController();
  request = controller;
  try {
    const source = `${base}/.project-map/index.html`;
    const response = await fetch(source, { signal: controller.signal, cache: 'no-store' });
    const html = await response.text();
    // Vite may return the game shell with HTTP 200 for a missing local file.
    // Treat that as unavailable rather than presenting a game in the roadmap.
    if (!response.ok || !html.includes('gameplay-canonical-snapshot')) throw new Error('No local snapshot');
    if (request !== controller || panel.hidden) return;
    frame.hidden = false;
    frame.src = source;
    notice.hidden = true;
  } catch (error) {
    if (controller.signal.aborted) return;
    notice.textContent = 'The local project snapshot is unavailable. The canonical records above remain available; no status has been inferred or copied.';
  }
}
function hide() {
  request?.abort();
  request = undefined;
  panel.hidden = true;
  frame.hidden = true;
  frame.removeAttribute('src');
  document.body.style.overflow = '';
  for (const [node, inert] of background) node.inert = inert;
  background = [];
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  previousFocus?.focus();
}
link.addEventListener('click', event => {
  if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  history.pushState(null, '', link.href);
  show();
});
close.addEventListener('click', hide);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) hide(); });
frame.addEventListener('load', () => {
  // The generic entry shows the complete shared view. An explicit focus may
  // scroll to an existing section; it never filters or copies another owner.
  const focus = new URL(location.href).searchParams.get('focus');
  if (focus && /^[a-zA-Z][\w:-]{0,100}$/.test(focus)) frame.contentDocument?.getElementById(focus)?.scrollIntoView({ block: 'start' });
});
const isProjectView = () => ['project-progress', 'gameplay-flow'].includes(new URL(location.href).searchParams.get('view'));
window.addEventListener('popstate', () => {
  if (isProjectView()) show();
  else hide();
});
if (isProjectView()) show();
