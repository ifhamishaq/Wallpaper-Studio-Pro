// Create: a live device preview, one floating composer, and sheets for subject / style /
// format / tuning. Generation is abortable and keeps partial batches.
import {
    $, $$, esc, ic, clamp, randInt, pick, sleep, photo, hueOf, toast, safeUrl
} from './lib.js';
import { GENRES, STYLES, FORMATS, TONES, MODELS, MODIFIERS, API, APP } from './config.js';
import { state, fmt, model, savePrefs, register, on, emit, addToHistory, normalizeItem, saveHistory, isFavorite } from './state.js';
import { createPlasma } from './plasma.js';
import * as cloud from './cloud.js';
import { openDialog, closeDialog } from './dialogs.js';
import * as items from './items.js';
import { openViewer } from './viewer.js';
import { setCredits, refreshCredits } from './account.js';

const { db } = cloud;

/** Element lookup by id, camelCase -> kebab-case, cached: E.createBtn === #create-btn */
const E = new Proxy({}, {
    get: (cache, key) => (cache[key] ??= document.getElementById(String(key).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())))
});

const LEGACY_NAMES = { Hassalblad: 'Hasselblad' };
const STATUS_LINES = ['Reading your prompt…', 'Mixing subject & style…', 'Painting pixels…', 'Adding fine detail…', 'Almost there…'];

let results = [];
let active = 0;
let busy = null;
let plasma = null;
let bdFront = 'b';
let bdKey = '';
let sampleKey = '';
const built = {};

// ------------------------------------------------------------------ prompt
export function effectivePrompt() {
    const text = E.prompt.value.trim();
    if (state.exact && text) return text;
    const g = GENRES[state.genre], s = STYLES[state.style];
    const tone = state.tone ? `, ${state.tone} color palette` : '';
    const mod = state.modifier ? `, ${state.modifier}` : '';
    // Style prompts end in a preposition ("…depicting", "…of"), so they come first.
    return `${s.prompt} ${text || g.prompt}${tone}${mod}, wallpaper, highly detailed`;
}

function autosize() {
    const ta = E.prompt;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
}

// ------------------------------------------------------------------ rendering
const shapeOf = (r) => (r < 0.8 ? 'tall' : r > 1.25 ? 'wide' : 'square');

function renderChips() {
    const text = E.prompt.value.trim();
    E.vSubject.textContent = state.exact ? 'Exact prompt' : text ? 'Custom' : GENRES[state.genre].name;
    E.vStyle.textContent = STYLES[state.style].name;
    E.vFormat.textContent = fmt().label;
    const tweaks = [state.steps !== model().maxSteps, state.seed != null, state.batch > 1, !!state.tone, MODELS.length > 1 && state.model !== MODELS[0].id].filter(Boolean).length;
    E.vTune.textContent = tweaks ? `${tweaks} changed` : model().name;
    E.promptNote.hidden = !state.exact;
    E.promptNote.querySelector('span').textContent = 'Using an exact prompt';
    E.prompt.placeholder = state.exact ? 'Exact prompt' : 'Describe a subject — or tap Create';
}

function crossfade(a, b, src) {
    const next = bdFront === 'a' ? b : a;
    const prev = bdFront === 'a' ? a : b;
    next.onload = () => { next.classList.add('on'); prev.classList.remove('on'); bdFront = bdFront === 'a' ? 'b' : 'a'; };
    next.src = src;
    if (next.complete && next.naturalWidth) next.onload();
}

function applyAccent() {
    const g = GENRES[state.genre];
    document.documentElement.style.setProperty('--h', hueOf(g.color));
}

function applyDevice() {
    const f = fmt(), r = f.w / f.h;
    E.device.dataset.kind = f.kind;
    E.device.style.setProperty('--r', r.toFixed(4));
    E.stageArea.dataset.kind = f.kind;
    E.dims.textContent = `${f.w} × ${f.h}`;
}

