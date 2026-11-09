/* InvestSolo — camada de dados (localStorage) */

const STORAGE_KEYS = {
  USERS: 'is_users',
  CLIENTES: 'is_clientes',
  OBRAS: 'is_obras',
  CURRENT_USER: 'is_current_user',
  THEME: 'is_theme',
  SEEDED: 'is_seeded_v3',
  NOTIFS_VISTAS: 'is_notifs_vistas',
  IA_CONFIG: 'is_ia_config',
  IA_HISTORICO: 'is_ia_historico',
  CONFIG_AGENDA: 'is_config_agenda',
  CONTAS_PAGAR: 'is_contas_pagar',
  FINANCAS_PESSOAIS: 'is_financas_pessoais',
  FINANCAS_PESSOAIS_SEEDED: 'is_financas_pessoais_seeded_v1',
};

const COLUNAS = [
  { id: 'agendados', label: 'Agendados', cor: '#0A3D91' },
  { id: 'campo', label: 'Campo', cor: '#E8A400' },
  { id: 'relatorio', label: 'Relatório', cor: '#6C3FC5' },
  { id: 'cobrar', label: 'Cobrar', cor: '#C0392B' },
];

const PRIORIDADES = ['Baixa', 'Média', 'Alta'];

const TIPOS_SONDAGEM = ['SPT', 'CPT', 'Rotativa', 'Mista', 'Trado'];

const CATEGORIAS_CONTA = ['Aluguel', 'Contabilidade', 'Impostos', 'Internet', 'Cartão de Crédito', 'Combustível', 'Manutenção de Equipamentos', 'Outros'];

const CATEGORIAS_FINANCA_PESSOAL = ['Casa', 'Saúde', 'Educação', 'Lazer', 'Cartão Pessoal', 'Mercado', 'Outros'];

