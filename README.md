# Grablio - Download All Images from Any Webpage as ZIP

![Grablio - Bulk Image Downloader Browser Extension](icons/icon128.png)

**Grablio** is a free browser extension for Chrome, Edge, and Brave that lets you **download all images from any webpage** and save them as a single ZIP file. Whether you're collecting reference photos, saving product images, archiving galleries, or bulk-downloading from image-hosting sites, Grablio scans the entire page and bundles every image into one clean ZIP archive.

---

## Why Grablio?

- **One-click bulk download** — no right-clicking each image one by one.
- **ZIP your selection** — pick the images you want, download them in a single `.zip`.
- **Works on any site** — galleries, portfolios, e-commerce, image boards, social media, documentation sites.
- **100% local** — all scanning and zipping happen in your browser. No uploads, no servers, no tracking.

---

## ✨ Features

### Smart Image Detection
Finds every image on the page, including ones the browser hides:
- `<img>` tags and `srcset` high-resolution variants
- `<picture>` element `<source>` sets
- Lazy-loaded images (`data-src`, `data-lazy`, `data-original`, `data-zoom`, `data-high-res`, `data-fallback`)
- CSS `background-image` on any element
- OpenGraph and Schema.org metadata (`og:image`, `link[rel="image_src"]`, `itemprop="image"`)
- Direct image links in `<a href>` ending in `.jpg`, `.png`, `.webp`, `.gif`, `.svg`, `.avif`, `.bmp`, `.ico`, `.tiff`

### All Image Formats Supported
JPG · JPEG · PNG · WebP · GIF · SVG · AVIF · BMP · ICO · TIFF

### Fast ZIP Packaging
Bundles all selected images into a single `.zip` archive using the high-performance **JSZip** library. Concurrency-limited fetching (5 workers) keeps downloads fast without overloading the page.

### Smart Deduplication
Automatically filters duplicate URLs and resolves relative paths so you get clean, unique, high-resolution links.

### Session Mode
Accumulate images across different pages and navigations into a single download list — scan multiple tabs or galleries, then download everything in one ZIP.

### Theming
Six preset themes — **Onyx** (indigo on onyx), **Graphite** (violet on graphite), **Snow** (monochrome on white), **Carbon** (emerald on carbon), **Linen** (rose on warm white), and **Glass** (frosted liquid glass) — plus a custom accent color picker, corner-radius slider, and font selector.

### Reliable Status Reporting
Clear status for every outcome: success, partial failures (`Saved N, M failed`), cancellation (`Download canceled`), or a blocked batch (`All N failed (blocked or CORS)`). No empty ZIPs, no silent failures.

---

## 🚀 Installation

### Option 1 — Load Unpacked (Developer)

1. **Download** the source code (or `git clone` the repository).
2. Open **Chrome**, **Edge**, or **Brave** and navigate to:
   - `chrome://extensions/` (Chrome / Brave)
   - `edge://extensions/` (Edge)
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the root folder of this project.

### Option 2 — From the Chrome Web Store
*(Coming soon — a direct install link will appear here once published.)*

---

## 🛠️ How to Use

1. Navigate to any website containing images you want to download.
2. Click the **Grablio** icon in your browser toolbar.
3. The extension automatically scans the page and shows a preview grid of every detected image.
4. Toggle individual images on/off, or use **Select All** / **Unselect All**.
5. Click **Download as ZIP** and choose where to save the archive.

> **Tip:** Scroll down on a page with lazy-loaded images — Grablio's content script watches for `scroll` events and auto-appends new images to the gallery as they appear.

---

## 🎯 Use Cases

| Scenario | How Grablio Helps |
|---|---|
| **Designer collecting reference** | Scan a Pinterest-style board, select the ones you want, download as one ZIP. |
| **Shop owner saving product photos** | Open a competitor's product listing, bulk-download every product image in seconds. |
| **Archiving an image gallery** | Download an entire gallery / album from any image-hosting site in one click. |
| **Researcher gathering visual data** | Scrape every figure/diagram from a documentation site into a single archive. |
| **Backing up your own portfolio** | Quickly clone all images from a deployed site you own. |
| **Web developer grabbing assets** | Pull every `background-image`, `srcset` variant, and `<picture>` source for a project. |
| **Student collecting images for a project** | Download all images from a research page, filtered and deduplicated. |

---

## 📦 Technical Details

- **Manifest V3** — built on the current Chromium extension standard.
- **Libraries** — [JSZip](https://stuk.github.io/jszip/) for browser-side archival; no other dependencies.
- **Content script** injected on demand (no persistent background worker), versioned for clean re-injection after extension updates.
- **Concurrency** — 5 parallel workers for fast fetching without overwhelming the page.
- **Permissions**:
  - `activeTab` — access the current page only when Grablio is invoked.
  - `scripting` — inject the scanner into the page on demand.
  - `downloads` — trigger the final ZIP download.
  - `storage` — persist your theme, session mode, and scroll position across popup opens.
  - `host_permissions: <all_urls>` — needed to fetch image bytes from any domain for ZIP packaging.
- **Note on CORS**: a few sites serve images without `Access-Control-Allow-Origin` headers or behind hotlink/referer protection. Those specific images may fail to fetch into the ZIP on Chrome/Edge; on Brave, Shields can block cross-origin fetches entirely. Grablio reports the exact outcome (`Saved N, M failed`) so you always know what landed.

---

## 📁 Project Structure

```
Grablio/
├── manifest.json        # MV3 manifest & permissions
├── icons/               # Toolbar & store icons (16 / 48 / 128)
├── lib/
│   └── jszip.min.js     # Bundled JSZip library
├── popup/
│   ├── index.html       # Popup markup
│   ├── index.css        # Design system & themes
│   └── index.js         # Popup logic — scan, select, zip, download
└── scripts/
    └── content.js       # Page scanner (injected on demand)
```

---

## ❓ FAQ

**Is Grablio free?**
Yes — 100% free, open-source, MIT-licensed.

**Does Grablio upload my images anywhere?**
No. Every step (scanning, selecting, zipping, downloading) happens locally in your browser. Grablio never sends a single image to any server.

**Will it work on [specific site]?**
Grablio works on any site that serves standard image elements. On a few sites with aggressive hotlink protection or strict CORS, the ZIP may be partially populated. The status bar tells you exactly how many succeeded.

**Does it work in Brave / Firefox / Safari?**
- ✅ Chrome, Edge, Brave, Opera — fully supported (all Chromium-based).
- ✅ Firefox — works with a small manifest tweak (this repo targets Chromium MV3).

**Can I choose which images to download?**
Yes — every image starts selected, and you can toggle individual thumbnails, or use **Select All** / **Unselect All** for fast bulk selection.

---

## 📄 License

MIT License — feel free to use, modify, and distribute. See [LICENSE](LICENSE) for details.
