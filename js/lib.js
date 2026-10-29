// Small shared helpers (no dependencies)

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Only http(s) and image data URLs may reach an <img src>. */
export const safeUrl = (u) => (/^(https?:\/\/|data:image\/)/i.test(u || '') ? u : '');

/** Inline SVG icon from the sprite in index.html. */
export const ic = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const randInt = (n = 1_000_000) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

export function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}

/** localStorage that never throws (private mode, quota, disabled storage). */
export const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? fallback : JSON.parse(raw);
        } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
};

/** Resize/compress a remote Unsplash photo on their CDN. */
export function photo(url, w, h) {
    try {
        const u = new URL(url);
        u.searchParams.set('w', w);
        if (h) { u.searchParams.set('h', h); u.searchParams.set('fit', 'crop'); }
        u.searchParams.set('q', '65');
        u.searchParams.set('auto', 'format');
        return u.toString();
    } catch { return url; }
}

/** 0xRRGGBB -> hue (0-360) */
export function hueOf(hex) {
    const r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 220;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (Math.round(h * 60) + 360) % 360;
}

const ICONS = { success: 'circle-check', error: 'circle-alert', info: 'info', warning: 'triangle-alert' };
let toastTimer;
export function toast(message, type = 'info', duration = 3200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.className = `toast ${type}`;
    el.innerHTML = `${ic(ICONS[type] || 'info')}<span>${esc(message)}</span>`;
    // restart the enter transition
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/** Stable initial + hue for avatar placeholders (no third-party avatar service). */
export function avatarHtml(name, url, cls = '') {
    const safe = safeUrl(url);
    if (safe) return `<img class="av ${cls}" src="${esc(safe)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    const n = String(name || '?').trim() || '?';
    let h = 0;
    for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `<span class="av ${cls}" style="--h:${h}" aria-hidden="true">${esc(n[0].toUpperCase())}</span>`;
}

export const fmtCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n || 0));

export const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

export async function copyText(text, okMessage = 'Copied') {
    try {
        await navigator.clipboard.writeText(text);
        toast(okMessage, 'success', 1800);
    } catch {
        toast('Couldn’t copy', 'error');
    }
}

/** Saves an image. If the host blocks cross-origin reads, opens it in a new tab instead. */
export async function downloadUrl(url, baseName, ratio = 0) {
    const safe = safeUrl(url);
    if (!safe) return;
    try {
        const res = await fetch(safe, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let blob = await res.blob();
        if (ratio) blob = await cropToRatio(blob, ratio);
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*/, '');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${baseName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast('Saved to your downloads', 'success', 2000);
    } catch {
        window.open(safe, '_blank', 'noopener');
        toast('Opened in a new tab — long-press or right-click to save', 'info', 4500);
    }
}

/**
 * If a model returned a different shape than requested (e.g. a square for a phone), center-crop
 * it to the wanted aspect ratio so the saved file is the right shape. No-op when close enough.
 */
export async function cropToRatio(blob, ratio) {
    try {
        const bmp = await createImageBitmap(blob);
        const have = bmp.width / bmp.height;
        if (Math.abs(have / ratio - 1) < 0.04) { bmp.close?.(); return blob; }
        let w = bmp.width, h = bmp.height;
        if (have > ratio) w = Math.round(h * ratio); else h = Math.round(w / ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(bmp, (bmp.width - w) / 2, (bmp.height - h) / 2, w, h, 0, 0, w, h);
        bmp.close?.();
        return await new Promise((resolve) => c.toBlob((b) => resolve(b || blob), 'image/png'));
    } catch { return blob; }
}

/**
 * Soft blurred backdrop without any blur filter: draw the image into a tiny canvas and let
 * CSS scale it up with smoothing. Cross-origin images taint the canvas but still display.
 */
export function paintAmbient(img, canvas) {
    try {
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.classList.add('ready');
    } catch { /* decode error: leave the plain backdrop */ }
}

export const itemName = (it) => `wallpaper-${slug(it.genre) || 'ai'}-${slug(it.style) || 'art'}-${it.seed ?? Date.now()}`;