function renderSample() {
    if (results.length || busy) return;
    const g = GENRES[state.genre], f = fmt(), r = f.w / f.h;
    const w = r > 1 ? 1100 : 640, h = Math.round(w / r);
    const key = `${state.genre}:${w}x${h}`;
    E.sampleTag.hidden = false;
    E.device.dataset.state = 'idle';
    if (key === sampleKey) return;
    sampleKey = key;
    E.shot.classList.remove('ld');
    E.shot.alt = `${g.name} sample`;
    E.shot.src = photo(g.image, w, h);
}

function renderBackdrop() {
    const g = GENRES[state.genre];
    const key = String(state.genre);
    if (key === bdKey) return;
    bdKey = key;
    crossfade(E.bdA, E.bdB, photo(g.image, 90, 160));
}

function renderCta() {
    const cost = state.batch * APP.CREDIT_COST;
    E.createBtn.dataset.busy = !!busy;
    E.createBtn.setAttribute('aria-label', busy ? 'Stop generating' : 'Create wallpaper');
    E.createLabel.textContent = busy ? 'Stop' : state.user ? `Create · ${cost}` : state.batch > 1 ? `Create ×${state.batch}` : 'Create';
}

function renderAll() {
    applyAccent();
    applyDevice();
    renderChips();
    renderBackdrop();
    renderSample();
    renderCta();
    savePrefs();
}

function renderResultBar() {
    const has = results.length > 0 && !busy;
    E.resultActions.hidden = !has;
    E.variants.hidden = !(has && results.length > 1);
    $('#stage-wrap').dataset.hasResult = has;
    if (!has) return;
    const it = results[active];
    $('[data-action="result-fav"]').setAttribute('aria-pressed', isFavorite(it));
    $$('#variants .variant').forEach((b, i) => b.setAttribute('aria-pressed', i === active));
}

function showResult(i) {
    active = i;
    const it = results[i];
    E.shot.classList.remove('ld');
    E.shot.alt = `Generated ${it.genre} wallpaper`;
    E.shot.src = safeUrl(it.url);
    E.sampleTag.hidden = true;
    E.device.dataset.state = 'done';
    renderResultBar();
}

function clearResults() {
    results = [];
    active = 0;
    sampleKey = '';
    E.variants.innerHTML = '';
    renderSample();
    renderResultBar();
}

// ------------------------------------------------------------------ generation
function onPlasmaFrame(t) {
    const tenth = Math.floor(t * 10);
    if (tenth === onPlasmaFrame.last) return;
    onPlasmaFrame.last = tenth;
    E.busyTime.textContent = t.toFixed(1);
    const s = Math.min(STATUS_LINES.length - 1, Math.floor(t / 4));
    if (s !== onPlasmaFrame.status) {
        onPlasmaFrame.status = s;
        E.busyText.textContent = s === 0 && state.batch > 1 ? `Generating ${state.batch} variations…` : STATUS_LINES[s];
    }
}

async function requestImage(body, signal) {
    let lastErr;
    for (let attempt = 0; attempt < API.MAX_RETRIES; attempt++) {
        try {
            const res = await fetch(API.ENDPOINT, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal
            });
            if (res.ok) {
                const data = await res.json();
                const out = Array.isArray(data.output) ? data.output[0] : data.output;
                if (safeUrl(out)) return out;
                throw Object.assign(new Error('Unexpected response'), { fatal: true });
            }
            const err = new Error(`HTTP ${res.status}`);
            err.status = res.status;
            if (res.status < 500 && res.status !== 429) { err.fatal = true; throw err; }
            lastErr = err;
        } catch (e) {
            if (e.name === 'AbortError' || e.fatal) throw e;
            lastErr = e;
        }
        await sleep(API.RETRY_DELAY * (attempt + 1), signal);
    }
    throw lastErr;
}

