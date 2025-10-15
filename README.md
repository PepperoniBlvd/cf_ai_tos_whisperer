# ToS Whisperer — “What Does This Mean for Me?”

Paste a Terms of Service URL or text, set your personal risk sliders (privacy, auto-renewals, arbitration). The app highlights clauses that conflict with your preferences and proposes questions to ask the vendor. It stores your preferences and prior ToS snapshots to detect changes later.

Live demo: https://cf_ai_tos_whisperer.zhenao-li.workers.dev

This repo is built with the following components:
- LLM: Workers AI (`@cf/meta/llama-3.1-8b-instruct`) for clause tagging and summaries
- Coordination: Cloudflare Worker orchestrates fetch → chunk → tag → compare → summarize
- User input: React frontend (Pages-compatible) with URL/text input and sliders
- Memory: Durable Object stores user preferences and ToS snapshots per user

## Architecture

- Worker API (`src/worker.js`)
  - Routes
    - `GET /api/profile` returns saved slider values
    - `POST /api/profile` updates preferences
    - `POST /api/analyze` accepts `{ tosUrl?, tosText?, prefs? }`, runs LLM clause tagging, compares with preferences, returns highlights and a vendor-facing summary
    - `POST /api/diff` accepts `{ tosUrl }` to compute changes vs last snapshot
  - Binds to Workers AI (`env.AI`) and Durable Object (`USER_STATE`)
- Durable Object `UserState`
  - Keys
    - `profile` → `{ privacy, autoRenewals, arbitration }`
    - `snap:<url>` → `{ ts, hash, text, clauses, summary }`
- Frontend (React, no bundler; esm modules via CDN)
  - Served from `public/` via Wrangler `[assets]`
  - Uses `react-markdown` to render the LLM summary
  - Files: `public/index.html`, `public/js/*`, `public/styles/*`

Project structure

```
public/
  index.html
  styles/
    base.css
    layout.css
    components.css
  js/
    lib/react.js          # ESM imports for React/DOM/react-markdown
    api.js                # Thin client for /api/*
    components/
      Controls.js         # Inputs + sliders
      Results.js          # Highlights + Summary (Markdown)
    App.js                # App state + composition
    main.js               # createRoot + render(App)
src/
  worker.js               # API, Durable Object, Workers AI integration
public/
PROMPTS.md                # AI prompts used
wrangler.toml             # Worker config, assets, DO bindings
```

## Quick Start

Prerequisites:

- Node.js 20+
- `wrangler` v3+ (`npm i -g wrangler`)
- A Cloudflare account with Workers AI enabled in your account

Configure and run locally:

1. Install Wrangler if needed:
   - `npm i -g wrangler`
2. Update `wrangler.toml` as needed:
   - `name` is already set to `cf_ai_tos_whisperer` (required prefix)
   - Replace the sample `routes` block or remove it for local dev. For Pages, you can deploy without routes.
3. Login and create the Durable Object migration (first time only):
   - `wrangler login`
   - `wrangler deploy --dry-run` (to confirm config)
   - `wrangler deploy` (applies migration `v1` for `UserState`)
4. Run locally:
   - `wrangler dev --remote`
   - Open `http://localhost:8787`

Production deploy (Worker):

- `wrangler deploy`
- Your Worker URL will be shown (e.g., `https://cf_ai_tos_whisperer.<your-subdomain>.workers.dev`).

Workers AI binding:

- `wrangler.toml` includes:
  ```toml
  [ai]
  binding = "AI"
  ```
  No extra secrets are needed; the binding is available to all Workers in your account when Workers AI is enabled.

## API Examples

- Save profile
  - `POST /api/profile` JSON `{ "privacy": 70, "autoRenewals": 30, "arbitration": 20 }`
- Analyze text
  - `POST /api/analyze` JSON `{ "tosText": "... full ToS text ..." }`
- Analyze URL
  - `POST /api/analyze` JSON `{ "tosUrl": "https://example.com/terms" }`
- Diff against last snapshot
  - `POST /api/diff` JSON `{ "tosUrl": "https://example.com/terms" }`

## Try It (What to click)

- Open the live demo (link above)
- Paste a ToS URL or some text
- Adjust risk sliders and click “Analyze ToS”
- Review “Highlights” (top risky clauses) and the Markdown “Summary”
- Click “Save Preferences” to persist your sliders to the Durable Object

## Notes & Limitations

- HTML extraction is simplistic; for complex pages you may want Readability or a boilerplate removal library. The MVP strips tags and scripts/styles.
- Clause tagging uses an 8B model for speed. Swap to `@cf/meta/llama-3.3-70b-instruct` for higher quality.
- Workers AI JSON output may contain leading text; the Worker attempts to parse the first JSON object in the response.
- Voice dictation button is present as a placeholder (browser Web Speech API where supported; not essential for MVP).

## Scripts

```
npm run dev           # wrangler dev (Worker + assets)
npm run deploy        # wrangler deploy (applies DO migration if needed)
npm run pages:dev     # Pages preview for public/
npm run pages:deploy  # Pages deploy for public/
```
