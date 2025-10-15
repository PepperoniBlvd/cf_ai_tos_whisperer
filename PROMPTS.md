# AI Prompts Used

This file contains a set of prompts used in AI assisted coding


---

## 00 — Repository Requirements
```
You are building a Cloudflare AI hackathon project. Requirements:
- LLM: use Workers AI (Llama 3 family) for clause tagging + summarization
- Coordination: build a Worker that orchestrates fetch → chunk → tag → compare → summarize
- Input: web UI with ToS URL/text and risk sliders
- Memory: Durable Object storing preferences and ToS snapshots
- Repo must include: `README.md` with run/deploy instructions and `PROMPTS.md` with prompts used
- Project name must start with `cf_ai_`

Deliverables:
- Cloudflare Worker in `src/worker.js`
- Durable Object class `UserState` bound as `USER_STATE`
- `wrangler.toml` with `[ai]`, `[durable_objects]`, migrations, and `[assets]` pointing to `public/`
- React frontend under `public/`, modular structure in `public/js` and `public/styles`
- `README.md` and `PROMPTS.md`
```

---

## 01 — Architecture + Plan
```
Act as a lead engineer. Produce a concise plan and file tree for:
- Worker API: `/api/profile` (GET/POST), `/api/analyze` (POST), `/api/diff` (POST)
- Durable Object for per‑user state via cookie `tw_uid`
- Workers AI usage for tagging and summarizing
- Frontend (React) served from `public/` with fetches to the Worker
- Pages compatibility: frontend should work on Pages while calling Worker API domain
- Include chunking, naive HTML→text extraction, and resilient JSON parsing of LLM output

Output a final file tree and the sequence you will follow to implement it.
```

---

## 02 — Wrangler Config
```
Create `wrangler.toml` with:
- `name = "cf_ai_tos_whisperer"`
- `main = "src/worker.js"`
- `compatibility_date` recent
- `[ai] binding = "AI"`
- `[durable_objects]` with `USER_STATE` bound to class `UserState`
- `[[migrations]]` using `new_sqlite_classes = ["UserState"]`
- `[assets] directory = "public"`

Ensure no routes are required for local dev. Keep comments minimal.
```

---

## 03 — Worker + Durable Object
```
Create `src/worker.js` implementing:
- fetch router handling only `/api/*`; static assets are served by Wrangler `[assets]`
- Cookie utility: set/read `tw_uid`
- API routes:
  - `GET /api/profile`: return stored prefs `{ privacy, autoRenewals, arbitration }` with defaults if missing
  - `POST /api/profile`: update prefs (clamp to 0–100)
  - `POST /api/analyze`: accept `{ tosUrl?, tosText?, prefs? }`
    - If `tosUrl` present, fetch and convert HTML→text (strip scripts/styles/tags, collapse whitespace)
    - Chunk text (≈1800 chars), cap to 8 chunks
    - For each chunk call Workers AI (Llama 3.x instruct) to extract clauses
    - Compare clauses against prefs to compute `riskScore` by tag weight
    - Summarize top findings with a second model call
    - Persist snapshot if `tosUrl` is present
    - Return `{ clauses, comparison: { top, counts }, summary }`
  - `POST /api/diff`: accept `{ tosUrl }`, fetch current, tag, compare with last snapshot, return simple diff `{ changed, prevHash?, currHash, addedClauses }`, persist new snapshot

- Durable Object `UserState`:
  - Keys: `profile`, `snap:<url>` storing `{ ts, hash, text, clauses, summary }`

- Helpers:
  - `chunkText(text, maxChars)`
  - `fetchToSText(url)`
  - `parseFirstJsonObject(s)` — find first balanced `{…}` and JSON.parse
  - Workers AI calls via `env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages, temperature })`

Return only the code for `src/worker.js`.
```

---

## 04 — Workers AI Prompts
```
System (Tagging):
You identify and label Terms of Service clauses. Return concise JSON only with the shape:
{ "clauses": [{"title": string, "tag": one of ["privacy_data","auto_renewal","arbitration","unilateral_changes","termination","liability","payment","jurisdiction","other"], "severity": 0-100, "snippet": string }] }
Severity is risk from the user’s perspective.

User (Tagging):
Text:
<CHUNK>

Extract and label clauses as specified.

System (Summary):
You write crisp consumer‑facing summaries.

User (Summary):
User risk highlights based on preferences. Produce: short summary, key risks, and 3 questions to ask the vendor.

Findings:
<BULLETED FINDINGS FROM TAGGING>
```

---

## 05 — Frontend
```
Create a React UI served from `public/` with this structure:

- `public/index.html` with a `#root` div and stylesheet links
- `public/styles/base.css` — variables, base, utilities
- `public/styles/layout.css` — header, grid helpers
- `public/styles/components.css` — cards, inputs, buttons, md styles
- `public/js/lib/react.js` — ESM imports for React, ReactDOM (client), and react-markdown via `https://esm.sh/…` using `?deps=react@18`
- `public/js/api.js` — `API_BASE` auto‑detect; functions `getProfile`, `saveProfile`, `analyze`
- `public/js/components/Controls.js` — URL/text inputs, sliders, buttons
- `public/js/components/Results.js` — render Highlights cards and Markdown Summary using react-markdown
- `public/js/App.js` — compose Controls + Results; manage state and API calls
- `public/js/main.js` — bootstrap React `createRoot` and render `<App />`

Constraints:
- Use esm.sh URLs and avoid bare specifiers (e.g., `?deps=react@18` for dependencies)
- Do not introduce a bundler; rely on native ESM
- Keep inline code simple; no JSX
```

---

## 06 — README
```
Write a `README.md` that includes:
- Project overview and live demo link (placeholder acceptable)
- Architecture summary (Worker API + Durable Object + React frontend)
- File structure tree
- Prerequisites (Node 20+, wrangler v3+)
- Local run instructions (wrangler login, deploy, dev --remote)
- Production deploy (Worker + Pages) with commands
- API examples for profile/analyze/diff
- Try‑it guide (what to click)
- Notes & Limitations
- Scripts section for `npm run dev|deploy|pages:dev|pages:deploy`
```

---

## 07 — Verification & Deploy
```
- Run `wrangler deploy` to apply DO migration and deploy the Worker + assets
- Visit the Worker URL
- Paste a short ToS text (e.g., “We collect analytics data and auto‑renew monthly; disputes via binding arbitration.”) and click Analyze
- Verify highlights + markdown summary render
- Optional: `wrangler pages dev public` then `wrangler pages deploy public`
```

---

## 08 — Optional Hardening
```
- Cap chunks to 8 for long ToS
- Guard LLM JSON parsing with `parseFirstJsonObject`
- Add `tw_uid` cookie with HttpOnly + SameSite=Lax
- Ensure `API_BASE` detects Pages vs Worker domain
```

---