const ETIQUETAS_DISPONIVEIS = [
  { nome: 'Urgente', cor: '#C0392B' },
  { nome: 'Zona Rural', cor: '#2E8B57' },
  { nome: 'Zona Urbana', cor: '#2E86C1' },
  { nome: 'Aguardando Cliente', cor: '#E8A400' },
  { nome: 'Retrabalho', cor: '#8E44AD' },
  { nome: 'Acesso Difícil', cor: '#7B241C' },
];

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatMoneyBR(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const DB = {
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Erro lendo storage', key, e);
      return fallback;
    }
  },
  _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  getUsers() { return this._read(STORAGE_KEYS.USERS, []); },
  saveUsers(list) { this._write(STORAGE_KEYS.USERS, list); },
  getUser(id) { return this.getUsers().find(u => u.id === id); },
  upsertUser(user) {
    const list = this.getUsers();
    const idx = list.findIndex(u => u.id === user.id);
    if (idx >= 0) list[idx] = user; else list.push(user);
    this.saveUsers(list);
    return user;
  },
  deleteUser(id) {
    this.saveUsers(this.getUsers().filter(u => u.id !== id));
  },

  getClientes() { return this._read(STORAGE_KEYS.CLIENTES, []); },
  saveClientes(list) { this._write(STORAGE_KEYS.CLIENTES, list); },
  getCliente(id) { return this.getClientes().find(c => c.id === id); },
  upsertCliente(cliente) {
    const list = this.getClientes();
    const idx = list.findIndex(c => c.id === cliente.id);
    if (idx >= 0) list[idx] = cliente; else list.push(cliente);
    this.saveClientes(list);
    return cliente;
  },
  deleteCliente(id) {
    this.saveClientes(this.getClientes().filter(c => c.id !== id));
  },

  getObras() { return this._read(STORAGE_KEYS.OBRAS, []); },
  saveObras(list) { this._write(STORAGE_KEYS.OBRAS, list); },
  getObra(id) { return this.getObras().find(o => o.id === id); },
  upsertObra(obra) {
    const list = this.getObras();
    const idx = list.findIndex(o => o.id === obra.id);
    if (idx >= 0) list[idx] = obra; else list.push(obra);
    this.saveObras(list);
    return obra;
  },
  deleteObra(id) {
    this.saveObras(this.getObras().filter(o => o.id !== id));
  },
  addHistorico(obraId, acao) {
    const obra = this.getObra(obraId);
    if (!obra) return;
    obra.historico = obra.historico || [];
    const user = Auth.getCurrentUser();
    obra.historico.unshift({
      data: new Date().toISOString(),
      usuario: user ? user.nome : 'Sistema',
      acao,
    });
    this.upsertObra(obra);
  },

  // A sessão de login usa sessionStorage (não localStorage) de propósito: ela deve
  // durar só enquanto a janela/aba do navegador estiver aberta. Fechou a janela,
  // a sessão some e a próxima abertura do app volta pra tela de login pedindo senha.
  getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Erro lendo sessão', e);
      return null;
    }
  },
  setCurrentUser(u) { sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(u)); },
  clearCurrentUser() { sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER); },

  getTheme() { return localStorage.getItem(STORAGE_KEYS.THEME) || 'light'; },
  setTheme(t) { localStorage.setItem(STORAGE_KEYS.THEME, t); },

  // Chaves das notificações que o usuário já abriu o sino e viu (zera o número
  // no sininho até aparecer alguma notificação nova que ainda não foi vista).
  getNotifsVistas() { return this._read(STORAGE_KEYS.NOTIFS_VISTAS, []); },
  setNotifsVistas(chaves) { this._write(STORAGE_KEYS.NOTIFS_VISTAS, chaves); },

  // Configuração do Assistente de IA (chave de API etc). Fica só no navegador
  // deste computador — nunca é enviada a nenhum lugar além da própria API de IA.
  getIaConfig() { return this._read(STORAGE_KEYS.IA_CONFIG, { apiKey: '', modelo: 'claude-sonnet-4-5-20250929', incluirDados: true }); },
  setIaConfig(cfg) { this._write(STORAGE_KEYS.IA_CONFIG, cfg); },

  getIaHistorico() { return this._read(STORAGE_KEYS.IA_HISTORICO, []); },
  setIaHistorico(msgs) { this._write(STORAGE_KEYS.IA_HISTORICO, msgs); },

  // Regras de dias de trabalho da Agenda: nunca se trabalha domingo; sábado é
  // opcional e começa desligado (não trabalha) até o usuário ligar na Agenda.
  getConfigAgenda() { return this._read(STORAGE_KEYS.CONFIG_AGENDA, { trabalhaSabado: false }); },
  setConfigAgenda(cfg) { this._write(STORAGE_KEYS.CONFIG_AGENDA, cfg); },

  getContasPagar() { return this._read(STORAGE_KEYS.CONTAS_PAGAR, []); },
  saveContasPagar(list) { this._write(STORAGE_KEYS.CONTAS_PAGAR, list); },
  getConta(id) { return this.getContasPagar().find(c => c.id === id); },
  upsertConta(conta) {
    const list = this.getContasPagar();
    const idx = list.findIndex(c => c.id === conta.id);
    if (idx >= 0) list[idx] = conta; else list.push(conta);
    this.saveContasPagar(list);
    return conta;
  },
  deleteConta(id) {
    this.saveContasPagar(this.getContasPagar().filter(c => c.id !== id));
  },

  // Contas fixas mensais (recorrente: true) não precisam ser recadastradas todo mês:
  // esta função garante que sempre exista um lançamento pendente até o mês atual em
  // cada série (mesma recorrenciaId), gerando a partir do último lançamento conhecido.
  // Compartilhada entre Contas a Pagar (empresa) e Finanças Pessoais, que têm o
  // mesmo formato de lançamento.
  gerarContasRecorrentesDoMes() {
    const contas = this.getContasPagar();
    if (gerarRecorrentesDoMesEmLista(contas, 'cta')) this.saveContasPagar(contas);
  },

  getFinancasPessoais() { return this._read(STORAGE_KEYS.FINANCAS_PESSOAIS, []); },
  saveFinancasPessoais(list) { this._write(STORAGE_KEYS.FINANCAS_PESSOAIS, list); },
  getFinancaPessoal(id) { return this.getFinancasPessoais().find(c => c.id === id); },
  upsertFinancaPessoal(conta) {
    const list = this.getFinancasPessoais();
    const idx = list.findIndex(c => c.id === conta.id);
    if (idx >= 0) list[idx] = conta; else list.push(conta);
    this.saveFinancasPessoais(list);
    return conta;
  },
  deleteFinancaPessoal(id) {
    this.saveFinancasPessoais(this.getFinancasPessoais().filter(c => c.id !== id));
  },
  gerarFinancasPessoaisRecorrentesDoMes() {
    const contas = this.getFinancasPessoais();
    if (gerarRecorrentesDoMesEmLista(contas, 'fp')) this.saveFinancasPessoais(contas);
  },
};

