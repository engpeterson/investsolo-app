/* InvestSolo — Assistente de IA (chat sobre estratégia e cronograma dos serviços)
 *
 * Chama a API da Anthropic (Claude) diretamente do navegador, usando a chave de
 * API que o próprio usuário cadastra nas configurações do assistente. O app não
 * tem backend, então essa chave fica salva só no localStorage deste navegador e
 * é enviada apenas para api.anthropic.com — nunca passa por nenhum servidor da
 * InvestSolo (não existe um).
 */

const IA_API_URL = 'https://api.anthropic.com/v1/messages';

const IA_SYSTEM_PROMPT = `Você é o Assistente de IA da InvestSolo, empresa de sondagem geotécnica (SPT, CPT, sondagem rotativa, mista e trado) de Jaraguá do Sul/SC.
Converse em português do Brasil, de forma direta e prática. Sua função é ajudar o dono/gestor a pensar estratégia, prioridades e dicas sobre a programação (cronograma) dos serviços: como organizar a ordem das obras, evitar conflitos de agenda e sobrecarga de equipe, equilibrar urgência x distância x rentabilidade, e sugerir ajustes no planejamento.
Quando receber um resumo das obras cadastradas no sistema, use esses dados concretos para embasar sugestões específicas. Quando não houver dados, dê orientações gerais de boas práticas de programação de serviços de campo.
Seja objetivo. Não invente números que não foram informados.`;

function iaFormatarObraParaContexto(o, clientesPorId) {
  const cliente = clientesPorId[o.clienteId];
  const partes = [
    `"${o.nomeObra || '(sem nome)'}"`,
    `status: ${(COLUNAS.find(c => c.id === o.status) || {}).label || o.status}`,
    cliente ? `cliente: ${cliente.nome}` : null,
    o.cidade ? `local: ${o.cidade}/${o.estado || ''}` : null,
    o.dataExecucao ? `execução: ${formatDateBR(o.dataExecucao)}` : null,
    o.prazoRelatorio ? `prazo relatório: ${formatDateBR(o.prazoRelatorio)}` : null,
    o.quantidadePontos ? `pontos: ${o.quantidadePontos}` : null,
    o.tipoSondagem ? `tipo: ${o.tipoSondagem}` : null,
    o.prioridade ? `prioridade: ${o.prioridade}` : null,
    o.responsavel ? `responsável: ${o.responsavel}` : null,
  ].filter(Boolean);
  return `- ${partes.join(' | ')}`;
}

function iaMontarContextoDados() {
  const obras = DB.getObras().filter(o => !o.arquivada);
  if (!obras.length) return 'Não há obras cadastradas no momento (fora do arquivo).';
  const clientesPorId = Object.fromEntries(DB.getClientes().map(c => [c.id, c]));
  const ordenadas = [...obras].sort((a, b) => (a.dataExecucao || '9999').localeCompare(b.dataExecucao || '9999'));
  const LIMITE = 60;
  const linhas = ordenadas.slice(0, LIMITE).map(o => iaFormatarObraParaContexto(o, clientesPorId));
  let texto = `Data de hoje: ${formatDateBR(todayISO())}.\nObras ativas cadastradas no sistema (${obras.length} no total):\n${linhas.join('\n')}`;
  if (obras.length > LIMITE) texto += `\n... (+${obras.length - LIMITE} obra(s) não listada(s) por espaço)`;
  return texto;
}

function iaAbrirConfigModal(onSalvar) {
  const cfg = DB.getIaConfig();
  const apiKeyInput = el('input', { type: 'password', value: cfg.apiKey || '', placeholder: 'sk-ant-...', autocomplete: 'off' });
  const toggleVerBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Mostrar');
  toggleVerBtn.addEventListener('click', () => {
    const mostrando = apiKeyInput.type === 'text';
    apiKeyInput.type = mostrando ? 'password' : 'text';
    toggleVerBtn.textContent = mostrando ? 'Mostrar' : 'Ocultar';
  });
  const modeloInput = el('input', { type: 'text', value: cfg.modelo || 'claude-sonnet-4-5-20250929' });
  const incluirDadosCheck = el('input', { type: 'checkbox' });
  incluirDadosCheck.checked = cfg.incluirDados !== false;

  const body = el('div', { class: 'form-grid' }, [
    el('div', { class: 'col-2', style: 'font-size:13px;color:var(--text-muted);line-height:1.5;' },
      'Esse app não tem servidor próprio, então a conversa com a IA acontece direto do seu navegador com a API da Anthropic (Claude). Cole abaixo a sua chave de API pessoal — ela fica salva só neste navegador (localStorage) e é enviada apenas para api.anthropic.com. Se você usar um computador compartilhado, prefira não salvar a chave aqui.'),
    el('label', { class: 'field col-2' }, [
      'Chave de API da Anthropic',
      el('div', { style: 'display:flex;gap:6px;' }, [apiKeyInput, toggleVerBtn]),
    ]),
    el('label', { class: 'field col-2' }, [
      'Modelo',
      modeloInput,
    ]),
    el('div', { class: 'col-2', style: 'font-size:12px;color:var(--text-muted);' },
      'Se o assistente responder com erro de "modelo inválido", troque esse campo pelo ID de modelo mais recente disponível na sua conta (console.anthropic.com).'),
    field('Incluir dados das obras agendadas no contexto enviado à IA', incluirDadosCheck),
  ]);

  const cancelarBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Cancelar');
  const salvarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Salvar');
  salvarBtn.addEventListener('click', () => {
    DB.setIaConfig({
      apiKey: apiKeyInput.value.trim(),
      modelo: modeloInput.value.trim() || 'claude-sonnet-4-5-20250929',
      incluirDados: incluirDadosCheck.checked,
    });
    closeModal();
    toast('Configurações do assistente salvas.', 'success');
    if (onSalvar) onSalvar();
  });

  openModal({ title: 'Configurações do Assistente de IA', body, foot: [cancelarBtn, salvarBtn] });
}

