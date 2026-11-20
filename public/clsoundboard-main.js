// Copia de main.js de https://github.com/bubblfan/soundboard (servido por jsDelivr).
// Cambios de Budsin: (0) los sonidos salen de MyInstants vía /api/music/sb/* con la lista original como respaldo (ver abajo); (1) el original tiene escrita a mano la dirección de otro repositorio (genizy/soundboard), que jsDelivr
// bloquea (403) y por eso no sonaba nada: aquí todo apunta a CDN; (2) sounds.js se importa con dirección absoluta porque
// este archivo vive en games.budsin.dev. Si ese repositorio cambia o se bloquea, se corrige CDN aquí (un solo sitio).
const CDN = "https://cdn.jsdelivr.net/gh/bubblfan/soundboard@main/";
import {
    sounds
} from 'https://cdn.jsdelivr.net/gh/bubblfan/soundboard@main/sounds.js';
// ---- Budsin: los sonidos salen de MyInstants (a través de nuestro servidor, porque muchas redes de colegio bloquean
// myinstants.com). Si MyInstants o el servidor fallan, vuelve la lista original (sounds.js) sin que se note más que una etiqueta.
const API = 'https://games.budsin.dev/api/music/sb/';
let miList = null;          // null: se usa la lista original
let miDownUntil = 0;        // tras un fallo no se insiste durante 60 s
let miSeq = 0;              // solo vale la última búsqueda
const MI_TIMEOUT = 6000;
let allowOverlap = false;
let showFavorites = false;
let currentAudios = [];
const toggleButton = document.getElementById('toggleButton');
const stopButton = document.getElementById('stopButton');
const searchInput = document.getElementById('searchInput');
const favoriteButton = document.getElementById('toggleFavorites')
const soundBoard = document.getElementById('soundboard');
toggleButton.onclick = () => {
    allowOverlap = !allowOverlap;
    toggleButton.textContent = allowOverlap ? '🔊 Overlap: ON' : '🔇 Overlap: OFF';
};
stopButton.onclick = () => {
    currentAudios.forEach(a => a.pause());
    currentAudios = [];
};
favoriteButton.onclick = () => {
    showFavorites = !showFavorites;
    favoriteButton.textContent = showFavorites ? '🌟 Favorites: ON' : '⭐ Favorites: OFF';
    if (showFavorites) renderSounds("filter:favorite "+searchInput.value); else refresh();
}

