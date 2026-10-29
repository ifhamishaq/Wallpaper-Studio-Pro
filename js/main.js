// Wallpaper Studio Pro — app shell: routing, keyboard, service worker.
import { $, $$ } from './lib.js';
import { state, register, on } from './state.js';
import './dialogs.js';
import { applyLock } from './slide.js';
import * as account from './account.js';
import * as create from './create.js';
import * as explore from './explore.js';
import * as library from './library.js';
import * as viewer from './viewer.js';

const VIEWS = ['explore', 'create', 'library'];
let current = null;

function show(view) {
    if (view === current) return;
    current = view;
    document.documentElement.dataset.view = view;
    for (const v of VIEWS) {
        const el = $(`#view-${v}`);
        const on_ = v === view;
        el.dataset.active = on_;
        el.inert = !on_;
    }
    $$('[data-action="nav"]').forEach((b) => {
        if (b.dataset.to === view) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    if (view === 'explore') explore.activate();
    if (view === 'library') library.activate();
}

function route() {
    const w = location.hash.match(/^#w=(.+)$/);
    if (w) {
        show('create');
        history.replaceState(null, '', `${location.pathname}#/explore`);
        show('explore');
        explore.openById(decodeURIComponent(w[1]));
        return;
    }
    const v = location.hash.replace(/^#\/?/, '');
    show(VIEWS.includes(v) ? v : 'create');
}

function navigate(view) {
    if (location.hash === `#/${view}`) show(view);
    else location.hash = `#/${view}`;
}

register({ nav: (el) => navigate(el.dataset.to) });
on('navigate', navigate);

// Failed thumbnails keep their gradient card instead of showing a broken-image glyph.
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.closest('.lib-card, .variant, .pick')) img.style.visibility = 'hidden';
}, true);

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', (e) => {
    const dialogOpen = !!document.querySelector('dialog[open]');
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (current === 'create' && !dialogOpen) { e.preventDefault(); create.generateNow(); }
        return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (viewer.isOpen()) { viewer.key(e); return; }
    if (dialogOpen) return;
    if (current === 'explore' && explore.key(e)) return;
    if (current === 'create' && create.key(e)) return;
    if (e.key === '1') navigate('explore');
    else if (e.key === '2') navigate('create');
    else if (e.key === '3') navigate('library');
});

// ---------------------------------------------------------------- boot
account.init();
create.init();
explore.init();
library.init();
viewer.init();
applyLock();
addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW registration failed', e)));
}
