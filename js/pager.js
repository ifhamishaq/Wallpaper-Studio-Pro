// Full-screen vertical pager built on native scroll-snap.
// Every item gets an empty placeholder slide (cheap); only slides near the viewport are
// rendered, and slides far away are emptied again so long feeds stay light.

const KEEP = 3; // slides kept mounted on each side of the active one

export class Pager {
    /**
     * @param {HTMLElement} root  scroll container (height: 100%, overflow-y: auto, scroll-snap)
     * @param {{render:(item:any,i:number)=>string, onActive?:(item:any,i:number)=>void, onNearEnd?:()=>void}} opts
     */
    constructor(root, { render, onActive, onNearEnd }) {
        this.root = root;
        this.render = render;
        this.onActive = onActive;
        this.onNearEnd = onNearEnd;
        this.items = [];
        this.slides = [];
        this.index = -1;

        this.mountIO = new IntersectionObserver((entries) => {
            for (const e of entries) if (e.isIntersecting) this.mount(Number(e.target.dataset.i));
        }, { root, rootMargin: '120% 0px' });

        this.activeIO = new IntersectionObserver((entries) => {
            for (const e of entries) if (e.isIntersecting) this.setActive(Number(e.target.dataset.i));
        }, { root, threshold: 0.6 });
    }

    get length() { return this.items.length; }

    setItems(items, startIndex = 0) {
        this.mountIO.disconnect();
        this.activeIO.disconnect();
        this.root.textContent = '';
        this.items = [];
        this.slides = [];
        this.index = -1;
        this.append(items);
        if (startIndex > 0) {
            this.root.scrollTop = startIndex * this.root.clientHeight;
        } else {
            this.root.scrollTop = 0;
        }
    }

    append(items) {
        const frag = document.createDocumentFragment();
        for (const item of items) {
            const i = this.items.length;
            this.items.push(item);
            const el = document.createElement('section');
            el.className = 'slide';
            el.dataset.i = i;
            el.setAttribute('aria-roledescription', 'slide');
            this.slides.push({ el, mounted: false });
            frag.appendChild(el);
            this.mountIO.observe(el);
            this.activeIO.observe(el);
        }
        this.root.appendChild(frag);
    }

    mount(i) {
        const s = this.slides[i];
        if (!s || s.mounted) return;
        s.el.innerHTML = this.render(this.items[i], i);
        s.mounted = true;
    }

    /** Re-render one slide in place (after its data changed). */
    refresh(i) {
        const s = this.slides[i];
        if (!s) return;
        s.mounted = false;
        this.mount(i);
    }

    setActive(i) {
        if (i === this.index) return;
        this.index = i;
        this.slides.forEach((s, n) => {
            if (s.mounted && Math.abs(n - i) > KEEP + 2) { s.el.textContent = ''; s.mounted = false; }
        });
        this.onActive?.(this.items[i], i);
        if (i >= this.items.length - 4) this.onNearEnd?.();
    }

    goTo(i, smooth = true) {
        const s = this.slides[Math.max(0, Math.min(this.slides.length - 1, i))];
        s?.el.scrollIntoView({ block: 'start', behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    }

    next() { this.goTo(this.index + 1); }
    prev() { this.goTo(this.index - 1); }

    remove(i) {
        const wasActive = i === this.index;
        this.items.splice(i, 1);
        const [s] = this.slides.splice(i, 1);
        this.mountIO.unobserve(s.el);
        this.activeIO.unobserve(s.el);
        s.el.remove();
        this.slides.forEach((x, n) => { x.el.dataset.i = n; });
        if (wasActive) {
            this.index = -1;
            const j = Math.min(i, this.items.length - 1);
            if (j >= 0) { this.mount(j); this.setActive(j); }
        } else if (i < this.index) {
            this.index--;
        }
    }
}
