/* ===========================================================================
   proposta.js — landing pública da proposta (link curto: proposta.html?c=nome-xxxxxx)
   Só consegue ler propostas MARCADAS como prontas (função segura do banco).
   =========================================================================== */
(async function () {
  const code = (new URLSearchParams(location.search).get('c') || '').trim().toLowerCase();
  const state = document.getElementById('state');
  const unavailable = () => {
    state.innerHTML = `<h1>Proposta indisponível</h1><p>Este link não está ativo ou expirou. Fale com a clínica para receber um novo.</p>`;
  };
  if (!code) return unavailable();
  try {
    const { data, error } = await sb.rpc('get_public_quote', { p_code: code });
    if (error || !data) return unavailable();
    const html = quoteLandingHtml(data);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.title = doc.title;
    document.head.innerHTML = doc.head.innerHTML;
    document.body.removeAttribute('style');
    document.body.innerHTML = doc.body.innerHTML;
  } catch (e) {
    console.error(e);
    unavailable();
  }
})();
