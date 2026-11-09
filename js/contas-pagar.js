/* InvestSolo — Contas a Pagar (empresa) + Finanças Pessoais (só Peterson) */

const ICON_CONTA = '<svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>';

// As duas abas (Empresa/Pessoal) compartilham o mesmo formato de lançamento e a
// mesma UI — só muda de onde os dados vêm, quais categorias existem e os textos.
const CONTEXTOS_FINANCEIROS = {
  empresa: {
    chave: 'empresa',
    tituloAba: 'Empresa',
    categorias: CATEGORIAS_CONTA,
    getLista: () => DB.getContasPagar(),
    getById: (id) => DB.getConta(id),
    upsert: (c) => DB.upsertConta(c),
    excluir: (id) => DB.deleteConta(id),
    gerarRecorrentes: () => DB.gerarContasRecorrentesDoMes(),
    rotuloNovo: '+ Nova conta',
    tituloModalNovo: 'Nova conta a pagar',
    rotuloRecorrente: 'Conta fixa mensal (repete automaticamente todo mês)',
    rotuloSingular: 'conta',
  },
  pessoal: {
    chave: 'pessoal',
    tituloAba: 'Pessoal',
    categorias: CATEGORIAS_FINANCA_PESSOAL,
    getLista: () => DB.getFinancasPessoais(),
    getById: (id) => DB.getFinancaPessoal(id),
    upsert: (c) => DB.upsertFinancaPessoal(c),
    excluir: (id) => DB.deleteFinancaPessoal(id),
    gerarRecorrentes: () => DB.gerarFinancasPessoaisRecorrentesDoMes(),
    rotuloNovo: '+ Nova despesa',
    tituloModalNovo: 'Nova despesa pessoal',
    rotuloRecorrente: 'Despesa fixa mensal (repete automaticamente todo mês)',
    rotuloSingular: 'despesa',
  },
};

