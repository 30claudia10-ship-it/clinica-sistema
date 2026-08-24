/* ===========================================================================
   app.js — aplicação da clínica (equipe interna)
   =========================================================================== */

const NAV = [
  { group: 'Visão Geral', items: [
    { id: 'dashboard', label: 'Dashboard' },
  ]},
  { group: 'Mapeamento', items: [
    { id: 'venda', label: 'Nova Venda' },
    { id: 'timeline', label: 'Timeline do Paciente' },
    { id: 'todos-tratamentos', label: 'Todos os Tratamentos' },
    { id: 'pendencias', label: 'Pendências de Confirmação' },
  ]},
  { group: 'Baixa', items: [
    { id: 'baixa', label: 'Baixa Fechada (Paciente)' },
    { id: 'baixa-insumo', label: 'Baixa de Insumo (Estoque)' },
  ]},
  { group: 'Compras', items: [
    { id: 'compras', label: 'Orçamento / Compra' },
    { id: 'contas-a-pagar', label: 'Contas a Pagar' },
    { id: 'recebimento', label: 'Compras Chegaram' },
  ]},
  { group: 'Estoque', items: [
    { id: 'estoque', label: 'Dashboard de Estoque' },
  ]},
  { group: 'Ferramentas', items: [
    { id: 'conversor', label: 'Conversor de ML' },
  ]},
  { group: 'Cadastros', items: [
    { id: 'pacientes', label: 'Pacientes' },
    { id: 'servicos', label: 'Serviços' },
    { id: 'produtos', label: 'Produtos / Insumos' },
    { id: 'unidades', label: 'Unidades de Medida' },
    { id: 'fornecedores', label: 'Fornecedores' },
    { id: 'pagamentos', label: 'Formas de Pagamento' },
    { id: 'configuracoes', label: 'Configurações da Clínica' },
  ]},
];

