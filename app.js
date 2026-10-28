// Wallpaper Studio Pro — application controller
import { GENRES, STYLES, FORMATS, TONES, MODIFIERS, API, APP } from './config.js';
import {
    $, $$, esc, ic, safeUrl, clamp, randInt, pick, slug, prefersReducedMotion,
    debounce, sleep, store, photo, hueOf, toast, avatarHtml
} from './lib.js';
import { createDots } from './dots.js';
import * as cloud from './supabase.js';

const { db, auth } = cloud;

/** Element lookup by id, camelCase -> kebab-case, cached: E.heroA === #hero-a */
const E = new Proxy({}, {
    get: (cache, key) => (cache[key] ??= document.getElementById(String(key).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())))
});

const LEGACY_NAMES = { Hassalblad: 'Hasselblad' };
const COMMUNITY_PAGE = 24;
const STATUS_LINES = ['Reading your prompt…', 'Mixing genre & style…', 'Diffusing pixels…', 'Adding fine detail…', 'Almost there…'];

// ============================================================================
// STATE
// ============================================================================
const saved = store.get('wsp_prefs', null) || {};
const legacy = store.get('wallpaper_preferences', null) || {};
const index = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);

const state = {
    genre: index(saved.genre ?? legacy.genreIndex, GENRES.length),
    style: index(saved.style ?? legacy.styleIndex, STYLES.length),
    format: FORMATS.some((f) => f.id === saved.format) ? saved.format : (matchMedia('(max-width: 759px)').matches ? 'phone' : 'desktop'),
    tone: TONES.some((t) => t.id === saved.tone) ? saved.tone : null,
    steps: clamp(Number(saved.steps) || 4, 1, 4),
    seed: null,
    batch: 1,
    modifier: '',
    custom: false,

    view: 'create',
    user: null,
    profile: null,
    credits: null,
    following: new Set(),

    history: loadHistory(),
    favorites: new Set(store.get('wallpaper_favorites', [])),
    filter: 'all',

    busy: null,
    results: null,

    community: { source: 'all', sort: 'new', q: '', creator: null, page: 0, more: true, loading: false, token: 0, loaded: false, items: new Map() }
};

const fmt = () => FORMATS.find((f) => f.id === state.format) || FORMATS[0];
const savePrefs = () => store.set('wsp_prefs', { genre: state.genre, style: state.style, format: state.format, tone: state.tone, steps: state.steps });
const saveHistory = () => store.set('wallpaper_history', state.history);
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

function normalizeItem(i) {
    const ts = i.ts || i.timestamp || Date.now();
    return {
        id: String(i.id || ts), ts, timestamp: ts, url: i.url,
        genre: i.genre || '', style: i.style || '', prompt: i.prompt || '', seed: i.seed ?? null,
        w: i.w || null, h: i.h || null, synced: !!i.synced
    };
}

function loadHistory() {
    const raw = store.get('wallpaper_history', []);
    return Array.isArray(raw) ? raw.filter((i) => i && i.url).map(normalizeItem) : [];
}

// ============================================================================
// SELECTION, HERO, PROMPT
// ============================================================================
function autoPrompt() {
    const g = GENRES[state.genre], s = STYLES[state.style];
    const tone = state.tone ? `, ${state.tone} color palette` : '';
    const mod = state.modifier ? `, ${state.modifier}` : '';
    // Style prompts end in a preposition ("…depicting", "…of"), so they must come first.
    return `${s.prompt} ${g.prompt}${tone}${mod}, wallpaper, highly detailed`;
}

function syncPrompt() {
    if (!state.custom) E.prompt.value = autoPrompt();
    E.promptReset.hidden = !state.custom;
}

const shapeOf = (r) => (r < 0.8 ? 'tall' : r > 1.25 ? 'wide' : 'square');
let heroKey = '';
let heroToken = 0;
let heroFront = 'b'; // the layer currently visible (swapped on each change)

function heroSource(g, shape) {
    if (shape === 'tall') return photo(g.image, 720, 1280);
    if (shape === 'square') return photo(g.image, 900, 900);
    return photo(g.image, 1200, 720);
}

function setHeroImage(src) {
    const token = ++heroToken;
    const next = heroFront === 'a' ? E.heroB : E.heroA;
    const prev = heroFront === 'a' ? E.heroA : E.heroB;
    const show = () => {
        if (token !== heroToken) return;
        next.classList.add('is-on');
        prev.classList.remove('is-on');
        heroFront = heroFront === 'a' ? 'b' : 'a';
    };
    next.onload = show;
    next.onerror = () => { if (token === heroToken) { next.classList.remove('is-on'); prev.classList.remove('is-on'); } };
    next.src = src;
    if (next.complete && next.naturalWidth) show();
}

function applyGenreColor(g) {
    const h = hueOf(g.color);
    const bg = E.bg.style;
    bg.setProperty('--c1', `hsl(${h} 92% 56% / .55)`);
    bg.setProperty('--c2', `hsl(${(h + 48) % 360} 88% 58% / .4)`);
    bg.setProperty('--c3', `hsl(${(h + 312) % 360} 85% 52% / .38)`);
    E.viewCreate.style.setProperty('--tint', `hsl(${h} 88% 52% / .6)`);
}

function renderSelection() {
    const g = GENRES[state.genre], s = STYLES[state.style];
    E.genreName.textContent = g.name;
    E.styleName.textContent = s.name;
    E.heroIndex.textContent = String(state.genre + 1).padStart(2, '0');
    E.genreCount.textContent = `${String(state.genre + 1).padStart(2, '0')}/${GENRES.length}`;
    E.styleCount.textContent = `${String(state.style + 1).padStart(2, '0')}/${STYLES.length}`;

    const shape = shapeOf(fmt().w / fmt().h);
    const key = `${state.genre}:${shape}`;
    if (key !== heroKey) {
        if (!heroKey) E.heroA.fetchPriority = E.heroB.fetchPriority = 'high';
        heroKey = key;
        setHeroImage(heroSource(g, shape));
        applyGenreColor(g);
    }

    for (const [type, rail] of [['genre', E.genreRail], ['style', E.styleRail]]) {
        Array.from(rail.children).forEach((tile, i) => {
            const on = i === state[type];
            tile.setAttribute('aria-checked', on);
            tile.tabIndex = on ? 0 : -1;
        });
    }
    syncPrompt();
    savePrefs();
}

