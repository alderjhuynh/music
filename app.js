const $ = (id) => document.getElementById(id);
const els = {
  stage: $('stage'), scroller: $('scroller'),
  canvas: $('canvas'), wave: $('waveCanvas'),
  keyLabel: $('keyLabel'), titleLabel: $('titleLabel'), notesValues: $('notesValues'),
  onsetStat: $('onsetStat'), beatStat: $('beatStat'),
  meterL: $('meterL'), meterR: $('meterR'),
  barCount: $('barCount'), beatCount: $('beatCount'), timecode: $('timecode'),
  timeReadout: $('timeReadout'), progressFill: $('progressFill'), progressTrack: $('progressTrack'),
  edgeRight: $('edgeRight'),
  playBtn: $('playBtn'), prevBtn: $('prevBtn'), nextBtn: $('nextBtn'), modeBtn: $('modeBtn'),
  grid: $('tileGrid'), trackCount: $('trackCount'),
  audio: $('audio'),
};
const ctx2d = els.canvas.getContext('2d');
const waveCtx = els.wave.getContext('2d');

let audioCtx, sourceNode, analyser, splitter, analyserL, analyserR, masterGain;
let lvlL = 0, lvlR = 0;
let freqData, timeData, freqDataL, freqDataR;
let tracks = [];
let current = -1;
let playMode = 'sequential';
let edgeOffset = 0, edgeUnit = 1;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmtTime = (s) => {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const fmtTC = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
};
function countUpTo(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] <= t) lo = mid + 1; else hi = mid; }
  return lo;
}
function bandAverage(data, loFrac, hiFrac) {
  const lo = Math.floor(data.length * loFrac), hi = Math.floor(data.length * hiFrac);
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += data[i];
  return sum / Math.max(1, hi - lo) / 255;
}
function rms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / data.length);
}
const pad2 = (n) => String(n).padStart(2, '0');
const slug = (f) => f.replace(/^tracks\//, '').toLowerCase().replace(/\s+/g, '_');

const bgCircles = (() => {
  const rand = mulberry32(1337); const list = [];
  for (let i = 0; i < 52; i++) {
    list.push({
      xFrac: 0.015 + rand() * 0.58, yFrac: 0.02 + rand() * 0.5,
      rBase: 3 + rand() * rand() * 100, filled: rand() < 0.14,
      alpha: 0.12 + rand() * 0.5, speed: 0.25 + rand() * 1.3,
      phase: rand() * Math.PI * 2, lineW: 1 + rand() * 2.4,
    });
  }
  return list;
})();

function sizeCanvas(c, w, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
}
function resizeCanvases() {
  sizeCanvas(els.canvas, els.stage.offsetWidth, els.stage.offsetHeight);
  sizeCanvas(els.wave, els.wave.parentElement.clientWidth, els.wave.parentElement.clientHeight);
  tracks.forEach(drawThumb);
  fillSlots();
}
window.addEventListener('resize', () => { resizeCanvases(); if (current >= 0) buildEdge(); });

function buildEdge() {
  const unit = (current >= 0 ? tracks[current].info.title : 'hear me and weep') + '  —  ';
  const el = els.edgeRight;
  el.textContent = unit;
  const rough = Math.max(1, el.scrollHeight);
  const reps = Math.max(4, Math.ceil((el.parentElement.clientHeight * 2) / rough) + 1);
  el.textContent = unit.repeat(reps);
  edgeUnit = Math.max(1, el.scrollHeight) / reps;
}

function ensureAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(els.audio);
  analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.frequencyBinCount);
  splitter = audioCtx.createChannelSplitter(2);
  analyserL = audioCtx.createAnalyser(); analyserR = audioCtx.createAnalyser();
  analyserL.fftSize = 512; analyserR.fftSize = 512;
  freqDataL = new Uint8Array(analyserL.frequencyBinCount);
  freqDataR = new Uint8Array(analyserR.frequencyBinCount);
  sourceNode.connect(analyser);
  sourceNode.connect(splitter);
  splitter.connect(analyserL, 0);
  splitter.connect(analyserR, 1);
  masterGain = audioCtx.createGain();
  analyser.connect(masterGain);
  masterGain.connect(audioCtx.destination);
}

