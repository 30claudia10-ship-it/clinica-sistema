/* ===========================================================================
   storage.js — camada de dados (Supabase) + regras de negócio
   Sistema de Mapeamento de Tratamento, Vendas, Compras e Estoque (Clínica)
   =========================================================================== */

function nowISO() { return new Date().toISOString(); }

function todayInputDate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------------------
   conversão snake_case (banco) <-> camelCase (app)
   --------------------------------------------------------------------------- */
function toCamelKey(k) { return k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()); }
function toSnakeKey(k) { return k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()); }
function rowToCamel(row) {
  if (!row) return row;
  const out = {};
  for (const k in row) out[toCamelKey(k)] = row[k];
  return out;
}
function objToSnake(obj) {
  const out = {};
  for (const k in obj) out[toSnakeKey(k)] = obj[k];
  return out;
}

const TABLE_MAP = {
  patients: 'patients', services: 'services', products: 'products', units: 'units',
  suppliers: 'suppliers', paymentMethods: 'payment_methods', sales: 'sales',
  treatmentItems: 'treatment_items', consumptions: 'consumptions', purchases: 'purchases',
  receipts: 'receipts', stockMovements: 'stock_movements', portalTokens: 'portal_tokens'
};

const cache = {};
Object.keys(TABLE_MAP).forEach(k => cache[k] = []);

const TABLES_WITH_UPDATED_AT = new Set(['patients', 'services', 'products', 'treatmentItems']);

async function loadAllData() {
  for (const key of Object.keys(TABLE_MAP)) {
    const { data, error } = await sb.from(TABLE_MAP[key]).select('*');
    if (error) throw error;
    cache[key] = (data || []).map(rowToCamel);
  }
}

const Store = {
  all(name) { return cache[name] || []; },
  get(name, id) { return (cache[name] || []).find(x => x.id === id) || null; },
  find(name, predicate) { return (cache[name] || []).filter(predicate); },
  findOne(name, predicate) { return (cache[name] || []).find(predicate) || null; },

  async add(name, obj) {
    const table = TABLE_MAP[name];
    const payload = objToSnake(obj);
    delete payload.id;
    const { data, error } = await sb.from(table).insert(payload).select().single();
    if (error) throw new Error(error.message);
    const row = rowToCamel(data);
    cache[name].push(row);
    return row;
  },

  async update(name, id, patch) {
    const table = TABLE_MAP[name];
    const withTimestamp = TABLES_WITH_UPDATED_AT.has(name)
      ? Object.assign({}, patch, { updatedAt: patch.updatedAt || nowISO() })
      : patch;
    const payload = objToSnake(withTimestamp);
    const { data, error } = await sb.from(table).update(payload).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    const row = rowToCamel(data);
    const idx = cache[name].findIndex(x => x.id === id);
    if (idx !== -1) cache[name][idx] = row; else cache[name].push(row);
    return row;
  },

  async remove(name, id) {
    const table = TABLE_MAP[name];
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    cache[name] = cache[name].filter(x => x.id !== id);
  }
};

/* ---------------------------------------------------------------------------
   SEED — dados iniciais (só roda se as tabelas de apoio estiverem vazias)
   --------------------------------------------------------------------------- */
async function seedIfEmpty() {
  if (Store.all('units').length === 0) {
    for (const name of ['Ampola', 'Frasco', 'ML', 'Unidade', 'KG', 'Grama', 'Caixa', 'Par', 'Seringa']) {
      await Store.add('units', { name });
    }
  }
  if (Store.all('paymentMethods').length === 0) {
    for (const name of ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Dinheiro', 'Transferência']) {
      await Store.add('paymentMethods', { name });
    }
  }
  if (Store.all('products').length === 0) {
    await Store.add('products', { name: 'Soro Fisiológico 500ml', category: 'medicamento', unit: 'ML', minStock: 20, stock: 0, controlType: 'fechado' });
    await Store.add('products', { name: 'Gaze Estéril', category: 'insumo', unit: 'Unidade', minStock: 50, stock: 0, controlType: 'livre' });
    await Store.add('products', { name: 'Algodão', category: 'insumo', unit: 'Grama', minStock: 100, stock: 0, controlType: 'livre' });
    await Store.add('products', { name: 'Luva de Procedimento (par)', category: 'insumo', unit: 'Par', minStock: 30, stock: 0, controlType: 'livre' });
  }
  if (Store.all('services').length === 0) {
    await Store.add('services', { name: 'Aplicação Injetável', category: 'Procedimento', active: true });
    await Store.add('services', { name: 'Hidratação Venosa', category: 'Procedimento', active: true });
  }
}

