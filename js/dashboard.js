/* InvestSolo — Dashboard (indicadores + filtros + quadro Kanban) */

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function filterSelect(placeholder, options, key, onChange) {
  const opts = options.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  const sel = el('select', {}, [el('option', { value: '' }, placeholder), ...opts.map(o => el('option', { value: o.value }, o.label))]);
  sel.value = AppState.filters[key] || '';
  sel.addEventListener('change', () => { AppState.filters[key] = sel.value; onChange(); });
  return sel;
}

function buildFiltersBar(onChange) {
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

  const pontosInput = el('input', { type: 'number', placeholder: 'Pontos mínimos', min: '0' });
  pontosInput.value = AppState.filters.pontosMin || '';
  pontosInput.addEventListener('input', debounce(() => { AppState.filters.pontosMin = pontosInput.value; onChange(); }, 300));
  bar.appendChild(pontosInput);

  const limpar = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Limpar filtros');
  limpar.addEventListener('click', () => {
    Object.keys(AppState.filters).forEach(k => { AppState.filters[k] = ''; });
    Views.refreshCurrent();
  });
  bar.appendChild(limpar);
  return bar;
}

function renderIndicators(container) {
  container.innerHTML = '';
  const obras = DB.getObras();
  const mesAtual = todayISO().slice(0, 7);
  const obrasMes = obras.filter(o => (o.dataExecucao || '').startsWith(mesAtual));
  const totalPontosMes = obrasMes.reduce((s, o) => s + (Number(o.quantidadePontos) || 0), 0);
  const valorMes = obrasMes.reduce((s, o) => s + (Number(o.valorPrevisto) || 0), 0);

  const cards = [
    ['Obras Agendadas', obras.filter(o => o.status === 'agendados').length],
    ['Em Campo', obras.filter(o => o.status === 'campo').length],
    ['Em Relatório', obras.filter(o => o.status === 'relatorio').length],
    ['Pendentes de Cobrança', obras.filter(o => o.status === 'cobrar').length],
    ['Total de Pontos do Mês', totalPontosMes],
  ];
  if (isPeterson(Auth.getCurrentUser())) {
    cards.push(['Valor Previsto do Mês', formatMoneyBR(valorMes)]);
  }
  cards.forEach(([lbl, val]) => {
    container.appendChild(el('div', { class: 'indicator-card' }, [el('div', { class: 'val' }, String(val)), el('div', { class: 'lbl' }, lbl)]));
  });
}

const Dashboard = {
  render(container) {
    container.innerHTML = '';
    const novaBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Nova obra');
    novaBtn.addEventListener('click', () => openObraModal(null));

    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'Painel de Obras'),
      el('div', { class: 'view-actions' }, [novaBtn]),
    ]);
    const indicators = el('div', { class: 'indicators', id: 'indicators-wrap' });
    const filters = buildFiltersBar(() => Views.refreshCurrent());
    const boardWrap = el('div', { id: 'kanban-wrap' });

    container.append(header, indicators, filters, boardWrap);
    renderIndicators(indicators);
    renderKanbanBoard(boardWrap);
  },
  refreshIndicators() {
    const w = document.getElementById('indicators-wrap');
    if (w) renderIndicators(w);
  },
};