async function generate() {
    if (busy) { busy.abort(); return; }
    const g = GENRES[state.genre], s = STYLES[state.style], f = fmt();
    const prompt = effectivePrompt();
    const sub = state.exact ? null : E.prompt.value.trim();
    const n = state.batch;

    if (state.user) {
        try {
            const credits = await refreshCredits();
            if (credits < n * APP.CREDIT_COST) {
                toast(`Not enough credits — need ${n * APP.CREDIT_COST}, you have ${credits}`, 'error', 4500);
                return;
            }
        } catch (e) {
            console.warn('Credit check failed', e); // don't block creation on a cloud hiccup
        }
    }
    if (busy) return;

    const ac = new AbortController();
    busy = ac;
    results = [];
    E.variants.innerHTML = '';
    E.device.dataset.state = 'busy';
    E.sampleTag.hidden = true;
    onPlasmaFrame.last = onPlasmaFrame.status = -1;
    E.busyTime.textContent = '0.0';
    E.busyText.textContent = STATUS_LINES[0];
    plasma ??= createPlasma(E.plasma, { onFrame: onPlasmaFrame });
    plasma.start({ ratio: f.w / f.h, hue: hueOf(g.color) });
    renderCta();
    renderResultBar();

    const base = state.seed ?? randInt();
    const jobs = Array.from({ length: n }, (_, i) => requestImage({
        prompt, model: state.model, width: f.w, height: f.h, steps: state.steps, seed: base + i
    }, ac.signal));
    const settled = await Promise.allSettled(jobs);

    plasma.stop();
    busy = null;
    renderCta();

    if (ac.signal.aborted) {
        renderSample();
        E.device.dataset.state = 'idle';
        toast('Stopped', 'info', 1500);
        return;
    }

    const ts = Date.now();
    const made = settled
        .map((r, i) => (r.status === 'fulfilled' ? normalizeItem({
            id: `${ts}-${i}`, ts: ts - i, url: r.value, genre: g.name, style: s.name, prompt, sub, seed: base + i, w: f.w, h: f.h
        }) : null))
        .filter(Boolean);

    if (!made.length) {
        sampleKey = '';
        renderSample();
        const status = settled[0]?.reason?.status;
        console.error('Generation failed', settled.map((r) => r.reason));
        toast(status === 429 || status >= 500 ? 'The image servers are busy — please try again shortly.' : 'Generation failed. Please try again.', 'error', 4500);
        return;
    }

    addToHistory(made);
    results = made;
    E.variants.innerHTML = made.map((it, i) => `
        <button type="button" class="variant" data-action="variant" data-i="${i}" aria-label="Variation ${i + 1}" aria-pressed="${i === 0}">
            <img src="${esc(safeUrl(it.url))}" alt="" decoding="async">
        </button>`).join('');
    showResult(0);
    toast(made.length < n ? `${made.length} of ${n} variations ready` : n > 1 ? `${n} variations ready` : 'Wallpaper ready', made.length < n ? 'warning' : 'success');

    if (state.user) finalizeCloud(made);
}

/** After the result is on screen: charge credits and back the images up. */
async function finalizeCloud(made) {
    try {
        await db.deduct(state.user.id, made.length * APP.CREDIT_COST);
        await refreshCredits();
    } catch (e) { console.warn('Credit deduction failed', e); }
    try {
        const rows = await db.saveMany(made.map((i) => items.toLocalRow(i, false)));
        const byUrl = new Map(rows.map((r) => [r.url, r]));
        made.forEach((i) => { i.synced = true; const r = byUrl.get(i.url); if (r) i.cloudId = r.id; });
        saveHistory();
    } catch (e) { console.warn('Cloud save failed', e); }
}