/* ---------------------------------------------------------------------------
   CONFIGURAÇÕES DA CLÍNICA (nome + logo + dados da empresa)
   --------------------------------------------------------------------------- */
async function loadSettingsRow() {
  const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
  if (error) throw new Error(error.message);
  cache.settings = [rowToCamel(data)];
}
function getSettings() {
  return (cache.settings && cache.settings[0]) || {};
}
async function saveSettings(patch) {
  const payload = objToSnake(patch);
  const { data, error } = await sb.from('settings').update(payload).eq('id', 1).select().single();
  if (error) throw new Error(error.message);
  cache.settings = [rowToCamel(data)];
  return cache.settings[0];
}

/* ---------------------------------------------------------------------------
   PRODUTOS / ESTOQUE
   --------------------------------------------------------------------------- */
async function adjustStock(productId, delta, type, refType, refId, unit, note) {
  const p = Store.get('products', productId);
  if (!p) throw new Error('Produto não encontrado');
  const newStock = (p.stock || 0) + delta;
  await Store.update('products', productId, { stock: newStock });
  await Store.add('stockMovements', {
    productId, type, qty: Math.abs(delta), unit: unit || p.unit,
    refType, refId, date: nowISO(), note: note || ''
  });
}

function lowStockAlerts() {
  return Store.all('products').filter(p => (p.minStock != null) && (p.stock <= p.minStock));
}

/* ---------------------------------------------------------------------------
   TOKENS DO PORTAL DO PACIENTE
   --------------------------------------------------------------------------- */
async function getOrCreatePatientToken(patientId) {
  const existing = Store.findOne('portalTokens', t => t.patientId === patientId && !t.consumptionId && !t.revoked);
  if (existing) return existing.token;
  const row = await Store.add('portalTokens', { patientId, consumptionId: null });
  return row.token;
}
async function ensureSessionToken(consumptionId) {
  const existing = Store.findOne('portalTokens', t => t.consumptionId === consumptionId && !t.revoked);
  if (existing) return existing.token;
  const c = Store.get('consumptions', consumptionId);
  if (!c) throw new Error('Consumo não encontrado');
  const row = await Store.add('portalTokens', { patientId: c.patientId, consumptionId });
  return row.token;
}

/* ---------------------------------------------------------------------------
   MAPEAMENTO — VENDA
   --------------------------------------------------------------------------- */
async function registerSale({ patientId, date, serviceId, items, paymentMethod }) {
  if (!patientId) throw new Error('Paciente é obrigatório');
  if (!items || !items.length) throw new Error('Ao menos um item é obrigatório');

  const sale = await Store.add('sales', {
    patientId, date: date || todayInputDate(), serviceId, items, paymentMethod
  });

  for (const it of items) {
    await Store.add('treatmentItems', {
      saleId: sale.id,
      patientId,
      serviceId,
      productId: it.productId,
      qtyTotal: Number(it.qty),
      unit: it.unit,
      qtyUsed: 0,
      status: 'nao_iniciado'
    });
  }

  return sale;
}

async function deleteSale(saleId) {
  const items = Store.find('treatmentItems', ti => ti.saleId === saleId);
  for (const ti of items) {
    const consumptions = Store.find('consumptions', c => c.treatmentItemId === ti.id);
    for (const c of consumptions) await deleteConsumption(c.id);
    await Store.remove('treatmentItems', ti.id);
  }
  await Store.remove('sales', saleId);
}

async function deletePatient(patientId) {
  const sales = Store.find('sales', s => s.patientId === patientId);
  for (const s of sales) await deleteSale(s.id);
  const consumptions = Store.find('consumptions', c => c.patientId === patientId);
  for (const c of consumptions) await deleteConsumption(c.id);
  await Store.remove('patients', patientId);
}

