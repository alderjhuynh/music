(function () {
  const root = document.getElementById('intro');
  if (!root) return;

  const CFG = {
    user: '@AURAEAMUSIC',
    version: 'V-400-S-3',
    skipOnQuery: 'intro',   
  };

  let t0 = null, raf = 0, done = false, lastStep = -1, begun = false, played = false;

  const params = new URLSearchParams(location.search);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (params.get(CFG.skipOnQuery) === '0' || reduce) {
    finish(true);
    return;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  const INK = '#0b0b0b';
  const VB = '0 150 576 600';

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const FONT = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";
  const glyph = (ch, x, y, w, size, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" textLength="${w}" lengthAdjust="spacingAndGlyphs" ${extra}>${ch}</text>`;

  const titleSVG = `
<svg id="titleSvg" viewBox="${VB}" xmlns="${SVGNS}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <mask id="mw1" maskUnits="userSpaceOnUse" x="0" y="150" width="576" height="600"><path id="mw1p" d="M 192 393.5 H 138 Q 121.5 393.5 121.5 410 V 526" stroke="#fff" stroke-width="5" fill="none"/></mask>
    <mask id="mw2" maskUnits="userSpaceOnUse" x="0" y="150" width="576" height="600"><path id="mw2p" d="M 144.5 535 V 610 H 217" stroke="#fff" stroke-width="5" fill="none"/></mask>
    <mask id="mw3" maskUnits="userSpaceOnUse" x="0" y="150" width="576" height="600"><path id="mw3p" d="M 448 528.5 H 478 Q 484 528.5 484 535 V 590" stroke="#fff" stroke-width="5" fill="none"/></mask>
    <clipPath id="cpS0"><rect x="200" y="575" width="340" height="12.6"/></clipPath>
    <clipPath id="cpS1"><rect x="200" y="587" width="340" height="12.6"/></clipPath>
    <g id="makeSrc" fill="${INK}" font-family="${FONT}" font-weight="700">
        ${glyph('W', 236, 614, 62, 47)}${glyph('E', 306, 614, 62, 47)}${glyph('E', 376, 614, 62, 47)}${glyph('P', 446, 614, 62, 47)}
      </g>
    <clipPath id="cpS2"><rect x="200" y="599" width="340" height="20"/></clipPath>
  </defs>
  <g id="titleG">
    
    <rect id="selHow" x="162" y="321" width="246" height="154" fill="rgba(255,196,214,.55)" stroke="rgba(176,52,88,.55)" stroke-width="1" opacity="0"/>
    <rect id="selThis" x="344" y="514" width="104" height="28" fill="rgba(0,0,0,.04)" stroke="rgba(0,0,0,.45)" stroke-width="1" opacity="0"/>

    
    <g font-family="JetBrains Mono, ui-monospace, monospace" font-size="6" fill="#8a8a8a" id="labels" opacity="0">
      <text x="176" y="325">&gt; hear</text>
      <text x="67" y="494">&gt; me</text>
      <text x="460" y="622">&gt; weep</text>
    </g>

    
    <g id="how" stroke="${INK}" stroke-width="1.3" stroke-linejoin="miter" font-family="${FONT}" font-weight="500">
      <g id="howH" fill="none">${glyph('H', 170, 467, 50, 196)}${glyph('E', 230, 467, 50, 196)}</g>
      <g id="howO" fill="none">${glyph('A', 290, 467, 50, 196)}</g>
      <g id="howW" fill="none">${glyph('R', 350, 467, 50, 196)}</g>
    </g>
    <g id="howBlocks" fill="${INK}"></g>

    
    <g id="to" fill="${INK}" font-family="${FONT}" font-weight="700">
      <g id="toT">${glyph('M', 67, 558, 46, 86)}</g>
      ${glyph('E', 176, 558, 44, 86, `id="toO" fill="none" stroke="${INK}" stroke-width="2.4"`)}
    </g>

    
    <g id="make">
      <g id="makeSlices"></g>
      <g id="makePlug" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0">
        <rect x="446" y="581" width="62" height="33"/><rect x="498" y="590" width="14" height="14"/><rect x="458" y="587" width="20" height="21"/>
      </g>
    </g>

    
    <g id="this" font-family="JetBrains Mono, ui-monospace, monospace" opacity="0">
      <text id="thisSl" x="351" y="536" font-size="20" fill="${INK}" font-style="italic">//</text>
      <text id="thisTx" x="381" y="536" font-size="20" fill="${INK}"></text>
    </g>

    
    <g id="wires" fill="none" stroke="#222" stroke-width="1">
      <g mask="url(#mw1)"><path d="M 192 393.5 H 138 Q 121.5 393.5 121.5 410 V 526" stroke-dasharray="4 3"/></g>
      <g mask="url(#mw2)"><path d="M 144.5 535 V 610 H 217" /></g>
      <g mask="url(#mw3)"><path d="M 448 528.5 H 478 Q 484 528.5 484 535 V 590" /></g>
      <path id="wDash" d="M 125 531 H 139" stroke-dasharray="3 2"/>
    </g>
    <g id="nodes" opacity="0">
      <rect x="190" y="389.5" width="7" height="7" fill="#fff" stroke="#222"/>
      <rect x="117.5" y="526.5" width="8" height="8" fill="${INK}"/>
      <circle cx="144.5" cy="531" r="4" fill="#fff" stroke="#222"/>
      <rect x="217" y="606" width="8" height="8" fill="#fff" stroke="#222"/>
      <rect x="441" y="525" width="7" height="7" fill="#fff" stroke="#222"/>
    </g>
  </g>
</svg>`;

  const winSVG = (cls) => `
<svg class="${cls}" viewBox="${VB}" xmlns="${SVGNS}" preserveAspectRatio="xMidYMid meet">
  <g font-family="JetBrains Mono, ui-monospace, monospace">
    <rect x="52" y="462" width="488" height="168" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
    <rect x="52" y="462" width="488" height="30" fill="${INK}"/>
    <text x="296" y="481" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">final.exe</text>
    <g fill="none" stroke="#fff" stroke-width="1"><rect x="498" y="469" width="10" height="10"/><rect x="511" y="469" width="10" height="10"/><rect x="524" y="469" width="10" height="10"/></g>
    <rect x="118" y="499" width="58" height="17" rx="5" fill="none" stroke="${INK}" stroke-width="1.2"/>
    <text x="147" y="511" text-anchor="middle" font-size="7.5" font-weight="700">${CFG.version}</text>
    <g font-size="4.8" font-weight="700"><text x="234" y="499">FILE</text><text x="268" y="499">OPTIONS</text><text x="306" y="499">HELP</text></g>
    <text x="232" y="512" font-size="7.5" font-weight="700">USER:</text><text x="264" y="512" font-size="7.5" font-weight="700">${CFG.user}</text>
    <line x1="52" y1="520" x2="540" y2="520" stroke="${INK}" stroke-width="1"/>
    <g class="wbars"></g>
    <line x1="296" y1="526" x2="296" y2="610" stroke="${INK}" stroke-width=".8" stroke-dasharray="2 2"/>
    <text x="302" y="618" font-size="5.5" fill="#555"></text>
  </g>
  
  <g>
    <rect x="340" y="385" width="40" height="300" fill="rgba(255,255,255,.94)" stroke="#333" stroke-width="1"/>
    <rect class="mBgL" x="345" y="390" width="13" height="290" fill="#ddd"/>
    <rect class="mBgR" x="362" y="390" width="13" height="290" fill="#ddd"/>
    <rect class="mL" x="345" y="600" width="13" height="80" fill="${INK}"/>
    <rect class="mR" x="362" y="600" width="13" height="80" fill="${INK}"/>
    <circle cx="352" cy="685" r="3" fill="#fff" stroke="#222"/>
    <path d="M 352 688 V 718 H 472 V 633" fill="none" stroke="#444" stroke-width="1" stroke-dasharray="4 3"/>
    <rect x="468.5" y="626" width="7" height="7" fill="#fff" stroke="#444"/>
    <text x="358" y="696" font-size="5" fill="#8a8a8a" font-family="JetBrains Mono, monospace"></text>
  </g>
  <text class="tc" x="60" y="670" font-size="31" font-weight="500" fill="${INK}" font-family="JetBrains Mono, ui-monospace, monospace" textLength="102" lengthAdjust="spacingAndGlyphs">00:00.00</text>
</svg>`;

  root.innerHTML = `
    <div class="intro-rig" id="rig">
      <div class="intro-3d" id="rig3d">
        <div class="intro-layer" id="titleLayer">${titleSVG}</div>
        <div class="intro-layer" id="winLayer">
          <div class="intro-layer win-sharp" id="winSharp">${winSVG('winA')}</div>
          <div class="intro-layer win-soft" id="winSoft">${winSVG('winB')}</div>
        </div>
      </div>
    </div>
    <div class="intro-skip" id="introSkip"></div>
    <div class="intro-gate" id="gate">
      <div class="gate-title">HEAR ME AND WEEP</div>
      <div class="gate-prompt"><kbd>space</kbd><span>to begin</span></div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => root.querySelectorAll(s);
  const titleG = $('#titleG'), howH = $('#howH'), howO = $('#howO'), howW = $('#howW');
  const howBlocks = $('#howBlocks'), selHow = $('#selHow'), selThis = $('#selThis');
  const toG = $('#to'), toT = $('#toT'), toO = $('#toO');
  const makeSlices = $('#makeSlices'), makePlug = $('#makePlug');
  const thisG = $('#this'), thisTx = $('#thisTx'), thisSl = $('#thisSl');
  const labels = $('#labels'), nodes = $('#nodes'), wDash = $('#wDash');
  const rig3d = $('#rig3d'), titleLayer = $('#titleLayer'), winLayer = $('#winLayer');
  const winSharp = $('#winSharp'), winSoft = $('#winSoft'), introSkip = $('#introSkip');
  const rig = $('#rig'), gate = $('#gate');
  const coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (coarse) gate.querySelector('.gate-prompt').innerHTML = '<kbd>tap</kbd><span>to begin</span>';
  rig.style.visibility = 'hidden'; introSkip.style.display = 'none';
  root.classList.add('gated');
  const mw = [$('#mw1p'), $('#mw2p'), $('#mw3p')];
  const mwLen = mw.map((p) => p.getTotalLength());
  mw.forEach((p, i) => { p.style.strokeDasharray = mwLen[i]; p.style.strokeDashoffset = mwLen[i]; });

  makeSlices.innerHTML = ['cpS0', 'cpS1', 'cpS2']
    .map((id) => `<g clip-path="url(#${id})"><use href="#makeSrc"/></g>`).join('');
  const sliceG = [...makeSlices.children];

  const fakeWave = (() => {
    const r = rng(77); const a = [];
    for (let i = 0; i < 120; i++) a.push(0.15 + 0.7 * Math.abs(Math.sin(i * 0.17) * Math.sin(i * 0.031 + 1)) * (0.6 + 0.4 * r()));
    return a;
  })();
  const fmtTC = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60), cs = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };
  const NO_AUDIO = { started: false, t: 0, dur: 0, peaks: null, l: 0, r: 0 };

  const STEP = 1 / 14;
  const T_PLAY = 4.5;   
  const T_PUSH = 7.0;   
  const T_END = 7.8;    

  function setFill(el, filled) {
    el.setAttribute('fill', filled ? INK : 'none');
  }

  function blocks(seed, count, bbox) {
    const r = rng(seed);
    let s = '';
    for (let i = 0; i < count; i++) {
      const w = 4 + r() * 38 * (r() < 0.3 ? 2 : 1);
      const h = 3 + r() * 16;
      const x = bbox[0] + r() * (bbox[2] - w);
      const y = bbox[1] + Math.floor(r() * (bbox[3] / 6)) * 6;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
    }
    return s;
  }

  function stepScene(t, step) {
    const r = rng(step * 9973 + 11);

    const howOn = t > 0.35;
    const pFill = smooth(0.75, 3.3, t);
    const selOn = t > 1.0 && t < 3.9 && r() < 0.34;
    document.getElementById('how').style.display = howOn ? '' : 'none';
    if (howOn) {
      const fH = selOn || r() < pFill, fO = selOn || r() < pFill * 0.95 + 0.05, fW = selOn || r() < pFill * 0.9;
      const settled = t > 3.4;
      setFill(howH, settled || fH); setFill(howO, settled || fO); setFill(howW, settled || fW);
      const j = settled ? 0 : (r() < 0.25 ? (r() - 0.5) * 8 : 0);
      howH.setAttribute('transform', `translate(${j},0)`);
    }
    selHow.setAttribute('opacity', selOn ? 1 : 0);
    const blockN = t > 0.35 && t < 1.8 ? Math.round(16 * (1 - smooth(0.35, 1.8, t)) + 2) : 0;
    howBlocks.innerHTML = blockN ? blocks(step + 3, blockN, [166, 325, 80, 144]) : '';

    const toOn = t > 1.3;
    toG.style.display = toOn ? '' : 'none';
    if (toOn) {
      const g = 1 - smooth(1.3, 2.3, t);
      const jx = r() < g ? (r() - 0.5) * 60 * g : 0;
      toT.setAttribute('transform', `translate(${jx},0)`);
      toO.setAttribute('transform', `translate(${r() < g ? (r() - 0.5) * 20 * g : 0},0)`);
      toG.setAttribute('opacity', r() < 0.15 * g ? 0 : 1);
    }

    const mkOn = t > 2.0;
    makeSlices.style.display = mkOn ? '' : 'none';
    const mg = 1 - smooth(2.0, 3.2, t);
    sliceG.forEach((g, i) => {
      const dx = r() < mg + 0.04 ? (r() - 0.5) * 70 * mg : 0;
      g.setAttribute('transform', `translate(${dx},0)`);
    });
    makePlug.setAttribute('opacity', mkOn && t < 2.9 && r() < 0.6 ? 1 : 0);

    const typed = clamp((t - 2.5) / 0.5);
    const txt = 'and'.slice(0, Math.ceil(typed * 3));
    thisG.setAttribute('opacity', t > 2.5 ? 1 : 0);
    thisTx.textContent = txt;
    selThis.setAttribute('opacity', t > 2.5 && t < 4.0 && r() < 0.45 ? 1 : 0);

    labels.setAttribute('opacity', t > 3.0 ? 1 : 0);
    nodes.setAttribute('opacity', t > 1.9 ? 1 : 0);
    wDash.setAttribute('opacity', t > 1.9 ? 1 : 0);
  }

  function frame(now) {
    if (done) return;
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;

    const step = Math.floor(t / STEP);
    if (step !== lastStep) { lastStep = step; stepScene(t, step); }

    mw[0].style.strokeDashoffset = mwLen[0] * (1 - easeOut(clamp((t - 1.5) / 0.7)));
    mw[1].style.strokeDashoffset = mwLen[1] * (1 - easeOut(clamp((t - 1.9) / 0.6)));
    mw[2].style.strokeDashoffset = mwLen[2] * (1 - easeOut(clamp((t - 2.9) / 0.5)));

    const d = easeIO(smooth(4.0, 4.6, t));
    const tx = -36 * d, ty = -228 * d, sc = 1 + 0.33 * d;
    titleG.setAttribute('transform', `translate(${tx} ${ty}) scale(${sc}) rotate(${-3.2 * d} 220 430)`);
    const tilt = d;
    const push = easeIO(smooth(T_PUSH, T_END, t));
    const zoom = 1 + 2.4 * push;
    rig3d.style.transform =
      `translate3d(${-18 * push}%, ${-8 * push}%, 0) scale(${zoom}) rotateX(${3.5 * tilt}deg) rotateY(${-11 * tilt}deg) rotateZ(${-1.5 * tilt}deg)`;
    titleLayer.style.transform = `translateZ(${-90 * d}px)`;
    titleLayer.style.filter = d > 0.01 ? `blur(${(2.2 * d).toFixed(2)}px)` : 'none';
    titleLayer.style.opacity = 1 - 0.0 * d;

    const wIn = clamp((t - 4.0) / 0.5);
    const wE = easeOut(wIn);
    const smear = (1 - wE);
    winLayer.style.opacity = wIn > 0 ? 1 : 0;
    winLayer.style.transform = `translate3d(${-380 * smear}px, ${160 * smear}px, ${60 * d}px) rotateZ(${5 * smear}deg)`;
    winSharp.style.filter = smear > 0.01 ? `blur(${(10 * smear).toFixed(1)}px)` : 'none';
    winSoft.style.opacity = 0.9;

    if (!played && t >= T_PLAY) { played = true; if (window.HMW) HMW.start(); }

    const st = (window.HMW && HMW.state()) || NO_AUDIO;
    const live = st.started;
    const tcTxt = fmtTC(live ? st.t : 0);
    $$('.tc').forEach((e) => (e.textContent = tcTxt));
    const lL = live ? st.l : 1.5, lR = live ? st.r : 1.5;
    $$('.mL').forEach((e) => { e.setAttribute('y', 680 - lL * 1.9); e.setAttribute('height', lL * 1.9); });
    $$('.mR').forEach((e) => { e.setAttribute('y', 680 - lR * 1.9); e.setAttribute('height', lR * 1.9); });

    const nb = 120;
    let bars = '';
    if (st.peaks && st.dur) {
      const WIN = Math.max(4, Math.min(st.dur, 16)), pk = st.peaks, pn = pk.length;
      for (let i = 0; i < nb; i++) {
        const ta = st.t + (i / nb - 0.5) * WIN;
        if (ta < 0 || ta > st.dur) continue;
        const p = pk[Math.min(pn - 1, Math.floor((ta / st.dur) * pn))];
        const x = 60 + (i / nb) * 472, h = Math.max(1.5, p * 74);
        bars += `<rect x="${x.toFixed(1)}" y="${(565 - h / 2).toFixed(1)}" width="3" height="${h.toFixed(1)}" fill="${ta <= st.t ? INK : '#c4c4c4'}"/>`;
      }
    } else {
      for (let i = 0; i < nb; i++) {
        const x = 60 + (i / nb) * 472, h = Math.max(1.5, fakeWave[i] * 74);
        bars += `<rect x="${x.toFixed(1)}" y="${(565 - h / 2).toFixed(1)}" width="3" height="${h.toFixed(1)}" fill="#c4c4c4"/>`;
      }
    }
    if (bars !== frame._bars) {
      $$('.wbars').forEach((g) => (g.innerHTML = bars));
      frame._bars = bars;
    }

    const out = smooth(T_PUSH + 0.15, T_END, t);
    root.style.opacity = 1 - out;
    if (out > 0.6) document.body.classList.add('site-live');
    if (t >= T_END) { finish(false); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish(instant) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    if (begun && !played) { played = true; if (window.HMW) HMW.start(); }
    document.body.classList.add('site-live');
    if (instant) document.body.classList.add('no-intro');
    const visible = parseFloat(root.style.opacity || '1') > 0.05;
    if (!instant && visible) root.style.transition = 'opacity .35s ease';
    root.style.opacity = '0';
    setTimeout(() => { root.remove(); document.body.classList.remove('intro-on'); }, instant ? 0 : (visible ? 380 : 0));
  }
  window.__skipIntro = () => finish(false);

  function begin() {
    if (begun || done) return;
    begun = true;
    if (window.HMW) HMW.arm();
    gate.classList.add('gone');
    root.classList.remove('gated');
    rig.style.visibility = ''; introSkip.style.display = '';
    const fontsReady = (document.fonts && document.fonts.ready)
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve();
    fontsReady.then(() => { if (!done) raf = requestAnimationFrame(frame); });
  }

  window.addEventListener('keydown', (e) => {
    if (done || e.repeat) return;
    if (!begun) {
      if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); begin(); }
      return;
    }
    finish(false);                       
  });
  root.addEventListener('pointerdown', () => {
    if (!begun) { if (coarse) begin(); return; }   
    finish(false);
  });

  document.body.classList.add('intro-on');
})();
