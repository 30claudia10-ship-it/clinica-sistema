/* ===========================================================================
   quote-render.js — gera a LANDING e o PDF da proposta a partir do "snapshot".
   Usado pelo sistema (pré-visualização ao vivo) e pela página pública do
   paciente (proposta.html). Não depende de mais nada.
   =========================================================================== */

function qEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function qMoney(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function qDur(min) {
  min = Math.round(Number(min) || 0);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
function qDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
}
function qTelHref(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '#';
  if (!d.startsWith('55')) d = '55' + d;
  return 'tel:+' + d;
}
function qInitials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();
}
function qParas(text) {
  return String(text || '').split(/\n+/).filter(Boolean).map(p => `<p>${qEsc(p)}</p>`).join('');
}

const Q_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;

function qBrandVars(snap) {
  const b = snap.brand || {};
  return `--p:${b.primary || '#1f2430'};--a:${b.accent || '#a8844f'};`;
}

/* blocos compartilhados ---------------------------------------------------- */
function qTpLines(tp) {
  const rows = (tp.lines || []).map(l => `
    <tr><td>${qEsc(l.label)}${l.qty > 1 ? ` <span class="mut">× ${l.qty}</span>` : ''}</td><td class="r">${l.value ? qMoney(l.value) : '<span class="mut">sob consulta</span>'}</td></tr>`).join('');
  const discs = (tp.discounts || []).map(d => `
    <tr class="disc"><td>${qEsc(d.label)}</td><td class="r">− ${qMoney(d.amount)}</td></tr>`).join('');
  return `<table class="lines"><tbody>${rows}${discs}
    <tr class="tot"><td>${qEsc(tp.kind === 'hospital' ? 'Total estimado' : 'Total')}</td><td class="r">${qMoney(tp.total)}</td></tr></tbody></table>`;
}
function qTpRange(tp) {
  if (!tp.variancePct) return '';
  return `<div class="range">Faixa estimada (±${tp.variancePct}%): <b>${qMoney(tp.rangeMin)}</b> a <b>${qMoney(tp.rangeMax)}</b></div>`;
}
function qTpFooter(tp) {
  const terms = (tp.paymentTerms || []).map(t => `<li>${qEsc(t)}</li>`).join('');
  const notes = (tp.notes || []).map(t => `<li>${qEsc(t)}</li>`).join('');
  return `${tp.paymentChoice ? `<div class="chosen">Forma escolhida: <b>${qEsc(tp.paymentChoice)}</b></div>` : ''}
    ${terms ? `<div class="sub-h">Formas de pagamento</div><ul class="bul">${terms}</ul>` : ''}
    ${notes ? `<ul class="bul">${notes}</ul>` : ''}`;
}
function qPayeeBadge(text) {
  return `<span class="direct">${qEsc(text)}</span>`;
}
function qPayeeFor(tp) {
  return `Pago diretamente ${tp.kind === 'anestesista' ? 'à(ao) anestesista' : tp.kind === 'hospital' ? 'ao hospital' : 'ao parceiro'}: ${tp.payee || tp.name}`;
}

