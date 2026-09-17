const VALID_THEMES = new Set(['desert', 'impact']);

function parseURLTheme() {
    const param = new URLSearchParams(window.location.search).get('theme');
    if (param && VALID_THEMES.has(param)) return param;
    return null;
}

const words = {
    impact: [
        "Hey!",
        "Curious about the album or me? You're in the right place!",
        "Anyway, my major influences are listening to a lot of Azali, tn-shi and Marzuku. I've loved these artists for a while, so getting to make music that reminds me of them is very fun. I promise in real life I'm not actually this emo, I just really like this genre of music (,,>﹏<,,)",
        "I was really into music for a long time, and I've done saxophone and flute lessons for a while now, but my piano is completely self-taught. In fact, I've even posted my own music before (just little small solo piano things), but I ended up deleting them all, lmao. But, I'm feeling a lot better, so I'm getting back into music with this album and the other one, distant horizons.",
        "I've always liked knowing how people are making music, and it's all the more important in the age where ai could literally just do this, so i will say what I'm using (but prepare to be disappointed.)",
        "I'm using FL Studio (the free trial version, meaning I can't go back and edit my old songs ;-;), and the piano that you're hearing is just FL Keys. Yes, I know, blasphemous, but I've found it works really well for these low-quality, kinda background-y piano things. For the violin, I'm using a random preset I found on Splice INSTRUMENT, and for everything else, it's a bunch of vsts I made myself. The random noise, the synths, most of the background stuff and the random samples are all made with a suite of random vsts I made. I'll put them on github eventually.",
        "(I use the sample vst because the free trial version of FL doesn't allow dragging and dropping audio lmao)",
        "annnnnyway, enjoy the album! The name 'WITNESS ME IN MY FULL GLORY' is really true, at this moment in time, this is the best music I've ever made."
    ],
    desert: [
        "Hey!",
        "Curious about the album or me? You're in the right place!",
        "sorry yall the rest of the text is coming later ;-;"
    ]
}

function injectText(theme) {
    const paragraphEl = document.querySelector(".about-pgraph");
    if(!paragraphEl){console.error("hey that doesnt exist"); return;}
    const effectiveTheme = theme && VALID_THEMES.has(theme) ? theme : null;
    if (effectiveTheme) document.body.dataset.theme = effectiveTheme;
    

    const paragraphs = effectiveTheme === 'impact' ? words.impact : words.desert;
    paragraphEl.innerHTML = "";

    paragraphs.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        paragraphEl.appendChild(p);
    });
}

const themeforinjection = parseURLTheme();
injectText(themeforinjection);

// enforce URL theme even if app.js overwrites it later (app.js loads after this script
// and will call switchAlbum -> applyTheme with the default album theme)
if (themeforinjection) {
  const enforce = () => {
    if (document.body.dataset.theme !== themeforinjection) {
      document.body.dataset.theme = themeforinjection;
    }
  };
  // re-apply after app.js async album load
  window.addEventListener('load', enforce);
  // guard against any subsequent dataset.theme mutation (e.g. switchAlbum)
  const observer = new MutationObserver(enforce);
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  // also try again on next ticks to cover race where app.js sets theme after observer is attached
  setTimeout(enforce, 0);
  setTimeout(enforce, 500);
}