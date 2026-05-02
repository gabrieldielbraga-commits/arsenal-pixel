(function(){
'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────────
var pid = new URLSearchParams(document.currentScript&&document.currentScript.src?new URL(document.currentScript.src).search:'').get('pid')||'';
var API = window.YESH_API || 'https://arsenal-pixel.netlify.app/.netlify/functions/yesh-capi';

// ── HELPERS ──────────────────────────────────────────────────────────────────
function gc(n){try{return document.cookie.split('; ').find(function(r){return r.startsWith(n+'=')})?.split('=')[1]||null}catch(e){return null}}
function sc(n,v,d){try{document.cookie=n+'='+v+'; path=/; max-age='+(d*86400)+'; SameSite=Lax'}catch(e){}}
function gp(n){try{var s=new URLSearchParams(window.location.search).get(n);if(s)return s;return new URLSearchParams(window.location.hash.replace('#','')).get(n)||null}catch(e){return null}}
function ss(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
function sss(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
function eid(){return'evt_'+Date.now()+'_'+Math.random().toString(36).substr(2,9)}

// ── EXTERNAL ID ──────────────────────────────────────────────────────────────
var xid = gc('_yt_xid');
if(!xid){xid='yt_'+Date.now()+'_'+Math.random().toString(36).substr(2,12);sc('_yt_xid',xid,730);}

// ── UTMs — salva em cookie 90 dias ───────────────────────────────────────────
var UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id'];
UTM_KEYS.forEach(function(p){var v=gp(p);if(v){sc(p,v,90);sss(p,v);}});

// Captura src, sck, gclid também
['src','sck','gclid','ttclid','click_id'].forEach(function(p){var v=gp(p);if(v){sc(p,v,90);sss(p,v);}});

function getUTMs(){
  var u={};
  UTM_KEYS.forEach(function(p){var v=gc(p)||gp(p)||ss(p);if(v)u[p]=v;});
  ['src','sck','gclid','ttclid','click_id'].forEach(function(p){var v=gc(p)||gp(p)||ss(p);if(v)u[p]=v;});
  return u;
}

// ── FBC / FBP ─────────────────────────────────────────────────────────────────
try{
  var fbclid=gp('fbclid');
  if(!fbclid&&document.referrer){try{fbclid=new URL(document.referrer).searchParams.get('fbclid')}catch(e){}}
  if(!fbclid)fbclid=ss('_fbclid');
  if(fbclid){
    sss('_fbclid',fbclid);
    if(!gc('_fbc'))sc('_fbc','fb.1.'+Date.now()+'.'+fbclid,90);
  }
}catch(e){}

// ── CAPTURA IP ───────────────────────────────────────────────────────────────
function captureIP(){
  if(ss('_cip'))return;
  fetch('https://api64.ipify.org?format=json',{cache:'no-store'})
    .then(function(r){return r.json()})
    .then(function(d){if(d&&d.ip)sss('_cip',d.ip)})
    .catch(function(){});
  try{
    if(window.RTCPeerConnection){
      var pc=new RTCPeerConnection({iceServers:[]});
      pc.createDataChannel('x');
      pc.createOffer().then(function(o){return pc.setLocalDescription(o)}).catch(function(){});
      pc.onicecandidate=function(e){
        if(!e||!e.candidate)return;
        var c=e.candidate.candidate;
        var m6=c.match(/\b([0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7})\b/i);
        var m4=c.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
        if(m6&&m6[1]&&m6[1]!='::1'){sss('_cip',m6[1]);pc.close();}
        else if(m4&&m4[1]&&!ss('_cip')){
          var p=m4[1].split('.');
          if(p[0]!='10'&&p[0]!='127'&&!(p[0]=='172'&&+p[1]>=16&&+p[1]<=31)&&!(p[0]=='192'&&p[1]=='168')){sss('_cip',m4[1]);}
        }
      };
      setTimeout(function(){try{pc.close()}catch(e){}},3000);
    }
  }catch(e){}
}
captureIP();

// ── INIT PIXEL META ──────────────────────────────────────────────────────────
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
if(pid){
  try{
    var initParams={external_id:xid};
    var fc=gc('_fbc');var fp=gc('_fbp');
    if(fc)initParams.fbc=fc;
    if(fp)initParams.fbp=fp;
    if(ce)initParams.em=ce;
    if(cp)initParams.ph=cp;
    fbq('init',pid,initParams);
  }catch(e){fbq('init',pid);}
}

// ── CAPTURA DADOS DE FORMULÁRIOS ─────────────────────────────────────────────
var ce=null,cp=null,cf=null,cl=null;
document.addEventListener('input',function(e){
  try{
    var el=e.target;
    if(!el||!el.value)return;
    var tp=(el.type||'').toLowerCase();
    var at=((el.name||'')+' '+(el.id||'')+' '+(el.placeholder||'')+' '+(el.className||'')).toLowerCase();
    if(tp==='email'||at.indexOf('email')!==-1){
      if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)){ce=el.value.trim();sc('_cem',ce,1);saveTrackingContext(ce);}
    }
    if(tp==='tel'||at.match(/phone|telefone|celular|whatsapp|fone/)){cp=el.value.replace(/\D/g,'');}
    if(at.match(/\bfirst.?name|^nome\b|primeiro/)){cf=el.value.trim().split(' ')[0];}
    if(at.match(/last.?name|sobrenome|ultimo/)){cl=el.value.trim();}
    if(at.match(/\bfull.?name|nome.?completo/)){
      var pts=el.value.trim().split(' ');
      cf=pts[0]||null;cl=pts.slice(1).join(' ')||null;
    }
  }catch(e){}
});

// Tenta recuperar email salvo em cookie anterior
if(!ce&&gc('_cem'))ce=gc('_cem');

// ── FUNÇÃO PRINCIPAL DE ENVIO ─────────────────────────────────────────────────
function send(name,data){
  try{
    data=data||{};
    var id=eid();
    if(pid)fbq('track',name,data,{eventID:id});
    var utms=getUTMs();
    fetch(API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      keepalive:true,
      body:JSON.stringify({
        event_name:  name,
        event_id:    id,
        event_time:  Math.floor(Date.now()/1000),
        pixel_id:    pid||undefined,
        fbp:         gc('_fbp'),
        fbc:         gc('_fbc'),
        external_id: xid,
        client_ip:   ss('_cip'),
        page_url:    window.location.href,
        user_agent:  navigator.userAgent,
        email:       data.email||ce||null,
        phone:       data.phone||cp||null,
        fn:          data.fn||cf||null,
        ln:          data.ln||cl||null,
        custom_data: Object.assign({},data,utms,{
          referrer:    document.referrer||null,
          viewport:    window.innerWidth+'x'+window.innerHeight,
          language:    navigator.language||null,
          timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone||null,
          page_title:  document.title||null,
        })
      })
    }).catch(function(){});
  }catch(e){}
}

// ── CONFIG DE EVENTOS ATIVOS ─────────────────────────────────────────────────
var YESH_CONFIG={PageView:true,ViewContent:true,InitiateCheckout:true,ScrollDepth:true,TimeOnPage:true,Lead:true,Purchase:true};
fetch(API.replace('yesh-capi','yesh-config'),{cache:'no-store'})
  .then(function(r){return r.json()})
  .then(function(d){if(d&&d.config)YESH_CONFIG=d.config})
  .catch(function(){});
function isActive(ev){return YESH_CONFIG[ev]!==false;}

// ── SCROLL DEPTH ─────────────────────────────────────────────────────────────
var st={};
window.addEventListener('scroll',function(){
  try{
    var tot=document.body.scrollHeight-window.innerHeight;
    if(tot<=0)return;
    var pct=Math.round(window.scrollY/tot*100);
    [25,50,75,90].forEach(function(t){
      if(!st[t]&&pct>=t){
        st[t]=true;
        if(!isActive('ScrollDepth'))return;
        if(pid)fbq('trackCustom','ScrollDepth',{scroll_percent:t});
        fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
          body:JSON.stringify({event_name:'ScrollDepth',event_id:eid(),event_time:Math.floor(Date.now()/1000),
            pixel_id:pid||undefined,fbp:gc('_fbp'),fbc:gc('_fbc'),external_id:xid,
            client_ip:ss('_cip'),page_url:window.location.href,user_agent:navigator.userAgent,
            custom_data:Object.assign({scroll_percent:t},getUTMs())
          })
        }).catch(function(){});
      }
    });
  }catch(e){}
},{passive:true});

