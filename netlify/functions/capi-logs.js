const crypto = require('crypto');
let eventLogs = [];
exports.handler = async function(event, context) {
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,x-logs-secret','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Content-Type':'application/json'};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod === 'GET') {
    const limit = parseInt(event.queryStringParameters?.limit || '200');
    const filter = event.queryStringParameters?.event || null;
    let logs = [...eventLogs].reverse();
    if (filter) logs = logs.filter(l => l.event === filter);
    const stats = {};
    eventLogs.forEach(l => { stats[l.event] = (stats[l.event] || 0) + 1; });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, total: eventLogs.length, stats, logs: logs.slice(0, limit) }) };
  }
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const secret = process.env.LOGS_SECRET;
      if (secret && event.headers['x-logs-secret'] !== secret) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      const log = { id: body.event_id || ('log_'+Date.now()), event: body.event_name || 'unknown', url: body.url || null, ip: body.client_ip || null, fbp: body.fbp || null, fbc: body.fbc || null, external_id: body.external_id || null, custom: body.custom_data || {}, ok: body.ok !== false, meta: body.meta || null, timestamp: new Date().toISOString() };
      eventLogs.push(log);
      if (eventLogs.length > 1000) eventLogs = eventLogs.slice(-1000);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch(err) { return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }; }
  }
  if (event.httpMethod === 'DELETE') { eventLogs = []; return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }; }
  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