const ContasPagarView = {
  aba: 'empresa',
  filtros: {
    empresa: { status: '', categoria: '' },
    pessoal: { status: '', categoria: '' },
  },

  render(container) {
    container.innerHTML = '';
    const podeVerPessoal = isPeterson(Auth.getCurrentUser());
    if (this.aba === 'pessoal' && !podeVerPessoal) this.aba = 'empresa';
    const ctx = CONTEXTOS_FINANCEIROS[this.aba];
    ctx.gerarRecorrentes();

    const novaBtn = el('button', { class: 'btn btn-primary', type: 'button' }, ctx.rotuloNovo);
    novaBtn.addEventListener('click', () => openContaModal(null, ctx));

    const indicators = el('div', { class: 'indicators' });
    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'Contas a Pagar'),
      indicators,
      el('div', { class: 'view-actions' }, [novaBtn]),
    ]);
    container.appendChild(header);

    if (podeVerPessoal) {
      const tabEmpresa = el('button', { type: 'button', class: `modal-tab ${this.aba === 'empresa' ? 'active' : ''}` }, 'Empresa');
      const tabPessoal = el('button', { type: 'button', class: `modal-tab ${this.aba === 'pessoal' ? 'active' : ''}` }, 'Pessoal');
      tabEmpresa.addEventListener('click', () => { this.aba = 'empresa'; Views.refreshCurrent(); });
      tabPessoal.addEventListener('click', () => { this.aba = 'pessoal'; Views.refreshCurrent(); });
      container.appendChild(el('div', { class: 'modal-tabs' }, [tabEmpresa, tabPessoal]));
    }

    const filtroState = this.filtros[this.aba];

    const statusSel = el('select', {}, [
      el('option', { value: '' }, 'Status (todos)'),
      el('option', { value: 'pendente' }, 'Pendente'),
      el('option', { value: 'atrasado' }, 'Atrasado'),
      el('option', { value: 'pago' }, 'Pago'),
    ]);
    statusSel.value = filtroState.status;
    statusSel.addEventListener('change', () => { filtroState.status = statusSel.value; Views.refreshCurrent(); });

    const catSel = el('select', {}, [
      el('option', { value: '' }, 'Categoria (todas)'),
      ...ctx.categorias.map(c => el('option', { value: c }, c)),
    ]);
    catSel.value = filtroState.categoria;
    catSel.addEventListener('change', () => { filtroState.categoria = catSel.value; Views.refreshCurrent(); });

    const limpar = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Limpar filtros');
    limpar.addEventListener('click', () => { filtroState.status = ''; filtroState.categoria = ''; Views.refreshCurrent(); });

    const filters = el('div', { class: 'filters-bar' }, [statusSel, catSel, limpar]);

    const tableWrap = el('div', { class: 'table-wrap' });
    container.append(filters, tableWrap);

    this.renderIndicators(indicators, ctx);
    this.renderTable(tableWrap, ctx, filtroState);
  },

  renderIndicators(container, ctx) {
    container.innerHTML = '';
    const contas = ctx.getLista();
    const hoje = todayISO();
    const mesAtual = hoje.slice(0, 7);
    const em7dias = addDaysISO(hoje, 7);

    const pendentesMes = contas.filter(c => c.status === 'pendente' && (c.vencimento || '').startsWith(mesAtual));
    const totalMes = pendentesMes.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    const vencendo = contas.filter(c => c.status === 'pendente' && c.vencimento >= hoje && c.vencimento <= em7dias);
    const totalVencendo = vencendo.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    const atrasadas = contas.filter(c => c.status === 'pendente' && c.vencimento < hoje);
    const totalAtrasado = atrasadas.reduce((s, c) => s + (Number(c.valor) || 0), 0);

    const cards = [
      { lbl: 'A Pagar Este Mês', val: formatMoneyBR(totalMes), accent: 'azul' },
      { lbl: 'Vencendo em 7 Dias', val: formatMoneyBR(totalVencendo), accent: 'alerta' },
      { lbl: 'Atrasado', val: formatMoneyBR(totalAtrasado), accent: 'perigo' },
    ];
    cards.forEach(c => {
      container.appendChild(el('div', { class: 'indicator-card' }, [
        el('div', { class: 'indicator-icon', style: `--accent: var(--${c.accent})`, html: ICON_CONTA }),
        el('div', {}, [el('div', { class: 'val' }, c.val), el('div', { class: 'lbl' }, c.lbl)]),
      ]));
    });
  },

  renderTable(container, ctx, filtroState) {
    container.innerHTML = '';
    let contas = ctx.getLista().slice().sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    if (filtroState.categoria) contas = contas.filter(c => c.categoria === filtroState.categoria);
    if (filtroState.status) contas = contas.filter(c => statusContaInfo(c).chave === filtroState.status);

    if (!contas.length) {
      container.appendChild(el('div', { class: 'empty-state' }, 'Nenhum lançamento encontrado com os filtros atuais.'));
      return;
    }

    // Uma mesma conta recorrente que ficou vários meses em atraso vira várias
    // parcelas pendentes (uma por mês). Em vez de listar cada uma em uma linha
    // separada, agrupamos as parcelas atrasadas da mesma série numa única linha.
    const gruposAtraso = {};
    const linhas = [];
    contas.forEach(c => {
      const info = statusContaInfo(c);
      if (info.chave === 'atrasado' && c.recorrente && c.recorrenciaId) {
        (gruposAtraso[c.recorrenciaId] = gruposAtraso[c.recorrenciaId] || []).push(c);
      } else {
        linhas.push({ tipo: 'unica', conta: c, ordem: c.vencimento || '' });
      }
    });
    Object.values(gruposAtraso).forEach(itens => {
      itens.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
      if (itens.length === 1) {
        linhas.push({ tipo: 'unica', conta: itens[0], ordem: itens[0].vencimento || '' });
      } else {
        linhas.push({ tipo: 'grupo', itens, ordem: itens[0].vencimento || '' });
      }
    });
    linhas.sort((a, b) => a.ordem.localeCompare(b.ordem));

    const rows = linhas.map(l => (l.tipo === 'grupo' ? criarLinhaGrupoAtraso(l.itens, ctx) : criarLinhaConta(l.conta, ctx)));

    const table = el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, ['Descrição', 'Categoria', 'Valor', 'Vencimento', 'Recorrência', 'Status', 'Ações'].map(h => el('th', {}, h)))),
      el('tbody', {}, rows),
    ]);
    container.appendChild(table);
  },
};