// ------------------------------------------------------------------ remix / recipes
function applyRecipe(item) {
    const gi = GENRES.findIndex((g) => g.name === (LEGACY_NAMES[item.genre] || item.genre));
    if (gi >= 0) state.genre = gi;
    const si = STYLES.findIndex((s) => s.name === (LEGACY_NAMES[item.style] || item.style));
    if (si >= 0) state.style = si;
    if (item.seed != null && Number.isFinite(Number(item.seed))) state.seed = Number(item.seed);
    if (item.w && item.h) {
        const match = FORMATS.find((f) => f.w === item.w && f.h === item.h);
        if (match) state.format = match.id;
    }
    state.modifier = '';
    state.tone = null;
    state.exact = false;
    if (item.sub !== null && item.sub !== undefined) {
        E.prompt.value = item.sub; // made by this app: the subject text alone reproduces it
    } else {
        E.prompt.value = '';
        const plain = effectivePrompt();
        if (item.prompt && item.prompt !== plain) { state.exact = true; E.prompt.value = item.prompt; }
    }
    clearResults();
    autosize();
    renderAll();
    syncSeedNote();
    emit('navigate', 'create');
    toast(item.seed != null ? `Recipe loaded · seed ${item.seed}` : 'Recipe loaded', 'success');
}

function surprise() {
    if (busy) return;
    state.genre = randInt(GENRES.length);
    state.style = randInt(STYLES.length);
    state.modifier = pick(MODIFIERS);
    state.exact = false;
    E.prompt.value = '';
    autosize();
    clearResults();
    renderAll();
}

// ------------------------------------------------------------------ sheets
function tileHtml(type, list) {
    return list.map((it, i) => {
        const h = type === 'subject' ? hueOf(it.color) : (i * 47 + 20) % 360;
        return `<button type="button" class="pick" data-action="pick" data-type="${type}" data-i="${i}" aria-pressed="false" style="--tint:hsl(${h} 60% 38%)">
            <img src="${esc(photo(it.image, 260, 330))}" alt="" loading="lazy" decoding="async"><span>${esc(it.name)}</span></button>`;
    }).join('');
}

function syncPicks(type) {
    const idx = type === 'subject' ? state.genre : state.style;
    $$(`#grid-${type} .pick`).forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.i) === idx));
}

function renderFormats() {
    $('#list-format').innerHTML = FORMATS.map((f) => `
        <button type="button" class="fmt-row" data-action="pick-format" data-id="${f.id}" aria-pressed="${f.id === state.format}">
            <span class="fmt-glyph" style="--g:${(f.w / f.h).toFixed(3)}"></span>
            <span class="fmt-text"><strong>${esc(f.label)}</strong><small>${esc(f.hint)}</small></span>
            <span class="fmt-dims dm">${f.w}×${f.h}</span>
            ${ic('check')}
        </button>`).join('');
}

function syncSeedNote() {
    E.seed.value = state.seed ?? '';
}

function renderTune() {
    // model
    $('#model-list').innerHTML = MODELS.map((m) => `
        <button type="button" class="model-row" data-action="pick-model" data-id="${m.id}" aria-pressed="${m.id === state.model}">
            <span class="fmt-text"><strong>${esc(m.name)}</strong><small>${esc(m.blurb)}</small></span>${ic('check')}
        </button>`).join('');
    // batch
    $$('#batch-seg [data-batch]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.batch) === state.batch));
    // steps
    const max = model().maxSteps;
    E.steps.max = max;
    state.steps = clamp(state.steps, 1, max);
    E.steps.value = state.steps;
    E.stepsVal.textContent = state.steps;
    syncSeedNote();
    // tones
    $$('#tones .tone').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.id || null) === state.tone));
    E.finalPrompt.value = effectivePrompt();
}

function openSheet(name) {
    if (busy) return;
    const dlg = $(`#sheet-${name}`);
    if (name === 'subject' || name === 'style') {
        const list = name === 'subject' ? GENRES : STYLES;
        if (!built[name]) { $(`#grid-${name}`).innerHTML = tileHtml(name, list); built[name] = true; }
        syncPicks(name);
    }
    if (name === 'format') renderFormats();
    if (name === 'tune') renderTune();
    openDialog(dlg);
    if (name === 'subject' || name === 'style') {
        requestAnimationFrame(() => $(`#grid-${name} .pick[aria-pressed="true"]`)?.scrollIntoView({ block: 'center' }));
    }
}

