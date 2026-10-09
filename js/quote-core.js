/* ===========================================================================
   quote-core.js — motor de cálculo do Orçamento Cirúrgico + dados iniciais
   (tabela do Hospital Contorno 2025/26 e honorários do anestesista)
   =========================================================================== */

/* ---------------- textos padrão (editáveis em Configurações) -------------- */
const DEFAULT_STD_TEXTS = {
  headline: '{nome}, a decisão é sua. O cuidado, a gente assume com você.',
  subtitle: 'Preparamos este plano com transparência e carinho, para você decidir com calma, segurança e sem nenhuma surpresa pelo caminho.',
  closing: 'Estamos aqui para conversar com você, sem pressa e sem compromisso. Escolha com quem prefere falar.',
  prosthesisText: 'A prótese deverá ser paga no dia do seu pré-operatório.',
  hospitalDisclaimer: 'Os valores referentes ao hospital que estão no orçamento correspondem a serviços terceirizados, estão sujeitos a reajuste anuais que geralmente ocorrem em dezembro. São valores aproximados e também podem variar até 30% para mais ou para menos, dependendo da duração da operação e de possíveis gastos adicionais com materiais necessários para o procedimento garantir seu bom andamento e segurança.\nEsses valores devem ser pagos diretamente na tesouraria do hospital ao receber alta médica.',
  step1: 'Os exames devem estar prontos por volta de 02 a 03 meses antes da cirurgia.',
  step2: 'Cerca de 40 dias antes da sua cirurgia, nossa nutricionista entrará em contato para agendar a sua consulta.',
  step3: 'Em seguida, a {financeiro} irá marcar o seu pré-operatório com o {doutor}.',
  validityDays: 15
};

function getStdTexts() {
  const s = (typeof getSettings === 'function' ? getSettings() : {}) || {};
  return Object.assign({}, DEFAULT_STD_TEXTS, s.stdTexts || {});
}

/* ---------------- tempo --------------------------------------------------- */
// "2h30", "Até 2h", "1:30", "90min" -> minutos
function parseDurationLabel(label) {
  const s = String(label || '').toLowerCase().replace(',', '.');
  let m = /(\d+)\s*h\s*(\d+)?/.exec(s);
  if (m) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  m = /(\d+):(\d{2})/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /(\d+)\s*min/.exec(s);
  if (m) return Number(m[1]);
  return 0;
}
function durationOptions(selected) {
  let out = '';
  for (let m = 60; m <= 14 * 60; m += 15) {
    out += `<option value="${m}" ${Number(selected) === m ? 'selected' : ''}>${qDur(m)}</option>`;
  }
  return out;
}

/* ---------------- dados iniciais ----------------------------------------- */
function hoursRows(startMin, step, valuesByKey) {
  const keys = Object.keys(valuesByKey);
  return valuesByKey[keys[0]].map((_, i) => {
    const v = {};
    keys.forEach(k => v[k] = valuesByKey[k][i]);
    return { min: startMin + i * step, v };
  });
}
function catItems(arr) {
  return arr.map(([name, value, note]) => ({ id: 'i' + Math.random().toString(36).slice(2, 9), name, value, note: note || '' }));
}