function criarLinhaConta(c, ctx) {
  const info = statusContaInfo(c);
  const pill = el('span', { class: 'status-pill' }, info.label);
  pill.style.background = info.cor;

  const pagarBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Marcar como paga');
  pagarBtn.addEventListener('click', () => {
    c.status = 'pago';
    c.dataPagamento = todayISO();
    ctx.upsert(c);
    toast(`${ctx.rotuloSingular === 'despesa' ? 'Despesa' : 'Conta'} marcada como paga.`, 'success');
    Views.refreshCurrent();
  });
  const editBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Editar');
  editBtn.addEventListener('click', () => openContaModal(c.id, ctx));
  const excluirBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Excluir');
  excluirBtn.addEventListener('click', () => {
    if (!confirmDialog(`Excluir a ${ctx.rotuloSingular} "${c.descricao}"? Essa ação não pode ser desfeita.`)) return;
    ctx.excluir(c.id);
    toast(`${ctx.rotuloSingular === 'despesa' ? 'Despesa' : 'Conta'} excluída.`, 'success');
    Views.refreshCurrent();
  });

  const acoes = c.status !== 'pago' ? [pagarBtn, editBtn, excluirBtn] : [editBtn, excluirBtn];

  return el('tr', {}, [
    el('td', {}, c.descricao),
    el('td', {}, c.categoria || '—'),
    el('td', {}, formatMoneyBR(c.valor)),
    el('td', {}, formatDateBR(c.vencimento)),
    el('td', {}, c.recorrente ? 'Mensal' : '—'),
    el('td', {}, pill),
    el('td', { class: 'table-actions' }, acoes),
  ]);
}

// Uma linha só representando N parcelas atrasadas da mesma conta recorrente
// (ex.: sem pagar há 3 meses vira 1 linha com o total das 3 parcelas).
function criarLinhaGrupoAtraso(itens, ctx) {
  const primeira = itens[0];
  const ultima = itens[itens.length - 1];
  const total = itens.reduce((s, c) => s + (Number(c.valor) || 0), 0);

  const pill = el('span', { class: 'status-pill' }, `Atrasado × ${itens.length}`);
  pill.style.background = 'var(--perigo)';

  const pagarTodasBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Marcar todas como pagas');
  pagarTodasBtn.addEventListener('click', () => {
    if (!confirmDialog(`Marcar as ${itens.length} parcelas em atraso de "${primeira.descricao}" como pagas?`)) return;
    itens.forEach(c => { c.status = 'pago'; c.dataPagamento = todayISO(); ctx.upsert(c); });
    toast('Parcelas marcadas como pagas.', 'success');
    Views.refreshCurrent();
  });
  const verBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Ver parcelas');
  verBtn.addEventListener('click', () => abrirParcelasModal(itens, ctx));

  return el('tr', {}, [
    el('td', {}, primeira.descricao),
    el('td', {}, primeira.categoria || '—'),
    el('td', {}, formatMoneyBR(total)),
    el('td', {}, `${formatDateBR(primeira.vencimento)} – ${formatDateBR(ultima.vencimento)}`),
    el('td', {}, 'Mensal'),
    el('td', {}, pill),
    el('td', { class: 'table-actions' }, [pagarTodasBtn, verBtn]),
  ]);
}

// Modal com o detalhe de cada parcela atrasada de uma conta recorrente agrupada,
// pra pagar ou excluir uma parcela de cada vez quando não for o caso de pagar todas.
function abrirParcelasModal(itens, ctx) {
  function montarLinhas() {
    return itens.map(c => {
      const info = statusContaInfo(c);
      const pill = el('span', { class: 'status-pill' }, info.label);
      pill.style.background = info.cor;

      const pagarBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Marcar como paga');
      pagarBtn.addEventListener('click', () => {
        c.status = 'pago';
        c.dataPagamento = todayISO();
        ctx.upsert(c);
        toast(`${ctx.rotuloSingular === 'despesa' ? 'Despesa' : 'Conta'} marcada como paga.`, 'success');
        closeModal();
        Views.refreshCurrent();
      });
      const excluirBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Excluir');
      excluirBtn.addEventListener('click', () => {
        if (!confirmDialog(`Excluir a parcela com vencimento em ${formatDateBR(c.vencimento)}?`)) return;
        ctx.excluir(c.id);
        toast('Parcela excluída.', 'success');
        closeModal();
        Views.refreshCurrent();
      });

      return el('div', { class: 'wa-client-row' }, [
        el('div', { class: 'info' }, [el('strong', {}, formatDateBR(c.vencimento)), el('span', {}, formatMoneyBR(c.valor))]),
        pill,
        el('div', { style: 'display:flex;gap:6px;' }, [pagarBtn, excluirBtn]),
      ]);
    });
  }

  openModal({
    title: `Parcelas em atraso — ${itens[0].descricao}`,
    body: el('div', {}, montarLinhas()),
    foot: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Fechar')],
    size: 'sm',
  });
}