/* ============================ LANDING =================================== */
function quoteLandingHtml(snap, opts) {
  opts = opts || {};
  const b = snap.brand || {};
  const t = snap.texts || {};
  const team = snap.team || { lines: [] };
  const totals = snap.totals || {};

  const cta = (c, tone) => {
    if (!c || !c.phone) return '';
    const photo = c.photo
      ? `<img src="${qEsc(c.photo)}" alt="${qEsc(c.name)}">`
      : `<span class="ini">${qEsc(qInitials(c.name))}</span>`;
    return `<a class="cta ${tone}" href="${qTelHref(c.phone)}">
      <span class="ph">${photo}</span>
      <span class="tx"><small>${qEsc(c.role)}</small><b>${qEsc(c.name)}</b><em>${qEsc(c.phone)}</em></span>
      <span class="go">Ligar →</span></a>`;
  };

  const teamRows = (team.lines || []).map(l => `
    <tr><td>${qEsc(l.role)}${l.name ? ` <span class="mut">· ${qEsc(l.name)}</span>` : ''}</td><td class="r">${qMoney(l.value)}</td></tr>`).join('');
  const teamDisc = team.discountAmount ? `<tr class="disc"><td>${qEsc(team.discountLabel || 'Condição especial')}</td><td class="r">− ${qMoney(team.discountAmount)}</td></tr>` : '';
  const teamAvista = team.avistaAmount ? `<tr class="disc"><td>Desconto para pagamento à vista</td><td class="r">− ${qMoney(team.avistaAmount)}</td></tr>` : '';

  const anest = team.anesthetist;
  const anestBlock = anest ? `
    <div class="sub-card">
      <div class="sub-top"><div><div class="sub-h">${qEsc(anest.name)}</div><div class="mut">${qEsc((anest.meta || []).join(' · '))}</div></div>${qPayeeBadge(qPayeeFor(anest))}</div>
      ${qTpLines(anest)}
      <div class="warn-note">O valor da anestesia <b>não faz parte</b> do valor da equipe cirúrgica e não recebe os descontos dela. É pago diretamente à anestesista.</div>
      ${qTpFooter(anest)}
    </div>` : '';

  const hosp = snap.hospital;
  const hospBlock = hosp ? `
    <section class="blk">
      <div class="eyebrow">Parte 2</div>
      <h2>${qEsc(hosp.name)}</h2>
      <div class="direct-bar">${qEsc(qPayeeFor(hosp))} — <u>não passa pela clínica</u></div>
      <div class="mut" style="margin:8px 0 12px">${qEsc((hosp.meta || []).join(' · '))}</div>
      ${qTpLines(hosp)}
      ${qTpRange(hosp)}
      ${qTpFooter(hosp)}
      ${t.hospitalDisclaimer ? `<div class="disclaimer">${qParas(t.hospitalDisclaimer)}</div>` : ''}
    </section>` : '';

  const partners = (snap.partners || []).map(p => `
    <section class="blk">
      <div class="eyebrow">Parceiro</div>
      <h2>${qEsc(p.name)}</h2>
      <div class="direct-bar">${qEsc(qPayeeFor(p))}</div>
      ${qTpLines(p)}
      ${qTpFooter(p)}
    </section>`).join('');

  const pros = snap.prosthesis ? `
    <section class="blk">
      <div class="eyebrow">Prótese</div>
      <h2>${qEsc(snap.prosthesis.description || 'Prótese')}</h2>
      <table class="lines"><tbody><tr class="tot"><td>Valor da prótese</td><td class="r">${qMoney(snap.prosthesis.value)}</td></tr></tbody></table>
      <div class="disclaimer"><p>${qEsc(snap.prosthesis.text || '')}</p></div>
    </section>` : '';

  const summaryRows = [
    ['Equipe cirúrgica', totals.team, 'Paga à clínica'],
    snap.prosthesis ? ['Prótese', totals.prosthesis, 'Paga no pré-operatório'] : null,
    anest ? ['Anestesista', totals.anesthetist, 'Paga direto à anestesista'] : null,
    hosp ? ['Hospital (estimado)', totals.hospital, 'Paga direto ao hospital'] : null,
    ...(snap.partners || []).map(p => [p.name, p.total, qPayeeFor(p)])
  ].filter(Boolean).map(r => `
    <div class="sum-row"><div><b>${qEsc(r[0])}</b><small>${qEsc(r[2])}</small></div><span>${qMoney(r[1])}</span></div>`).join('');

  const steps = (t.steps || []).map((s, i) => `
    <li><span class="n">${i + 1}</span><div>${s.title ? `<b>${qEsc(s.title)}</b>` : ''}<p>${qEsc(s.text)}</p></div></li>`).join('');

  const logo = b.logo
    ? `<img class="logo" src="${qEsc(b.logo)}" alt="${qEsc(b.clinicName || b.doctorName || '')}">`
    : `<div class="mono">${qEsc(qInitials(b.doctorName || b.clinicName || 'Dr'))}</div>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${qEsc(snap.patient ? snap.patient.firstName : 'Sua proposta')} · ${qEsc(b.doctorName || 'Proposta')}</title>
${Q_FONTS}
<style>
:root{${qBrandVars(snap)} --ink:#1d2129; --mut:#6b7280; --line:#e8e1d6; --ivory:#faf7f2;}
*{box-sizing:border-box} html{scroll-behavior:smooth}
body{margin:0;background:var(--ivory);color:var(--ink);font:15px/1.6 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,.serif{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;letter-spacing:.2px}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
.hero{background:var(--p);color:#fff;padding:34px 0 64px;position:relative;overflow:hidden}
.hero:after{content:'';position:absolute;right:-120px;top:-120px;width:380px;height:380px;border-radius:50%;border:1px solid color-mix(in srgb,var(--a) 55%,transparent)}
.brandbar{display:flex;align-items:center;gap:14px;margin-bottom:46px}
.logo{max-height:48px;max-width:200px}
.mono{width:46px;height:46px;border-radius:50%;border:1px solid var(--a);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--a)}
.who b{display:block;font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:600}
.who span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,#fff 65%,transparent)}
.hero h1{font-size:clamp(32px,6.4vw,50px);line-height:1.08;margin:0 0 16px;max-width:640px}
.hero h1 em{color:var(--a);font-style:italic}
.hero p.lead{margin:0;max-width:560px;color:color-mix(in srgb,#fff 82%,transparent);font-size:16.5px}
.pill{display:inline-block;margin-top:26px;padding:8px 16px;border:1px solid color-mix(in srgb,var(--a) 70%,transparent);border-radius:99px;font-size:13px;color:#fff}
.pill b{color:var(--a)}
main{margin-top:-34px;position:relative}
.blk{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px 24px;margin-bottom:18px;box-shadow:0 6px 24px rgba(31,36,48,.05)}
.eyebrow{font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--a);font-weight:600}
.blk h2{margin:2px 0 12px;font-size:28px;line-height:1.15;color:var(--p)}
table.lines{width:100%;border-collapse:collapse;font-size:14.5px}
table.lines td{padding:10px 0;border-bottom:1px solid var(--line);vertical-align:top}
.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.mut{color:var(--mut);font-size:13px}
tr.disc td{color:#2f7d57}
tr.tot td{font-weight:600;border-bottom:none;padding-top:14px;font-size:16px;color:var(--p)}
.sub-card{margin-top:18px;border:1px solid var(--line);border-radius:14px;padding:16px;background:var(--ivory)}
.sub-top{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px}
.sub-h{font-weight:600;color:var(--p);margin:10px 0 4px}
.sub-top .sub-h{margin:0}
.direct{display:inline-block;background:color-mix(in srgb,var(--a) 16%,#fff);color:#6d5330;border:1px solid color-mix(in srgb,var(--a) 50%,#fff);border-radius:99px;padding:4px 12px;font-size:12px;font-weight:600}
.direct-bar{background:color-mix(in srgb,var(--a) 14%,#fff);border-left:3px solid var(--a);padding:10px 14px;border-radius:8px;font-size:13.5px;color:#5a4526}
.warn-note{margin-top:10px;font-size:13px;color:#5a4526;background:#fff;border:1px dashed var(--a);border-radius:10px;padding:9px 12px}
.range{margin-top:10px;font-size:13.5px;color:var(--mut)}
.chosen{margin-top:10px;font-size:13.5px}
ul.bul{margin:6px 0 0;padding-left:18px;color:#444;font-size:13.5px}
.disclaimer{margin-top:16px;padding:14px 16px;background:var(--ivory);border-radius:12px;font-size:13.2px;color:#4b5160}
.disclaimer p{margin:0 0 8px}.disclaimer p:last-child{margin:0}
.summary{background:var(--p);color:#fff;border-radius:18px;padding:26px 24px;margin-bottom:18px}
.summary h2{color:#fff;margin:0 0 4px;font-size:28px}
.summary .eyebrow{color:var(--a)}
.sum-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.12)}
.sum-row small{display:block;color:rgba(255,255,255,.62);font-size:12.5px}
.sum-row span{font-variant-numeric:tabular-nums;white-space:nowrap}
.grand{display:flex;justify-content:space-between;align-items:baseline;padding-top:18px;font-family:'Cormorant Garamond',serif}
.grand span:first-child{font-size:20px}.grand span:last-child{font-size:34px;color:var(--a)}
.summary .foot{font-size:12.5px;color:rgba(255,255,255,.65);margin-top:6px}
.pay li{margin-bottom:4px}
ol.steps{list-style:none;margin:6px 0 0;padding:0}
ol.steps li{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}
ol.steps li:last-child{border:none}
ol.steps .n{flex:none;width:30px;height:30px;border-radius:50%;background:var(--p);color:var(--a);display:flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-size:17px}
ol.steps p{margin:2px 0 0;color:#4b5160;font-size:14px}
.closing{text-align:center;padding:34px 8px 6px}
.closing h2{font-size:30px;color:var(--p);margin:0 0 6px}
.closing p{color:var(--mut);max-width:520px;margin:0 auto 20px}
.ctas{display:grid;gap:12px}
@media(min-width:640px){.ctas{grid-template-columns:1fr 1fr}}
a.cta{display:flex;align-items:center;gap:12px;text-decoration:none;padding:14px;border-radius:16px;border:1px solid var(--line);background:#fff;color:var(--ink);transition:.2s}
a.cta:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(31,36,48,.1)}
a.cta.main{background:var(--p);border-color:var(--p);color:#fff}
.cta .ph{flex:none;width:54px;height:54px;border-radius:50%;overflow:hidden;background:var(--ivory);display:flex;align-items:center;justify-content:center;border:2px solid var(--a)}
.cta .ph img{width:100%;height:100%;object-fit:cover}
.cta .ini{font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--p)}
.cta .tx{flex:1;text-align:left;line-height:1.3}
.cta small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.65}
.cta b{display:block;font-size:16px}.cta em{font-style:normal;font-size:13px;opacity:.8}
.cta .go{font-size:13px;font-weight:600;color:var(--a)}
footer{padding:26px 0 40px;text-align:center;color:var(--mut);font-size:12.5px}
</style></head><body>
<header class="hero"><div class="wrap">
  <div class="brandbar">${logo}<div class="who"><b>${qEsc(b.doctorName || b.clinicName || '')}</b><span>${qEsc(b.doctorTitle || '')}</span></div></div>
  <h1>${qEsc(t.headline || '')}</h1>
  <p class="lead">${qEsc(t.subtitle || '')}</p>
  <div class="pill">${qEsc(snap.procedure.title)} · duração prevista <b>${qEsc(snap.procedure.durationLabel)}</b></div>
</div></header>

<main class="wrap">
  <section class="blk">
    <div class="eyebrow">Parte 1 · Equipe cirúrgica</div>
    <h2>${qEsc(b.doctorName || 'Equipe')} e equipe</h2>
    ${snap.procedure.summary ? `<p class="mut" style="margin:0 0 10px">${qEsc(snap.procedure.summary)}</p>` : ''}
    <table class="lines"><tbody>${teamRows}${teamDisc}${teamAvista}
      <tr class="tot"><td>Total da equipe</td><td class="r">${qMoney(team.total)}</td></tr></tbody></table>
    ${(team.paymentLines || []).length ? `<div class="sub-h">Como pagar a equipe</div><ul class="bul pay">${team.paymentLines.map(x => `<li>${qEsc(x)}</li>`).join('')}</ul>` : ''}
    ${anestBlock}
  </section>
  ${hospBlock}${partners}${pros}

  <section class="summary">
    <div class="eyebrow">Resumo</div>
    <h2>Seu investimento, com clareza</h2>
    ${summaryRows}
    <div class="grand"><span>Total estimado</span><span>${qMoney(totals.grand)}</span></div>
    <div class="foot">Cada valor é pago a quem presta o serviço, como indicado acima. Os valores do hospital são aproximados.</div>
  </section>

  ${steps ? `<section class="blk"><div class="eyebrow">Daqui para a frente</div><h2>Seus próximos passos</h2><ol class="steps">${steps}</ol></section>` : ''}

  <section class="closing">
    <h2>Ficou com alguma dúvida?</h2>
    <p>${qEsc(t.closing || '')}</p>
    <div class="ctas">${cta(snap.contacts && snap.contacts.commercial, 'main')}${cta(snap.contacts && snap.contacts.financial, 'alt')}</div>
  </section>
</main>
<footer>Proposta válida até <b>${qDate(snap.validUntil)}</b> · ${qEsc(b.doctorName || b.clinicName || '')}</footer>
</body></html>`;
}

