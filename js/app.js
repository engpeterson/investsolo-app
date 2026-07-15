/* InvestSolo — bootstrap, navegação, login, notificações */

const AppState = {
  filters: { busca: '', cidade: '', responsavel: '', status: '', prioridade: '', mes: '', ano: '', pontosMin: '' },
  currentView: 'dashboard',
};

const Views = {
  dashboard: Dashboard,
  agenda: Agenda,
  whatsapp: WhatsAppView,
  clientes: ClientesView,
  obras: ObrasView,
  relatorios: RelatoriosView,
  usuarios: UsuariosView,
  refreshCurrent() {
    const view = this[AppState.currentView];
    const container = document.getElementById(`view-${AppState.currentView}`);
    if (view && container) view.render(container);
    renderNotifications();
  },
};

function switchView(viewId) {
  if (!Auth.can(viewId)) { toast('Você não tem permissão para acessar esta seção.', 'error'); return; }
  AppState.currentView = viewId;
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${viewId}`).classList.remove('hidden');
  Views[viewId].render(document.getElementById(`view-${viewId}`));
  document.getElementById('sidebar').classList.remove('open');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  DB.setTheme(theme);
}

function tituloNotif(tipo) {
  return { amanha: 'Serviço amanhã', atraso: 'Relatório atrasado', cobranca: 'Cobrança vencida', whatsapp: 'Mensagem pendente' }[tipo] || 'Aviso';
}

function computeNotifications() {
  const hoje = todayISO();
  const amanha = addDaysISO(hoje, 1);
  const notifs = [];
  DB.getObras().forEach(o => {
    if (o.dataExecucao === amanha && o.status === 'agendados') {
      notifs.push({ tipo: 'amanha', texto: `Serviço "${o.nomeObra}" é amanhã (${formatDateBR(o.dataExecucao)}).` });
    }
    if (o.status === 'relatorio' && o.prazoRelatorio && o.prazoRelatorio < hoje) {
      notifs.push({ tipo: 'atraso', texto: `Relatório da obra "${o.nomeObra}" está atrasado (prazo ${formatDateBR(o.prazoRelatorio)}).` });
    }
    if (o.status === 'cobrar' && o.dataVencimentoCobranca && o.dataVencimentoCobranca < hoje) {
      notifs.push({ tipo: 'cobranca', texto: `Cobrança da obra "${o.nomeObra}" está vencida (venceu ${formatDateBR(o.dataVencimentoCobranca)}).` });
    }
    if (!o.mensagemEnviada && o.status !== 'cobrar') {
      notifs.push({ tipo: 'whatsapp', texto: `Cliente da obra "${o.nomeObra}" ainda não recebeu mensagem no WhatsApp.` });
    }
  });
  return notifs;
}

function renderNotifications() {
  const notifs = computeNotifications();
  const countEl = document.getElementById('notif-count');
  countEl.textContent = String(notifs.length);
  countEl.classList.toggle('hidden', notifs.length === 0);

  const panel = document.getElementById('notif-panel');
  panel.innerHTML = '';
  if (!notifs.length) {
    panel.appendChild(el('div', { class: 'notif-empty' }, 'Nenhuma notificação no momento.'));
  } else {
    notifs.forEach(n => {
      panel.appendChild(el('div', { class: 'notif-item' }, [el('strong', {}, tituloNotif(n.tipo)), n.texto]));
    });
  }
}

function populateLoginUsers() {
  const sel = document.getElementById('login-user');
  sel.innerHTML = '';
  DB.getUsers().forEach(u => sel.appendChild(el('option', { value: u.id }, `${u.nome} (${u.perfil})`)));
}

function boot() {
  const user = Auth.getCurrentUser();
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');

  if (!user) {
    loginScreen.classList.remove('hidden');
    appShell.classList.add('hidden');
    populateLoginUsers();
    applyTheme(DB.getTheme());
    return;
  }

  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  document.getElementById('user-nome').textContent = user.nome;
  document.getElementById('user-perfil').textContent = user.perfil;
  document.getElementById('user-avatar').textContent = iniciais(user.nome);

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('hidden', !Auth.can(btn.dataset.view));
  });

  applyTheme(DB.getTheme());
  const primeiraSecaoPermitida = (PERMISSOES[user.perfil] || ['dashboard'])[0];
  switchView(Auth.can('dashboard') ? 'dashboard' : primeiraSecaoPermitida);
  renderNotifications();
}

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const userId = document.getElementById('login-user').value;
  const senha = document.getElementById('login-senha').value;
  const res = Auth.login(userId, senha);
  if (!res.ok) { toast(res.msg, 'error'); return; }
  document.getElementById('login-senha').value = '';
  boot();
});

document.getElementById('logout-btn').addEventListener('click', () => {
  Auth.logout();
  location.reload();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const atual = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(atual);
});

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.getElementById('global-search').addEventListener('input', debounce((e) => {
  AppState.filters.busca = e.target.value;
  Views.refreshCurrent();
}, 250));

document.getElementById('notif-btn').addEventListener('click', () => {
  document.getElementById('notif-panel').classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.notif-wrap');
  const panel = document.getElementById('notif-panel');
  if (wrap && panel && !wrap.contains(e.target)) panel.classList.add('hidden');
});

seedDatabase();
boot();