function route() {
  return (location.hash || '#/dashboard').replace('#/', '') || 'dashboard';
}
function go(id) {
  const newHash = '#/' + id;
  if (location.hash === newHash) render();
  else location.hash = newHash;
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <h1>Clínica · Sistema<small>Tratamento · Vendas · Estoque</small></h1>
        <div id="nav"></div>
        <button class="nav-btn" id="logout-btn" style="margin-top:auto;border-top:1px solid rgba(255,255,255,.12);">Sair</button>
      </aside>
      <main class="main">
        <div id="content"></div>
      </main>
    </div>
  `;
  renderNav();
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirmAction('Sair da conta?')) return;
    await sb.auth.signOut();
  });
}

function renderNav() {
  const r = route().split('/')[0];
  const pendCount = Store.find('consumptions', c => c.type === 'fechado' && c.confirmationStatus === 'pendente').length;
  const lowStock = lowStockAlerts().length;
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV.map(g => `
    <div class="nav-group">
      <div class="nav-group-title">${g.group}</div>
      ${g.items.map(it => `
        <button class="nav-btn ${r === it.id ? 'active' : ''}" data-nav="${it.id}">
          ${it.label}
          ${it.id === 'pendencias' && pendCount ? `<span class="badge-alert">${pendCount}</span>` : ''}
          ${it.id === 'estoque' && lowStock ? `<span class="badge-alert">${lowStock}</span>` : ''}
        </button>
      `).join('')}
    </div>
  `).join('');
  nav.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => go(b.dataset.nav)));
}

function setContent(html) {
  document.getElementById('content').innerHTML = html;
}
function topbar(title, sub) {
  return `<div class="topbar"><div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`;
}
function msg(type, text) {
  return `<div class="msg ${type}">${text}</div>`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function opts(list, valueKey, labelKey, selected) {
  return list.map(x => `<option value="${esc(x[valueKey])}" ${x[valueKey] === selected ? 'selected' : ''}>${esc(x[labelKey])}</option>`).join('');
}
function unitOptions(selected) {
  return opts(Store.all('units'), 'name', 'name', selected);
}
function paymentOptions(selected) {
  return opts(Store.all('paymentMethods'), 'name', 'name', selected);
}

function confirmAction(message) {
  return window.confirm(message);
}

let flashMessage = null;
function flash(type, text) { flashMessage = { type, text }; }
function popFlash() {
  if (!flashMessage) return '';
  const f = flashMessage; flashMessage = null;
  return msg(f.type, f.text);
}

/* =============================== ROUTER ================================= */
function render() {
  renderNav();
  const r = route();
  const [section, param] = r.split('/');
  try {
    switch (section) {
      case 'dashboard': return renderDashboard();
      case 'venda': return renderVenda();
      case 'timeline': return renderTimeline(param);
      case 'todos-tratamentos': return renderTodosTratamentos();
      case 'pendencias': return renderPendencias();
      case 'baixa': return renderBaixa(param);
      case 'baixa-insumo': return renderBaixaInsumo();
      case 'compras': return renderCompras(param || 'medicamento');
      case 'contas-a-pagar': return renderContasAPagar();
      case 'recebimento': return renderRecebimento(param || 'medicamento');
      case 'estoque': return renderEstoque();
      case 'pacientes': return renderPacientes();
      case 'servicos': return renderServicos();
      case 'produtos': return renderProdutos();
      case 'unidades': return renderUnidades();
      case 'fornecedores': return renderFornecedores();
      case 'pagamentos': return renderPagamentos();
      case 'configuracoes': return renderConfiguracoes();
      case 'conversor': return renderConversor();
      default: return renderDashboard();
    }
  } catch (e) {
    console.error(e);
    setContent(topbar('Erro') + msg('error', esc(e.message)));
  }
}

/* =============================== DASHBOARD =============================== */
function renderDashboard() {
  const patients = Store.all('patients').length;
  const lowStock = lowStockAlerts();
  const pendConfirm = Store.find('consumptions', c => c.type === 'fechado' && c.confirmationStatus === 'pendente').length;
  const openPurchases = Store.find('purchases', p => p.status !== 'recebido').length;
  const treatments = allTreatments();
  const treatmentsAndamento = treatments.filter(t => t.status === 'em_andamento').length;

  setContent(`
    ${topbar('Dashboard', 'Visão geral do sistema')}
    ${popFlash()}
    <div class="grid-4" style="margin-bottom:24px;">
      <div class="stat"><div class="num">${patients}</div><div class="label">Pacientes cadastrados</div></div>
      <div class="stat"><div class="num">${treatments.length}</div><div class="label">Mapeamentos/tratamentos totais</div></div>
      <div class="stat"><div class="num">${treatmentsAndamento}</div><div class="label">Tratamentos em andamento</div></div>
      <div class="stat ${pendConfirm ? 'alert' : 'ok'}"><div class="num">${pendConfirm}</div><div class="label">Sessões pendentes de confirmação</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Alertas de estoque mínimo</h3>
        ${lowStock.length ? `
          <table><thead><tr><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th></tr></thead>
          <tbody>${lowStock.map(p => `
            <tr><td>${esc(p.name)}</td><td>${catPill(p.category)}</td>
            <td>${p.stock} ${esc(p.unit)}</td><td>${p.minStock} ${esc(p.unit)}</td></tr>
          `).join('')}</tbody></table>
        ` : `<p class="hint">Nenhum produto abaixo do estoque mínimo.</p>`}
      </div>
      <div class="card">
        <h3>Compras em aberto</h3>
        <p class="num" style="font-size:28px;color:var(--azul-700);margin:0 0 6px;">${openPurchases}</p>
        <p class="hint">Orçamentos e compras aguardando recebimento. <a href="#/contas-a-pagar">Ver contas a pagar →</a></p>
      </div>
    </div>
    <div class="card">
      <h3>Todos os tratamentos — visão geral</h3>
      <p class="hint">Cada paciente pode ter vários mapeamentos (um por venda), cada um com seu próprio andamento. <a href="#/todos-tratamentos">Ver lista completa →</a></p>
    </div>
  `);
}

function catPill(cat) {
  return cat === 'medicamento' ? `<span class="pill blue">Medicamento</span>` : `<span class="pill green">Insumo</span>`;
}
function controlPill(ct) {
  return ct === 'fechado' ? `<span class="pill red">Fechado</span>` : `<span class="pill yellow">Livre</span>`;
}
function statusPill(status) {
  const map = { nao_iniciado: 'gray', em_andamento: 'blue', finalizado: 'green', pendente: 'yellow', confirmado: 'green', orcamento: 'gray', compra_aberto: 'blue', recebido: 'green', conferida: 'green' };
  return `<span class="pill ${map[status] || 'gray'}">${esc(STATUS_LABELS[status] || status)}</span>`;
}

/* =============================== CADASTROS: PACIENTES =============================== */
function renderPacientes() {
  const list = Store.all('patients').sort((a, b) => a.name.localeCompare(b.name));
  setContent(`
    ${topbar('Pacientes', 'Cadastro base utilizado por todos os módulos')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Novo paciente</h3>
        <form id="form-patient">
          <div class="field"><label>Nome completo *</label><input name="name" required></div>
          <div class="field-row">
            <div class="field"><label>CPF (opcional — login do portal)</label><input name="cpf" placeholder="000.000.000-00"></div>
            <div class="field"><label>Data de nascimento (opcional)</label><input type="date" name="birthDate"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Telefone (opcional)</label><input name="phone" placeholder="(11) 90000-0000"></div>
            <div class="field"><label>E-mail (opcional)</label><input type="email" name="email"></div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Cadastrar paciente</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Pacientes cadastrados (${list.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>ID do sistema</th><th>Cadastro</th><th></th></tr></thead>
          <tbody>
            ${list.length ? list.map(p => `
              <tr>
                <td>${esc(p.name)}</td>
                <td><code>${esc(p.id)}</code></td>
                <td>${fmtDate(p.createdAt)}</td>
                <td>
                  <a class="btn secondary sm" href="#/timeline/${p.id}">Ver tratamento</a>
                  <button class="btn danger sm" data-del-patient="${p.id}">Excluir</button>
                </td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="4">Nenhum paciente cadastrado.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `);
  document.getElementById('form-patient').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Store.add('patients', {
      name: fd.get('name').trim(),
      cpf: fd.get('cpf').trim(),
      birthDate: fd.get('birthDate'),
      phone: fd.get('phone').trim(),
      email: fd.get('email').trim()
    });
    flash('success', 'Paciente cadastrado com sucesso.');
    render();
  });
  document.querySelectorAll('[data-del-patient]').forEach(b => b.addEventListener('click', async () => {
    const p = Store.get('patients', b.dataset.delPatient);
    if (!confirmAction(`Excluir o paciente "${p.name}"? Isso também excluirá todas as vendas, mapeamentos e baixas dele, estornando o estoque correspondente. Esta ação não pode ser desfeita.`)) return;
    await deletePatient(p.id);
    flash('success', 'Paciente e todos os lançamentos vinculados foram excluídos.');
    render();
  }));
}

/* =============================== CADASTROS: SERVIÇOS =============================== */
function renderServicos() {
  const list = Store.all('services');
  setContent(`
    ${topbar('Serviços', 'Cadastro aberto — crie novos serviços a qualquer momento')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Novo serviço</h3>
        <form id="form-service">
          <div class="field"><label>Nome do serviço *</label><input name="name" required></div>
          <div class="field"><label>Categoria</label><input name="category" placeholder="Ex: Procedimento, Consulta..."></div>
          <div class="form-actions"><button class="btn" type="submit">Cadastrar serviço</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Serviços cadastrados (${list.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Categoria</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${list.length ? list.map(s => `
              <tr>
                <td>${esc(s.name)}</td><td>${esc(s.category || '—')}</td>
                <td>${s.active !== false ? '<span class="pill green">Ativo</span>' : '<span class="pill gray">Inativo</span>'}</td>
                <td>
                  <button class="btn-icon" data-toggle="${s.id}">${s.active !== false ? 'Desativar' : 'Ativar'}</button>
                  <button class="btn-icon" data-del-service="${s.id}" style="color:var(--vermelho);">Excluir</button>
                </td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="4">Nenhum serviço cadastrado.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `);
  document.getElementById('form-service').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Store.add('services', { name: fd.get('name').trim(), category: fd.get('category').trim(), active: true });
    flash('success', 'Serviço cadastrado.');
    render();
  });
  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    const s = Store.get('services', b.dataset.toggle);
    await Store.update('services', s.id, { active: !(s.active !== false) });
    render();
  }));
  document.querySelectorAll('[data-del-service]').forEach(b => b.addEventListener('click', async () => {
    const s = Store.get('services', b.dataset.delService);
    if (!confirmAction(`Excluir o serviço "${s.name}"? Vendas já lançadas que usam este serviço não serão apagadas.`)) return;
    await Store.remove('services', s.id);
    flash('success', 'Serviço excluído.');
    render();
  }));
}

/* =============================== CADASTROS: PRODUTOS/INSUMOS =============================== */
let editingProductId = null;

function renderProdutos() {
  const list = Store.all('products');
  setContent(`
    ${topbar('Produtos / Insumos', 'Medicamentos e insumos — define o tipo de controle de baixa')}
    ${popFlash()}
    <div class="section-note">
      <b>Fechado</b>: só pode ser baixado se estiver prescrito em uma venda (ex: medicamentos, soro).
      <b>Livre</b>: pode ser baixado direto no atendimento, sem prescrição (ex: gaze, algodão, luva) — exclusivo de produtos categoria <b>Insumo</b>.
      <br><b>Conversão de ML</b>: se o produto é comprado em ampola/frasco mas controlado em ML (compra, venda e baixa sempre em ml), marque a conversão e informe quantos ml tem cada unidade de compra.
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Novo produto / insumo</h3>
        <form id="form-product">
          <div class="field"><label>Nome *</label><input name="name" required></div>
          <div class="field-row">
            <div class="field">
              <label>Categoria *</label>
              <select name="category" required>
                <option value="medicamento">Medicamento</option>
                <option value="insumo">Insumo</option>
              </select>
            </div>
            <div class="field">
              <label>Tipo de controle de baixa *</label>
              <select name="controlType" required>
                <option value="fechado">Fechado (só se prescrito)</option>
                <option value="livre">Livre (sem prescrição)</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>Unidade de medida padrão *</label><select name="unit" required>${unitOptions()}</select></div>
            <div class="field"><label>Estoque mínimo *</label><input type="number" step="0.01" min="0" name="minStock" required value="10"></div>
          </div>
          <div class="field"><label>Estoque inicial</label><input type="number" step="0.01" min="0" name="stock" value="0"></div>
          <fieldset>
            <legend>Conversão de ML (opcional)</legend>
            <div class="field">
              <label><input type="checkbox" name="hasConversion" style="width:auto;display:inline-block;vertical-align:middle;"> Este produto é comprado em ampola/frasco mas controlado em ML</label>
            </div>
            <div class="field-row">
              <div class="field"><label>Unidade de compra (ex: Ampola)</label><input name="convUnitLabel" placeholder="Ampola"></div>
              <div class="field"><label>ML por unidade de compra</label><input type="number" step="0.01" min="0" name="convFactorMl" placeholder="Ex: 10"></div>
            </div>
            <p class="hint">Com isso ativado, na tela de Compras você poderá informar "quantas ampolas" e o sistema converte automaticamente para ML no estoque, na venda e na baixa.</p>
          </fieldset>
          <div class="form-actions"><button class="btn" type="submit">Cadastrar produto</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Produtos cadastrados (${list.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Categoria</th><th>Controle</th><th>Saldo</th><th>Estoque mínimo</th><th></th></tr></thead>
          <tbody>
            ${list.length ? list.map(p => renderProductRow(p)).join('') : `<tr class="empty-row"><td colspan="6">Nenhum produto cadastrado.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `);
  document.getElementById('form-product').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hasConversion = fd.get('hasConversion') === 'on';
    await Store.add('products', {
      name: fd.get('name').trim(),
      category: fd.get('category'),
      controlType: fd.get('controlType'),
      unit: fd.get('unit'),
      minStock: Number(fd.get('minStock')),
      stock: Number(fd.get('stock') || 0),
      hasConversion,
      convUnitLabel: hasConversion ? (fd.get('convUnitLabel') || '').trim() : '',
      convFactorMl: hasConversion ? Number(fd.get('convFactorMl')) || 0 : 0
    });
    flash('success', 'Produto cadastrado.');
    render();
  });
  bindProductRowEvents();
}

function renderProductRow(p) {
  if (editingProductId === p.id) {
    return `
      <tr>
        <td colspan="6">
          <form data-edit-form="${p.id}" style="background:var(--azul-50);padding:12px;border-radius:8px;">
            <div class="field-row">
              <div class="field"><label>Nome</label><input name="name" value="${esc(p.name)}" required></div>
              <div class="field"><label>Estoque mínimo</label><input type="number" step="0.01" min="0" name="minStock" value="${p.minStock}" required></div>
              <div class="field"><label>Unidade</label><select name="unit">${unitOptions(p.unit)}</select></div>
            </div>
            <div class="field-row">
              <div class="field"><label><input type="checkbox" name="hasConversion" style="width:auto;display:inline-block;" ${p.hasConversion ? 'checked' : ''}> Conversão de ML ativa</label></div>
              <div class="field"><label>Unidade de compra</label><input name="convUnitLabel" value="${esc(p.convUnitLabel || '')}" placeholder="Ampola"></div>
              <div class="field"><label>ML por unidade</label><input type="number" step="0.01" min="0" name="convFactorMl" value="${p.convFactorMl || ''}"></div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn sm">Salvar</button>
              <button type="button" class="btn secondary sm" data-cancel-edit="1">Cancelar</button>
            </div>
          </form>
        </td>
      </tr>
    `;
  }
  return `
    <tr>
      <td>${esc(p.name)}${p.hasConversion ? `<div class="hint">1 ${esc(p.convUnitLabel || 'unidade')} = ${p.convFactorMl || 0} ML</div>` : ''}</td>
      <td>${catPill(p.category)}</td><td>${controlPill(p.controlType)}</td>
      <td class="${p.stock <= p.minStock ? 'pill red' : ''}" style="${p.stock <= p.minStock ? 'display:inline-block;margin-top:6px;' : ''}">${p.stock} ${esc(p.unit)}</td>
      <td>${p.minStock} ${esc(p.unit)}</td>
      <td>
        <button class="btn-icon" data-edit-product="${p.id}">Editar</button>
        <button class="btn-icon" data-del-product="${p.id}" style="color:var(--vermelho);">Excluir</button>
      </td>
    </tr>
  `;
}

function bindProductRowEvents() {
  document.querySelectorAll('[data-edit-product]').forEach(b => b.addEventListener('click', () => {
    editingProductId = b.dataset.editProduct;
    render();
  }));
  document.querySelectorAll('[data-cancel-edit]').forEach(b => b.addEventListener('click', () => {
    editingProductId = null;
    render();
  }));
  document.querySelectorAll('[data-edit-form]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hasConversion = fd.get('hasConversion') === 'on';
    await Store.update('products', f.dataset.editForm, {
      name: fd.get('name').trim(),
      minStock: Number(fd.get('minStock')),
      unit: fd.get('unit'),
      hasConversion,
      convUnitLabel: hasConversion ? (fd.get('convUnitLabel') || '').trim() : '',
      convFactorMl: hasConversion ? Number(fd.get('convFactorMl')) || 0 : 0
    });
    editingProductId = null;
    flash('success', 'Produto atualizado.');
    render();
  }));
  document.querySelectorAll('[data-del-product]').forEach(b => b.addEventListener('click', async () => {
    const p = Store.get('products', b.dataset.delProduct);
    if (!confirmAction(`Excluir o produto "${p.name}"? Lançamentos antigos que o referenciam manterão o nome apenas como histórico.`)) return;
    await Store.remove('products', p.id);
    flash('success', 'Produto excluído.');
    render();
  }));
}

/* =============================== CADASTROS: UNIDADES =============================== */
function renderUnidades() {
  const list = Store.all('units');
  setContent(`
    ${topbar('Unidades de Medida', 'Cadastro configurável e extensível')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Nova unidade</h3>
        <form id="form-unit">
          <div class="field"><label>Nome da unidade *</label><input name="name" required placeholder="Ex: Comprimido"></div>
          <div class="form-actions"><button class="btn" type="submit">Adicionar</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Unidades cadastradas (${list.length})</h3>
        <div class="table-wrap"><table><tbody>
          ${list.map(u => `<tr><td>${esc(u.name)}</td><td style="text-align:right;"><button class="btn-icon" data-del-unit="${u.id}" style="color:var(--vermelho);">Excluir</button></td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </div>
  `);
  document.getElementById('form-unit').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Store.add('units', { name: fd.get('name').trim() });
    flash('success', 'Unidade adicionada.');
    render();
  });
  document.querySelectorAll('[data-del-unit]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta unidade de medida?')) return;
    await Store.remove('units', b.dataset.delUnit);
    flash('success', 'Unidade excluída.');
    render();
  }));
}

/* =============================== CADASTROS: FORNECEDORES =============================== */
function renderFornecedores() {
  const list = Store.all('suppliers');
  setContent(`
    ${topbar('Fornecedores')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Novo fornecedor</h3>
        <form id="form-supplier">
          <div class="field"><label>Nome / Razão social *</label><input name="name" required></div>
          <div class="field"><label>CNPJ</label><input name="cnpj" placeholder="00.000.000/0000-00"></div>
          <div class="field-row">
            <div class="field"><label>Telefone</label><input name="phone"></div>
            <div class="field"><label>E-mail</label><input type="email" name="email"></div>
          </div>
          <div class="field"><label>Condição de pagamento padrão (opcional)</label><input name="paymentTerms" placeholder="Ex: 30 dias"></div>
          <div class="form-actions"><button class="btn" type="submit">Cadastrar fornecedor</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Fornecedores cadastrados (${list.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Cond. pagamento</th><th></th></tr></thead>
          <tbody>
            ${list.length ? list.map(s => `
              <tr><td>${esc(s.name)}</td><td>${esc(s.cnpj || '—')}</td>
              <td>${esc(s.phone || '')} ${esc(s.email || '')}</td><td>${esc(s.paymentTerms || '—')}</td>
              <td><button class="btn-icon" data-del-supplier="${s.id}" style="color:var(--vermelho);">Excluir</button></td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="5">Nenhum fornecedor cadastrado.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `);
  document.getElementById('form-supplier').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Store.add('suppliers', {
      name: fd.get('name').trim(), cnpj: fd.get('cnpj').trim(), phone: fd.get('phone').trim(),
      email: fd.get('email').trim(), paymentTerms: fd.get('paymentTerms').trim()
    });
    flash('success', 'Fornecedor cadastrado.');
    render();
  });
  document.querySelectorAll('[data-del-supplier]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir este fornecedor? Compras já registradas manterão o nome apenas como histórico.')) return;
    await Store.remove('suppliers', b.dataset.delSupplier);
    flash('success', 'Fornecedor excluído.');
    render();
  }));
}

