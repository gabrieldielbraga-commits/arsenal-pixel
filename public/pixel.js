(function () {
  'use strict';

  // ══════════════════════════════════════════════════════
  // CONFIGURAÇÃO — altere apenas estas 2 linhas
  // ══════════════════════════════════════════════════════
  const PIXEL_ID = '2428180934327378';
  const API_URL  = 'https://SEU-SITE.netlify.app/.netlify/functions/capi';
  // Após o deploy na Netlify, substitua SEU-SITE pelo nome do seu site
  // Exemplo: https://arsenal-pixel.netlify.app/.netlify/functions/capi

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════
  function getCookie(name) {
    try {
      return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || null;
    } catch(e) { return null; }
  }

  function setCookie(name, value, days) {
    try {
      document.cookie = name + '=' + value + '; path=/; max-age=' + (days * 86400) + '; SameSite=Lax';
    } catch(e) {}
  }

  function getParam(name) {
    try {
      const fromSearch = new URLSearchParams(window.location.search).get(name);
      if (fromSearch) return fromSearch;
      const fromHash = new URLSearchParams(window.location.hash.replace('#', '')).get(name);
      return fromHash || null;
    } catch(e) { return null; }
  }

  function generateEventID() {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function safeSessionGet(key) {
    try { return sessionStorage.getItem(key); } catch(e) { return null; }
  }

  function safeSessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch(e) {}
  }

  // ══════════════════════════════════════════════════════
  // 1. EXTERNAL_ID — ID anônimo persistente (2 anos)
  // ══════════════════════════════════════════════════════
  let externalId = getCookie('_ext_id');
  if (!externalId) {
    externalId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
    setCookie('_ext_id', externalId, 730);
  }

  // ══════════════════════════════════════════════════════
  // 2. CAPTURA IP DO VISITANTE
  // ══════════════════════════════════════════════════════
  function captureIP() {
    if (safeSessionGet('_client_ip')) return;

    try {
      if (window.RTCPeerConnection) {
        var pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('ip');
        var offerPromise = pc.createOffer();
        if (offerPromise && typeof offerPromise.then === 'function') {
          offerPromise.then(function(offer) {
            return pc.setLocalDescription(offer);
          }).catch(function() { pc.close(); });
        }
        pc.onicecandidate = function(e) {
          try {
            if (!e || !e.candidate || !e.candidate.candidate) return;
            var cand = e.candidate.candidate;
            var ipv6 = cand.match(/\b([0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})\b/i);
            var ipv4 = cand.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);

            if (ipv6 && ipv6[1] && ipv6[1] !== '::1' && ipv6[1].indexOf('127.') === -1) {
              safeSessionSet('_client_ip', ipv6[1]);
              safeSessionSet('_client_ip_version', '6');
              pc.close();
            } else if (ipv4 && ipv4[1] && !safeSessionGet('_client_ip')) {
              var parts = ipv4[1].split('.');
              var isPrivate = (
                parts[0] === '10' ||
                (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
                (parts[0] === '192' && parts[1] === '168') ||
                parts[0] === '127'
              );
              if (!isPrivate) {
                safeSessionSet('_client_ip', ipv4[1]);
                safeSessionSet('_client_ip_version', '4');
              }
            }
          } catch(err) {}
        };
        setTimeout(function() { try { pc.close(); } catch(e) {} }, 3000);
      }
    } catch(e) {}

    setTimeout(function() {
      try {
        if (safeSessionGet('_client_ip_version') === '6') return;
        fetch('https://api64.ipify.org?format=json', { cache: 'no-store' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d && d.ip) {
              var isIPv6 = d.ip.indexOf(':') !== -1;
              safeSessionSet('_client_ip', d.ip);
              safeSessionSet('_client_ip_version', isIPv6 ? '6' : '4');
            }
          })
          .catch(function() {});
      } catch(e) {}
    }, 800);
  }

  try { captureIP(); } catch(e) {}

  // ══════════════════════════════════════════════════════
  // 3. CAPTURA fbclid → _fbc
  // ══════════════════════════════════════════════════════
  try {
    var fbclid = getParam('fbclid');
    if (!fbclid && document.referrer) {
      try { fbclid = new URL(document.referrer).searchParams.get('fbclid'); } catch(e) {}
    }
    if (!fbclid) fbclid = safeSessionGet('_fbclid');
    if (fbclid) {
      safeSessionSet('_fbclid', fbclid);
      if (!getCookie('_fbc')) setCookie('_fbc', 'fb.1.' + Date.now() + '.' + fbclid, 90);
    }
  } catch(e) {}

  // ══════════════════════════════════════════════════════
  // 4. PERSISTE UTMs em cookies (90 dias)
  // ══════════════════════════════════════════════════════
  try {
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function(p) {
      var val = getParam(p);
      if (val) setCookie(p, val, 90);
    });
  } catch(e) {}

  // ══════════════════════════════════════════════════════
  // 5. INICIALIZA O PIXEL
  // ══════════════════════════════════════════════════════
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  try {
    var initParams = { external_id: externalId };
    var fbcNow = getCookie('_fbc');
    var fbpNow = getCookie('_fbp');
    if (fbcNow) initParams.fbc = fbcNow;
    if (fbpNow) initParams.fbp = fbpNow;
    fbq('init', PIXEL_ID, initParams);
  } catch(e) {
    fbq('init', PIXEL_ID);
  }

  // ══════════════════════════════════════════════════════
  // 6. CAPTURA DE DADOS DE FORMULÁRIOS
  // ══════════════════════════════════════════════════════
  var capturedEmail = null;
  var capturedPhone = null;
  var capturedFn    = null;
  var capturedLn    = null;
  var capturedDob   = null;

  document.addEventListener('input', function (e) {
    try {
      var el = e.target;
      if (!el || !el.value) return;
      var type = (el.type || '').toLowerCase();
      var attr = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();

      if (type === 'email' || attr.indexOf('email') !== -1) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) capturedEmail = el.value.trim();
      }
      if (type === 'tel' || attr.match(/phone|telefone|celular|whatsapp|fone/)) {
        capturedPhone = el.value.replace(/\D/g, '');
      }
      if (attr.match(/\bfirst.?name|^nome\b|primeiro/)) {
        capturedFn = el.value.trim().split(' ')[0];
      }
      if (attr.match(/last.?name|sobrenome|ultimo/)) {
        capturedLn = el.value.trim();
      }
      if (attr.match(/\bfull.?name|nome.?completo/)) {
        var parts = el.value.trim().split(' ');
        capturedFn = parts[0] || null;
        capturedLn = parts.slice(1).join(' ') || null;
      }
      if (type === 'date' || attr.match(/birth|nascimento|dob/)) {
        capturedDob = el.value.replace(/[-\/]/g, '');
      }
    } catch(e) {}
  });

  // ══════════════════════════════════════════════════════
  // 7. FUNÇÃO DE ENVIO DE EVENTOS
  // ══════════════════════════════════════════════════════
  function sendEvent(eventName, data) {
    try {
      data = data || {};
      var eventID = generateEventID();

      fbq('track', eventName, data, { eventID: eventID });

      fetch(API_URL, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name:  eventName,
          event_id:    eventID,
          event_time:  Math.floor(Date.now() / 1000),
          fbp:         getCookie('_fbp'),
          fbc:         getCookie('_fbc'),
          external_id: externalId,
          client_ip:   safeSessionGet('_client_ip'),
          url:         window.location.href,
          user_agent:  navigator.userAgent,
          email:       data.email || capturedEmail || null,
          phone:       data.phone || capturedPhone || null,
          fn:          data.fn   || capturedFn    || null,
          ln:          data.ln   || capturedLn    || null,
          dob:         data.dob  || capturedDob   || null,
          custom_data: Object.assign({}, data, {
            screen_resolution: screen.width + 'x' + screen.height,
            viewport:          window.innerWidth + 'x' + window.innerHeight,
            language:          navigator.language || null,
            timezone:          Intl.DateTimeFormat().resolvedOptions().timeZone || null,
            referrer:          document.referrer || null,
            utm_source:        getCookie('utm_source')   || getParam('utm_source')   || null,
            utm_medium:        getCookie('utm_medium')   || getParam('utm_medium')   || null,
            utm_campaign:      getCookie('utm_campaign') || getParam('utm_campaign') || null,
            utm_content:       getCookie('utm_content')  || getParam('utm_content')  || null,
            utm_term:          getCookie('utm_term')     || getParam('utm_term')     || null,
          })
        })
      }).catch(function() {});
    } catch(e) {}
  }

  // ══════════════════════════════════════════════════════
  // 8. SCROLL DEPTH
  // ══════════════════════════════════════════════════════
  var scrollTracked = {};
  window.addEventListener('scroll', function () {
    try {
      var total = document.body.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      var pct = Math.round((window.scrollY / total) * 100);
      [25, 50, 75, 90].forEach(function(t) {
        if (!scrollTracked[t] && pct >= t) {
          scrollTracked[t] = true;
          fbq('trackCustom', 'ScrollDepth', { scroll_percent: t });
          fetch(API_URL, {
            method:    'POST',
            headers:   { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              event_name:  'ScrollDepth',
              event_id:    generateEventID(),
              event_time:  Math.floor(Date.now() / 1000),
              fbp:         getCookie('_fbp'),
              fbc:         getCookie('_fbc'),
              external_id: externalId,
              client_ip:   safeSessionGet('_client_ip'),
              url:         window.location.href,
              user_agent:  navigator.userAgent,
              custom_data: { scroll_percent: t }
            })
          }).catch(function() {});
        }
      });
    } catch(e) {}
  }, { passive: true });

  // ══════════════════════════════════════════════════════
  // 9. TEMPO NA PÁGINA
  // ══════════════════════════════════════════════════════
  [30, 60, 120].forEach(function(sec) {
    setTimeout(function() {
      fbq('trackCustom', 'TimeOnPage', { seconds: sec });
      fetch(API_URL, {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          event_name:  'TimeOnPage',
          event_id:    generateEventID(),
          event_time:  Math.floor(Date.now() / 1000),
          fbp:         getCookie('_fbp'),
          fbc:         getCookie('_fbc'),
          external_id: externalId,
          client_ip:   safeSessionGet('_client_ip'),
          url:         window.location.href,
          user_agent:  navigator.userAgent,
          custom_data: { seconds: sec }
        })
      }).catch(function() {});
    }, sec * 1000);
  });

  // ══════════════════════════════════════════════════════
  // 10. EVENTOS AO CARREGAR O DOM
  // ══════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    try {
      sendEvent('PageView');

      sendEvent('ViewContent', {
        content_name:     document.title || null,
        content_category: 'page',
        content_ids:      [window.location.pathname],
        content_type:     'product'
      });

      // Injeta UTMs nos links da Hotmart
      document.querySelectorAll('a[href*="hotmart.com"]').forEach(function(link) {
        try {
          var url = new URL(link.href);
          ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','_fbc','_fbp']
            .forEach(function(p) {
              var val = getCookie(p) || getParam(p);
              if (val) url.searchParams.set(p, val);
            });
          link.href = url.toString();
        } catch(e) {}
      });

      // Botões de compra → InitiateCheckout
      var buyWords = /comprar|garantir|quero|assinar|adquirir|pegar|aproveitar|comecar|começar|inscrever/i;
      document.querySelectorAll('a, button').forEach(function(el) {
        el.addEventListener('click', function() {
          try {
            var text = el.innerText || el.textContent || el.value || '';
            if (buyWords.test(text)) {
              sendEvent('InitiateCheckout', {
                email: capturedEmail || null,
                phone: capturedPhone || null,
                fn:    capturedFn    || null,
                ln:    capturedLn    || null,
              });
            }
          } catch(e) {}
        });
      });

    } catch(e) {}
  });

})();
