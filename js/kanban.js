/* InvestSolo — Kanban (quadro, drag-and-drop, modal de obra) */

const PRIO_CORES = { Baixa: '#2e8b57', Média: '#e8a400', Alta: '#c0392b' };

function labelStatus(id) {
  const c = COLUNAS.find(c => c.id === id);
  return c ? c.label : id;
}

function arquivarObra(obraId, arquivar) {
  const obra = DB.getObra(obraId);
  if (!obra) return;
  obra.arquivada = arquivar;
  DB.upsertObra(obra);
  DB.addHistorico(obraId, arquivar ? 'Obra arquivada' : 'Obra restaurada do arquivo');
  toast(arquivar ? 'Obra arquivada. Encontre-a na pasta "Arquivadas" em Obras.' : 'Obra restaurada para o quadro ativo.', 'success');
  Views.refreshCurrent();
  if (window.Dashboard) Dashboard.refreshIndicators();
}

function obrasFiltradas(escopo) {
  const f = AppState.filters;
  let obras = DB.getObras();
  obras = obras.filter(o => escopo === 'arquivadas' ? !!o.arquivada : !o.arquivada);
  const clientesById = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));

  if (f.busca) {
    const q = f.busca.toLowerCase();
    obras = obras.filter(o => {
      const cliente = clientesById[o.clienteId];
      return [o.nomeObra, o.cidade, o.responsavel, o.empresaContratante, cliente?.nome, o.id]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }
  if (f.cidade) obras = obras.filter(o => o.cidade === f.cidade);
  if (f.responsavel) obras = obras.filter(o => o.responsavel === f.responsavel);
  if (f.status) obras = obras.filter(o => o.status === f.status);
  if (f.prioridade) obras = obras.filter(o => o.prioridade === f.prioridade);
  if (f.pontosMin) obras = obras.filter(o => Number(o.quantidadePontos) >= Number(f.pontosMin));
  if (f.mes) obras = obras.filter(o => (o.dataExecucao || '').slice(5, 7) === f.mes);
  if (f.ano) obras = obras.filter(o => (o.dataExecucao || '').slice(0, 4) === f.ano);
  return obras;
}

function renderKanbanBoard(container) {
  container.innerHTML = '';
  const board = el('div', { class: 'kanban-board' });
  const obras = obrasFiltradas();

  COLUNAS.forEach(col => {
    const colObras = obras.filter(o => o.status === col.id)
      .sort((a, b) => (a.dataExecucao || '').localeCompare(b.dataExecucao || ''));
    const body = el('div', { class: 'kanban-col-body' });
    body.dataset.status = col.id;
    colObras.forEach(o => body.appendChild(createCardEl(o)));

    const dot = el('span', { class: 'kanban-col-dot' });
    dot.style.background = col.cor;
    const colEl = el('div', { class: 'kanban-col' }, [
      el('div', { class: 'kanban-col-head' }, [dot, col.label, el('span', { class: 'kanban-col-count' }, String(colObras.length))]),
      body,
    ]);
    board.appendChild(colEl);

    if (window.Sortable) {
      Sortable.create(body, {
        group: 'kanban',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onAdd: (evt) => {
          const obraId = evt.item.dataset.id;
          const obra = DB.getObra(obraId);
          if (!obra) return;
          const anterior = obra.status;
          obra.status = col.id;
          DB.upsertObra(obra);
          if (anterior !== col.id) DB.addHistorico(obraId, `Movida de "${labelStatus(anterior)}" para "${labelStatus(col.id)}"`);
          renderKanbanBoard(container);
          if (window.Dashboard) Dashboard.refreshIndicators();
        },
      });
    }
  });

  container.appendChild(board);
}

function createCardEl(obra) {
  const card = el('div', { class: 'kcard' });
  card.dataset.id = obra.id;
  card.style.borderLeftColor = PRIO_CORES[obra.prioridade] || 'var(--azul)';
  card.addEventListener('click', () => openObraModal(obra.id));

  const tags = el('div', { class: 'kcard-tags' }, (obra.etiquetas || []).map(nome => {
    const etq = ETIQUETAS_DISPONIVEIS.find(e => e.nome === nome);
    const chip = el('span', { class: 'tag-chip' }, nome);
    chip.style.background = etq ? etq.cor : '#888';
    return chip;
  }));

  const arquivarBtn = el('button', { class: 'icon-btn kcard-archive-btn', type: 'button', title: 'Arquivar obra' });
  arquivarBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/></svg>';
  arquivarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirmDialog(`Arquivar a obra "${obra.nomeObra}"? Ela sairá do quadro e ficará disponível na pasta "Arquivadas" em Obras.`)) return;
    arquivarObra(obra.id, true);
  });

  card.append(
    tags,
    el('div', { class: 'kcard-title' }, obra.nomeObra || '(sem nome)'),
    el('div', { class: 'kcard-meta' }, [
      el('span', {}, `Cidade: ${obra.cidade || '—'}/${obra.estado || ''}`),
      el('span', {}, `Responsável: ${obra.responsavel || '—'}`),
      el('span', {}, `Pontos: ${obra.quantidadePontos || 0} (${obra.tipoSondagem || '—'})`),
      el('span', {}, `Execução: ${formatPeriodoExecucao(obra)}`),
      el('span', {}, `Relatório até: ${formatDateBR(obra.prazoRelatorio)}`),
    ]),
    el('div', { class: 'kcard-foot' }, [
      el('span', { class: `prio-badge ${prioridadeClasse(obra.prioridade)}` }, obra.prioridade),
      el('div', { style: 'display:flex;align-items:center;gap:4px;' }, [
        el('span', { class: 'kcard-mini-avatar' }, iniciais(obra.responsavel)),
        arquivarBtn,
      ]),
    ]),
  );
  return card;
}

