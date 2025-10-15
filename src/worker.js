// Cloudflare Worker: ToS Whisperer (LLM + Durable Object memory)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API routes only; static assets are served via Wrangler [assets]
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx);
    }
    return new Response('Not found', { status: 404 });
  },
};

async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  const { USER_STATE } = env;

  // identify user via cookie; create if missing
  const idCookie = getOrSetUserCookie(request);
  const id = idCookie.value;
  const idResponseHeaders = idCookie.setHeader ? { 'set-cookie': idCookie.setHeader } : {};

  const stub = USER_STATE.get(USER_STATE.idFromName(id));

  if (url.pathname === '/api/profile' && method === 'GET') {
    const res = await stub.fetch('https://do/profile');
    return withHeaders(res, idResponseHeaders);
  }

  if (url.pathname === '/api/profile' && method === 'POST') {
    const body = await request.json();
    const res = await stub.fetch('https://do/profile', { method: 'PUT', body: JSON.stringify(body) });
    return withHeaders(res, idResponseHeaders);
  }

  if (url.pathname === '/api/analyze' && method === 'POST') {
    console.log('[analyze] start');
    const body = await request.json();
    const { tosUrl, tosText, prefs } = body || {};

    const text = tosText || (tosUrl ? await fetchToSText(tosUrl) : null);
    if (!text) {
      console.warn('[analyze] missing text');
      return withHeaders(json({ error: 'Provide tosUrl or tosText' }, 400), idResponseHeaders);
    }

    // Persist preferences if provided
    if (prefs) await stub.fetch('https://do/profile', { method: 'PUT', body: JSON.stringify(prefs) });
    const profileRes = await stub.fetch('https://do/profile');
    const profile = await profileRes.json();

    // Chunk text
    let chunks = chunkText(text, 1800);
    const MAX_CHUNKS = 8;
    if (chunks.length > MAX_CHUNKS) chunks = chunks.slice(0, MAX_CHUNKS);
    console.log('[analyze] textLen=%d chunks=%d', text.length, chunks.length);

    // Tag clauses per chunk
    let allClauses = [];
    for (let i=0;i<chunks.length;i++) {
      const tags = await tagClauses(env, chunks[i]);
      const n = (tags && Array.isArray(tags.clauses)) ? tags.clauses.length : 0;
      console.log('[analyze] chunk %d -> %d clauses', i, n);
      if (n) allClauses.push(...tags.clauses);
    }

    // Compare with preferences
    const comparison = compareClauses(allClauses, profile);

    // Summarize highlights
    const summary = await summarizeFindings(env, text, comparison);
    console.log('[analyze] clauses=%d top=%d summaryLen=%d', allClauses.length, (comparison.top||[]).length, (summary||'').length);

    // Save snapshot if URL provided
    if (tosUrl) {
      await stub.fetch('https://do/snapshot', {
        method: 'PUT',
        body: JSON.stringify({ url: tosUrl, text, clauses: allClauses, summary }),
      });
    }

    return withHeaders(json({ clauses: allClauses, comparison, summary }), idResponseHeaders);
  }

  if (url.pathname === '/api/diff' && method === 'POST') {
    const { tosUrl } = await request.json();
    if (!tosUrl) return withHeaders(json({ error: 'tosUrl required' }, 400), idResponseHeaders);
    const text = await fetchToSText(tosUrl);
    const chunks = chunkText(text, 1800);
    let allClauses = [];
    for (const chunk of chunks) {
      const tags = await tagClauses(env, chunk);
      if (tags && Array.isArray(tags.clauses)) allClauses.push(...tags.clauses);
    }
    const res = await stub.fetch('https://do/snapshot?url=' + encodeURIComponent(tosUrl));
    const prev = res.status === 200 ? await res.json() : null;
    const diff = buildDiff(prev, { text, clauses: allClauses });
    // Save new snapshot
    await stub.fetch('https://do/snapshot', { method: 'PUT', body: JSON.stringify({ url: tosUrl, text, clauses: allClauses }) });
    return withHeaders(json({ diff }), idResponseHeaders);
  }

  return new Response('Not found', { status: 404 });
}