function select(type, i, { center = true, manual = true } = {}) {
    const n = type === 'genre' ? GENRES.length : STYLES.length;
    state[type] = ((i % n) + n) % n;
    if (manual) state.modifier = '';
    renderSelection();
    if (center) centerTile(type);
}

function centerTile(type, smooth = true) {
    const rail = type === 'genre' ? E.genreRail : E.styleRail;
    const tile = rail.children[state[type]];
    if (!tile || !rail.clientWidth) return;
    rail.scrollTo({
        left: tile.offsetLeft - (rail.clientWidth - tile.offsetWidth) / 2,
        behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto'
    });
}

function randomize() {
    if (state.busy) return;
    closeResult();
    state.genre = randInt(GENRES.length);
    state.style = randInt(STYLES.length);
    state.modifier = pick(MODIFIERS);
    state.custom = false;
    renderSelection();
    centerTile('genre');
    centerTile('style');
}

function tileTint(item, i, type) {
    const h = type === 'genre' ? hueOf(item.color) : (i * 47 + 20) % 360;
    return `hsl(${h} 60% 40%)`;
}

function buildRails() {
    for (const [type, items, rail] of [['genre', GENRES, E.genreRail], ['style', STYLES, E.styleRail]]) {
        rail.innerHTML = items.map((it, i) => `
            <button type="button" class="tile" role="radio" aria-checked="false" tabindex="-1"
                data-action="pick" data-type="${type}" data-i="${i}" style="--tint:${tileTint(it, i, type)}">
                <img src="${esc(photo(it.image, 240, 320))}" alt="" width="120" height="160" loading="lazy" decoding="async">
                <span class="tile-name">${esc(it.name)}</span>
            </button>`).join('');
    }
}

function buildTones() {
    E.tones.innerHTML =
        `<button type="button" class="tone tone-none" data-action="tone" data-id="" aria-pressed="false" aria-label="No color tone" title="No tone">${ic('x')}</button>` +
        TONES.map((t) => `<button type="button" class="tone" data-action="tone" data-id="${esc(t.id)}" aria-pressed="false" aria-label="${esc(t.name)} tone" title="${esc(t.name)}" style="--sw:${t.hex}"></button>`).join('');
}

function syncTones() {
    $$('.tone', E.tones).forEach((b) => b.setAttribute('aria-pressed', (b.dataset.id || null) === state.tone));
}

function renderFormats() {
    E.formats.innerHTML = FORMATS.map((f) => `
        <button type="button" class="fmt" role="radio" aria-checked="${f.id === state.format}" data-action="format" data-id="${f.id}">
            <span class="fmt-glyph" style="--g:${(f.w / f.h).toFixed(3)}"></span>${esc(f.label)}
        </button>`).join('');
}

function applyFormat() {
    const f = fmt(), r = f.w / f.h;
    E.hero.style.setProperty('--r', r.toFixed(4));
    E.hero.dataset.shape = shapeOf(r);
    E.viewCreate.dataset.shape = E.hero.dataset.shape;
    E.dims.textContent = `${f.w} × ${f.h}`;
    $$('.fmt', E.formats).forEach((b) => b.setAttribute('aria-checked', b.dataset.id === state.format));
}

function setFormat(id) {
    if (state.busy || state.format === id) return;
    state.format = id;
    applyFormat();
    renderSelection();
}

function updateCta() {
    const cost = state.batch * APP.CREDIT_COST;
    E.generateLabel.textContent = state.user ? `Create · ${cost} credits` : (state.batch > 1 ? 'Create 4 wallpapers' : 'Create wallpaper');
    E.batchBtn.setAttribute('aria-pressed', state.batch > 1);
    E.seedNote.hidden = state.seed == null;
    E.seedNoteValue.textContent = state.seed ?? '';
}

// ============================================================================
// GENERATION
// ============================================================================
let dots = null;
let lastTenth = -1;
let lastStatus = -1;

