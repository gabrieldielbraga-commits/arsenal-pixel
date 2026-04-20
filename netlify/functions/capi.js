// ══════════════════════════════════════════════════════
// Arsenal Secreto — Meta CAPI Endpoint
// Substitui o capi.php — rode como Netlify Function
// ══════════════════════════════════════════════════════

const PIXEL_ID    = '2428180934327378';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // coloque no Netlify: Site → Environment Variables
const API_VERSION  = 'v19.0';
const CAPI_URL     = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

const crypto = require('crypto');

function sha256(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value.toString().trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/\D/g, '');
  if (p.length === 11 && p[0] !== '5') p = '55' + p;
  if (p.length === 10) p = '55' + p;
  return p;
}

exports.handler = async function(event, context) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const {
      event_name,
      event_id,
      event_time,
      fbp,
      fbc,
      external_id,
      client_ip,
      url,
      user_agent,
      email,
      phone,
      fn,
      ln,
      dob,
      custom_data
    } = body;

    if (!event_name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'event_name obrigatório' }) };
    }

    // ── Monta user_data com hash SHA-256 ──
    const userData = {};

    if (email)       userData.em          = sha256(email);
    if (phone)       userData.ph          = sha256(normalizePhone(phone));
    if (fn)          userData.fn          = sha256(fn);
    if (ln)          userData.ln          = sha256(ln);
    if (dob)         userData.db          = sha256(dob);
    if (external_id) userData.external_id = sha256(external_id);
    if (fbp)         userData.fbp         = fbp;
    if (fbc)         userData.fbc         = fbc;
    if (client_ip)   userData.client_ip_address = client_ip;
    if (user_agent)  userData.client_user_agent  = user_agent;

    // ── Monta o payload CAPI ──
    const payload = {
      data: [
        {
          event_name,
          event_time:   event_time || Math.floor(Date.now() / 1000),
          event_id:     event_id   || ('evt_' + Date.now()),
          event_source_url: url    || null,
          action_source: 'website',
          user_data:    userData,
          custom_data:  custom_data || {}
        }
      ]
    };

    // ── Envia para a Meta CAPI ──
    const response = await fetch(CAPI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        access_token: ACCESS_TOKEN
      })
    });

    const result = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: true, meta: result })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
