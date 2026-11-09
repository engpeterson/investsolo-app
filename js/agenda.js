/* InvestSolo — Agenda (FullCalendar: mensal, semanal, diária) */

const Agenda = {
  calendar: null,

  render(container) {
    if (this.calendar) { this.calendar.destroy(); this.calendar = null; }
    container.innerHTML = '';

    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo serviço');
    novoBtn.addEventListener('click', () => openObraModal(null, { data: todayISO() }));

    const cfg = DB.getConfigAgenda();
    const sabadoCheck = el('input', { type: 'checkbox' });
    sabadoCheck.checked = !!cfg.trabalhaSabado;
    sabadoCheck.addEventListener('change', () => {
      const c = DB.getConfigAgenda();
      c.trabalhaSabado = sabadoCheck.checked;
      DB.setConfigAgenda(c);
      toast(sabadoCheck.checked ? 'Sábado liberado para agendamento de serviços.' : 'Sábado voltou a ficar bloqueado, igual domingo.', 'success');
    });
    const sabadoLabel = el('label', { class: 'field', style: 'flex-direction:row;align-items:center;gap:8px;margin:0;' }, [sabadoCheck, 'Trabalhamos aos sábados']);

    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'Agenda'),
      el('div', { class: 'view-actions', style: 'align-items:center;' }, [sabadoLabel, novoBtn]),
    ]);
    const calEl = el('div', { id: 'calendar-el' });
    container.append(header, calEl);
    this.initCalendar(calEl);
  },

  initCalendar(calEl) {
    const obras = DB.getObras().filter(o => !o.arquivada);
    // O FullCalendar trata o "end" de eventos allDay como exclusivo, então soma-se
    // 1 dia à data de término para a barra cobrir visualmente o último dia do serviço.
    const events = obras.map(o => ({
      id: o.id,
      title: o.nomeObra,
      start: o.dataExecucao,
      end: addDaysISO(o.dataTerminoExecucao || o.dataExecucao, 1),
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
        // Arrastar o bloco inteiro (início e término) mantém a duração do serviço:
        // desloca as duas datas pela mesma quantidade de dias.
        const novaData = info.event.startStr.slice(0, 10);
        const anteriorInicio = obra.dataExecucao;
        const anteriorTermino = obra.dataTerminoExecucao || obra.dataExecucao;
        const deslocamento = diasEntre(anteriorInicio, novaData);
        const novoInicio = novaData;
        const novoTermino = addDaysISO(anteriorTermino, deslocamento);
        const diaBloqueado = primeiroDiaBloqueadoNoPeriodo(novoInicio, novoTermino, DB.getConfigAgenda());
        if (diaBloqueado) {
          info.revert();
          toast(`Não é possível reagendar para ${formatDateBR(diaBloqueado)} (${nomeDiaSemana(diaBloqueado)}) — não trabalhamos nesse dia.`, 'error');
          return;
        }
        obra.dataExecucao = novoInicio;
        obra.dataTerminoExecucao = novoTermino;
        DB.upsertObra(obra);
        DB.addHistorico(obra.id, `Execução reagendada de ${formatDateBR(anteriorInicio)}–${formatDateBR(anteriorTermino)} para ${formatDateBR(obra.dataExecucao)}–${formatDateBR(obra.dataTerminoExecucao)}`);
        toast('Serviço reagendado.', 'success');
      },
    });
    this.calendar.render();
  },

  showDayPanel(dateStr) {
    const obras = DB.getObras().filter(o => !o.arquivada && o.dataExecucao <= dateStr && dateStr <= (o.dataTerminoExecucao || o.dataExecucao));
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
    novoBtn.addEventListener('click', () => {
      if (diaBloqueadoParaObra(dateStr, DB.getConfigAgenda())) {
        toast(`Não é possível criar serviço em ${formatDateBR(dateStr)} (${nomeDiaSemana(dateStr)}) — não trabalhamos nesse dia.`, 'error');
        return;
      }
      closeModal();
      openObraModal(null, { data: dateStr });
    });

    openModal({
      title: `Serviços em ${formatDateBR(dateStr)}`,
      body: el('div', {}, [...rows, el('div', { style: 'margin-top:14px;' }, novoBtn)]),
      foot: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Fechar')],
      size: 'sm',
    });
  },
};