function onDotsFrame(t) {
    const tenth = Math.floor(t * 10);
    if (tenth === lastTenth) return;
    lastTenth = tenth;
    E.busyTime.textContent = t.toFixed(1);
    const s = Math.min(STATUS_LINES.length - 1, Math.floor(t / 4));
    if (s !== lastStatus) {
        lastStatus = s;
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
    if (state.busy) return;
    const g = GENRES[state.genre], s = STYLES[state.style], f = fmt();
    const typed = E.prompt.value.trim();
    const prompt = state.custom && typed ? typed : autoPrompt();
    const n = state.batch;

    if (state.user) {
        try {
            const credits = await db.credits(state.user.id);
            setCredits(credits);
            if (credits < n * APP.CREDIT_COST) {
                toast(`Not enough credits — need ${n * APP.CREDIT_COST}, you have ${credits}`, 'error', 4500);
                return;
            }
        } catch (e) {
            console.warn('Credit check failed', e); // don't block creation on a cloud hiccup
        }
    }
    if (state.busy) return;

    const ac = new AbortController();
    state.busy = ac;
    closeResult({ keepBusy: true });
    E.hero.dataset.state = 'busy';
    E.generateBtn.disabled = true;
    lastTenth = lastStatus = -1;
    E.busyTime.textContent = '0.0';
    E.busyText.textContent = STATUS_LINES[0];
    dots ??= createDots(E.dots, { onFrame: onDotsFrame });
    dots.start();

    const base = state.seed ?? randInt();
    const jobs = Array.from({ length: n }, (_, i) =>
        requestImage({ prompt, width: f.w, height: f.h, num_steps: state.steps, seed: base + i }, ac.signal));
    const settled = await Promise.allSettled(jobs);

    dots.stop();
    state.busy = null;
    E.generateBtn.disabled = false;

    if (ac.signal.aborted) {
        E.hero.dataset.state = 'idle';
        toast('Cancelled', 'info', 1800);
        return;
    }

    const ts = Date.now();
    const items = settled
        .map((r, i) => (r.status === 'fulfilled' ? normalizeItem({
            id: `${ts}-${i}`, ts: ts + i, url: r.value, genre: g.name, style: s.name, prompt, seed: base + i, w: f.w, h: f.h
        }) : null))
        .filter(Boolean);

    if (!items.length) {
        E.hero.dataset.state = 'idle';
        const status = settled[0]?.reason?.status;
        console.error('Generation failed', settled.map((r) => r.reason));
        toast(status === 429 || status >= 500 ? 'The image servers are busy — please try again shortly.' : 'Generation failed. Please try again.', 'error', 4500);
        return;
    }

    state.history = [...items, ...state.history].slice(0, APP.MAX_HISTORY);
    saveHistory();
    renderCollection();
    showResults(items);
    toast(items.length < n ? `${items.length} of ${n} variations ready` : (n > 1 ? `${n} variations ready` : 'Wallpaper ready'), items.length < n ? 'warning' : 'success');

    if (state.user) finalizeCloud(items);
}

/** Runs after the result is on screen: charge credits and back the images up. */
async function finalizeCloud(items) {
    try {
        await db.deduct(state.user.id, items.length * APP.CREDIT_COST);
        setCredits(await db.credits(state.user.id));
    } catch (e) { console.warn('Credit deduction failed', e); }
    try {
        await db.saveMany(items.map((i) => rowFor(i, false)));
        items.forEach((i) => { i.synced = true; });
        saveHistory();
    } catch (e) { console.warn('Cloud save failed', e); }
}

function showResults(items) {
    state.results = items;
    const multi = items.length > 1;
    E.hero.dataset.multi = multi;
    E.resultMedia.style.gridTemplateColumns = multi ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)';
    E.resultMedia.style.gridTemplateRows = `repeat(${multi ? Math.ceil(items.length / 2) : 1}, minmax(0, 1fr))`;
    E.resultMedia.innerHTML = items.map((it, i) => `
        <button type="button" data-action="open-item" data-i="${i}" aria-label="Open ${multi ? 'variation ' + (i + 1) : 'wallpaper'}">
            <img src="${esc(safeUrl(it.url))}" alt="" decoding="async">
        </button>`).join('');
    E.resultOpen.querySelector('span').textContent = multi ? 'Open first' : 'Open';
    E.hero.dataset.state = 'done';
}

function closeResult({ keepBusy = false } = {}) {
    state.results = null;
    E.resultMedia.innerHTML = '';
    if (!keepBusy && E.hero.dataset.state !== 'busy') E.hero.dataset.state = 'idle';
}

// ============================================================================
// COLLECTION (local history)
// ============================================================================
const itemById = (id) => state.history.find((i) => i.id === id);

function miniHTML(it) {
    const fav = state.favorites.has(it.url);
    const ar = it.w && it.h ? clamp(it.w / it.h, 0.5, 1.8).toFixed(3) : '0.75';
    const id = esc(it.id);
    return `
        <article class="mini" style="--ar:${ar}" data-id="${id}">
            <button type="button" class="mini-open" data-action="open-history" data-id="${id}" aria-label="Open ${esc(it.genre)} in ${esc(it.style)} style">
                <img src="${esc(safeUrl(it.url))}" alt="" loading="lazy" decoding="async">
            </button>
            <span class="mini-tag">${esc(it.genre)}</span>
            <button type="button" class="mini-fav ${fav ? 'on' : ''}" data-action="fav" data-id="${id}" aria-pressed="${fav}" aria-label="Favorite">${ic('star')}</button>
            <div class="mini-actions">
                <button type="button" data-action="remix-history" data-id="${id}" aria-label="Remix" title="Remix">${ic('shuffle')}</button>
                <button type="button" data-action="download-history" data-id="${id}" aria-label="Download" title="Download">${ic('download')}</button>
                <button type="button" data-action="publish-history" data-id="${id}" aria-label="Post to community" title="Post to community">${ic('cloud-upload')}</button>
                <button type="button" class="danger" data-action="delete-history" data-id="${id}" aria-label="Delete" title="Delete">${ic('trash-2')}</button>
            </div>
        </article>`;
}

function renderCollection() {
    const list = state.filter === 'favorites' ? state.history.filter((i) => state.favorites.has(i.url)) : state.history;
    E.colCount.textContent = String(state.history.length).padStart(2, '0');
    E.collectionList.innerHTML = list.length
        ? list.map(miniHTML).join('')
        : `<div class="empty">${ic('image')}<strong>${state.filter === 'favorites' ? 'No favorites yet' : 'Nothing here yet'}</strong>
           <span>${state.filter === 'favorites' ? 'Tap the star on a wallpaper to keep it here.' : 'Wallpapers you create will appear here.'}</span></div>`;
}

function toggleFavorite(id, btn) {
    const it = itemById(id);
    if (!it) return;
    const on = !state.favorites.has(it.url);
    on ? state.favorites.add(it.url) : state.favorites.delete(it.url);
    store.set('wallpaper_favorites', [...state.favorites]);
    if (state.filter === 'favorites' && !on) return renderCollection();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on);
}

function openCollection() {
    if (matchMedia('(min-width: 1320px)').matches) return;
    E.collection.classList.add('open');
    E.scrim.hidden = false;
    document.documentElement.classList.add('scroll-lock');
    E.collection.querySelector('[data-action="close-collection"]')?.focus({ preventScroll: true });
}

function closeCollection() {
    if (!E.collection.classList.contains('open')) return;
    E.collection.classList.remove('open');
    E.scrim.hidden = true;
    document.documentElement.classList.remove('scroll-lock');
}

function remix(item) {
    const gi = GENRES.findIndex((g) => g.name === (LEGACY_NAMES[item.genre] || item.genre));
    if (gi >= 0) state.genre = gi;
    const si = STYLES.findIndex((s) => s.name === (LEGACY_NAMES[item.style] || item.style));
    if (si >= 0) state.style = si;
    if (item.seed != null && Number.isFinite(Number(item.seed))) state.seed = Number(item.seed);
    const match = item.w && item.h ? FORMATS.find((f) => f.w === item.w && f.h === item.h) : null;
    if (match) { state.format = match.id; applyFormat(); }
    state.modifier = '';
    state.custom = !!item.prompt && item.prompt !== autoPrompt();
    if (state.custom) E.prompt.value = item.prompt;
    closeCollection();
    if (E.dlgViewer.open) E.dlgViewer.close();
    closeResult();
    go('create');
    renderSelection();
    updateCta();
    requestAnimationFrame(() => { centerTile('genre', false); centerTile('style', false); });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    toast(item.seed != null ? `Settings restored · seed ${item.seed}` : 'Settings restored', 'success');
}

