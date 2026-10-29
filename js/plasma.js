// "Plasma" generation loader.
// A tiny canvas (≈36×64 px) is filled with a flowing sine-field palette ~24 times a second and
// CSS scales it up with smoothing, which reads as a silky gradient at almost zero cost.

const TAU = Math.PI * 2;

function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
    const f = (n) => {
        const k = (n + h * 12) % 12;
        return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function createPlasma(canvas, { onFrame } = {}) {
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, last = 0, t0 = 0, running = false, timer = 0;
    let lut = [], W = 0, H = 0, img = null;

    function setup(ratio, hue) {
        H = 64;
        W = Math.max(24, Math.min(160, Math.round(H * ratio)));
        canvas.width = W;
        canvas.height = H;
        img = ctx.createImageData(W, H);
        lut = Array.from({ length: 256 }, (_, i) => {
            const m = i / 255;
            return hsl(hue - 30 + m * 110, 88, 14 + 52 * Math.pow(m, 1.4));
        });
    }

    function draw(t) {
        const d = img.data;
        let p = 0;
        const cx = 0.5 + 0.3 * Math.sin(t * 0.31), cy = 0.5 + 0.3 * Math.cos(t * 0.43);
        for (let y = 0; y < H; y++) {
            const v = y / H;
            for (let x = 0; x < W; x++) {
                const u = x / W;
                const s = Math.sin(u * 5 + t * 0.9) + Math.sin(v * 4 + t * 0.7) + Math.sin((u + v) * 3.5 + t * 0.5)
                    + Math.sin(Math.hypot(u - cx, v - cy) * 9 - t * 1.2);
                const c = lut[Math.max(0, Math.min(255, Math.round((s / 8 + 0.5) * 255)))];
                d[p++] = c[0]; d[p++] = c[1]; d[p++] = c[2]; d[p++] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    function loop(now) {
        raf = requestAnimationFrame(loop);
        if (now - last < 40) return; // ~24fps
        last = now;
        const t = (now - t0) / 1000;
        draw(t);
        onFrame?.(t);
    }

    return {
        start({ ratio = 0.5, hue = 260 } = {}) {
            if (running) return;
            running = true;
            setup(ratio, hue);
            t0 = performance.now();
            if (reduce.matches) {
                draw(2);
                timer = setInterval(() => onFrame?.((performance.now() - t0) / 1000), 100);
            } else {
                raf = requestAnimationFrame(loop);
            }
        },
        stop() {
            running = false;
            cancelAnimationFrame(raf);
            clearInterval(timer);
        }
    };
}
