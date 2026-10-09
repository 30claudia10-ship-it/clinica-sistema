/* ===========================================================================
   quotes-ui.js — telas do Orçamento Cirúrgico:
   • Configurações (identidade, equipe fixa, hospital, anestesista, terceiros, textos)
   • Construtor guiado em 6 etapas, com PDF e landing ao vivo
   • Lista de orçamentos
   =========================================================================== */

/* ---------------------------- utilidades --------------------------------- */
function qbGetPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function qbSetPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}
function readField(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.num != null) return el.value === '' ? '' : Number(el.value);
  return el.value;
}
function uid() { return 'i' + Math.random().toString(36).slice(2, 9); }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); ta.remove(); return Promise.resolve();
}
function fileToResizedDataUrl(file, max) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function openHtmlInNewTab(html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) { flash('error', 'O navegador bloqueou a nova aba. Permita pop-ups para este site.'); render(); }
}
function quoteTablesReady() { return !window.__quoteTablesMissing; }
function missingTablesNotice() {
  return `<div class="msg warn"><b>Falta um passo no banco de dados.</b> Abra o <b>SQL Editor</b> do Supabase e rode o arquivo <code>supabase/migration_4_orcamento.sql</code> (um único “Run”). Depois recarregue esta página.</div>`;
}
function money(v) { return qMoney(v); }

/* ======================================================================== */
/*  CONFIGURAÇÕES — abas                                                    */
/* ======================================================================== */
const CONFIG_TABS = [
  { id: 'clinica', label: 'Clínica' },
  { id: 'identidade', label: 'Identidade e contatos' },
  { id: 'equipe', label: 'Equipe fixa' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'anestesista', label: 'Anestesista' },
  { id: 'terceiros', label: 'Terceiros / Parceiros' },
  { id: 'textos', label: 'Textos padrão' }
];
function configTabsHtml(active) {
  return `<div class="tabs cfg-tabs">${CONFIG_TABS.map(t => `<button class="tab-btn ${t.id === active ? 'active' : ''}" data-cfg-tab="${t.id}">${t.label}</button>`).join('')}</div>`;
}
function bindConfigTabs() {
  document.querySelectorAll('[data-cfg-tab]').forEach(b => b.addEventListener('click', () => go('configuracoes/' + b.dataset.cfgTab)));
}

function renderConfiguracoes(tab) {
  tab = CONFIG_TABS.some(t => t.id === tab) ? tab : 'clinica';
  if (tab === 'clinica') return renderConfigClinica();
  if (!quoteTablesReady()) {
    setContent(topbar('Configurações', 'Orçamento cirúrgico') + configTabsHtml(tab) + missingTablesNotice());
    return bindConfigTabs();
  }
  if (tab === 'identidade') return renderConfigIdentidade();
  if (tab === 'equipe') return renderConfigEquipe();
  if (tab === 'textos') return renderConfigTextos();
  return renderConfigTp(tab === 'terceiros' ? 'parceiro' : tab);
}

/* ---------------------------- Identidade e contatos ---------------------- */
function renderConfigIdentidade() {
  const s = getSettings();
  const finPhoto = s.financialPhoto || 'img/claudia.jpg';
  const contactCard = (key, title, role, photo) => `
    <div class="card">
      <h3>${title}</h3>
      <div class="field-row">
        <div class="field"><label>Nome</label><input name="${key}Name" value="${esc(s[key + 'Name'] || '')}"></div>
        <div class="field"><label>Telefone (aparece no botão da landing)</label><input name="${key}Phone" value="${esc(s[key + 'Phone'] || '')}" placeholder="+55 31 ..."></div>
      </div>
      <div class="field"><label>Foto (opcional)</label>
        <div class="photo-row"><div class="avatar" id="av-${key}">${photo ? `<img src="${esc(photo)}">` : esc(qInitials(s[key + 'Name'] || '?'))}</div>
        <input type="file" accept="image/*" data-photo="${key}Photo"></div>
        <p class="hint">Papel exibido ao paciente: <b>${role}</b>.</p>
      </div>
    </div>`;
  setContent(`
    ${topbar('Configurações', 'Identidade do Dr. Roger usada no PDF e na landing, e os contatos dos botões')}
    ${configTabsHtml('identidade')}
    ${popFlash()}
    <form id="form-identity">
      <div class="grid-2">
        <div class="card">
          <h3>Identidade visual</h3>
          <div class="field-row">
            <div class="field"><label>Nome do médico</label><input name="doctorName" value="${esc(s.doctorName || '')}" placeholder="Dr. Roger Vieira"></div>
            <div class="field"><label>Especialidade / título</label><input name="doctorTitle" value="${esc(s.doctorTitle || '')}" placeholder="Cirurgia Plástica"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Cor principal</label><input type="color" name="brandPrimary" value="${esc(s.brandPrimary || '#1f2430')}"></div>
            <div class="field"><label>Cor de destaque</label><input type="color" name="brandAccent" value="${esc(s.brandAccent || '#a8844f')}"></div>
          </div>
          <p class="hint">A logo é a mesma da aba <a href="#/configuracoes/clinica">Clínica</a>. Envie a logo do Dr. Roger por lá e ajuste as duas cores aqui para casar com a marca dele.</p>
        </div>
        <div>
          ${contactCard('commercial', 'Relacionamento Comercial', 'Relacionamento Comercial', s.commercialPhoto)}
          ${contactCard('financial', 'Financeiro', 'Financeiro', finPhoto)}
        </div>
      </div>
      <div class="form-actions"><button class="btn" type="submit">Salvar identidade e contatos</button></div>
    </form>
  `);
  bindConfigTabs();
  const photos = { commercialPhoto: s.commercialPhoto || '', financialPhoto: s.financialPhoto || '' };
  document.querySelectorAll('[data-photo]').forEach(inp => inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    const url = await fileToResizedDataUrl(f, 420);
    photos[inp.dataset.photo] = url;
    const key = inp.dataset.photo.replace('Photo', '');
    document.getElementById('av-' + key).innerHTML = `<img src="${url}">`;
  }));
  document.getElementById('form-identity').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const patch = { commercialPhoto: photos.commercialPhoto, financialPhoto: photos.financialPhoto };
    ['doctorName', 'doctorTitle', 'brandPrimary', 'brandAccent', 'commercialName', 'commercialPhone', 'financialName', 'financialPhone']
      .forEach(k => patch[k] = String(fd.get(k) || '').trim());
    try { await saveSettings(patch); flash('success', 'Identidade e contatos salvos.'); }
    catch (err) { flash('error', err.message); }
    render();
  });
}

/* ---------------------------- Equipe fixa -------------------------------- */
function renderConfigEquipe() {
  const rows = Store.all('teamMembers').slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(m => ({ ...m }));
  const removed = [];
  const draw = () => {
    setContent(`
      ${topbar('Configurações', 'Equipe fixa do Dr. Roger — valores base de cada orçamento')}
      ${configTabsHtml('equipe')}
      ${popFlash()}
      <div class="card">
        <h3>Integrantes e valores</h3>
        <p class="hint">Estes valores entram automaticamente em todo orçamento novo (e podem ser ajustados orçamento a orçamento). Só as linhas marcadas como <b>“recebe desconto”</b> são afetadas pelo desconto negociado da equipe. A anestesista <b>não</b> está aqui: ela tem cadastro e regras próprias na aba Anestesista.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Função</th><th>Nome</th><th>Valor (R$)</th><th>Recebe desconto</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
          ${rows.map((m, i) => `<tr>
            <td><input data-i="${i}" data-k="role" value="${esc(m.role)}"></td>
            <td><input data-i="${i}" data-k="name" value="${esc(m.name || '')}"></td>
            <td><input type="number" step="0.01" min="0" data-i="${i}" data-k="value" value="${m.value}"></td>
            <td style="text-align:center"><input type="checkbox" data-i="${i}" data-k="discountable" ${m.discountable ? 'checked' : ''}></td>
            <td style="text-align:center"><input type="checkbox" data-i="${i}" data-k="active" ${m.active ? 'checked' : ''}></td>
            <td><button class="btn-icon" data-del="${i}" style="color:var(--vermelho)">Excluir</button></td></tr>`).join('') || `<tr class="empty-row"><td colspan="6">Nenhum integrante.</td></tr>`}
          </tbody></table></div>
        <div class="form-actions">
          <button class="btn secondary" id="add-member">+ Adicionar integrante</button>
          <button class="btn" id="save-team">Salvar equipe</button>
        </div>
      </div>`);
    bindConfigTabs();
    document.querySelectorAll('[data-k]').forEach(el => el.addEventListener('input', () => {
      const r = rows[Number(el.dataset.i)];
      r[el.dataset.k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const [r] = rows.splice(Number(b.dataset.del), 1); if (r.id) removed.push(r.id); draw();
    }));
    document.getElementById('add-member').addEventListener('click', () => {
      rows.push({ role: '', name: '', value: 0, discountable: true, active: true, sort: rows.length }); draw();
    });
    document.getElementById('save-team').addEventListener('click', async () => {
      if (rows.some(r => !String(r.role).trim())) { flash('error', 'Todo integrante precisa de uma função.'); return render(); }
      try {
        for (const id of removed) await Store.remove('teamMembers', id);
        let i = 0;
        for (const r of rows) {
          const payload = { role: r.role.trim(), name: (r.name || '').trim(), value: Number(r.value) || 0, discountable: !!r.discountable, active: !!r.active, sort: i++ };
          if (r.id) await Store.update('teamMembers', r.id, payload); else await Store.add('teamMembers', payload);
        }
        flash('success', 'Equipe salva.');
      } catch (err) { flash('error', err.message); }
      render();
    });
  };
  draw();
}

/* ---------------------------- Textos padrão ------------------------------ */
function renderConfigTextos() {
  const cur = getStdTexts();
  const area = (k, label, rows) => `<div class="field"><label>${label}</label><textarea name="${k}" rows="${rows || 3}">${esc(cur[k])}</textarea></div>`;
  setContent(`
    ${topbar('Configurações', 'Textos que aparecem na landing e no PDF')}
    ${configTabsHtml('textos')}
    ${popFlash()}
    <form id="form-texts">
      <div class="section-note">Você pode usar <b>{nome}</b> (primeiro nome do paciente), <b>{doutor}</b>, <b>{financeiro}</b> e <b>{comercial}</b> — o sistema troca na hora de gerar.</div>
      <div class="grid-2">
        <div class="card"><h3>Abertura da landing</h3>
          ${area('headline', 'Frase de abertura (lado humano)', 2)}
          ${area('subtitle', 'Subtítulo', 3)}
          ${area('closing', 'Chamada antes dos botões de contato', 3)}
        </div>
        <div class="card"><h3>Avisos obrigatórios</h3>
          ${area('prosthesisText', 'Prótese (aparece quando o orçamento tem prótese)', 2)}
          ${area('hospitalDisclaimer', 'Valores do hospital (aparece quando há hospital)', 8)}
        </div>
      </div>
      <div class="card"><h3>Próximos passos do paciente</h3>
        <div class="grid-3">
          ${area('step1', '1 · Exames', 3)}${area('step2', '2 · Nutrição', 3)}${area('step3', '3 · Pré-operatório', 3)}
        </div>
        <div class="field" style="max-width:220px"><label>Validade padrão da proposta (dias)</label><input type="number" min="1" name="validityDays" value="${esc(cur.validityDays)}"></div>
      </div>
      <div class="form-actions">
        <button class="btn" type="submit">Salvar textos</button>
        <button class="btn secondary" type="button" id="reset-texts">Restaurar padrão</button>
      </div>
    </form>`);
  bindConfigTabs();
  document.getElementById('form-texts').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const out = {};
    Object.keys(DEFAULT_STD_TEXTS).forEach(k => out[k] = k === 'validityDays' ? Number(fd.get(k)) || 15 : String(fd.get(k) || '').trim());
    try { await saveSettings({ stdTexts: out }); flash('success', 'Textos salvos.'); } catch (err) { flash('error', err.message); }
    render();
  });
  document.getElementById('reset-texts').addEventListener('click', async () => {
    if (!confirmAction('Voltar todos os textos ao padrão?')) return;
    await saveSettings({ stdTexts: null }); flash('success', 'Textos restaurados.'); render();
  });
}

