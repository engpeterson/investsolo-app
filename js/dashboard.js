/* InvestSolo — Dashboard (indicadores + filtros + quadro Kanban) */

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function filterSelect(placeholder, options, key, onChange) {
  const opts = options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const sel = el('select', {}, [el('option', { value: '' }, placeholder), ...opts.map(o => el('option', { value: o.value }, o.label))]);
  sel.value = AppState.filters[key] || '';
  sel.addEventListener('change', () => { AppState.filters[key] = sel.value; onChange(); });
  return sel;
}

function buildFiltersBar(onChange, opts) {
  const { mostrarPontosMin = true } = opts || {};
  const obras = DB.getObras();
  const cidades = [...new Set(obras.map(o => o.cidade).filter(Boolean))].sort();
  const responsaveis = [...new Set(obras.map(o => o.responsavel).filter(Boolean))].sort();
  const anos = [...new Set(obras.map(o => (o.dataExecucao || '').slice(0, 4)).filter(Boolean))].sort();
  const meses = MESES.map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));

  const bar = el('div', { class: 'filters-bar' }, [
    filterSelect('Cidade', cidades, 'cidade', onChange),
    filterSelect('Responsável', responsaveis, 'responsavel', onChange),
    filterSelect('Status', COLUNAS.map(c => ({ value: c.id, label: c.label })), 'status', onChange),
    filterSelect('Prioridade', PRIORIDADES, 'prioridade', onChange),
    filterSelect('Mês', meses, 'mes', onChange),
    filterSelect('Ano', anos, 'ano', onChange),
  ]);

  if (mostrarPontosMin) {
    const pontosInput = el('input', { type: 'number', placeholder: 'Pontos mínimos', min: '0' });
    pontosInput.value = AppState.filters.pontosMin || '';
    pontosInput.addEventListener('input', debounce(() => { AppState.filters.pontosMin = pontosInput.value; onChange(); }, 300));
    bar.appendChild(pontosInput);
  }

  const limpar = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Limpar filtros');
  limpar.addEventListener('click', () => {
    Object.keys(AppState.filters).forEach(k => { AppState.filters[k] = ''; });
    Views.refreshCurrent();
  });
  bar.appendChild(limpar);
  return bar;
}

// Os indicadores por status (Agendadas/Campo/Relatório/Cobrança) não aparecem
// mais aqui: o número já fica visível no cabeçalho de cada coluna do quadro
// Kanban logo abaixo, então repeti-los aqui só duplicava a informação.
const ICON_PONTOS = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>';
const ICON_VALOR = '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/></svg>';

function renderIndicators(container) {
  container.innerHTML = '';
  const obras = DB.getObras().filter(o => !o.arquivada);
  const mesAtual = todayISO().slice(0, 7);
  const obrasMes = obras.filter(o => (o.dataExecucao || '').startsWith(mesAtual));
  const valorMes = obrasMes.reduce((s, o) => s + (Number(o.valorPrevisto) || 0), 0);
  const obrasAgendadas = obras.filter(o => o.status === 'agendados');
  const totalPontosAgendados = obrasAgendadas.reduce((s, o) => s + (Number(o.quantidadePontos) || 0), 0);

  const cards = [
    { lbl: 'Pontos Agendados', val: String(totalPontosAgendados), icon: ICON_PONTOS, accent: 'azul' },
  ];
  if (isPeterson(Auth.getCurrentUser())) {
    cards.push({ lbl: 'Valor Previsto do Mês', val: formatMoneyBR(valorMes), icon: ICON_VALOR, accent: 'sucesso' });
  }
  cards.forEach(c => {
    container.appendChild(el('div', { class: 'indicator-card' }, [
      el('div', { class: 'indicator-icon', style: `--accent: var(--${c.accent})`, html: c.icon }),
      el('div', {}, [el('div', { class: 'val' }, c.val), el('div', { class: 'lbl' }, c.lbl)]),
    ]));
  });
}

const Dashboard = {
  render(container) {
    container.innerHTML = '';
    const novaBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Nova obra');
    novaBtn.addEventListener('click', () => openObraModal(null));
    const orcamentoBtn = criarUploadOrcamento();

    const indicators = el('div', { class: 'indicators', id: 'indicators-wrap' });
    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'Painel de Obras'),
      indicators,
      el('div', { class: 'view-actions' }, [orcamentoBtn, novaBtn]),
    ]);
    const filters = buildFiltersBar(() => Views.refreshCurrent(), { mostrarPontosMin: false });
    const boardWrap = el('div', { id: 'kanban-wrap' });

    container.append(header, filters, boardWrap);
    renderIndicators(indicators);
    renderKanbanBoard(boardWrap);
  },
  refreshIndicators() {
    const w = document.getElementById('indicators-wrap');
    if (w) renderIndicators(w);
  },
};
