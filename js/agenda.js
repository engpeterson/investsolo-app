/* InvestSolo — Agenda (FullCalendar: mensal, semanal, diária) */

const Agenda = {
  calendar: null,

  render(container) {
    if (this.calendar) { this.calendar.destroy(); this.calendar = null; }
    container.innerHTML = '';

    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo serviço');
    novoBtn.addEventListener('click', () => openObraModal(null, { data: todayISO() }));

    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'Agenda'),
      el('div', { class: 'view-actions' }, [novoBtn]),
    ]);
    const calEl = el('div', { id: 'calendar-el' });
    container.append(header, calEl);
    this.initCalendar(calEl);
  },

  initCalendar(calEl) {
    const obras = DB.getObras();
    const events = obras.map(o => ({
      id: o.id,
      title: o.nomeObra,
      start: o.dataExecucao,
      allDay: true,
      color: PRIO_CORES[o.prioridade] || '#0A3D91',
      extendedProps: { status: o.status },
    }));

    this.calendar = new FullCalendar.Calendar(calEl, {
      locale: 'pt-br',
      height: 'auto',
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
      initialView: 'dayGridMonth',
      events,
      editable: true,
      eventClick: (info) => openObraModal(info.event.id),
      dateClick: (info) => this.showDayPanel(info.dateStr),
      eventDrop: (info) => {
        const obra = DB.getObra(info.event.id);
        if (!obra) return;
        const novaData = info.event.startStr.slice(0, 10);
        const anterior = obra.dataExecucao;
        obra.dataExecucao = novaData;
        DB.upsertObra(obra);
        DB.addHistorico(obra.id, `Data de execução alterada de ${formatDateBR(anterior)} para ${formatDateBR(novaData)}`);
        toast('Serviço reagendado.', 'success');
      },
    });
    this.calendar.render();
  },

  showDayPanel(dateStr) {
    const obras = DB.getObras().filter(o => o.dataExecucao === dateStr);
    const rows = obras.length
      ? obras.map(o => {
          const row = el('div', { class: 'wa-client-row' }, [
            el('div', { class: 'info' }, [el('strong', {}, o.nomeObra), el('span', {}, `${o.cidade}/${o.estado} — ${labelStatus(o.status)}`)]),
          ]);
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => { closeModal(); openObraModal(o.id); });
          return row;
        })
      : [el('div', { class: 'empty-state' }, 'Nenhum serviço nesta data.')];

    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Criar novo serviço nesta data');
    novoBtn.addEventListener('click', () => { closeModal(); openObraModal(null, { data: dateStr }); });

    openModal({
      title: `Serviços em ${formatDateBR(dateStr)}`,
      body: el('div', {}, [...rows, el('div', { style: 'margin-top:14px;' }, novoBtn)]),
      foot: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Fechar')],
      size: 'sm',
    });
  },
};