function novaObraVazia(prefill) {
  const clientes = DB.getClientes();
  return {
    id: null,
    nomeObra: '',
    clienteId: prefill?.clienteId || (clientes[0] ? clientes[0].id : ''),
    empresaContratante: '',
    cidade: '', estado: '', endereco: '',
    responsavel: '', equipeCampo: '',
    quantidadePontos: '', tipoSondagem: TIPOS_SONDAGEM[0],
    dataExecucao: prefill?.data || todayISO(),
    dataTerminoExecucao: prefill?.data || todayISO(),
    prazoRelatorio: '',
    status: prefill?.status || 'agendados',
    prioridade: 'Média',
    etiquetas: [],
    valorPrevisto: '',
    dataVencimentoCobranca: '',
    mensagemEnviada: false,
    observacoes: '',
    arquivada: false,
    anexos: [], checklist: [], comentarios: [], historico: [],
  };
}

function field(label, inputEl, colClass) {
  return el('label', { class: `field ${colClass || ''}` }, [label, inputEl]);
}

function openObraModal(obraId, prefill) {
  const isNew = !obraId;
  const original = isNew ? novaObraVazia(prefill) : DB.getObra(obraId);
  if (!original) { toast('Obra não encontrada.', 'error'); return; }
  const obra = JSON.parse(JSON.stringify(original));

  const refs = {};
  const clientes = DB.getClientes();

  // ---- Detalhes tab ----
  refs.nomeObra = el('input', { type: 'text', value: obra.nomeObra, required: '' });
  refs.clienteId = el('select', {}, clientes.map(c => el('option', { value: c.id }, `${c.nome} — ${c.empresa}`)));
  refs.clienteId.value = obra.clienteId;
  refs.empresaContratante = el('input', { type: 'text', value: obra.empresaContratante });
  refs.clienteId.addEventListener('change', () => {
    const c = DB.getCliente(refs.clienteId.value);
    if (c) {
      refs.empresaContratante.value = c.empresa;
      if (!refs.cidade.value) refs.cidade.value = c.cidade;
      if (!refs.estado.value) refs.estado.value = c.estado;
      if (!refs.endereco.value) refs.endereco.value = c.endereco;
    }
  });
  refs.cidade = el('input', { type: 'text', value: obra.cidade });
  refs.estado = el('input', { type: 'text', value: obra.estado, maxlength: '2' });

  // ---- Cadastrar cliente novo sem sair da ficha da obra ----
  const ncNome = el('input', { type: 'text', placeholder: 'Nome do cliente' });
  const ncEmpresa = el('input', { type: 'text', placeholder: 'Empresa (opcional)' });
  const ncWhatsapp = el('input', { type: 'text', placeholder: '5511999998888 (opcional)' });
  const ncSalvarBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Salvar cliente');
  const ncCancelarBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Cancelar');
  const novoClientePainel = el('div', { class: 'col-2 hidden', style: 'border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:-4px;background:var(--cinza-50);' }, [
    el('div', { class: 'form-grid', style: 'margin-bottom:10px;' }, [
      field('Nome', ncNome),
      field('Empresa', ncEmpresa),
      field('WhatsApp', ncWhatsapp),
    ]),
    el('div', { style: 'display:flex;gap:8px;' }, [ncSalvarBtn, ncCancelarBtn]),
  ]);
  function limparPainelNovoCliente() {
    ncNome.value = ''; ncEmpresa.value = ''; ncWhatsapp.value = '';
    novoClientePainel.classList.add('hidden');
  }
  const novoClienteBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: 'white-space:nowrap;' }, '+ Novo cliente');
  novoClienteBtn.addEventListener('click', () => {
    novoClientePainel.classList.toggle('hidden');
    if (!novoClientePainel.classList.contains('hidden')) ncNome.focus();
  });
  ncCancelarBtn.addEventListener('click', limparPainelNovoCliente);
  ncSalvarBtn.addEventListener('click', () => {
    if (!ncNome.value.trim()) { toast('Informe o nome do cliente.', 'error'); return; }
    const novoCliente = {
      id: uid('cli'),
      nome: ncNome.value.trim(),
      empresa: ncEmpresa.value.trim(),
      cpfCnpj: '',
      whatsapp: ncWhatsapp.value.replace(/\D/g, ''),
      email: '',
      cidade: refs.cidade.value.trim(),
      estado: refs.estado.value.trim().toUpperCase(),
      endereco: '',
      observacoes: `Cadastrado a partir da ficha da obra "${refs.nomeObra.value.trim() || '(sem nome)'}".`,
    };
    DB.upsertCliente(novoCliente);
    refs.clienteId.appendChild(el('option', { value: novoCliente.id }, `${novoCliente.nome} — ${novoCliente.empresa}`));
    refs.clienteId.value = novoCliente.id;
    refs.clienteId.dispatchEvent(new Event('change'));
    limparPainelNovoCliente();
    toast('Cliente cadastrado e vinculado a esta obra.', 'success');
  });
  refs.endereco = el('input', { type: 'text', value: obra.endereco });
  refs.responsavel = el('input', { type: 'text', value: obra.responsavel });
  refs.equipeCampo = el('input', { type: 'text', value: obra.equipeCampo });
  refs.quantidadePontos = el('input', { type: 'number', min: '0', value: obra.quantidadePontos });
  refs.tipoSondagem = el('select', {}, TIPOS_SONDAGEM.map(t => el('option', { value: t }, t)));
  refs.tipoSondagem.value = obra.tipoSondagem;
  refs.dataExecucao = el('input', { type: 'date', value: obra.dataExecucao, required: '' });
  refs.dataTerminoExecucao = el('input', { type: 'date', value: obra.dataTerminoExecucao || obra.dataExecucao, min: obra.dataExecucao, required: '' });
  refs.dataExecucao.addEventListener('change', () => {
    refs.dataTerminoExecucao.min = refs.dataExecucao.value;
    if (refs.dataTerminoExecucao.value && refs.dataTerminoExecucao.value < refs.dataExecucao.value) {
      refs.dataTerminoExecucao.value = refs.dataExecucao.value;
    }
  });
  refs.prazoRelatorio = el('input', { type: 'date', value: obra.prazoRelatorio });
  refs.status = el('select', {}, COLUNAS.map(c => el('option', { value: c.id }, c.label)));
  refs.status.value = obra.status;
  refs.prioridade = el('select', {}, PRIORIDADES.map(p => el('option', { value: p }, p)));
  refs.prioridade.value = obra.prioridade;
  refs.valorPrevisto = el('input', { type: 'number', min: '0', step: '0.01', value: obra.valorPrevisto });
  refs.dataVencimentoCobranca = el('input', { type: 'date', value: obra.dataVencimentoCobranca });
  refs.observacoes = el('textarea', { rows: '3' }, obra.observacoes || '');
  refs.mensagemEnviada = el('input', { type: 'checkbox' });
  refs.mensagemEnviada.checked = !!obra.mensagemEnviada;

  const etqWrap = el('div', { class: 'etiquetas-picker' });
  const etqSelecionadas = new Set(obra.etiquetas || []);
  ETIQUETAS_DISPONIVEIS.forEach(etq => {
    const btn = el('button', { type: 'button', class: `etq-option ${etqSelecionadas.has(etq.nome) ? 'selected' : ''}` }, etq.nome);
    btn.style.background = etq.cor;
    btn.addEventListener('click', () => {
      if (etqSelecionadas.has(etq.nome)) etqSelecionadas.delete(etq.nome); else etqSelecionadas.add(etq.nome);
      btn.classList.toggle('selected');
    });
    etqWrap.appendChild(btn);
  });

  const mapsBtn = el('a', { class: 'map-link', target: '_blank', rel: 'noopener' }, 'Abrir localização no Google Maps');
  mapsBtn.addEventListener('click', (e) => {
    const query = `${refs.endereco.value}, ${refs.cidade.value} ${refs.estado.value}`;
    mapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  });
  mapsBtn.href = '#';

  const detalhesPane = el('div', { class: 'tab-pane active', 'data-pane': 'detalhes' }, [
    el('div', { class: 'form-grid' }, [
      field('Nome da obra', refs.nomeObra, 'col-2'),
      field('Cliente', el('div', { style: 'display:flex;gap:6px;' }, [refs.clienteId, novoClienteBtn])),
      field('Empresa contratante', refs.empresaContratante),
      novoClientePainel,
      field('Cidade', refs.cidade),
      field('Estado (UF)', refs.estado),
      field('Endereço da obra', refs.endereco, 'col-2'),
      el('div', { class: 'col-2' }, mapsBtn),
      field('Responsável', refs.responsavel),
      field('Equipe de campo', refs.equipeCampo),
      field('Quantidade de pontos', refs.quantidadePontos),
      field('Tipo de sondagem', refs.tipoSondagem),
      field('Data de execução', refs.dataExecucao),
      field('Data de término da execução', refs.dataTerminoExecucao),
      field('Prazo do relatório', refs.prazoRelatorio),
      field('Status', refs.status),
      field('Prioridade', refs.prioridade),
      field('Valor previsto (R$)', refs.valorPrevisto),
      field('Vencimento da cobrança', refs.dataVencimentoCobranca),
      el('label', { class: 'field col-2' }, ['Etiquetas', etqWrap]),
      field('Mensagem enviada ao cliente', refs.mensagemEnviada),
      field('Observações', refs.observacoes, 'col-2'),
    ]),
  ]);

  // ---- Checklist tab ----
  const checklist = [...(obra.checklist || [])];
  const checklistList = el('div', {});
  function renderChecklist() {
    checklistList.innerHTML = '';
    checklist.forEach((item, idx) => {
      const check = el('input', { type: 'checkbox' });
      check.checked = !!item.done;
      check.addEventListener('change', () => { item.done = check.checked; row.classList.toggle('done', check.checked); });
      const txt = el('span', {}, item.item);
      const rm = el('button', { class: 'icon-btn', type: 'button', title: 'Remover' }, '×');
      rm.addEventListener('click', () => { checklist.splice(idx, 1); renderChecklist(); });
      var row = el('div', { class: `checklist-item ${item.done ? 'done' : ''}` }, [check, txt, rm]);
      checklistList.appendChild(row);
    });
    if (!checklist.length) checklistList.appendChild(el('div', { class: 'empty-state' }, 'Nenhum item no checklist.'));
  }
  renderChecklist();
  const novoItemInput = el('input', { type: 'text', placeholder: 'Nova tarefa...' });
  const addItemBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Adicionar');
  addItemBtn.addEventListener('click', () => {
    if (!novoItemInput.value.trim()) return;
    checklist.push({ item: novoItemInput.value.trim(), done: false });
    novoItemInput.value = '';
    renderChecklist();
  });
  const checklistPane = el('div', { class: 'tab-pane', 'data-pane': 'checklist' }, [
    checklistList,
    el('div', { style: 'display:flex;gap:8px;margin-top:10px;' }, [novoItemInput, addItemBtn]),
  ]);

  // ---- Anexos tab ----
  const anexos = [...(obra.anexos || [])];
  const anexosList = el('div', { class: 'attach-list' });
  function renderAnexos() {
    anexosList.innerHTML = '';
    anexos.forEach((a, idx) => {
      const chip = el('div', { class: 'attach-chip' });
      if (a.tipo && a.tipo.startsWith('image/')) chip.appendChild(el('img', { src: a.dataURL }));
      chip.appendChild(el('span', {}, a.nome));
      const rm = el('button', { class: 'icon-btn', type: 'button' }, '×');
      rm.addEventListener('click', () => { anexos.splice(idx, 1); renderAnexos(); });
      chip.appendChild(rm);
      anexosList.appendChild(chip);
    });
    if (!anexos.length) anexosList.appendChild(el('div', { class: 'empty-state' }, 'Nenhum anexo. Envie fotos ou PDF do relatório.'));
  }
  renderAnexos();
  const fileInput = el('input', { type: 'file', multiple: '', accept: 'image/*,.pdf' });
  fileInput.addEventListener('change', () => {
    [...fileInput.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        anexos.push({ nome: file.name, tipo: file.type, dataURL: reader.result });
        renderAnexos();
      };
      reader.readAsDataURL(file);
    });
    fileInput.value = '';
  });
  const anexosPane = el('div', { class: 'tab-pane', 'data-pane': 'anexos' }, [anexosList, el('div', { style: 'margin-top:10px;' }, fileInput)]);

  // ---- Comentários tab ----
  const comentarios = [...(obra.comentarios || [])];
  const comentariosList = el('div', {});
  function renderComentarios() {
    comentariosList.innerHTML = '';
    comentarios.slice().reverse().forEach(c => {
      comentariosList.appendChild(el('div', { class: 'comment-item' }, [
        el('strong', {}, c.autor),
        el('time', {}, new Date(c.data).toLocaleString('pt-BR')),
        el('div', {}, c.texto),
      ]));
    });
    if (!comentarios.length) comentariosList.appendChild(el('div', { class: 'empty-state' }, 'Nenhum comentário ainda.'));
  }
  renderComentarios();
  const novoComentario = el('textarea', { rows: '2', placeholder: 'Escreva um comentário interno...' });
  const addComentarioBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Comentar');
  addComentarioBtn.addEventListener('click', () => {
    if (!novoComentario.value.trim()) return;
    const user = Auth.getCurrentUser();
    comentarios.push({ autor: user ? user.nome : 'Usuário', data: new Date().toISOString(), texto: novoComentario.value.trim() });
    novoComentario.value = '';
    renderComentarios();
  });
  const comentariosPane = el('div', { class: 'tab-pane', 'data-pane': 'comentarios' }, [
    comentariosList,
    el('div', { style: 'display:flex;gap:8px;margin-top:10px;align-items:flex-start;' }, [novoComentario, addComentarioBtn]),
  ]);

  // ---- Histórico tab ----
  const historicoPane = el('div', { class: 'tab-pane', 'data-pane': 'historico' },
    (obra.historico || []).length
      ? obra.historico.map(h => el('div', { class: 'hist-item' }, [el('time', {}, new Date(h.data).toLocaleString('pt-BR')), el('span', {}, `${h.usuario}: ${h.acao}`)]))
      : el('div', { class: 'empty-state' }, 'Sem histórico.'));

  // ---- Tabs nav ----
  const tabsDef = [
    { id: 'detalhes', label: 'Detalhes', pane: detalhesPane },
    { id: 'checklist', label: 'Checklist', pane: checklistPane },
    { id: 'anexos', label: 'Anexos', pane: anexosPane },
    { id: 'comentarios', label: 'Comentários', pane: comentariosPane },
  ];
  if (!isNew) tabsDef.push({ id: 'historico', label: 'Histórico', pane: historicoPane });

  const tabsNav = el('div', { class: 'modal-tabs' });
  const tabButtons = {};
  tabsDef.forEach((t, i) => {
    const btn = el('button', { type: 'button', class: `modal-tab ${i === 0 ? 'active' : ''}` }, t.label);
    btn.addEventListener('click', () => {
      tabsDef.forEach(t2 => { tabButtons[t2.id].classList.remove('active'); t2.pane.classList.remove('active'); });
      btn.classList.add('active'); t.pane.classList.add('active');
    });
    tabButtons[t.id] = btn;
    tabsNav.appendChild(btn);
  });

  const body = el('div', {}, [tabsNav, detalhesPane, checklistPane, anexosPane, comentariosPane, ...(isNew ? [] : [historicoPane])]);

  const excluirBtn = el('button', { class: 'btn btn-danger', type: 'button' }, 'Excluir');
  excluirBtn.style.marginRight = isNew ? '' : '8px';
  excluirBtn.addEventListener('click', () => {
    if (!confirmDialog('Tem certeza que deseja excluir esta obra? Essa ação não pode ser desfeita.')) return;
    DB.deleteObra(obraId);
    closeModal();
    toast('Obra excluída.', 'success');
    Views.refreshCurrent();
  });

  const arquivarModalBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, obra.arquivada ? 'Restaurar do arquivo' : 'Arquivar obra');
  arquivarModalBtn.style.marginRight = 'auto';
  arquivarModalBtn.addEventListener('click', () => {
    if (!obra.arquivada && !confirmDialog(`Arquivar a obra "${obra.nomeObra}"? Ela sairá do quadro e ficará disponível na pasta "Arquivadas" em Obras.`)) return;
    arquivarObra(obraId, !obra.arquivada);
    closeModal();
  });

  const cancelarBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Cancelar');
  const salvarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, isNew ? 'Criar obra' : 'Salvar alterações');
  salvarBtn.addEventListener('click', () => {
    if (!refs.nomeObra.value.trim()) { toast('Informe o nome da obra.', 'error'); return; }
    if (!refs.dataExecucao.value) { toast('Informe a data de execução.', 'error'); return; }
    if (!refs.dataTerminoExecucao.value) { toast('Informe a data de término da execução.', 'error'); return; }
    if (refs.dataTerminoExecucao.value < refs.dataExecucao.value) {
      toast('A data de término da execução não pode ser antes da data de execução.', 'error');
      return;
    }
    const diaBloqueado = primeiroDiaBloqueadoNoPeriodo(refs.dataExecucao.value, refs.dataTerminoExecucao.value, DB.getConfigAgenda());
    if (diaBloqueado) {
      toast(`Não é possível agendar para ${formatDateBR(diaBloqueado)} (${nomeDiaSemana(diaBloqueado)}) — não trabalhamos nesse dia.`, 'error');
      return;
    }
    const atualizado = {
      id: obraId || uid('obr'),
      nomeObra: refs.nomeObra.value.trim(),
      clienteId: refs.clienteId.value,
      empresaContratante: refs.empresaContratante.value.trim(),
      cidade: refs.cidade.value.trim(),
      estado: refs.estado.value.trim().toUpperCase(),
      endereco: refs.endereco.value.trim(),
      responsavel: refs.responsavel.value.trim(),
      equipeCampo: refs.equipeCampo.value.trim(),
      quantidadePontos: Number(refs.quantidadePontos.value) || 0,
      tipoSondagem: refs.tipoSondagem.value,
      dataExecucao: refs.dataExecucao.value,
      dataTerminoExecucao: refs.dataTerminoExecucao.value,
      prazoRelatorio: refs.prazoRelatorio.value,
      status: refs.status.value,
      prioridade: refs.prioridade.value,
      etiquetas: [...etqSelecionadas],
      valorPrevisto: Number(refs.valorPrevisto.value) || 0,
      dataVencimentoCobranca: refs.dataVencimentoCobranca.value,
      mensagemEnviada: refs.mensagemEnviada.checked,
      observacoes: refs.observacoes.value.trim(),
      arquivada: !!obra.arquivada,
      anexos, checklist, comentarios,
      historico: obra.historico || [],
    };
    DB.upsertObra(atualizado);
    DB.addHistorico(atualizado.id, isNew ? 'Obra criada' : 'Detalhes atualizados');
    closeModal();
    toast(isNew ? 'Obra criada com sucesso.' : 'Alterações salvas.', 'success');
    Views.refreshCurrent();
  });

  openModal({
    title: isNew ? 'Nova obra' : obra.nomeObra,
    body,
    foot: isNew ? [cancelarBtn, salvarBtn] : [arquivarModalBtn, excluirBtn, cancelarBtn, salvarBtn],
    size: 'lg',
  });
}
