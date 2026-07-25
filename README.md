# Wallie — wallpaper generator

Generates original phone wallpapers in the aesthetic of the `REF/` image collection using the Gemini image API, sized exactly for your iPhone or Pixel. Hard rule baked into every prompt: **no text ever appears in the artwork**.

**Live app:** https://wallie-generator.vercel.app
**Repo:** https://github.com/bitditnasudo/Wallie-Generator

Sibling project of the [Icon Generator](https://icongenerator-one.vercel.app) — same architecture: fully static app, the browser calls the Gemini API directly, no backend.

## Usage

Open the app (or run it locally), paste your Gemini API key once (stored only in your browser, sent only to Google), then:

1. **Pick a style** — each subfolder of `REF/` is a style (currently **Bauhaus**, **Dream Blob**, **Organic Shape**). Every generation anchors on ONE randomly-chosen primary reference from the folder: the wallpaper follows that reference's structural motif, and the other references contribute palette and finish only — so distinct motifs never get merged into one image.
2. **Pick your phone** — iPhone (SE → 17 Pro Max / Air) or Pixel (6 → 10 Pro XL), or a custom size. The output is generated at the closest Gemini aspect ratio (9:16 for all current phones) and center-cropped client-side to the exact native resolution.
3. **Generate** — up to 6 random references from the chosen style are sent with a style-transfer prompt. Preview it with the lock-screen clock overlay, then hit **⬇ Save wallpaper**: on a phone it opens the native share sheet (save straight to Photos), on desktop it downloads the device-sized PNG. "Raw output" downloads the uncropped model output. Switching phones after generating re-crops instantly without a new API call.
4. **Rate it** — 👍 saves the wallpaper into the style's `REF/` folder, making it part of that style's reference pool for future generations (running locally; the deployed site downloads the file instead so you can drop it into the folder yourself). 👎 discards the result.

- **Model**: `gemini-2.5-flash-image` (Nano Banana) by default, `gemini-3-pro-image-preview` (2K output) selectable.

## Adding reference images / styles

1. Drop new images into the matching style subfolder of `REF/` (e.g. `REF/Bauhaus/`). To create a whole new style, just make a new folder — the folder name becomes the style's name in the app.
2. Run `npm run build:refs` — converts `REF/` originals to 768px WebP in `public/refs/` and regenerates `public/refs.json`.
3. Optional but recommended: `categories.json` holds each folder's prompt text (tagline + style description). New folders without an entry still work; ask Claude to look at the images and write the entry for stronger results.

## Local development

```
npm install        # once, for sharp (only needed by build:refs)
node server.js     # serves the app at http://localhost:3001
```

Locally, the API key is auto-loaded from `.env` (`GEMINI_API_KEY=...`). `launch.bat` starts the server and opens the browser.

## Deploy

Pushes to `master` auto-deploy to Vercel (project `wallie-generator`). Manual deploy: `vercel --prod`. Remember to run `npm run build:refs` (or just start the local server once) before pushing if you changed `REF/`, so the committed `public/refs` is current.
