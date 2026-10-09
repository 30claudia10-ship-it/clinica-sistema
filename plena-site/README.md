# Site de vendas do Plena

Site estático (HTML, CSS e JS simples), sem build. Publique a pasta `plena-site/` na Vercel ou Netlify (diretório de saída = esta pasta, sem comando de build).
Para testar localmente: `python3 -m http.server` dentro da pasta.

## Onde editar
| O quê | Arquivo |
|---|---|
| Todos os textos, nomes da equipe, links (Instagram, WhatsApp, e-mail, YouTube, Spotify), **preço** (`fundadora.preco`) | `js/content.js` |
| Para onde vão as inscrições | `js/config.js` |
| Cores e fontes (tokens, tema claro e escuro) | `css/tokens.css` |
| Layout | `css/style.css` |

## Envio da lista de espera (`js/config.js`)
- **Formspree:** `provider:"formspree"`, `endpoint:"https://formspree.io/f/SEU_ID"`.
- **Webhook** (Make, Zapier, n8n, Apps Script): `provider:"webhook"` + URL. Recebe POST JSON `{nome, whatsapp, email, origem}`.
- **Google Forms:** `provider:"google"`, `endpoint` = URL `.../formResponse` do formulário, e preencha `googleCampos` com os `entry.XXXX` de cada pergunta.
- `none` (padrão): não envia nada, só mostra a confirmação. Troque antes de publicar.

O formulário do guia "Mapa da sua nova fase" e o da lista usam o mesmo envio (campo `origem` diferencia).

## Identidade visual: pendências
Foram usados os 5 SVGs de logo recebidos. Cores **confirmadas** nos SVGs: seiva, amora, damasco, ink. As demais em `css/tokens.css` estão marcadas como PROVISÓRIAS até chegar o `tokens.json`. As fontes Fraunces e Figtree (variáveis, latin) estão em `assets/fonts/`.