async function load() {
  const man = await (await fetch('manifest.json')).json();
  tracks = await Promise.all(man.map(async (info) => {
    let data = null, available = info.available !== false;
    try { data = await (await fetch(info.data)).json(); } catch (_) {}
    try { available = (await fetch(info.file, { method: 'HEAD' })).ok; } catch (_) {}
    return { info, data, available };
  }));
  renderTiles();
  const wanted = new URLSearchParams(location.search).get('track');
  let start = tracks.findIndex((t) => t.info.id === wanted && t.available);
  if (start < 0) start = tracks.findIndex((t) => t.available);
  if (start >= 0) await selectTrack(start, { updateUrl: false });
  else { els.keyLabel.textContent = 'no tracks'; buildEdge(); }
}

function renderTiles() {
  els.grid.innerHTML = '';
  tracks.forEach((t, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tile' + (t.available ? '' : ' offline');
    const d = t.data, info = t.info;
    el.innerHTML = `
      <div class="tile-bar"><span>${pad2(i + 1)} · ${slug(info.file)}</span><span>${fmtTime(info.duration)}</span></div>
      <div class="tile-wave"><canvas></canvas></div>
      <div class="tile-body">
        <div class="tile-title"></div>
        <div class="tile-meta"><span>${info.key}</span><span>${Math.round(info.tempo)} bpm</span></div>
        <div class="tile-tag"></div>
      </div>`;
    el.querySelector('.tile-title').textContent = info.title;
    el.querySelector('.tile-tag').textContent = '// ' + info.tag;
    if (t.available) el.addEventListener('click', () => selectTrack(i, { updateUrl: true, autoplay: true }));
    else { el.disabled = true; el.setAttribute('aria-disabled', 'true'); }
    t.el = el; t.thumb = el.querySelector('canvas');
    els.grid.appendChild(el);
  });
  const on = tracks.filter((t) => t.available).length;
  els.trackCount.textContent = `${on} / ${tracks.length} online`;
  resizeCanvases();
}

function fillSlots() {
  els.grid.querySelectorAll('.tile.slot').forEach((n) => n.remove());
  if (!tracks.length) return;
  const cols = getComputedStyle(els.grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  const missing = (cols - (tracks.length % cols)) % cols;
  for (let i = 0; i < missing; i++) {
    const s = document.createElement('div');
    s.className = 'tile slot'; s.setAttribute('aria-hidden', 'true');
    els.grid.appendChild(s);
  }
}

function drawThumb(t) {
  if (!t || !t.thumb || !t.data) return;
  const c = t.thumb, box = c.parentElement;
  sizeCanvas(c, box.clientWidth, box.clientHeight);
  const g = c.getContext('2d'), w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  const peaks = t.data.waveform, n = peaks.length;
  const active = t.el.classList.contains('active');
  const prog = active && t.data.duration ? Math.min(1, (els.audio.currentTime || 0) / t.data.duration) : 0;
  const step = Math.max(2, Math.round(w / 110));
  for (let x = 0; x < w; x += step) {
    const p = peaks[Math.min(n - 1, Math.floor((x / w) * n))];
    const bh = Math.max(1, p * h * 0.86);
    const played = x / w <= prog;
    const base = active ? '255,255,255' : '11,11,11';
    g.fillStyle = played ? `rgba(${base},0.95)` : `rgba(${base},${active ? 0.35 : 0.22})`;
    g.fillRect(x, (h - bh) / 2, step - 1, bh);
  }
}

async function selectTrack(index, { updateUrl = false, autoplay = false } = {}) {
  const t = tracks[index];
  if (!t || !t.available) return;
  const wasPlaying = !!(audioCtx && !els.audio.paused);
  const prev = current;
  current = index;
  tracks.forEach((x, i) => x.el && x.el.classList.toggle('active', i === index));
  if (prev >= 0 && tracks[prev]) drawThumb(tracks[prev]);
  els.audio.src = t.info.file;
  els.keyLabel.textContent = t.info.key;
  els.titleLabel.textContent = t.info.title + '  ·  ' + t.info.tag;
  document.title = t.info.title.toLowerCase() + ' // hear me and weep';
  buildEdge();
  drawThumb(t);
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('track', t.info.id);
    history.replaceState({}, '', url);
  }
  if (autoplay || wasPlaying) {
    ensureAudioGraph();
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      await els.audio.play();
      setPlayState(true);
    } catch (_) { setPlayState(false); }
  } else setPlayState(false);
}

