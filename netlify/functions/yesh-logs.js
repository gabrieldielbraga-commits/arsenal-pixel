const capiHandler = require('./yesh-capi');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:200, headers, body:'' };

  const token = event.headers['x-auth-token'] || '';
  let decoded = '';
  try { decoded = Buffer.from(token, 'base64').toString(); } catch(e) {}
  const authed = decoded.startsWith('yt_') && decoded.endsWith('_yesh');
  if (!authed) return { statusCode:401, headers, body: JSON.stringify({ error:'Unauthorized' }) };

  if (event.httpMethod === 'DELETE') {
    capiHandler.clearLogs();
    return { statusCode:200, headers, body: JSON.stringify({ ok:true }) };
  }

  const logs = capiHandler.getLogs();
  const filter_pixel = event.queryStringParameters?.pixel_id || null;
  const filter_event = event.queryStringParameters?.event    || null;
  const limit        = parseInt(event.queryStringParameters?.limit || '500');

  let filtered = logs;
  if (filter_pixel) filtered = filtered.filter(l => l.pixel_id === filter_pixel);
  if (filter_event) filtered = filtered.filter(l => l.event    === filter_event);

  // Stats por pixel
  const pixelStats = {};
  logs.forEach(l => {
    if (!pixelStats[l.pixel_id]) pixelStats[l.pixel_id] = { name: l.pixel_name, total: 0, events: {} };
    pixelStats[l.pixel_id].total++;
    pixelStats[l.pixel_id].events[l.event] = (pixelStats[l.pixel_id].events[l.event] || 0) + 1;
  });

  // Stats UTM
  const utmStats = {};
  logs.forEach(l => {
    if (l.utm_source) {
      const key = [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(' / ');
      utmStats[key] = (utmStats[key] || 0) + 1;
    }
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok:true, total: logs.length, pixelStats, utmStats, logs: filtered.slice(0, limit) })
  };
};