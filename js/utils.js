/* InvestSolo — utilitários gerais */

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    e.append(c instanceof Node ? c : document.createTextNode(c));
  });
  return e;
}

function toast(msg, tipo = 'info') {
  const wrap = document.getElementById('toast-wrap');
  const t = el('div', { class: `toast toast-${tipo}` }, msg);
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function confirmDialog(msg) {
  return window.confirm(msg);
}

function iniciais(nome) {
  return (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function waLink(numero, texto) {
  const n = (numero || '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto || '')}`;
}

function diasEntre(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Mostra a data de execução como período (início – término) quando a obra dura
// mais de um dia, ou só a data única quando é serviço de um dia só.
function formatPeriodoExecucao(obra) {
  const inicio = obra.dataExecucao;
  const fim = obra.dataTerminoExecucao || obra.dataExecucao;
  if (!inicio) return '—';
  if (!fim || fim === inicio) return formatDateBR(inicio);
  return `${formatDateBR(inicio)} – ${formatDateBR(fim)}`;
}

// ---- Dias de trabalho: nunca domingo; sábado depende da configuração da Agenda ----
const DIAS_SEMANA_NOMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function nomeDiaSemana(iso) {
  return DIAS_SEMANA_NOMES[new Date(iso + 'T00:00:00').getDay()];
}

function diaBloqueadoParaObra(iso, cfg) {
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0 = domingo, 6 = sábado
  if (dow === 0) return true;
  if (dow === 6 && !(cfg && cfg.trabalhaSabado)) return true;
  return false;
}

// Varre todo o período (início até término, inclusive) e retorna a primeira
// data bloqueada encontrada, ou null se o período inteiro for válido.
function primeiroDiaBloqueadoNoPeriodo(inicioISO, fimISO, cfg) {
  let atual = inicioISO;
  let guarda = 0;
  while (atual <= fimISO && guarda < 3660) {
    if (diaBloqueadoParaObra(atual, cfg)) return atual;
    atual = addDaysISO(atual, 1);
    guarda++;
  }
  return null;
}

// ---- Contas a pagar: status derivado (pendente / atrasado / pago) ----
function statusContaInfo(conta) {
  if (conta.status === 'pago') return { chave: 'pago', label: 'Pago', cor: 'var(--sucesso)' };
  if (conta.vencimento && conta.vencimento < todayISO()) return { chave: 'atrasado', label: 'Atrasado', cor: 'var(--perigo)' };
  return { chave: 'pendente', label: 'Pendente', cor: 'var(--alerta)' };
}

function prioridadeClasse(p) {
  return { Baixa: 'prio-baixa', Média: 'prio-media', Alta: 'prio-alta' }[p] || '';
}

function openModal({ title, body, foot, size }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  const overlay = el('div', {
    class: 'modal-overlay',
    onclick: (e) => { if (e.target === overlay) closeModal(); },
  });
  const closeBtn = el('button', { class: 'icon-btn', type: 'button', onclick: closeModal, 'aria-label': 'Fechar' });
  closeBtn.style.fontSize = '20px';
  closeBtn.innerHTML = '&times;';
  const head = el('div', { class: 'modal-head' }, [el('h3', {}, title), closeBtn]);
  const box = el('div', { class: `modal-box ${size ? 'modal-' + size : ''}` }, [
    head,
    el('div', { class: 'modal-body' }, body),
  ]);
  if (foot) box.append(el('div', { class: 'modal-foot' }, foot));
  overlay.append(box);
  root.append(overlay);
  document.addEventListener('keydown', escCloseOnce);
}

function escCloseOnce(e) {
  if (e.key === 'Escape') { closeModal(); }
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.removeEventListener('keydown', escCloseOnce);
}
