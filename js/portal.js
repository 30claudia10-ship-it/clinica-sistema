/* ===========================================================================
   portal.js — Portal do Paciente (acesso público, via funções seguras do banco)
   Acesso: link único (?token=... ou ?session=...) ou login (CPF + nascimento)
   NUNCA exibe valores financeiros. Nunca acessa tabelas diretamente — só RPC.
   =========================================================================== */

function qparam(name) {
  return new URLSearchParams(location.search).get(name);
}
function escp(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDateP(iso) {
  if (!iso) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('pt-BR');
}
function fmtDateTimeP(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
const STATUS_LABELS_P = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', finalizado: 'Finalizado' };

let brandingCache = null;
async function getBranding() {
  if (brandingCache) return brandingCache;
  const { data } = await sb.rpc('get_public_branding');
  brandingCache = (data && data[0]) || {};
  return brandingCache;
}
async function logoHtml() {
  const b = await getBranding();
  if (b.logo_data_url) {
    return `<div class="portal-logo"><img src="${b.logo_data_url}" style="max-height:56px;max-width:220px;"></div>`;
  }
  return `<div class="portal-logo"><span class="dot">+</span></div>`;
}
async function clinicNameHtml() {
  const b = await getBranding();
  return b.clinic_name ? `<div class="sub" style="margin-bottom:2px;font-weight:600;">${escp(b.clinic_name)}</div>` : '';
}

async function renderPortal() {
  const root = document.getElementById('portal-root');
  root.innerHTML = `<div class="portal-card"><p class="hint" style="text-align:center;">Carregando...</p></div>`;

  const sessionToken = qparam('session');
  const patientToken = qparam('token');

  if (sessionToken) return renderSessionConfirm(root, sessionToken);
  if (patientToken) return renderPatientTimeline(root, patientToken);
  return renderLogin(root);
}

/* ---------------------------- LOGIN SIMPLES ---------------------------- */
async function renderLogin(root) {
  root.innerHTML = `
    <div class="portal-card">
      ${await logoHtml()}
      ${await clinicNameHtml()}
      <h2>Portal do Paciente</h2>
      <div class="sub">Acompanhe seu tratamento e confirme seus atendimentos</div>
      <form id="login-form">
        <div class="field"><label>CPF</label><input name="cpf" placeholder="000.000.000-00" required></div>
        <div class="field"><label>Data de nascimento</label><input type="date" name="birthDate" required></div>
        <div id="login-msg"></div>
        <button class="confirm-btn" type="submit" style="margin-top:8px;">Entrar</button>
      </form>
      <p class="hint" style="text-align:center;margin-top:14px;">Você também pode acessar diretamente pelo link enviado por WhatsApp/SMS/e-mail.</p>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Entrando...';
    const { data: token, error } = await sb.rpc('portal_login', {
      p_cpf: fd.get('cpf'), p_birth_date: fd.get('birthDate')
    });
    if (error || !token) {
      document.getElementById('login-msg').innerHTML = `<div class="msg error">Não encontramos um cadastro com esses dados. Confira o CPF e a data de nascimento, ou use o link enviado pela clínica.</div>`;
      btn.disabled = false; btn.textContent = 'Entrar';
      return;
    }
    location.href = 'portal.html?token=' + token;
  });
}

/* ---------------------------- TIMELINE DO PACIENTE (sem valores) ---------------------------- */
async function renderPatientTimeline(root, token) {
  const { data, error } = await sb.rpc('portal_get_patient_data', { p_token: token });
  if (error || !data) {
    root.innerHTML = `<div class="portal-card"><h2>Link inválido</h2><p class="sub">Não encontramos este paciente. Verifique o link recebido.</p></div>`;
    return;
  }
  const patient = data.patient;
  const treatments = data.treatments || [];
  const pendingSessions = data.pending_sessions || [];
  const doneSessions = data.confirmed_sessions || [];
  const overallStatus = (t) => {
    if (!t.items || !t.items.length) return 'nao_iniciado';
    if (t.items.every(i => i.status === 'finalizado')) return 'finalizado';
    if (t.items.every(i => i.status === 'nao_iniciado')) return 'nao_iniciado';
    return 'em_andamento';
  };
  const progressPct = (t) => {
    const total = (t.items || []).reduce((s, i) => s + Number(i.qty_total), 0);
    const used = (t.items || []).reduce((s, i) => s + Number(i.qty_used), 0);
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  root.innerHTML = `
    <div class="portal-card" style="max-width:600px;">
      ${await logoHtml()}
      ${await clinicNameHtml()}
      <h2>Olá, ${escp((patient.name || '').split(' ')[0])}</h2>
      <div class="sub">Você tem <b>${treatments.length}</b> mapeamento(s) de tratamento nesta clínica</div>

      ${pendingSessions.length ? `
        <h3 style="font-size:14px;color:var(--vermelho);margin:20px 0 8px;">Atendimentos aguardando sua confirmação</h3>
        ${pendingSessions.map(c => `
          <div class="session-box">
            <div class="row"><span>Data</span><b>${fmtDateP(c.date)}</b></div>
            <div class="row"><span>Procedimento/Produto</span><b>${escp(c.product_name)}</b></div>
            <div class="row"><span>Quantidade</span><b>${c.qty} ${escp(c.unit)}</b></div>
            <button class="confirm-btn" data-confirm="${c.id}" style="margin-top:10px;">Confirmo que recebi este atendimento</button>
          </div>
        `).join('')}
      ` : ''}

      <h3 style="font-size:14px;color:var(--azul-900);margin:20px 0 8px;">Seus tratamentos (mapeamentos)</h3>
      ${treatments.length ? treatments.map(t => `
        <div class="session-box" style="border-left:3px solid var(--azul-500);">
          <div class="row"><span>Serviço</span><b>${escp(t.service_name || '—')}</b></div>
          <div class="row"><span>Data</span><b>${fmtDateP(t.date)}</b></div>
          <div class="row"><span>Status geral</span><b>${escp(STATUS_LABELS_P[overallStatus(t)])} (${progressPct(t)}%)</b></div>
          ${(t.items || []).map(ti => `
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--cinza-200);">
              <div class="row"><span>${escp(ti.product_name)}</span><b>${ti.qty_used}/${ti.qty_total} ${escp(ti.unit)}</b></div>
              <div class="row"><span>Status</span><b>${escp(STATUS_LABELS_P[ti.status] || ti.status)}</b></div>
            </div>
          `).join('')}
        </div>
      `).join('') : `<p class="hint">Nenhum tratamento registrado ainda.</p>`}

      ${doneSessions.length ? `
        <h3 style="font-size:14px;color:var(--verde);margin:20px 0 8px;">Atendimentos confirmados</h3>
        ${doneSessions.map(c => `
          <div class="session-box" style="background:var(--verde-bg);border-color:#bfe9d5;">
            <div class="row"><span>Data</span><b>${fmtDateP(c.date)}</b></div>
            <div class="row"><span>Procedimento/Produto</span><b>${escp(c.product_name)}</b></div>
            <div class="row"><span>Confirmado em</span><b>${fmtDateTimeP(c.confirmed_at)}</b></div>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
  document.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Confirmando...';
    await sb.rpc('portal_confirm_session_by_id', { p_token: token, p_consumption_id: b.dataset.confirm });
    renderPatientTimeline(root, token);
  }));
}

