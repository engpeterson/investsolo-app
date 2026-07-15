/* InvestSolo — camada de dados (localStorage) */

const STORAGE_KEYS = {
  USERS: 'is_users',
  CLIENTES: 'is_clientes',
  OBRAS: 'is_obras',
  CURRENT_USER: 'is_current_user',
  THEME: 'is_theme',
  SEEDED: 'is_seeded_v3',
};

const COLUNAS = [
  { id: 'agendados', label: 'Agendados', cor: '#0A3D91' },
  { id: 'campo', label: 'Campo', cor: '#E8A400' },
  { id: 'relatorio', label: 'Relatório', cor: '#6C3FC5' },
  { id: 'cobrar', label: 'Cobrar', cor: '#C0392B' },
];

const PRIORIDADES = ['Baixa', 'Média', 'Alta'];

const TIPOS_SONDAGEM = ['SPT', 'CPT', 'Rotativa', 'Mista', 'Trado'];

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

  getCurrentUser() { return this._read(STORAGE_KEYS.CURRENT_USER, null); },
  setCurrentUser(u) { this._write(STORAGE_KEYS.CURRENT_USER, u); },
  clearCurrentUser() { localStorage.removeItem(STORAGE_KEYS.CURRENT_USER); },

  getTheme() { return localStorage.getItem(STORAGE_KEYS.THEME) || 'light'; },
  setTheme(t) { localStorage.setItem(STORAGE_KEYS.THEME, t); },
};

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
      cidade: 'São Paulo', estado: 'SP', endereco: 'Av. Paulista, 1000', coordenadas: { lat: -23.5613, lng: -46.6560 },
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 1', quantidadePontos: 8, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, 1), prazoRelatorio: addDaysISO(hoje, 10), status: 'agendados', prioridade: 'Alta',
      etiquetas: ['Urgente', 'Zona Urbana'], valorPrevisto: 12000, dataVencimentoCobranca: addDaysISO(hoje, 30), mensagemEnviada: false,
      observacoes: 'Acesso pela garagem do edifício.',
    },
    {
      nomeObra: 'Sondagem Mista — Galpão Costa', clienteId: clientes[1].id, empresaContratante: clientes[1].empresa,
      cidade: 'Campinas', estado: 'SP', endereco: 'Rua das Indústrias, 250', coordenadas: { lat: -22.9099, lng: -47.0626 },
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 2', quantidadePontos: 15, tipoSondagem: 'Mista',
      dataExecucao: addDaysISO(hoje, 3), prazoRelatorio: addDaysISO(hoje, 14), status: 'agendados', prioridade: 'Média',
      etiquetas: ['Zona Rural'], valorPrevisto: 21000, dataVencimentoCobranca: addDaysISO(hoje, 35), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'CPT — Residencial Tanaka', clienteId: clientes[2].id, empresaContratante: clientes[2].empresa,
      cidade: 'Guarulhos', estado: 'SP', endereco: 'Av. Guarulhos, 500', coordenadas: { lat: -23.4543, lng: -46.5337 },
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 1', quantidadePontos: 6, tipoSondagem: 'CPT',
      dataExecucao: hoje, prazoRelatorio: addDaysISO(hoje, 7), status: 'campo', prioridade: 'Alta',
      etiquetas: ['Acesso Difícil'], valorPrevisto: 9500, dataVencimentoCobranca: addDaysISO(hoje, 25), mensagemEnviada: true,
      observacoes: 'Terreno em aclive, cuidado com o equipamento.',
    },
    {
      nomeObra: 'Sondagem Rotativa — Condomínio Prado', clienteId: clientes[3].id, empresaContratante: clientes[3].empresa,
      cidade: 'Sorocaba', estado: 'SP', endereco: 'Rua Sorocaba, 88', coordenadas: { lat: -23.5015, lng: -47.4526 },
      responsavel: 'João Ferreira', equipeCampo: 'Equipe 2', quantidadePontos: 20, tipoSondagem: 'Rotativa',
      dataExecucao: addDaysISO(hoje, -2), prazoRelatorio: addDaysISO(hoje, 5), status: 'campo', prioridade: 'Média',
      etiquetas: [], valorPrevisto: 28000, dataVencimentoCobranca: addDaysISO(hoje, 20), mensagemEnviada: false,
      observacoes: '',
    },
    {
      nomeObra: 'SPT — Torre Nogueira Fase 2', clienteId: clientes[4].id, empresaContratante: clientes[4].empresa,
      cidade: 'São Bernardo do Campo', estado: 'SP', endereco: 'Av. ABC, 300', coordenadas: { lat: -23.6939, lng: -46.5650 },
      responsavel: 'Ana Paula Souza', equipeCampo: 'Equipe 1', quantidadePontos: 12, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, -6), prazoRelatorio: addDaysISO(hoje, -1), status: 'relatorio', prioridade: 'Alta',
      etiquetas: ['Urgente'], valorPrevisto: 18000, dataVencimentoCobranca: addDaysISO(hoje, 15), mensagemEnviada: true,
      observacoes: 'Relatório atrasado — priorizar.',
    },
    {
      nomeObra: 'Trado — Loteamento Alencar Norte', clienteId: clientes[0].id, empresaContratante: clientes[0].empresa,
      cidade: 'São Paulo', estado: 'SP', endereco: 'Rua Norte, 45', coordenadas: { lat: -23.5300, lng: -46.6200 },
      responsavel: 'Ana Paula Souza', equipeCampo: 'Equipe 2', quantidadePontos: 10, tipoSondagem: 'Trado',
      dataExecucao: addDaysISO(hoje, -10), prazoRelatorio: addDaysISO(hoje, -3), status: 'relatorio', prioridade: 'Baixa',
      etiquetas: [], valorPrevisto: 8000, dataVencimentoCobranca: addDaysISO(hoje, 10), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'Sondagem SPT — Shopping Costa', clienteId: clientes[1].id, empresaContratante: clientes[1].empresa,
      cidade: 'Campinas', estado: 'SP', endereco: 'Av. Shopping, 700', coordenadas: { lat: -22.9200, lng: -47.0700 },
      responsavel: 'Márcia Lima', equipeCampo: 'Equipe 1', quantidadePontos: 25, tipoSondagem: 'SPT',
      dataExecucao: addDaysISO(hoje, -20), prazoRelatorio: addDaysISO(hoje, -12), status: 'cobrar', prioridade: 'Média',
      etiquetas: [], valorPrevisto: 32000, dataVencimentoCobranca: addDaysISO(hoje, -2), mensagemEnviada: true,
      observacoes: '',
    },
    {
      nomeObra: 'CPT — Anexo Tanaka', clienteId: clientes[2].id, empresaContratante: clientes[2].empresa,
      cidade: 'Guarulhos', estado: 'SP', endereco: 'Av. Guarulhos, 520', coordenadas: { lat: -23.4560, lng: -46.5300 },
      responsavel: 'Márcia Lima', equipeCampo: 'Equipe 2', quantidadePontos: 9, tipoSondagem: 'CPT',
      dataExecucao: addDaysISO(hoje, -15), prazoRelatorio: addDaysISO(hoje, -8), status: 'cobrar', prioridade: 'Baixa',
      etiquetas: ['Retrabalho'], valorPrevisto: 11000, dataVencimentoCobranca: addDaysISO(hoje, 3), mensagemEnviada: false,
      observacoes: '',
    },
  ];

  const obras = obrasSeed.map(o => ({
    id: uid('obr'),
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

  localStorage.setItem(STORAGE_KEYS.SEEDED, '1');
}