function seedHospitalConfig() {
  return {
    billingMode: 'hourly',
    payeeLabel: 'Tesouraria do Hospital Contorno',
    paidDirectly: true,
    variancePct: 30,
    contact: { phone: '(31) 3267-5285 · (31) 9 9965-2488', site: 'www.hospitalcontorno.com.br', address: 'Av. Contorno 6.975, Lourdes, Belo Horizonte - MG' },
    validFrom: '2025-12-01',
    periods: [
      { key: 'manha', label: 'Manhã' },
      { key: 'tarde', label: 'Tarde (início após 14h — já com 25% de desconto)' }
    ],
    columns: [
      { key: 'local', label: 'Local + sedação' },
      { key: 'geral', label: 'Peridural / Raqui & Geral' }
    ],
    tables: {
      manha: hoursRows(60, 30, {
        local: [3462, 3731, 4000, 4269, 4540, 4809, 5077, 5346, 5615, 5884, 6153, 6422, 6691, 6960, 7229, 7498, 7766, 8036, 8305, 8574, 8843, 9112, 9381, 9650, 9919],
        geral: [3668, 3933, 4201, 4469, 4737, 5004, 5272, 5540, 5808, 6075, 6342, 6610, 6877, 7145, 7413, 7681, 7949, 8217, 8485, 8753, 9021, 9289, 9557, 9825, 10093]
      }),
      tarde: hoursRows(60, 30, {
        local: [2597, 2799, 3000, 3202, 3405, 3607, 3808, 4010, 4212, 4413, 4615, 4817, 5019, 5220, 5422, 5624, 5825, 6027, 6229, 6431, 6633, 6834, 7036, 7238, 7440],
        geral: [2751, 2950, 3151, 3352, 3553, 3753, 3954, 4155, 4356, 4557, 4757, 4958, 5158, 5359, 5560, 5761, 5962, 6163, 6364, 6565, 6766, 6967, 7168, 7369, 7570]
      })
    },
    catalogs: [
      { id: 'pacotes', name: 'Pacotes — desconto período da tarde (cirurgias até 2h)', kind: 'package',
        note: 'Substitui a taxa hospitalar/local. Materiais inclusos (1 kit cirúrgico + 3 fios). Anestesia conforme tabela.',
        items: catItems([
          ['Mama de Aumento', 2863], ['Blefaroplastia', 2863], ['Ninfoplastia', 2602], ['Otoplastia', 2902],
          ['Mentoplastia', 2863], ['Bichectomia', 2897], ['Ginecomastia', 2967], ['Correção de Cicatriz', 2746],
          ['Varicectomia', 3882], ['Pequena cirurgia com anestesia local (até 1h30, sem sedação)', 1961]
        ]) },
      { id: 'materiais', name: 'Materiais / Medicamentos', kind: 'items', items: catItems([
        ['Nylon', 25], ['Monocryl / Vicryl / PDS', 74], ['PDS', 74], ['Monocryl 5.0', 82], ['Prolene', 53],
        ['Campo Cirúrgico', 230], ['Capote / Campo Extra', 45], ['Cautério', 74], ['Seringa (60 ml) Extra', 45],
        ['Dreno Portovac', 74], ['Remifentanil / Precedex', 119], ['Sugamadex', 115], ['Split Nasal', 339],
        ['Propofol (acima de duas unidades)', 45], ['Triancil', 74], ['Transamin', 17], ['Manta Térmica', 175],
        ['Stratafix', 589], ['Cola Prineo', 1177], ['Cola Dermabond', 263], ['Látex Free', 0, 'Consultar valores']
      ]) },
      { id: 'equip', name: 'Equipamentos (locação)', kind: 'items', items: catItems([
        ['Microscópio', 294], ['Vibro Lipo', 733], ['Manguito Pneumático', 148], ['Caixa Instrumental', 288], ['Torre de Vídeo', 575]
      ]) },
      { id: 'servicos', name: 'Serviços complementares', kind: 'items', items: catItems([
        ['Anestesia Geral — taxa única até 3 horas', 294, 'Usar quando a anestesia for geral'],
        ['Anestesia Geral — taxa única até 5 horas', 440, 'Usar quando a anestesia for geral'],
        ['Anestesia Geral — taxa única acima de 5 horas', 587, 'Usar quando a anestesia for geral'],
        ['Pernoite', 981], ['Diária', 981], ['Cirurgia Segura', 420], ['Taxa de limpeza de material', 115]
      ]) },
      { id: 'exames', name: 'Exames complementares', kind: 'items', items: catItems([
        ['Anatomopatológico (peça)', 148], ['Eritrograma', 41], ['Pré-anestésico + Eletrocardiograma', 393], ['Gasometria (15 parâmetros)', 132]
      ]) }
    ],
    discounts: [
      { id: 'retoque_local', label: 'Retoque — 30% sobre o valor da hora (anestesia local)', percent: 30, appliesTo: 'base', onlyColumns: ['local'], maxMinutes: 90,
        note: 'Somente dentro de um ano e meio após o procedimento, com duração de até 1h30.' },
      { id: 'retoque_geral', label: 'Retoque — 20% sobre o valor da hora (peridural / geral)', percent: 20, appliesTo: 'base', onlyColumns: ['geral'], maxMinutes: 90,
        note: 'Somente dentro de um ano e meio após o procedimento, com duração de até 1h30.' }
    ],
    paymentOptions: [
      { id: 'cartao', label: 'Cartão (débito/crédito) em até 12x sem juros', discountPercent: 0 },
      { id: 'link', label: 'Link de pagamento (consultar simulação)', discountPercent: 0 },
      { id: 'pix', label: 'Pix / dinheiro — 5% de desconto à vista', discountPercent: 5 }
    ],
    paymentTerms: [],
    notes: [
      'Alta médica sem cobrança extra: até às 09h. Tolerância das altas: até 1h após as altas médicas.',
      'O bloqueio guiado por ultrassom possui o mesmo preço do bloqueio peridural.'
    ],
    internalNotes: ['O médico será avalista do paciente internado.'],
    fixedValue: 0, fixedLabel: ''
  };
}