// ============================================================================
// VIEWER
// ============================================================================
const viewer = { item: null, row: null, token: 0, lockTimer: 0 };

function rowFor(item, isPublic) {
    return {
        user_id: state.user.id, url: item.url, prompt: item.prompt || 'Untitled',
        genre: item.genre || null, style: item.style || null, seed: item.seed ?? null, is_public: isPublic
    };
}

function openViewer(item, { mine = false, cloudId = null } = {}) {
    const token = ++viewer.token;
    viewer.item = item;
    viewer.row = cloudId && mine ? { id: cloudId, is_public: true } : null;

    E.viewerImg.src = safeUrl(item.url);
    E.viewerImg.alt = `${item.genre || 'AI'} wallpaper in ${item.style || 'custom'} style`;
    E.viewerMeta.innerHTML = [esc(item.genre), esc(item.style)].filter(Boolean).join(' · ') +
        (item.seed != null ? ` · seed <span class="dm">${esc(item.seed)}</span>` : '');
    E.palette.innerHTML = '';
    setLock(false);
    E.shareMenu.hidden = true;

    const canPublish = !cloudId || mine;
    E.publicBtn.hidden = !canPublish;
    updatePublicBtn();
    if (!E.dlgViewer.open) E.dlgViewer.showModal();

    if (cloudId) db.incrementViews(cloudId).catch(() => { });
    if (state.user && canPublish && !viewer.row) {
        db.findByUrl(item.url, state.user.id).then((row) => {
            if (token === viewer.token && row) { viewer.row = row; updatePublicBtn(); }
        }).catch(() => { });
    }
}

function updatePublicBtn() {
    const on = !!viewer.row?.is_public;
    E.publicBtn.setAttribute('aria-pressed', on);
    E.publicBtn.querySelector('span').textContent = on ? 'Public' : 'Make public';
}

async function togglePublic() {
    if (!state.user) return needSignIn('Sign in to share wallpapers');
    const item = viewer.item;
    if (!item) return;
    try {
        let row = viewer.row ?? await db.findByUrl(item.url, state.user.id);
        if (row) {
            await db.setPublic(row.id, !row.is_public);
            row = { ...row, is_public: !row.is_public };
        } else {
            const [created] = await db.saveMany([rowFor(item, true)]);
            row = { id: created.id, is_public: true };
        }
        viewer.row = row;
        updatePublicBtn();
        toast(row.is_public ? 'Shared with the community' : 'Now private', row.is_public ? 'success' : 'info');
    } catch (e) {
        console.error(e);
        toast('Couldn’t update sharing — please try again', 'error');
    }
}

