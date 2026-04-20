# Arsenal Secreto — Pixel CAPI

Rastreamento server-side via Meta Conversions API hospedado na Netlify.

## Estrutura

```
arsenal-pixel/
├── netlify.toml                    ← configuração do deploy
├── public/
│   └── pixel.js                   ← script para incluir na página de vendas
└── netlify/
    └── functions/
        └── capi.js                ← endpoint server-side (substitui o capi.php)
```

## Deploy (passo a passo)

### 1. Sobe no GitHub
```bash
git init
git add .
git commit -m "Arsenal Pixel CAPI"
git remote add origin https://github.com/SEU-USUARIO/arsenal-pixel.git
git push -u origin main
```

### 2. Conecta na Netlify
- Netlify → Add new site → Import from GitHub
- Seleciona o repositório `arsenal-pixel`
- Build command: (deixa vazio)
- Publish directory: `public`
- Clica em Deploy

### 3. Adiciona o Access Token (IMPORTANTE — não coloque no código!)
- Netlify → Site → Environment Variables → Add variable
- Key: `META_ACCESS_TOKEN`
- Value: seu token de acesso da API de Conversões
- Clica em Save → faz Redeploy

### 4. Atualiza a API_URL no pixel.js
Após o deploy, pegue a URL do seu site na Netlify (ex: `arsenal-pixel.netlify.app`)
e substitua no `pixel.js`:

```js
const API_URL = 'https://arsenal-pixel.netlify.app/.netlify/functions/capi';
```

Faça um novo commit e push para atualizar.

### 5. Inclui o pixel na página de vendas
Cole antes do `</head>` da sua página de vendas:

```html
<script src="https://arsenal-pixel.netlify.app/pixel.js" async></script>
```

## Eventos rastreados

| Evento | Quando dispara |
|--------|---------------|
| PageView | Ao carregar a página |
| ViewContent | Ao carregar (com dados da página) |
| InitiateCheckout | Ao clicar em botão de compra |
| ScrollDepth | A cada 25%, 50%, 75%, 90% de scroll |
| TimeOnPage | Aos 30s, 60s e 120s na página |

## Onde pegar o Access Token
1. business.facebook.com
2. Gerenciador de Eventos → Pixel `2428180934327378`
3. Configurações → API de Conversões
4. Gerar token de acesso → copiar