function seedAnesthetistConfig() {
  const vals = [1638, 1771, 1906, 2041, 2174, 2309, 2442, 2576, 2711, 2844, 2979, 3112, 3247, 3381, 3515, 3649, 3783, 3917, 4052, 4185, 4320, 4453, 4588, 4722, 4856, 4990, 5124, 5258, 5393, 5527, 5662, 5796, 5931, 6066, 6200, 6335, 6469, 6604, 6738, 6873, 7007, 7142, 7277, 7411, 7546, 7680, 7815, 7949, 8084];
  return {
    billingMode: 'hourly',
    payeeLabel: 'Anestesista (diretamente à médica)',
    paidDirectly: true,
    variancePct: 0,
    contact: { phone: '', site: '', address: '' },
    validFrom: '2025-12-01',
    periods: [{ key: 'unico', label: 'Honorários' }],
    columns: [{ key: 'valor', label: 'Honorários' }],
    tables: { unico: vals.map((v, i) => ({ min: i === 0 ? 120 : 120 + i * 15, v: { valor: v } })) },
    catalogs: [],
    discounts: [],
    paymentOptions: [
      { id: 'dinheiro', label: 'Dinheiro', discountPercent: 0 },
      { id: 'transferencia', label: 'Transferência bancária', discountPercent: 0 }
    ],
    paymentTerms: ['Dinheiro ou transferência bancária.'],
    notes: [
      'O pagamento do serviço de anestesia deve ser efetuado diretamente com o anestesista.',
      'O recibo do médico anestesista será separado da nota fiscal do hospital.'
    ],
    internalNotes: ['Condições de desconto próprias da anestesista — não aplicar os descontos da equipe do Dr. Roger.'],
    fixedValue: 0, fixedLabel: ''
  };
}

function blankThirdPartyConfig(kind) {
  if (kind === 'hospital') {
    const c = seedHospitalConfig();
    c.tables = { manha: [], tarde: [] }; c.catalogs = []; c.discounts = []; c.notes = []; c.internalNotes = [];
    return c;
  }
  if (kind === 'anestesista') {
    const c = seedAnesthetistConfig();
    c.tables = { unico: [] }; c.notes = []; c.internalNotes = [];
    return c;
  }
  return {
    billingMode: 'fixed', payeeLabel: '', paidDirectly: true, variancePct: 0,
    contact: { phone: '', site: '', address: '' },
    periods: [], columns: [], tables: {}, catalogs: [], discounts: [], paymentOptions: [], paymentTerms: [],
    notes: [], internalNotes: [], fixedValue: 0, fixedLabel: 'Serviço'
  };
}