function setLock(on) {
    E.lockOverlay.hidden = !on;
    $('[data-action="lock-preview"]').setAttribute('aria-pressed', on);
    clearInterval(viewer.lockTimer);
    if (!on) return;
    const tick = () => {
        const now = new Date();
        E.lockTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        E.lockDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    tick();
    viewer.lockTimer = setInterval(tick, 5000);
}

function quantize(data, n) {
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue;
        const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
        buckets.set(k, b);
    }
    const list = [...buckets.values()].map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n })).sort((a, b) => b.n - a.n);
    const out = [];
    for (const c of list) {
        if (out.every((o) => Math.hypot(o.r - c.r, o.g - c.g, o.b - c.b) > 52)) out.push(c);
        if (out.length === n) break;
    }
    return out.map((c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}

/** On demand only: a CORS-mode request would otherwise download every image twice. */
async function extractPalette() {
    const url = safeUrl(viewer.item?.url);
    if (!url) return;
    try {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.src = url;
        await im.decode();
        const c = document.createElement('canvas');
        c.width = c.height = 48;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(im, 0, 0, 48, 48);
        const colors = quantize(ctx.getImageData(0, 0, 48, 48).data, 5);
        E.palette.innerHTML = colors.map((hex) => `<button type="button" style="--c:${hex}" data-action="copy-color" data-hex="${hex}" title="Copy ${hex}" aria-label="Copy ${hex}"></button>`).join('');
    } catch {
        toast('A color palette isn’t available for this image', 'warning');
    }
}

async function downloadUrl(url, baseName) {
    const safe = safeUrl(url);
    if (!safe) return;
    try {
        const res = await fetch(safe, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*/, '');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${baseName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast('Download started', 'success', 2000);
    } catch {
        // Host doesn't allow cross-origin reads: fall back to opening the image.
        window.open(safe, '_blank', 'noopener');
        toast('Opened in a new tab — long-press or right-click to save', 'info', 4500);
    }
}

const downloadItem = (it) => downloadUrl(it.url, `wallpaper-${slug(it.genre)}-${slug(it.style)}-${it.seed ?? Date.now()}`);

async function copyText(text, okMessage) {
    try {
        await navigator.clipboard.writeText(text);
        toast(okMessage, 'success', 1800);
    } catch {
        toast('Couldn’t copy', 'error');
    }
}

// ============================================================================
// DIALOGS
// ============================================================================
function confirmAsk(title, text, okLabel = 'Confirm') {
    return new Promise((resolve) => {
        E.confirmTitle.textContent = title;
        E.confirmText.textContent = text;
        E.confirmOk.textContent = okLabel;
        const d = E.dlgConfirm;
        d.returnValue = '';
        const done = () => { d.removeEventListener('close', done); resolve(d.returnValue === 'ok'); };
        d.addEventListener('close', done);
        d.showModal();
    });
}

function openSettings() {
    E.steps.value = state.steps;
    E.stepsVal.textContent = state.steps;
    E.seed.value = state.seed ?? '';
    syncThemeButtons();
    if (!E.dlgSettings.open) E.dlgSettings.showModal();
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('wsp_theme', theme); } catch { /* ignore */ }
    $('meta[name="theme-color"]').content = theme === 'light' ? '#e9ecf1' : '#07070b';
    syncThemeButtons();
}

function syncThemeButtons() {
    const t = document.documentElement.dataset.theme;
    $$('[data-action="set-theme"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.theme === t));
}

function needSignIn(message) {
    openAccount();
    toast(message, 'info');
}

// ============================================================================
// ACCOUNT
// ============================================================================
const displayName = () => state.profile?.username || state.user?.user_metadata?.username || state.user?.email?.split('@')[0] || 'You';
const avatarUrl = () => state.profile?.avatar_url || state.user?.user_metadata?.avatar_url || '';

function setCredits(c) {
    state.credits = c;
    E.creditsNum.textContent = c;
    E.profileCredits.textContent = c;
}

function renderUserUI() {
    const u = state.user;
    E.accountBtn.innerHTML = u ? avatarHtml(displayName(), avatarUrl()) : ic('user');
    E.accountBtn.setAttribute('aria-label', u ? `Account: ${displayName()}` : 'Sign in');
    E.creditsChip.hidden = !u;
    E.creditsNum.textContent = state.credits ?? '--';
    updateCta();
    if (E.dlgAuth.open) renderAccount();
}

function renderAccount() {
    const u = state.user;
    E.authGuest.hidden = !!u;
    E.authUser.hidden = !u;
    E.authTitle.textContent = u ? 'Your profile' : 'Account';
    if (!u) return;
    E.profileEmail.textContent = u.email || '';
    E.profileUsername.value = displayName();
    E.profileAvatarUrl.value = avatarUrl();
    E.profileAvatar.innerHTML = avatarHtml(displayName(), avatarUrl());
    E.profileCredits.textContent = state.credits ?? '--';
    E.profileCreditsMax.textContent = APP.DAILY_CREDITS;
}

function openAccount() {
    renderAccount();
    if (!E.dlgAuth.open) E.dlgAuth.showModal();
    if (!state.user) cloud.client().catch(() => { }); // warm the SDK while the user types
}

function authTab(tab) {
    const signin = tab === 'signin';
    E.formSignin.hidden = !signin;
    E.formSignup.hidden = signin;
    $$('[data-action="auth-tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
}

function friendlyAuthError(e) {
    const m = String(e?.message || e || '');
    if (/failed to fetch|network|import|load/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
    if (/invalid login/i.test(m)) return 'That email and password don’t match.';
    if (/already registered/i.test(m)) return 'An account with that email already exists.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox.';
    return m || 'Something went wrong. Please try again.';
}

let userLoad = 0;
const settledValue = (r) => (r.status === 'fulfilled' ? r.value : null);

async function setUser(user) {
    const isNew = state.user?.id !== user.id;
    state.user = user;
    renderUserUI();
    if (!isNew) return;

    const token = ++userLoad;
    const [profile, credits, following] = (await Promise.allSettled([
        db.profile(user.id), db.credits(user.id), db.followingIds(user.id)
    ])).map(settledValue);
    if (token !== userLoad || state.user?.id !== user.id) return;

    state.profile = profile;
    state.following = new Set(following || []);
    if (credits != null) setCredits(credits);
    renderUserUI();
    if (state.view === 'community' && (state.community.source === 'following' || state.community.loaded)) loadCommunity({ reset: true });
    idle(syncLocalToCloud);
}

function clearUser() {
    if (!state.user) return;
    userLoad++;
    state.user = null;
    state.profile = null;
    state.credits = null;
    state.following = new Set();
    renderUserUI();
    if (state.view === 'community') loadCommunity({ reset: true });
}

async function syncLocalToCloud() {
    if (!state.user) return;
    const pending = state.history.filter((i) => !i.synced);
    if (!pending.length) return;
    try {
        const existing = await db.existingUrls(state.user.id, pending.map((i) => i.url));
        const fresh = pending.filter((i) => !existing.has(i.url));
        if (fresh.length) await db.saveMany(fresh.map((i) => rowFor(i, false)));
        pending.forEach((i) => { i.synced = true; });
        saveHistory();
        if (fresh.length) toast(`Synced ${fresh.length} wallpaper${fresh.length > 1 ? 's' : ''} to your account`, 'success');
    } catch (e) {
        console.warn('Sync failed', e);
    }
}

async function squareJpeg(file, size = 256) {
    const bmp = await createImageBitmap(file);
    const s = Math.min(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
    bmp.close?.();
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', 0.85));
}

async function handleSubmit(form) {
    const kind = form.dataset.form;
    const f = new FormData(form);
    if (kind === 'signin') {
        await auth.signIn(String(f.get('email')).trim(), String(f.get('password')));
        E.dlgAuth.close();
        form.reset();
        toast('Welcome back', 'success');
    } else if (kind === 'signup') {
        await auth.signUp(String(f.get('email')).trim(), String(f.get('password')), String(f.get('username')).trim());
        E.dlgAuth.close();
        form.reset();
        toast('Check your email to confirm your account', 'info', 5000);
    } else if (kind === 'profile') {
        const username = String(f.get('username')).trim();
        const avatar = String(f.get('avatar') || '').trim() || null;
        await db.updateProfile(state.user.id, { username, avatar_url: avatar });
        const user = await auth.updateMeta({ username, avatar_url: avatar });
        if (user) state.user = user;
        state.profile = { username, avatar_url: avatar };
        renderUserUI();
        toast('Profile updated', 'success');
    }
}

// ============================================================================
// COMMUNITY
// ============================================================================
const fmtCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n || 0));

function cardHTML(w) {
    const me = state.user?.id;
    const mine = !!me && w.user_id === me;
    const following = state.following.has(w.user_id);
    const id = esc(w.id), uid = esc(w.user_id), name = esc(w.author_name);
    return `
        <article class="card" data-id="${id}">
            <button type="button" class="card-open" data-action="open-card" data-id="${id}" aria-label="Open wallpaper: ${esc((w.prompt || '').slice(0, 80))}">
                <img src="${esc(safeUrl(w.url))}" alt="" loading="lazy" decoding="async">
            </button>
            <div class="card-top">
                <button type="button" class="author" data-action="creator" data-id="${uid}" data-name="${name}">
                    ${avatarHtml(w.author_name, w.author_avatar)}<span>${name}</span>
                </button>
                ${w.user_id && !mine ? `<button type="button" class="follow" data-action="follow" data-id="${uid}" data-name="${name}" aria-pressed="${following}">${following ? 'Following' : 'Follow'}</button>` : ''}
            </div>
            <div class="card-bottom">
                <p class="card-prompt">${esc(w.prompt)}</p>
                <div class="card-meta">
                    <div class="row" style="gap:14px">
                        <button type="button" class="stat like" data-action="like" data-id="${id}" data-n="${w.likes_count}" aria-pressed="${w.is_liked}" aria-label="Like">${ic('heart')}<span>${fmtCount(w.likes_count)}</span></button>
                        <span class="stat" title="Views">${ic('eye')}${fmtCount(w.views_count)}</span>
                    </div>
                    <div class="card-actions">
                        <button type="button" data-action="remix-card" data-id="${id}" aria-label="Remix" title="Remix">${ic('shuffle')}</button>
                        <button type="button" data-action="download-card" data-id="${id}" aria-label="Download" title="Download">${ic('download')}</button>
                    </div>
                </div>
            </div>
        </article>`;
}

function communityEmpty(c) {
    if (c.q) return { icon: 'search', title: 'No matches', text: `Nothing found for “${c.q}”.` };
    if (c.creator) return { icon: 'image', title: 'Nothing public yet', text: `${c.creator.name} hasn’t shared any wallpapers.` };
    if (c.source === 'following') {
        return state.following.size
            ? { icon: 'users', title: 'Quiet for now', text: 'The creators you follow haven’t posted anything yet.' }
            : { icon: 'users', title: 'Follow creators', text: 'Follow people from Explore and their wallpapers will show up here.' };
    }
    return { icon: 'image', title: 'No wallpapers yet', text: 'Be the first to share one from your collection.' };
}

function fetchFeed(c) {
    const base = { userId: state.user?.id ?? null, offset: c.page * COMMUNITY_PAGE, limit: COMMUNITY_PAGE, q: c.q };
    if (c.creator) return db.feed({ ...base, sort: c.sort, creatorId: c.creator.id });
    if (c.source === 'following') return db.feed({ ...base, sort: 'new', userIds: [...state.following] });
    return db.feed({ ...base, sort: c.sort });
}

async function loadCommunity({ reset = false } = {}) {
    const c = state.community;
    const grid = E.communityGrid;
    if (reset) {
        c.token++;
        c.page = 0;
        c.more = true;
        c.loading = false;
        c.items.clear();
        c.loaded = true;
        grid.innerHTML = '<div class="sk"></div>'.repeat(8);
    }
    if (c.loading || !c.more) return;
    c.loading = true;
    const token = c.token;
    try {
        const rows = await fetchFeed(c);
        if (token !== c.token) return;
        if (c.page === 0) grid.innerHTML = '';
        rows.forEach((w) => c.items.set(w.id, w));
        if (rows.length < COMMUNITY_PAGE) c.more = false;
        c.page++;
        if (!rows.length && c.page === 1) {
            const e = communityEmpty(c);
            grid.innerHTML = `<div class="empty">${ic(e.icon)}<strong>${esc(e.title)}</strong><span>${esc(e.text)}</span></div>`;
        } else {
            grid.insertAdjacentHTML('beforeend', rows.map(cardHTML).join(''));
        }
    } catch (e) {
        if (token !== c.token) return;
        console.error(e);
        c.more = false;
        if (c.page === 0) {
            grid.innerHTML = `<div class="empty">${ic('circle-alert')}<strong>Couldn’t load the feed</strong>
                <span>Check your connection and try again.</span>
                <button type="button" class="btn btn-glass btn-sm" data-action="retry-community">Retry</button></div>`;
        } else {
            toast('Couldn’t load more wallpapers', 'error');
        }
    } finally {
        if (token === c.token) c.loading = false;
    }
}

function setFollowUI(id, on) {
    on ? state.following.add(id) : state.following.delete(id);
    $$(`.follow[data-id="${CSS.escape(id)}"]`).forEach((b) => {
        b.setAttribute('aria-pressed', on);
        b.textContent = on ? 'Following' : 'Follow';
    });
}

async function toggleFollow(btn) {
    if (!state.user) return needSignIn('Sign in to follow creators');
    const id = btn.dataset.id, name = btn.dataset.name;
    const on = !state.following.has(id);
    setFollowUI(id, on);
    try {
        await db.setFollow(state.user.id, id, on);
        toast(on ? `Following ${name}` : `Unfollowed ${name}`, 'success', 2000);
        if (!on && state.community.source === 'following') loadCommunity({ reset: true });
    } catch (e) {
        setFollowUI(id, !on);
        toast(e.message || 'Couldn’t update follow', 'error');
    }
}

async function toggleLike(btn) {
    if (!state.user) return needSignIn('Sign in to like wallpapers');
    const id = btn.dataset.id;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    const n = Number(btn.dataset.n) || 0;
    const paint = (liked, count) => {
        btn.setAttribute('aria-pressed', liked);
        btn.dataset.n = count;
        btn.querySelector('span').textContent = fmtCount(count);
    };
    paint(on, Math.max(0, n + (on ? 1 : -1)));
    try {
        await db.setLike(id, state.user.id, on);
        const w = state.community.items.get(id);
        if (w) { w.is_liked = on; w.likes_count = Math.max(0, n + (on ? 1 : -1)); }
    } catch (e) {
        console.error(e);
        paint(!on, n);
        toast('Couldn’t update your like', 'error');
    }
}

function setSegment(selector, attr, value) {
    $$(selector).forEach((b) => b.setAttribute('aria-pressed', b.dataset[attr] === value));
}

function setCreator(creator) {
    state.community.creator = creator;
    E.creatorPill.hidden = !creator;
    if (creator) E.creatorName.textContent = creator.name ? `@${creator.name}` : 'Creator';
}

// ============================================================================
// VIEWS & ROUTING
// ============================================================================
function showView(v) {
    if (v === state.view) return;
    state.view = v;
    document.body.dataset.view = v;
    E.viewCreate.hidden = v !== 'create';
    E.viewCommunity.hidden = v !== 'community';
    $$('button[data-action="view"]').forEach((b) => {
        if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    closeCollection();
    window.scrollTo(0, 0);
    if (v === 'community') {
        if (!state.community.loaded) loadCommunity({ reset: true });
    } else {
        requestAnimationFrame(() => { centerTile('genre', false); centerTile('style', false); });
    }
}

function route() {
    showView(location.hash === '#community' ? 'community' : 'create');
}

function go(v) {
    if (v === 'community') {
        if (location.hash !== '#community') location.hash = '#community';
        else showView('community');
    } else {
        if (location.hash) history.pushState(null, '', location.pathname + location.search);
        showView('create');
    }
}

// ============================================================================
// ACTIONS (event delegation — no inline handlers)
// ============================================================================
const actions = {
    view: (el) => go(el.dataset.view),
    theme: () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'),
    'set-theme': (el) => setTheme(el.dataset.theme),
    settings: openSettings,
    account: openAccount,
    collection: () => (E.collection.classList.contains('open') ? closeCollection() : openCollection()),
    'close-collection': closeCollection,
    'close-dialog': (el) => el.closest('dialog')?.close(),

    randomize,
    generate,
    cancel: () => state.busy?.abort(),
    batch: () => { state.batch = state.batch > 1 ? 1 : 4; updateCta(); },
    pick: (el) => select(el.dataset.type, Number(el.dataset.i)),
    step: (el) => select(el.dataset.type, state[el.dataset.type] + Number(el.dataset.dir)),
    format: (el) => setFormat(el.dataset.id),
    tone: (el) => { state.tone = el.dataset.id || null; syncTones(); renderSelection(); },
    'prompt-reset': () => { state.custom = false; syncPrompt(); E.prompt.focus(); },
    'seed-random': () => { state.seed = randInt(); E.seed.value = state.seed; updateCta(); },
    'seed-clear': () => { state.seed = null; E.seed.value = ''; updateCta(); },

    'open-result': () => state.results?.[0] && openViewer(state.results[0]),
    'open-item': (el) => state.results?.[Number(el.dataset.i)] && openViewer(state.results[Number(el.dataset.i)]),
    'download-result': () => state.results?.[0] && downloadItem(state.results[0]),
    'close-result': () => closeResult(),

    'history-filter': (el) => {
        state.filter = el.dataset.filter;
        setSegment('#collection [data-action="history-filter"]', 'filter', state.filter);
        renderCollection();
    },
    'open-history': (el) => { const it = itemById(el.dataset.id); if (it) openViewer(it); },
    fav: (el) => toggleFavorite(el.dataset.id, el),
    'remix-history': (el) => { const it = itemById(el.dataset.id); if (it) remix(it); },
    'download-history': (el) => { const it = itemById(el.dataset.id); if (it) downloadItem(it); },
    'publish-history': async (el) => {
        const it = itemById(el.dataset.id);
        if (!it) return;
        if (!state.user) return needSignIn('Sign in to post to the community');
        try {
            const row = await db.findByUrl(it.url, state.user.id);
            if (row?.is_public) return toast('Already public', 'info');
            if (row) await db.setPublic(row.id, true);
            else await db.saveMany([rowFor(it, true)]);
            toast('Published to the community', 'success');
        } catch (e) {
            console.error(e);
            toast('Couldn’t publish — please try again', 'error');
        }
    },
    'delete-history': (el) => {
        const it = itemById(el.dataset.id);
        if (!it) return;
        state.history = state.history.filter((i) => i.id !== it.id);
        saveHistory();
        renderCollection();
    },
    'clear-history': async () => {
        if (!state.history.length) return;
        if (await confirmAsk('Clear collection?', 'This removes the wallpapers saved in this browser. Starred items are kept in your favorites list. Cloud copies are not affected.', 'Clear')) {
            state.history = [];
            saveHistory();
            renderCollection();
            toast('Collection cleared', 'success', 2000);
        }
    },
    'clear-data': async () => {
        if (await confirmAsk('Clear local data?', 'Removes your local history and favorites from this browser. Cloud-synced wallpapers are not affected.', 'Clear everything')) {
            state.history = [];
            state.favorites = new Set();
            store.remove('wallpaper_history');
            store.remove('wallpaper_favorites');
            renderCollection();
            toast('Local data cleared', 'success', 2000);
        }
    },

    'lock-preview': () => setLock(E.lockOverlay.hidden),
    palette: extractPalette,
    'copy-color': (el) => copyText(el.dataset.hex, `Copied ${el.dataset.hex}`),
    'share-menu': (el) => {
        E.shareMenu.hidden = !E.shareMenu.hidden;
        el.setAttribute('aria-expanded', !E.shareMenu.hidden);
    },
    'download-viewer': () => { E.shareMenu.hidden = true; if (viewer.item) downloadItem(viewer.item); },
    'copy-link': () => { E.shareMenu.hidden = true; if (viewer.item) copyText(viewer.item.url, 'Link copied'); },
    'share-native': async () => {
        E.shareMenu.hidden = true;
        const url = viewer.item?.url;
        if (!url) return;
        if (navigator.share) {
            try { await navigator.share({ title: 'Wallpaper Studio Pro', text: 'Check out this AI wallpaper', url }); } catch { /* dismissed */ }
        } else {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this AI wallpaper')}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
        }
    },
    'toggle-public': togglePublic,
    'remix-viewer': () => viewer.item && remix(viewer.item),

    'auth-tab': (el) => authTab(el.dataset.tab),
    'sign-out': async () => {
        if (!(await confirmAsk('Sign out?', 'Your local collection stays on this device.', 'Sign out'))) return;
        try {
            await auth.signOut();
            clearUser();
            E.dlgAuth.close();
            toast('Signed out', 'info', 2000);
        } catch (e) {
            toast(e.message || 'Couldn’t sign out', 'error');
        }
    },

    source: (el) => {
        const src = el.dataset.source;
        if (src === 'following' && !state.user) return needSignIn('Sign in to see creators you follow');
        state.community.source = src;
        setCreator(null);
        setSegment('[data-action="source"]', 'source', src);
        E.sortSeg.hidden = src === 'following';
        loadCommunity({ reset: true });
    },
    sort: (el) => {
        state.community.sort = el.dataset.sort;
        setSegment('[data-action="sort"]', 'sort', el.dataset.sort);
        loadCommunity({ reset: true });
    },
    creator: (el) => {
        setCreator({ id: el.dataset.id, name: el.dataset.name });
        loadCommunity({ reset: true });
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    'clear-creator': () => { setCreator(null); loadCommunity({ reset: true }); },
    'retry-community': () => loadCommunity({ reset: true }),
    'open-card': (el) => {
        const w = state.community.items.get(el.dataset.id);
        if (w) openViewer({ url: w.url, genre: w.genre, style: w.style, prompt: w.prompt, seed: w.seed }, { cloudId: w.id, mine: w.user_id === state.user?.id });
    },
    follow: toggleFollow,
    like: toggleLike,
    'remix-card': (el) => {
        const w = state.community.items.get(el.dataset.id);
        if (w) remix({ url: w.url, genre: w.genre, style: w.style, prompt: w.prompt, seed: w.seed });
    },
    'download-card': (el) => {
        const w = state.community.items.get(el.dataset.id);
        if (w) downloadItem(w);
    }
};

// ============================================================================
// INIT
// ============================================================================
function bindEvents() {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (el) {
            const fn = actions[el.dataset.action];
            if (fn) {
                if (el.tagName === 'A') e.preventDefault();
                fn(el, e);
            }
        }
        if (!E.shareMenu.hidden && !e.target.closest('.menu-wrap')) E.shareMenu.hidden = true;
    });

    document.addEventListener('submit', async (e) => {
        const form = e.target.closest('form[data-form]');
        if (!form) return;
        e.preventDefault();
        const err = $('.form-error', form);
        const btn = $('button[type="submit"]', form);
        const label = btn.textContent;
        err.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Please wait…';
        try {
            await handleSubmit(form);
        } catch (ex) {
            console.error(ex);
            err.textContent = friendlyAuthError(ex);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    });

    // Fade images in once decoded (load/error don't bubble, so capture)
    document.addEventListener('load', (e) => {
        if (e.target instanceof HTMLImageElement && e.target.matches('.tile img, .mini-open img, .card-open img')) e.target.classList.add('ld');
    }, true);

    document.addEventListener('close', (e) => {
        if (e.target === E.dlgViewer) {
            setLock(false);
            E.shareMenu.hidden = true;
            E.viewerImg.removeAttribute('src');
        }
    }, true);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCollection();
            E.shareMenu.hidden = true;
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !document.querySelector('dialog[open]')) {
            e.preventDefault();
            if (state.view === 'create') generate();
            return;
        }
        const rail = e.target.closest?.('.rail');
        if (rail && !e.metaKey && !e.ctrlKey && !e.altKey) {
            const type = rail === E.genreRail ? 'genre' : 'style';
            const n = type === 'genre' ? GENRES.length : STYLES.length;
            const next = { ArrowRight: state[type] + 1, ArrowLeft: state[type] - 1, Home: 0, End: n - 1 }[e.key];
            if (next !== undefined) {
                e.preventDefault();
                select(type, clamp(next, 0, n - 1));
                rail.children[state[type]]?.focus({ preventScroll: true });
                return;
            }
        }
        if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
        if (document.querySelector('dialog[open]')) return;
        switch (e.key.toLowerCase()) {
            case 'r': if (state.view === 'create') randomize(); break;
            case 'h': actions.collection(); break;
            case 's': openSettings(); break;
        }
    });

    // Prompt editing
    E.prompt.addEventListener('input', () => {
        const v = E.prompt.value;
        state.custom = v.trim() !== '' && v !== autoPrompt();
        E.promptReset.hidden = !state.custom;
    });
    E.prompt.addEventListener('blur', () => {
        if (!E.prompt.value.trim()) { state.custom = false; syncPrompt(); }
    });

    // Settings (applied instantly)
    E.steps.addEventListener('input', () => {
        state.steps = clamp(Number(E.steps.value) || 4, 1, 4);
        E.stepsVal.textContent = state.steps;
        savePrefs();
    });
    E.seed.addEventListener('input', () => {
        const v = E.seed.value.trim();
        state.seed = v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v)));
        updateCta();
    });

    E.avatarUpload.addEventListener('change', async () => {
        const file = E.avatarUpload.files[0];
        E.avatarUpload.value = '';
        if (!file || !state.user) return;
        try {
            toast('Uploading photo…', 'info', 1500);
            const url = await db.uploadAvatar(state.user.id, await squareJpeg(file));
            E.profileAvatarUrl.value = url;
            E.profileAvatar.innerHTML = avatarHtml(displayName(), url);
            toast('Photo uploaded — save your changes to apply it', 'success', 3500);
        } catch (e) {
            console.error(e);
            toast('Upload failed — try a different image', 'error');
        }
    });

    E.communitySearch.addEventListener('input', debounce(() => {
        state.community.q = E.communitySearch.value.trim();
        loadCommunity({ reset: true });
    }, 350));

    new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && state.view === 'community' && state.community.loaded) loadCommunity();
    }, { rootMargin: '900px 0px' }).observe(E.communitySentinel);

    matchMedia('(min-width: 1320px)').addEventListener('change', (e) => { if (e.matches) closeCollection(); });
    addEventListener('hashchange', route);
    addEventListener('popstate', route);
}

function init() {
    buildRails();
    buildTones();
    renderFormats();
    applyFormat();
    syncTones();
    renderSelection();
    renderCollection();
    renderUserUI();
    syncThemeButtons();
    setSegment('#collection [data-action="history-filter"]', 'filter', state.filter);
    bindEvents();

    cloud.onAuth((event, session) => {
        // Never call into supabase-js from inside its own auth callback.
        setTimeout(() => {
            if (session?.user) setUser(session.user);
            else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') clearUser();
        }, 0);
    });
    if (cloud.shouldBootEarly()) idle(() => cloud.client().catch((e) => console.warn('Cloud unavailable', e)));

    route();
    requestAnimationFrame(() => { centerTile('genre', false); centerTile('style', false); });
}

init();