/* =============================== CADASTROS: FORMAS DE PAGAMENTO =============================== */
function renderPagamentos() {
  const list = Store.all('paymentMethods');
  setContent(`
    ${topbar('Formas de Pagamento', 'Usadas tanto na venda quanto na compra')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Nova forma de pagamento</h3>
        <form id="form-pm">
          <div class="field"><label>Nome *</label><input name="name" required></div>
          <div class="form-actions"><button class="btn" type="submit">Adicionar</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Cadastradas (${list.length})</h3>
        <div class="table-wrap"><table><tbody>${list.map(p => `<tr><td>${esc(p.name)}</td><td style="text-align:right;"><button class="btn-icon" data-del-pm="${p.id}" style="color:var(--vermelho);">Excluir</button></td></tr>`).join('')}</tbody></table></div>
      </div>
    </div>
  `);
  document.getElementById('form-pm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await Store.add('paymentMethods', { name: fd.get('name').trim() });
    flash('success', 'Forma de pagamento adicionada.');
    render();
  });
  document.querySelectorAll('[data-del-pm]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta forma de pagamento?')) return;
    await Store.remove('paymentMethods', b.dataset.delPm);
    flash('success', 'Forma de pagamento excluída.');
    render();
  }));
}

/* =============================== CONFIGURAÇÕES DA CLÍNICA (LOGO) =============================== */
function renderConfiguracoes() {
  const settings = getSettings();
  setContent(`
    ${topbar('Configurações da Clínica', 'Identidade do portal do paciente e dados para faturamento com fornecedores')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Portal do paciente</h3>
        <form id="form-settings">
          <div class="field"><label>Nome da clínica</label><input name="clinicName" value="${esc(settings.clinicName || '')}" placeholder="Ex: Clínica Dra. Fulana"></div>
          <div class="field">
            <label>Logo da clínica</label>
            <input type="file" name="logo" accept="image/*">
            <p class="hint">A imagem é salva localmente neste navegador e aparece no link de confirmação enviado ao paciente. Prefira PNG/JPG leve (até ~500KB).</p>
          </div>
          <div class="field">
            <label>Pré-visualização</label>
            <div id="logo-preview" style="padding:14px;background:var(--azul-50);border-radius:10px;text-align:center;">
              ${settings.logoDataUrl ? `<img src="${settings.logoDataUrl}" style="max-height:70px;max-width:100%;">` : `<span class="hint">Nenhuma logo definida ainda</span>`}
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit">Salvar configurações</button>
            ${settings.logoDataUrl ? `<button class="btn secondary" type="button" id="remove-logo">Remover logo</button>` : ''}
          </div>
        </form>
      </div>

      <div class="card">
        <h3>Dados da empresa (faturamento com fornecedores)</h3>
        <p class="hint">Estes dados aparecem automaticamente no cabeçalho do PDF de orçamento/pedido de compra enviado ao fornecedor, identificando quem está comprando.</p>
        <form id="form-company">
          <div class="field"><label>Razão social / Nome</label><input name="companyName" value="${esc(settings.companyName || '')}" placeholder="Ex: Clínica Dra. Fulana LTDA"></div>
          <div class="field-row">
            <div class="field"><label>CNPJ</label><input name="companyCnpj" value="${esc(settings.companyCnpj || '')}" placeholder="00.000.000/0000-00"></div>
            <div class="field"><label>Inscrição Estadual (opcional)</label><input name="companyIe" value="${esc(settings.companyIe || '')}"></div>
          </div>
          <div class="field"><label>Endereço</label><input name="companyAddress" value="${esc(settings.companyAddress || '')}" placeholder="Rua, número, bairro, cidade - UF, CEP"></div>
          <div class="field-row">
            <div class="field"><label>Telefone</label><input name="companyPhone" value="${esc(settings.companyPhone || '')}"></div>
            <div class="field"><label>E-mail</label><input type="email" name="companyEmail" value="${esc(settings.companyEmail || '')}"></div>
          </div>
          <div class="form-actions"><button class="btn" type="submit">Salvar dados da empresa</button></div>
        </form>
      </div>
    </div>
  `);

  let pendingLogoDataUrl = settings.logoDataUrl || '';
  const fileInput = document.querySelector('[name=logo]');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      flash('error', 'Imagem muito grande. Escolha um arquivo de até ~800KB.');
      render();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoDataUrl = reader.result;
      document.getElementById('logo-preview').innerHTML = `<img src="${pendingLogoDataUrl}" style="max-height:70px;max-width:100%;">`;
    };
    reader.readAsDataURL(file);
  });

  const removeBtn = document.getElementById('remove-logo');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    pendingLogoDataUrl = '';
    document.getElementById('logo-preview').innerHTML = `<span class="hint">Nenhuma logo definida ainda</span>`;
  });

  document.getElementById('form-settings').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await saveSettings({ clinicName: fd.get('clinicName').trim(), logoDataUrl: pendingLogoDataUrl });
    flash('success', 'Configurações salvas.');
    render();
  });

  document.getElementById('form-company').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await saveSettings({
      companyName: fd.get('companyName').trim(),
      companyCnpj: fd.get('companyCnpj').trim(),
      companyIe: fd.get('companyIe').trim(),
      companyAddress: fd.get('companyAddress').trim(),
      companyPhone: fd.get('companyPhone').trim(),
      companyEmail: fd.get('companyEmail').trim()
    });
    flash('success', 'Dados da empresa salvos.');
    render();
  });
}

