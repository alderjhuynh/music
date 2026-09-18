const VISUALIZER_ORIGIN = 'https://visualize.auraea.fyi';
const ALBUMS_URL = `${VISUALIZER_ORIGIN}/albums.json`;

const listEl = document.getElementById('list');
const trackCountEl = document.getElementById('trackCount');
const totalTimeEl = document.getElementById('totalTime');
const albumSwitcherEl = document.getElementById('albumSwitcher');
const nowIndex = document.getElementById('nowIndex');
const nowTitle = document.getElementById('nowTitle');
const nowTag = document.getElementById('nowTag');
const nowEnter = document.getElementById('nowEnter');
const stage = document.getElementById('stage');

let ALBUMS = [];
let currentAlbum = null;
let TRACKS = [];
let current = -1;

function fmtTime(s){
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
function pad(n){ return String(n).padStart(2, '0'); }

function setStatus(message){
  if (listEl) listEl.innerHTML = `<div class="list-status">${message}</div>`;
  if (trackCountEl) trackCountEl.textContent = '0 tracks';
  if (totalTimeEl) totalTimeEl.textContent = '0:00 total';
}

function syncAuraeaLinks(theme){
  document.querySelectorAll('.wordmark a, a[href*="about/"], a[href*="auraea.fyi"]').forEach((a) => {
    try{
      const url = new URL(a.href, window.location.href);
      url.searchParams.set('theme', theme);
      a.href = url.toString();
    } catch {}
  });
}

function applyTheme(theme){
  const doSync = () => syncAuraeaLinks(theme);
  const isInitial = !document.body.dataset.theme;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isInitial || prefersReduced){
    document.body.dataset.theme = theme;
    doSync();
    return Promise.resolve();
  }
  if (document.startViewTransition){
    try{
      const vt = document.startViewTransition(() => {
        document.body.dataset.theme = theme;
        doSync();
      });
      return vt.finished.catch(() => {});
    } catch (_){}
  }
  return new Promise((resolve) => {
    const el = stage;
    const prev = el.style.transition;
    el.style.transition = 'opacity 220ms ease';
    el.style.opacity = '0.18';
    setTimeout(() => {
      document.body.dataset.theme = theme;
      doSync();
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        setTimeout(() => {
          el.style.transition = prev;
          if (!el.style.transition) el.style.removeProperty('transition');
          el.style.removeProperty('opacity');
          resolve();
        }, 380);
      });
    }, 220);
  });
}

function renderAlbumSwitcher(){
  if (!albumSwitcherEl) return;
  albumSwitcherEl.innerHTML = '';
  if (ALBUMS.length < 2) return;
  ALBUMS.forEach((a) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = a.title;
    btn.classList.toggle('active', currentAlbum && a.id === currentAlbum.id);
    btn.addEventListener('click', () => {
      if (currentAlbum && a.id === currentAlbum.id) return;
      switchAlbum(a);
    });
    albumSwitcherEl.appendChild(btn);
  });
}

async function switchAlbum(album){
  current = -1;
  currentAlbum = album;
  document.body.dataset.album = album.id;
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  const isAbout = window.location.pathname.includes('/about');
  const validThemes = new Set(['desert', 'impact', 'rave', 'dance']);
  const effectiveTheme = (isAbout && validThemes.has(urlTheme)) ? urlTheme : album.theme;
  await applyTheme(effectiveTheme);
  renderAlbumSwitcher();
  if (nowIndex) nowIndex.textContent = '00';
  if (nowTitle) nowTitle.textContent = 'nothing loaded';
  if (nowTag) nowTag.textContent = 'choose a track to begin';
  if (nowEnter) {
    nowEnter.disabled = true;
    nowEnter.textContent = 'enter';
  }
  await loadTracksForAlbum(album);
}

function render(){
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!TRACKS.length){
    setStatus('no tracks yet - check back soon');
    return;
  }

  TRACKS.forEach((t, i) => {
    const row = document.createElement('button');
    row.className = 'row';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', i === current ? 'true' : 'false');
    row.dataset.index = i;
    const hideTag = currentAlbum && (currentAlbum.id === 'distant-horizons' || currentAlbum.id === 'dance');
    row.innerHTML = `
      <div class="row-index">${pad(i + 1)}</div>
      <div class="row-body">
        <div class="row-title">${t.title}</div>
        ${hideTag ? '' : `<div class="row-tag">${t.tag}</div>`}
      </div>
      <div class="row-attrs">
        <div><span class="attr-label">key</span><span class="attr-value">${t.key}</span></div>
        <div><span class="attr-label">bpm</span><span class="attr-value">${t.tempo}</span></div>
      </div>
      <div class="row-duration">${fmtTime(t.duration)}</div>
    `;
    row.addEventListener('click', () => select(i));
    listEl.appendChild(row);
  });
  updateCurrentStyling();

  if (trackCountEl) trackCountEl.textContent = `${TRACKS.length} track${TRACKS.length === 1 ? '' : 's'}`;
  const total = TRACKS.reduce((sum, t) => sum + t.duration, 0);
  if (totalTimeEl) totalTimeEl.textContent = `${fmtTime(total)} total`;
}

function updateCurrentStyling(){
  if (!listEl) return;
  [...listEl.children].forEach((row, i) => {
    row.classList.toggle('is-current', i === current);
    row.setAttribute('aria-selected', i === current ? 'true' : 'false');
  });
}

