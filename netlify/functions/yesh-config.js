// netlify/functions/yesh-config.js
// Serve configuração de eventos ativos para o yesh.js

// Config padrão — todos ativos
const DEFAULT_CONFIG = {
  PageView: true,
  ViewContent: true,
  InitiateCheckout: true,
  ScrollDepth: true,
  TimeOnPage: true,
  Lead: true,
  Purchase: true,
};

// Config em memória (alterada pelo dashboard via POST)
let currentConfig = { ...DEFAULT_CONFIG };

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // GET — retorna config atual (chamado pelo yesh.js em cada página)
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, config: currentConfig }) };
  }

  // POST — atualiza config (chamado pelo dashboard ao salvar toggles)
  if (event.httpMethod === 'POST') {
    const token = event.headers['x-auth-token'] || '';
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const ok = decoded.startsWith('yt_') && decoded.endsWith('_yesh');
      if (!ok) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    } catch(e) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
      const body = JSON.parse(event.body || '{}');
      // Merge com defaults para não perder campos
      currentConfig = { ...DEFAULT_CONFIG, ...body };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, config: currentConfig }) };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};