/* =============================== CONVERSOR DE ML =============================== */
function renderConversor() {
  const products = Store.find('products', p => p.hasConversion);
  setContent(`
    ${topbar('Conversor de ML', 'Ferramenta rápida: converte quantidade de ampolas/frascos em ML total')}
    ${popFlash()}
    <div class="grid-2">
      <div class="card">
        <h3>Cálculo rápido</h3>
        <div class="field-row">
          <div class="field"><label>Quantidade de unidades (ex: ampolas)</label><input type="number" step="0.01" min="0" id="conv-qty" value="1"></div>
          <div class="field"><label>ML por unidade</label><input type="number" step="0.01" min="0" id="conv-factor" value="10"></div>
        </div>
        <div class="stat ok" style="margin-top:10px;">
          <div class="num" id="conv-result">10 ML</div>
          <div class="label">Total em ML</div>
        </div>
      </div>
      <div class="card">
        <h3>Produtos com conversão cadastrada</h3>
        ${products.length ? `
          <table><thead><tr><th>Produto</th><th>Unidade de compra</th><th>ML por unidade</th></tr></thead>
          <tbody>${products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.convUnitLabel || '—')}</td><td>${p.convFactorMl || 0} ML</td></tr>`).join('')}</tbody></table>
        ` : `<p class="hint">Nenhum produto com conversão configurada ainda. Configure em <a href="#/produtos">Produtos / Insumos</a> (opção "Conversão de ML").</p>`}
        <p class="hint" style="margin-top:12px;">Ao registrar uma <b>Compra</b> de um produto com conversão ativa, o sistema já mostra este cálculo automaticamente e converte para ML no estoque, na venda e na baixa.</p>
      </div>
    </div>
  `);
  const qtyInput = document.getElementById('conv-qty');
  const factorInput = document.getElementById('conv-factor');
  const update = () => {
    const total = (Number(qtyInput.value) || 0) * (Number(factorInput.value) || 0);
    document.getElementById('conv-result').textContent = (Math.round(total * 100) / 100) + ' ML';
  };
  qtyInput.addEventListener('input', update);
  factorInput.addEventListener('input', update);
}

/* =============================== MAPEAMENTO: NOVA VENDA =============================== */
let saleItemsBuffer = [{ productId: '', qty: '', unit: '' }];

function renderVenda() {
  const patients = Store.all('patients').sort((a, b) => a.name.localeCompare(b.name));
  const services = Store.all('services').filter(s => s.active !== false);
  const products = Store.all('products');

  setContent(`
    ${topbar('Nova Venda', 'Vincula paciente, serviço e produto(s) — gera automaticamente a timeline de tratamento')}
    ${popFlash()}
    <div class="card">
      <form id="form-sale">
        <div class="field-row">
          <div class="field">
            <label>Paciente *</label>
            <select name="patientId" required>
              <option value="">Selecione...</option>
              ${opts(patients, 'id', 'name')}
              <option value="__new__">+ Cadastrar novo paciente</option>
            </select>
          </div>
          <div class="field"><label>Data da venda *</label><input type="date" name="date" required value="${todayInputDate()}"></div>
        </div>
        <div id="new-patient-box" style="display:none;" class="field">
          <label>Nome do novo paciente</label><input name="newPatientName" placeholder="Nome completo">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Serviço vendido *</label>
            <select name="serviceId" required>
              <option value="">Selecione...</option>
              ${opts(services, 'id', 'name')}
              <option value="__new__">+ Criar novo serviço</option>
            </select>
          </div>
          <div class="field" id="new-service-box" style="display:none;">
            <label>Nome do novo serviço</label><input name="newServiceName">
          </div>
          <div class="field">
            <label>Forma de pagamento *</label>
            <select name="paymentMethod" required>${paymentOptions()}</select>
          </div>
        </div>

        <fieldset>
          <legend>Produto(s) vendido(s)</legend>
          <div id="sale-items"></div>
          <button type="button" class="btn secondary sm" id="add-item">+ Adicionar item</button>
        </fieldset>

        <div class="form-actions"><button class="btn" type="submit">Lançar venda</button></div>
      </form>
    </div>
  `);

  const patientSelect = document.querySelector('[name=patientId]');
  patientSelect.addEventListener('change', () => {
    document.getElementById('new-patient-box').style.display = patientSelect.value === '__new__' ? 'block' : 'none';
  });
  const serviceSelect = document.querySelector('[name=serviceId]');
  serviceSelect.addEventListener('change', () => {
    document.getElementById('new-service-box').style.display = serviceSelect.value === '__new__' ? 'block' : 'none';
  });

  saleItemsBuffer = [{ productId: '', qty: '', unit: '' }];
  renderSaleItems(products);
  document.getElementById('add-item').addEventListener('click', () => {
    saleItemsBuffer.push({ productId: '', qty: '', unit: '' });
    renderSaleItems(products);
  });

  document.getElementById('form-sale').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let patientId = fd.get('patientId');
    if (!patientId) { flash('error', 'Selecione um paciente.'); render(); return; }
    try {
      if (patientId === '__new__') {
        const name = (fd.get('newPatientName') || '').trim();
        if (!name) { flash('error', 'Informe o nome do novo paciente.'); render(); return; }
        patientId = (await Store.add('patients', { name })).id;
      }
      let serviceId = fd.get('serviceId');
      if (serviceId === '__new__') {
        const name = (fd.get('newServiceName') || '').trim();
        if (!name) { flash('error', 'Informe o nome do novo serviço.'); render(); return; }
        serviceId = (await Store.add('services', { name, category: '', active: true })).id;
      }
      const items = collectSaleItems();
      if (!items.length) { flash('error', 'Adicione ao menos um produto válido.'); render(); return; }
      await registerSale({ patientId, date: fd.get('date'), serviceId, items, paymentMethod: fd.get('paymentMethod') });
      flash('success', 'Venda lançada e timeline de tratamento gerada.');
      go('timeline/' + patientId);
    } catch (err) {
      flash('error', err.message); render();
    }
  });
}

function renderSaleItems(products) {
  const box = document.getElementById('sale-items');
  box.innerHTML = saleItemsBuffer.map((it, idx) => `
    <div class="repeatable-item">
      <div class="field" style="flex:2;">
        <label>Produto</label>
        <select data-idx="${idx}" data-field="productId" class="si-product">
          <option value="">Selecione...</option>
          ${products.map(p => `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${esc(p.name)} (${catPill(p.category).replace(/<[^>]+>/g, '')})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Quantidade</label>
        <input type="number" step="0.01" min="0.01" data-idx="${idx}" data-field="qty" class="si-qty" value="${it.qty}">
      </div>
      <div class="field">
        <label>Unidade</label>
        <select data-idx="${idx}" data-field="unit" class="si-unit">${unitOptions(it.unit)}</select>
      </div>
      <button type="button" class="btn-icon" data-remove="${idx}" title="Remover">✕</button>
    </div>
  `).join('');

  box.querySelectorAll('select,input').forEach(el => {
    el.addEventListener('input', () => {
      const idx = Number(el.dataset.idx), field = el.dataset.field;
      saleItemsBuffer[idx][field] = el.value;
      if (field === 'productId') {
        const p = Store.get('products', el.value);
        if (p) saleItemsBuffer[idx].unit = p.unit;
        renderSaleItems(products);
      }
    });
  });
  box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    saleItemsBuffer.splice(Number(b.dataset.remove), 1);
    if (!saleItemsBuffer.length) saleItemsBuffer.push({ productId: '', qty: '', unit: '' });
    renderSaleItems(products);
  }));
}
function collectSaleItems() {
  return saleItemsBuffer.filter(it => it.productId && Number(it.qty) > 0)
    .map(it => ({ productId: it.productId, qty: Number(it.qty), unit: it.unit || Store.get('products', it.productId).unit }));
}

/* =============================== MAPEAMENTO: TIMELINE =============================== */
function renderTimeline(patientId) {
  const patients = Store.all('patients').sort((a, b) => a.name.localeCompare(b.name));
  if (!patientId && patients.length) patientId = patients[0].id;
  const patient = patientId ? Store.get('patients', patientId) : null;

  setContent(`
    ${topbar('Timeline do Paciente', 'Mapa de tratamento — visão interna e do paciente (sem valores)')}
    ${popFlash()}
    <div class="card">
      <div class="field" style="max-width:360px;">
        <label>Selecionar paciente</label>
        <select id="patient-select">
          <option value="">Selecione...</option>
          ${opts(patients, 'id', 'name', patientId)}
        </select>
      </div>
    </div>
    <div id="timeline-body"></div>
  `);
  document.getElementById('patient-select').addEventListener('change', e => go('timeline/' + e.target.value));
  if (patient) renderTimelineBody(patient);
}

async function renderTimelineBody(patient) {
  const treatments = treatmentsByPatient(patient.id);
  const consumptions = Store.find('consumptions', c => c.patientId === patient.id).sort((a, b) => a.date < b.date ? 1 : -1);
  const portalUrl = await buildPortalPatientUrl(patient.id);
  const bodyEl = document.getElementById('timeline-body');
  if (!bodyEl) return; // usuário já navegou para outra tela enquanto o link era gerado

  bodyEl.innerHTML = `
    <div class="card">
      <h3>${esc(patient.name)} <span style="font-weight:400;color:var(--cinza-700);font-size:12px;">· ID ${esc(patient.id)}</span></h3>
      <p class="hint">Este paciente possui <b>${treatments.length}</b> mapeamento(s) de tratamento — cada venda gera um mapeamento independente, com seu próprio andamento. Nenhum valor financeiro é exibido nesta tela.</p>
      <div class="link-box">
        Link do portal do paciente: <a href="${portalUrl}" target="_blank">${portalUrl}</a>
      </div>
    </div>

    <h3 style="margin:20px 0 10px;color:var(--azul-900);">Mapeamentos de tratamento</h3>
    ${treatments.length ? treatments.map(t => `
      <div class="card">
        <div class="topbar" style="margin-bottom:10px;">
          <div>
            <h3 style="margin:0;">${esc(serviceName(t.sale.serviceId))} <span class="hint">— venda de ${fmtDate(t.sale.date)}</span></h3>
            <div style="margin-top:4px;">${statusPill(t.status)} <span class="hint">${t.progressPct}% concluído</span></div>
          </div>
          <button class="btn danger sm" data-del-sale="${t.sale.id}">Excluir mapeamento</button>
        </div>
        <div class="timeline">
          ${t.items.map(ti => {
            const product = Store.get('products', ti.productId);
            return `<div class="timeline-item ${ti.status}">
              <div class="ti-title">${esc(product ? product.name : '?')} — ${ti.qtyTotal} ${esc(ti.unit)} ${controlPill(product ? product.controlType : '')}</div>
              <div class="ti-meta">Usado: ${ti.qtyUsed}/${ti.qtyTotal} ${esc(ti.unit)} · ${statusPill(ti.status)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('') : `<div class="card"><p class="hint">Nenhum mapeamento ainda. <a href="#/venda">Lançar venda →</a></p></div>`}

    <div class="card">
      <h3>Histórico de baixas / consumo (todos os mapeamentos)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Produto</th><th>Qtd</th><th>Tipo</th><th>Confirmação do paciente</th><th></th></tr></thead>
        <tbody>
          ${consumptions.length ? consumptions.map(c => `
            <tr>
              <td>${fmtDateTime(c.date)}</td>
              <td>${esc(productName(c.productId))}</td>
              <td>${c.qty} ${esc(c.unit)}</td>
              <td>${c.type === 'fechado' ? '<span class="pill red">Fechado (prescrito)</span>' : '<span class="pill yellow">Livre (insumo)</span>'}</td>
              <td>${c.type === 'fechado' ? statusPill(c.confirmationStatus) : '<span class="hint">Não se aplica</span>'}</td>
              <td><button class="btn-icon" data-del-consumption="${c.id}" style="color:var(--vermelho);">Excluir</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma baixa registrada.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;

  document.querySelectorAll('[data-del-sale]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir este mapeamento? Todas as baixas já feitas neste mapeamento serão estornadas ao estoque. Esta ação não pode ser desfeita.')) return;
    await deleteSale(b.dataset.delSale);
    flash('success', 'Mapeamento excluído e estoque estornado.');
    go('timeline/' + patient.id);
  }));
  document.querySelectorAll('[data-del-consumption]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta baixa? A quantidade será devolvida ao estoque e, se for item prescrito, o saldo do mapeamento voltará a ficar pendente.')) return;
    await deleteConsumption(b.dataset.delConsumption);
    flash('success', 'Baixa excluída e estoque estornado.');
    go('timeline/' + patient.id);
  }));
}

