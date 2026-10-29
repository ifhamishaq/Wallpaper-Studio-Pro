// Native <dialog> helpers: sheets, confirmation, backdrop-click to close.
import { $ } from './lib.js';
import { register } from './state.js';

export function openDialog(dlg) {
    if (dlg && !dlg.open) dlg.showModal();
}

export function closeDialog(dlg) {
    if (dlg?.open) dlg.close();
}

// A click on the ::backdrop reports the <dialog> itself as the target; treat any click that
// lands outside the dialog's box as "dismiss".
document.addEventListener('click', (e) => {
    const dlg = e.target;
    if (!(dlg instanceof HTMLDialogElement) || !dlg.open || dlg.dataset.modal === 'strict') return;
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close();
});

register({
    'close-dialog': (el) => el.closest('dialog')?.close()
});

export function confirmAsk(title, text, okLabel = 'Confirm') {
    const d = $('#dlg-confirm');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = okLabel;
    return new Promise((resolve) => {
        d.returnValue = '';
        const done = () => { d.removeEventListener('close', done); resolve(d.returnValue === 'ok'); };
        d.addEventListener('close', done);
        d.showModal();
    });
}