/* ======================================================================== */
/*  CONFIGURAÇÕES — Hospital / Anestesista / Terceiros                      */
/* ======================================================================== */
const TP_LABELS = {
  hospital: { plural: 'Hospitais', one: 'hospital', sub: 'Tabela por hora (manhã/tarde), materiais, equipamentos, pacotes, descontos e condições' },
  anestesista: { plural: 'Anestesistas', one: 'anestesista', sub: 'Honorários por hora, condições de pagamento e descontos próprios' },
  parceiro: { plural: 'Terceiros / Parceiros', one: 'parceiro', sub: 'Outros prestadores (exames, nutrição, fornecedores…) com tabela e condições próprias' }
};
let tpEdit = null; // { id, kind, name, active, config }

function renderConfigTp(kind) {
  const L = TP_LABELS[kind];
  const list = Store.find('thirdParties', t => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  if (tpEdit && tpEdit.kind !== kind) tpEdit = null;
  setContent(`
    ${topbar('Configurações', L.sub)}
    ${configTabsHtml(kind === 'parceiro' ? 'terceiros' : kind)}
    ${popFlash()}
    <div class="card">
      <div class="card-head"><h3>${L.plural} cadastrados</h3><button class="btn" id="tp-new">+ Novo ${L.one}</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nome</th><th>Cobra</th><th>Pago a</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.length ? list.map(t => `<tr>
          <td><b>${esc(t.name)}</b></td>
          <td>${(t.config || {}).billingMode === 'hourly' ? 'Por hora' : 'Valor fixo / itens'}</td>
          <td>${esc((t.config || {}).payeeLabel || '—')}</td>
          <td>${t.active ? '<span class="pill green">Ativo</span>' : '<span class="pill gray">Inativo</span>'}</td>
          <td><button class="btn secondary sm" data-edit="${t.id}">Editar</button>
              <button class="btn-icon" data-del="${t.id}" style="color:var(--vermelho)">Excluir</button></td></tr>`).join('')
          : `<tr class="empty-row"><td colspan="5">Nenhum cadastro ainda. Clique em “+ Novo ${L.one}”.</td></tr>`}</tbody>
      </table></div>
    </div>
    <div id="tp-editor"></div>`);
  bindConfigTabs();
  document.getElementById('tp-new').addEventListener('click', () => {
    tpEdit = { id: null, kind, name: '', active: true, config: blankThirdPartyConfig(kind) };
    drawTpEditor(); document.getElementById('tp-editor').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const t = Store.get('thirdParties', b.dataset.edit);
    tpEdit = { id: t.id, kind: t.kind, name: t.name, active: t.active, config: deepClone(t.config || {}) };
    drawTpEditor(); document.getElementById('tp-editor').scrollIntoView({ behavior: 'smooth' });
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir este cadastro? Orçamentos já publicados não são afetados.')) return;
    await Store.remove('thirdParties', b.dataset.del); tpEdit = null; flash('success', 'Cadastro excluído.'); render();
  }));
  if (tpEdit) drawTpEditor();
}

function slugKey(label, existing) {
  let base = slugName(label) || 'k'; let k = base, n = 2;
  while ((existing || []).includes(k)) k = base + n++;
  return k;
}

