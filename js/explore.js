// Explore: a full-screen vertical feed of public community wallpapers.
import { $, $$, esc, ic, debounce, toast } from './lib.js';
import { state, register, on, emit } from './state.js';
import * as cloud from './cloud.js';
import { Pager } from './pager.js';
import { slideHTML } from './slide.js';
import { openDialog, closeDialog } from './dialogs.js';
import { openViewer } from './viewer.js';

const { db } = cloud;
const PAGE = 24;

const c = { sort: 'new', q: '', creator: null, page: 0, more: true, loading: false, token: 0, loaded: false };
let pager = null;
const viewed = new Set();
let viewTimer = 0;

/** DB row (decorated by cloud.feed) -> app item */
const toItem = (row) => ({
    ...row,
    ts: Date.parse(row.created_at) || 0,
    cloudId: row.id,
    isPublic: true,
    mine: !!state.user && row.user_id === state.user.id,
    w: null, h: null, sub: null
});

function fetchFeed() {
    const base = { userId: state.user?.id ?? null, offset: c.page * PAGE, limit: PAGE, q: c.q };
    if (c.creator) return db.feed({ ...base, sort: 'new', creatorId: c.creator.id });
    if (c.sort === 'following') return db.feed({ ...base, sort: 'new', userIds: [...state.following] });
    return db.feed({ ...base, sort: c.sort });
}

function setStatus(kind, extra = {}) {
    const el = $('#explore-status');
    if (kind === 'ok') { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    if (kind === 'loading') {
        el.innerHTML = '<div class="status-skel" aria-label="Loading"><i></i><i></i><i></i></div>';
    } else if (kind === 'empty') {
        const msg = c.q ? [`No matches`, `Nothing found for “${esc(c.q)}”.`]
            : c.creator ? [`Nothing public yet`, `${esc(c.creator.name)} hasn’t shared any wallpapers.`]
                : c.sort === 'following'
                    ? (state.following.size ? [`Quiet for now`, `The creators you follow haven’t posted yet.`] : [`Follow creators`, `Follow people from Latest or Top and their wallpapers show up here.`])
                    : [`Be the first`, `No public wallpapers yet. Create one and share it.`];
        el.innerHTML = `<div class="status-msg">${ic('image')}<strong>${msg[0]}</strong><span>${msg[1]}</span>
            <button type="button" class="btn btn-primary" data-action="nav" data-to="create">${ic('wand-sparkles')}Create a wallpaper</button></div>`;
    } else if (kind === 'error') {
        el.innerHTML = `<div class="status-msg">${ic('circle-alert')}<strong>Couldn’t load the feed</strong>
            <span>${esc(extra.message || 'Check your connection and try again.')}</span>
            <button type="button" class="btn btn-glass" data-action="explore-retry">Try again</button></div>`;
    }
}

async function load({ reset = false } = {}) {
    if (reset) {
        c.token++;
        c.page = 0;
        c.more = true;
        c.loading = false;
        c.loaded = true;
        pager.setItems([]);
        setStatus('loading');
    }
    if (c.loading || !c.more) return;
    c.loading = true;
    const token = c.token;
    try {
        const rows = await fetchFeed();
        if (token !== c.token) return;
        if (rows.length < PAGE) c.more = false;
        if (c.page === 0 && !rows.length) setStatus('empty');
        else { setStatus('ok'); pager.append(rows.map(toItem)); }
        c.page++;
    } catch (e) {
        if (token !== c.token) return;
        console.error(e);
        c.more = false;
        if (c.page === 0) setStatus('error');
        else toast('Couldn’t load more wallpapers', 'error');
    } finally {
        if (token === c.token) c.loading = false;
    }
}

function renderFilters() {
    const box = $('#explore-filters');
    const chips = [];
    if (c.q) chips.push(`<button type="button" class="fchip" data-action="explore-clear-q">${ic('search')}“${esc(c.q)}”${ic('x')}</button>`);
    if (c.creator) chips.push(`<button type="button" class="fchip" data-action="explore-clear-creator">@${esc(c.creator.name)}${ic('x')}</button>`);
    box.hidden = !chips.length;
    box.innerHTML = chips.join('');
}

function setSort(sort) {
    c.sort = sort;
    $$('#explore-tabs [data-sort]').forEach((b) => b.setAttribute('aria-selected', b.dataset.sort === sort));
}

function onActive(item) {
    clearTimeout(viewTimer);
    if (!item?.cloudId || viewed.has(item.cloudId)) return;
    viewTimer = setTimeout(() => { viewed.add(item.cloudId); db.incrementViews(item.cloudId).catch(() => { }); }, 1200);
}

export function activate() {
    if (!c.loaded) load({ reset: true });
}

export function key(e) {
    if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'PageDown') { e.preventDefault(); pager.next(); return true; }
    if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'PageUp') { e.preventDefault(); pager.prev(); return true; }
    if (e.key === 'l') { $('#explore-pager .slide:nth-child(' + (pager.index + 1) + ') [data-action="item-like"]')?.click(); return true; }
    return false;
}

export async function openById(id) {
    try {
        const row = await db.byId(id, state.user?.id ?? null);
        if (!row) return toast('That wallpaper isn’t available any more', 'warning');
        openViewer([toItem(row)], 0);
    } catch (e) {
        console.error(e);
        toast('Couldn’t open that wallpaper', 'error');
    }
}

export function init() {
    pager = new Pager($('#explore-pager'), { render: slideHTML, onActive, onNearEnd: () => load() });

    register({
        'explore-sort': (el) => {
            const sort = el.dataset.sort;
            if (sort === 'following' && !state.user) return emit('need-auth', 'Sign in to see creators you follow');
            c.creator = null;
            setSort(sort);
            renderFilters();
            load({ reset: true });
        },
        'explore-retry': () => load({ reset: true }),
        'explore-next': () => pager.next(),
        'explore-prev': () => pager.prev(),
        'explore-search': () => { openDialog($('#dlg-search')); setTimeout(() => $('#search-input').focus(), 60); },
        'explore-clear-q': () => { c.q = ''; $('#search-input').value = ''; renderFilters(); load({ reset: true }); },
        'explore-clear-creator': () => { c.creator = null; renderFilters(); load({ reset: true }); }
    });

    $('#form-search').addEventListener('submit', (e) => {
        e.preventDefault();
        c.q = $('#search-input').value.trim();
        closeDialog($('#dlg-search'));
        renderFilters();
        load({ reset: true });
    });

    on('creator', (creator) => {
        closeDialog($('#viewer'));
        c.creator = creator;
        c.sort = 'new';
        setSort('new');
        renderFilters();
        emit('navigate', 'explore');
        load({ reset: true });
    });

    // Sign-in / sign-out changes what the feed can show (likes, following).
    on('user:changed', () => {
        if (c.sort === 'following' && !state.user) { setSort('new'); }
        if (c.loaded) load({ reset: true });
    });

    on('item:removed', (item) => {
        const i = pager.items.findIndex((x) => x.url === item.url);
        if (i >= 0) pager.remove(i);
        if (!pager.length && c.loaded) setStatus('empty');
    });
}
