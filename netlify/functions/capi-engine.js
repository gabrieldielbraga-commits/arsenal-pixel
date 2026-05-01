const crypto = require('crypto');
const API_VERSION = process.env.META_API_VERSION || 'v22.0';
const PIXEL_ID    = process.env.PIXEL_ID_1;
const CAPI_TOKEN  = process.env.ACCESS_TOKEN_1;
const TEST_CODE   = process.env.META_TEST_EVENT_CODE || null;

// ── Hash SHA-256 ──────────────────────────────────────────────────────────────
const sha256 = (v) => {
  if (!v && v !== 0) return undefined;
  return crypto.createHash('sha256').update(String(v)).digest('hex');
};

// ── Normalizadores ────────────────────────────────────────────────────────────
const normalizeEmail   = (e) => e?.trim().toLowerCase();
const normalizePhone   = (p) => {
  if (!p) return null;
  let d = p.replace(/\D/g,'');
  if (d.length === 11 || d.length === 10) d = '55' + d;
  return d;
};
const normalizeName    = (n) => n?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normalizeState   = (s) => s?.trim().toLowerCase().slice(0,2);
const normalizeCountry = (c) => (c||'br').trim().toLowerCase();
const normalizeCity    = (c) => c?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'');

// ── Monta user_data ───────────────────────────────────────────────────────────
function buildUserData({ email, phone, fn, ln, city, state, country,
                          external_id, fbp, fbc, ip, ua }) {
  const ud = {};
  if (email)       ud.em          = [sha256(normalizeEmail(email))].filter(Boolean);
  if (phone)       ud.ph          = [sha256(normalizePhone(phone))].filter(Boolean);
  if (fn)          ud.fn          = [sha256(normalizeName(fn))].filter(Boolean);
  if (ln)          ud.ln          = [sha256(normalizeName(ln))].filter(Boolean);
  if (city)        ud.ct          = [sha256(normalizeCity(city))].filter(Boolean);
  if (state)       ud.st          = [sha256(normalizeState(state))].filter(Boolean);
  if (country)     ud.country     = [sha256(normalizeCountry(country))].filter(Boolean);
  if (external_id) ud.external_id = [sha256(String(external_id))].filter(Boolean);
  // NUNCA hashear estes:
  if (fbp) ud.fbp = fbp;
  if (fbc) ud.fbc = fbc;
  if (ip)  ud.client_ip_address = ip;
  if (ua)  ud.client_user_agent = ua;
  return ud;
}

// ── Geolocalização por IP ─────────────────────────────────────────────────────
const geoCache = {};
async function getGeo(ip) {
  if (!ip || ip==='127.0.0.1' || ip.startsWith('192.168') || ip.startsWith('10.')) return null;
  if (geoCache[ip]) return geoCache[ip];
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return null;
    const d = await r.json();
    const geo = { city: d.city||null, state: d.region_code||null, country: d.country||null };
    geoCache[ip] = geo;
    return geo;
  } catch(e) { return null; }
}

// ── Envio para Meta CAPI ──────────────────────────────────────────────────────
async function sendToMeta(pixelId, accessToken, eventData) {
  const {
    event_name, event_id, event_time, event_source_url,
    fbp, fbc, external_id, ip, ua,
    email, phone, fn, ln, city, state, country,
    custom_data
  } = eventData;

  // Tenta geolocalização se não veio
  let geo = { city, state, country };
  if (!city && !state && ip) {
    const g = await getGeo(ip);
    if (g) geo = g;
  }

  const userData = buildUserData({
    email, phone, fn, ln,
    city: geo.city, state: geo.state, country: geo.country,
    external_id, fbp, fbc, ip, ua
  });

  const payload = {
    data: [{
      event_name,
      event_time:       event_time || Math.floor(Date.now()/1000),
      event_id:         event_id || undefined,
      event_source_url: event_source_url || null,
      action_source:    'website',
      user_data:        userData,
      custom_data:      custom_data || {},
    }],
  };

  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  const url = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!res.ok || json.error) console.error('[Meta CAPI error]', JSON.stringify(json));
  else console.log('[Meta CAPI]', event_name, '→ received:', json.events_received);
  return json;
}

module.exports = { sendToMeta, buildUserData, sha256, getGeo };