function drawTpEditor() {
  const box = document.getElementById('tp-editor');
  if (!box || !tpEdit) return;
  const cfg = tpEdit.config;
  cfg.contact = cfg.contact || {}; cfg.periods = cfg.periods || []; cfg.columns = cfg.columns || [];
  cfg.tables = cfg.tables || {}; cfg.catalogs = cfg.catalogs || []; cfg.discounts = cfg.discounts || [];
  cfg.paymentOptions = cfg.paymentOptions || [];
  const hourly = cfg.billingMode === 'hourly';
  const P = (path, extra) => `data-path="${path}" ${extra || ''}`;

  const tablesHtml = cfg.periods.map(p => {
    const rows = cfg.tables[p.key] || (cfg.tables[p.key] = []);
    return `<div class="tp-table"><div class="sub-h">${esc(p.label)} <span class="hint">(${rows.length} linhas)</span></div>
      <div class="table-wrap" style="max-height:340px;overflow:auto"><table class="mini"><thead><tr><th>Duração (até)</th>${cfg.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr>
        <td><input data-t="time" data-p="${p.key}" data-i="${i}" value="${qDur(r.min)}" style="width:80px"></td>
        ${cfg.columns.map(c => `<td><input type="number" step="0.01" min="0" data-t="cell" data-p="${p.key}" data-i="${i}" data-c="${c.key}" value="${(r.v || {})[c.key] ?? ''}"></td>`).join('')}
        <td><button class="btn-icon" data-t="delrow" data-p="${p.key}" data-i="${i}">✕</button></td></tr>`).join('')}
      </tbody></table></div>
      <button class="btn secondary sm" data-t="addrow" data-p="${p.key}">+ Linha</button></div>`;
  }).join('');

  const catalogsHtml = cfg.catalogs.map((c, ci) => `
    <details class="cat" ${ci === 0 ? '' : ''}><summary><b>${esc(c.name || 'Catálogo')}</b> <span class="hint">${(c.items || []).length} itens · ${c.kind === 'package' ? 'pacotes' : 'itens avulsos'}</span></summary>
      <div class="field-row" style="margin-top:8px">
        <div class="field"><label>Nome do catálogo</label><input ${P(`config.catalogs.${ci}.name`)} value="${esc(c.name)}"></div>
        <div class="field" style="max-width:200px"><label>Tipo</label><select ${P(`config.catalogs.${ci}.kind`)}>
          <option value="items" ${c.kind !== 'package' ? 'selected' : ''}>Itens avulsos (soma ao total)</option>
          <option value="package" ${c.kind === 'package' ? 'selected' : ''}>Pacotes (substitui a taxa por hora)</option></select></div>
      </div>
      <div class="field"><label>Observação</label><input ${P(`config.catalogs.${ci}.note`)} value="${esc(c.note || '')}"></div>
      <table class="mini"><thead><tr><th>Item</th><th>Valor (R$)</th><th>Obs.</th><th></th></tr></thead><tbody>
      ${(c.items || []).map((it, ii) => `<tr>
        <td><input ${P(`config.catalogs.${ci}.items.${ii}.name`)} value="${esc(it.name)}"></td>
        <td><input type="number" step="0.01" min="0" data-num ${P(`config.catalogs.${ci}.items.${ii}.value`)} value="${it.value}" style="width:110px"></td>
        <td><input ${P(`config.catalogs.${ci}.items.${ii}.note`)} value="${esc(it.note || '')}"></td>
        <td><button class="btn-icon" data-t="delitem" data-ci="${ci}" data-ii="${ii}">✕</button></td></tr>`).join('')}
      </tbody></table>
      <div class="form-actions"><button class="btn secondary sm" data-t="additem" data-ci="${ci}">+ Item</button>
      <button class="btn danger sm" data-t="delcat" data-ci="${ci}">Remover catálogo</button></div>
    </details>`).join('');

  box.innerHTML = `
  <div class="card tp-editor">
    <div class="card-head"><h3>${tpEdit.id ? 'Editando' : 'Novo'}: ${esc(tpEdit.name || 'sem nome')}</h3>
      <div>
        <label class="btn secondary sm" style="display:inline-block;margin:0">Importar tabela<input type="file" id="tp-import" accept=".csv,.json,.txt" hidden></label>
        <button class="btn secondary sm" id="tp-csv">Baixar modelo CSV</button>
        <button class="btn secondary sm" id="tp-json">Exportar JSON</button>
      </div>
    </div>
    <div id="tp-import-msg"></div>

    <details open><summary><b>1 · Dados gerais</b></summary>
      <div class="field-row" style="margin-top:8px">
        <div class="field"><label>Nome *</label><input data-path="name" value="${esc(tpEdit.name)}" placeholder="Ex.: Hospital Contorno"></div>
        <div class="field"><label>Pago diretamente a (aparece ao paciente)</label><input ${P('config.payeeLabel')} value="${esc(cfg.payeeLabel || '')}"></div>
        <div class="field" style="max-width:130px"><label>Ativo</label><select data-path="active" data-bool><option value="1" ${tpEdit.active ? 'selected' : ''}>Sim</option><option value="0" ${!tpEdit.active ? 'selected' : ''}>Não</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Telefone</label><input ${P('config.contact.phone')} value="${esc(cfg.contact.phone || '')}"></div>
        <div class="field"><label>Site</label><input ${P('config.contact.site')} value="${esc(cfg.contact.site || '')}"></div>
        <div class="field"><label>Endereço</label><input ${P('config.contact.address')} value="${esc(cfg.contact.address || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Como cobra</label><select ${P('config.billingMode')} data-rerender>
          <option value="hourly" ${hourly ? 'selected' : ''}>Por hora (tabela de duração da cirurgia)</option>
          <option value="fixed" ${!hourly ? 'selected' : ''}>Valor fixo / apenas itens</option></select></div>
        ${hourly ? `<div class="field"><label>Variação possível (± %) — mostra faixa estimada</label><input type="number" min="0" max="100" data-num ${P('config.variancePct')} value="${cfg.variancePct || 0}"></div>`
          : `<div class="field"><label>Descrição do serviço</label><input ${P('config.fixedLabel')} value="${esc(cfg.fixedLabel || '')}"></div>
             <div class="field"><label>Valor padrão (R$)</label><input type="number" step="0.01" min="0" data-num ${P('config.fixedValue')} value="${cfg.fixedValue || 0}"></div>`}
      </div>
    </details>

    ${hourly ? `<details open><summary><b>2 · Tabela por hora</b></summary>
      <div class="grid-2" style="margin-top:8px">
        <div><div class="sub-h">Períodos</div>
          ${cfg.periods.map((p, i) => `<div class="inline-row"><input ${P(`config.periods.${i}.label`)} value="${esc(p.label)}"><button class="btn-icon" data-t="delperiod" data-i="${i}">✕</button></div>`).join('')}
          <button class="btn secondary sm" data-t="addperiod">+ Período</button>
          <p class="hint">Ex.: Manhã, Tarde. Anestesista costuma ter um único período.</p></div>
        <div><div class="sub-h">Colunas de preço</div>
          ${cfg.columns.map((c, i) => `<div class="inline-row"><input ${P(`config.columns.${i}.label`)} value="${esc(c.label)}"><button class="btn-icon" data-t="delcol" data-i="${i}">✕</button></div>`).join('')}
          <button class="btn secondary sm" data-t="addcol">+ Coluna</button>
          <p class="hint">Ex.: Local + sedação; Peridural/Geral.</p></div>
      </div>
      ${tablesHtml || '<p class="hint">Crie ao menos um período e uma coluna para montar a tabela.</p>'}
    </details>` : ''}

    <details open><summary><b>${hourly ? '3' : '2'} · Materiais, equipamentos, serviços e pacotes</b></summary>
      <div style="margin-top:8px">${catalogsHtml || '<p class="hint">Nenhum catálogo.</p>'}
      <button class="btn secondary sm" data-t="addcat">+ Catálogo</button></div>
    </details>

    <details><summary><b>${hourly ? '4' : '3'} · Descontos</b></summary>
      <div style="margin-top:8px">
      ${cfg.discounts.map((d, i) => `<div class="repeatable-item" style="flex-wrap:wrap">
        <div class="field" style="flex:3;min-width:220px"><label>Descrição</label><input ${P(`config.discounts.${i}.label`)} value="${esc(d.label)}"></div>
        <div class="field" style="max-width:90px"><label>%</label><input type="number" min="0" max="100" step="0.5" data-num ${P(`config.discounts.${i}.percent`)} value="${d.percent}"></div>
        <div class="field"><label>Incide sobre</label><select ${P(`config.discounts.${i}.appliesTo`)}><option value="base" ${d.appliesTo === 'base' ? 'selected' : ''}>Valor da hora</option><option value="total" ${d.appliesTo !== 'base' ? 'selected' : ''}>Total</option></select></div>
        <div class="field" style="max-width:140px"><label>Só até (min)</label><input type="number" min="0" step="15" data-num ${P(`config.discounts.${i}.maxMinutes`)} value="${d.maxMinutes || ''}" placeholder="sem limite"></div>
        <div class="field" style="flex:1;min-width:160px"><label>Só nas colunas</label>
          <div>${cfg.columns.map(c => `<label class="chk"><input type="checkbox" data-t="disccol" data-i="${i}" data-c="${c.key}" ${(d.onlyColumns || []).includes(c.key) ? 'checked' : ''}> ${esc(c.label)}</label>`).join('') || '<span class="hint">—</span>'}</div></div>
        <div class="field" style="flex-basis:100%"><label>Regra / observação</label><input ${P(`config.discounts.${i}.note`)} value="${esc(d.note || '')}"></div>
        <button class="btn-icon" data-t="deldisc" data-i="${i}">✕ remover</button></div>`).join('') || '<p class="hint">Nenhum desconto cadastrado.</p>'}
      <button class="btn secondary sm" data-t="adddisc">+ Desconto</button>
      <p class="hint">O operador escolhe, em cada orçamento, quais descontos se aplicam. Se nenhuma coluna for marcada, vale para todas.</p></div>
    </details>

    <details><summary><b>${hourly ? '5' : '4'} · Condições de pagamento e observações</b></summary>
      <div style="margin-top:8px">
      <div class="sub-h">Formas de pagamento selecionáveis no orçamento</div>
      ${cfg.paymentOptions.map((o, i) => `<div class="inline-row"><input ${P(`config.paymentOptions.${i}.label`)} value="${esc(o.label)}"><input type="number" min="0" max="100" step="0.5" data-num style="max-width:90px" ${P(`config.paymentOptions.${i}.discountPercent`)} value="${o.discountPercent || 0}" title="% de desconto"><span class="hint">% desc.</span><button class="btn-icon" data-t="delpay" data-i="${i}">✕</button></div>`).join('')}
      <button class="btn secondary sm" data-t="addpay">+ Forma de pagamento</button>
      <div class="field" style="margin-top:12px"><label>Condições exibidas ao paciente (uma por linha)</label><textarea rows="3" data-lines="config.paymentTerms">${esc((cfg.paymentTerms || []).join('\n'))}</textarea></div>
      <div class="field"><label>Observações exibidas ao paciente (uma por linha)</label><textarea rows="4" data-lines="config.notes">${esc((cfg.notes || []).join('\n'))}</textarea></div>
      <div class="field"><label>Observações internas — só para a equipe, nunca aparecem ao paciente</label><textarea rows="2" data-lines="config.internalNotes">${esc((cfg.internalNotes || []).join('\n'))}</textarea></div>
      </div>
    </details>

    <div class="form-actions"><button class="btn" id="tp-save">Salvar cadastro</button><button class="btn secondary" id="tp-cancel">Fechar</button></div>
  </div>`;

  bindTpEditor(box);
}

function bindTpEditor(box) {
  const cfg = tpEdit.config;
  const redraw = () => { const open = [...box.querySelectorAll('details')].map(d => d.open); drawTpEditor(); box.querySelectorAll('details').forEach((d, i) => { if (open[i] != null) d.open = open[i]; }); };

  box.addEventListener('input', onEdit); box.addEventListener('change', onEdit);
  function onEdit(e) {
    const el = e.target;
    if (el.dataset.path) {
      let v = readField(el);
      if (el.dataset.bool != null) v = el.value === '1';
      qbSetPath(tpEdit, el.dataset.path, v);
      if (el.dataset.rerender != null && e.type === 'change') redraw();
    } else if (el.dataset.lines) {
      qbSetPath(tpEdit, el.dataset.lines, el.value.split('\n').map(s => s.trim()).filter(Boolean));
    } else if (el.dataset.t === 'time' && e.type === 'change') {
      const rows = cfg.tables[el.dataset.p]; rows[Number(el.dataset.i)].min = parseDurationLabel(el.value) || rows[Number(el.dataset.i)].min;
      el.value = qDur(rows[Number(el.dataset.i)].min);
    } else if (el.dataset.t === 'cell') {
      const r = cfg.tables[el.dataset.p][Number(el.dataset.i)]; r.v = r.v || {}; r.v[el.dataset.c] = el.value === '' ? 0 : Number(el.value);
    } else if (el.dataset.t === 'disccol') {
      const d = cfg.discounts[Number(el.dataset.i)]; d.onlyColumns = d.onlyColumns || [];
      d.onlyColumns = d.onlyColumns.filter(c => c !== el.dataset.c); if (el.checked) d.onlyColumns.push(el.dataset.c);
    }
  }

  box.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.tagName === 'INPUT') return;
    const t = b.dataset.t, i = Number(b.dataset.i), p = b.dataset.p, ci = Number(b.dataset.ci), ii = Number(b.dataset.ii);
    const keys = a => a.map(x => x.key);
    if (t === 'addperiod') { const label = 'Novo período'; cfg.periods.push({ key: slugKey(label, keys(cfg.periods)), label }); cfg.tables[cfg.periods[cfg.periods.length - 1].key] = []; }
    else if (t === 'delperiod') { const [r] = cfg.periods.splice(i, 1); delete cfg.tables[r.key]; }
    else if (t === 'addcol') { const label = 'Nova coluna'; const k = slugKey(label, keys(cfg.columns)); cfg.columns.push({ key: k, label }); Object.values(cfg.tables).forEach(rows => rows.forEach(r => (r.v = r.v || {}, r.v[k] = 0))); }
    else if (t === 'delcol') cfg.columns.splice(i, 1);
    else if (t === 'addrow') { const rows = cfg.tables[p]; const last = rows[rows.length - 1]; const step = rows.length > 1 ? rows[rows.length - 1].min - rows[rows.length - 2].min : 30; const v = {}; cfg.columns.forEach(c => v[c.key] = 0); rows.push({ min: last ? last.min + step : 60, v }); }
    else if (t === 'delrow') cfg.tables[p].splice(i, 1);
    else if (t === 'addcat') cfg.catalogs.push({ id: uid(), name: 'Novo catálogo', kind: 'items', note: '', items: [] });
    else if (t === 'delcat') { if (!confirmAction('Remover este catálogo inteiro?')) return; cfg.catalogs.splice(ci, 1); }
    else if (t === 'additem') cfg.catalogs[ci].items.push({ id: uid(), name: '', value: 0, note: '' });
    else if (t === 'delitem') cfg.catalogs[ci].items.splice(ii, 1);
    else if (t === 'adddisc') cfg.discounts.push({ id: uid(), label: '', percent: 0, appliesTo: 'total', onlyColumns: [], maxMinutes: 0, note: '' });
    else if (t === 'deldisc') cfg.discounts.splice(i, 1);
    else if (t === 'addpay') cfg.paymentOptions.push({ id: uid(), label: '', discountPercent: 0 });
    else if (t === 'delpay') cfg.paymentOptions.splice(i, 1);
    else return;
    e.preventDefault(); redraw();
  });

  document.getElementById('tp-cancel').addEventListener('click', () => { tpEdit = null; box.innerHTML = ''; });
  document.getElementById('tp-save').addEventListener('click', async () => {
    if (!String(tpEdit.name).trim()) { flash('error', 'Dê um nome ao cadastro.'); return render(); }
    cfg.periods.forEach(p => { if (!p.key) p.key = slugKey(p.label); });
    cfg.discounts.forEach(d => { if (!d.id) d.id = uid(); });
    cfg.paymentOptions.forEach(o => { if (!o.id) o.id = uid(); });
    Object.values(cfg.tables).forEach(rows => rows.sort((a, b) => a.min - b.min));
    try {
      const payload = { name: tpEdit.name.trim(), active: !!tpEdit.active, config: cfg, kind: tpEdit.kind };
      if (tpEdit.id) await Store.update('thirdParties', tpEdit.id, payload);
      else { const row = await Store.add('thirdParties', payload); tpEdit.id = row.id; }
      flash('success', 'Cadastro salvo. Já pode ser usado nos orçamentos.');
    } catch (err) { flash('error', err.message); }
    render();
  });

  document.getElementById('tp-json').addEventListener('click', () => downloadFile(slugName(tpEdit.name) + '.json', JSON.stringify({ name: tpEdit.name, kind: tpEdit.kind, config: cfg }, null, 2), 'application/json'));
  document.getElementById('tp-csv').addEventListener('click', () => downloadFile(slugName(tpEdit.name) + '.csv', exportTpCsv(cfg), 'text/csv'));
  document.getElementById('tp-import').addEventListener('change', async ev => {
    const f = ev.target.files[0]; if (!f) return;
    const text = await f.text();
    const msgBox = document.getElementById('tp-import-msg');
    try {
      let summary;
      if (/\.json$/i.test(f.name) || text.trim().startsWith('{')) {
        const j = JSON.parse(text);
        tpEdit.config = Object.assign(blankThirdPartyConfig(tpEdit.kind), j.config || j);
        if (j.name && !tpEdit.name) tpEdit.name = j.name;
        summary = 'JSON importado.';
      } else {
        summary = importTpCsv(text, tpEdit.config);
      }
      redraw();
      document.getElementById('tp-import-msg').innerHTML = msg('success', esc(summary) + ' Confira e clique em “Salvar cadastro”.');
    } catch (err) {
      msgBox.innerHTML = msg('error', 'Não consegui importar: ' + esc(err.message));
    }
  });
}

/* ---------------- importação / modelo CSV --------------------------------- */
function parseMoneyBR(s) {
  s = String(s == null ? '' : s).replace(/R\$|\s/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s); return isNaN(n) ? 0 : n;
}
function exportTpCsv(cfg) {
  const L = ['# Modelo de importação — cada linha: tipo;campos separados por ponto e vírgula',
    '# periodo;chave;rotulo   |   coluna;chave;rotulo   |   hora;periodo;duracao;valor_col1;valor_col2...',
    '# catalogo;nome;itens|pacote   |   item;nome;valor;obs   (item pertence ao último catalogo)',
    '# desconto;rotulo;percentual;base|total;colunas(a|b);max_minutos;obs   |   pagamento;rotulo;desconto_pct',
    '# forma;texto   |   nota;texto   |   interna;texto   |   fixo;rotulo;valor   |   variacao;percentual'];
  (cfg.periods || []).forEach(p => L.push(`periodo;${p.key};${p.label}`));
  (cfg.columns || []).forEach(c => L.push(`coluna;${c.key};${c.label}`));
  (cfg.periods || []).forEach(p => ((cfg.tables || {})[p.key] || []).forEach(r =>
    L.push(`hora;${p.key};${qDur(r.min)};${(cfg.columns || []).map(c => (r.v || {})[c.key] ?? 0).join(';')}`)));
  (cfg.catalogs || []).forEach(c => { L.push(`catalogo;${c.name};${c.kind === 'package' ? 'pacote' : 'itens'}`); (c.items || []).forEach(i => L.push(`item;${i.name};${i.value};${i.note || ''}`)); });
  (cfg.discounts || []).forEach(d => L.push(`desconto;${d.label};${d.percent};${d.appliesTo || 'total'};${(d.onlyColumns || []).join('|')};${d.maxMinutes || ''};${d.note || ''}`));
  (cfg.paymentOptions || []).forEach(o => L.push(`pagamento;${o.label};${o.discountPercent || 0}`));
  (cfg.paymentTerms || []).forEach(t => L.push(`forma;${t}`));
  (cfg.notes || []).forEach(t => L.push(`nota;${t}`));
  (cfg.internalNotes || []).forEach(t => L.push(`interna;${t}`));
  if (cfg.billingMode === 'fixed') L.push(`fixo;${cfg.fixedLabel || ''};${cfg.fixedValue || 0}`);
  if (cfg.variancePct) L.push(`variacao;${cfg.variancePct}`);
  return '﻿' + L.join('\r\n');
}
function importTpCsv(text, cfg) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const touched = {};
  const reset = (k, fn) => { if (!touched[k]) { touched[k] = true; fn(); } };
  let cat = null, count = 0;
  for (const line of lines) {
    const f = line.split(';').map(s => s.trim());
    const t = f[0].toLowerCase();
    if (t === 'periodo') { reset('periodo', () => { cfg.periods = []; cfg.tables = {}; }); cfg.periods.push({ key: f[1], label: f[2] || f[1] }); cfg.tables[f[1]] = []; cfg.billingMode = 'hourly'; }
    else if (t === 'coluna') { reset('coluna', () => { cfg.columns = []; }); cfg.columns.push({ key: f[1], label: f[2] || f[1] }); }
    else if (t === 'hora') {
      const rows = cfg.tables[f[1]]; if (!rows) throw new Error(`Período "${f[1]}" não foi declarado antes da linha: ${line}`);
      const v = {}; (cfg.columns || []).forEach((c, i) => v[c.key] = parseMoneyBR(f[3 + i]));
      const min = parseDurationLabel(f[2]); if (!min) throw new Error('Duração inválida: ' + f[2]);
      rows.push({ min, v }); count++;
    }
    else if (t === 'catalogo') { reset('catalogo', () => { cfg.catalogs = []; }); cat = { id: uid(), name: f[1], kind: /pacote/i.test(f[2] || '') ? 'package' : 'items', note: '', items: [] }; cfg.catalogs.push(cat); }
    else if (t === 'item') { if (!cat) throw new Error('Linha "item" antes de um "catalogo": ' + line); cat.items.push({ id: uid(), name: f[1], value: parseMoneyBR(f[2]), note: f[3] || '' }); count++; }
    else if (t === 'desconto') { reset('desconto', () => { cfg.discounts = []; }); cfg.discounts.push({ id: uid(), label: f[1], percent: parseMoneyBR(f[2]), appliesTo: f[3] === 'base' ? 'base' : 'total', onlyColumns: (f[4] || '').split('|').filter(Boolean), maxMinutes: Number(f[5]) || 0, note: f[6] || '' }); }
    else if (t === 'pagamento') { reset('pagamento', () => { cfg.paymentOptions = []; }); cfg.paymentOptions.push({ id: uid(), label: f[1], discountPercent: parseMoneyBR(f[2]) }); }
    else if (t === 'forma') { reset('forma', () => { cfg.paymentTerms = []; }); cfg.paymentTerms.push(f.slice(1).join(';')); }
    else if (t === 'nota') { reset('nota', () => { cfg.notes = []; }); cfg.notes.push(f.slice(1).join(';')); }
    else if (t === 'interna') { reset('interna', () => { cfg.internalNotes = []; }); cfg.internalNotes.push(f.slice(1).join(';')); }
    else if (t === 'fixo') { cfg.billingMode = 'fixed'; cfg.fixedLabel = f[1]; cfg.fixedValue = parseMoneyBR(f[2]); }
    else if (t === 'variacao') cfg.variancePct = parseMoneyBR(f[1]);
    else throw new Error('Tipo de linha desconhecido: "' + f[0] + '"');
  }
  return `Importadas ${count} linhas de preço (${Object.keys(touched).length} seções atualizadas).`;
}

/* ======================================================================== */
/*  ORÇAMENTOS — lista                                                      */
/* ======================================================================== */
function quotePill(status) {
  const m = { rascunho: ['yellow', 'Rascunho'], publicado: ['green', 'Pronto · link ativo'], revogado: ['gray', 'Link desativado'] }[status] || ['gray', status];
  return `<span class="pill ${m[0]}">${m[1]}</span>`;
}
function renderOrcamentos() {
  if (!quoteTablesReady()) { setContent(topbar('Orçamentos') + missingTablesNotice()); return; }
  const list = Store.all('quotes').slice().sort((a, b) => (a.updatedAt || a.createdAt) < (b.updatedAt || b.createdAt) ? 1 : -1);
  setContent(`
    ${topbar('Orçamentos cirúrgicos', 'Rascunhos em andamento e propostas já enviadas')}
    ${popFlash()}
    <div class="card">
      <div class="card-head"><h3>${list.length} orçamento(s)</h3><a class="btn" href="#/orcamento">+ Novo orçamento</a></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Cirurgia</th><th>Etapa</th><th>Total estimado</th><th>Situação</th><th>Atualizado</th><th></th></tr></thead>
        <tbody>${list.length ? list.map(q => {
          const sn = q.snapshot; const d = q.data || {};
          let total = sn ? sn.totals.grand : null;
          if (total == null) { try { total = buildQuoteSnapshot(d).totals.grand; } catch (e) { total = 0; } }
          return `<tr>
            <td><b>${esc(q.patientName || '—')}</b></td><td>${esc((d.procedure || {}).title || '—')}</td>
            <td>${q.status === 'rascunho' ? `Etapa ${q.step} de 6` : 'Concluído'}</td>
            <td>${money(total)}</td><td>${quotePill(q.status)}</td><td>${fmtDate(q.updatedAt || q.createdAt)}</td>
            <td style="white-space:nowrap">
              <a class="btn secondary sm" href="#/orcamento/${q.id}">${q.status === 'rascunho' ? 'Continuar' : 'Abrir'}</a>
              ${q.status === 'publicado' ? `<button class="btn-icon" data-copy="${q.id}" title="Copiar link">Copiar link</button><button class="btn-icon" data-revoke="${q.id}" style="color:var(--vermelho)">Desativar</button>` : ''}
              <button class="btn-icon" data-del="${q.id}" style="color:var(--vermelho)">Excluir</button></td></tr>`;
        }).join('') : `<tr class="empty-row"><td colspan="7">Nenhum orçamento ainda. Clique em “+ Novo orçamento” — o sistema vai guiar cada passo.</td></tr>`}</tbody>
      </table></div>
    </div>`);
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const q = Store.get('quotes', b.dataset.copy); await copyText(quoteLinkFor(q.code)); b.textContent = 'Copiado ✓';
  }));
  document.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Desativar o link? O paciente deixará de conseguir abrir a proposta.')) return;
    await Store.update('quotes', b.dataset.revoke, { status: 'revogado', updatedAt: nowISO() }); flash('success', 'Link desativado.'); render();
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir este orçamento? Se já foi enviado, o link deixa de funcionar.')) return;
    await Store.remove('quotes', b.dataset.del); flash('success', 'Orçamento excluído.'); render();
  }));
}

/* ======================================================================== */
/*  CONSTRUTOR GUIADO                                                       */
/* ======================================================================== */
let QB = null; // estado do construtor
let qbTimer = null;

function newQuoteData() {
  const std = getStdTexts();
  const members = Store.find('teamMembers', m => m.active).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  return {
    patient: { name: '' },
    procedure: { title: '', summary: '', minutes: 0, period: '', anesthesia: '' },
    team: {
      lines: members.map(m => ({ memberId: m.id, role: m.role, name: m.name || '', value: Number(m.value) || 0, discountable: !!m.discountable, included: true })),
      discount: { type: 'percent', value: 0, reason: '' }
    },
    thirdParties: { hospital: null, anestesista: null, partners: [] },
    payment: { mode: '', avistaPct: 0, installments: 1, entry: 0, note: '' },
    prosthesis: { enabled: false, description: '', value: 0 },
    validityDays: Number(std.validityDays) || 15,
    reviewed: false
  };
}

function renderOrcamento(param) {
  if (!quoteTablesReady()) { setContent(topbar('Novo orçamento') + missingTablesNotice()); return; }
  if (!param || param === 'novo') {
    if (!QB || QB.id || param === 'novo' || !QB.fresh) {
      QB = { id: null, code: null, status: 'rascunho', step: 1, maxStep: 1, data: newQuoteData(), previewTab: 'landing', fresh: true };
    }
  } else if (!QB || QB.id !== param) {
    const q = Store.get('quotes', param);
    if (!q) { flash('error', 'Orçamento não encontrado.'); return go('orcamentos'); }
    const base = newQuoteData();
    const data = Object.assign(base, deepClone(q.data || {}));
    QB = { id: q.id, code: q.code, status: q.status, step: Math.min(6, q.status === 'rascunho' ? q.step : 1), maxStep: q.status === 'rascunho' ? q.step : 6, data, previewTab: 'landing', published: q.status === 'publicado' };
    if (q.status !== 'rascunho') QB.step = 1;
  }
  drawBuilder();
}

function drawBuilder() {
  const q = QB; const d = q.data;
  const step = QUOTE_STEPS[q.step - 1];
  setContent(`
    ${topbar('Orçamento cirúrgico', q.id ? esc(d.patient.name || 'Rascunho') : 'Novo orçamento — siga as etapas na ordem')}
    ${popFlash()}
    ${q.status === 'publicado' ? msg('warn', 'Esta proposta <b>já está publicada</b>. Mudanças só chegam ao paciente quando você clicar em “Atualizar proposta” na última etapa.') : ''}
    ${q.status === 'revogado' ? msg('warn', 'O link desta proposta está desativado. Publique novamente na última etapa para reativar.') : ''}
    <div class="qb">
      <div class="qb-main">
        <ol class="stepper">${QUOTE_STEPS.map(s => {
          const st = s.id === q.step ? 'current' : (s.id < q.maxStep || (s.id < q.step) ? 'done' : (s.id <= q.maxStep ? 'open' : 'locked'));
          const clickable = s.id <= q.maxStep;
          return `<li class="${st}"><button ${clickable ? '' : 'disabled'} data-goto="${s.id}"><span class="dot">${st === 'done' ? '✓' : s.id}</span><span class="lbl">${s.short}</span></button></li>`;
        }).join('')}</ol>

        <div class="coach" id="coach">
          <div class="coach-top"><span class="coach-badge">Etapa ${step.id} de 6</span><b>${step.title}</b></div>
          <p>${step.what}</p>
          <div id="coach-missing"></div>
          <p class="coach-next"><b>Próximo passo:</b> ${step.next}</p>
        </div>

        <div class="card qb-step" id="qb-step">${stepBody(q.step)}</div>

        <div class="qb-nav">
          <button class="btn secondary" id="qb-back" ${q.step === 1 ? 'disabled' : ''}>← Voltar</button>
          <button class="btn secondary" id="qb-save">Salvar rascunho</button>
          ${q.step < 6 ? `<button class="btn" id="qb-next">Continuar →</button>` : ''}
        </div>
      </div>

      <aside class="qb-preview">
        <div class="qb-prev-head">
          <div class="seg"><button data-pv="landing" class="${q.previewTab === 'landing' ? 'on' : ''}">Landing</button><button data-pv="pdf" class="${q.previewTab === 'pdf' ? 'on' : ''}">PDF</button></div>
          <div class="prev-actions">
            <button class="btn-icon" id="pv-open" title="Abrir em tela cheia">Tela cheia ↗</button>
            <button class="btn-icon" id="pv-print" title="Imprimir / salvar em PDF">Imprimir PDF</button>
          </div>
        </div>
        <div class="prev-note">Pré-visualização ao vivo. O link do paciente só existe depois de “Marcar como pronto”.</div>
        <iframe id="pv-frame" title="Pré-visualização"></iframe>
      </aside>
    </div>`);

  bindBuilder();
  refreshLive();
}

/* ---- corpo de cada etapa ------------------------------------------------- */
const F = (path, val, extra) => `data-path="${path}" ${extra || ''} value="${esc(val == null ? '' : val)}"`;

function stepBody(n) {
  const d = QB.data;
  if (n === 1) return `
    <h3>Quem é o paciente e qual a cirurgia?</h3>
    <div class="field-row">
      <div class="field"><label>Nome completo do paciente *</label><input ${F('patient.name', d.patient.name)} placeholder="Ex.: Maria da Silva" autocomplete="off"></div>
    </div>
    <div class="field-row">
      <div class="field" style="flex:2"><label>Cirurgia / procedimento *</label><input ${F('procedure.title', d.procedure.title)} placeholder="Ex.: Mamoplastia de aumento + Abdominoplastia"></div>
    </div>
    <div class="field"><label>Resumo para o paciente (opcional)</label><textarea rows="2" data-path="procedure.summary" placeholder="Uma frase explicando o que será feito, em linguagem simples.">${esc(d.procedure.summary)}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Duração prevista da cirurgia *</label>
        <select data-path="procedure.minutes" data-num data-rerender><option value="">Selecione…</option>${durationOptions(d.procedure.minutes)}</select>
        <p class="hint">Define sozinha o valor do hospital e da anestesista.</p></div>
      <div class="field"><label>Período *</label>
        <select data-path="procedure.period"><option value="">Selecione…</option>
          <option value="manha" ${d.procedure.period === 'manha' ? 'selected' : ''}>Manhã</option>
          <option value="tarde" ${d.procedure.period === 'tarde' ? 'selected' : ''}>Tarde (início após 14h)</option></select></div>
      <div class="field"><label>Tipo de anestesia *</label>
        <select data-path="procedure.anesthesia"><option value="">Selecione…</option>
          <option value="local" ${d.procedure.anesthesia === 'local' ? 'selected' : ''}>Local + sedação</option>
          <option value="geral" ${d.procedure.anesthesia === 'geral' ? 'selected' : ''}>Peridural / Raqui / Geral</option></select></div>
    </div>`;

  if (n === 2) {
    return `
    <h3>Equipe cirúrgica do Dr. Roger</h3>
    <div class="table-wrap"><table>
      <thead><tr><th style="width:44px">Inclui</th><th>Função</th><th>Nome</th><th style="width:140px">Valor (R$)</th><th style="width:110px">Recebe desconto</th><th></th></tr></thead>
      <tbody>${d.team.lines.map((l, i) => `<tr>
        <td style="text-align:center"><input type="checkbox" data-path="team.lines.${i}.included" ${l.included ? 'checked' : ''}></td>
        <td><input ${F(`team.lines.${i}.role`, l.role)}></td>
        <td><input ${F(`team.lines.${i}.name`, l.name)}></td>
        <td><input type="number" step="0.01" min="0" data-num ${F(`team.lines.${i}.value`, l.value)}></td>
        <td style="text-align:center"><input type="checkbox" data-path="team.lines.${i}.discountable" ${l.discountable ? 'checked' : ''}></td>
        <td>${l.memberId ? '' : `<button class="btn-icon" data-rmline="${i}">✕</button>`}</td></tr>`).join('') || '<tr class="empty-row"><td colspan="6">Nenhum integrante cadastrado — cadastre em Configurações → Equipe fixa.</td></tr>'}</tbody>
    </table></div>
    <button class="btn secondary sm" id="add-line">+ Linha avulsa</button>
    <div class="callout" style="margin-top:14px">A <b>anestesista</b> aparece junto da equipe para o paciente, mas o valor dela vem da tabela dela (etapa 3) e <b>não recebe</b> o desconto abaixo.</div>
    <fieldset style="margin-top:14px"><legend>Desconto negociado (só equipe fixa)</legend>
      <div class="field-row">
        <div class="field" style="max-width:170px"><label>Tipo</label><select data-path="team.discount.type" data-rerender><option value="percent" ${d.team.discount.type !== 'value' ? 'selected' : ''}>Percentual (%)</option><option value="value" ${d.team.discount.type === 'value' ? 'selected' : ''}>Valor (R$)</option></select></div>
        <div class="field" style="max-width:170px"><label>Desconto</label><input type="number" step="0.01" min="0" data-num ${F('team.discount.value', d.team.discount.value || '')} placeholder="0"></div>
        <div class="field"><label>Motivo / negociação (uso interno — obrigatório se houver desconto)</label><input ${F('team.discount.reason', d.team.discount.reason)} placeholder="Ex.: combinado com o Dr. Roger na consulta de 12/10"></div>
      </div>
    </fieldset>
    <div id="team-live" class="live-box"></div>`;
  }

  if (n === 3) return step3Body();

  if (n === 4) return `
    <h3>Como a equipe será paga</h3>
    <div class="pay-modes">
      ${[['avista', 'À vista', 'Pix ou transferência, com desconto opcional'], ['cartao', 'Cartão de crédito', 'Parcelado em N vezes'], ['entrada', 'Entrada + parcelas', 'Entrada na confirmação e saldo parcelado']].map(([k, t, s]) => `
        <label class="pay-mode ${d.payment.mode === k ? 'on' : ''}"><input type="radio" name="paymode" data-path="payment.mode" value="${k}" data-rerender ${d.payment.mode === k ? 'checked' : ''}><b>${t}</b><span>${s}</span></label>`).join('')}
    </div>
    <div class="field-row" style="margin-top:12px">
      ${d.payment.mode === 'avista' ? `<div class="field" style="max-width:240px"><label>Desconto à vista (% sobre a equipe com desconto)</label><input type="number" step="0.5" min="0" max="100" data-num ${F('payment.avistaPct', d.payment.avistaPct || '')} placeholder="0"></div>` : ''}
      ${d.payment.mode === 'entrada' ? `<div class="field" style="max-width:220px"><label>Valor da entrada (R$)</label><input type="number" step="0.01" min="0" data-num ${F('payment.entry', d.payment.entry || '')}></div>` : ''}
      ${d.payment.mode === 'cartao' || d.payment.mode === 'entrada' ? `<div class="field" style="max-width:200px"><label>Nº de parcelas</label><input type="number" min="1" max="24" data-num ${F('payment.installments', d.payment.installments)}></div>` : ''}
    </div>
    <div class="field"><label>Observação sobre o pagamento (opcional, aparece ao paciente)</label><input ${F('payment.note', d.payment.note)}></div>
    <div id="pay-live" class="live-box"></div>

    <fieldset style="margin-top:16px"><legend>Prótese</legend>
      <label class="chk"><input type="checkbox" data-path="prosthesis.enabled" data-rerender ${d.prosthesis.enabled ? 'checked' : ''}> Este orçamento inclui prótese</label>
      ${d.prosthesis.enabled ? `<div class="field-row" style="margin-top:8px">
        <div class="field" style="flex:2"><label>Descrição</label><input ${F('prosthesis.description', d.prosthesis.description)} placeholder="Ex.: Prótese mamária de silicone 280cc (par)"></div>
        <div class="field"><label>Valor (R$)</label><input type="number" step="0.01" min="0" data-num ${F('prosthesis.value', d.prosthesis.value || '')}></div></div>
        <div class="callout">Aviso automático ao paciente: <i>${esc(getStdTexts().prosthesisText)}</i></div>` : ''}
    </fieldset>
    <div class="field" style="max-width:260px;margin-top:14px"><label>Validade da proposta (dias)</label><input type="number" min="1" data-num ${F('validityDays', d.validityDays)}></div>`;

  if (n === 5) return `
    <h3>Revisão final</h3>
    <p>Use o painel ao lado: alterne entre <b>Landing</b> e <b>PDF</b>, role até o fim e confira nomes, valores, a separação entre equipe, anestesista e hospital, e os textos.</p>
    <div id="review-list"></div>
    <label class="chk big"><input type="checkbox" data-path="reviewed" data-rerender ${d.reviewed ? 'checked' : ''}> Conferi o PDF e a landing e tudo está fiel à negociação com o paciente.</label>`;

  if (n === 6) return step6Body();
  return '';
}

function tpOptions(kind, selId) {
  const items = Store.find('thirdParties', t => t.kind === kind && t.active).sort((a, b) => a.name.localeCompare(b.name));
  return `<option value="">Selecione…</option>${items.map(t => `<option value="${t.id}" ${t.id === selId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    <option value="none" ${selId === 'none' ? 'selected' : ''}>— Sem ${kind === 'hospital' ? 'hospital' : 'anestesista'} neste orçamento —</option>`;
}

function step3Body() {
  const d = QB.data; const t = d.thirdParties;
  const parceiros = Store.find('thirdParties', x => x.kind === 'parceiro' && x.active);
  const block = (kind, title, hint) => {
    const sel = t[kind];
    return `<div class="tp-block" data-block="${kind}">
      <div class="tp-head"><h4>${title}</h4>${hint}</div>
      <div class="field"><select data-path="thirdParties.${kind}.tpId" data-tpchoice="${kind}">${tpOptions(kind, sel && sel.tpId)}</select></div>
      ${sel && sel.tpId && sel.tpId !== 'none' ? tpEditorHtml(kind, sel) : ''}
      ${sel && sel.tpId === 'none' ? `<p class="hint">Este orçamento não inclui ${kind === 'hospital' ? 'hospital' : 'anestesista'}. O paciente verá apenas a equipe.</p>` : ''}
    </div>`;
  };
  return `
    <h3>Hospital, anestesista e parceiros</h3>
    <div class="callout">Os valores abaixo <b>já vêm calculados pela duração da cirurgia</b> (${d.procedure.minutes ? qDur(d.procedure.minutes) : '—'}). Você só confere período, anestesia, extras e descontos de cada um — e pode ajustar a duração individualmente.</div>
    ${block('hospital', 'Hospital', '<span class="direct">pago direto ao hospital</span>')}
    ${block('anestesista', 'Anestesista', '<span class="direct">pago direto à anestesista · aparece junto da equipe</span>')}
    <div class="tp-block"><div class="tp-head"><h4>Terceiros / parceiros (opcional)</h4></div>
      ${parceiros.length ? parceiros.map(p => {
        const idx = t.partners.findIndex(s => s.tpId === p.id);
        return `<label class="chk"><input type="checkbox" data-partner="${p.id}" ${idx >= 0 ? 'checked' : ''}> ${esc(p.name)}</label>
          ${idx >= 0 ? tpEditorHtml('partners.' + idx, t.partners[idx]) : ''}`;
      }).join('') : '<p class="hint">Nenhum parceiro cadastrado. Cadastre em Configurações → Terceiros / Parceiros.</p>'}
    </div>`;
}

function tpEditorHtml(key, sel) {
  const tpId = sel.tpId; const tp = Store.get('thirdParties', tpId);
  if (!tp) return '<p class="hint">Cadastro não encontrado.</p>';
  const cfg = tp.config || {}; const d = QB.data; const base = 'thirdParties.' + key;
  const sP = (cfg.periods || []).length > 1, sC = (cfg.columns || []).length > 1;
  const pkgCats = (cfg.catalogs || []).filter(c => c.kind === 'package');
  const itemCats = (cfg.catalogs || []).filter(c => c.kind !== 'package');
  const exOf = id => (sel.extras || []).find(e => e.itemId === id);
  return `<div class="tp-ed" data-key="${key}">
    <div class="field-row">
      ${cfg.billingMode === 'hourly' ? `<div class="field"><label>Duração considerada</label><select data-path="${base}.minutes" data-num><option value="">Mesma da cirurgia (${d.procedure.minutes ? qDur(d.procedure.minutes) : '—'})</option>${durationOptions(sel.minutes)}</select></div>` : ''}
      ${sP ? `<div class="field"><label>Período</label><select data-path="${base}.period"><option value="">Da cirurgia (${d.procedure.period === 'tarde' ? 'tarde' : d.procedure.period === 'manha' ? 'manhã' : '—'})</option>${cfg.periods.map(p => `<option value="${p.key}" ${sel.period === p.key ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></div>` : ''}
      ${sC ? `<div class="field"><label>Anestesia / coluna de preço</label><select data-path="${base}.column"><option value="">Da cirurgia</option>${cfg.columns.map(c => `<option value="${c.key}" ${sel.column === c.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>` : ''}
      ${cfg.billingMode !== 'hourly' ? `<div class="field"><label>${esc(cfg.fixedLabel || 'Valor do serviço')} (R$)</label><input type="number" step="0.01" min="0" data-num data-path="${base}.fixedValue" value="${sel.fixedValue != null && sel.fixedValue !== '' ? sel.fixedValue : (cfg.fixedValue || 0)}"></div>` : ''}
    </div>
    ${pkgCats.map(c => `<div class="field"><label>${esc(c.name)}</label><select data-path="${base}.packageId"><option value="">Sem pacote (cobrar taxa por hora)</option>${(c.items || []).map(i => `<option value="${i.id}" ${sel.packageId === i.id ? 'selected' : ''}>${esc(i.name)} — ${money(i.value)}</option>`).join('')}</select>${c.note ? `<p class="hint">${esc(c.note)}</p>` : ''}</div>`).join('')}
    ${itemCats.map(c => `<details class="cat"><summary>${esc(c.name)} <span class="hint">${(sel.extras || []).filter(e => (c.items || []).some(i => i.id === e.itemId)).length} selecionado(s)</span></summary>
      <table class="mini"><tbody>${(c.items || []).map(i => { const ex = exOf(i.id); return `<tr>
        <td style="width:30px"><input type="checkbox" data-extra="${i.id}" ${ex ? 'checked' : ''}></td>
        <td>${esc(i.name)}${i.note ? ` <span class="hint">· ${esc(i.note)}</span>` : ''}</td>
        <td style="width:70px"><input type="number" min="1" step="1" data-exqty="${i.id}" value="${ex ? ex.qty : 1}" title="Qtd"></td>
        <td style="width:110px"><input type="number" min="0" step="0.01" data-exval="${i.id}" value="${ex && ex.value !== '' && ex.value != null ? ex.value : i.value}" title="Valor unitário"></td></tr>`; }).join('')}</tbody></table></details>`).join('')}
    ${(cfg.discounts || []).length ? `<div class="field"><label>Descontos deste prestador</label>${cfg.discounts.map(x => `<label class="chk"><input type="checkbox" data-disc="${x.id}" ${(sel.discountIds || []).includes(x.id) ? 'checked' : ''}> ${esc(x.label)}${x.note ? ` <span class="hint">— ${esc(x.note)}</span>` : ''}</label>`).join('')}</div>` : ''}
    ${(cfg.paymentOptions || []).length ? `<div class="field"><label>Forma de pagamento escolhida</label><select data-path="${base}.paymentOptionId"><option value="">Não definida</option>${cfg.paymentOptions.map(o => `<option value="${o.id}" ${sel.paymentOptionId === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>` : ''}
    <div class="tp-result" data-result="${key}"></div>
    ${(cfg.internalNotes || []).length ? `<p class="hint">🔒 Interno: ${esc(cfg.internalNotes.join(' · '))}</p>` : ''}
  </div>`;
}

function step6Body() {
  const q = QB;
  const bad = validateQuoteUpTo(5, q.data);
  if (bad) return `<h3>Ainda falta algo</h3>${msg('error', `A etapa <b>${bad.step} — ${QUOTE_STEPS[bad.step - 1].title}</b> tem pendências. <a href="#" data-goto-link="${bad.step}">Ir corrigir</a>.`)}`;
  const isPub = q.status === 'publicado';
  const link = q.code ? quoteLinkFor(q.code) : '';
  let msgBlock = '';
  if (q.code && (isPub)) {
    const snap = q.snapshotCache || (Store.get('quotes', q.id) || {}).snapshot || buildQuoteSnapshot(q.data, undefined, q.code);
    msgBlock = `
      <div class="success-box">
        <div class="ok-mark">✓</div><h3>Proposta pronta e link ativo</h3>
        <div class="link-box" id="final-link"><span style="flex:1">${esc(link)}</span><button class="btn sm" id="copy-link">Copiar link</button></div>
        <div class="field" style="margin-top:12px"><label>Mensagem pronta para enviar ao paciente</label>
          <textarea rows="5" id="share-msg">${esc(quoteShareMessage(snap, link))}</textarea>
          <div class="form-actions"><button class="btn secondary sm" id="copy-msg">Copiar mensagem</button><button class="btn secondary sm" id="open-live">Abrir a landing publicada</button></div></div>
      </div>`;
  }
  return `
    <h3>${isPub ? 'Atualizar ou desativar a proposta' : 'Marcar como pronto e gerar o link'}</h3>
    ${isPub ? '' : `<p>Tudo conferido. Ao clicar no botão abaixo, a landing é <b>publicada</b> e o link do paciente é gerado. <b>Enquanto você não marcar como pronto, o link não existe</b> — por isso a landing só abre depois deste passo.</p>`}
    <div class="form-actions">
      <button class="btn big" id="qb-publish">${isPub ? 'Atualizar proposta publicada' : '✓ Marcar como pronto e gerar link'}</button>
      ${isPub ? `<button class="btn danger" id="qb-revoke">Desativar link</button>` : ''}
    </div>
    ${msgBlock}`;
}

/* ---- bindings ------------------------------------------------------------ */
function bindBuilder() {
  const root = document.getElementById('content');
  document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => gotoStep(Number(b.dataset.goto))));
  document.querySelectorAll('[data-goto-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); gotoStep(Number(a.dataset.gotoLink)); }));
  document.getElementById('qb-back').addEventListener('click', () => gotoStep(QB.step - 1));
  document.getElementById('qb-save').addEventListener('click', async () => { await saveDraft(); flash('success', 'Rascunho salvo.'); drawBuilder(); });
  const next = document.getElementById('qb-next');
  if (next) next.addEventListener('click', onNext);
  document.querySelectorAll('[data-pv]').forEach(b => b.addEventListener('click', () => { QB.previewTab = b.dataset.pv; document.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('on', x === b)); refreshPreview(); }));
  document.getElementById('pv-open').addEventListener('click', () => openHtmlInNewTab(currentPreviewHtml()));
  document.getElementById('pv-print').addEventListener('click', () => {
    if (QB.previewTab !== 'pdf') { QB.previewTab = 'pdf'; document.querySelectorAll('[data-pv]').forEach(x => x.classList.toggle('on', x.dataset.pv === 'pdf')); refreshPreview(); }
    setTimeout(() => { const f = document.getElementById('pv-frame'); f.contentWindow.focus(); f.contentWindow.print(); }, 700);
  });

  const step = document.getElementById('qb-step');
  step.addEventListener('input', onStepInput);
  step.addEventListener('change', onStepInput);
  step.addEventListener('click', onStepClick);

  const pub = document.getElementById('qb-publish'); if (pub) pub.addEventListener('click', publishQuote);
  const rev = document.getElementById('qb-revoke'); if (rev) rev.addEventListener('click', async () => {
    if (!confirmAction('Desativar o link? O paciente deixará de abrir a proposta.')) return;
    await Store.update('quotes', QB.id, { status: 'revogado', updatedAt: nowISO() }); QB.status = 'revogado'; flash('success', 'Link desativado.'); drawBuilder();
  });
  const cl = document.getElementById('copy-link'); if (cl) cl.addEventListener('click', async () => { await copyText(quoteLinkFor(QB.code)); cl.textContent = 'Copiado ✓'; });
  const cm = document.getElementById('copy-msg'); if (cm) cm.addEventListener('click', async () => { await copyText(document.getElementById('share-msg').value); cm.textContent = 'Copiado ✓'; });
  const ol = document.getElementById('open-live'); if (ol) ol.addEventListener('click', () => window.open(quoteLinkFor(QB.code), '_blank'));
}

function gotoStep(n) {
  if (n < 1 || n > QB.maxStep) return;
  QB.step = n; drawBuilder();
}

async function onNext() {
  const miss = validateQuoteStep(QB.step, QB.data);
  if (miss.length) {
    const box = document.getElementById('coach'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  QB.maxStep = Math.max(QB.maxStep, QB.step + 1);
  try { await saveDraft(); } catch (e) { flash('error', 'Não foi possível salvar: ' + e.message); }
  QB.step += 1; drawBuilder(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onStepInput(e) {
  const el = e.target; const d = QB.data;
  let changedStructure = false;

  if (el.dataset.path) {
    if (el.type === 'radio' && !el.checked) return;
    let v = readField(el);
    if (el.dataset.tpchoice) {
      const kind = el.dataset.tpchoice;
      d.thirdParties[kind] = v ? { tpId: v, extras: [], discountIds: [] } : null;
      changedStructure = true;
    } else {
      qbSetPath(d, el.dataset.path, v);
      if (el.dataset.path === 'procedure.minutes') changedStructure = false;
    }
    if (el.dataset.rerender != null && e.type === 'change') changedStructure = true;
    if (el.dataset.path === 'reviewed') d.reviewed = !!v;
  } else if (el.dataset.partner) {
    const ps = d.thirdParties.partners; const i = ps.findIndex(s => s.tpId === el.dataset.partner);
    if (el.checked && i < 0) ps.push({ tpId: el.dataset.partner, extras: [], discountIds: [] });
    if (!el.checked && i >= 0) ps.splice(i, 1);
    changedStructure = true;
  } else if (el.dataset.extra || el.dataset.exqty || el.dataset.exval || el.dataset.disc) {
    const ed = el.closest('.tp-ed'); const sel = qbGetPath(d.thirdParties, ed.dataset.key);
    sel.extras = [...ed.querySelectorAll('[data-extra]')].filter(c => c.checked).map(c => {
      const id = c.dataset.extra;
      return { itemId: id, qty: Number(ed.querySelector(`[data-exqty="${id}"]`).value) || 1, value: ed.querySelector(`[data-exval="${id}"]`).value };
    });
    sel.discountIds = [...ed.querySelectorAll('[data-disc]')].filter(c => c.checked).map(c => c.dataset.disc);
  } else return;

  // havendo mudança de etapas anteriores, a conferência final precisa ser refeita
  if (QB.step < 5 && d.reviewed) d.reviewed = false;

  if (changedStructure) {
    const body = document.getElementById('qb-step');
    const scroll = window.scrollY;
    body.innerHTML = stepBody(QB.step); window.scrollTo(0, scroll);
  }
  if (el.dataset.path === 'reviewed') { /* só atualiza o coach */ }
  refreshLive();
}

function onStepClick(e) {
  const d = QB.data;
  const rm = e.target.closest('[data-rmline]');
  if (rm) { d.team.lines.splice(Number(rm.dataset.rmline), 1); document.getElementById('qb-step').innerHTML = stepBody(2); refreshLive(); return; }
  if (e.target.id === 'add-line') {
    d.team.lines.push({ memberId: null, role: 'Nova função', name: '', value: 0, discountable: true, included: true });
    document.getElementById('qb-step').innerHTML = stepBody(2); refreshLive();
  }
}

/* ---- atualização ao vivo ------------------------------------------------- */
function refreshLive() {
  clearTimeout(qbTimer);
  qbTimer = setTimeout(() => { refreshPreview(); }, 250);
  refreshCoach(); refreshTeamLive(); refreshTpResults(); refreshPayLive(); refreshReviewList();
}

function safeSnapshot() {
  try { return buildQuoteSnapshot(QB.data, undefined, QB.code); } catch (e) { console.error(e); return null; }
}
function currentPreviewHtml() {
  const snap = safeSnapshot(); if (!snap) return '<p style="padding:20px;font-family:sans-serif">Não foi possível montar a pré-visualização.</p>';
  return QB.previewTab === 'pdf' ? quotePdfHtml(snap) : quoteLandingHtml(snap, { preview: true });
}
function refreshPreview() {
  const f = document.getElementById('pv-frame'); if (!f) return;
  f.srcdoc = currentPreviewHtml();
}
function refreshCoach() {
  const box = document.getElementById('coach-missing'); if (!box) return;
  const miss = validateQuoteStep(QB.step, QB.data);
  if (QB.step === 6) { box.innerHTML = ''; return; }
  box.innerHTML = miss.length
    ? `<div class="miss"><b>O que falta para continuar:</b><ul>${miss.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>`
    : `<div class="all-ok">✓ Tudo certo nesta etapa. Pode clicar em <b>Continuar</b>.</div>`;
}
function refreshTeamLive() {
  const box = document.getElementById('team-live'); if (!box) return;
  const tm = computeTeam(QB.data);
  box.innerHTML = `<div class="live-row"><span>Subtotal da equipe</span><b>${money(tm.subtotal)}</b></div>
    <div class="live-row"><span>Base que recebe desconto</span><b>${money(tm.discBase)}</b></div>
    <div class="live-row disc"><span>Desconto da equipe</span><b>− ${money(tm.discountAmount)}</b></div>
    <div class="live-row total"><span>Total da equipe</span><b>${money(tm.total)}</b></div>`;
}
function refreshPayLive() {
  const box = document.getElementById('pay-live'); if (!box) return;
  const tm = computeTeam(QB.data); const lines = paymentPlanLines(QB.data, tm.total);
  box.innerHTML = `<div class="live-row total"><span>Total da equipe</span><b>${money(tm.total)}</b></div>${lines.map(l => `<div class="live-line">${esc(l)}</div>`).join('')}`;
}
function refreshTpResults() {
  const snap = safeSnapshot(); if (!snap) return;
  document.querySelectorAll('[data-result]').forEach(el => {
    const key = el.dataset.result; let tp;
    if (key === 'hospital') tp = snap.hospital; else if (key === 'anestesista') tp = snap.team.anesthetist;
    else tp = snap.partners[Number(key.split('.')[1])];
    if (!tp) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="tp-res">
      ${tp.lines.map(l => `<div class="live-row"><span>${esc(l.label)}${l.qty > 1 ? ' × ' + l.qty : ''}</span><b>${l.value ? money(l.value) : 'sob consulta'}</b></div>`).join('')}
      ${tp.discounts.map(x => `<div class="live-row disc"><span>${esc(x.label)}</span><b>− ${money(x.amount)}</b></div>`).join('')}
      <div class="live-row total"><span>Total ${esc(tp.name)}</span><b>${money(tp.total)}</b></div>
      ${tp.variancePct ? `<div class="live-line">Faixa estimada ±${tp.variancePct}%: ${money(tp.rangeMin)} a ${money(tp.rangeMax)}</div>` : ''}
      ${tp.warnings.map(w => `<div class="live-warn">⚠ ${esc(w)}</div>`).join('')}</div>`;
  });
}
function refreshReviewList() {
  const box = document.getElementById('review-list'); if (!box) return;
  box.innerHTML = `<ul class="review">${QUOTE_STEPS.slice(0, 4).map(s => {
    const m = validateQuoteStep(s.id, QB.data);
    return `<li class="${m.length ? 'bad' : 'good'}"><b>${m.length ? '✗' : '✓'} Etapa ${s.id} — ${s.title}</b>${m.length ? `<ul>${m.map(x => `<li>${esc(x)}</li>`).join('')}</ul><a href="#" data-goto-link="${s.id}">Corrigir</a>` : ''}</li>`;
  }).join('')}</ul>`;
  box.querySelectorAll('[data-goto-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); gotoStep(Number(a.dataset.gotoLink)); }));
}

/* ---- salvar / publicar --------------------------------------------------- */
async function saveDraft() {
  const q = QB; const payload = { patientName: (q.data.patient.name || '').trim(), data: deepClone(q.data), step: Math.min(6, q.maxStep), updatedAt: nowISO() };
  if (q.id) await Store.update('quotes', q.id, payload);
  else { const row = await Store.add('quotes', Object.assign({ status: 'rascunho' }, payload)); q.id = row.id; q.fresh = false; history.replaceState(null, '', '#/orcamento/' + row.id); }
}

async function publishQuote() {
  const q = QB;
  const bad = validateQuoteUpTo(5, q.data);
  if (bad) { q.step = bad.step; flash('error', 'Há pendências na etapa ' + bad.step + '.'); return drawBuilder(); }
  const btn = document.getElementById('qb-publish'); btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = q.code || newQuoteCode(q.data.patient.name);
      const snap = buildQuoteSnapshot(q.data, undefined, code);
      const patch = { code, status: 'publicado', snapshot: snap, patientName: q.data.patient.name.trim(), data: deepClone(q.data), step: 6, updatedAt: nowISO(), publishedAt: nowISO() };
      try {
        if (q.id) await Store.update('quotes', q.id, patch);
        else { const row = await Store.add('quotes', patch); q.id = row.id; history.replaceState(null, '', '#/orcamento/' + row.id); }
        q.code = code; q.status = 'publicado'; q.snapshotCache = snap; q.maxStep = 6;
        break;
      } catch (err) {
        if (attempt === 2 || !/duplicate|unique/i.test(err.message)) throw err;
        q.code = null;
      }
    }
    flash('success', 'Proposta marcada como pronta. O link do paciente já está ativo.');
  } catch (err) { flash('error', 'Não foi possível publicar: ' + err.message); }
  drawBuilder();
}