// ── TIME ON PAGE ─────────────────────────────────────────────────────────────
[30,60,120].forEach(function(s){
  setTimeout(function(){
    if(!isActive('TimeOnPage'))return;
    if(pid)fbq('trackCustom','TimeOnPage',{seconds:s});
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({event_name:'TimeOnPage',event_id:eid(),event_time:Math.floor(Date.now()/1000),
        pixel_id:pid||undefined,fbp:gc('_fbp'),fbc:gc('_fbc'),external_id:xid,
        client_ip:ss('_cip'),page_url:window.location.href,user_agent:navigator.userAgent,
        custom_data:Object.assign({seconds:s},getUTMs())
      })
    }).catch(function(){});
  },s*1000);
});

// ── DOM READY ────────────────────────────────────────────────────────────────
function domReady(){
  try{
    if(isActive('PageView'))send('PageView');
    if(isActive('ViewContent'))send('ViewContent',{
      content_name:     document.title||null,
      content_category: 'page',
      content_ids:      [window.location.pathname],
      content_type:     'product'
    });

    // Injeta UTMs nos links de checkout
    document.querySelectorAll('a[href*="pay."],a[href*="checkout"],a[href*="ggcheckout.app"],a[href*="hotmart.com"],a[href*="kiwify.com"],a[href*="eduzz.com"],a[href*="monetizze.com"],a[href*="ggcheckout"]').forEach(function(a){
      try{
        var u=new URL(a.href);
        var utms=getUTMs();
        Object.keys(utms).forEach(function(p){u.searchParams.set(p,utms[p]);});
        ['_fbc','_fbp'].forEach(function(p){var v=gc(p);if(v)u.searchParams.set(p,v);});
        a.href=u.toString();
      }catch(e){}
    });

    // Botões de compra → InitiateCheckout
    var bw=/comprar|garantir|quero|assinar|adquirir|pegar|aproveitar|comecar|começar|inscrever|acessar|obter|comecar/i;
    document.querySelectorAll('a,button').forEach(function(el){
      el.addEventListener('click',function(){
        try{
          var txt=el.innerText||el.textContent||el.value||'';
          var href=(el.href||el.getAttribute('href')||'').toLowerCase();
          var isCheckoutLink=href.indexOf('ggcheckout')!==-1||href.indexOf('pay.')!==-1;
          if((bw.test(txt)||isCheckoutLink)&&isActive('InitiateCheckout')){
            var checkoutEventId=eid();
            sc('_checkout_eid',checkoutEventId,1);
            sss('_checkout_eid',checkoutEventId);
            send('InitiateCheckout',{email:ce,phone:cp,fn:cf,ln:cl,
              content_name:document.title||null,
              content_ids:[window.location.pathname],
              content_type:'product',
              value:parseFloat(el.getAttribute("data-price")||"19.90"),currency:'BRL'
            });
            // Injeta external_id na URL do checkout para o webhook recuperar contexto
            try{
              var href=el.href||'';
              if(href&&href!=='#'){
                var u=new URL(href,window.location.href);
                u.searchParams.set('external_id',checkoutEventId);
                if(ce)u.searchParams.set('email',ce);
                el.href=u.toString();
              }
            }catch(e){}
          }
        }catch(e){}
      });
    });

  }catch(e){}
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',domReady);
}else{
  domReady();
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────
window.YeshTrack={
  send:send,
  pixelId:pid,
  getUTMs:getUTMs,
  identify:function(data){
    if(data.email)ce=data.email;
    if(data.phone)cp=data.phone;
    if(data.fn)cf=data.fn;
    if(data.ln)cl=data.ln;
  }
};

})();
// ── SALVA CONTEXTO DE TRACKING NO ARSENAL MEMBROS ────────────────────────────
var TRACKING_API = 'https://dkrnhgpwjjvrvbterblq.supabase.co/functions/v1/save-tracking-context';
var trackingSent = false;
function saveTrackingContext(email) {
  if (trackingSent || !email) return;
  trackingSent = true;
  fetch(TRACKING_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      email:       email,
      fbp:         gc('_fbp')  || null,
      fbc:         gc('_fbc')  || null,
      external_id: xid         || null,
      user_agent:  navigator.userAgent || null,
      client_ip:   ss('_cip')  || null,
    })
  }).catch(function(){});
}
