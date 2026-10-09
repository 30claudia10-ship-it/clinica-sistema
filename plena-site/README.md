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

## Identidade visual
Vem do kit `plena-kit-marca/` (cópia do guia e do `tokens.json` na raiz do repositório). Cores, espaços, raios e sombra estão em `tokens.json`; `css/tokens.css` é **gerado** dele: depois de editar o JSON, rode `python3 tools/gerar-tokens.py` dentro desta pasta. Logos em `assets/logos/`, fontes (Fraunces, Figtree) em `assets/fonts/`.

Duas adaptações para manter contraste 4,5:1 no tema escuro, onde `ink` vira claro e `seiva` vira verde claro:
- texto sobre `damasco`, `mel` e `folha` usa tinta escura própria (`--on-claro`);
- cabeçalho e rodapé usam o logo negativo sobre fundo escuro (no rodapé escuro, fundo `surface-300` em vez de `seiva`).