// ----- Durable Object -----
export class UserState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/profile') {
      if (request.method === 'PUT') {
        const prefs = await request.json();
        await this.state.storage.put('profile', sanitizePrefs(prefs));
        return json({ ok: true });
      }
      const profile = (await this.state.storage.get('profile')) || defaultPrefs();
      return json(profile);
    }
    if (url.pathname === '/snapshot') {
      if (request.method === 'PUT') {
        const { url: siteUrl, text, clauses, summary } = await request.json();
        if (!siteUrl) return json({ error: 'url required' }, 400);
        await this.state.storage.put(`snap:${siteUrl}`, { ts: Date.now(), hash: hashText(text), text, clauses, summary });
        return json({ ok: true });
      }
      const q = url.searchParams.get('url');
      if (!q) return json({ error: 'url required' }, 400);
      const data = await this.state.storage.get(`snap:${q}`);
      if (!data) return json({ error: 'not found' }, 404);
      return json(data);
    }
    return new Response('Not found', { status: 404 });
  }
}

// ----- Helpers -----
function withHeaders(res, headers) {
  const newHeaders = new Headers(res.headers);
  for (const [k, v] of Object.entries(headers || {})) newHeaders.set(k, v);
  return new Response(res.body, { status: res.status, headers: newHeaders });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

function defaultPrefs() {
  return {
    privacy: 70, // tolerance for data sharing/collection
    autoRenewals: 30, // tolerance for auto-renewals
    arbitration: 20, // tolerance for mandatory arbitration
  };
}

function sanitizePrefs(p) {
  const d = defaultPrefs();
  return {
    privacy: clampInt(p?.privacy ?? d.privacy, 0, 100),
    autoRenewals: clampInt(p?.autoRenewals ?? d.autoRenewals, 0, 100),
    arbitration: clampInt(p?.arbitration ?? d.arbitration, 0, 100),
  };
}

function clampInt(n, min, max) {
  n = Number.isFinite(+n) ? Math.round(+n) : min;
  return Math.max(min, Math.min(max, n));
}

function getOrSetUserCookie(request) {
  const cookie = request.headers.get('cookie') || '';
  const m = /tw_uid=([^;]+)/.exec(cookie);
  if (m) return { value: m[1] };
  const uid = crypto.randomUUID();
  const setHeader = `tw_uid=${uid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  return { value: uid, setHeader };
}

async function fetchToSText(tosUrl) {
  try {
    const r = await fetch(tosUrl);
    const ct = r.headers.get('content-type') || '';
    let txt = await r.text();
    if (ct.includes('text/html')) {
      // naive HTML to text: strip tags
      txt = txt.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    }
    return txt.replace(/\s+/g, ' ').trim();
  } catch (e) {
    return null;
  }
}

function chunkText(text, maxChars) {
  const parts = [];
  let buf = '';
  const paras = text.split(/\n{2,}|(?<=\.)\s+/g);
  for (const p of paras) {
    if ((buf + ' ' + p).length > maxChars) {
      if (buf) parts.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + ' ' + p : p;
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

async function tagClauses(env, text) {
  if (!env.AI) return mockTagClauses(text);
  const system = `You identify and label Terms of Service clauses. Return concise JSON only with the shape: { "clauses": [{"title": string, "tag": one of ["privacy_data","auto_renewal","arbitration","unilateral_changes","termination","liability","payment","jurisdiction","other"], "severity": 0-100, "snippet": string }] }. Severity is risk from user perspective.`;
  const user = `Text:\n${text}\n\nExtract and label clauses as specified.`;
  try {
    const resp = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    });
    const content = resp?.response || resp?.output || '';
    const obj = parseFirstJsonObject(content);
    return obj || { clauses: [] };
  } catch (e) {
    console.error('[tagClauses] error', e);
    return { clauses: [] };
  }
}

function compareClauses(clauses, prefs) {
  const weights = {
    privacy_data: 100 - (prefs.privacy ?? 70),
    auto_renewal: 100 - (prefs.autoRenewals ?? 30),
    arbitration: 100 - (prefs.arbitration ?? 20),
  };
  const scored = clauses.map(c => {
    const w = weights[c.tag] ?? 50;
    const score = Math.round((c.severity ?? 50) * (w / 100));
    return { ...c, riskScore: score };
  });
  const top = [...scored].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
  return { top, counts: countByTag(scored) };
}

function countByTag(items) {
  const m = {};
  for (const it of items) m[it.tag] = (m[it.tag] || 0) + 1;
  return m;
}

async function summarizeFindings(env, fullText, comparison) {
  if (!env.AI) return mockSummary(comparison);
  const bullets = comparison.top.map(c => `- [${c.tag}] ${c.title}: ${c.snippet}`).join('\n');
  const prompt = `User risk highlights based on preferences. Produce: short summary, key risks, and 3 questions to ask the vendor.\n\nFindings:\n${bullets}`;
  try {
    const resp = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You write crisp consumer-facing summaries.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    });
    return resp?.response || '';
  } catch (e) {
    console.error('[summarize] error', e);
    return '';
  }
}

function parseFirstJsonObject(s) {
  if (!s) return null;
  // strip code fences if present
  s = s.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/m, '$1');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const chunk = s.slice(start, i + 1);
        try { return JSON.parse(chunk); } catch {}
      }
    }
  }
  try { return JSON.parse(s.slice(start)); } catch { return null; }
}

// Local mock AI for --local dev
function mockTagClauses(text) {
  const clauses = [];
  const lower = text.toLowerCase();
  if (/(collect|share).*(data|information)/.test(lower)) clauses.push({ title: 'Data collection', tag: 'privacy_data', severity: 70, snippet: sampleSnippet(text, 80) });
  if (/(auto[- ]?renew|renewal)/.test(lower)) clauses.push({ title: 'Auto-renewal', tag: 'auto_renewal', severity: 60, snippet: sampleSnippet(text, 80) });
  if (/(arbitration|binding arbitration)/.test(lower)) clauses.push({ title: 'Binding arbitration', tag: 'arbitration', severity: 80, snippet: sampleSnippet(text, 80) });
  if (clauses.length === 0) clauses.push({ title: 'General terms', tag: 'other', severity: 30, snippet: sampleSnippet(text, 80) });
  return { clauses };
}

function mockSummary(comparison) {
  const top = comparison.top || [];
  const bullets = top.map(c => `- [${c.tag}] ${c.title} (risk ${c.riskScore})`).join('\n');
  return `Summary: Based on your preferences, we highlighted the clauses with the highest risk.\n\nKey risks:\n${bullets}\n\nQuestions to ask:\n1) Can I opt out of data sharing?\n2) How do I disable auto-renewal?\n3) Is there an option to resolve disputes in small claims court instead of arbitration?`;
}

function sampleSnippet(text, max) {
  const s = text.trim().slice(0, max);
  return s + (text.length > max ? '…' : '');
}

function hashText(s) {
  // Non-cryptographic simple hash for snapshot identity
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

function buildDiff(prev, curr) {
  if (!prev) return { changed: true, prev: null, currHash: hashText(curr.text), addedClauses: curr.clauses.length };
  const changed = prev.hash !== hashText(curr.text);
  const prevTags = new Set((prev.clauses || []).map(c => `${c.tag}|${(c.title || '').slice(0, 60)}`));
  const added = (curr.clauses || []).filter(c => !prevTags.has(`${c.tag}|${(c.title || '').slice(0, 60)}`));
  return { changed, prevHash: prev.hash, currHash: hashText(curr.text), addedClauses: added.length };
}

// UI removed; static assets in /public