/* ---------------------------- CONFIRMAÇÃO DE UMA SESSÃO ESPECÍFICA ---------------------------- */
async function renderSessionConfirm(root, sessionToken) {
  const { data: session, error } = await sb.rpc('portal_get_session', { p_token: sessionToken });
  if (error || !session) {
    root.innerHTML = `<div class="portal-card"><h2>Link inválido</h2><p class="sub">Não encontramos este atendimento. Verifique o link recebido.</p></div>`;
    return;
  }

  if (session.confirmation_status === 'confirmado') {
    root.innerHTML = `
      <div class="portal-card">
        ${await logoHtml()}
        <div class="confirmed-box">
          <div class="checkmark">✓</div>
          <h2>Atendimento já confirmado</h2>
          <p class="sub">Confirmado em ${fmtDateTimeP(session.confirmed_at)}</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="portal-card">
      ${await logoHtml()}
      ${await clinicNameHtml()}
      <h2>Confirmação de Atendimento</h2>
      <div class="sub">${escp(session.patient_name || '')}</div>
      <div class="session-box">
        <div class="row"><span>Data</span><b>${fmtDateP(session.date)}</b></div>
        <div class="row"><span>Procedimento/Produto</span><b>${escp(session.product_name)}</b></div>
        <div class="row"><span>Quantidade</span><b>${session.qty} ${escp(session.unit)}</b></div>
      </div>
      <button class="confirm-btn" id="confirm-btn">Confirmo que recebi este atendimento</button>
    </div>
  `;
  document.getElementById('confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-btn');
    btn.disabled = true; btn.textContent = 'Confirmando...';
    await sb.rpc('portal_confirm_session', { p_token: sessionToken });
    renderSessionConfirm(root, sessionToken);
  });
}

renderPortal();