function novaContaVazia(ctx) {
  return {
    descricao: '', categoria: ctx.categorias[0], valor: 0, vencimento: todayISO(),
    status: 'pendente', dataPagamento: null, recorrente: false, recorrenciaId: null,
  };
}

function openContaModal(contaId, ctx) {
  const isNew = !contaId;
  const original = isNew ? novaContaVazia(ctx) : ctx.getById(contaId);
  if (!original) { toast(`${ctx.rotuloSingular === 'despesa' ? 'Despesa' : 'Conta'} não encontrada.`, 'error'); return; }
  const conta = JSON.parse(JSON.stringify(original));

  const refs = {};
  refs.descricao = el('input', { type: 'text', value: conta.descricao, required: '' });
  refs.categoria = el('select', {}, ctx.categorias.map(c => el('option', { value: c }, c)));
  refs.categoria.value = conta.categoria;
  refs.valor = el('input', { type: 'number', min: '0', step: '0.01', value: conta.valor, required: '' });
  refs.vencimento = el('input', { type: 'date', value: conta.vencimento, required: '' });
  refs.recorrente = el('input', { type: 'checkbox' });
  refs.recorrente.checked = !!conta.recorrente;

  const recorrenteLabel = el('label', { class: 'field col-2', style: 'flex-direction:row;align-items:center;gap:8px;' }, [refs.recorrente, ctx.rotuloRecorrente]);

  const body = el('div', { class: 'form-grid' }, [
    field('Descrição', refs.descricao, 'col-2'),
    field('Categoria', refs.categoria),
    field('Valor', refs.valor),
    field('Vencimento', refs.vencimento),
    recorrenteLabel,
  ]);

  if (!isNew && conta.status === 'pago') {
    body.appendChild(el('div', { class: 'col-2', style: 'font-size:13px;color:var(--text-muted);' }, `Paga em ${formatDateBR(conta.dataPagamento)}.`));
  }

  const cancelarBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Cancelar');
  const excluirBtn = el('button', { class: 'btn btn-danger', type: 'button' }, 'Excluir');
  excluirBtn.addEventListener('click', () => {
    if (!confirmDialog(`Tem certeza que deseja excluir esta ${ctx.rotuloSingular}? Essa ação não pode ser desfeita.`)) return;
    ctx.excluir(contaId);
    closeModal();
    toast(`${ctx.rotuloSingular === 'despesa' ? 'Despesa' : 'Conta'} excluída.`, 'success');
    Views.refreshCurrent();
  });
  const salvarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, isNew ? (ctx.rotuloSingular === 'despesa' ? 'Criar despesa' : 'Criar conta') : 'Salvar alterações');
  salvarBtn.addEventListener('click', () => {
    if (!refs.descricao.value.trim()) { toast(`Informe a descrição da ${ctx.rotuloSingular}.`, 'error'); return; }
    if (!refs.vencimento.value) { toast('Informe a data de vencimento.', 'error'); return; }
    const valor = Number(refs.valor.value);
    if (!valor || valor <= 0) { toast('Informe um valor válido.', 'error'); return; }

    const recorrenciaId = refs.recorrente.checked ? (conta.recorrenciaId || uid('rec')) : null;

    const atualizado = {
      id: contaId || uid('cta'),
      descricao: refs.descricao.value.trim(),
      categoria: refs.categoria.value,
      valor,
      vencimento: refs.vencimento.value,
      status: conta.status || 'pendente',
      dataPagamento: conta.dataPagamento || null,
      recorrente: refs.recorrente.checked,
      recorrenciaId,
    };
    ctx.upsert(atualizado);
    closeModal();
    toast(isNew ? `${ctx.rotuloSingular === 'despesa' ? 'Despesa criada' : 'Conta criada'} com sucesso.` : 'Alterações salvas.', 'success');
    Views.refreshCurrent();
  });

  openModal({
    title: isNew ? ctx.tituloModalNovo : conta.descricao,
    body,
    foot: isNew ? [cancelarBtn, salvarBtn] : [excluirBtn, cancelarBtn, salvarBtn],
    size: 'sm',
  });
}
