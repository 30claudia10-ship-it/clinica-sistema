/* ===========================================================================
   portal.js — Portal do Paciente (extensão do relatório 1.3, mesmo banco de dados)
   Acesso: link único (?patient=ID ou ?session=ID) ou login simples (CPF + nascimento)
   NUNCA exibe valores financeiros.
   =========================================================================== */

seedIfEmpty();

function qparam(name) {
  return new URLSearchParams(location.search).get(name);
}
function escp(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function logoHtml() {
  const settings = getSettings();
  if (settings.logoDataUrl) {
    return `<div class="portal-logo"><img src="${settings.logoDataUrl}" style="max-height:56px;max-width:220px;"></div>`;
  }
  return `<div class="portal-logo"><span class="dot">+</span></div>`;
}
function clinicNameHtml() {
  const settings = getSettings();
  return settings.clinicName ? `<div class="sub" style="margin-bottom:2px;font-weight:600;">${escp(settings.clinicName)}</div>` : '';
}

function renderPortal() {
  const root = document.getElementById('portal-root');
  const sessionId = qparam('session');
  const patientId = qparam('patient');

  if (sessionId) return renderSessionConfirm(root, sessionId);
  if (patientId) return renderPatientTimeline(root, patientId);
  return renderLogin(root);
}

/* ---------------------------- LOGIN SIMPLES ---------------------------- */
function renderLogin(root) {
  root.innerHTML = `
    <div class="portal-card">
      ${logoHtml()}
      ${clinicNameHtml()}
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
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cpf = (fd.get('cpf') || '').replace(/\D/g, '');
    const dob = fd.get('birthDate');
    const patient = Store.findOne('patients', p => (p.cpf || '').replace(/\D/g, '') === cpf && cpf && p.birthDate === dob);
    if (!patient) {
      document.getElementById('login-msg').innerHTML = `<div class="msg error">Não encontramos um cadastro com esses dados. Confira o CPF e a data de nascimento, ou use o link enviado pela clínica.</div>`;
      return;
    }
    location.href = 'portal.html?patient=' + patient.id;
  });
}

/* ---------------------------- TIMELINE DO PACIENTE (sem valores) ---------------------------- */
function renderPatientTimeline(root, patientId) {
  const patient = Store.get('patients', patientId);
  if (!patient) {
    root.innerHTML = `<div class="portal-card"><h2>Link inválido</h2><p class="sub">Não encontramos este paciente. Verifique o link recebido.</p></div>`;
    return;
  }
  const treatments = treatmentsByPatient(patientId);
  const pendingSessions = Store.find('consumptions', c => c.patientId === patientId && c.type === 'fechado' && c.confirmationStatus === 'pendente')
    .sort((a, b) => a.date < b.date ? 1 : -1);
  const doneSessions = Store.find('consumptions', c => c.patientId === patientId && c.type === 'fechado' && c.confirmationStatus === 'confirmado')
    .sort((a, b) => a.date < b.date ? 1 : -1);
  const statusLabel = s => ({ nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', finalizado: 'Finalizado' }[s] || s);

  root.innerHTML = `
    <div class="portal-card" style="max-width:600px;">
      ${logoHtml()}
      ${clinicNameHtml()}
      <h2>Olá, ${escp(patient.name.split(' ')[0])}</h2>
      <div class="sub">Você tem <b>${treatments.length}</b> mapeamento(s) de tratamento nesta clínica</div>

      ${pendingSessions.length ? `
        <h3 style="font-size:14px;color:var(--vermelho);margin:20px 0 8px;">Atendimentos aguardando sua confirmação</h3>
        ${pendingSessions.map(c => `
          <div class="session-box">
            <div class="row"><span>Data</span><b>${fmtDate(c.date)}</b></div>
            <div class="row"><span>Procedimento/Produto</span><b>${escp(productName(c.productId))}</b></div>
            <div class="row"><span>Quantidade</span><b>${c.qty} ${escp(c.unit)}</b></div>
            <button class="confirm-btn" data-confirm="${c.id}" style="margin-top:10px;">Confirmo que recebi este atendimento</button>
          </div>
        `).join('')}
      ` : ''}

      <h3 style="font-size:14px;color:var(--azul-900);margin:20px 0 8px;">Seus tratamentos (mapeamentos)</h3>
      ${treatments.length ? treatments.map(t => `
        <div class="session-box" style="border-left:3px solid var(--azul-500);">
          <div class="row"><span>Serviço</span><b>${escp(serviceName(t.sale.serviceId))}</b></div>
          <div class="row"><span>Data</span><b>${fmtDate(t.sale.date)}</b></div>
          <div class="row"><span>Status geral</span><b>${escp(statusLabel(t.status))} (${t.progressPct}%)</b></div>
          ${t.items.map(ti => `
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--cinza-200);">
              <div class="row"><span>${escp(productName(ti.productId))}</span><b>${ti.qtyUsed}/${ti.qtyTotal} ${escp(ti.unit)}</b></div>
              <div class="row"><span>Status</span><b>${escp(statusLabel(ti.status))}</b></div>
            </div>
          `).join('')}
        </div>
      `).join('') : `<p class="hint">Nenhum tratamento registrado ainda.</p>`}

      ${doneSessions.length ? `
        <h3 style="font-size:14px;color:var(--verde);margin:20px 0 8px;">Atendimentos confirmados</h3>
        ${doneSessions.map(c => `
          <div class="session-box" style="background:var(--verde-bg);border-color:#bfe9d5;">
            <div class="row"><span>Data</span><b>${fmtDate(c.date)}</b></div>
            <div class="row"><span>Procedimento/Produto</span><b>${escp(productName(c.productId))}</b></div>
            <div class="row"><span>Confirmado em</span><b>${fmtDateTime(c.confirmedAt)}</b></div>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
  document.querySelectorAll('[data-confirm]').forEach(b => b.addEventListener('click', () => {
    confirmSession(b.dataset.confirm);
    renderPatientTimeline(root, patientId);
  }));
}

/* ---------------------------- CONFIRMAÇÃO DE UMA SESSÃO ESPECÍFICA ---------------------------- */
function renderSessionConfirm(root, sessionId) {
  const c = Store.get('consumptions', sessionId);
  if (!c || c.type !== 'fechado') {
    root.innerHTML = `<div class="portal-card"><h2>Link inválido</h2><p class="sub">Não encontramos este atendimento. Verifique o link recebido.</p></div>`;
    return;
  }
  const patient = Store.get('patients', c.patientId);

  if (c.confirmationStatus === 'confirmado') {
    root.innerHTML = `
      <div class="portal-card">
        ${logoHtml()}
        <div class="confirmed-box">
          <div class="checkmark">✓</div>
          <h2>Atendimento já confirmado</h2>
          <p class="sub">Confirmado em ${fmtDateTime(c.confirmedAt)}</p>
        </div>
        <a href="portal.html?patient=${c.patientId}" class="btn secondary" style="display:block;text-align:center;text-decoration:none;padding:10px;border-radius:8px;">Ver meu tratamento completo</a>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="portal-card">
      ${logoHtml()}
      ${clinicNameHtml()}
      <h2>Confirmação de Atendimento</h2>
      <div class="sub">${patient ? escp(patient.name) : ''}</div>
      <div class="session-box">
        <div class="row"><span>Data</span><b>${fmtDate(c.date)}</b></div>
        <div class="row"><span>Procedimento/Produto</span><b>${escp(productName(c.productId))}</b></div>
        <div class="row"><span>Quantidade</span><b>${c.qty} ${escp(c.unit)}</b></div>
      </div>
      <button class="confirm-btn" id="confirm-btn">Confirmo que recebi este atendimento</button>
    </div>
  `;
  document.getElementById('confirm-btn').addEventListener('click', () => {
    confirmSession(sessionId);
    renderSessionConfirm(root, sessionId);
  });
}

renderPortal();
