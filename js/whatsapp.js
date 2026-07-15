/* InvestSolo — WhatsApp incorporado no aplicativo (iframe do WhatsApp Web) */

function proximaObraCliente(clienteId) {
  const hoje = todayISO();
  return DB.getObras()
    .filter(o => o.clienteId === clienteId && o.dataExecucao >= hoje)
    .sort((a, b) => a.dataExecucao.localeCompare(b.dataExecucao))[0];
}

function mensagemPadraoCliente(cliente) {
  const obra = proximaObraCliente(cliente.id);
  if (obra) return `Olá ${cliente.nome}, sua sondagem "${obra.nomeObra}" está agendada para o dia ${formatDateBR(obra.dataExecucao)}. Qualquer dúvida estamos à disposição — InvestSolo.`;
  return `Olá ${cliente.nome}, tudo bem? Aqui é da InvestSolo.`;
}

const WhatsAppView = {
  render(container) {
    container.innerHTML = '';

    const header = el('div', { class: 'view-header' }, [
      el('h2', {}, 'WhatsApp Business'),
    ]);

    const aviso = el('div', { class: 'wa-aviso' }, [
      el('strong', {}, 'Sobre esta tela: '),
      'o WhatsApp está incorporado abaixo, dentro do próprio InvestSolo. Escaneie o QR Code com o WhatsApp Business do celular (Configurações → Aparelhos conectados) para conectar. ',
      'Se a área ficar em branco, é porque o WhatsApp bloqueia por segurança ser exibido dentro de outros aplicativos (restrição do próprio WhatsApp, não deste sistema).',
    ]);

    const iframe = el('iframe', {
      id: 'wa-iframe',
      class: 'wa-iframe',
      src: 'https://web.whatsapp.com/',
      title: 'WhatsApp Web',
      allow: 'clipboard-read; clipboard-write',
    });

    const searchInput = el('input', { type: 'text', placeholder: 'Buscar cliente por nome ou empresa...' });
    searchInput.style.cssText = 'padding:9px 12px;border-radius:8px;border:1px solid var(--border);margin:16px 0 14px;width:100%;max-width:340px;background:var(--surface);color:var(--text);';
    const listWrap = el('div', { id: 'wa-list' });

    const renderList = (q) => {
      listWrap.innerHTML = '';
      let clientes = DB.getClientes();
      if (q) {
        const term = q.toLowerCase();
        clientes = clientes.filter(c => c.nome.toLowerCase().includes(term) || (c.empresa || '').toLowerCase().includes(term));
      }
      if (!clientes.length) { listWrap.appendChild(el('div', { class: 'empty-state' }, 'Nenhum cliente encontrado.')); return; }

      clientes.forEach(c => {
        const obra = proximaObraCliente(c.id);
        const btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Abrir conversa aqui');
        btn.addEventListener('click', () => {
          if (!c.whatsapp) { toast('Este cliente não possui WhatsApp cadastrado.', 'error'); return; }
          const frame = document.getElementById('wa-iframe');
          const link = waLink(c.whatsapp, mensagemPadraoCliente(c));
          if (frame) {
            frame.src = link;
            frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          if (obra && !obra.mensagemEnviada) {
            obra.mensagemEnviada = true;
            DB.upsertObra(obra);
            DB.addHistorico(obra.id, 'Conversa de WhatsApp aberta com o cliente');
          }
        });
        listWrap.appendChild(el('div', { class: 'wa-client-row' }, [
          el('div', { class: 'avatar' }, iniciais(c.nome)),
          el('div', { class: 'info' }, [
            el('strong', {}, `${c.nome} — ${c.empresa || 'sem empresa'}`),
            el('span', {}, obra ? `Próxima obra: ${obra.nomeObra} em ${formatDateBR(obra.dataExecucao)}` : 'Sem obra agendada'),
          ]),
          btn,
        ]));
      });
    };

    searchInput.addEventListener('input', debounce(() => renderList(searchInput.value), 200));
    renderList('');

    container.append(header, aviso, iframe, searchInput, listWrap);
  },
};
