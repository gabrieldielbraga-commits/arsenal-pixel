const crypto = require('crypto');
const API_VERSION = 'v19.0';

function sha256(v) {
  if (!v) return null;
  return crypto.createHash('sha256').update(v.toString().trim().toLowerCase()).digest('hex');
}
function normalizePhone(p) {
  if (!p) return null;
  let n = p.replace(/\D/g,'');
  if (n.length===11 && n[0]!=='5') n='55'+n;
  if (n.length===10) n='55'+n;
  return n;
}

async function sendToMeta(pixelId, accessToken, eventData) {
  const url = `https://graph.facebook.com/${API_VERSION}/${pixelId}/events`;
  const { event_name, event_id, event_time, fbp, fbc, external_id, client_ip, user_agent,
          page_url, email, phone, fn, ln, dob, custom_data } = eventData;

  const userData = {};
  if (email)       userData.em = sha256(email);
  if (phone)       userData.ph = sha256(normalizePhone(phone));
  if (fn)          userData.fn = sha256(fn);
  if (ln)          userData.ln = sha256(ln);
  if (dob)         userData.db = sha256(dob);
  if (external_id) userData.external_id = sha256(external_id);
  if (fbp)         userData.fbp = fbp;
  if (fbc)         userData.fbc = fbc;
  if (client_ip)   userData.client_ip_address = client_ip;
  if (user_agent)  userData.client_user_agent = user_agent;

  const payload = {
    access_token: accessToken,
    data: [{
      event_name,
      event_time:       event_time || Math.floor(Date.now()/1000),
      event_id:         (event_name === 'Purchase' || event_name === 'InitiateCheckout') ? undefined : (event_id || ('evt_'+Date.now())),
      event_source_url: page_url   || null,
      action_source:    'website',
      user_data:        userData,
      custom_data:      custom_data || {}
    }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

module.exports = { sendToMeta, sha256 };