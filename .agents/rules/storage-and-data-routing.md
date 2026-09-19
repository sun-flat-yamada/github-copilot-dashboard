# 📦 Data Storage & Public Routing Rules for AI Agents

All AI agents working on `github-copilot-dashboard` must understand the architectural distinction between persistent storage and public web distribution to prevent 404 routing bugs.

---

## 1. Persistent Storage vs. Public SPA Serving Paths

- **Persistent Branch (`copilot-data`)**:
  - Saved via `ForkSafeStorage`.
  - Raw inputs live under `data/raw/` (or `data/demo/raw/`).
  - Aggregated scopes MUST live under `data/processed/{scope}/` (or `data/demo/processed/{scope}/`).
  - Metadatas (`index.json`, `error-log.json`) live directly in the data root.
- **Web SPA Distribution (`dashboard/public/data/` and `dist/data/`)**:
  - The frontend fetches from the root of the distribution directory: `${baseDir}/${scope}/${file}`.
  - Therefore, during CI packaging, **both the root metadata AND the unnested `processed/*` files** must be deployed.

---

## 2. CI/CD Staging Mandate (`copilot-analysis-cron.yml`)

When staging `data/demo` into `dashboard/public/data/demo` before `npm run build`:
```bash
mkdir -p dashboard/public/data/demo
# 1. Root metadata
cp -r data/demo/* dashboard/public/data/demo/
# 2. Flatten processed/ to root for direct SPA access
if [ -d "data/demo/processed" ]; then
  cp -r data/demo/processed/* dashboard/public/data/demo/
fi
```
Failure to stage `data/demo/processed/*` directly into the public root will break live demo viewing on GitHub Pages.

---

## 3. Client-Side Multi-Tier Fallback Protocol (`pathResolver.ts`)

Any client-side fetch logic that retrieves data files from `./data` or `./data/demo` MUST:
1. **Use `resolveDataPath`**:
   - Never use raw string concatenation like `./data/foo.json` without normalization.
   - `resolveDataPath` automatically adapts to `window.location.pathname` so accessing without trailing slash (e.g. `https://<owner>.github.io/<repo>`) will not drop the repository prefix.
2. **Use Multi-Tier Candidate Generation (`getCandidateDataUrls`)**:
   - Must attempt candidates in order:
     1. Direct root path: `data/demo/{subDir}/{file}`
     2. Processed storage path: `data/demo/processed/{subDir}/{file}`
     3. Alternate mode path: `data/{subDir}/{file}`
     4. Alternate mode processed path: `data/processed/{subDir}/{file}`
3. **Use `fetchDataWithFallback`**:
   - Sequentially tests candidates until a 200 OK is received before propagating errors.
