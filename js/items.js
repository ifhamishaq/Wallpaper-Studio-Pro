// Actions that apply to a single wallpaper, wherever it is shown (feed, library, create).
//
// An "item" is a plain object:
//   { url, genre, style, prompt, sub, seed, w, h, ts,
//     cloudId?, isPublic?, user_id?, mine?,                       // cloud / ownership
//     author_name?, author_avatar?, likes_count?, views_count?, is_liked? }  // community
import { state, emit, saveHistory, isFavorite } from './state.js';
import * as cloud from './cloud.js';
import { toast, copyText, downloadUrl, itemName, safeUrl } from './lib.js';
import { confirmAsk } from './dialogs.js';

const { db } = cloud;

export const keyOf = (item) => item.url;

export function toLocalRow(item, isPublic) {
    return {
        user_id: state.user.id, url: item.url, prompt: item.prompt || 'Untitled',
        genre: item.genre || null, style: item.style || null, seed: item.seed ?? null, is_public: isPublic
    };
}

export function toggleFavorite(item) {
    const on = !isFavorite(item);
    on ? state.favorites.add(item.url) : state.favorites.delete(item.url);
    saveHistory();
    emit('item:changed', item);
    emit('library:changed');
    return on;
}

export const download = (item) => downloadUrl(item.url, itemName(item));

export async function share(item) {
    const url = item.cloudId && (item.isPublic || item.author_name) ? `${location.origin}/#w=${item.cloudId}` : item.url;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Wallpaper Studio Pro', text: 'Check out this AI wallpaper', url });
            return;
        } catch (e) { if (e.name === 'AbortError') return; }
    }
    await copyText(url, 'Link copied');
}

/** Toggles public/private, creating the cloud row first if needed. Returns the new state or null. */
export async function togglePublic(item) {
    if (!state.user) { emit('need-auth', 'Sign in to share wallpapers'); return null; }
    try {
        let id = item.cloudId;
        let isPublic = item.isPublic;
        if (!id) {
            const row = await db.findByUrl(item.url, state.user.id);
            if (row) { id = row.id; isPublic = row.is_public; }
        }
        if (id) {
            isPublic = !isPublic;
            await db.setPublic(id, isPublic);
        } else {
            const [created] = await db.saveMany([toLocalRow(item, true)]);
            id = created.id;
            isPublic = true;
        }
        item.cloudId = id;
        item.isPublic = isPublic;
        item.synced = true;
        saveHistory();
        emit('item:changed', item);
        emit('library:changed');
        toast(isPublic ? 'Shared with the community' : 'Now private', isPublic ? 'success' : 'info');
        return isPublic;
    } catch (e) {
        console.error(e);
        toast('Couldn’t update sharing — please try again', 'error');
        return null;
    }
}

export async function remove(item) {
    if (!(await confirmAsk('Delete this wallpaper?', item.cloudId ? 'It will be removed from your library and from the cloud.' : 'It will be removed from this device.', 'Delete'))) return false;
    try {
        if (item.cloudId && state.user) await db.remove(item.cloudId, state.user.id);
        state.history = state.history.filter((i) => i.url !== item.url);
        state.favorites.delete(item.url);
        saveHistory();
        emit('item:removed', item);
        emit('library:changed');
        toast('Deleted', 'info', 1800);
        return true;
    } catch (e) {
        console.error(e);
        toast('Couldn’t delete — please try again', 'error');
        return false;
    }
}

export const remix = (item) => emit('remix', item);

export const hasImage = (item) => !!safeUrl(item.url);