function select(i){
  current = i;
  updateCurrentStyling();
  const t = TRACKS[i];
  if (nowIndex) nowIndex.textContent = pad(i + 1);
  if (nowTitle) nowTitle.textContent = t.title;
  if (nowTag) nowTag.textContent = `${t.key} · ${t.tempo} bpm · ${fmtTime(t.duration)}`;
  if (nowEnter) nowEnter.disabled = false;
  if (listEl && listEl.children[i]) listEl.children[i].focus();
}

function enterTrack(){
  if (current < 0) return;
  const t = TRACKS[current];
  if (stage) stage.classList.add('is-launching');
  if (nowEnter) {
    nowEnter.disabled = true;
    nowEnter.textContent = 'loading…';
  }
  const albumParam = currentAlbum ? `album=${encodeURIComponent(currentAlbum.id)}&` : '';
  window.location.href = `${VISUALIZER_ORIGIN}/?${albumParam}track=${encodeURIComponent(t.id)}`;
}

if (nowEnter) nowEnter.addEventListener('click', enterTrack);

// keyboard nav
document.addEventListener('keydown', (e) => {
  // lr album switch
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    if (ALBUMS.length < 2 || !currentAlbum) return;
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    const idx = ALBUMS.findIndex(a => a.id === currentAlbum.id);
    if (idx < 0) return;
    const nextIdx = e.key === 'ArrowRight'
      ? (idx + 1) % ALBUMS.length
      : (idx - 1 + ALBUMS.length) % ALBUMS.length;
    if (nextIdx !== idx) switchAlbum(ALBUMS[nextIdx]);
    return;
  }

  if (!TRACKS.length) return;
  if (e.key === 'ArrowDown'){
    e.preventDefault();
    select(Math.min((current < 0 ? -1 : current) + 1, TRACKS.length - 1));
  } else if (e.key === 'ArrowUp'){
    e.preventDefault();
    select(Math.max((current < 0 ? 1 : current) - 1, 0));
  } else if (e.key === 'Enter' && document.activeElement.classList.contains('row')){
    enterTrack();
  }
});

async function loadTracksForAlbum(album){
  setStatus('loading tracks…');
  const manifestUrl = `${VISUALIZER_ORIGIN}/${album.path}manifest.json`;
  try {
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    const manifest = await res.json();
    TRACKS = manifest.map(t => ({
      id: t.id,
      title: t.title,
      tag: t.tag,
      key: t.key,
      tempo: t.tempo,
      duration: t.duration,
    }));
  } catch (err) {
    console.error('Failed to load track manifest for album', album.id, err);
    setStatus('could not load tracks; try refreshing');
    return;
  }
  render();
}

async function loadAlbums(){
  setStatus('loading tracks…');
  try {
    const res = await fetch(ALBUMS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`albums fetch failed: ${res.status}`);
    ALBUMS = await res.json();
  } catch (err){
    console.error('Failed to load albums.json, falling back to single manifest', err);
    ALBUMS = [{ id: 'witness', title: 'WITNESS ME IN MY FULL GLORY', theme: 'impact', path: '' }];
  }
  if (!ALBUMS.length){
    setStatus('no albums configured');
    return;
  }
  await switchAlbum(ALBUMS[0]);
}

loadAlbums();

(function(){
  const wordmark = document.querySelector('.wordmark');
  const homeLink = document.querySelector('.wordmark-link--home');
  const aboutLink = document.querySelector('.wordmark-link--about');
  if (!wordmark || !homeLink) return;
  const addPrimed = () => wordmark.classList.add('wordmark--primed');
  const removePrimed = () => wordmark.classList.remove('wordmark--primed');
  homeLink.addEventListener('mouseenter', addPrimed);
  homeLink.addEventListener('focus', addPrimed);
  wordmark.addEventListener('mouseleave', removePrimed);
  wordmark.addEventListener('focusout', (e) => {
    if (!wordmark.contains(e.relatedTarget)) removePrimed();
  });
  homeLink.addEventListener('click', addPrimed);

  // hover alt for mobile (forgot mobile users exist)
  const coarseMql = window.matchMedia('(hover: none), (pointer: coarse)');
  const isCoarse = () => coarseMql.matches;
  const isOpen = () => wordmark.classList.contains('wordmark--open');
  const setOpen = (open) => {
    wordmark.classList.toggle('wordmark--open', open);
    homeLink.setAttribute('aria-expanded', String(open));
  };
  homeLink.setAttribute('aria-expanded', 'false');
  homeLink.setAttribute('aria-haspopup', 'true');

  homeLink.addEventListener('click', (e) => {
    if (!isCoarse()) return;
    if (!isOpen()) {
      e.preventDefault();
      setOpen(true);
      addPrimed();
    }
  });

  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (wordmark.contains(e.target)) return;
    setOpen(false);
    removePrimed();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      removePrimed();
      homeLink.focus();
    }
  });
  if (aboutLink) {
    aboutLink.addEventListener('click', () => setOpen(false));
  }
  if (coarseMql.addEventListener) {
    coarseMql.addEventListener('change', () => {
      if (!isCoarse() && isOpen()) setOpen(false);
    });
  } else if (coarseMql.addListener) {
    coarseMql.addListener(() => {
      if (!isCoarse() && isOpen()) setOpen(false);
    });
  }
})();
