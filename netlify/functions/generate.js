// Image generation proxy for Pixazo.
//
// Each model is an adapter: where to call, how to shape the request, and how to pull
// the image URL out of the response. The browser only ever sees { output: "<url>" }.
//
// To add a model: add an entry to MODELS below (and to js/config.js so it appears in the
// picker). Only add models whose request/response format you have verified against
// Pixazo's docs or a real call — field names differ between models.

const BASE = "https://gateway.pixazo.ai";

const MODELS = {
    "flux-schnell": {
        url: `${BASE}/flux-1-schnell/v1/getData`,
        body: (i) => ({
            prompt: i.prompt,
            width: i.width,
            height: i.height,
            num_steps: clampInt(i.steps, 1, 4, 4),
            seed: i.seed
        }),
        extract: (data) => (Array.isArray(data.output) ? data.output[0] : data.output)
    }
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export default async (request) => {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const apiKeys = getApiKeys();
        if (apiKeys.length === 0) return json({ error: "No API keys configured" }, 500);

        const input = await request.json().catch(() => null);
        if (!input || typeof input.prompt !== "string" || !input.prompt.trim()) {
            return json({ error: "A prompt is required" }, 400);
        }

        const modelId = typeof input.model === "string" ? input.model : "flux-schnell";
        const model = MODELS[modelId];
        if (!model) return json({ error: `Unknown model: ${modelId}` }, 400);

        // Only known fields, clamped to sane ranges (this endpoint is public).
        const seed = Number(input.seed);
        const clean = {
            prompt: input.prompt.slice(0, 1500),
            width: clampInt(input.width, 256, 4096, 1024),
            height: clampInt(input.height, 256, 4096, 1024),
            steps: input.steps ?? input.num_steps,
            seed: Number.isFinite(seed) ? Math.floor(seed) : Math.floor(Math.random() * 1000000)
        };
        const payload = JSON.stringify(model.body(clean));

        let lastError = null;
        let lastStatus = 500;

        for (const apiKey of apiKeys) {
            try {
                const response = await fetch(model.url, {
                    method: "POST",
                    headers: {
                        ...JSON_HEADERS,
                        "Ocp-Apim-Subscription-Key": apiKey,
                        "Cache-Control": "no-cache",
                        // Pixazo sits behind Cloudflare, which rejects bare server user-agents.
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "application/json, text/plain, */*",
                        "Accept-Language": "en-US,en;q=0.9",
                        "Origin": "https://pixazo.ai",
                        "Referer": "https://pixazo.ai/"
                    },
                    body: payload
                });

                if (response.ok) {
                    const data = await response.json();
                    const output = model.extract(data);
                    if (typeof output === "string" && output) return json({ output }, 200);
                    lastError = "Model returned no image";
                    lastStatus = 502;
                    continue;
                }

                lastStatus = response.status;
                const errorText = await response.text();
                console.warn(`[${modelId}] key ...${apiKey.slice(-4)} failed: ${response.status} ${errorText.substring(0, 200)}`);
                lastError = errorText.includes("<!DOCTYPE html>") ? "Blocked by upstream firewall (Cloudflare)" : errorText;

                // A client error means the request itself is wrong; another key won't help.
                if (response.status === 400) break;
            } catch (error) {
                lastError = error.message;
                console.warn(`[${modelId}] network error with key ...${apiKey.slice(-4)}`);
            }
        }

        return json({ error: "Generation failed", details: lastError }, lastStatus);
    } catch (error) {
        return json({ error: error.message }, 500);
    }
};

function json(body, status) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function getApiKeys() {
    const keys = [];
    const primary = Netlify.env.get("PIXAZO_API_KEY");
    if (primary) keys.push(primary);
    for (let i = 2; i <= 10; i++) {
        const key = Netlify.env.get(`PIXAZO_API_KEY_${i}`);
        if (key) keys.push(key);
    }
    return keys;
}

function clampInt(value, min, max, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