function renderSounds(filter = '', list = null) {
    soundBoard.innerHTML = '';
    let finalSound;
    if (filter.startsWith("filter:favorite ")) {
        finalSound = (localStorage.getItem('favorites') ? JSON.parse(localStorage.getItem('favorites')) : [])
            .filter(s => s.name.toLowerCase().includes(filter.toLowerCase().replace('filter:favorite ', '')));
    } else {
        finalSound = list || sounds.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
    }
    finalSound.forEach(sound => {
        const wrapper = document.createElement('div');
        wrapper.className = 'sound-wrapper';
        const button = document.createElement('button');
        wrapper.addEventListener("contextmenu", (e) => {
            rightClickPanel(e, wrapper, sound);
        });        
        button.className = 'sound-button-img';
        button.style.setProperty('--btn-color', sound.color);
        const image = document.createElement('div');
        image.className = 'sound-image';
        button.appendChild(image);
        button.onclick = () => {
            if (!allowOverlap) {
                currentAudios.forEach(a => a.pause());
                currentAudios = [];
            }
            const audio = new Audio(sound.url || CDN+sound.mp3);
            audio.play().catch(() => {});
            currentAudios.push(audio);
            image.classList.add('pressed');
            setTimeout(() => image.classList.remove('pressed'), 150);
        };
        const label = document.createElement('div');
        label.className = 'sound-label';
        label.textContent = sound.name;
        wrapper.appendChild(button);
        wrapper.appendChild(label);
        soundBoard.appendChild(wrapper);
    });
}
const sourceTag = document.createElement('div');
sourceTag.id = 'sbSource';
sourceTag.style.cssText = 'text-align:center;font:12px system-ui,sans-serif;color:#aaa;margin:4px 0 0;min-height:16px';
document.getElementById('controls').after(sourceTag);
function setSource(kind) {
    sourceTag.textContent = kind === 'mi' ? '🌐 MyInstants' : kind === 'loading' ? '⏳ Cargando MyInstants…' : '📁 Lista original (MyInstants no responde)';
}
async function miFetch(q) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MI_TIMEOUT);
    try {
        const r = await fetch(API + 'search?q=' + encodeURIComponent(q), { signal: ctrl.signal });
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        if (!j || !Array.isArray(j.items)) throw new Error('bad answer');
        return j.items
            .filter(i => i && typeof i.name === 'string' && /^[A-Za-z0-9_.%-]{1,120}\.mp3$/.test(i.file))
            .map(i => ({ name: i.name, color: /^#[0-9a-fA-F]{3,8}$/.test(i.color) ? i.color : '#888888', mp3: i.file, url: API + 'mp3/' + i.file }));
    } finally { clearTimeout(timer); }
}
// Pinta lo que corresponde: MyInstants (tendencias o búsqueda) y, si falla o no hay nada, la lista original.
async function refresh() {
    const q = searchInput.value.trim();
    if (showFavorites) { renderSounds('filter:favorite ' + searchInput.value); return; }
    const seq = ++miSeq;
    if (Date.now() >= miDownUntil) {
        if (!miList) { soundBoard.innerHTML = ''; setSource('loading'); }
        try {
            const list = await miFetch(q);
            if (seq !== miSeq) return;
            if (list.length) { miList = list; setSource('mi'); renderSounds(q, list); return; }
            // MyInstants contestó pero sin resultados: se busca en la lista original
            miList = null; setSource('mi'); renderSounds(q); return;
        } catch (e) {
            if (seq !== miSeq) return;
            miDownUntil = Date.now() + 60000;
        }
    }
    miList = null; setSource('orig'); renderSounds(q);
}
let miTimer = 0;
searchInput.addEventListener('input', () => {
    clearTimeout(miTimer);
    if (showFavorites) { renderSounds('filter:favorite ' + searchInput.value); return; }
    miTimer = setTimeout(refresh, 350);
});
refresh();

function rightClickPanel(event, button, sound) {
    document.querySelectorAll('.right-click-panel').forEach(p => p.remove());

    const panel = document.createElement('div');
    panel.className = 'right-click-panel';
    panel.style.setProperty('--btn-color', button.style.getPropertyValue('--btn-color'));
    panel.style.position = 'absolute';
    panel.style.left = `${event.pageX}px`;
    panel.style.top = `${event.pageY}px`;

    // favorite button
    let favoriteJson = localStorage.getItem('favorites') ? JSON.parse(localStorage.getItem('favorites')) : [];
    const favorite = document.createElement('button');
    favorite.className = 'right-click-panel-button';
    const isFavorite = favoriteJson.some(item => item.name === sound.name);
    favorite.textContent = isFavorite ? '⭐ Unfavorite' : "🌟 Favorite";

    favorite.onclick = () => {
        const isFavorite = favoriteJson.some(item => item.name === sound.name);
        if (isFavorite) {
            favoriteJson = favoriteJson.filter(item => item.name !== sound.name);
            if (showFavorites) {
                renderSounds("filter:favorite "+searchInput.value);
            }
        } else {
            favoriteJson.push(sound);
        }
        localStorage.setItem("favorites", JSON.stringify(favoriteJson));
        panel.remove();
    };
    
    // download button
    const download = document.createElement('button');
    download.className = 'right-click-panel-button';
    download.textContent = '💾 Download';
    
    download.onclick = () => {
        const link = document.createElement('a');
        link.href = sound.url || CDN+sound.mp3;
        link.download = sound.mp3.split("/").pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    panel.appendChild(favorite);
    panel.appendChild(download);
    document.body.appendChild(panel);

    event.preventDefault();

    setTimeout(() => {
        const handleOutsideClick = (e) => {
            if (!panel.contains(e.target)) {
                panel.remove();
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        document.addEventListener('click', handleOutsideClick);
    }, 0);
}

// tts

const ttsToggle     = document.getElementById('ttsToggle');
const ttsPanel      = document.getElementById('ttsPanel');
const ttsClose      = document.getElementById('ttsClose');
const ttsText       = document.getElementById('ttsText');
const ttsVoice      = document.getElementById('ttsVoice');
const ttsLangFilter = document.getElementById('ttsLangFilter');
const ttsVolume     = document.getElementById('ttsVolume');
const ttsRate       = document.getElementById('ttsRate');
const ttsPitch      = document.getElementById('ttsPitch');
const ttsVolumeVal  = document.getElementById('ttsVolumeVal');
const ttsRateVal    = document.getElementById('ttsRateVal');
const ttsPitchVal   = document.getElementById('ttsPitchVal');
const ttsSpeak      = document.getElementById('ttsSpeak');
const ttsPauseBtn   = document.getElementById('ttsPause');
const ttsResumeBtn  = document.getElementById('ttsResume');
const ttsStopBtn    = document.getElementById('ttsStop');
const ttsResetBtn   = document.getElementById('ttsReset');
const ttsStatus     = document.getElementById('ttsStatus');
const ttsSpeaking   = document.getElementById('ttsSpeaking');
const ttsCurrentWord = document.getElementById('ttsCurrentWord');

const synth = window.speechSynthesis;
let allVoices = [];
let currentUtterance = null;

ttsToggle.onclick = () => {
    ttsPanel.classList.toggle('hidden');
    ttsToggle.classList.toggle('tts-toggle-active');
};
ttsClose.onclick = () => {
    ttsPanel.classList.add('hidden');
    ttsToggle.classList.remove('tts-toggle-active');
};

function loadVoices() {
    allVoices = synth.getVoices();
    if (!allVoices.length) return;

    const langs = [...new Set(allVoices.map(v => v.lang))].sort();
    ttsLangFilter.innerHTML = '<option value="">All Languages</option>';
    langs.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang;
        opt.textContent = lang;
        ttsLangFilter.appendChild(opt);
    });

    populateVoiceList('');
}

function populateVoiceList(langFilter) {
    const filtered = langFilter
        ? allVoices.filter(v => v.lang === langFilter)
        : allVoices;

    ttsVoice.innerHTML = '';
    filtered.forEach((voice, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.dataset.voiceName = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})${voice.default ? ' ★' : ''}`;
        ttsVoice.appendChild(opt);
    });

    const defIdx = filtered.findIndex(v => v.default);
    if (defIdx >= 0) ttsVoice.selectedIndex = defIdx;
}

function getSelectedVoice() {
    const langFilter = ttsLangFilter.value;
    const filtered   = langFilter ? allVoices.filter(v => v.lang === langFilter) : allVoices;
    return filtered[ttsVoice.selectedIndex] || null;
}

loadVoices();
if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
}

ttsLangFilter.addEventListener('change', () => {
    populateVoiceList(ttsLangFilter.value);
});

ttsVolume.addEventListener('input', () => { ttsVolumeVal.textContent = parseFloat(ttsVolume.value).toFixed(2); });
ttsRate.addEventListener('input',   () => { ttsRateVal.textContent   = parseFloat(ttsRate.value).toFixed(1); });
ttsPitch.addEventListener('input',  () => { ttsPitchVal.textContent  = parseFloat(ttsPitch.value).toFixed(2); });

ttsSpeak.onclick = () => {
    const text = ttsText.value.trim();
    if (!text) {
        setStatus('⚠️ Please enter some text first.', 'warn');
        return;
    }
    synth.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.voice  = getSelectedVoice();
    currentUtterance.volume = parseFloat(ttsVolume.value);
    currentUtterance.rate   = parseFloat(ttsRate.value);
    currentUtterance.pitch  = parseFloat(ttsPitch.value);

    currentUtterance.onstart = () => {
        setStatus('🔊 Speaking…', 'speaking');
        setBtns(true);
        ttsSpeaking.classList.remove('hidden');
    };

    currentUtterance.onboundary = (e) => {
        if (e.name === 'word') {
            const word = text.substr(e.charIndex, e.charLength);
            ttsCurrentWord.textContent = word;
            ttsCurrentWord.classList.remove('word-pop');
            void ttsCurrentWord.offsetWidth; // reflow
            ttsCurrentWord.classList.add('word-pop');
        }
    };

    currentUtterance.onpause = () => {
        setStatus('⏸ Paused', 'paused');
    };

    currentUtterance.onresume = () => {
        setStatus('🔊 Resumed…', 'speaking');
    };

    currentUtterance.onend = () => {
        setStatus('✅ Done', 'done');
        setBtns(false);
        ttsSpeaking.classList.add('hidden');
        ttsCurrentWord.textContent = '';
    };

    currentUtterance.onerror = (e) => {
        setStatus(`❌ Error: ${e.error}`, 'error');
        setBtns(false);
        ttsSpeaking.classList.add('hidden');
    };

    synth.speak(currentUtterance);
};

ttsPauseBtn.onclick = () => {
    if (synth.speaking && !synth.paused) synth.pause();
    ttsPauseBtn.disabled  = true;
    ttsResumeBtn.disabled = false;
};

ttsResumeBtn.onclick = () => {
    if (synth.paused) synth.resume();
    ttsPauseBtn.disabled  = false;
    ttsResumeBtn.disabled = true;
};

ttsStopBtn.onclick = () => {
    synth.cancel();
    setBtns(false);
    ttsSpeaking.classList.add('hidden');
    ttsCurrentWord.textContent = '';
    setStatus('⏹ Stopped', 'idle');
};

ttsResetBtn.onclick = () => {
    ttsVolume.value = 1;   ttsVolumeVal.textContent = '1.00';
    ttsRate.value   = 1;   ttsRateVal.textContent   = '1.0';
    ttsPitch.value  = 1;   ttsPitchVal.textContent  = '1.00';
    ttsLangFilter.value = '';
    populateVoiceList('');
    setStatus('↺ Settings reset', 'idle');
};

function setBtns(active) {
    ttsSpeak.disabled     =  active;
    ttsPauseBtn.disabled  = !active;
    ttsStopBtn.disabled   = !active;
    ttsResumeBtn.disabled = true;
}

function setStatus(msg, state) {
    ttsStatus.textContent = msg;
    ttsStatus.className = `tts-status tts-status--${state}`;

}