import React, { useState, useEffect } from 'react';
import { X, Users, Key, Building, Plus, Trash2, Shield } from 'lucide-react';

export function Settings({ user, token, onClose, apiFetch, showNotification, setConfirmDialog }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [workspaces, setWorkspaces] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Profile
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Workspace
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [selectedWs, setSelectedWs] = useState(null);
  const [wsMembers, setWsMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');

  // User Mgmt
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  useEffect(() => {
    fetchWorkspaces();
    if (user.role === 'admin') fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedWs) fetchWsMembers(selectedWs.id);
  }, [selectedWs]);

  const fetchWorkspaces = async () => {
    try {
      const res = await apiFetch('/_admin/workspaces');
      if (res.ok) setWorkspaces(await res.json());
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/_admin/users');
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };

  const fetchWsMembers = async (wsId) => {
    try {
      const res = await apiFetch(`/_admin/workspaces/${wsId}/members`);
      if (res.ok) setWsMembers(await res.json());
    } catch (e) {}
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/_admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        showNotification('Senha alterada com sucesso!', 'success');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const d = await res.json();
        showNotification(`Erro: ${d.error}`, 'error');
      }
    } catch (e) {
      showNotification('Erro na requisição', 'error');
    }
  };

  const handleCreateWs = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/_admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsName, description: wsDesc })
      });
      if (res.ok) {
        showNotification('Workspace criado!', 'success');
        fetchWorkspaces();
        setWsName('');
        setWsDesc('');
      } else {
        const d = await res.json();
        showNotification(`Erro: ${d.error}`, 'error');
      }
    } catch (e) {}
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/_admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName, email: newUserEmail, password: newUserPassword, role: newUserRole })
      });
      if (res.ok) {
        showNotification('Usuário criado!', 'success');
        fetchUsers();
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
      } else {
        const d = await res.json();
        showNotification(`Erro: ${d.error}`, 'error');
      }
    } catch (e) {}
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!selectedWs) return;
    try {
      const res = await apiFetch(`/_admin/workspaces/${selectedWs.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: 'member' })
      });
      if (res.ok) {
        showNotification('Membro adicionado!', 'success');
        fetchWsMembers(selectedWs.id);
        setInviteEmail('');
      } else {
        const d = await res.json();
        showNotification(`Erro: ${d.error}`, 'error');
      }
    } catch (e) {}
  };

  const handleDeleteUser = (id) => {
    setConfirmDialog({
      msg: 'Deseja realmente remover este usuário?',
      onConfirm: async () => {
        const res = await apiFetch(`/_admin/users/${id}`, { method: 'DELETE' });
        if (res.ok) fetchUsers();
        else showNotification('Erro ao excluir', 'error');
      }
    });
  };

  const handleRemoveMember = (userId) => {
    setConfirmDialog({
      msg: 'Remover este membro do workspace?',
      onConfirm: async () => {
        const res = await apiFetch(`/_admin/workspaces/${selectedWs.id}/members/${userId}`, { method: 'DELETE' });
        if (res.ok) fetchWsMembers(selectedWs.id);
        else {
          const d = await res.json();
          showNotification(`Erro: ${d.error}`, 'error');
        }
      }
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px', width: '100%', maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #262626' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: '#6366f1' }}/>
            Configurações de Acesso
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <div style={{ width: '250px', borderRight: '1px solid #262626', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setActiveTab('profile')} style={{ background: activeTab === 'profile' ? '#262626' : 'transparent', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} /> Meu Perfil
            </button>
            <button onClick={() => setActiveTab('workspaces')} style={{ background: activeTab === 'workspaces' ? '#262626' : 'transparent', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} /> Workspaces
            </button>
            {user.role === 'admin' && (
              <button onClick={() => setActiveTab('users')} style={{ background: activeTab === 'users' ? '#262626' : 'transparent', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} /> Usuários (Admin)
              </button>
            )}
          </div>

          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
            
            {activeTab === 'profile' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Alterar Senha</h3>
                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                  <input type="password" placeholder="Senha Atual" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                  <input type="password" placeholder="Nova Senha (min. 6)" required value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                  <button type="submit" style={{ padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Atualizar Senha</button>
                </form>
              </div>
            )}

            {activeTab === 'workspaces' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Meus Workspaces</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                  {workspaces.map(w => (
                    <div key={w.id} onClick={() => setSelectedWs(w)} style={{ padding: '1rem', background: selectedWs?.id === w.id ? '#3730a3' : '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', cursor: 'pointer', flex: '1 1 200px' }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>{w.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: '#a3a3a3' }}>Papel: {w.memberRole}</span>
                    </div>
                  ))}
                </div>

                {selectedWs && (
                  <div>
                    <h4 style={{ marginBottom: '1rem' }}>Membros de {selectedWs.name}</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #262626' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Nome</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Papel</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wsMembers.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #262626' }}>
                            <td style={{ padding: '8px' }}>{m.name}</td>
                            <td style={{ padding: '8px' }}>{m.email}</td>
                            <td style={{ padding: '8px' }}>{m.role}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button onClick={() => handleRemoveMember(m.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <h4 style={{ marginBottom: '1rem' }}>Adicionar Membro</h4>
                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: '1rem' }}>
                      <input type="email" placeholder="Email do usuário já cadastrado..." required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1, padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                      <button type="submit" style={{ padding: '10px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', gap: '8px' }}><Plus size={18}/> Adicionar</button>
                    </form>
                  </div>
                )}
                
                {!selectedWs && (
                  <div>
                    <h4 style={{ marginBottom: '1rem', marginTop: '2rem' }}>Criar Novo Workspace</h4>
                    <form onSubmit={handleCreateWs} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                      <input type="text" placeholder="Nome do Workspace" required value={wsName} onChange={e => setWsName(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                      <input type="text" placeholder="Descrição (Opcional)" value={wsDesc} onChange={e => setWsDesc(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                      <button type="submit" style={{ padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Criar Workspace</button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && user.role === 'admin' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Gestão de Usuários Globais</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #262626' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Nome</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Perfil</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #262626' }}>
                        <td style={{ padding: '8px' }}>{u.name}</td>
                        <td style={{ padding: '8px' }}>{u.email}</td>
                        <td style={{ padding: '8px' }}>{u.role}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {u.id !== user.id && (
                            <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ marginBottom: '1rem' }}>Cadastrar Novo Usuário</h4>
                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                  <input type="text" placeholder="Nome Completo" required value={newUserName} onChange={e => setNewUserName(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                  <input type="email" placeholder="Email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                  <input type="password" placeholder="Senha Temporária" required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }} />
                  <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} style={{ padding: '10px', background: '#0a0a0a', border: '1px solid #262626', color: '#fff', borderRadius: '6px' }}>
                    <option value="user">Usuário Padrão</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <button type="submit" style={{ padding: '10px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Criar Usuário</button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
