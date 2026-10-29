// Shared app state, persistence, a tiny event bus and the click dispatcher.
import { store, clamp } from './lib.js';
import { GENRES, STYLES, FORMATS, TONES, MODELS, APP } from './config.js';

// ------------------------------------------------------------------ event bus
const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));

// ------------------------------------------------------------------ click dispatch
const handlers = {};
/** Register data-action handlers: register({ name: (el, event) => … }) */
export function register(map) { Object.assign(handlers, map); }

document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = handlers[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
});

// ------------------------------------------------------------------ persisted prefs
const saved = store.get('wsp_prefs', null) || {};
const legacy = store.get('wallpaper_preferences', null) || {};
const index = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);

export const state = {
    // creation settings
    genre: index(saved.genre ?? legacy.genreIndex, GENRES.length),
    style: index(saved.style ?? legacy.styleIndex, STYLES.length),
    format: FORMATS.some((f) => f.id === saved.format) ? saved.format : (matchMedia('(max-width: 899px)').matches ? 'phone' : 'desktop'),
    model: MODELS.some((m) => m.id === saved.model) ? saved.model : MODELS[0].id,
    tone: TONES.some((t) => t.id === saved.tone) ? saved.tone : null,
    steps: clamp(Number(saved.steps) || 4, 1, 4),
    lockPreview: saved.lockPreview !== false,
    seed: null,
    batch: 1,
    modifier: '',
    exact: false, // textarea holds the full prompt, used verbatim

    // account
    user: null,
    profile: null,
    credits: null,
    following: new Set(),

    // local library (newest first) + favorites (by url)
    history: loadHistory(),
    favorites: new Set(store.get('wallpaper_favorites', []))
};

export const fmt = () => FORMATS.find((f) => f.id === state.format) || FORMATS[0];
export const model = () => MODELS.find((m) => m.id === state.model) || MODELS[0];

export function savePrefs() {
    store.set('wsp_prefs', {
        genre: state.genre, style: state.style, format: state.format, model: state.model,
        tone: state.tone, steps: state.steps, lockPreview: state.lockPreview
    });
}

// ------------------------------------------------------------------ local library
export function normalizeItem(i) {
    const ts = i.ts || i.timestamp || Date.now();
    return {
        id: String(i.id || ts), ts, timestamp: ts, url: i.url,
        genre: i.genre || '', style: i.style || '', prompt: i.prompt || '', sub: i.sub ?? null,
        seed: i.seed ?? null, w: i.w || null, h: i.h || null, synced: !!i.synced,
        cloudId: i.cloudId || null, isPublic: !!i.isPublic
    };
}

function loadHistory() {
    const raw = store.get('wallpaper_history', []);
    return Array.isArray(raw) ? raw.filter((i) => i && i.url).map(normalizeItem) : [];
}

export function saveHistory() {
    store.set('wallpaper_history', state.history);
    store.set('wallpaper_favorites', [...state.favorites]);
}

export function addToHistory(items) {
    state.history = [...items, ...state.history].slice(0, APP.MAX_HISTORY);
    saveHistory();
    emit('library:changed');
}

export const isFavorite = (item) => state.favorites.has(item.url);
