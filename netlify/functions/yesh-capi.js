const { sendToMeta } = require('./capi-engine');

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

// Cache de contexto do browser (fbp, fbc, ip, ua) por event_id
// TTL 7 dias — linkado pelo event_id gerado no InitiateCheckout
const browserContext = {};
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function saveContext(eventId, ctx) {
  if (!eventId) return;
  browserContext[eventId] = { ...ctx, savedAt: Date.now() };
  // Limpa cache expirado
  const now = Date.now();
  Object.keys(browserContext).forEach(k => {
    if (now - browserContext[k].savedAt > CACHE_TTL) delete browserContext[k];
  });
}

function getContext(eventId) {
  if (!eventId) return null;
  const ctx = browserContext[eventId];
  if (!ctx) return null;
  if (Date.now() - ctx.savedAt > CACHE_TTL) { delete browserContext[eventId]; return null; }
  return ctx;
}

// Logs em memória
let eventLogs = [];

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-pixel-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: 'Method Not Allowed' };

  // Responde 200 imediatamente
  const respond = (body) => ({ statusCode: 200, headers, body: JSON.stringify(body) });

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_name, pixel_id } = body;

    // Ping
    if (event_name === '_ping') {
      const pixels = getPixels();
      return respond({ ok: true, pixels: pixels.map(p=>({id:p.id,name:p.name})) });
    }

    if (!event_name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_name required' }) };

    // Pega IP real do header (cliente, não servidor)
    const realIP = event.headers['cf-connecting-ip']
      || event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['x-real-ip']
      || body.client_ip
      || null;

    const realUA = event.headers['user-agent'] || body.user_agent || null;

    // Salva contexto do browser no InitiateCheckout para recuperar no Purchase
    if (event_name === 'InitiateCheckout' && body.event_id) {
      saveContext(body.event_id, {
        fbp:         body.fbp,
        fbc:         body.fbc,
        ip:          realIP,
        ua:          realUA,
        email:       body.email,
        phone:       body.phone,
        fn:          body.fn,
        ln:          body.ln,
        external_id: body.external_id,
      });
    }

    // Postback de venda — tenta recuperar contexto do browser
    if (event_name === 'postback_purchase' || body.postback === true) {
      const cached = getContext(body.event_id) || getContext(body.external_id) || {};
      const targets = pixel_id ? getPixels().filter(p=>p.id===pixel_id) : getPixels();
      const results = [];

      for (const px of targets) {
        try {
          meta = await sendToMeta(px.id, px.token, {
            event_name:       'Purchase',
            event_id:         body.event_id || body.order_id || undefined,
            event_source_url: body.page_url || 'https://arsenalsecreto.online/',
            fbp:              cached.fbp  || body.fbp  || body.tracking?.fbp || null,
            fbc:              cached.fbc  || body.fbc  || body.tracking?.fbc || null,
            ip:               cached.ip   || realIP,
            ua:               cached.ua   || realUA,
            email:            body.email  || cached.email || body.customer?.email,
            phone:            body.phone  || cached.phone || body.customer?.phone,
            fn:               body.fn     || cached.fn,
            ln:               body.ln     || cached.ln,
            external_id:      body.external_id || cached.external_id || body.tracking?.external_id,
            custom_data: {
              currency:     body.currency || 'BRL',
              value:        typeof body.value === 'number' ? body.value : parseFloat(body.value) || 0,
              content_ids:  body.content_ids  || ['arsenal-secreto'],
              content_type: 'product',
              content_name: body.content_name || 'Arsenal Secreto',
              num_items:    1,
              order_id:     body.order_id || body.event_id || null,
              ...(body.custom_data || {}),
            },
          });
          results.push({ pixel_id: px.id, pixel_name: px.name, ok: !meta.error, meta });
          const log = {
            id: body.event_id||('pb_'+Date.now()), event: 'Purchase',
            pixel_id: px.id, pixel_name: px.name,
            url: body.page_url||null, ip: realIP,
            fbp: cached.fbp||body.fbp||null, fbc: cached.fbc||body.fbc||null,
            utm_source: body.utm_source||null, value: body.value||null,
            order_id: body.order_id||null, source: 'postback',
            ok: !meta.error, timestamp: new Date().toISOString(),
          };
          eventLogs.unshift(log);
          if (eventLogs.length > 2000) eventLogs = eventLogs.slice(0, 2000);
        } catch(e) { results.push({ pixel_id: px.id, ok: false, error: e.message }); }
      }
      return respond({ ok: true, results });
    }

    // Evento normal do browser
    const pixels = getPixels();
    if (!pixels.length) return { statusCode: 500, headers, body: JSON.stringify({ error: 'No pixels configured' }) };

    const targets = pixel_id ? pixels.filter(p=>p.id===pixel_id) : pixels;
    const results = [];

    for (const px of targets) {
      try {
        const meta = await sendToMeta(px.id, px.token, {
          event_name,
          event_id:         event_name === 'Purchase' ? undefined : (body.event_id || undefined),
          event_source_url: body.page_url || null,
          fbp:              body.fbp,
          fbc:              body.fbc,
          ip:               realIP,
          ua:               realUA,
          email:            body.email,
          phone:            body.phone,
          fn:               body.fn,
          ln:               body.ln,
          external_id:      body.external_id,
          custom_data:      body.custom_data || {},
        });
        results.push({ pixel_id: px.id, pixel_name: px.name, ok: !meta.error, meta });

        const utms = body.custom_data || {};
        const log = {
          id:           body.event_id || ('log_'+Date.now()),
          event:        event_name,
          pixel_id:     px.id,
          pixel_name:   px.name,
          url:          body.page_url || null,
          ip:           realIP,
          fbp:          body.fbp || null,
          fbc:          body.fbc || null,
          utm_source:   utms.utm_source || null,
          utm_medium:   utms.utm_medium || null,
          utm_campaign: utms.utm_campaign || null,
          ok:           !meta.error,
          events_received: meta.events_received,
          timestamp:    new Date().toISOString(),
        };
        eventLogs.unshift(log);
        if (eventLogs.length > 2000) eventLogs = eventLogs.slice(0, 2000);
      } catch(e) { results.push({ pixel_id: px.id, ok: false, error: e.message }); }
    }

    return respond({ ok: true, results });

  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

exports.getLogs  = () => eventLogs;
exports.clearLogs = () => { eventLogs = []; };
exports.getContext = getContext;
