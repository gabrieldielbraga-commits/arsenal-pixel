const { sendToMeta } = require('./capi-engine');

// Pixels configurados via env vars: PIXEL_ID_1, ACCESS_TOKEN_1, PIXEL_ID_2, ...
function getPixels() {
  const pixels = [];
  for (let i = 1; i <= 10; i++) {
    const id    = process.env[`PIXEL_ID_${i}`];
    const token = process.env[`ACCESS_TOKEN_${i}`];
    const name  = process.env[`PIXEL_NAME_${i}`] || `Pixel ${i}`;
    if (id && token) pixels.push({ id, token, name, index: i });
  }
  return pixels;
}

// Logs em memória (últimos 2000)
let eventLogs = [];

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-pixel-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };
  if (event.httpMethod !== 'POST')    return { statusCode:405, headers, body:'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_name, pixel_id } = body;

    // Ping interno
    if (event_name === '_ping') {
      const pixels = getPixels();
      return { statusCode:200, headers, body: JSON.stringify({ ok:true, pixels: pixels.map(p=>({id:p.id,name:p.name})) }) };
    }

    if (!event_name) return { statusCode:400, headers, body: JSON.stringify({ error:'event_name required' }) };

    const pixels = getPixels();
    if (pixels.length === 0) return { statusCode:500, headers, body: JSON.stringify({ error:'No pixels configured' }) };

    // Envia para pixel específico ou todos
    const targets = pixel_id ? pixels.filter(p => p.id === pixel_id) : pixels;
    const results = [];

    for (const px of targets) {
      try {
        const meta = await sendToMeta(px.id, px.token, body);
        results.push({ pixel_id: px.id, pixel_name: px.name, ok: !meta.error, meta });

        // Salva log
        const log = {
          id:         body.event_id || ('log_'+Date.now()),
          event:      event_name,
          pixel_id:   px.id,
          pixel_name: px.name,
          url:        body.page_url || null,
          ip:         body.client_ip || null,
          fbp:        body.fbp || null,
          fbc:        body.fbc || null,
          utm_source: body.custom_data?.utm_source || null,
          utm_medium: body.custom_data?.utm_medium || null,
          utm_campaign: body.custom_data?.utm_campaign || null,
          ok:         !meta.error,
          events_received: meta.events_received,
          timestamp:  new Date().toISOString(),
        };
        eventLogs.unshift(log);
        if (eventLogs.length > 2000) eventLogs = eventLogs.slice(0, 2000);
      } catch(e) {
        results.push({ pixel_id: px.id, ok: false, error: e.message });
      }
    }

    return { statusCode:200, headers, body: JSON.stringify({ ok:true, results }) };

  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ ok:false, error: err.message }) };
  }
};

// Exporta logs para o dashboard
exports.getLogs = () => eventLogs;
exports.clearLogs = () => { eventLogs = []; };