async function buildPortalPatientUrl(patientId) {
  const token = await getOrCreatePatientToken(patientId);
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '');
  return base + 'portal.html?token=' + token;
}
async function buildPortalSessionUrl(consumptionId) {
  const token = await ensureSessionToken(consumptionId);
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '');
  return base + 'portal.html?session=' + token;
}
// versão síncrona — usa o token já existente no cache (criado no momento da baixa fechada)
function getPortalSessionUrlSync(consumptionId) {
  const t = Store.findOne('portalTokens', pt => pt.consumptionId === consumptionId && !pt.revoked);
  if (!t) return null;
  const base = location.href.replace(/index\.html.*$/, '').replace(/#.*$/, '');
  return base + 'portal.html?session=' + t.token;
}

/* =============================== TODOS OS TRATAMENTOS =============================== */
function renderTodosTratamentos() {
  let filterStatus = 'todos';
  let search = '';
  const all = allTreatments();
  const counts = {
    nao_iniciado: all.filter(t => t.status === 'nao_iniciado').length,
    em_andamento: all.filter(t => t.status === 'em_andamento').length,
    finalizado: all.filter(t => t.status === 'finalizado').length
  };

  setContent(`
    ${topbar('Todos os Tratamentos', 'Cada paciente pode ter vários mapeamentos — aqui você vê todos e em que etapa estão')}
    ${popFlash()}
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="stat"><div class="num">${counts.nao_iniciado}</div><div class="label">Não iniciados</div></div>
      <div class="stat"><div class="num">${counts.em_andamento}</div><div class="label">Em andamento</div></div>
      <div class="stat ok"><div class="num">${counts.finalizado}</div><div class="label">Finalizados</div></div>
    </div>
    <div class="card">
      <div class="field-row" style="align-items:flex-end;">
        <div class="field" style="max-width:220px;">
          <label>Status</label>
          <select id="f-status">
            <option value="todos">Todos</option>
            <option value="nao_iniciado">Não iniciado</option>
            <option value="em_andamento">Em andamento</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>
        <div class="field" style="max-width:260px;"><label>Buscar paciente</label><input id="f-search" placeholder="Nome do paciente..."></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Serviço</th><th>Data</th><th>Itens</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
        <tbody id="tt-tbody"></tbody>
      </table></div>
    </div>
  `);

  const drawTable = () => {
    let treatments = all;
    if (filterStatus !== 'todos') treatments = treatments.filter(t => t.status === filterStatus);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      treatments = treatments.filter(t => patientName(t.sale.patientId).toLowerCase().includes(term));
    }
    document.getElementById('tt-tbody').innerHTML = treatments.length ? treatments.map(t => `
      <tr>
        <td>${esc(patientName(t.sale.patientId))}</td>
        <td>${esc(serviceName(t.sale.serviceId))}</td>
        <td>${fmtDate(t.sale.date)}</td>
        <td>${t.items.map(i => esc(productName(i.productId))).join(', ')}</td>
        <td>${t.progressPct}%</td>
        <td>${statusPill(t.status)}</td>
        <td><a class="btn secondary sm" href="#/timeline/${t.sale.patientId}">Ver</a></td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="7">Nenhum mapeamento encontrado.</td></tr>`;
  };

  document.getElementById('f-status').addEventListener('change', e => { filterStatus = e.target.value; drawTable(); });
  document.getElementById('f-search').addEventListener('input', e => { search = e.target.value; drawTable(); });
  drawTable();
}

/* =============================== PENDÊNCIAS DE CONFIRMAÇÃO =============================== */
function renderPendencias() {
  const all = Store.find('consumptions', c => c.type === 'fechado').sort((a, b) => a.date < b.date ? 1 : -1);
  const pendentes = all.filter(c => c.confirmationStatus === 'pendente');
  const confirmadas = all.filter(c => c.confirmationStatus === 'confirmado');

  setContent(`
    ${topbar('Pendências de Confirmação de Sessão', 'Portal do paciente — sessões de itens prescritos (Fechados) que aguardam confirmação')}
    ${popFlash()}
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="stat ${pendentes.length ? 'alert' : 'ok'}"><div class="num">${pendentes.length}</div><div class="label">Pendentes</div></div>
      <div class="stat ok"><div class="num">${confirmadas.length}</div><div class="label">Confirmadas</div></div>
      <div class="stat"><div class="num">${all.length}</div><div class="label">Total de sessões (Fechado)</div></div>
    </div>
    <div class="card">
      <h3>Pendentes</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Produto</th><th>Qtd</th><th>Data</th><th>Dias em aberto</th><th>Link de confirmação</th></tr></thead>
        <tbody>
          ${pendentes.length ? pendentes.map(c => {
            const days = Math.floor((Date.now() - new Date(c.date)) / 86400000);
            const url = getPortalSessionUrlSync(c.id) || '';
            const patient = Store.get('patients', c.patientId);
            const waLink = (url && patient && patient.phone) ? `https://wa.me/${patient.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + patient.name + ', confirme seu atendimento: ' + url)}` : null;
            return `<tr>
              <td>${esc(patientName(c.patientId))}</td>
              <td>${esc(productName(c.productId))}</td>
              <td>${c.qty} ${esc(c.unit)}</td>
              <td>${fmtDate(c.date)}</td>
              <td>${days > 3 ? `<span class="pill red">${days}d</span>` : days + 'd'}</td>
              <td>
                ${url ? `<button class="btn secondary sm" data-copy="${url}">Copiar link</button>` : `<span class="hint">Link indisponível</span>`}
                ${waLink ? `<a class="btn sm" style="margin-left:4px;" href="${waLink}" target="_blank">WhatsApp</a>` : ''}
              </td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma pendência 🎉</td></tr>`}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>Confirmadas recentemente</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Paciente</th><th>Produto</th><th>Qtd</th><th>Confirmado em</th></tr></thead>
        <tbody>
          ${confirmadas.slice(0, 15).map(c => `
            <tr><td>${esc(patientName(c.patientId))}</td><td>${esc(productName(c.productId))}</td>
            <td>${c.qty} ${esc(c.unit)}</td><td>${fmtDateTime(c.confirmedAt)}</td></tr>
          `).join('') || `<tr class="empty-row"><td colspan="4">Nenhuma confirmação ainda.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `);
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
    navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).catch(() => {});
    b.textContent = 'Copiado!';
    setTimeout(() => b.textContent = 'Copiar link', 1200);
  }));
}

/* =============================== BAIXA (ATENDIMENTO) =============================== */
function renderBaixa(patientId) {
  const patients = Store.all('patients').sort((a, b) => a.name.localeCompare(b.name));
  if (!patientId && patients.length) patientId = patients[0].id;

  setContent(`
    ${topbar('Baixa Fechada (Paciente)', 'Consumo de itens prescritos no atendimento — vinculado ao paciente e à timeline de tratamento')}
    ${popFlash()}
    <div class="card">
      <div class="field" style="max-width:360px;">
        <label>Paciente do atendimento *</label>
        <select id="patient-select">
          <option value="">Selecione...</option>
          ${opts(patients, 'id', 'name', patientId)}
        </select>
      </div>
    </div>
    <div id="baixa-body"></div>
  `);
  document.getElementById('patient-select').addEventListener('change', e => go('baixa/' + e.target.value));
  if (patientId) renderBaixaBody(patientId);
}

