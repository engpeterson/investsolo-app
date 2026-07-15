/* InvestSolo — Relatórios (PDF e Excel) */

function agruparObras(lista, keyFnOrField) {
  const map = {};
  lista.forEach(o => {
    const key = typeof keyFnOrField === 'function' ? keyFnOrField(o) : (o[keyFnOrField] || '—');
    if (!map[key]) map[key] = { qtd: 0, pontos: 0 };
    map[key].qtd += 1;
    map[key].pontos += Number(o.quantidadePontos) || 0;
  });
  return map;
}

function tabelaAgrupada(titulo, map) {
  const entries = Object.entries(map);
  const wrap = el('div', { style: 'margin-top:20px;' });
  wrap.appendChild(el('h3', { style: 'font-size:15px;margin-bottom:8px;' }, titulo));
  if (!entries.length) { wrap.appendChild(el('div', { class: 'empty-state' }, 'Sem dados no período.')); return wrap; }
  const rows = entries.map(([k, v]) => el('tr', {}, [el('td', {}, k), el('td', {}, String(v.qtd)), el('td', {}, String(v.pontos))]));
  wrap.appendChild(el('div', { class: 'table-wrap' }, el('table', { class: 'data-table' }, [
    el('thead', {}, el('tr', {}, ['Descrição', 'Serviços', 'Pontos'].map(h => el('th', {}, h)))),
    el('tbody', {}, rows),
  ])));
  return wrap;
}

function exportarPDF(obras, periodoLabel) {
  if (!window.jspdf) { toast('Biblioteca de PDF não carregada.', 'error'); return; }
  const podeVerValor = isPeterson(Auth.getCurrentUser());
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(10, 61, 145);
  doc.text('InvestSolo — Relatório de Serviços', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text(`Período: ${periodoLabel}`, 14, 26);

  const clientesById = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));
  const head = ['Obra', 'Cliente', 'Cidade', 'Pontos', 'Execução', 'Status'];
  if (podeVerValor) head.push('Valor');
  const body = obras.map(o => {
    const row = [
      o.nomeObra, clientesById[o.clienteId]?.nome || '—', `${o.cidade}/${o.estado}`,
      String(o.quantidadePontos || 0), formatDateBR(o.dataExecucao), labelStatus(o.status),
    ];
    if (podeVerValor) row.push(formatMoneyBR(o.valorPrevisto));
    return row;
  });
  doc.autoTable({
    startY: 34,
    head: [head],
    body,
    headStyles: { fillColor: [10, 61, 145] },
    styles: { fontSize: 9 },
  });
  doc.save(`investsolo-relatorio-${periodoLabel.replace('/', '-')}.pdf`);
  toast('PDF gerado.', 'success');
}

function exportarExcel(obras, periodoLabel) {
  if (!window.XLSX) { toast('Biblioteca de Excel não carregada.', 'error'); return; }
  const podeVerValor = isPeterson(Auth.getCurrentUser());
  const clientesById = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));
  const data = obras.map(o => {
    const row = {
      Obra: o.nomeObra, Cliente: clientesById[o.clienteId]?.nome || '—', Cidade: o.cidade, Estado: o.estado,
      Pontos: o.quantidadePontos, Tipo: o.tipoSondagem, Execucao: formatDateBR(o.dataExecucao),
      PrazoRelatorio: formatDateBR(o.prazoRelatorio), Status: labelStatus(o.status), Prioridade: o.prioridade,
      Responsavel: o.responsavel, Equipe: o.equipeCampo,
    };
    if (podeVerValor) row.ValorPrevisto = o.valorPrevisto;
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Servicos');
  XLSX.writeFile(wb, `investsolo-relatorio-${periodoLabel}.xlsx`);
  toast('Excel gerado.', 'success');
}

const RelatoriosView = {
  render(container) {
    container.innerHTML = '';
    const header = el('div', { class: 'view-header' }, [el('h2', {}, 'Relatórios')]);

    const hoje = todayISO();
    const mesSel = el('select', {}, MESES.map((m, i) => el('option', { value: String(i + 1).padStart(2, '0') }, m)));
    mesSel.value = hoje.slice(5, 7);
    const anoInput = el('input', { type: 'number', value: hoje.slice(0, 4) });
    anoInput.style.width = '100px';

    const filtBar = el('div', { class: 'filters-bar' }, [
      el('label', { class: 'field', style: 'flex-direction:row;align-items:center;gap:8px;' }, ['Mês', mesSel]),
      el('label', { class: 'field', style: 'flex-direction:row;align-items:center;gap:8px;' }, ['Ano', anoInput]),
    ]);

    const pdfBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Exportar PDF');
    const xlsBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Exportar Excel');
    const exportBar = el('div', { class: 'view-actions', style: 'margin:14px 0;' }, [pdfBtn, xlsBtn]);

    const resultWrap = el('div', { id: 'relatorio-result' });
    let obrasPeriodo = [];

    function gerar() {
      const mes = mesSel.value, ano = anoInput.value;
      obrasPeriodo = DB.getObras().filter(o => (o.dataExecucao || '').slice(0, 4) === ano && (o.dataExecucao || '').slice(5, 7) === mes);
      renderResultado();
    }

    function renderResultado() {
      resultWrap.innerHTML = '';
      const totalPontos = obrasPeriodo.reduce((s, o) => s + (Number(o.quantidadePontos) || 0), 0);
      const totalValor = obrasPeriodo.reduce((s, o) => s + (Number(o.valorPrevisto) || 0), 0);
      const indicCards = [
        el('div', { class: 'indicator-card' }, [el('div', { class: 'val' }, String(obrasPeriodo.length)), el('div', { class: 'lbl' }, 'Serviços no período')]),
        el('div', { class: 'indicator-card' }, [el('div', { class: 'val' }, String(totalPontos)), el('div', { class: 'lbl' }, 'Pontos executados')]),
      ];
      if (isPeterson(Auth.getCurrentUser())) {
        indicCards.push(el('div', { class: 'indicator-card' }, [el('div', { class: 'val' }, formatMoneyBR(totalValor)), el('div', { class: 'lbl' }, 'Valor previsto')]));
      }
      const indic = el('div', { class: 'indicators' }, indicCards);

      const clientesById = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));
      resultWrap.append(
        indic,
        tabelaAgrupada('Produção por equipe', agruparObras(obrasPeriodo, 'equipeCampo')),
        tabelaAgrupada('Produção por cidade', agruparObras(obrasPeriodo, 'cidade')),
        tabelaAgrupada('Produção por cliente', agruparObras(obrasPeriodo, o => clientesById[o.clienteId]?.nome || 'Sem cliente')),
      );
    }

    pdfBtn.addEventListener('click', () => exportarPDF(obrasPeriodo, `${MESES[Number(mesSel.value) - 1]}/${anoInput.value}`));
    xlsBtn.addEventListener('click', () => exportarExcel(obrasPeriodo, `${MESES[Number(mesSel.value) - 1]}_${anoInput.value}`));
    mesSel.addEventListener('change', gerar);
    anoInput.addEventListener('change', gerar);

    container.append(header, filtBar, exportBar, resultWrap);
    gerar();
  },
};
