# SOTA Model Atlas

Three visualizations tracking frontier language models, 2023–2026.

- **`index.html`** — Landing page linking to all three charts.
- **`01-context-vs-params.html`** — Interactive scatter plot with timeline scrubber.
- **`02-params-over-time.html`** — Static chart: parameter scaling over time.
- **`03-context-over-time.html`** — Static chart: context window growth over time.

Each HTML file is self-contained — React and Babel load from CDN at runtime, so no build step is required. Open any of them directly in a browser to view, or deploy to any static host.

---

## Deploying to GitHub Pages

### Option A: New repository (fastest)

1. Create a new repo on GitHub, e.g. `sota-model-atlas`. Set it **public** — GitHub Pages on free accounts requires public repos.
2. On your local machine:
   ```bash
   git init
   git add index.html 01-context-vs-params.html 02-params-over-time.html 03-context-over-time.html README.md
   git commit -m "Initial commit: SOTA model visualizations"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/sota-model-atlas.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Pages** (left sidebar).
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
5. Under **Branch**, select `main` and folder `/ (root)`. Click **Save**.
6. Wait 30–90 seconds. The site will be live at:
   ```
   https://YOUR-USERNAME.github.io/sota-model-atlas/
   ```

### Option B: Add to an existing repo

Drop the four HTML files into a subdirectory (e.g. `docs/` or `sota-atlas/`) of an existing repo, commit, and push. In **Settings → Pages**, point the source at the folder you chose. URL will be `https://YOUR-USERNAME.github.io/REPO-NAME/sota-atlas/`.

### Option C: No-Git upload via the web UI

1. On GitHub, **Add file → Upload files** directly from the repo page.
2. Drag in all four HTML files. Commit.
3. Enable Pages as above.

---

## Editing the data

The model lists are inline JavaScript arrays at the top of each HTML file — look for `const MODELS = [...]`. Add a row, save, refresh. No build step, no dependencies to reinstall.

Provider colors are in `const PROVIDER_COLORS = {...}` — adding a new provider is one line.

---

## Performance note

Loading Babel Standalone in the browser adds a few hundred KB and does a compile pass on page load. Fine for an internal atlas or a slide appendix; if you're planning to share with a wider audience or you want faster first paint, convert to a Vite build:

```bash
npm create vite@latest sota-atlas -- --template react
# copy the JSX from the original files in this thread into src/App.jsx
npm install && npm run build
# deploy the `dist/` folder
```

The JSX files that were the source of these HTMLs are also worth keeping in the repo for that future migration.