/* ============================== PDF ===================================== */
function quotePdfHtml(snap) {
  const b = snap.brand || {};
  const t = snap.texts || {};
  const team = snap.team || { lines: [] };
  const totals = snap.totals || {};
  const anest = team.anesthetist;
  const hosp = snap.hospital;

  const logo = b.logo
    ? `<img class="logo" src="${qEsc(b.logo)}">`
    : `<div class="mono">${qEsc(qInitials(b.doctorName || b.clinicName || 'Dr'))}</div>`;

  const teamRows = (team.lines || []).map(l => `<tr><td>${qEsc(l.role)}${l.name ? ` <span class="mut">· ${qEsc(l.name)}</span>` : ''}</td><td class="r">${qMoney(l.value)}</td></tr>`).join('');
  const tpBox = (tp, title) => `
    <div class="box">
      <div class="box-h"><span>${qEsc(title || tp.name)}</span>${qPayeeBadge(qPayeeFor(tp))}</div>
      <div class="mut">${qEsc((tp.meta || []).join(' · '))}</div>
      ${qTpLines(tp)}${qTpRange(tp)}${qTpFooter(tp)}
    </div>`;

  const contacts = [snap.contacts && snap.contacts.commercial, snap.contacts && snap.contacts.financial].filter(c => c && c.phone)
    .map(c => `<div><b>${qEsc(c.name)}</b> · ${qEsc(c.role)}<br>${qEsc(c.phone)}</div>`).join('');

  const sum = [
    ['Equipe cirúrgica', totals.team, 'paga à clínica'],
    snap.prosthesis ? ['Prótese', totals.prosthesis, 'paga no pré-operatório'] : null,
    anest ? ['Anestesista', totals.anesthetist, 'paga diretamente à anestesista'] : null,
    hosp ? ['Hospital (estimado)', totals.hospital, 'pago diretamente ao hospital'] : null,
    ...(snap.partners || []).map(p => [p.name, p.total, 'pago diretamente ao parceiro'])
  ].filter(Boolean).map(r => `<tr><td>${qEsc(r[0])} <span class="mut">· ${qEsc(r[2])}</span></td><td class="r">${qMoney(r[1])}</td></tr>`).join('');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta — ${qEsc(snap.patient.name)}</title>
${Q_FONTS}
<style>
@page{size:A4;margin:14mm 14mm 16mm}
:root{${qBrandVars(snap)} --ink:#1d2129;--mut:#6b7280;--line:#e5ded2}
*{box-sizing:border-box}
body{margin:0;color:var(--ink);font:11.2px/1.5 Inter,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,.serif{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600}
.head{background:var(--p);color:#fff;padding:18px 20px;border-radius:10px;display:flex;align-items:center;gap:16px}
.logo{max-height:42px;max-width:150px}
.mono{width:42px;height:42px;border:1px solid var(--a);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--a);font-family:'Cormorant Garamond',serif;font-size:18px}
.head .who{flex:1}.head .who b{display:block;font:600 18px 'Cormorant Garamond',serif}
.head .who span{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
.head .doc{text-align:right;font-size:10px;opacity:.85}.head .doc b{display:block;font:600 17px 'Cormorant Garamond',serif;color:var(--a);opacity:1}
.pt{display:flex;justify-content:space-between;gap:14px;margin:14px 0 6px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.pt h1{margin:0;font-size:24px;color:var(--p)} .pt .mut{font-size:11px}
h2{font-size:17px;color:var(--p);margin:16px 0 6px;border-bottom:1px solid var(--a);padding-bottom:3px}
table{width:100%;border-collapse:collapse}
td{padding:6px 0;border-bottom:1px solid var(--line);vertical-align:top}
.r{text-align:right;white-space:nowrap}.mut{color:var(--mut);font-size:10.4px}
tr.disc td{color:#2f7d57}tr.tot td{font-weight:700;color:var(--p);border-bottom:none;padding-top:8px;font-size:12px}
.box{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-top:10px;break-inside:avoid}
.box-h{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;font-weight:700;color:var(--p);font-size:12px;margin-bottom:2px}
.direct{background:#f3ead9;color:#6d5330;border:1px solid #d9c49a;border-radius:99px;padding:2px 9px;font-size:9.6px;font-weight:600}
.warn-note,.disclaimer,.direct-bar{margin-top:8px;padding:7px 10px;border-radius:6px;background:#f8f3ea;border-left:3px solid var(--a);font-size:10.4px}
.sub-h{font-weight:700;margin:8px 0 2px;color:var(--p)}
ul.bul{margin:3px 0 0;padding-left:16px}.range,.chosen{margin-top:6px;font-size:10.6px}
.disclaimer p{margin:0 0 4px}
.sum{margin-top:6px;break-inside:avoid}
.grand td{font-size:14px;font-weight:700;color:var(--p);border-top:2px solid var(--a);border-bottom:none;padding-top:8px}
ol.steps{margin:4px 0 0;padding-left:18px}ol.steps li{margin-bottom:5px}
.contacts{display:flex;gap:14px;margin-top:10px}.contacts div{flex:1;border:1px solid var(--line);border-radius:8px;padding:8px 10px}
.foot{margin-top:14px;font-size:9.6px;color:var(--mut);text-align:center}
</style></head><body>
<div class="head">${logo}<div class="who"><b>${qEsc(b.doctorName || b.clinicName || '')}</b><span>${qEsc(b.doctorTitle || '')}</span></div>
  <div class="doc"><b>Proposta cirúrgica</b>Emitida em ${qDate(snap.generatedAt)}<br>Válida até ${qDate(snap.validUntil)}</div></div>

<div class="pt"><div><h1>${qEsc(snap.patient.name)}</h1><div class="mut">${qEsc(snap.procedure.title)}</div></div>
  <div class="mut r">Duração prevista: ${qEsc(snap.procedure.durationLabel)}<br>${qEsc(snap.procedure.periodLabel || '')}${snap.procedure.periodLabel && snap.procedure.anesthesiaLabel ? ' · ' : ''}${qEsc(snap.procedure.anesthesiaLabel || '')}</div></div>

<h2>1 · Equipe cirúrgica</h2>
<table><tbody>${teamRows}
  ${team.discountAmount ? `<tr class="disc"><td>${qEsc(team.discountLabel || 'Condição especial')}</td><td class="r">− ${qMoney(team.discountAmount)}</td></tr>` : ''}
  ${team.avistaAmount ? `<tr class="disc"><td>Desconto para pagamento à vista</td><td class="r">− ${qMoney(team.avistaAmount)}</td></tr>` : ''}
  <tr class="tot"><td>Total da equipe</td><td class="r">${qMoney(team.total)}</td></tr></tbody></table>
${(team.paymentLines || []).length ? `<div class="sub-h">Como pagar a equipe</div><ul class="bul">${team.paymentLines.map(x => `<li>${qEsc(x)}</li>`).join('')}</ul>` : ''}
${anest ? tpBox(anest, 'Anestesista — ' + anest.name) + `<div class="warn-note">O valor da anestesia não faz parte do valor da equipe cirúrgica, não recebe os descontos dela e é pago diretamente à anestesista.</div>` : ''}

${snap.prosthesis ? `<h2>Prótese</h2><table><tbody><tr><td>${qEsc(snap.prosthesis.description || 'Prótese')}</td><td class="r">${qMoney(snap.prosthesis.value)}</td></tr></tbody></table><div class="disclaimer"><p>${qEsc(snap.prosthesis.text || '')}</p></div>` : ''}

${hosp ? `<h2>2 · Hospital</h2><div class="direct-bar">Valores pagos <b>diretamente ao hospital</b>, fora do valor da clínica.</div>${tpBox(hosp)}${t.hospitalDisclaimer ? `<div class="disclaimer">${qParas(t.hospitalDisclaimer)}</div>` : ''}` : ''}
${(snap.partners || []).map(p => `<h2>Parceiro — ${qEsc(p.name)}</h2>${tpBox(p)}`).join('')}

<h2>Resumo do investimento</h2>
<table class="sum"><tbody>${sum}<tr class="grand"><td>Total estimado</td><td class="r">${qMoney(totals.grand)}</td></tr></tbody></table>

${(t.steps || []).length ? `<h2>Próximos passos</h2><ol class="steps">${t.steps.map(s => `<li>${s.title ? `<b>${qEsc(s.title)}.</b> ` : ''}${qEsc(s.text)}</li>`).join('')}</ol>` : ''}

<div class="contacts">${contacts}</div>
<div class="foot">${qEsc(b.doctorName || b.clinicName || '')} · Documento informativo — valores sujeitos às condições descritas acima.</div>
</body></html>`;
}