// Função genérica usada tanto por Contas a Pagar quanto por Finanças Pessoais
// (mesmo formato de lançamento: descrição, categoria, valor, vencimento, status,
// recorrente, recorrenciaId). Muta a lista recebida empurrando os lançamentos que
// faltam até o mês atual e devolve true se gerou algo novo.
function gerarRecorrentesDoMesEmLista(lista, prefixoId) {
  const mesAtual = todayISO().slice(0, 7); // "AAAA-MM"
  const ultimaPorSerie = {};
  lista.forEach(c => {
    if (!c.recorrente || !c.recorrenciaId) return;
    if (!ultimaPorSerie[c.recorrenciaId] || c.vencimento > ultimaPorSerie[c.recorrenciaId].vencimento) {
      ultimaPorSerie[c.recorrenciaId] = c;
    }
  });
  let criouAlguma = false;
  Object.values(ultimaPorSerie).forEach(ultima => {
    let refVenc = ultima.vencimento;
    let guarda = 0;
    while (refVenc.slice(0, 7) < mesAtual && guarda < 240) {
      const [ano, mes, dia] = refVenc.split('-').map(Number);
      let proxAno = ano, proxMes = mes + 1;
      if (proxMes > 12) { proxMes = 1; proxAno++; }
      const ultimoDiaProxMes = new Date(proxAno, proxMes, 0).getDate();
      const diaAjustado = Math.min(dia, ultimoDiaProxMes);
      const novoVenc = `${proxAno}-${String(proxMes).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`;
      lista.push({
        id: uid(prefixoId),
        descricao: ultima.descricao,
        categoria: ultima.categoria,
        valor: ultima.valor,
        vencimento: novoVenc,
        status: 'pendente',
        dataPagamento: null,
        recorrente: true,
        recorrenciaId: ultima.recorrenciaId,
      });
      refVenc = novoVenc;
      criouAlguma = true;
      guarda++;
    }
  });
  return criouAlguma;
}

