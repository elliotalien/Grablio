# Contributing to Grablio

Thanks for wanting to improve Grablio. It is a small, dependency-light extension, so the process stays simple: no build step, no package manager, just files you can load straight into a Chromium browser.

## Ways to help

- **Report a bug** — open an issue with the page URL if it is public, your browser and version, and the status message Grablio showed.
- **Request a feature** — describe the problem you are trying to solve, not only the UI you have in mind.
- **Improve the docs** — README wording, troubleshooting entries and screenshots are all welcome.
- **Send a fix** — see the workflow below.

## Development setup

1. Clone the repository:

   ```bash
   git clone https://github.com/elliotalien/Grablio.git
   cd Grablio
   ```

2. Open `chrome://extensions/` (or `edge://extensions/`) and enable **Developer mode**.
3. Click **Load unpacked** and select the repository root.
4. After editing `popup/*` or `scripts/content.js`, press the reload icon on the Grablio card, then refresh any open tabs so the new content script is injected.

There is no compiler and no test runner. Testing means loading the extension and exercising the change against real pages.

## Project layout

| Path | Purpose |
|---|---|
| `manifest.json` | Manifest V3 definition, permissions and entry points |
| `popup/index.html` | Popup markup |
| `popup/index.css` | Design system, six themes and layout |
| `popup/index.js` | Scan, selection, ZIP packaging and download flow |
| `scripts/content.js` | Page scanner, injected on demand |
| `lib/jszip.min.js` | Bundled JSZip build — do not edit by hand |

## Code guidelines

- Plain JavaScript, no frameworks and no build tooling. Keep it that way unless a dependency is clearly justified.
- All processing stays local. Do not add analytics, telemetry, remote scripts, or any request that is not fetching an image the user asked for.
- Match the surrounding style: two-space indentation, `const`/`let`, small named functions, and comments only where the reason is not obvious.
- Ask for the narrowest permissions possible. A new permission needs a clear explanation in the pull request.
- When something fails, surface it to the user. Silent failures and empty ZIPs are treated as bugs.

## Pull requests

1. Branch from `main` and give the branch a descriptive name, for example `fix/lazy-image-dedup` or `docs/store-listing`.
2. Keep one logical change per pull request.
3. Write a commit message that explains the *why*, for example `fix: keep srcset variants distinct when deduplicating`.
4. In the pull request description, note what you tested: browser, version, the site or page type you used, and the before/after behaviour.
5. Link the issue the change closes, if there is one.

Small, focused pull requests get reviewed fastest. If you are planning something large — a new scanner strategy, a redesigned popup, a new manifest permission — open an issue first so we can agree on the approach before you write it.

## Reporting security issues

Do not open a public issue for a vulnerability. Email the maintainer address listed on the GitHub profile instead, and give enough detail to reproduce the problem.

## License

By contributing, you agree that your changes are released under the [MIT License](LICENSE).
