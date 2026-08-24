/* ===========================================================================
   storage.js — camada de dados (localStorage) + regras de negócio
   Sistema de Mapeamento de Tratamento, Vendas, Compras e Estoque (Clínica)
   =========================================================================== */

const DB_PREFIX = 'cl_';

const COLLECTIONS = [
  'patients', 'services', 'products', 'units', 'suppliers', 'paymentMethods',
  'sales', 'treatmentItems', 'consumptions', 'purchases', 'receipts', 'stockMovements'
];

const SETTINGS_KEY = 'cl_settings';

function uid(prefix) {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowISO() { return new Date().toISOString(); }

function todayInputDate() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

const Store = {
  _read(name) {
    try {
      const raw = localStorage.getItem(DB_PREFIX + name);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Erro lendo', name, e);
      return [];
    }
  },
  _write(name, arr) {
    localStorage.setItem(DB_PREFIX + name, JSON.stringify(arr));
  },
  all(name) { return this._read(name); },
  get(name, id) { return this._read(name).find(x => x.id === id) || null; },
  add(name, obj) {
    const arr = this._read(name);
    obj.id = obj.id || uid(name.slice(0, 3));
    obj.createdAt = obj.createdAt || nowISO();
    arr.push(obj);
    this._write(name, arr);
    return obj;
  },
  update(name, id, patch) {
    const arr = this._read(name);
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: nowISO() });
    this._write(name, arr);
    return arr[idx];
  },
  remove(name, id) {
    const arr = this._read(name).filter(x => x.id !== id);
    this._write(name, arr);
  },
  find(name, predicate) { return this._read(name).filter(predicate); },
  findOne(name, predicate) { return this._read(name).find(predicate) || null; }
};

/* ---------------------------------------------------------------------------
   SEED — dados iniciais (unidades e formas de pagamento configuráveis)
   --------------------------------------------------------------------------- */
function seedIfEmpty() {
  if (Store.all('units').length === 0) {
    ['Ampola', 'Frasco', 'ML', 'Unidade', 'KG', 'Grama', 'Caixa', 'Par', 'Seringa']
      .forEach(name => Store.add('units', { name }));
  }
  if (Store.all('paymentMethods').length === 0) {
    ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Dinheiro', 'Transferência']
      .forEach(name => Store.add('paymentMethods', { name }));
  }
  // demonstração leve (pode ser apagada pelo usuário)
  if (Store.all('products').length === 0) {
    Store.add('products', { name: 'Soro Fisiológico 500ml', category: 'medicamento', unit: 'ML', minStock: 20, stock: 0, controlType: 'fechado' });
    Store.add('products', { name: 'Gaze Estéril', category: 'insumo', unit: 'Unidade', minStock: 50, stock: 0, controlType: 'livre' });
    Store.add('products', { name: 'Algodão', category: 'insumo', unit: 'Grama', minStock: 100, stock: 0, controlType: 'livre' });
    Store.add('products', { name: 'Luva de Procedimento (par)', category: 'insumo', unit: 'Par', minStock: 30, stock: 0, controlType: 'livre' });
  }
  if (Store.all('services').length === 0) {
    Store.add('services', { name: 'Aplicação Injetável', category: 'Procedimento', active: true });
    Store.add('services', { name: 'Hidratação Venosa', category: 'Procedimento', active: true });
  }
}

/* ---------------------------------------------------------------------------
   CONFIGURAÇÕES DA CLÍNICA (nome + logo — usados no portal do paciente)
   --------------------------------------------------------------------------- */