function seedDatabase() {
  if (localStorage.getItem(STORAGE_KEYS.SEEDED)) return;

  const users = [
    { id: uid('usr'), nome: 'Peterson', email: 'engpeterson@outlook.com', perfil: 'Administrador', senha: '1234' },
    { id: uid('usr'), nome: 'Carlos Mendes', email: 'carlos@investsolo.com.br', perfil: 'Administrador', senha: '1234' },
    { id: uid('usr'), nome: 'Ana Paula Souza', email: 'ana@investsolo.com.br', perfil: 'Administrativo', senha: '1234' },
    { id: uid('usr'), nome: 'João Ferreira', email: 'joao@investsolo.com.br', perfil: 'Campo', senha: '1234' },
    { id: uid('usr'), nome: 'Márcia Lima', email: 'marcia@investsolo.com.br', perfil: 'Financeiro', senha: '1234' },
  ];
  DB.saveUsers(users);

  const clientes = [
    { id: uid('cli'), nome: 'Roberto Alencar', empresa: 'Construtora Alencar Ltda', cpfCnpj: '12.345.678/0001-90', whatsapp: '5511987654321', email: 'roberto@alencar.com.br', cidade: 'São Paulo', estado: 'SP', endereco: 'Av. Paulista, 1000', observacoes: 'Cliente antigo, prefere contato pela manhã.' },
    { id: uid('cli'), nome: 'Fernanda Costa', empresa: 'Costa Engenharia', cpfCnpj: '98.765.432/0001-11', whatsapp: '5511976543210', email: 'fernanda@costaeng.com.br', cidade: 'Campinas', estado: 'SP', endereco: 'Rua das Indústrias, 250', observacoes: '' },
    { id: uid('cli'), nome: 'Marcelo Tanaka', empresa: 'Tanaka Incorporadora', cpfCnpj: '45.678.912/0001-33', whatsapp: '5511965432109', email: 'marcelo@tanaka.com.br', cidade: 'Guarulhos', estado: 'SP', endereco: 'Av. Guarulhos, 500', observacoes: 'Sempre pede relatório em PDF e Excel.' },
    { id: uid('cli'), nome: 'Juliana Prado', empresa: 'Prado Construções', cpfCnpj: '32.165.498/0001-77', whatsapp: '5519954321098', email: 'juliana@pradoconstrucoes.com.br', cidade: 'Sorocaba', estado: 'SP', endereco: 'Rua Sorocaba, 88', observacoes: '' },
    { id: uid('cli'), nome: 'Eduardo Nogueira', empresa: 'Nogueira Empreendimentos', cpfCnpj: '65.432.198/0001-22', whatsapp: '5511943210987', email: 'eduardo@nogueira.com.br', cidade: 'São Bernardo do Campo', estado: 'SP', observacoes: 'Obra de grande porte.', endereco: 'Av. ABC, 300' },
  ];
  DB.saveClientes(clientes);

  const hoje = todayISO();
  const obrasSeed = [
    {
      nomeObra: 'Sondagem SPT — Edifício Alencar', clienteId: clientes[0].id, empresaContratante: clientes[0].empresa,
      cidade: 'São Paulo', estado: 'SP', endereco: 'Av. Paulista, 1000',
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 1', quantidadePontos: 8, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, 1), dataTerminoExecucao: addDaysISO(hoje, 3), prazoRelatorio: addDaysISO(hoje, 10), status: 'agendados', prioridade: 'Alta',
      etiquetas: ['Urgente', 'Zona Urbana'], valorPrevisto: 12000, dataVencimentoCobranca: addDaysISO(hoje, 30), mensagemEnviada: false,
      observacoes: 'Acesso pela garagem do edifício.',
    },
    {
      nomeObra: 'Sondagem Mista — Galpão Costa', clienteId: clientes[1].id, empresaContratante: clientes[1].empresa,
      cidade: 'Campinas', estado: 'SP', endereco: 'Rua das Indústrias, 250',
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 2', quantidadePontos: 15, tipoSondagem: 'Mista',
      dataExecucao: addDaysISO(hoje, 3), prazoRelatorio: addDaysISO(hoje, 14), status: 'agendados', prioridade: 'Média',
      etiquetas: ['Zona Rural'], valorPrevisto: 21000, dataVencimentoCobranca: addDaysISO(hoje, 35), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'CPT — Residencial Tanaka', clienteId: clientes[2].id, empresaContratante: clientes[2].empresa,
      cidade: 'Guarulhos', estado: 'SP', endereco: 'Av. Guarulhos, 500',
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 1', quantidadePontos: 6, tipoSondagem: 'CPT',
      dataExecucao: hoje, prazoRelatorio: addDaysISO(hoje, 7), status: 'campo', prioridade: 'Alta',
      etiquetas: ['Acesso Difícil'], valorPrevisto: 9500, dataVencimentoCobranca: addDaysISO(hoje, 25), mensagemEnviada: true,
      observacoes: 'Terreno em aclive, cuidado com o equipamento.',
    },
    {
      nomeObra: 'Sondagem Rotativa — Condomínio Prado', clienteId: clientes[3].id, empresaContratante: clientes[3].empresa,
      cidade: 'Sorocaba', estado: 'SP', endereco: 'Rua Sorocaba, 88',
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 2', quantidadePontos: 20, tipoSondagem: 'Rotativa',
      dataExecucao: addDaysISO(hoje, -2), dataTerminoExecucao: addDaysISO(hoje, 1), prazoRelatorio: addDaysISO(hoje, 5), status: 'campo', prioridade: 'Média',
      etiquetas: [], valorPrevisto: 28000, dataVencimentoCobranca: addDaysISO(hoje, 20), mensagemEnviada: false,
      observacoes: '',
    },
    {
      nomeObra: 'SPT — Torre Nogueira Fase 2', clienteId: clientes[4].id, empresaContratante: clientes[4].empresa,
      cidade: 'São Bernardo do Campo', estado: 'SP', endereco: 'Av. ABC, 300',
      responsavel: 'Ana Paula Souza', equipeCampo: 'Equipe 1', quantidadePontos: 12, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, -6), dataTerminoExecucao: addDaysISO(hoje, -4), prazoRelatorio: addDaysISO(hoje, -1), status: 'relatorio', prioridade: 'Alta',
      etiquetas: ['Urgente'], valorPrevisto: 18000, dataVencimentoCobranca: addDaysISO(hoje, 15), mensagemEnviada: true,
      observacoes: 'Relatório atrasado — priorizar.',
    },
    {
      nomeObra: 'Trado — Loteamento Alencar Norte', clienteId: clientes[0].id, empresaContratante: clientes[0].empresa,
      cidade: 'São Paulo', estado: 'SP', endereco: 'Rua Norte, 45',
      responsavel: 'Ana Paula Souza', equipeCampo: 'Equipe 2', quantidadePontos: 10, tipoSondagem: 'Trado',
      dataExecucao: addDaysISO(hoje, -10), prazoRelatorio: addDaysISO(hoje, -3), status: 'relatorio', prioridade: 'Baixa',
      etiquetas: [], valorPrevisto: 8000, dataVencimentoCobranca: addDaysISO(hoje, 10), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'Sondagem SPT — Shopping Costa', clienteId: clientes[1].id, empresaContratante: clientes[1].empresa,
      cidade: 'Campinas', estado: 'SP', endereco: 'Av. Shopping, 700',
      responsavel: 'Márcia Lima', equipeCampo: 'Equipe 1', quantidadePontos: 25, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, -20), prazoRelatorio: addDaysISO(hoje, -12), status: 'cobrar', prioridade: 'Média',
      etiquetas: [], valorPrevisto: 32000, dataVencimentoCobranca: addDaysISO(hoje, -2), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'CPT — Anexo Tanaka', clienteId: clientes[2].id, empresaContratante: clientes[2].empresa,
      cidade: 'Guarulhos', estado: 'SP', endereco: 'Av. Guarulhos, 520',
      responsavel: 'Márcia Lima', equipeCampo: 'Equipe 2', quantidadePontos: 9, tipoSondagem: 'CPT',
      dataExecucao: addDaysISO(hoje, -15), prazoRelatorio: addDaysISO(hoje, -8), status: 'cobrar', prioridade: 'Baixa',
      etiquetas: ['Retrabalho'], valorPrevisto: 11000, dataVencimentoCobranca: addDaysISO(hoje, 3), mensagemEnviada: false,
      observacoes: '',
    },
  ];

  const obras = obrasSeed.map(o => ({
    id: uid('obr'),
    dataTerminoExecucao: o.dataExecucao, // padrão: serviço de 1 dia só, a menos que a obra abaixo diga outra data
    ...o,
    anexos: [],
    checklist: [
      { item: 'Confirmar acesso ao terreno', done: o.status !== 'agendados' },
      { item: 'Equipamento revisado', done: o.status === 'campo' || o.status === 'relatorio' || o.status === 'cobrar' },
      { item: 'Relatório entregue ao cliente', done: o.status === 'cobrar' },
    ],
    comentarios: [],
    historico: [{ data: new Date().toISOString(), usuario: 'Sistema', acao: 'Obra criada' }],
  }));
  DB.saveObras(obras);

  // Contas fixas mensais (recorrentes), com vencimento neste mês.
  const contasRecorrentesSeed = [
    { descricao: 'Aluguel do galpão', categoria: 'Aluguel', valor: 3200, diaBase: 5 },
    { descricao: 'Honorários contábeis', categoria: 'Contabilidade', valor: 850, diaBase: 10 },
    { descricao: 'Internet e telefonia', categoria: 'Internet', valor: 320, diaBase: 15 },
    { descricao: 'Fatura cartão de crédito PJ', categoria: 'Cartão de Crédito', valor: 4150, diaBase: 20 },
  ];
  const [anoAtual, mesAtual] = hoje.split('-');
  const ultimoDiaMesAtual = new Date(Number(anoAtual), Number(mesAtual), 0).getDate();
  const contasPagar = contasRecorrentesSeed.map(c => {
    const diaAjustado = Math.min(c.diaBase, ultimoDiaMesAtual);
    return {
      id: uid('cta'),
      descricao: c.descricao,
      categoria: c.categoria,
      valor: c.valor,
      vencimento: `${anoAtual}-${mesAtual}-${String(diaAjustado).padStart(2, '0')}`,
      status: 'pendente',
      dataPagamento: null,
      recorrente: true,
      recorrenciaId: uid('rec'),
    };
  });
  // Algumas contas avulsas, pra mostrar variedade: um imposto a vencer, uma já paga e uma atrasada.
  contasPagar.push(
    { id: uid('cta'), descricao: 'DAS — Simples Nacional', categoria: 'Impostos', valor: 1180, vencimento: addDaysISO(hoje, 6), status: 'pendente', dataPagamento: null, recorrente: false, recorrenciaId: null },
    { id: uid('cta'), descricao: 'Troca de óleo — caminhão de apoio', categoria: 'Manutenção de Equipamentos', valor: 640, vencimento: addDaysISO(hoje, -25), status: 'pago', dataPagamento: addDaysISO(hoje, -24), recorrente: false, recorrenciaId: null },
    { id: uid('cta'), descricao: 'Combustível — abastecimento mensal', categoria: 'Combustível', valor: 1450, vencimento: addDaysISO(hoje, -4), status: 'pendente', dataPagamento: null, recorrente: false, recorrenciaId: null },
  );
  DB.saveContasPagar(contasPagar);

  seedFinancasPessoaisSeNecessario();

  localStorage.setItem(STORAGE_KEYS.SEEDED, '1');
}