/* ---------------- cálculo: terceiro (hospital / anestesista / parceiro) ---- */
function qRound(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function findTableRow(rows, minutes) {
  const sorted = (rows || []).slice().sort((a, b) => a.min - b.min);
  if (!sorted.length) return null;
  const hit = sorted.find(r => r.min >= minutes);
  return hit ? { row: hit, over: false } : { row: sorted[sorted.length - 1], over: true };
}
function findCatalogItem(cfg, itemId) {
  for (const c of (cfg.catalogs || [])) {
    const it = (c.items || []).find(i => i.id === itemId);
    if (it) return { item: it, catalog: c };
  }
  return null;
}

// sel: { minutes, period, column, packageId, extras:[{itemId,qty,value}], discountIds:[], paymentOptionId, fixedValue }
function computeThirdParty(tp, sel, defaultMinutes, procedure) {
  const cfg = tp.config || {};
  sel = sel || {};
  const minutes = Number(sel.minutes) || Number(defaultMinutes) || 0;
  const lines = [], warnings = [], meta = [];
  let base = 0;

  const periodKey = (cfg.periods || []).some(p => p.key === sel.period) ? sel.period : ((cfg.periods || [])[0] || {}).key;
  const colKey = (cfg.columns || []).some(c => c.key === sel.column) ? sel.column : ((cfg.columns || [])[0] || {}).key;
  const periodLabel = ((cfg.periods || []).find(p => p.key === periodKey) || {}).label;
  const colLabel = ((cfg.columns || []).find(c => c.key === colKey) || {}).label;

  const pkg = sel.packageId ? findCatalogItem(cfg, sel.packageId) : null;
  if (pkg) {
    base = Number(pkg.item.value) || 0;
    lines.push({ label: `Pacote — ${pkg.item.name} (taxa hospitalar com materiais inclusos)`, value: base });
    if (minutes > 120) warnings.push('Pacotes da tarde valem para cirurgias de até 2 horas.');
    if (periodKey !== 'tarde' && (cfg.periods || []).some(p => p.key === 'tarde')) warnings.push('Pacotes são válidos para o período da tarde.');
    meta.push('Pacote período da tarde');
  } else if (cfg.billingMode === 'hourly') {
    const rows = (cfg.tables || {})[periodKey] || [];
    const hit = minutes ? findTableRow(rows, minutes) : null;
    if (!rows.length) warnings.push('Este cadastro ainda não tem tabela de horas. Importe ou preencha em Configurações.');
    else if (!hit) warnings.push('Informe a duração da cirurgia.');
    else {
      base = Number((hit.row.v || {})[colKey]) || 0;
      if (hit.over) warnings.push(`Duração acima do que a tabela cobre (${qDur(hit.row.min)}) — valor da última linha usado. Ajuste manualmente se necessário.`);
      lines.push({ label: `${tp.kind === 'anestesista' ? 'Honorários' : 'Taxa hospitalar'} — até ${qDur(hit.row.min)}${colLabel && (cfg.columns || []).length > 1 ? ' · ' + colLabel : ''}`, value: base });
      meta.push('Duração considerada: ' + qDur(hit.row.min));
    }
    if (periodLabel && (cfg.periods || []).length > 1) meta.push(periodLabel.split(' (')[0]);
  } else {
    base = Number(sel.fixedValue != null && sel.fixedValue !== '' ? sel.fixedValue : cfg.fixedValue) || 0;
    if (base) lines.push({ label: cfg.fixedLabel || 'Serviço', value: base });
  }

  for (const ex of (sel.extras || [])) {
    const f = findCatalogItem(cfg, ex.itemId);
    if (!f) continue;
    const qty = Number(ex.qty) || 1;
    const unit = ex.value != null && ex.value !== '' ? Number(ex.value) : Number(f.item.value) || 0;
    lines.push({ label: f.item.name, qty, value: qRound(unit * qty) });
  }

  const subtotal = qRound(lines.reduce((s, l) => s + l.value, 0));
  const discounts = [];
  let running = subtotal;
  const eligible = d => {
    if (d.onlyColumns && d.onlyColumns.length && !d.onlyColumns.includes(colKey)) return false;
    if (d.maxMinutes && minutes > d.maxMinutes) { warnings.push(`"${d.label}" não se aplica: duração acima de ${qDur(d.maxMinutes)}.`); return false; }
    return true;
  };
  const chosen = (cfg.discounts || []).filter(d => (sel.discountIds || []).includes(d.id));
  for (const d of chosen.filter(d => d.appliesTo === 'base')) {
    if (!eligible(d)) continue;
    const amt = qRound(base * (Number(d.percent) || 0) / 100);
    discounts.push({ label: d.label, amount: amt }); running -= amt;
  }
  for (const d of chosen.filter(d => d.appliesTo !== 'base')) {
    if (!eligible(d)) continue;
    const amt = qRound(running * (Number(d.percent) || 0) / 100);
    discounts.push({ label: d.label, amount: amt }); running -= amt;
  }
  const pay = (cfg.paymentOptions || []).find(p => p.id === sel.paymentOptionId);
  if (pay && Number(pay.discountPercent) > 0) {
    const amt = qRound(running * Number(pay.discountPercent) / 100);
    discounts.push({ label: pay.label, amount: amt }); running -= amt;
  }
  const total = qRound(Math.max(0, running));
  const vp = Number(cfg.variancePct) || 0;

  return {
    tpId: tp.id, kind: tp.kind, name: tp.name,
    payee: cfg.payeeLabel || tp.name,
    lines, subtotal, discounts, total, warnings, meta,
    paymentChoice: pay ? pay.label : '',
    paymentTerms: cfg.paymentTerms || [],
    notes: cfg.notes || [],
    variancePct: vp,
    rangeMin: vp ? qRound(total * (1 - vp / 100)) : 0,
    rangeMax: vp ? qRound(total * (1 + vp / 100)) : 0
  };
}

/* ---------------- cálculo: equipe + orçamento completo -------------------- */
function computeTeam(data) {
  const t = data.team || { lines: [] };
  const lines = (t.lines || []).filter(l => l.included && Number(l.value) > 0);
  const subtotal = qRound(lines.reduce((s, l) => s + Number(l.value), 0));
  const discBase = qRound(lines.filter(l => l.discountable).reduce((s, l) => s + Number(l.value), 0));
  const d = t.discount || {};
  let discountAmount = 0;
  if (Number(d.value) > 0) {
    discountAmount = d.type === 'value' ? Math.min(Number(d.value), discBase) : qRound(discBase * Math.min(Number(d.value), 100) / 100);
  }
  const pay = data.payment || {};
  let avistaAmount = 0;
  if (pay.mode === 'avista' && Number(pay.avistaPct) > 0) {
    avistaAmount = qRound((discBase - discountAmount) * Math.min(Number(pay.avistaPct), 100) / 100);
  }
  const total = qRound(subtotal - discountAmount - avistaAmount);
  return { lines, subtotal, discBase, discountAmount, avistaAmount, total };
}

function paymentPlanLines(data, teamTotal) {
  const p = data.payment || {};
  const out = [];
  const n = Math.max(1, Number(p.installments) || 1);
  if (p.mode === 'avista') out.push(`À vista (Pix ou transferência): ${qMoney(teamTotal)}${Number(p.avistaPct) > 0 ? ` — já com ${p.avistaPct}% de desconto` : ''}.`);
  if (p.mode === 'cartao') out.push(`Cartão de crédito em até ${n}x de ${qMoney(teamTotal / n)}.`);
  if (p.mode === 'entrada') {
    const entry = Math.min(Number(p.entry) || 0, teamTotal);
    out.push(`Entrada de ${qMoney(entry)} na confirmação da cirurgia.`);
    out.push(`Saldo de ${qMoney(teamTotal - entry)} em ${n}x de ${qMoney((teamTotal - entry) / n)}.`);
  }
  if (p.note && p.note.trim()) out.push(p.note.trim());
  return out;
}

function quoteCtx() {
  const s = getSettings();
  return {
    settings: s,
    thirdParties: Store.all('thirdParties'),
    teamMembers: Store.all('teamMembers')
  };
}

// Constrói o snapshot (o que o paciente vê). `code` só existe depois de publicar.
function buildQuoteSnapshot(data, ctx, code) {
  ctx = ctx || quoteCtx();
  const s = ctx.settings || {};
  const std = Object.assign({}, DEFAULT_STD_TEXTS, s.stdTexts || {});
  const proc = data.procedure || {};
  const patient = data.patient || {};
  const minutes = Number(proc.minutes) || 0;
  const first = (patient.name || '').trim().split(/\s+/)[0] || '';
  const doctor = s.doctorName || 'Dr. Roger Vieira';
  const finName = s.financialName || 'Cláudia';
  const sub = txt => String(txt || '').replace(/\{nome\}/g, first).replace(/\{doutor\}/g, doctor).replace(/\{financeiro\}/g, finName).replace(/\{comercial\}/g, s.commercialName || 'Leise');

  const tpSel = k => (data.thirdParties || {})[k];
  const calc = (kind) => {
    const sel = tpSel(kind);
    if (!sel || !sel.tpId || sel.tpId === 'none') return null;
    const tp = ctx.thirdParties.find(x => x.id === sel.tpId);
    if (!tp) return null;
    return computeThirdParty(tp, Object.assign({ period: proc.period, column: proc.anesthesia }, sel), minutes, proc);
  };
  const hospital = calc('hospital');
  const anesthetist = calc('anestesista');
  const partners = ((data.thirdParties || {}).partners || []).map(sel => {
    const tp = ctx.thirdParties.find(x => x.id === sel.tpId);
    return tp ? computeThirdParty(tp, sel, minutes, proc) : null;
  }).filter(Boolean);

  const tm = computeTeam(data);
  const pros = data.prosthesis && data.prosthesis.enabled && Number(data.prosthesis.value) > 0
    ? { description: data.prosthesis.description || 'Prótese', value: Number(data.prosthesis.value), text: std.prosthesisText } : null;

  const totals = {
    team: tm.total,
    prosthesis: pros ? pros.value : 0,
    anesthetist: anesthetist ? anesthetist.total : 0,
    hospital: hospital ? hospital.total : 0,
    partners: qRound(partners.reduce((a, p) => a + p.total, 0))
  };
  totals.grand = qRound(totals.team + totals.prosthesis + totals.anesthetist + totals.hospital + totals.partners);

  const days = Number(data.validityDays) || Number(std.validityDays) || 15;
  const until = new Date(); until.setDate(until.getDate() + days);
  const untilIso = new Date(until - until.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const absolute = u => { try { return u ? new URL(u, location.href).href : ''; } catch (e) { return u || ''; } };
  const periodLabel = proc.period === 'tarde' ? 'Período da tarde' : proc.period === 'manha' ? 'Período da manhã' : '';
  const anesLabel = proc.anesthesia === 'geral' ? 'Anestesia peridural / raqui / geral' : proc.anesthesia === 'local' ? 'Anestesia local + sedação' : '';

  return {
    v: 1, code: code || null, generatedAt: new Date().toISOString(), validityDays: days, validUntil: untilIso,
    brand: {
      clinicName: s.clinicName || '', doctorName: doctor, doctorTitle: s.doctorTitle || 'Cirurgia Plástica',
      logo: s.logoDataUrl || '', primary: s.brandPrimary || '#1f2430', accent: s.brandAccent || '#a8844f'
    },
    contacts: {
      commercial: { name: s.commercialName || 'Leise', role: 'Relacionamento Comercial', phone: s.commercialPhone || '+55 31 9999-8898', photo: s.commercialPhoto || '' },
      financial: { name: finName, role: 'Financeiro', phone: s.financialPhone || '+55 31 9885-4321', photo: s.financialPhoto || absolute('img/claudia.jpg') }
    },
    patient: { name: (patient.name || '').trim(), firstName: first },
    procedure: {
      title: proc.title || '', summary: proc.summary || '', minutes,
      durationLabel: minutes ? qDur(minutes) : '', periodLabel, anesthesiaLabel: anesLabel
    },
    team: {
      lines: tm.lines.map(l => ({ role: l.role, name: l.name, value: Number(l.value), discountable: !!l.discountable })),
      subtotal: tm.subtotal, discountLabel: 'Condição especial para você', discountAmount: tm.discountAmount,
      avistaAmount: tm.avistaAmount, total: tm.total,
      paymentLines: paymentPlanLines(data, tm.total),
      anesthetist
    },
    prosthesis: pros,
    hospital,
    partners,
    totals,
    texts: {
      headline: sub(std.headline), subtitle: sub(std.subtitle), closing: sub(std.closing),
      hospitalDisclaimer: hospital ? sub(std.hospitalDisclaimer) : '',
      steps: [
        { title: 'Exames', text: sub(std.step1) },
        { title: 'Nutrição', text: sub(std.step2) },
        { title: 'Pré-operatório', text: sub(std.step3) }
      ].filter(x => x.text.trim())
    }
  };
}

/* ---------------- etapas, validações e orientação ao operador ------------- */
const QUOTE_STEPS = [
  { id: 1, title: 'Paciente e cirurgia', short: 'Paciente',
    what: 'Informe quem é o paciente e qual cirurgia será feita. A duração prevista é o dado mais importante: ela define sozinha o valor do hospital e da anestesista nas próximas etapas.',
    next: 'Depois de preencher, clique em “Continuar” para montar a equipe.' },
  { id: 2, title: 'Equipe cirúrgica', short: 'Equipe',
    what: 'Marque quem participa e confirme os valores. Se houver negociação, aplique o desconto aqui: ele vale só para a equipe fixa do Dr. Roger e exige um motivo, para o orçamento ficar fiel ao combinado.',
    next: 'Em seguida você escolhe hospital e anestesista (cujos valores têm regras próprias).' },
  { id: 3, title: 'Hospital, anestesista e parceiros', short: 'Terceiros',
    what: 'Escolha o hospital e a anestesista. O valor já vem pela duração da cirurgia — você só confere período, tipo de anestesia, extras e descontos de cada um. Esses valores são pagos direto a eles, não à clínica.',
    next: 'Depois você define como o paciente paga a equipe.' },
  { id: 4, title: 'Pagamento e prótese', short: 'Pagamento',
    what: 'Defina como a equipe será paga (à vista, cartão ou entrada + parcelas) e, se houver, inclua a prótese (paga no pré-operatório). Defina também a validade da proposta.',
    next: 'Depois você revisa o PDF e a landing exatamente como o paciente verá.' },
  { id: 5, title: 'Revisão', short: 'Revisão',
    what: 'Confira o PDF e a landing ao lado, rolando até o fim. Veja se valores, nomes e textos estão fiéis à negociação. Só depois marque que conferiu.',
    next: 'Com a conferência feita, você poderá marcar o orçamento como pronto para envio.' },
  { id: 6, title: 'Marcar e enviar', short: 'Enviar',
    what: 'Ao clicar em “Marcar como pronto”, a landing é publicada e o link do paciente é gerado. Antes disso o link não existe — por isso a landing só abre depois desta etapa.',
    next: 'Copie a mensagem pronta e envie ao paciente.' }
];

function validateQuoteStep(step, data, ctx) {
  ctx = ctx || quoteCtx();
  const miss = [];
  const d = data || {};
  const p = d.patient || {}, proc = d.procedure || {};
  if (step === 1) {
    if (!(p.name || '').trim() || p.name.trim().length < 3) miss.push('Informe o nome do paciente.');
    if (!(proc.title || '').trim()) miss.push('Informe a cirurgia (ex.: Mamoplastia de aumento).');
    if (!(Number(proc.minutes) > 0)) miss.push('Escolha a duração prevista da cirurgia.');
    if (!proc.period) miss.push('Escolha o período (manhã ou tarde).');
    if (!proc.anesthesia) miss.push('Escolha o tipo de anestesia.');
  }
  if (step === 2) {
    const tm = computeTeam(d);
    if (!tm.lines.length) miss.push('Marque ao menos um integrante da equipe com valor maior que zero.');
    const disc = (d.team || {}).discount || {};
    if (Number(disc.value) > 0) {
      if (disc.type !== 'value' && Number(disc.value) > 100) miss.push('O desconto percentual não pode passar de 100%.');
      if (((disc.reason || '').trim()).length < 5) miss.push('Descreva o motivo/negociação do desconto (uso interno).');
    }
  }
  if (step === 3) {
    const t = d.thirdParties || {};
    if (!t.hospital || !t.hospital.tpId) miss.push('Escolha o hospital — ou marque “Sem hospital neste orçamento”.');
    if (!t.anestesista || !t.anestesista.tpId) miss.push('Escolha a anestesista — ou marque “Sem anestesista neste orçamento”.');
    const snap = buildQuoteSnapshot(d, ctx);
    [snap.hospital, snap.team.anesthetist, ...snap.partners].filter(Boolean).forEach(tp => {
      if (!(tp.total > 0)) miss.push(`O valor de “${tp.name}” está zerado — confira duração, período e tabela.`);
    });
  }
  if (step === 4) {
    const pay = d.payment || {};
    if (!pay.mode) miss.push('Escolha como a equipe será paga.');
    if (pay.mode === 'cartao' && !(Number(pay.installments) >= 1)) miss.push('Informe em quantas vezes no cartão.');
    if (pay.mode === 'entrada') {
      if (!(Number(pay.entry) > 0)) miss.push('Informe o valor da entrada.');
      if (!(Number(pay.installments) >= 1)) miss.push('Informe o número de parcelas do saldo.');
    }
    if (d.prosthesis && d.prosthesis.enabled && !(Number(d.prosthesis.value) > 0)) miss.push('Informe o valor da prótese ou desmarque a prótese.');
    if (!(Number(d.validityDays) >= 1)) miss.push('Informe a validade da proposta em dias.');
  }
  if (step === 5) {
    if (!d.reviewed) miss.push('Marque que você conferiu o PDF e a landing.');
  }
  return miss;
}

function validateQuoteUpTo(step, data, ctx) {
  for (let s = 1; s <= step; s++) {
    const m = validateQuoteStep(s, data, ctx);
    if (m.length) return { step: s, missing: m };
  }
  return null;
}

/* ---------------- código curto e personalizado da proposta ---------------- */
function slugName(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'proposta';
}
function newQuoteCode(name) {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
  let r = '';
  const buf = new Uint32Array(6);
  (window.crypto || window.msCrypto).getRandomValues(buf);
  buf.forEach(n => r += alphabet[n % alphabet.length]);
  return slugName((name || '').trim().split(/\s+/)[0]) + '-' + r;
}
function quoteLinkFor(code) {
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '').replace(/\?.*$/, '');
  return base + 'proposta.html?c=' + code;
}
function quoteShareMessage(snap, link) {
  const s = getSettings();
  const doctor = s.doctorName || 'Dr. Roger Vieira';
  return `Olá, ${snap.patient.firstName}! Aqui é da equipe do ${doctor}. Preparamos com muito carinho o seu plano, com tudo explicado com clareza e sem surpresas. Dá uma olhada com calma e, se quiser conversar, é só chamar a gente:\n${link}`;
}

/* ---------------- seed inicial ------------------------------------------- */
async function seedQuoteDataIfNeeded() {
  const s = getSettings();
  if (s.quoteSeeded) return;
  try {
    if (Store.all('thirdParties').length === 0) {
      await Store.add('thirdParties', { kind: 'hospital', name: 'Hospital Contorno (HPC)', active: true, config: seedHospitalConfig() });
      await Store.add('thirdParties', { kind: 'anestesista', name: 'Anestesista — tabela HPC 2025/26', active: true, config: seedAnesthetistConfig() });
    }
    if (Store.all('teamMembers').length === 0) {
      const roles = [['Cirurgião', 'Dr. Roger Vieira'], ['Cirurgião auxiliar', ''], ['Instrumentador(a)', '']];
      let i = 0;
      for (const [role, name] of roles) await Store.add('teamMembers', { role, name, value: 0, discountable: true, active: true, sort: i++ });
    }
    await saveSettings({
      quoteSeeded: true,
      doctorName: s.doctorName || 'Dr. Roger Vieira', doctorTitle: s.doctorTitle || 'Cirurgia Plástica',
      commercialName: s.commercialName || 'Leise', commercialPhone: s.commercialPhone || '+55 31 9999-8898',
      financialName: s.financialName || 'Cláudia', financialPhone: s.financialPhone || '+55 31 9885-4321'
    });
  } catch (e) {
    console.warn('Seed do orçamento não executado (rode a migração 4 no Supabase):', e.message);
  }
}
