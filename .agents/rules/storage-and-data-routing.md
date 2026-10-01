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

**Real data is staged with the allow-list script, not with `cp -r`**:
```bash
npm run pages:stage    # before `npm run build`: copies index.json, error-log.json, ALL processed/* months, and the daily files named in index.json
npm run pages:verify   # after `npm run build`: every staged file must be in dist/data/, and nothing private may be
```
- `scripts/pages-staging.ts` is an **allow-list**. Never add `data/raw/`, original CSVs (`reports/monthly/**`), or `data/config/` (encrypted mapping) to it, and never replace it with a recursive copy of `data/`.
- Staging only the current run's output makes past months 404 on the deployed site. `pages:verify` fails the workflow if a staged month is missing from `dist/data/`.

---

## 3. Client-Side Multi-Tier Fallback Protocol (`pathResolver.ts`)

Any client-side fetch logic that retrieves data files from `./data` or `./data/demo` MUST:
1. **Use `resolveDataPath`**:
   - Never use raw string concatenation like `./data/foo.json` without normalization.
   - `resolveDataPath` automatically adapts to `window.location.pathname` so accessing without trailing slash (e.g. `https://<owner>.github.io/<repo>`) will not drop the repository prefix.
2. **Use Multi-Tier Candidate Generation (`getCandidateDataUrls`)**:
   - Attempts the candidates **of the selected mode only**, in order:
     1. Direct root path: `data/{subDir}/{file}` (or `data/demo/{subDir}/{file}` in DEMO mode)
     2. Processed storage path: `data/processed/{subDir}/{file}` (or `data/demo/processed/...`)
   - The alternate mode's paths (LIVE <=> DEMO) are added only with the explicit opt-in `includeAlternateMode: true`. **Never** use it to paper over a missing live file: a 404 for real data must surface as an error / "no live data" state, not as demo data presented as real.
3. **Use `fetchDataWithFallback`**:
   - Sequentially tests candidates until a 200 OK is received before propagating errors.
4. **Demo data is explicit-only**:
   - Treat data as demo only when the user selected it (`?demo=true`, the DEMO toggle, the "デモデータを表示" button), it lives under `/demo/`, or its `index.json` has `is_mock_mode: true` (`isMockModeData`). Never infer demo from the owner name, a zero seat count or an empty history.
   - `is_mock_mode` is produced only by `MOCK_MODE`; a failed or unconfigured live source must not set it (SDD-05 §3.0).
