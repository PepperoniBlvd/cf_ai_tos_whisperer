const API_BASE = (location.hostname.endsWith('.workers.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? ''
  : 'https://cf_ai_tos_whisperer.zhenao-li.workers.dev';

export async function getProfile() {
  const r = await fetch(API_BASE + '/api/profile');
  if (!r.ok) throw new Error('Failed to load profile');
  return r.json();
}

export async function saveProfile(p) {
  const r = await fetch(API_BASE + '/api/profile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error('Failed to save profile');
}

export async function analyze({ tosUrl, tosText, prefs }) {
  const r = await fetch(API_BASE + '/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tosUrl: tosUrl || undefined, tosText: tosText || undefined, prefs }),
  });
  if (!r.ok) throw new Error('Analyze failed');
  return r.json();
}
