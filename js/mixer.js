// Mixer: the split card where you swipe a Subject (top) and a Style (bottom) and watch the
// "+" combine them. Built on native horizontal scroll-snap; slides dim with transform/opacity
// only (no blur or grayscale filters), so it stays smooth even with 37 photos.
import { $, esc, photo, hueOf, pick, randInt, sleep, prefersReducedMotion } from './lib.js';
import { GENRES, STYLES, MODIFIERS } from './config.js';
import { state, register, emit } from './state.js';
import { openDialog } from './dialogs.js';

const CFG = {
    subject: { list: GENRES, key: 'genre' },
    style: { list: STYLES, key: 'style' }
};

let built = false;
let shuffling = false;
let focusType = 'subject';
const shown = { subject: -1, style: -1 };

const trackOf = (type) => $(`#mx-track-${type}`);

function build() {
    for (const [type, c] of Object.entries(CFG)) {
        const track = trackOf(type);
        track.innerHTML = c.list.map((it, i) => {
            const h = type === 'subject' ? hueOf(it.color) : (i * 47 + 20) % 360;
            return `<div class="mx-slide" data-i="${i}" role="group" aria-roledescription="slide" aria-label="${esc(it.name)}" style="--tint:hsl(${h} 60% 38%)">
                <img src="${esc(photo(it.image, 720, 560))}" alt="" loading="lazy" decoding="async"></div>`;
        }).join('');

        const io = new IntersectionObserver((entries) => {
            for (const e of entries) if (e.isIntersecting) activate(type, Number(e.target.dataset.i));
        }, { root: track, threshold: 0.6 });
        track.querySelectorAll('.mx-slide').forEach((s) => io.observe(s));
    }
    built = true;
}

function paint(type) {
    const c = CFG[type];
    const i = state[c.key];
    const track = trackOf(type);
    if (shown[type] >= 0) track.children[shown[type]]?.classList.remove('is-active');
    track.children[i]?.classList.add('is-active');
    shown[type] = i;
    $(`#mx-name-${type}`).textContent = c.list[i].name;
    $(`#mx-count-${type}`).textContent = `${String(i + 1).padStart(2, '0')}/${c.list.length}`;
}

function activate(type, i) {
    const c = CFG[type];
    if (state[c.key] === i && shown[type] === i) return;
    state[c.key] = i;
    if (!shuffling) state.modifier = '';
    paint(type);
    emit('selection', { done: false });
}

function goTo(type, i, smooth) {
    const track = trackOf(type);
    if (!track.clientWidth) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
}

async function shuffle() {
    if (shuffling) return;
    shuffling = true;
    const steps = prefersReducedMotion() ? 1 : 8;
    for (let n = 0; n < steps; n++) {
        goTo('subject', randInt(GENRES.length), false);
        goTo('style', randInt(STYLES.length), false);
        await sleep(95);
    }
    await sleep(160); // let the last scroll settle and be observed
    state.modifier = pick(MODIFIERS);
    shuffling = false;
    emit('selection', { done: false, surprise: true });
}

export function open(focus = 'subject') {
    if (!built) build();
    focusType = focus;
    const dlg = $('#mixer');
    openDialog(dlg);
    requestAnimationFrame(() => {
        for (const [type, c] of Object.entries(CFG)) {
            shown[type] = -1;
            goTo(type, state[c.key], false);
            paint(type);
        }
        trackOf(focusType).focus({ preventScroll: true });
    });
}

export function init() {
    register({
        'mx-step': (el) => {
            const type = el.dataset.type, c = CFG[type];
            const n = c.list.length;
            const from = state[c.key];
            const to = (from + Number(el.dataset.dir) + n) % n;
            goTo(type, to, Math.abs(to - from) === 1);
        },
        'mx-surprise': shuffle
    });

    const dlg = $('#mixer');
    dlg.addEventListener('close', () => emit('selection', { done: true }));
    dlg.addEventListener('focusin', (e) => {
        const half = e.target.closest?.('.mx-half');
        if (half) focusType = half.dataset.type;
    });
    dlg.addEventListener('keydown', (e) => {
        const type = focusType, c = CFG[type];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const n = c.list.length, dir = e.key === 'ArrowRight' ? 1 : -1;
            const to = (state[c.key] + dir + n) % n;
            goTo(type, to, Math.abs(to - state[c.key]) === 1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            focusType = e.key === 'ArrowUp' ? 'subject' : 'style';
            trackOf(focusType).focus({ preventScroll: true });
        } else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            shuffle();
        } else if (e.key === 'Enter' && !e.target.closest('button')) {
            e.preventDefault();
            dlg.close();
        }
    });
}
