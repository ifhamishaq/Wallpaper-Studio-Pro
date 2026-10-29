// Account: sign in / up, profile, credits, cloud sync and app preferences.
import { $, $$, ic, store, toast, avatarHtml, idle } from './lib.js';
import { state, register, on, emit, saveHistory } from './state.js';
import { APP } from './config.js';
import * as cloud from './cloud.js';
import { openDialog, closeDialog, confirmAsk } from './dialogs.js';
import { toLocalRow } from './items.js';

const { db, auth } = cloud;

const displayName = () => state.profile?.username || state.user?.user_metadata?.username || state.user?.email?.split('@')[0] || 'You';
const avatarUrl = () => state.profile?.avatar_url || state.user?.user_metadata?.avatar_url || '';

// ------------------------------------------------------------------ credits
export function setCredits(c) {
    state.credits = c;
    $$('.credits-num').forEach((n) => { n.textContent = c; });
    $('#profile-credits').textContent = c;
}

export async function refreshCredits() {
    if (!state.user) return null;
    const c = await db.credits(state.user.id);
    setCredits(c);
    return c;
}

// ------------------------------------------------------------------ rendering
export function renderUserUI() {
    const u = state.user;
    $$('.avatar-btn').forEach((b) => {
        b.innerHTML = u ? avatarHtml(displayName(), avatarUrl()) : ic('user');
        b.setAttribute('aria-label', u ? `Account: ${displayName()}` : 'Sign in');
    });
    $$('.credits-chip').forEach((c) => { c.hidden = !u; });
    $$('.credits-num').forEach((n) => { n.textContent = state.credits ?? '--'; });
    if ($('#dlg-account').open) renderAccount();
}

function renderAccount() {
    const u = state.user;
    $('#auth-guest').hidden = !!u;
    $('#auth-user').hidden = !u;
    $('#account-title').textContent = u ? 'Your profile' : 'Welcome';
    if (!u) return;
    $('#profile-email').textContent = u.email || '';
    $('#profile-username').value = displayName();
    $('#profile-avatar-url').value = avatarUrl();
    $('#profile-avatar').innerHTML = avatarHtml(displayName(), avatarUrl());
    $('#profile-credits').textContent = state.credits ?? '--';
    $('#profile-credits-max').textContent = APP.DAILY_CREDITS;
}

export function openAccount() {
    renderAccount();
    openDialog($('#dlg-account'));
    if (!state.user) cloud.client().catch(() => { }); // warm the SDK while the user types
}