function renderBaixaBody(patientId) {
  const patient = Store.get('patients', patientId);
  if (!patient) return;
  const pendentes = pendingFechadoByPatient(patientId);

  document.getElementById('baixa-body').innerHTML = `
    <div class="card">
      <h3>${esc(patient.name)}</h3>
      <div class="section-note">Apenas itens já <b>prescritos na venda</b> deste paciente aparecem aqui. Não é possível inserir medicamento novo.</div>
      <div class="field" style="max-width:420px;">
        <label>Buscar item não prescrito (teste de bloqueio)</label>
        <input id="search-block" placeholder="Digite o nome de um medicamento...">
        <div id="block-msg"></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Produto</th><th>Prescrito</th><th>Usado</th><th>Saldo</th><th>Qtd nesta baixa</th><th></th></tr></thead>
        <tbody>
          ${pendentes.length ? pendentes.map(ti => {
            const product = Store.get('products', ti.productId);
            const remaining = ti.qtyTotal - ti.qtyUsed;
            return `<tr>
              <td>${esc(product ? product.name : '?')}</td>
              <td>${ti.qtyTotal} ${esc(ti.unit)}</td>
              <td>${ti.qtyUsed} ${esc(ti.unit)}</td>
              <td><b>${remaining}</b> ${esc(ti.unit)}</td>
              <td><input type="number" step="0.01" min="0.01" max="${remaining}" id="qty-${ti.id}" value="${remaining}" style="max-width:110px;"></td>
              <td><button class="btn sm" data-baixa-fechada="${ti.id}">Confirmar uso</button></td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="6">Nenhum item pendente de baixa para este paciente.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `;

  document.getElementById('search-block').addEventListener('input', e => {
    const term = e.target.value.trim().toLowerCase();
    const box = document.getElementById('block-msg');
    if (!term) { box.innerHTML = ''; return; }
    const found = pendentes.some(ti => productName(ti.productId).toLowerCase().includes(term));
    const existsAnywhere = Store.find('products', p => p.controlType === 'fechado' && p.name.toLowerCase().includes(term)).length > 0;
    if (found) { box.innerHTML = ''; return; }
    if (existsAnywhere || term.length >= 2) {
      box.innerHTML = msg('error', 'Este item não está no tratamento prescrito deste paciente. Solicite ao setor de vendas o lançamento de uma nova venda antes de utilizá-lo.');
    }
  });

  document.querySelectorAll('[data-baixa-fechada]').forEach(b => b.addEventListener('click', async () => {
    const tiId = b.dataset.baixaFechada;
    const qty = Number(document.getElementById('qty-' + tiId).value);
    try {
      await registerBaixaFechada({ patientId, treatmentItemId: tiId, qty });
      flash('success', 'Baixa registrada. Estoque atualizado e pendência de confirmação criada para o paciente.');
      go('baixa/' + patientId);
    } catch (err) { flash('error', err.message); render(); }
  }));
}

/* =============================== BAIXA DE INSUMO (ESTOQUE) =============================== */
function renderBaixaInsumo() {
  const livres = Store.all('products').filter(p => p.category === 'insumo' && p.controlType === 'livre');
  const recentes = Store.find('consumptions', c => c.type === 'livre').sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 30);

  setContent(`
    ${topbar('Baixa de Insumo (Estoque)', 'Lançamento de saída de estoque — não vinculado a paciente, reflete apenas em estoque, compras e saídas')}
    ${popFlash()}
    <div class="section-note">Esta baixa é <b>exclusiva de insumos</b> (gaze, algodão, luva etc.) e é apenas um controle de estoque — não gera cobrança, não entra na timeline de nenhum paciente. Sempre desconta do estoque normalmente.</div>
    <div class="grid-2">
      <div class="card">
        <h3>Registrar saída de insumo</h3>
        <form id="form-livre">
          <div class="field">
            <label>Insumo *</label>
            <select name="productId" required>
              <option value="">Selecione...</option>
              ${livres.map(p => `<option value="${p.id}" data-unit="${p.unit}">${esc(p.name)} (saldo: ${p.stock} ${esc(p.unit)})</option>`).join('')}
            </select>
          </div>
          <div class="field-row">
            <div class="field"><label>Quantidade *</label><input type="number" step="0.01" min="0.01" name="qty" required></div>
            <div class="field"><label>Unidade</label><select name="unit">${unitOptions()}</select></div>
          </div>
          <div class="field"><label>Observação (opcional)</label><input name="note" placeholder="Ex: uso em curativo, sala 2..."></div>
          <div class="form-actions"><button class="btn" type="submit">Registrar saída</button></div>
        </form>
        ${!livres.length ? '<p class="hint">Nenhum insumo com controle Livre cadastrado. <a href="#/produtos">Cadastrar produto →</a></p>' : ''}
      </div>
      <div class="card">
        <h3>Últimas saídas de insumo</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Data</th><th>Produto</th><th>Qtd</th><th>Obs.</th><th></th></tr></thead>
          <tbody>
            ${recentes.length ? recentes.map(c => `
              <tr><td>${fmtDateTime(c.date)}</td><td>${esc(productName(c.productId))}</td><td>${c.qty} ${esc(c.unit)}</td><td>${esc(c.note || '—')}</td>
              <td><button class="btn-icon" data-del-consumption="${c.id}" style="color:var(--vermelho);">Excluir</button></td></tr>
            `).join('') : `<tr class="empty-row"><td colspan="5">Nenhuma saída registrada ainda.</td></tr>`}
          </tbody>
        </table></div>
        <p class="hint" style="margin-top:10px;">Para o saldo completo e histórico por período, veja o <a href="#/estoque">Dashboard de Estoque</a>.</p>
      </div>
    </div>
  `);

  const select = document.querySelector('#form-livre [name=productId]');
  select.addEventListener('change', () => {
    const opt = select.selectedOptions[0];
    if (opt && opt.dataset.unit) document.querySelector('#form-livre [name=unit]').value = opt.dataset.unit;
  });
  const form = document.getElementById('form-livre');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await registerBaixaLivre({ productId: fd.get('productId'), qty: Number(fd.get('qty')), unit: fd.get('unit'), note: fd.get('note') });
      flash('success', 'Saída de insumo registrada e estoque atualizado.');
      go('baixa-insumo');
    } catch (err) { flash('error', err.message); render(); }
  });
  document.querySelectorAll('[data-del-consumption]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta saída de insumo? A quantidade será devolvida ao estoque.')) return;
    await deleteConsumption(b.dataset.delConsumption);
    flash('success', 'Saída excluída e estoque estornado.');
    go('baixa-insumo');
  }));
}

/* =============================== COMPRAS =============================== */
function newPurchaseItem() {
  return { productId: '', qty: '', unit: '', unitPrice: '', mode: 'direto', convQty: '', convFactor: '', convUnitPrice: '' };
}
let purchaseItemsBuffer = [newPurchaseItem()];

function renderCompras(category) {
  category = category === 'insumo' ? 'insumo' : 'medicamento';
  const suppliers = Store.all('suppliers');
  const products = Store.all('products').filter(p => p.category === category);
  const purchases = Store.find('purchases', p => p.category === category).sort((a, b) => a.date < b.date ? 1 : -1);

  setContent(`
    ${topbar('Compras', 'Orçamento e compra em aberto — separado por categoria')}
    ${popFlash()}
    <div class="tabs">
      <button class="tab-btn ${category === 'medicamento' ? 'active' : ''}" data-cat="medicamento">Medicamentos</button>
      <button class="tab-btn ${category === 'insumo' ? 'active' : ''}" data-cat="insumo">Insumos</button>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Nova compra (${category === 'medicamento' ? 'Medicamento' : 'Insumo'})</h3>
        <form id="form-purchase">
          <div class="field-row">
            <div class="field"><label>Fornecedor *</label>
              <select name="supplierId" required><option value="">Selecione...</option>${opts(suppliers, 'id', 'name')}</select>
            </div>
            <div class="field"><label>Status *</label>
              <select name="status" required>
                <option value="orcamento">Orçamento</option>
                <option value="compra_aberto">Compra em aberto</option>
              </select>
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>Data *</label><input type="date" name="date" value="${todayInputDate()}" required></div>
            <div class="field"><label>Vencimento (opcional)</label><input type="date" name="dueDate"></div>
            <div class="field"><label>Forma de pagamento</label><select name="paymentMethod">${paymentOptions()}</select></div>
          </div>
          <fieldset>
            <legend>Produtos (${category})</legend>
            <div id="purchase-items"></div>
            <button type="button" class="btn secondary sm" id="add-purchase-item">+ Adicionar item</button>
          </fieldset>
          <div class="form-actions"><button class="btn" type="submit">Salvar compra</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Compras — ${category === 'medicamento' ? 'Medicamentos' : 'Insumos'} (${purchases.length})</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Data</th><th>Fornecedor</th><th>Itens</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${purchases.length ? purchases.map(p => `
              <tr>
                <td>${fmtDate(p.date)}</td><td>${esc(supplierName(p.supplierId))}</td>
                <td>${(p.items || []).map(it => it.purchaseQty ? `${esc(productName(it.productId))} (${it.purchaseQty} ${esc(it.purchaseUnitLabel)} = ${it.qty} ${esc(it.unit)})` : `${esc(productName(it.productId))} (${it.qty} ${esc(it.unit)})`).join(', ')}</td>
                <td>${fmtMoney(purchaseTotal(p))}</td>
                <td>${statusPill(p.status)}</td>
                <td>
                  <button class="btn-icon" data-pdf="${p.id}" title="Gerar PDF">PDF</button>
                  ${p.status !== 'recebido' ? `<a class="btn secondary sm" href="#/recebimento/${category}">Receber</a>` : ''}
                  <button class="btn-icon" data-del-purchase="${p.id}" style="color:var(--vermelho);">Excluir</button>
                </td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma compra registrada nesta categoria.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
  `);

  document.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => go('compras/' + b.dataset.cat)));

  purchaseItemsBuffer = [newPurchaseItem()];
  renderPurchaseItems(products);
  document.getElementById('add-purchase-item').addEventListener('click', () => {
    purchaseItemsBuffer.push(newPurchaseItem());
    renderPurchaseItems(products);
  });

  document.getElementById('form-purchase').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = purchaseItemsBuffer.filter(it => it.productId).map(it => {
      const product = Store.get('products', it.productId);
      if (it.mode === 'conversao' && product && product.hasConversion) {
        const convQty = Number(it.convQty) || 0;
        const convFactor = Number(it.convFactor) || 0;
        const convUnitPrice = Number(it.convUnitPrice) || 0;
        const qty = convQty * convFactor;
        const totalPrice = convQty * convUnitPrice;
        return {
          productId: it.productId, qty, unit: product.unit,
          unitPrice: qty > 0 ? totalPrice / qty : 0, totalPrice,
          purchaseQty: convQty, purchaseUnitLabel: product.convUnitLabel, purchaseUnitFactor: convFactor
        };
      }
      const qty = Number(it.qty) || 0;
      const unitPrice = Number(it.unitPrice) || 0;
      return { productId: it.productId, qty, unit: it.unit || (product ? product.unit : ''), unitPrice, totalPrice: unitPrice * qty };
    }).filter(it => it.qty > 0);
    if (!items.length) { flash('error', 'Adicione ao menos um produto com quantidade válida.'); render(); return; }
    try {
      await registerPurchase({
        category, supplierId: fd.get('supplierId'), items,
        paymentMethod: fd.get('paymentMethod'), status: fd.get('status'),
        date: fd.get('date'), dueDate: fd.get('dueDate')
      });
      flash('success', 'Compra registrada.');
      go('compras/' + category);
    } catch (err) { flash('error', err.message); render(); }
  });

  document.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => openPurchasePdf(b.dataset.pdf)));
  document.querySelectorAll('[data-del-purchase]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta compra? Se já houver recebimento conferido, o estoque correspondente será estornado. Esta ação não pode ser desfeita.')) return;
    await deletePurchase(b.dataset.delPurchase);
    flash('success', 'Compra excluída.');
    go('compras/' + category);
  }));
}

function renderPurchaseItems(products) {
  const box = document.getElementById('purchase-items');
  box.innerHTML = purchaseItemsBuffer.map((it, idx) => {
    const product = Store.get('products', it.productId);
    const showConversion = product && product.hasConversion;
    const mode = showConversion ? it.mode : 'direto';
    const computedMl = mode === 'conversao' ? ((Number(it.convQty) || 0) * (Number(it.convFactor) || 0)) : 0;
    return `
    <div class="repeatable-item" style="flex-wrap:wrap;">
      <div class="field" style="flex:2;">
        <label>Produto</label>
        <select data-idx="${idx}" data-field="productId" class="pi-product">
          <option value="">Selecione...</option>
          ${products.map(p => `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${esc(p.name)}${p.hasConversion ? ' (conversível)' : ''}</option>`).join('')}
        </select>
      </div>
      ${showConversion ? `
        <div class="field">
          <label>Modo de compra</label>
          <select data-idx="${idx}" data-field="mode">
            <option value="direto" ${mode === 'direto' ? 'selected' : ''}>Direto em ${esc(product.unit)}</option>
            <option value="conversao" ${mode === 'conversao' ? 'selected' : ''}>Em ${esc(product.convUnitLabel || 'unidade')} (converter p/ ${esc(product.unit)})</option>
          </select>
        </div>
      ` : ''}
      ${mode === 'conversao' ? `
        <div class="field"><label>Qtd de ${esc(product.convUnitLabel || 'unidades')}</label><input type="number" step="0.01" min="0.01" data-idx="${idx}" data-field="convQty" value="${it.convQty}"></div>
        <div class="field"><label>ML por ${esc(product.convUnitLabel || 'unidade')}</label><input type="number" step="0.01" min="0" data-idx="${idx}" data-field="convFactor" value="${it.convFactor}"></div>
        <div class="field"><label>Valor por ${esc(product.convUnitLabel || 'unidade')} (R$)</label><input type="number" step="0.01" min="0" data-idx="${idx}" data-field="convUnitPrice" value="${it.convUnitPrice}"></div>
        <div class="field" style="flex-basis:100%;"><span class="pill blue" data-conv-preview="${idx}">= ${computedMl} ${esc(product.unit)} no estoque</span></div>
      ` : `
        <div class="field"><label>Qtd</label><input type="number" step="0.01" min="0.01" data-idx="${idx}" data-field="qty" value="${it.qty}"></div>
        <div class="field"><label>Unidade</label><select data-idx="${idx}" data-field="unit">${unitOptions(it.unit)}</select></div>
        <div class="field"><label>Valor unitário (R$)</label><input type="number" step="0.01" min="0" data-idx="${idx}" data-field="unitPrice" value="${it.unitPrice}"></div>
      `}
      <button type="button" class="btn-icon" data-remove="${idx}">✕</button>
    </div>
  `;
  }).join('');
  box.querySelectorAll('select,input').forEach(el => {
    el.addEventListener('input', () => {
      const idx = Number(el.dataset.idx), field = el.dataset.field;
      purchaseItemsBuffer[idx][field] = el.value;
      if (field === 'productId' || field === 'mode') {
        const p = Store.get('products', purchaseItemsBuffer[idx].productId);
        if (field === 'productId' && p) {
          purchaseItemsBuffer[idx].unit = p.unit;
          purchaseItemsBuffer[idx].mode = p.hasConversion ? 'conversao' : 'direto';
          if (p.hasConversion) purchaseItemsBuffer[idx].convFactor = p.convFactorMl || '';
        }
        renderPurchaseItems(products);
        return;
      }
      if (field === 'convQty' || field === 'convFactor') {
        const preview = box.querySelector(`[data-conv-preview="${idx}"]`);
        if (preview) {
          const p = Store.get('products', purchaseItemsBuffer[idx].productId);
          const ml = (Number(purchaseItemsBuffer[idx].convQty) || 0) * (Number(purchaseItemsBuffer[idx].convFactor) || 0);
          preview.textContent = `= ${ml} ${p ? p.unit : ''} no estoque`;
        }
      }
    });
  });
  box.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    purchaseItemsBuffer.splice(Number(b.dataset.remove), 1);
    if (!purchaseItemsBuffer.length) purchaseItemsBuffer.push(newPurchaseItem());
    renderPurchaseItems(products);
  }));
}