function availableIdx() { return tracks.map((t, i) => (t.available ? i : -1)).filter((i) => i >= 0); }
function stepIndex(dir) {
  const av = availableIdx();
  if (av.length <= 1) return current;
  if (playMode === 'shuffle' && dir > 0) {
    let i; do { i = av[Math.floor(Math.random() * av.length)]; } while (i === current);
    return i;
  }
  const pos = av.indexOf(current);
  return av[(pos + dir + av.length) % av.length];
}
els.nextBtn.addEventListener('click', () => selectTrack(stepIndex(1), { updateUrl: true }));
els.prevBtn.addEventListener('click', () => {
  if ((els.audio.currentTime || 0) > 3) { els.audio.currentTime = 0; return; }
  selectTrack(stepIndex(-1), { updateUrl: true });
});

els.audio.addEventListener('error', () => {
  const t = tracks[current];
  if (!t || !els.audio.getAttribute('src')) return;
  t.available = false;
  t.el.classList.add('offline'); t.el.classList.remove('active'); t.el.disabled = true;
  els.trackCount.textContent = `${tracks.filter((x) => x.available).length} / ${tracks.length} online`;
  const nxt = tracks.findIndex((x) => x.available);
  if (nxt >= 0) selectTrack(nxt);
});

function drawWaveOverview(t, dur) {
  const w = els.wave.width, h = els.wave.height;
  waveCtx.clearRect(0, 0, w, h);
  const d = current >= 0 ? tracks[current].data : null;
  if (!d || !dur) return;
  const peaks = d.waveform, n = peaks.length;
  const dpr = w / Math.max(1, els.wave.parentElement.clientWidth);
  const windowSec = Math.max(4, Math.min(dur, 16));
  const pxPerSec = w / windowSec, start = t - windowSec / 2, step = Math.max(2, Math.round(3 * dpr));
  for (let x = 0; x < w; x += step) {
    const ta = start + x / pxPerSec;
    if (ta < 0 || ta > dur) continue;
    const p = peaks[Math.min(n - 1, Math.max(0, Math.floor((ta / dur) * n)))];
    const bh = Math.max(1, p * h * 0.78);
    waveCtx.fillStyle = ta <= t ? 'rgba(11,11,11,0.95)' : 'rgba(11,11,11,0.2)';
    waveCtx.fillRect(x, (h - bh) / 2, step - 1, bh);
  }
  if (analyser) {
    analyser.getByteTimeDomainData(timeData);
    waveCtx.strokeStyle = 'rgba(11,11,11,0.55)'; waveCtx.lineWidth = 1 * dpr;
    waveCtx.beginPath();
    const slice = w / timeData.length;
    for (let i = 0; i < timeData.length; i += 2) {
      const y = (timeData[i] / 128.0) * h / 2;
      if (i === 0) waveCtx.moveTo(0, y); else waveCtx.lineTo(i * slice, y);
    }
    waveCtx.stroke();
  }
}