function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { clinicName: '', logoDataUrl: '' };
  } catch (e) {
    return { clinicName: '', logoDataUrl: '' };
  }
}
function saveSettings(patch) {
  const current = getSettings();
  const next = Object.assign({}, current, patch);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/* ---------------------------------------------------------------------------
   PRODUTOS / ESTOQUE
   --------------------------------------------------------------------------- */
function adjustStock(productId, delta, type, refType, refId, unit, note) {
  const p = Store.get('products', productId);
  if (!p) throw new Error('Produto não encontrado');
  const newStock = (p.stock || 0) + delta;
  Store.update('products', productId, { stock: newStock });
  Store.add('stockMovements', {
    productId, type, qty: Math.abs(delta), unit: unit || p.unit,
    refType, refId, date: nowISO(), note: note || ''
  });
}

function lowStockAlerts() {
  return Store.all('products').filter(p => (p.minStock != null) && (p.stock <= p.minStock));
}

/* ---------------------------------------------------------------------------
   MAPEAMENTO — VENDA
   --------------------------------------------------------------------------- */
function registerSale({ patientId, date, serviceId, items, paymentMethod }) {
  if (!patientId) throw new Error('Paciente é obrigatório');
  if (!items || !items.length) throw new Error('Ao menos um item é obrigatório');

  const sale = Store.add('sales', {
    patientId, date: date || todayInputDate(), serviceId, items, paymentMethod
  });

  // gera itens de tratamento (timeline) — um por item vendido
  items.forEach(it => {
    Store.add('treatmentItems', {
      saleId: sale.id,
      patientId,
      serviceId,
      productId: it.productId,
      qtyTotal: Number(it.qty),
      unit: it.unit,
      qtyUsed: 0,
      status: 'nao_iniciado'
    });
  });

  return sale;
}

function deleteSale(saleId) {
  const items = Store.find('treatmentItems', ti => ti.saleId === saleId);
  items.forEach(ti => {
    const consumptions = Store.find('consumptions', c => c.treatmentItemId === ti.id);
    consumptions.forEach(c => deleteConsumption(c.id));
    Store.remove('treatmentItems', ti.id);
  });
  Store.remove('sales', saleId);
}

function deletePatient(patientId) {
  Store.find('sales', s => s.patientId === patientId).forEach(s => deleteSale(s.id));
  // baixas livres não vinculadas a treatmentItem (ex: insumo) também precisam ser estornadas
  Store.find('consumptions', c => c.patientId === patientId).forEach(c => deleteConsumption(c.id));
  Store.remove('patients', patientId);
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

/* ---------------------------------------------------------------------------
   MAPEAMENTOS — um paciente pode ter vários (cada venda gera um mapeamento
   independente, com seus próprios itens e seu próprio status de ciclo de vida)
   --------------------------------------------------------------------------- */
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
function registerBaixaFechada({ patientId, treatmentItemId, qty }) {
  const ti = Store.get('treatmentItems', treatmentItemId);
  if (!ti) throw new Error('Item de tratamento não encontrado');
  if (ti.patientId !== patientId) throw new Error('Item não pertence a este paciente');
  const remaining = ti.qtyTotal - ti.qtyUsed;
  qty = Number(qty);
  if (!(qty > 0)) throw new Error('Quantidade inválida');
  if (qty > remaining + 1e-9) throw new Error('Quantidade maior que o saldo prescrito (' + remaining + ' ' + ti.unit + ')');

  const product = Store.get('products', ti.productId);

  // baixa no estoque
  adjustStock(product.id, -qty, 'saida', 'baixa_fechada', ti.id, ti.unit);

  // consumo
  const consumption = Store.add('consumptions', {
    patientId, productId: product.id, qty, unit: ti.unit,
    type: 'fechado', treatmentItemId: ti.id, date: nowISO(),
    confirmationStatus: 'pendente'
  });

  // atualiza item de tratamento
  const newUsed = ti.qtyUsed + qty;
  const newStatus = newUsed >= ti.qtyTotal ? 'finalizado' : 'em_andamento';
  Store.update('treatmentItems', ti.id, { qtyUsed: newUsed, status: newStatus });

  return consumption;
}

function registerBaixaLivre({ productId, qty, unit, note }) {
  const product = Store.get('products', productId);
  if (!product) throw new Error('Produto não encontrado');
  if (product.category !== 'insumo') throw new Error('Baixa livre é exclusiva de produtos da categoria Insumo');
  qty = Number(qty);
  if (!(qty > 0)) throw new Error('Quantidade inválida');

  adjustStock(product.id, -qty, 'saida', 'baixa_livre', null, unit || product.unit, note || '');

  // baixa de insumo é um lançamento de estoque puro — não é vinculada a paciente
  return Store.add('consumptions', {
    patientId: null, productId: product.id, qty, unit: unit || product.unit,
    type: 'livre', treatmentItemId: null, date: nowISO(),
    confirmationStatus: 'nao_aplicavel', note: note || ''
  });
}

function deleteConsumption(consumptionId) {
  const c = Store.get('consumptions', consumptionId);
  if (!c) return;

  // estorna o estoque (devolve a quantidade baixada)
  adjustStock(c.productId, Number(c.qty), 'entrada', 'estorno_baixa', c.id, c.unit, 'Estorno de baixa excluída');

  if (c.type === 'fechado' && c.treatmentItemId) {
    const ti = Store.get('treatmentItems', c.treatmentItemId);
    if (ti) {
      const newUsed = Math.max(0, ti.qtyUsed - Number(c.qty));
      const newStatus = newUsed <= 0 ? 'nao_iniciado' : (newUsed >= ti.qtyTotal ? 'finalizado' : 'em_andamento');
      Store.update('treatmentItems', ti.id, { qtyUsed: newUsed, status: newStatus });
    }
  }

  Store.remove('consumptions', consumptionId);
}

function confirmSession(consumptionId) {
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
function registerPurchase({ category, supplierId, items, paymentMethod, status, date, dueDate }) {
  if (!items || !items.length) throw new Error('Ao menos um item é obrigatório');
  return Store.add('purchases', {
    category, supplierId, items, paymentMethod,
    status: status || 'orcamento',
    date: date || todayInputDate(),
    dueDate: dueDate || null
  });
}

function deletePurchase(purchaseId) {
  Store.find('receipts', r => r.purchaseId === purchaseId).forEach(r => deleteReceipt(r.id, { keepOrphan: true }));
  Store.remove('purchases', purchaseId);
}

function purchaseTotal(purchase) {
  return (purchase.items || []).reduce((sum, it) => sum + (Number(it.totalPrice) || (Number(it.unitPrice) || 0) * (Number(it.qty) || 0)), 0);
}

/* ---------------------------------------------------------------------------
   COMPRAS CHEGARAM (RECEBIMENTO)
   --------------------------------------------------------------------------- */
function registerReceipt({ purchaseId, items, nf, notes }) {
  const purchase = Store.get('purchases', purchaseId);
  if (!purchase) throw new Error('Compra não encontrada');
  return Store.add('receipts', {
    purchaseId, category: purchase.category, items, nf: nf || '', notes: notes || '',
    status: 'pendente'
  });
}

function confirmReceipt(receiptId) {
  const receipt = Store.get('receipts', receiptId);
  if (!receipt) throw new Error('Recebimento não encontrado');
  if (receipt.status === 'conferida') return receipt;

  (receipt.items || []).forEach(it => {
    adjustStock(it.productId, Number(it.qty), 'entrada', 'compra_conferida', receipt.id, it.unit,
      it.lot ? ('Lote: ' + it.lot) : '');
  });

  Store.update('receipts', receiptId, { status: 'conferida', confirmedAt: nowISO() });
  Store.update('purchases', receipt.purchaseId, { status: 'recebido' });
  return Store.get('receipts', receiptId);
}

function deleteReceipt(receiptId, opts) {
  const receipt = Store.get('receipts', receiptId);
  if (!receipt) return;

  if (receipt.status === 'conferida') {
    (receipt.items || []).forEach(it => {
      adjustStock(it.productId, -Number(it.qty), 'saida', 'estorno_recebimento', receipt.id, it.unit, 'Estorno de recebimento excluído');
    });
    if (!(opts && opts.keepOrphan)) {
      Store.update('purchases', receipt.purchaseId, { status: 'compra_aberto' });
    }
  }
  Store.remove('receipts', receiptId);
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
  // datas "YYYY-MM-DD" (sem hora) são tratadas como data local, evitando
  // que a conversão UTC->local exiba o dia anterior em fusos negativos (ex: Brasil)
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
