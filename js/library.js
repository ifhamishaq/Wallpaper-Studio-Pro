// Library: everything you've made — this device's history merged with your cloud wallpapers.
import { $, $$, esc, safeUrl, ic, clamp } from './lib.js';
import { state, register, on, emit } from './state.js';
import * as cloud from './cloud.js';
import { openViewer } from './viewer.js';

const { db } = cloud;
const PAGE = 30;

const cloudState = { rows: new Map(), page: 0, more: true, loading: false, token: 0 };
let filter = 'all';
let visible = [];

/** Local history + cloud-only rows, newest first. Local objects are annotated in place. */
function merged() {
    const byUrl = new Map(state.history.map((i) => [i.url, i]));
    const extra = [];
    for (const row of cloudState.rows.values()) {
        const local = byUrl.get(row.url);
        if (local) { local.cloudId = row.id; local.isPublic = row.is_public; local.synced = true; }
        else extra.push(row);
    }
    return [...state.history, ...extra].sort((a, b) => b.ts - a.ts);
}

function cloudItem(row) {
    return {
        id: `c${row.id}`, url: row.url, genre: row.genre || '', style: row.style || '', prompt: row.prompt || '',
        sub: null, seed: row.seed ?? null, w: null, h: null, ts: Date.parse(row.created_at) || 0,
        cloudId: row.id, isPublic: !!row.is_public, synced: true, mine: true
    };
}

async function loadCloud({ reset = false } = {}) {
    if (!state.user) return;
    const s = cloudState;
    if (reset) { s.token++; s.rows.clear(); s.page = 0; s.more = true; s.loading = false; }
    if (s.loading || !s.more) return;
    s.loading = true;
    const token = s.token;
    try {
        const rows = await db.mine(state.user.id, { offset: s.page * PAGE, limit: PAGE });
        if (token !== s.token) return;
        rows.forEach((r) => { if (!s.rows.has(r.id)) s.rows.set(r.id, cloudItem(r)); });
        if (rows.length < PAGE) s.more = false;
        s.page++;
        render();
    } catch (e) {
        console.warn('Cloud library unavailable', e);
        s.more = false;
    } finally {
        if (token === s.token) s.loading = false;
    }
}

function filtered() {
    const all = merged();
    if (filter === 'favorites') return all.filter((i) => state.favorites.has(i.url));
    if (filter === 'public') return all.filter((i) => i.isPublic);
    return all;
}

function card(it, n) {
    const ar = it.w && it.h ? clamp(it.w / it.h, 0.55, 1.8).toFixed(3) : '0.5625';
    const fav = state.favorites.has(it.url);
    return `<button type="button" class="lib-card" data-action="lib-open" data-n="${n}" style="--ar:${ar}"
        aria-label="Open ${esc(it.genre || 'wallpaper')}${it.style ? ' in ' + esc(it.style) + ' style' : ''}">
        <img src="${esc(safeUrl(it.url))}" alt="" loading="lazy" decoding="async">
        <span class="lib-badges">${fav ? `<i class="b-fav">${ic('star')}</i>` : ''}${it.isPublic ? `<i class="b-pub">${ic('globe')}</i>` : ''}</span>
        <span class="lib-cap">${esc(it.genre)}</span>
    </button>`;
}

export function render() {
    visible = filtered();
    const grid = $('#lib-grid');
    $('#lib-count').textContent = String(merged().length).padStart(2, '0');
    $('#lib-empty').hidden = visible.length > 0;
    grid.hidden = !visible.length;
    grid.innerHTML = visible.map(card).join('');
    if (!visible.length) {
        $('#lib-empty-title').textContent = filter === 'favorites' ? 'No favorites yet' : filter === 'public' ? 'Nothing public yet' : 'Your library is empty';
        $('#lib-empty-text').textContent = filter === 'favorites' ? 'Tap the star on any wallpaper to keep it here.'
            : filter === 'public' ? 'Share a wallpaper and it shows up here.' : 'Wallpapers you create are saved here automatically.';
    }
    $('#lib-banner').hidden = !!state.user || !state.history.length;
    $$('#lib-filter [data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === filter));
    $('#lib-filter [data-filter="public"]').hidden = !state.user;
}

export function activate() {
    render();
}

export function init() {
    register({
        'lib-filter': (el) => { filter = el.dataset.filter; render(); },
        'lib-open': (el) => openViewer(visible, Number(el.dataset.n))
    });
    on('library:changed', () => { if (document.documentElement.dataset.view === 'library') render(); else $('#lib-count').textContent = String(merged().length).padStart(2, '0'); });
    on('user:changed', () => {
        if (!state.user) { cloudState.token++; cloudState.rows.clear(); filter = filter === 'public' ? 'all' : filter; render(); }
        else loadCloud({ reset: true });
    });
    on('item:removed', (item) => {
        for (const [id, r] of cloudState.rows) if (r.url === item.url) cloudState.rows.delete(id);
        render();
    });
    new IntersectionObserver((e) => { if (e[0].isIntersecting) loadCloud(); }, { root: $('#lib-scroll'), rootMargin: '600px 0px' }).observe($('#lib-sentinel'));
    render();
}