// ------------------------------------------------------------------ init
export function init() {
    // tone swatches
    $('#tones').innerHTML =
        `<button type="button" class="tone tone-none" data-action="pick-tone" data-id="" aria-pressed="false" aria-label="No tone" title="No tone">${ic('x')}</button>` +
        TONES.map((t) => `<button type="button" class="tone" data-action="pick-tone" data-id="${esc(t.id)}" aria-pressed="false" aria-label="${esc(t.name)}" title="${esc(t.name)}" style="--sw:${t.hex}"></button>`).join('');

    register({
        generate,
        surprise,
        sheet: (el) => openSheet(el.dataset.sheet),
        pick: (el) => {
            const type = el.dataset.type, i = Number(el.dataset.i);
            if (type === 'subject') state.genre = i; else state.style = i;
            state.modifier = '';
            renderAll();
            closeDialog(el.closest('dialog'));
        },
        'pick-format': (el) => { state.format = el.dataset.id; renderAll(); closeDialog(el.closest('dialog')); },
        'pick-model': (el) => { state.model = el.dataset.id; renderTune(); renderChips(); savePrefs(); },
        'pick-tone': (el) => { state.tone = el.dataset.id || null; renderTune(); renderChips(); savePrefs(); },
        'set-batch': (el) => { state.batch = Number(el.dataset.batch); renderTune(); renderChips(); renderCta(); },
        'seed-random': () => { state.seed = randInt(); syncSeedNote(); renderChips(); },
        'seed-clear': () => { state.seed = null; syncSeedNote(); renderChips(); },
        'copy-prompt': () => navigator.clipboard.writeText(effectivePrompt()).then(() => toast('Prompt copied', 'success', 1500), () => toast('Couldn’t copy', 'error')),
        'prompt-reset': () => { state.exact = false; E.prompt.value = ''; autosize(); renderChips(); },
        'tune-reset': () => {
            state.steps = model().maxSteps; state.seed = null; state.batch = 1; state.tone = null; state.modifier = '';
            renderTune(); renderChips(); renderCta(); savePrefs();
        },
        variant: (el) => showResult(Number(el.dataset.i)),
        'result-download': () => results[active] && items.download(results[active]),
        'result-share': () => results[active] && items.share(results[active]),
        'result-fav': () => { if (results[active]) { items.toggleFavorite(results[active]); renderResultBar(); } },
        'result-open': () => results.length && openViewer(results, active),
        'result-clear': () => clearResults()
    });

    // typing
    E.prompt.addEventListener('input', () => {
        autosize();
        if (!E.prompt.value.trim()) state.exact = false;
        renderChips();
    });

    // tune controls
    E.steps.addEventListener('input', () => {
        state.steps = clamp(Number(E.steps.value) || 1, 1, model().maxSteps);
        E.stepsVal.textContent = state.steps;
        renderChips();
        savePrefs();
    });
    E.seed.addEventListener('input', () => {
        const v = E.seed.value.trim();
        state.seed = v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v)));
        renderChips();
    });

    E.shot.addEventListener('load', () => E.shot.classList.add('ld'));

    // keep the "final prompt" field live while the tune sheet is open
    $('#sheet-tune').addEventListener('input', () => { E.finalPrompt.value = effectivePrompt(); });

    on('remix', applyRecipe);
    on('user:changed', renderCta);
    on('item:changed', () => renderResultBar());

    autosize();
    renderAll();
}

export function key(e) {
    if ((e.key === 'r' || e.key === 'R') && !busy) { surprise(); return true; }
    return false;
}

export const isBusy = () => !!busy;
export const generateNow = generate;
