# Wallpaper Studio Pro

AI wallpaper studio. Static front end (no build step) + one Netlify function that proxies Pixazo.

- **Create** — live phone / monitor preview, lock-screen preview, one floating composer
- **Explore** — full-screen vertical feed of community wallpapers
- **Library** — everything you've made (this device + your account)
- Installable PWA, works offline (shell only; generating needs a connection)

## Layout

```
index.html            app shell (all dialogs/sheets are native <dialog>)
style.css             design system + all views
js/main.js            router, keyboard, service worker
js/state.js           shared state, event bus, data-action click dispatcher
js/create.js          Create view: device preview, composer, sheets, generation
js/explore.js         Explore feed       js/library.js   Library
js/pager.js           scroll-snap pager (mounts only nearby slides)
js/slide.js           one full-screen slide + its actions (feed + viewer)
js/viewer.js          full-screen viewer    js/account.js  auth, profile, credits, sync
js/items.js           per-wallpaper actions (favorite, share, public, delete…)
js/cloud.js           Supabase (SDK is imported lazily, only when needed)
js/plasma.js          generation loader   js/config.js  genres, styles, formats, models
netlify/functions/generate.js   Pixazo proxy with a per-model adapter registry
sw.js                 network-first service worker
```

## Adding an image model

1. Add an adapter to `MODELS` in `netlify/functions/generate.js` (`url`, `body()`, `extract()`).
   Field names differ per Pixazo model (`num_steps`, `negativePrompt` vs `negative_prompt`, …) —
   copy them from the model's page on Pixazo or a real call, don't guess.
2. Add the model to `MODELS` in `js/config.js` so it shows up in **Create → Tune → Model**.

## Environment

`PIXAZO_API_KEY` (and optionally `PIXAZO_API_KEY_2` … `_10`, tried in order) in Netlify.

## Notes

- The generate endpoint is public; credits are enforced client-side only.
- Keys: `1` `2` `3` switch screens · `R` surprise · `⌘/Ctrl+Enter` create · `↑` `↓` browse.
