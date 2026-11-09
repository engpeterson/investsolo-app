/* InvestSolo — autenticação mock (login local, sem backend) */

const PERFIS = ['Administrador', 'Administrativo', 'Campo', 'Financeiro'];

const PERMISSOES = {
  Administrador: ['dashboard', 'agenda', 'clientes', 'obras', 'relatorios', 'usuarios', 'ia', 'contas-pagar'],
  Administrativo: ['dashboard', 'agenda', 'clientes', 'obras', 'relatorios', 'ia'],
  Campo: ['dashboard', 'agenda', 'obras'],
  Financeiro: ['dashboard', 'clientes', 'obras', 'relatorios', 'ia', 'contas-pagar'],
};

const Auth = {
  getCurrentUser() { return DB.getCurrentUser(); },

  login(userId, senha) {
    const user = DB.getUsers().find(u => u.id === userId);
    if (!user) return { ok: false, msg: 'Usuário não encontrado.' };
    if (user.senha !== senha) return { ok: false, msg: 'Senha incorreta.' };
    DB.setCurrentUser({ id: user.id, nome: user.nome, email: user.email, perfil: user.perfil });
    return { ok: true };
  },

  logout() {
    DB.clearCurrentUser();
  },

  can(secao) {
    const user = this.getCurrentUser();
    if (!user) return false;
    return (PERMISSOES[user.perfil] || []).includes(secao);
  },
};

// Restrição específica: só o usuário "Peterson" (administrador/dono) enxerga valores financeiros previstos.
function isPeterson(user) {
  return !!user && (user.nome || '').trim().toLowerCase() === 'peterson';
}
