// One full-screen slide (image + overlay UI) and the actions on it.
// Used by the Explore feed and by the full-screen viewer, for community and personal items.
import { esc, safeUrl, ic, fmtCount, avatarHtml, paintAmbient, toast, prefersReducedMotion } from './lib.js';
import { state, register, on, emit, isFavorite, savePrefs } from './state.js';
import * as cloud from './cloud.js';
import * as items from './items.js';

const { db } = cloud;

/** url -> item, so buttons only need a data-k attribute. */
const registry = new Map();
export const lookup = (k) => registry.get(k);

const railBtn = (action, icon, label, k, { pressed, count } = {}) => `
    <button type="button" class="rail-btn" data-action="${action}" data-k="${esc(k)}"
        ${pressed === undefined ? '' : `aria-pressed="${pressed}"`} aria-label="${esc(label)}" title="${esc(label)}">
        <span class="rail-ic">${ic(icon)}</span>${count === undefined ? '' : `<span class="rail-n">${esc(count)}</span>`}
    </button>`;

export function slideHTML(item, i = 99) {
    registry.set(item.url, item);
    const k = item.url;
    const community = !!item.author_name;
    const mine = !!item.mine || !community;
    const fav = isFavorite(item);

    const rail = community
        ? railBtn('item-like', 'heart', 'Like', k, { pressed: !!item.is_liked, count: fmtCount(item.likes_count) })
        : railBtn('item-fav', 'star', 'Favorite', k, { pressed: fav });

    const railMore = [
        railBtn('item-remix', 'shuffle', 'Remix this look', k),
        railBtn('item-download', 'download', 'Download', k),
        railBtn('item-share', 'share-2', 'Share', k),
        mine ? railBtn('item-public', 'globe', item.isPublic ? 'Public — tap to make private' : 'Make public', k, { pressed: !!item.isPublic }) : '',
        mine ? railBtn('item-delete', 'trash-2', 'Delete', k) : ''
    ].join('');

    const info = community ? `
        <div class="author-row">
            <button type="button" class="author" data-action="item-creator" data-k="${esc(k)}">
                ${avatarHtml(item.author_name, item.author_avatar)}<span>@${esc(item.author_name)}</span>
            </button>
            ${item.user_id && item.user_id !== state.user?.id ? `<button type="button" class="follow" data-action="item-follow" data-uid="${esc(item.user_id)}" data-name="${esc(item.author_name)}" aria-pressed="${state.following.has(item.user_id)}">${state.following.has(item.user_id) ? 'Following' : 'Follow'}</button>` : ''}
        </div>` : '';

    const tags = [item.genre, item.style].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const views = community ? `<span class="tag tag-quiet">${ic('eye')}${fmtCount(item.views_count)}</span>` : '';

    return `
        <div class="slide-bg" aria-hidden="true"><canvas width="24" height="40"></canvas></div>
        <div class="slide-media" data-action="slide-tap">
            <div class="frame">
                <img class="slide-img" src="${esc(safeUrl(item.url))}" alt="${esc((item.prompt || 'AI wallpaper').slice(0, 140))}" decoding="async" ${i < 2 ? 'fetchpriority="high"' : ''}>
                <div class="lock-ov" aria-hidden="true"><span class="lock-date"></span><span class="lock-time"></span></div>
            </div>
        </div>
        <div class="slide-ui">
            <div class="slide-info">
                ${info}
                <p class="slide-prompt" data-action="item-prompt" title="Tap to expand">${esc(item.prompt)}</p>
                <div class="tags">${tags}${views}</div>
            </div>
            <div class="slide-rail">${rail}${railMore}</div>
        </div>`;
}

// ---------------------------------------------------------------- image lifecycle
document.addEventListener('load', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('slide-img')) return;
    const slide = img.closest('.slide');
    img.classList.add('ld');
    if (!slide) return;
    slide.dataset.tall = img.naturalHeight / img.naturalWidth > 1.3 ? '1' : '0';
    paintAmbient(img, slide.querySelector('.slide-bg canvas'));
    tickLock();
}, true);

document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.classList.contains('slide-img')) img.closest('.slide')?.classList.add('err');
}, true);

// ---------------------------------------------------------------- lock-screen clock overlay
let lockTimer = 0;
export function tickLock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    document.querySelectorAll('.lock-time').forEach((n) => { n.textContent = time; });
    document.querySelectorAll('.lock-date').forEach((n) => { n.textContent = date; });
}

export function applyLock() {
    document.documentElement.dataset.lock = state.lockPreview ? 'on' : 'off';
    document.querySelectorAll('[data-action="toggle-lock"]').forEach((b) => b.setAttribute('aria-pressed', state.lockPreview));
    clearInterval(lockTimer);
    if (state.lockPreview) { tickLock(); lockTimer = setInterval(tickLock, 15000); }
}

