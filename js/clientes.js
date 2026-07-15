/* InvestSolo — Cadastro de Clientes */

function openClienteModal(clienteId) {
  const isNew = !clienteId;
  const original = isNew
    ? { id: null, nome: '', empresa: '', cpfCnpj: '', whatsapp: '', email: '', cidade: '', estado: '', endereco: '', observacoes: '' }
    : DB.getCliente(clienteId);
  if (!original) { toast('Cliente não encontrado.', 'error'); return; }
  const c = { ...original };

  const refs = {
    nome: el('input', { type: 'text', value: c.nome, required: '' }),
    empresa: el('input', { type: 'text', value: c.empresa }),
    cpfCnpj: el('input', { type: 'text', value: c.cpfCnpj, placeholder: '000.000.000-00 ou 00.000.000/0000-00' }),
    whatsapp: el('input', { type: 'text', value: c.whatsapp, placeholder: '5511999998888' }),
    email: el('input', { type: 'email', value: c.email }),
    cidade: el('input', { type: 'text', value: c.cidade }),
    estado: el('input', { type: 'text', value: c.estado, maxlength: '2' }),
    endereco: el('input', { type: 'text', value: c.endereco }),
    observacoes: el('textarea', { rows: '3' }, c.observacoes || ''),
  };

  const body = el('div', { class: 'form-grid' }, [
    field('Nome', refs.nome),
    field('Empresa', refs.empresa),
    field('CPF/CNPJ', refs.cpfCnpj),
    field('WhatsApp (DDI+DDD+número)', refs.whatsapp),
    field('Email', refs.email),
    field('Cidade', refs.cidade),
    field('Estado (UF)', refs.estado),
    field('Endereço', refs.endereco, 'col-2'),
    field('Observações', refs.observacoes, 'col-2'),
  ]);

  const excluirBtn = el('button', { class: 'btn btn-danger', type: 'button' }, 'Excluir');
  excluirBtn.style.marginRight = 'auto';
  excluirBtn.addEventListener('click', () => {
    const obrasVinculadas = DB.getObras().filter(o => o.clienteId === clienteId);
    if (obrasVinculadas.length) { toast(`Não é possível excluir: existem ${obrasVinculadas.length} obra(s) vinculada(s) a este cliente.`, 'error'); return; }
    if (!confirmDialog('Excluir este cliente?')) return;
    DB.deleteCliente(clienteId);
    closeModal();
    toast('Cliente excluído.', 'success');
    Views.refreshCurrent();
  });

  const cancelarBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Cancelar');
  const salvarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, isNew ? 'Criar cliente' : 'Salvar alterações');
  salvarBtn.addEventListener('click', () => {
    if (!refs.nome.value.trim()) { toast('Informe o nome do cliente.', 'error'); return; }
    const atualizado = {
      id: clienteId || uid('cli'),
      nome: refs.nome.value.trim(),
      empresa: refs.empresa.value.trim(),
      cpfCnpj: refs.cpfCnpj.value.trim(),
      whatsapp: refs.whatsapp.value.replace(/\D/g, ''),
      email: refs.email.value.trim(),
      cidade: refs.cidade.value.trim(),
      estado: refs.estado.value.trim().toUpperCase(),
      endereco: refs.endereco.value.trim(),
      observacoes: refs.observacoes.value.trim(),
    };
    DB.upsertCliente(atualizado);
    closeModal();
    toast(isNew ? 'Cliente criado.' : 'Alterações salvas.', 'success');
    Views.refreshCurrent();
  });

  openModal({
    title: isNew ? 'Novo cliente' : c.nome,
    body,
    foot: isNew ? [cancelarBtn, salvarBtn] : [excluirBtn, cancelarBtn, salvarBtn],
  });
}

const ClientesView = {
  render(container) {
    container.innerHTML = '';
    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo cliente');
    novoBtn.addEventListener('click', () => openClienteModal(null));
    const header = el('div', { class: 'view-header' }, [el('h2', {}, 'Clientes'), el('div', { class: 'view-actions' }, [novoBtn])]);

    const tableWrap = el('div', { class: 'table-wrap' });
    const clientes = DB.getClientes().filter(c => {
      const q = (AppState.filters.busca || '').toLowerCase();
      if (!q) return true;
      return [c.nome, c.empresa, c.cidade].filter(Boolean).some(v => v.toLowerCase().includes(q));
    });

    if (!clientes.length) {
      tableWrap.appendChild(el('div', { class: 'empty-state' }, 'Nenhum cliente cadastrado.'));
    } else {
      const rows = clientes.map(c => {
        const nObras = DB.getObras().filter(o => o.clienteId === c.id).length;
        const editBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Editar');
        editBtn.addEventListener('click', () => openClienteModal(c.id));
        return el('tr', {}, [
          el('td', {}, c.nome),
          el('td', {}, c.empresa || '—'),
          el('td', {}, c.whatsapp ? `+${c.whatsapp}` : '—'),
          el('td', {}, `${c.cidade || '—'}/${c.estado || ''}`),
          el('td', {}, c.email || '—'),
          el('td', {}, String(nObras)),
          el('td', { class: 'table-actions' }, [editBtn]),
        ]);
      });
      const table = el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, ['Nome', 'Empresa', 'WhatsApp', 'Cidade/UF', 'Email', 'Obras', 'Ações'].map(h => el('th', {}, h)))),
        el('tbody', {}, rows),
      ]);
      tableWrap.appendChild(table);
    }

    container.append(header, tableWrap);
  },
};
