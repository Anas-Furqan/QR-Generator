# Static QR Generator

A small, ad-free QR code generator that runs entirely in your browser.

## Why this exists

Many "free" QR websites make **dynamic** QR codes. The QR doesn't contain your link. It contains a link to *their* redirect server, which then forwards people to you. That lets them add ad pages, tracking, or paywalls later, and the QR breaks if they shut down.

This tool makes **static** QR codes only:

- The QR encodes **exactly** the link you type. Nothing is added or wrapped.
- Generation happens **client-side** with the [`qrcode`](https://www.npmjs.com/package/qrcode) library. There's no backend, no API calls, and no database, so your link never leaves your device.
- No ads, popups, cookie banners, or analytics.

You can confirm a QR is static: scan it and check that the link shown is your own URL, not some `qr-xyz.com/abc` short link.

## Features

- Paste a link and press **Generate** (or Enter)
- `https://` is added automatically if you leave it off (e.g. `forms.gle/abc`)
- Shows the exact encoded link under the QR so you can verify it
- Download as **PNG** (always at least 1024 px, with a quiet-zone margin for print) or **SVG**
- Settings: size (256 / 512 / 1024 px), foreground/background colors, error correction level (L / M / Q / H)
- Responsive layout with light and dark mode

## Run locally

Requires [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

To build and preview the production version:

```bash
npm run build
npm run preview
```

## Deploy to Vercel

No configuration file is needed. Vercel detects Vite automatically.

1. **Push this project to GitHub** (create a new repo and push your code).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, and click **Add New… → Project**.
3. Find your repository in the list and click **Import**.
4. Vercel should pre-fill these settings (leave them as they are):
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Click **Deploy**. After about a minute you'll get a live URL like `your-project.vercel.app`.

Every later `git push` to the main branch redeploys automatically.

## Project structure

```
├── index.html        # Page markup
├── src/
│   ├── main.js       # Input validation, QR generation, downloads
│   └── style.css     # Layout, responsive rules, light/dark theme
├── public/
│   └── favicon.svg
└── package.json      # Pinned dependency versions
```