// Semeadura das Finanças Pessoais, separada do seedDatabase() principal (que só
// roda na primeira vez que o app abre) porque essa área foi adicionada depois.
// Quem já tinha usado o app antes dela existir já está com a flag SEEDED marcada
// e nunca passaria por seedDatabase() de novo — então essa função tem sua própria
// flag e roda de forma independente a cada boot, preenchendo os dados de exemplo
// pra quem ainda não os tem, sem sobrescrever nada que o usuário já tenha criado.
function seedFinancasPessoaisSeNecessario() {
  if (localStorage.getItem(STORAGE_KEYS.FINANCAS_PESSOAIS_SEEDED)) return;

  if (DB.getFinancasPessoais().length === 0) {
    const hoje = todayISO();
    const [anoAtual, mesAtual] = hoje.split('-');
    const ultimoDiaMesAtual = new Date(Number(anoAtual), Number(mesAtual), 0).getDate();

    const financasRecorrentesSeed = [
      { descricao: 'Plano de saúde da família', categoria: 'Saúde', valor: 890, diaBase: 8 },
      { descricao: 'Financiamento do carro', categoria: 'Casa', valor: 1350, diaBase: 12 },
      { descricao: 'Escola dos filhos', categoria: 'Educação', valor: 1600, diaBase: 5 },
    ];
    const financasPessoais = financasRecorrentesSeed.map(c => {
      const diaAjustado = Math.min(c.diaBase, ultimoDiaMesAtual);
      return {
        id: uid('fp'),
        descricao: c.descricao,
        categoria: c.categoria,
        valor: c.valor,
        vencimento: `${anoAtual}-${mesAtual}-${String(diaAjustado).padStart(2, '0')}`,
        status: 'pendente',
        dataPagamento: null,
        recorrente: true,
        recorrenciaId: uid('rec'),
      };
    });
    financasPessoais.push(
      { id: uid('fp'), descricao: 'Supermercado do mês', categoria: 'Mercado', valor: 980, vencimento: addDaysISO(hoje, 2), status: 'pendente', dataPagamento: null, recorrente: false, recorrenciaId: null },
    );
    DB.saveFinancasPessoais(financasPessoais);
  }

  localStorage.setItem(STORAGE_KEYS.FINANCAS_PESSOAIS_SEEDED, '1');
}