// ---------------------------------------------------------------- keeping buttons in sync
function paint(item) {
    document.querySelectorAll('[data-k]').forEach((b) => {
        if (b.dataset.k !== item.url) return;
        const a = b.dataset.action;
        if (a === 'item-fav') b.setAttribute('aria-pressed', isFavorite(item));
        if (a === 'item-like') {
            b.setAttribute('aria-pressed', !!item.is_liked);
            b.querySelector('.rail-n').textContent = fmtCount(item.likes_count);
        }
        if (a === 'item-public') {
            b.setAttribute('aria-pressed', !!item.isPublic);
            b.setAttribute('aria-label', item.isPublic ? 'Public — tap to make private' : 'Make public');
        }
    });
}
on('item:changed', paint);

// ---------------------------------------------------------------- actions
const item = (el) => registry.get(el.dataset.k);

async function like(it) {
    if (!state.user) return emit('need-auth', 'Sign in to like wallpapers');
    if (!it.cloudId) return;
    const was = !!it.is_liked;
    it.is_liked = !was;
    it.likes_count = Math.max(0, (it.likes_count || 0) + (was ? -1 : 1));
    paint(it);
    try {
        await db.setLike(it.cloudId, state.user.id, !was);
    } catch (e) {
        console.error(e);
        it.is_liked = was;
        it.likes_count = Math.max(0, it.likes_count + (was ? 1 : -1));
        paint(it);
        toast('Couldn’t update your like', 'error');
    }
}

function setFollowUI(id, followed) {
    followed ? state.following.add(id) : state.following.delete(id);
    document.querySelectorAll('.follow').forEach((b) => {
        if (b.dataset.uid !== id) return;
        b.setAttribute('aria-pressed', followed);
        b.textContent = followed ? 'Following' : 'Follow';
    });
}

let tapTimer = 0, lastTap = 0;
function burst(media, e) {
    if (prefersReducedMotion()) return;
    const r = media.getBoundingClientRect();
    const b = document.createElement('i');
    b.className = 'burst';
    b.style.left = `${e.clientX - r.left}px`;
    b.style.top = `${e.clientY - r.top}px`;
    b.innerHTML = ic('heart');
    media.appendChild(b);
    b.addEventListener('animationend', () => b.remove(), { once: true });
}

register({
    'item-like': (el) => { const it = item(el); if (it) like(it); },
    'item-fav': (el) => { const it = item(el); if (it) { const on_ = items.toggleFavorite(it); toast(on_ ? 'Added to favorites' : 'Removed from favorites', 'info', 1400); } },
    'item-remix': (el) => { const it = item(el); if (it) items.remix(it); },
    'item-download': (el) => { const it = item(el); if (it) items.download(it); },
    'item-share': (el) => { const it = item(el); if (it) items.share(it); },
    'item-public': (el) => { const it = item(el); if (it) items.togglePublic(it); },
    'item-delete': async (el) => { const it = item(el); if (it && (await items.remove(it))) emit('item:removed', it); },
    'item-prompt': (el) => el.classList.toggle('open'),
    'item-creator': (el) => { const it = item(el); if (it) emit('creator', { id: it.user_id, name: it.author_name }); },
    'item-follow': async (el) => {
        if (!state.user) return emit('need-auth', 'Sign in to follow creators');
        const id = el.dataset.uid, name = el.dataset.name;
        const followed = !state.following.has(id);
        setFollowUI(id, followed);
        try {
            await db.setFollow(state.user.id, id, followed);
            toast(followed ? `Following ${name}` : `Unfollowed ${name}`, 'success', 1800);
            emit('following:changed', { id, followed });
        } catch (e) {
            setFollowUI(id, !followed);
            toast(e.message || 'Couldn’t update follow', 'error');
        }
    },
    'toggle-lock': () => { state.lockPreview = !state.lockPreview; savePrefs(); applyLock(); },

    // single tap hides/shows the UI; double tap likes (or favorites)
    'slide-tap': (el, e) => {
        const slide = el.closest('.slide');
        const host = el.closest('[data-pager-host]');
        const it = registry.get(slide.querySelector('[data-k]')?.dataset.k);
        const now = Date.now();
        clearTimeout(tapTimer);
        if (now - lastTap < 300) {
            lastTap = 0;
            if (!it) return;
            burst(el, e);
            if (it.author_name) { if (!it.is_liked) like(it); }
            else if (!isFavorite(it)) items.toggleFavorite(it);
            return;
        }
        lastTap = now;
        tapTimer = setTimeout(() => host?.classList.toggle('clean'), 260);
    }
});
