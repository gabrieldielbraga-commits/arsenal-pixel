exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'arsenal2024';

  // POST — valida senha
  if (event.httpMethod === 'POST') {
    try {
      const { password } = JSON.parse(event.body || '{}');
      if (password === DASHBOARD_PASSWORD) {
        const token = Buffer.from(`px_${Date.now()}_arsenal`).toString('base64');
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, token }) };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false }) };
    }
  }

  // GET — verifica token (qualquer token base64 válido gerado por nós é aceito)
  if (event.httpMethod === 'GET') {
    const token = event.headers['x-auth-token'] || '';
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const ok = decoded.startsWith('px_') && decoded.endsWith('_arsenal');
      return { statusCode: 200, headers, body: JSON.stringify({ ok }) };
    } catch(e) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