function treatmentItemsByPatient(patientId) {
  return Store.find('treatmentItems', ti => ti.patientId === patientId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function pendingFechadoByPatient(patientId) {
  const products = Store.all('products');
  return treatmentItemsByPatient(patientId).filter(ti => {
    const p = products.find(pp => pp.id === ti.productId);
    return p && p.controlType === 'fechado' && ti.qtyUsed < ti.qtyTotal;
  });
}

function computeGroupStatus(items) {
  if (!items.length) return 'nao_iniciado';
  if (items.every(i => i.status === 'finalizado')) return 'finalizado';
  if (items.every(i => i.status === 'nao_iniciado')) return 'nao_iniciado';
  return 'em_andamento';
}

function treatmentsByPatient(patientId) {
  const sales = Store.find('sales', s => s.patientId === patientId).sort((a, b) => a.date < b.date ? 1 : -1);
  const allItems = treatmentItemsByPatient(patientId);
  return sales.map(sale => {
    const items = allItems.filter(ti => ti.saleId === sale.id);
    const qtyTotal = items.reduce((s, i) => s + i.qtyTotal, 0);
    const qtyUsed = items.reduce((s, i) => s + i.qtyUsed, 0);
    return {
      sale, items,
      status: computeGroupStatus(items),
      progressPct: qtyTotal > 0 ? Math.round((qtyUsed / qtyTotal) * 100) : 0
    };
  });
}

function allTreatments() {
  return Store.all('sales').sort((a, b) => a.date < b.date ? 1 : -1).map(sale => {
    const items = Store.find('treatmentItems', ti => ti.saleId === sale.id);
    const qtyTotal = items.reduce((s, i) => s + i.qtyTotal, 0);
    const qtyUsed = items.reduce((s, i) => s + i.qtyUsed, 0);
    return {
      sale, items,
      status: computeGroupStatus(items),
      progressPct: qtyTotal > 0 ? Math.round((qtyUsed / qtyTotal) * 100) : 0
    };
  });
}

/* ---------------------------------------------------------------------------
   BAIXA (CONSUMO)
   --------------------------------------------------------------------------- */
async function registerBaixaFechada({ patientId, treatmentItemId, qty }) {
  const ti = Store.get('treatmentItems', treatmentItemId);
  if (!ti) throw new Error('Item de tratamento não encontrado');
  if (ti.patientId !== patientId) throw new Error('Item não pertence a este paciente');
  const remaining = ti.qtyTotal - ti.qtyUsed;
  qty = Number(qty);
  if (!(qty > 0)) throw new Error('Quantidade inválida');
  if (qty > remaining + 1e-9) throw new Error('Quantidade maior que o saldo prescrito (' + remaining + ' ' + ti.unit + ')');

  const product = Store.get('products', ti.productId);

  await adjustStock(product.id, -qty, 'saida', 'baixa_fechada', ti.id, ti.unit);

  const consumption = await Store.add('consumptions', {
    patientId, productId: product.id, qty, unit: ti.unit,
    type: 'fechado', treatmentItemId: ti.id, date: nowISO(),
    confirmationStatus: 'pendente'
  });

  const newUsed = ti.qtyUsed + qty;
  const newStatus = newUsed >= ti.qtyTotal ? 'finalizado' : 'em_andamento';
  await Store.update('treatmentItems', ti.id, { qtyUsed: newUsed, status: newStatus });

  await ensureSessionToken(consumption.id);

  return consumption;
}

async function registerBaixaLivre({ productId, qty, unit, note }) {
  const product = Store.get('products', productId);
  if (!product) throw new Error('Produto não encontrado');
  if (product.category !== 'insumo') throw new Error('Baixa livre é exclusiva de produtos da categoria Insumo');
  qty = Number(qty);
  if (!(qty > 0)) throw new Error('Quantidade inválida');

  await adjustStock(product.id, -qty, 'saida', 'baixa_livre', null, unit || product.unit, note || '');

  return Store.add('consumptions', {
    patientId: null, productId: product.id, qty, unit: unit || product.unit,
    type: 'livre', treatmentItemId: null, date: nowISO(),
    confirmationStatus: 'nao_aplicavel', note: note || ''
  });
}

async function deleteConsumption(consumptionId) {
  const c = Store.get('consumptions', consumptionId);
  if (!c) return;

  await adjustStock(c.productId, Number(c.qty), 'entrada', 'estorno_baixa', c.id, c.unit, 'Estorno de baixa excluída');

  if (c.type === 'fechado' && c.treatmentItemId) {
    const ti = Store.get('treatmentItems', c.treatmentItemId);
    if (ti) {
      const newUsed = Math.max(0, ti.qtyUsed - Number(c.qty));
      const newStatus = newUsed <= 0 ? 'nao_iniciado' : (newUsed >= ti.qtyTotal ? 'finalizado' : 'em_andamento');
      await Store.update('treatmentItems', ti.id, { qtyUsed: newUsed, status: newStatus });
    }
  }

  const tokens = Store.find('portalTokens', t => t.consumptionId === consumptionId);
  for (const t of tokens) await Store.remove('portalTokens', t.id);

  await Store.remove('consumptions', consumptionId);
}

async function confirmSession(consumptionId) {
  const c = Store.get('consumptions', consumptionId);
  if (!c) throw new Error('Sessão não encontrada');
  if (c.type !== 'fechado') throw new Error('Apenas sessões de itens prescritos exigem confirmação');
  return Store.update('consumptions', consumptionId, {
    confirmationStatus: 'confirmado', confirmedAt: nowISO()
  });
}

/* ---------------------------------------------------------------------------
   COMPRAS
   --------------------------------------------------------------------------- */
async function registerPurchase({ category, supplierId, items, paymentMethod, status, date, dueDate }) {
  if (!items || !items.length) throw new Error('Ao menos um item é obrigatório');
  return Store.add('purchases', {
    category, supplierId, items, paymentMethod,
    status: status || 'orcamento',
    date: date || todayInputDate(),
    dueDate: dueDate || null
  });
}

async function deletePurchase(purchaseId) {
  const receipts = Store.find('receipts', r => r.purchaseId === purchaseId);
  for (const r of receipts) await deleteReceipt(r.id, { keepOrphan: true });
  await Store.remove('purchases', purchaseId);
}

function purchaseTotal(purchase) {
  return (purchase.items || []).reduce((sum, it) => sum + (Number(it.totalPrice) || (Number(it.unitPrice) || 0) * (Number(it.qty) || 0)), 0);
}

/* ---------------------------------------------------------------------------
   COMPRAS CHEGARAM (RECEBIMENTO)
   --------------------------------------------------------------------------- */
async function registerReceipt({ purchaseId, items, nf, notes }) {
  const purchase = Store.get('purchases', purchaseId);
  if (!purchase) throw new Error('Compra não encontrada');
  return Store.add('receipts', {
    purchaseId, category: purchase.category, items, nf: nf || '', notes: notes || '',
    status: 'pendente'
  });
}

async function confirmReceipt(receiptId) {
  const receipt = Store.get('receipts', receiptId);
  if (!receipt) throw new Error('Recebimento não encontrado');
  if (receipt.status === 'conferida') return receipt;

  for (const it of (receipt.items || [])) {
    await adjustStock(it.productId, Number(it.qty), 'entrada', 'compra_conferida', receipt.id, it.unit,
      it.lot ? ('Lote: ' + it.lot) : '');
  }

  await Store.update('receipts', receiptId, { status: 'conferida', confirmedAt: nowISO() });
  await Store.update('purchases', receipt.purchaseId, { status: 'recebido' });
  return Store.get('receipts', receiptId);
}

async function deleteReceipt(receiptId, opts) {
  const receipt = Store.get('receipts', receiptId);
  if (!receipt) return;

  if (receipt.status === 'conferida') {
    for (const it of (receipt.items || [])) {
      await adjustStock(it.productId, -Number(it.qty), 'saida', 'estorno_recebimento', receipt.id, it.unit, 'Estorno de recebimento excluído');
    }
    if (!(opts && opts.keepOrphan)) {
      await Store.update('purchases', receipt.purchaseId, { status: 'compra_aberto' });
    }
  }
  await Store.remove('receipts', receiptId);
}

/* ---------------------------------------------------------------------------
   HELPERS DE LEITURA CRUZADA
   --------------------------------------------------------------------------- */
function productName(id) { const p = Store.get('products', id); return p ? p.name : '(produto removido)'; }
function patientName(id) { const p = Store.get('patients', id); return p ? p.name : '(paciente removido)'; }
function serviceName(id) { const s = Store.get('services', id); return s ? s.name : '—'; }
function supplierName(id) { const s = Store.get('suppliers', id); return s ? s.name : '(fornecedor removido)'; }

function fmtDate(iso) {
  if (!iso) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('pt-BR');
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_LABELS = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  finalizado: 'Finalizado',
  pendente: 'Pendente',
  confirmado: 'Confirmado pelo paciente',
  nao_aplicavel: 'Não se aplica',
  orcamento: 'Orçamento',
  compra_aberto: 'Compra em aberto',
  recebido: 'Recebido',
  conferida: 'Conferida'
};