function authTab(tab) {
    const signin = tab === 'signin';
    $('#form-signin').hidden = !signin;
    $('#form-signup').hidden = signin;
    $$('[data-action="auth-tab"]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
}

function friendlyError(e) {
    const m = String(e?.message || e || '');
    if (/failed to fetch|network|import|load/i.test(m)) return 'Can’t reach the server. Check your connection and try again.';
    if (/invalid login/i.test(m)) return 'That email and password don’t match.';
    if (/already registered/i.test(m)) return 'An account with that email already exists.';
    if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox.';
    return m || 'Something went wrong. Please try again.';
}

// ------------------------------------------------------------------ session
let load = 0;
const value = (r) => (r.status === 'fulfilled' ? r.value : null);

async function setUser(user) {
    const isNew = state.user?.id !== user.id;
    state.user = user;
    renderUserUI();
    if (!isNew) return;

    const token = ++load;
    const [profile, credits, following] = (await Promise.allSettled([
        db.profile(user.id), db.credits(user.id), db.followingIds(user.id)
    ])).map(value);
    if (token !== load || state.user?.id !== user.id) return;

    state.profile = profile;
    state.following = new Set(following || []);
    if (credits != null) setCredits(credits);
    renderUserUI();
    emit('user:changed', user);
    idle(syncLocalToCloud);
}

function clearUser() {
    if (!state.user) return;
    load++;
    state.user = null;
    state.profile = null;
    state.credits = null;
    state.following = new Set();
    renderUserUI();
    emit('user:changed', null);
}

/** Uploads wallpapers that only exist on this device (once). */
async function syncLocalToCloud() {
    if (!state.user) return;
    const pending = state.history.filter((i) => !i.synced);
    if (!pending.length) return;
    try {
        const existing = await db.existingUrls(state.user.id, pending.map((i) => i.url));
        const fresh = pending.filter((i) => !existing.has(i.url));
        if (fresh.length) {
            const rows = await db.saveMany(fresh.map((i) => toLocalRow(i, false)));
            const byUrl = new Map(rows.map((r) => [r.url, r]));
            fresh.forEach((i) => { const r = byUrl.get(i.url); if (r) i.cloudId = r.id; });
        }
        pending.forEach((i) => { i.synced = true; });
        saveHistory();
        if (fresh.length) toast(`Synced ${fresh.length} wallpaper${fresh.length > 1 ? 's' : ''} to your account`, 'success');
        emit('library:changed');
    } catch (e) {
        console.warn('Sync failed', e);
    }
}

// ------------------------------------------------------------------ avatar upload
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
        closeDialog($('#dlg-account'));
        form.reset();
        toast('Welcome back', 'success');
    } else if (kind === 'signup') {
        await auth.signUp(String(f.get('email')).trim(), String(f.get('password')), String(f.get('username')).trim());
        closeDialog($('#dlg-account'));
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

// ------------------------------------------------------------------ install prompt
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    $('#install-row').hidden = false;
});
addEventListener('appinstalled', () => { installEvent = null; $('#install-row').hidden = true; toast('Installed — find it on your home screen', 'success'); });

// ------------------------------------------------------------------ init
export function init() {
    register({
        account: openAccount,
        'auth-tab': (el) => authTab(el.dataset.tab),
        'sign-out': async () => {
            if (!(await confirmAsk('Sign out?', 'Your library stays on this device.', 'Sign out'))) return;
            try {
                await auth.signOut();
                clearUser();
                closeDialog($('#dlg-account'));
                toast('Signed out', 'info', 2000);
            } catch (e) {
                toast(e.message || 'Couldn’t sign out', 'error');
            }
        },
        'install-app': async () => {
            if (!installEvent) return;
            installEvent.prompt();
            await installEvent.userChoice.catch(() => { });
            installEvent = null;
            $('#install-row').hidden = true;
        },
        'clear-data': async () => {
            if (!(await confirmAsk('Clear data on this device?', 'Removes your local library, favorites and preferences. Wallpapers saved to your account are not affected.', 'Clear'))) return;
            ['wallpaper_history', 'wallpaper_favorites', 'wsp_prefs', 'wallpaper_preferences'].forEach((k) => store.remove(k));
            state.history = [];
            state.favorites = new Set();
            emit('library:changed');
            toast('Local data cleared', 'success', 2000);
        }
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
            err.textContent = friendlyError(ex);
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    });

    $('#avatar-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || !state.user) return;
        try {
            toast('Uploading photo…', 'info', 1500);
            const url = await db.uploadAvatar(state.user.id, await squareJpeg(file));
            $('#profile-avatar-url').value = url;
            $('#profile-avatar').innerHTML = avatarHtml(displayName(), url);
            toast('Photo uploaded — save your changes to apply it', 'success', 3500);
        } catch (err) {
            console.error(err);
            toast('Upload failed — try a different image', 'error');
        }
    });

    on('need-auth', (message) => { openAccount(); if (message) toast(message, 'info'); });

    cloud.onAuth((event, session) => {
        // Never call into supabase-js from inside its own auth callback.
        setTimeout(() => {
            if (session?.user) setUser(session.user);
            else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') clearUser();
        }, 0);
    });
    if (cloud.shouldBootEarly()) idle(() => cloud.client().catch((e) => console.warn('Cloud unavailable', e)));

    renderUserUI();
}