function drawBackground(t, bass, mid, treble) {
  const w = els.canvas.width, h = els.canvas.height;
  ctx2d.clearRect(0, 0, w, h);
  const ink = '11,11,11';
  ctx2d.strokeStyle = `rgba(${ink},0.5)`;
  const scale = w / 1000;
  for (const c of bgCircles) {
    const cx = w * c.xFrac, cy = h * c.yFrac;
    const rad = Math.max(1, c.rBase * scale * (Math.sin(t * c.speed + c.phase) * 0.2 + 1) * (0.72 + bass * 0.85));
    ctx2d.globalAlpha = c.alpha;
    ctx2d.beginPath(); ctx2d.arc(cx, cy, rad, 0, Math.PI * 2);
    if (c.filled) { ctx2d.fillStyle = `rgba(${ink},1)`; ctx2d.fill(); }
    else { ctx2d.lineWidth = c.lineW; ctx2d.stroke(); }
  }
  ctx2d.globalAlpha = 1; ctx2d.lineWidth = 1;
  const acx = w * 0.87, acy = h * 0.15, rings = 34;
  for (let i = 0; i < rings; i++) {
    const rad = w * 0.014 + i * (w * 0.0145);
    const start = t * (0.1 + (i % 4) * 0.05) + i * 0.75;
    const len = 0.5 + treble * 2.1 + 0.35 * Math.sin(i * 1.15 + t * 0.35);
    ctx2d.globalAlpha = 0.2 + 0.55 * (i / rings);
    ctx2d.lineWidth = 16 + treble * 2;
    ctx2d.beginPath(); ctx2d.arc(acx, acy, rad, start, start + len); ctx2d.stroke();
  }
  ctx2d.globalAlpha = 1; ctx2d.lineWidth = 1;
  ctx2d.strokeStyle = `rgba(${ink},0.9)`; ctx2d.lineWidth = Math.max(2, w * 0.002);
  ctx2d.beginPath(); ctx2d.moveTo(w * 0.46, 0); ctx2d.lineTo(w, h * 0.62); ctx2d.stroke();
  ctx2d.strokeStyle = `rgba(${ink},0.7)`; ctx2d.lineWidth = 1;
  const tx = w * 0.5;
  ctx2d.beginPath(); ctx2d.moveTo(tx, h * 0.18); ctx2d.lineTo(tx, h * 0.62); ctx2d.stroke();
  for (let i = 0; i < 6; i++) {
    const ty = h * 0.3 + i * (h * 0.055), tw = 10 + mid * 40 * (1 - i / 6);
    ctx2d.beginPath(); ctx2d.moveTo(tx - tw / 2, ty); ctx2d.lineTo(tx + tw / 2, ty); ctx2d.stroke();
  }
  ctx2d.beginPath(); ctx2d.moveTo(w * 0.78, 0); ctx2d.lineTo(w * 0.99, h * 0.18); ctx2d.stroke();
}

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now() / 1000;
  const t = els.audio.currentTime || 0;
  const cur = current >= 0 ? tracks[current] : null;
  const d = cur && cur.data;
  const dur = d ? d.duration : (els.audio.duration || 0);

  let bass = 0, mid = 0, treble = 0;
  if (analyser) {
    analyser.getByteFrequencyData(freqData);
    bass = bandAverage(freqData, 0.0, 0.08);
    mid = bandAverage(freqData, 0.08, 0.35);
    treble = bandAverage(freqData, 0.35, 0.9);
  }
  drawBackground(now, bass, mid, treble);
  drawWaveOverview(t, dur);

  if (d) {
    const fi = Math.min(d.notes_timeline.length - 1, Math.max(0, Math.floor(t / d.notes_frame_dt)));
    const notes = d.notes_timeline[fi] || [];
    els.notesValues.textContent = notes.length ? notes.join(' ') : '—';
    const op = countUpTo(d.onset_times, t), bp = countUpTo(d.beat_times, t);
    const ot = d.onset_times.length, bt = d.beat_times.length;
    els.onsetStat.textContent = `events ${op}/${ot} (${((op / Math.max(1, ot)) * 100).toFixed(1)}%)`;
    els.beatStat.textContent = `beats ${bp}/${bt} (${((bp / Math.max(1, bt)) * 100).toFixed(1)}%)`;
    const bi = Math.max(0, bp - 1);
    els.barCount.textContent = String(Math.floor(bi / 4)).padStart(3, '0');
    els.beatCount.textContent = pad2((bi % 4) + 1);
    const frac = dur > 0 ? Math.min(1, t / dur) : 0;
    els.progressFill.style.width = `${frac * 100}%`;
    els.timeReadout.textContent = `${fmtTime(t)} / ${fmtTime(dur)}`;
    if (!els.audio.paused && (tick.n = (tick.n || 0) + 1) % 6 === 0) drawThumb(cur);
  }
  els.timecode.textContent = fmtTC(t);

  if (analyserL && analyserR) {
    analyserL.getByteTimeDomainData(freqDataL);
    analyserR.getByteTimeDomainData(freqDataR);
    lvlL = Math.min(100, rms(freqDataL) * 320);
    lvlR = Math.min(100, rms(freqDataR) * 320);
    els.meterL.style.setProperty('--level', `${lvlL}%`);
    els.meterR.style.setProperty('--level', `${lvlR}%`);
  }

  edgeOffset -= 0.5;
  if (-edgeOffset > edgeUnit) edgeOffset += edgeUnit;
  els.edgeRight.style.transform = `translateY(${edgeOffset}px)`;
}

const PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M8 5.14v14l11-7z"></path></svg>';
const PAUSE_SVG = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>';
function setPlayState(p) {
  els.playBtn.innerHTML = p ? PAUSE_SVG : PLAY_SVG;
  els.playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
}
async function togglePlayback() {
  if (current < 0) return;
  ensureAudioGraph();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (els.audio.paused) { await els.audio.play().catch(() => {}); setPlayState(!els.audio.paused); }
  else { els.audio.pause(); setPlayState(false); }
}
els.playBtn.addEventListener('click', togglePlayback);
els.audio.addEventListener('pause', () => setPlayState(false));
els.audio.addEventListener('play', () => setPlayState(true));

const REPEAT_SVG = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v3z"></path></svg>';
const REPEAT_ONE_SVG = '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v3z"></path><text x="12" y="14.5" text-anchor="middle" font-size="7" font-family="Helvetica, Arial, sans-serif" stroke="none">1</text></svg>';
const SHUFFLE_SVG = '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"></path></svg>';
const MODES = ['sequential', 'repeat-one', 'shuffle'];
const MODE_META = {
  sequential: { label: 'Play through', svg: REPEAT_SVG },
  'repeat-one': { label: 'Repeat one track', svg: REPEAT_ONE_SVG },
  shuffle: { label: 'Shuffle', svg: SHUFFLE_SVG },
};
function setModeState() {
  const m = MODE_META[playMode];
  els.modeBtn.innerHTML = m.svg;
  els.modeBtn.title = m.label;
  els.modeBtn.setAttribute('aria-label', `Playback mode: ${m.label}. Click to change.`);
  els.modeBtn.classList.toggle('mode-active', playMode !== 'sequential');
}
els.modeBtn.addEventListener('click', () => {
  playMode = MODES[(MODES.indexOf(playMode) + 1) % MODES.length];
  setModeState();
});
setModeState();

els.audio.addEventListener('ended', () => {
  if (playMode === 'repeat-one') { els.audio.currentTime = 0; els.audio.play().catch(() => {}); return; }
  selectTrack(stepIndex(1), { updateUrl: true, autoplay: true });
});

function seekFromEvent(e) {
  const d = current >= 0 ? tracks[current].data : null;
  if (!d) return;
  const r = els.progressTrack.getBoundingClientRect();
  const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  els.audio.currentTime = f * d.duration;
}
els.progressTrack.addEventListener('pointerdown', (e) => {
  seekFromEvent(e);
  const move = (ev) => seekFromEvent(ev);
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
});

window.addEventListener('keydown', (e) => {
  const ae = document.activeElement, tag = ae ? ae.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ae && ae.isContentEditable)) return;
  if (document.body.classList.contains('intro-on')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    selectTrack(stepIndex(e.key === 'ArrowRight' ? 1 : -1), { updateUrl: true });
    return;
  }
  if (e.code !== 'Space' && e.key !== ' ') return;
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
  e.preventDefault();
  togglePlayback();
});

let loaded = null, armed = false, started = false;
window.HMW = {
  arm() {
    ensureAudioGraph();
    masterGain.gain.value = 0;
    audioCtx.resume().catch(() => {});
    const go = () => {
      if (current < 0) return false;
      armed = true;
      els.audio.play().catch(() => {});
      return true;
    };
    return current >= 0 ? Promise.resolve(go()) : loaded.then(go);
  },
  start() {
    if (started || current < 0) return;
    started = true;
    ensureAudioGraph();
    masterGain.gain.value = 1;
    audioCtx.resume().catch(() => {});
    els.audio.currentTime = 0;
    els.audio.play().catch(() => {});
  },
  state() {
    const d = current >= 0 ? tracks[current].data : null;
    return { started, t: els.audio.currentTime || 0, dur: d ? d.duration : 0, peaks: d ? d.waveform : null, l: lvlL, r: lvlR };
  },
};

resizeCanvases();
if (window.ResizeObserver) new ResizeObserver(() => { resizeCanvases(); }).observe(els.grid);
loaded = load();
tick();
