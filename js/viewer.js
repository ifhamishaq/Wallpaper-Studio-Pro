// Full-screen viewer: the same slide pager, opened over any list of wallpapers.
import { $ } from './lib.js';
import { register, on } from './state.js';
import { Pager } from './pager.js';
import { slideHTML, applyLock } from './slide.js';
import { openDialog, closeDialog } from './dialogs.js';

let pager = null;

function ensure() {
    if (pager) return pager;
    pager = new Pager($('#viewer-pager'), {
        render: slideHTML,
        onActive: (_, i) => { $('#viewer-count').textContent = `${i + 1} / ${pager.length}`; }
    });
    return pager;
}

/** @param {any[]} list items to page through  @param {number} start index to open at */
export function openViewer(list, start = 0) {
    if (!list.length) return;
    const dlg = $('#viewer');
    openDialog(dlg);
    ensure();
    // layout must exist before the scroll offset of the start slide can be set
    requestAnimationFrame(() => {
        pager.setItems(list, start);
        $('#viewer-count').textContent = `${start + 1} / ${list.length}`;
        $('#viewer-pager').focus({ preventScroll: true });
        applyLock();
    });
}

export const isOpen = () => !!$('#viewer')?.open;

export function key(e) {
    if (!pager) return false;
    if (['ArrowDown', 'ArrowRight', 'j', 'PageDown'].includes(e.key)) { e.preventDefault(); pager.next(); return true; }
    if (['ArrowUp', 'ArrowLeft', 'k', 'PageUp'].includes(e.key)) { e.preventDefault(); pager.prev(); return true; }
    return false;
}

export function init() {
    register({
        'viewer-next': () => pager?.next(),
        'viewer-prev': () => pager?.prev()
    });
    $('#viewer').addEventListener('close', () => { $('#viewer-pager').textContent = ''; pager?.setItems([]); });
    on('remix', () => closeDialog($('#viewer')));
    on('item:removed', (item) => {
        if (!isOpen() || !pager) return;
        const i = pager.items.findIndex((x) => x.url === item.url);
        if (i >= 0) pager.remove(i);
        if (!pager.length) closeDialog($('#viewer'));
        else $('#viewer-count').textContent = `${pager.index + 1} / ${pager.length}`;
    });
}
