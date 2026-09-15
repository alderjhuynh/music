const VISUALIZER_ORIGIN = 'https://visualize.auraea.fyi';
const MANIFEST_URL = `${VISUALIZER_ORIGIN}/manifest.json`;

const listEl = document.getElementById('list');
const trackCountEl = document.getElementById('trackCount');
const totalTimeEl = document.getElementById('totalTime');
const nowIndex = document.getElementById('nowIndex');
const nowTitle = document.getElementById('nowTitle');
const nowTag = document.getElementById('nowTag');
const nowEnter = document.getElementById('nowEnter');
const stage = document.getElementById('stage');

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
  listEl.innerHTML = `<div class="list-status">${message}</div>`;
  trackCountEl.textContent = '0 tracks';
  totalTimeEl.textContent = '0:00 total';
}

function render(){
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
    row.innerHTML = `
      <div class="row-index">${pad(i + 1)}</div>
      <div class="row-body">
        <div class="row-title">${t.title}</div>
        <div class="row-tag">${t.tag}</div>
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

  trackCountEl.textContent = `${TRACKS.length} track${TRACKS.length === 1 ? '' : 's'}`;
  const total = TRACKS.reduce((sum, t) => sum + t.duration, 0);
  totalTimeEl.textContent = `${fmtTime(total)} total`;
}

function updateCurrentStyling(){
  [...listEl.children].forEach((row, i) => {
    row.classList.toggle('is-current', i === current);
    row.setAttribute('aria-selected', i === current ? 'true' : 'false');
  });
}

function select(i){
  current = i;
  updateCurrentStyling();
  const t = TRACKS[i];
  nowIndex.textContent = pad(i + 1);
  nowTitle.textContent = t.title;
  nowTag.textContent = `${t.key} · ${t.tempo} bpm · ${fmtTime(t.duration)}`;
  nowEnter.disabled = false;
  listEl.children[i].focus();
}

function enterTrack(){
  if (current < 0) return;
  const t = TRACKS[current];
  stage.classList.add('is-launching');
  nowEnter.disabled = true;
  nowEnter.textContent = 'loading…';
  window.location.href = `${VISUALIZER_ORIGIN}/?track=${encodeURIComponent(t.id)}`;
}

nowEnter.addEventListener('click', enterTrack);

// keyboard nav
document.addEventListener('keydown', (e) => {
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

async function loadTracks(){
  setStatus('loading tracks…');
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
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
    console.error('Failed to load track manifest:', err);
    setStatus('could not load tracks; try refreshing');
    return;
  }
  render();
}

loadTracks();
