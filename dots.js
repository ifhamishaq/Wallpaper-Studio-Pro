// Dot-matrix wave used as the "generating" animation.
// One small 2D canvas, ~30fps, only while a generation is running.
// Dots are bucketed by brightness so each frame costs a handful of fills.

const BUCKETS = 6;
const TAU = Math.PI * 2;

export function createDots(canvas, { gap = 13, onFrame } = {}) {
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, cols = 0, rows = 0, ox = 0, oy = 0;
    let raf = 0, timer = 0, ro = null, t0 = 0, last = 0, running = false;

    function resize() {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        w = r.width; h = r.height;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.max(3, Math.floor(w / gap));
        rows = Math.max(3, Math.floor(h / gap));
        ox = (w - (cols - 1) * gap) / 2;
        oy = (h - (rows - 1) * gap) / 2;
    }

    function draw(t) {
        if (!cols) return;
        ctx.clearRect(0, 0, w, h);
        const paths = Array.from({ length: BUCKETS }, () => new Path2D());
        const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
        const R = Math.min(w, h) * 0.62;
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const dx = (i - cx) * gap, dy = (j - cy) * gap;
                const d = Math.hypot(dx, dy) / R;
                const wave = 0.5 + 0.5 * Math.sin(d * 7.5 - t * 2.4);
                const v = Math.pow(wave, 2.4) * Math.max(0.08, 1 - d * 0.5);
                const b = Math.min(BUCKETS - 1, Math.floor(v * BUCKETS));
                const x = ox + i * gap, y = oy + j * gap, r = 0.9 + b * 0.32;
                paths[b].moveTo(x + r, y);
                paths[b].arc(x, y, r, 0, TAU);
            }
        }
        for (let b = 0; b < BUCKETS; b++) {
            ctx.fillStyle = `rgba(255,255,255,${(0.1 + 0.9 * (b / (BUCKETS - 1))).toFixed(2)})`;
            ctx.fill(paths[b]);
        }
    }

    function loop(now) {
        raf = requestAnimationFrame(loop);
        if (now - last < 32) return; // ~30fps
        last = now;
        const t = (now - t0) / 1000;
        draw(t);
        onFrame?.(t);
    }

    return {
        start() {
            if (running) return;
            running = true;
            resize();
            ro = new ResizeObserver(() => { resize(); });
            ro.observe(canvas);
            t0 = performance.now();
            if (reduce.matches) {
                draw(1.4);
                timer = setInterval(() => onFrame?.((performance.now() - t0) / 1000), 100);
            } else {
                raf = requestAnimationFrame(loop);
            }
        },
        stop() {
            running = false;
            cancelAnimationFrame(raf);
            clearInterval(timer);
            ro?.disconnect();
            ro = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
}
