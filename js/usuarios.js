/* InvestSolo — Configuração de Usuários (criar usuário, definir senha, permissões) */

function openUsuarioModal(userId) {
  const isNew = !userId;
  const original = isNew
    ? { id: null, nome: '', email: '', perfil: 'Administrativo', senha: '' }
    : DB.getUser(userId);
  if (!original) { toast('Usuário não encontrado.', 'error'); return; }
  const u = { ...original };

  const refs = {
    nome: el('input', { type: 'text', value: u.nome, required: '' }),
    email: el('input', { type: 'email', value: u.email }),
    perfil: el('select', {}, PERFIS.map(p => el('option', { value: p }, p))),
    senha: el('input', { type: 'text', value: '', placeholder: isNew ? 'Defina uma senha' : 'Deixe em branco para manter a atual' }),
  };
  refs.perfil.value = u.perfil;

  const body = el('div', { class: 'form-grid' }, [
    field('Nome', refs.nome),
    field('Email', refs.email),
    field('Perfil', refs.perfil),
    field('Senha', refs.senha, 'col-2'),
  ]);

  const currentUser = Auth.getCurrentUser();
  const excluirBtn = el('button', { class: 'btn btn-danger', type: 'button' }, 'Excluir');
  excluirBtn.style.marginRight = 'auto';
  excluirBtn.addEventListener('click', () => {
    if (currentUser && currentUser.id === userId) { toast('Você não pode excluir o usuário com o qual está logado.', 'error'); return; }
    const admins = DB.getUsers().filter(x => x.perfil === 'Administrador');
    if (u.perfil === 'Administrador' && admins.length <= 1) { toast('Não é possível excluir o único administrador do sistema.', 'error'); return; }
    if (!confirmDialog('Excluir este usuário?')) return;
    DB.deleteUser(userId);
    closeModal();
    toast('Usuário excluído.', 'success');
    Views.refreshCurrent();
  });

  const cancelarBtn = el('button', { class: 'btn btn-ghost', type: 'button', onclick: closeModal }, 'Cancelar');
  const salvarBtn = el('button', { class: 'btn btn-primary', type: 'button' }, isNew ? 'Criar usuário' : 'Salvar alterações');
  salvarBtn.addEventListener('click', () => {
    if (!refs.nome.value.trim()) { toast('Informe o nome do usuário.', 'error'); return; }
    if (isNew && !refs.senha.value.trim()) { toast('Defina uma senha para o novo usuário.', 'error'); return; }
    const atualizado = {
      id: userId || uid('usr'),
      nome: refs.nome.value.trim(),
      email: refs.email.value.trim(),
      perfil: refs.perfil.value,
      senha: refs.senha.value.trim() || u.senha,
    };
    DB.upsertUser(atualizado);
    if (currentUser && currentUser.id === atualizado.id) {
      DB.setCurrentUser({ id: atualizado.id, nome: atualizado.nome, email: atualizado.email, perfil: atualizado.perfil });
      document.getElementById('user-nome').textContent = atualizado.nome;
      document.getElementById('user-perfil').textContent = atualizado.perfil;
      document.getElementById('user-avatar').textContent = iniciais(atualizado.nome);
    }
    closeModal();
    toast(isNew ? 'Usuário criado.' : 'Alterações salvas.', 'success');
    Views.refreshCurrent();
  });

  openModal({
    title: isNew ? 'Novo usuário' : u.nome,
    body,
    foot: isNew ? [cancelarBtn, salvarBtn] : [excluirBtn, cancelarBtn, salvarBtn],
    size: 'sm',
  });
}

const UsuariosView = {
  render(container) {
    container.innerHTML = '';
    const novoBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo usuário');
    novoBtn.addEventListener('click', () => openUsuarioModal(null));
    const header = el('div', { class: 'view-header' }, [el('h2', {}, 'Usuários'), el('div', { class: 'view-actions' }, [novoBtn])]);

    const tableWrap = el('div', { class: 'table-wrap' });
    const users = DB.getUsers();
    if (!users.length) {
      tableWrap.appendChild(el('div', { class: 'empty-state' }, 'Nenhum usuário cadastrado.'));
    } else {
      const rows = users.map(u => {
        const editBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Editar');
        editBtn.addEventListener('click', () => openUsuarioModal(u.id));
        return el('tr', {}, [
          el('td', {}, u.nome),
          el('td', {}, u.email || '—'),
          el('td', {}, u.perfil),
          el('td', { class: 'table-actions' }, [editBtn]),
        ]);
      });
      const table = el('table', { class: 'data-table' }, [
        el('thead', {}, el('tr', {}, ['Nome', 'Email', 'Perfil', 'Ações'].map(h => el('th', {}, h)))),
        el('tbody', {}, rows),
      ]);
      tableWrap.appendChild(table);
    }

    container.append(header, tableWrap);
  },
};