function openPurchasePdf(purchaseId) {
  const p = Store.get('purchases', purchaseId);
  if (!p) return;
  const w = window.open('about:blank', '_blank');
  if (!w) {
    flash('error', 'Não foi possível abrir o PDF — o navegador bloqueou o pop-up. Permita pop-ups para este site e tente novamente.');
    render();
    return;
  }
  const rows = (p.items || []).map(it => `
    <tr><td>${esc(productName(it.productId))}${it.purchaseQty ? `<br><small>(${it.purchaseQty} ${esc(it.purchaseUnitLabel)} × ${it.purchaseUnitFactor} ml)</small>` : ''}</td><td>${it.qty} ${esc(it.unit)}</td>
    <td>${fmtMoney(it.unitPrice)}</td><td>${fmtMoney(it.totalPrice || it.unitPrice * it.qty)}</td></tr>
  `).join('');

  const settings = getSettings();
  const supplier = Store.get('suppliers', p.supplierId);
  const hasCompanyData = settings.companyName || settings.companyCnpj || settings.companyAddress || settings.companyPhone || settings.companyEmail;
  const companyBlock = hasCompanyData ? `
    <div class="party">
      ${settings.logoDataUrl ? `<img src="${settings.logoDataUrl}" class="party-logo">` : ''}
      <div class="party-title">Comprador</div>
      ${settings.companyName ? `<div><b>${esc(settings.companyName)}</b></div>` : ''}
      ${settings.companyCnpj ? `<div>CNPJ: ${esc(settings.companyCnpj)}${settings.companyIe ? ' · IE: ' + esc(settings.companyIe) : ''}</div>` : ''}
      ${settings.companyAddress ? `<div>${esc(settings.companyAddress)}</div>` : ''}
      ${(settings.companyPhone || settings.companyEmail) ? `<div>${esc(settings.companyPhone || '')} ${settings.companyPhone && settings.companyEmail ? '·' : ''} ${esc(settings.companyEmail || '')}</div>` : ''}
    </div>
  ` : `<div class="party"><div class="party-title">Comprador</div><div class="hint-pdf">Cadastre os dados da empresa em Configurações da Clínica para que apareçam aqui.</div></div>`;

  const supplierBlock = `
    <div class="party">
      <div class="party-title">Fornecedor</div>
      <div><b>${esc(supplierName(p.supplierId))}</b></div>
      ${supplier && supplier.cnpj ? `<div>CNPJ: ${esc(supplier.cnpj)}</div>` : ''}
      ${supplier && (supplier.phone || supplier.email) ? `<div>${esc(supplier.phone || '')} ${supplier && supplier.phone && supplier.email ? '·' : ''} ${esc(supplier ? supplier.email || '' : '')}</div>` : ''}
    </div>
  `;

  w.document.write(`
    <html><head><title>Orçamento / Pedido de Compra</title>
    <style>
      body{font-family:Arial,sans-serif;padding:40px;color:#1e2530;}
      h1{font-size:20px;color:#0b3d63;} table{width:100%;border-collapse:collapse;margin-top:20px;}
      th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px;} th{background:#f1f5f9;}
      .total{text-align:right;font-size:15px;font-weight:bold;margin-top:14px;}
      .meta{margin:4px 0;font-size:13px;}
      .parties{display:flex;gap:24px;margin-top:16px;}
      .party{flex:1;font-size:12.5px;line-height:1.5;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;}
      .party-title{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#888;margin-bottom:6px;}
      .party-logo{max-height:40px;max-width:160px;display:block;margin-bottom:8px;}
      .hint-pdf{color:#aaa;font-style:italic;}
    </style></head><body>
      <h1>Orçamento / Pedido de Compra</h1>
      <div class="parties">${companyBlock}${supplierBlock}</div>
      <div class="meta" style="margin-top:16px;"><b>Categoria:</b> ${p.category === 'medicamento' ? 'Medicamento' : 'Insumo'}</div>
      <div class="meta"><b>Data:</b> ${fmtDate(p.date)} ${p.dueDate ? '· <b>Vencimento:</b> ' + fmtDate(p.dueDate) : ''}</div>
      <div class="meta"><b>Forma de pagamento:</b> ${esc(p.paymentMethod || '—')}</div>
      <div class="meta"><b>Status:</b> ${esc(STATUS_LABELS[p.status] || p.status)}</div>
      <table><thead><tr><th>Produto</th><th>Qtd</th><th>Valor unit.</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="total">Total geral: ${fmtMoney(purchaseTotal(p))}</div>
      <p style="margin-top:30px;font-size:11px;color:#888;">Use Ctrl+P / Cmd+P e "Salvar como PDF" para exportar este documento.</p>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  w.document.close();
}

/* =============================== CONTAS A PAGAR =============================== */
function renderContasAPagar() {
  let filterCat = 'todos';
  const draw = () => {
    let purchases = Store.all('purchases').filter(p => p.status !== 'recebido');
    if (filterCat !== 'todos') purchases = purchases.filter(p => p.category === filterCat);
    purchases.sort((a, b) => (a.dueDate || a.date) < (b.dueDate || b.date) ? -1 : 1);
    const total = purchases.reduce((s, p) => s + purchaseTotal(p), 0);

    setContent(`
      ${topbar('Contas a Pagar', 'O que há a pagar, por data de vencimento, produto e fornecedor')}
      ${popFlash()}
      <div class="card">
        <div class="field-row" style="align-items:flex-end;">
          <div class="field" style="max-width:260px;">
            <label>Filtrar por categoria</label>
            <select id="filter-cat">
              <option value="todos" ${filterCat === 'todos' ? 'selected' : ''}>Todas</option>
              <option value="medicamento" ${filterCat === 'medicamento' ? 'selected' : ''}>Medicamento</option>
              <option value="insumo" ${filterCat === 'insumo' ? 'selected' : ''}>Insumo</option>
            </select>
          </div>
          <div class="stat" style="margin-left:auto;"><div class="num">${fmtMoney(total)}</div><div class="label">Total em aberto</div></div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Categoria</th><th>Produtos</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            ${purchases.length ? purchases.map(p => `
              <tr>
                <td>${fmtDate(p.dueDate || p.date)}</td>
                <td>${esc(supplierName(p.supplierId))}</td>
                <td>${catPill(p.category)}</td>
                <td>${(p.items || []).map(it => esc(productName(it.productId))).join(', ')}</td>
                <td>${fmtMoney(purchaseTotal(p))}</td>
                <td>${statusPill(p.status)}</td>
              </tr>
            `).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma conta em aberto.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    `);
    document.getElementById('filter-cat').addEventListener('change', e => { filterCat = e.target.value; draw(); });
  };
  draw();
}

/* =============================== COMPRAS CHEGARAM (RECEBIMENTO) =============================== */
function renderRecebimento(category) {
  category = category === 'insumo' ? 'insumo' : 'medicamento';
  const openPurchases = Store.find('purchases', p => p.category === category && p.status !== 'recebido');
  const receipts = Store.find('receipts', r => r.category === category).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);

  setContent(`
    ${topbar('Compras Chegaram', 'Recebimento — valida o pedido e dá entrada no estoque')}
    ${popFlash()}
    <div class="tabs">
      <button class="tab-btn ${category === 'medicamento' ? 'active' : ''}" data-cat="medicamento">Medicamentos</button>
      <button class="tab-btn ${category === 'insumo' ? 'active' : ''}" data-cat="insumo">Insumos</button>
    </div>
    <div class="card">
      <h3>Compras aguardando recebimento</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Data pedido</th><th>Fornecedor</th><th>Itens</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${openPurchases.length ? openPurchases.map(p => `
            <tr>
              <td>${fmtDate(p.date)}</td><td>${esc(supplierName(p.supplierId))}</td>
              <td>${(p.items || []).map(it => `${esc(productName(it.productId))} (${it.qty} ${esc(it.unit)})`).join(', ')}</td>
              <td>${statusPill(p.status)}</td>
              <td>
                <button class="btn sm" data-receive="${p.id}">Registrar recebimento</button>
                <button class="btn-icon" data-del-open-purchase="${p.id}" style="color:var(--vermelho);">Excluir</button>
              </td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="5">Nenhuma compra em aberto nesta categoria.</td></tr>`}
        </tbody>
      </table></div>
    </div>
    <div id="receipt-form-box"></div>
    <div class="card">
      <h3>Recebimentos registrados</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Fornecedor</th><th>Itens recebidos</th><th>NF</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${receipts.length ? receipts.map(r => {
            const purchase = Store.get('purchases', r.purchaseId);
            const itemsDesc = (r.items || []).map(it => `${esc(productName(it.productId))} — ${it.qty} ${esc(it.unit)}${it.lot ? ` (Lote: ${esc(it.lot)})` : ''}`).join('<br>');
            return `<tr>
              <td>${fmtDate(r.createdAt)}</td><td>${purchase ? esc(supplierName(purchase.supplierId)) : '—'}</td>
              <td>${itemsDesc || '—'}</td>
              <td>${esc(r.nf || '—')}</td><td>${statusPill(r.status)}</td>
              <td>
                ${r.status !== 'conferida' ? `<button class="btn sm" data-confirm-receipt="${r.id}">Compra conferida</button>` : '<span class="hint">Estoque atualizado</span>'}
                <button class="btn-icon" data-del-receipt="${r.id}" style="color:var(--vermelho);">Excluir</button>
              </td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="6">Nenhum recebimento registrado.</td></tr>`}
        </tbody>
      </table></div>
    </div>
  `);

  document.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => go('recebimento/' + b.dataset.cat)));
  document.querySelectorAll('[data-receive]').forEach(b => b.addEventListener('click', () => renderReceiptForm(b.dataset.receive, category)));
  document.querySelectorAll('[data-del-open-purchase]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir esta compra em aberto?')) return;
    await deletePurchase(b.dataset.delOpenPurchase);
    flash('success', 'Compra excluída.');
    go('recebimento/' + category);
  }));
  document.querySelectorAll('[data-confirm-receipt]').forEach(b => b.addEventListener('click', async () => {
    try {
      await confirmReceipt(b.dataset.confirmReceipt);
      flash('success', 'Compra conferida — estoque atualizado.');
      go('recebimento/' + category);
    } catch (err) { flash('error', err.message); render(); }
  }));
  document.querySelectorAll('[data-del-receipt]').forEach(b => b.addEventListener('click', async () => {
    if (!confirmAction('Excluir este recebimento? Se já estava conferido, o estoque será estornado e a compra volta para "Compra em aberto".')) return;
    await deleteReceipt(b.dataset.delReceipt);
    flash('success', 'Recebimento excluído.');
    go('recebimento/' + category);
  }));
}

function renderReceiptForm(purchaseId, category) {
  const purchase = Store.get('purchases', purchaseId);
  if (!purchase) return;
  document.getElementById('receipt-form-box').innerHTML = `
    <div class="card">
      <h3>Confirmar recebimento — ${esc(supplierName(purchase.supplierId))}</h3>
      <form id="form-receipt">
        <fieldset>
          <legend>Itens recebidos</legend>
          ${(purchase.items || []).map((it, idx) => `
            <div class="repeatable-item">
              <div class="field" style="flex:2;"><label>Produto</label><input value="${esc(productName(it.productId))}" disabled></div>
              <div class="field"><label>Quantidade *</label><input type="number" step="0.01" min="0" name="qty-${idx}" value="${it.qty}" required></div>
              <div class="field"><label>Unidade</label><input value="${esc(it.unit)}" disabled></div>
              <div class="field"><label>Nº do lote (opcional)</label><input name="lot-${idx}" placeholder="Não obrigatório"></div>
            </div>
          `).join('')}
        </fieldset>
        <div class="field-row">
          <div class="field"><label>Número da NF do fornecedor</label><input name="nf"></div>
        </div>
        <div class="field"><label>Observações</label><textarea name="notes" rows="2"></textarea></div>
        <div class="form-actions">
          <button type="submit" class="btn">Salvar recebimento</button>
          <button type="button" class="btn secondary" id="cancel-receipt">Cancelar</button>
        </div>
        <p class="hint">Ao clicar em "Compra conferida" na lista abaixo, o sistema dará entrada automática no estoque.</p>
      </form>
    </div>
  `;
  document.getElementById('cancel-receipt').addEventListener('click', () => { document.getElementById('receipt-form-box').innerHTML = ''; });
  document.getElementById('form-receipt').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = (purchase.items || []).map((it, idx) => ({
      productId: it.productId, unit: it.unit,
      qty: Number(fd.get('qty-' + idx)), lot: (fd.get('lot-' + idx) || '').trim()
    }));
    try {
      await registerReceipt({ purchaseId, items, nf: fd.get('nf'), notes: fd.get('notes') });
      flash('success', 'Recebimento registrado. Clique em "Compra conferida" para dar entrada no estoque.');
      go('recebimento/' + category);
    } catch (err) { flash('error', err.message); render(); }
  });
}

/* =============================== ESTOQUE =============================== */
function renderEstoque() {
  let filterCat = 'todos';
  let dateFrom = '', dateTo = '';
  let search = '';

  setContent(`
    ${topbar('Dashboard de Estoque', 'Saldo atual, alertas de estoque mínimo e histórico por período')}
    ${popFlash()}
    <div class="card">
      <div class="field-row" style="align-items:flex-end;">
        <div class="field" style="max-width:220px;">
          <label>Categoria</label>
          <select id="f-cat">
            <option value="todos">Todas</option>
            <option value="medicamento">Medicamento</option>
            <option value="insumo">Insumo</option>
          </select>
        </div>
        <div class="field" style="max-width:240px;"><label>Buscar insumo/medicamento</label><input id="f-search" placeholder="Nome do produto..."></div>
        <div class="field" style="max-width:200px;"><label>Período de (histórico)</label><input type="date" id="f-from"></div>
        <div class="field" style="max-width:200px;"><label>Período até</label><input type="date" id="f-to"></div>
      </div>
    </div>

    <div id="estoque-alertas"></div>

    <div class="card">
      <h3>Saldo atual por produto</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Produto</th><th>Categoria</th><th>Controle</th><th>Saldo</th><th>Mínimo</th></tr></thead>
        <tbody id="estoque-saldo-body"></tbody>
      </table></div>
    </div>

    <div class="card">
      <h3 id="estoque-mov-title">Histórico de movimentações (todas)</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Origem</th><th>Obs.</th></tr></thead>
        <tbody id="estoque-mov-body"></tbody>
      </table></div>
    </div>
  `);

  const draw = () => {
    let products = Store.all('products');
    if (filterCat !== 'todos') products = products.filter(p => p.category === filterCat);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(term));
    }

    let movements = Store.all('stockMovements');
    if (dateFrom) movements = movements.filter(m => m.date >= dateFrom);
    if (dateTo) movements = movements.filter(m => m.date <= dateTo + 'T23:59:59');
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      movements = movements.filter(m => productName(m.productId).toLowerCase().includes(term));
    }
    movements.sort((a, b) => a.date < b.date ? 1 : -1);

    const low = products.filter(p => p.stock <= p.minStock);

    document.getElementById('estoque-alertas').innerHTML = low.length ? `<div class="card" style="border-left:4px solid var(--vermelho);">
      <h3 style="color:var(--vermelho);">⚠ Alertas de estoque mínimo</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th></tr></thead>
        <tbody>${low.map(p => `<tr><td>${esc(p.name)}</td><td>${catPill(p.category)}</td><td><b>${p.stock}</b> ${esc(p.unit)}</td><td>${p.minStock} ${esc(p.unit)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : '';

    document.getElementById('estoque-saldo-body').innerHTML = products.length ? products.map(p => `
      <tr>
        <td>${esc(p.name)}</td><td>${catPill(p.category)}</td><td>${controlPill(p.controlType)}</td>
        <td>${p.stock <= p.minStock ? `<span class="pill red">${p.stock} ${esc(p.unit)}</span>` : `${p.stock} ${esc(p.unit)}`}</td>
        <td>${p.minStock} ${esc(p.unit)}</td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="5">Nenhum produto encontrado.</td></tr>`;

    document.getElementById('estoque-mov-title').textContent = `Histórico de movimentações ${(dateFrom || dateTo || search) ? '(filtrado)' : '(todas)'}`;
    document.getElementById('estoque-mov-body').innerHTML = movements.length ? movements.slice(0, 200).map(m => `
      <tr>
        <td>${fmtDateTime(m.date)}</td><td>${esc(productName(m.productId))}</td>
        <td>${m.type === 'entrada' ? '<span class="pill green">Entrada</span>' : '<span class="pill red">Saída</span>'}</td>
        <td>${m.qty} ${esc(m.unit)}</td><td>${esc(refTypeLabel(m.refType))}</td><td>${esc(m.note || '—')}</td>
      </tr>
    `).join('') : `<tr class="empty-row"><td colspan="6">Nenhuma movimentação no período.</td></tr>`;
  };

  document.getElementById('f-cat').addEventListener('change', e => { filterCat = e.target.value; draw(); });
  document.getElementById('f-from').addEventListener('change', e => { dateFrom = e.target.value; draw(); });
  document.getElementById('f-to').addEventListener('change', e => { dateTo = e.target.value; draw(); });
  document.getElementById('f-search').addEventListener('input', e => { search = e.target.value; draw(); });
  draw();
}
function refTypeLabel(rt) {
  return {
    baixa_fechada: 'Baixa (prescrito)', baixa_livre: 'Baixa (livre/insumo)', compra_conferida: 'Compra conferida',
    estorno_baixa: 'Estorno de baixa excluída', estorno_recebimento: 'Estorno de recebimento excluído'
  }[rt] || rt || '—';
}

/* =============================== LOGIN / INICIALIZAÇÃO =============================== */
function renderLoginScreen(errorMsg) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <h1>Clínica · Sistema</h1>
        <p class="hint" style="margin-top:-6px;">Acesso da equipe</p>
        ${errorMsg ? msg('error', esc(errorMsg)) : ''}
        <form id="form-login">
          <div class="field"><label>E-mail</label><input type="email" name="email" required autofocus></div>
          <div class="field"><label>Senha</label><input type="password" name="password" required></div>
          <div class="form-actions"><button class="btn" type="submit" style="width:100%;">Entrar</button></div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: fd.get('email').trim(), password: fd.get('password') });
    if (error) {
      renderLoginScreen('Erro ao entrar: ' + error.message + ' (código: ' + (error.status || error.code || '?') + ')');
      return;
    }
    await bootApp();
  });
}

let hashListenerAttached = false;
async function bootApp() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="boot-loading">Carregando dados...</div>`;
  try {
    await loadAllData();
    await loadSettingsRow();
    await seedIfEmpty();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="boot-loading">Erro ao carregar dados: ${esc(e.message)}</div>`;
    return;
  }
  renderShell();
  render();
  if (!hashListenerAttached) {
    window.addEventListener('hashchange', render);
    hashListenerAttached = true;
  }
}

async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { renderLoginScreen(); return; }
  await bootApp();
}

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') renderLoginScreen();
});

initAuth();
