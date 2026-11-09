/* InvestSolo — Cadastro/listagem de Obras (visão em tabela) */

const ObrasView = {
  escopo: 'ativas',

  render(container) {
    container.innerHTML = '';
    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Nova obra');
    novoBtn.addEventListener('click', () => openObraModal(null));
    const orcamentoBtn = criarUploadOrcamento();
    const header = el('div', { class: 'view-header' }, [el('h2', {}, 'Obras'), el('div', { class: 'view-actions' }, [orcamentoBtn, novoBtn])]);

    const tabAtivas = el('button', { type: 'button', class: `modal-tab ${this.escopo === 'ativas' ? 'active' : ''}` }, 'Ativas');
    const tabArquivadas = el('button', { type: 'button', class: `modal-tab ${this.escopo === 'arquivadas' ? 'active' : ''}` }, 'Arquivadas');
    tabAtivas.addEventListener('click', () => { this.escopo = 'ativas'; Views.refreshCurrent(); });
    tabArquivadas.addEventListener('click', () => { this.escopo = 'arquivadas'; Views.refreshCurrent(); });
    const tabsNav = el('div', { class: 'modal-tabs' }, [tabAtivas, tabArquivadas]);

    const filters = buildFiltersBar(() => Views.refreshCurrent());

    const tableWrap = el('div', { class: 'table-wrap' });
    const obras = obrasFiltradas(this.escopo).sort((a, b) => (b.dataExecucao || '').localeCompare(a.dataExecucao || ''));
    const clientesById = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));

    if (!obras.length) {
      tableWrap.appendChild(el('div', { class: 'empty-state' }, this.escopo === 'arquivadas' ? 'Nenhuma obra arquivada.' : 'Nenhuma obra encontrada com os filtros atuais.'));
    } else {
      const rows = obras.map(o => {
        const col = COLUNAS.find(c => c.id === o.status);
        const pill = el('span', { class: 'status-pill' }, col ? col.label : o.status);
        pill.style.background = col ? col.cor : '#888';
        const editBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Abrir');
        editBtn.addEventListener('click', () => openObraModal(o.id));
        const arquivarBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, o.arquivada ? 'Restaurar' : 'Arquivar');
        arquivarBtn.addEventListener('click', () => {
          if (!o.arquivada && !confirmDialog(`Arquivar a obra "${o.nomeObra}"?`)) return;
          arquivarObra(o.id, !o.arquivada);
        });
        return el('tr', {}, [
          el('td', {}, o.nomeObra),
          el('td', {}, clientesById[o.clienteId]?.nome || '—'),
          el('td', {}, `${o.cidade || '—'}/${o.estado || ''}`),
          el('td', {}, String(o.quantidadePontos || 0)),
          el('td', {}, formatPeriodoExecucao(o)),
          el('td', {}, formatDateBR(o.prazoRelatorio)),
          el('td', {}, pill),
          el('td', {}, el('span', { class: `prio-badge ${prioridadeClasse(o.prioridade)}` }, o.prioridade)),
          el('td', { class: 'table-actions' }, [editBtn, arquivarBtn]),
        ]);
      });
      const table = el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, ['Obra', 'Cliente', 'Cidade/UF', 'Pontos', 'Execução', 'Prazo relatório', 'Status', 'Prioridade', 'Ações'].map(h => el('th', {}, h)))),
        el('tbody', {}, rows),
      ]);
      tableWrap.appendChild(table);
    }

    container.append(header, tabsNav, filters, tableWrap);
  },
};