function iaCriarBalao(msg) {
  const cls = msg.role === 'user' ? 'ia-msg ia-msg-user' : (msg.role === 'erro' ? 'ia-msg ia-msg-erro' : 'ia-msg ia-msg-assistant');
  return el('div', { class: cls }, [
    el('div', { class: 'ia-msg-bubble' }, msg.texto),
  ]);
}

async function iaChamarAPI(historico, cfg, incluirDados) {
  const systemPrompt = incluirDados ? `${IA_SYSTEM_PROMPT}\n\n${iaMontarContextoDados()}` : IA_SYSTEM_PROMPT;
  const mensagens = historico
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.texto }));

  const res = await fetch(IA_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.modelo,
      max_tokens: 1024,
      system: systemPrompt,
      messages: mensagens,
    }),
  });

  let data;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    const msgErro = (data && data.error && data.error.message) || `Erro HTTP ${res.status}`;
    throw new Error(msgErro);
  }
  const texto = (data && data.content && data.content.map(b => b.text || '').join('')) || '(resposta vazia)';
  return texto;
}

const AssistenteIaView = {
  render(container) {
    container.innerHTML = '';
    const cfg = DB.getIaConfig();

    const configBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, '⚙ Configurações');
    const limparBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Limpar conversa');
    const header = el('div', { class: 'view-header' }, [
      el('div', {}, [
        el('h2', {}, 'Assistente de IA'),
        el('div', { style: 'font-size:13px;color:var(--text-muted);margin-top:2px;' }, 'Converse sobre estratégia e dicas para o cronograma dos serviços.'),
      ]),
      el('div', { class: 'view-actions' }, [limparBtn, configBtn]),
    ]);

    const msgsWrap = el('div', { class: 'ia-chat-msgs' });
    const historico = DB.getIaHistorico();
    if (!historico.length) {
      msgsWrap.appendChild(el('div', { class: 'empty-state' },
        'Nenhuma mensagem ainda. Pergunte, por exemplo: "como devo priorizar as obras agendadas essa semana?" ou "tenho algum conflito de agenda entre equipes?".'));
    } else {
      historico.forEach(m => msgsWrap.appendChild(iaCriarBalao(m)));
    }

    limparBtn.addEventListener('click', () => {
      if (!confirmDialog('Limpar todo o histórico dessa conversa?')) return;
      DB.setIaHistorico([]);
      Views.refreshCurrent();
    });
    configBtn.addEventListener('click', () => iaAbrirConfigModal(() => Views.refreshCurrent()));

    const incluirDadosCheck = el('input', { type: 'checkbox' });
    incluirDadosCheck.checked = cfg.incluirDados !== false;
    incluirDadosCheck.addEventListener('change', () => {
      const c = DB.getIaConfig();
      c.incluirDados = incluirDadosCheck.checked;
      DB.setIaConfig(c);
    });

    const textarea = el('textarea', { rows: '2', placeholder: 'Pergunte sobre estratégia, prioridades ou dicas para o cronograma dos serviços...' });
    const enviarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Enviar');

    async function enviar() {
      const texto = textarea.value.trim();
      if (!texto) return;
      const cfgAtual = DB.getIaConfig();
      if (!cfgAtual.apiKey) {
        toast('Configure sua chave de API da Anthropic antes de conversar com o assistente.', 'error');
        iaAbrirConfigModal(() => Views.refreshCurrent());
        return;
      }

      const hist = DB.getIaHistorico();
      hist.push({ role: 'user', texto, data: new Date().toISOString() });
      DB.setIaHistorico(hist);
      textarea.value = '';
      enviarBtn.disabled = true;
      enviarBtn.textContent = 'Enviando...';
      Views.refreshCurrent();

      try {
        const resposta = await iaChamarAPI(hist, cfgAtual, incluirDadosCheck.checked);
        const hist2 = DB.getIaHistorico();
        hist2.push({ role: 'assistant', texto: resposta, data: new Date().toISOString() });
        DB.setIaHistorico(hist2);
      } catch (e) {
        const hist2 = DB.getIaHistorico();
        hist2.push({ role: 'erro', texto: `Não consegui falar com a IA: ${e.message}`, data: new Date().toISOString() });
        DB.setIaHistorico(hist2);
        toast('Erro ao chamar o assistente de IA. Confira a chave de API nas configurações.', 'error');
      } finally {
        Views.refreshCurrent();
      }
    }

    enviarBtn.addEventListener('click', enviar);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
    });

    const inputBar = el('div', { class: 'ia-chat-input' }, [
      field('Incluir dados das obras agendadas no contexto', incluirDadosCheck),
      el('div', { class: 'ia-chat-input-row' }, [textarea, enviarBtn]),
    ]);

    if (!cfg.apiKey) {
      msgsWrap.prepend(el('div', { class: 'ia-aviso-chave' },
        'Nenhuma chave de API configurada ainda. Clique em "Configurações" para colar sua chave da Anthropic e começar a conversar.'));
    }

    const chatBox = el('div', { class: 'ia-chat-box' }, [msgsWrap, inputBar]);
    container.append(header, chatBox);
    msgsWrap.scrollTop = msgsWrap.scrollHeight;
  },
};
