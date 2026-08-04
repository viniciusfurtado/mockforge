import React, { useState, useEffect } from 'react';
import { X, Users, Key, Building, Plus, Trash2, Shield } from 'lucide-react';

export function Settings({ user, token, onClose, apiFetch, showNotification, setConfirmDialog, onWorkspacesChange }) {
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
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/_admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const fetchWsMembers = async (wsId) => {
    try {
      const res = await apiFetch(`/_admin/workspaces/${wsId}/members`);
      if (res.ok) {
        const data = await res.json();
        setWsMembers(Array.isArray(data) ? data : []);
      }
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
        if (onWorkspacesChange) onWorkspacesChange();
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

  const handleDeleteWorkspace = () => {
    setConfirmDialog({
      msg: 'Aviso: Isso excluirá o Workspace e todos os seus endpoints de forma permanente. Deseja continuar?',
      onConfirm: async () => {
        const res = await apiFetch(`/_admin/workspaces/${selectedWs.id}`, { method: 'DELETE' });
        if (res.ok) {
          showNotification('Workspace excluído com sucesso!', 'success');
          setSelectedWs(null);
          fetchWorkspaces();
          if (onWorkspacesChange) onWorkspacesChange();
        } else {
          const d = await res.json();
          showNotification(`Erro: ${d.error}`, 'error');
        }
      }
    });
  };

  const handleApiKey = async (action) => {
    const res = await apiFetch(`/_admin/workspaces/${selectedWs.id}/apikey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (res.ok) {
      const data = await res.json();
      showNotification(action === 'revoke' ? 'Chave de API removida. Workspace agora é público.' : 'Nova Chave de API gerada com sucesso!', 'success');
      setSelectedWs({ ...selectedWs, apiKey: data.apiKey });
      fetchWorkspaces(); // Update list to reflect changes
    } else {
      const d = await res.json();
      showNotification(`Erro: ${d.error}`, 'error');
    }
  };

  const tabButtonStyle = (isActive) => ({
    background: isActive ? 'var(--bg-card-hover)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: isActive ? 600 : 500,
    transition: 'all 0.2s'
  });

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '900px', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Shield size={20} style={{ color: 'var(--primary)' }}/>
            Configurações de Acesso
          </h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-main)' }}>
            <button onClick={() => setActiveTab('profile')} style={tabButtonStyle(activeTab === 'profile')}>
              <Key size={18} /> Meu Perfil
            </button>
            <button data-tab="workspaces" onClick={() => setActiveTab('workspaces')} style={tabButtonStyle(activeTab === 'workspaces')}>
              <Building size={18} /> Workspaces
            </button>
            {user.role === 'admin' && (
              <button onClick={() => setActiveTab('users')} style={tabButtonStyle(activeTab === 'users')}>
                <Users size={18} /> Usuários (Admin)
              </button>
            )}
          </div>

          <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: 'var(--bg-main)' }}>
            
            {activeTab === 'profile' && (
              <div className="card-panel">
                <h3 className="card-title" style={{ marginBottom: '1rem' }}>Alterar Senha</h3>
                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Senha Atual</label>
                      <input id="current-password" name="currentPassword" className="form-control" type="password" placeholder="Sua senha atual..." required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Nova Senha</label>
                      <input id="new-password" name="newPassword" className="form-control" type="password" placeholder="Nova senha (min. 6 caracteres)" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: 'fit-content' }}>Atualizar Senha</button>
                </form>
              </div>
            )}

            {activeTab === 'workspaces' && (
              <div>
                <h3 className="card-title" style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Meus Workspaces</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                  {workspaces.map(w => (
                    <div 
                      key={w.id} 
                      onClick={() => setSelectedWs(w)} 
                      style={{ 
                        padding: '1rem', 
                        background: selectedWs?.id === w.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)', 
                        border: '1px solid',
                        borderColor: selectedWs?.id === w.id ? 'var(--primary)' : 'var(--border-color)', 
                        borderRadius: 'var(--radius-md)', 
                        cursor: 'pointer', 
                        flex: '1 1 200px',
                        transition: 'all 0.2s',
                        boxShadow: selectedWs?.id === w.id ? '0 0 0 1px var(--primary)' : 'none'
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '1rem' }}>{w.name}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Papel: {w.memberRole}</span>
                    </div>
                  ))}
                </div>

                {selectedWs && (
                  <div className="card-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h4 className="card-title" style={{ margin: 0 }}>Gerenciar: {selectedWs.name}</h4>
                      {(selectedWs.memberRole === 'owner' || user.role === 'admin') && (
                        <button onClick={handleDeleteWorkspace} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--method-delete)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <Trash2 size={14} /> Excluir Workspace
                        </button>
                      )}
                    </div>

                    {(selectedWs.memberRole === 'owner' || user.role === 'admin') && (
                      <div style={{ padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                          <Key size={16} style={{ color: 'var(--primary)' }}/>
                          Segurança da API
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                          Se uma Chave de API for gerada, todos os endpoints deste workspace exigirão autenticação (via cabeçalho <code>X-Api-Key</code> ou <code>Authorization: Bearer</code>).
                        </p>
                        
                        {selectedWs.apiKey ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <input type="text" readOnly value={selectedWs.apiKey} className="form-control" style={{ flex: 1, fontFamily: 'monospace', color: 'var(--primary)' }} />
                              <button onClick={() => { navigator.clipboard.writeText(selectedWs.apiKey); showNotification('Chave copiada!', 'success'); }} className="btn-primary">Copiar</button>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                              <button onClick={() => handleApiKey('generate')} className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>Gerar Nova Chave</button>
                              <button onClick={() => setConfirmDialog({ msg: 'Remover a chave tornará todos os endpoints deste workspace públicos. Deseja continuar?', onConfirm: () => handleApiKey('revoke') })} style={{ background: 'transparent', border: '1px solid var(--method-delete)', color: 'var(--method-delete)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>Remover / Tornar Público</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => handleApiKey('generate')} className="btn-primary" style={{ width: 'fit-content' }}>Proteger Workspace com Chave de API</button>
                        )}
                      </div>
                    )}

                    <h4 className="card-title" style={{ marginBottom: '1rem' }}>Membros</h4>
                    <table className="logs-table" style={{ marginBottom: '2rem' }}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Papel</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wsMembers.map(m => (
                          <tr key={m.id}>
                            <td>{m.name}</td>
                            <td>{m.email}</td>
                            <td><span className="mode-badge">{m.role}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button onClick={() => handleRemoveMember(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--method-delete)', cursor: 'pointer', padding: '4px' }}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {wsMembers.length === 0 && (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Nenhum membro encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>

                    <h4 className="card-title" style={{ marginBottom: '1rem' }}>Adicionar Membro</h4>
                    <form onSubmit={handleInvite} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Email do Usuário</label>
                        <input id="invite-email" name="inviteEmail" className="form-control" type="email" placeholder="usuário já cadastrado..." required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                      </div>
                      <button type="submit" className="btn-primary" style={{ height: '34px' }}><Plus size={16}/> Adicionar</button>
                    </form>
                  </div>
                )}
                
                {!selectedWs && (
                  <div className="card-panel" style={{ marginTop: '2rem' }}>
                    <h4 className="card-title" style={{ marginBottom: '1rem' }}>Criar Novo Workspace</h4>
                    <form onSubmit={handleCreateWs} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Nome do Workspace</label>
                          <input id="ws-name" name="wsName" className="form-control" type="text" placeholder="Ex: Projeto X" required value={wsName} onChange={e => setWsName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Descrição (Opcional)</label>
                          <input id="ws-desc" name="wsDesc" className="form-control" type="text" placeholder="Descrição rápida..." value={wsDesc} onChange={e => setWsDesc(e.target.value)} />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: 'fit-content' }}>Criar Workspace</button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && user.role === 'admin' && (
              <div>
                <h3 className="card-title" style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Gestão de Usuários Globais</h3>
                
                <div className="card-panel" style={{ marginBottom: '2rem' }}>
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Perfil</th>
                        <th style={{ textAlign: 'right' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td><span className="mode-badge">{u.role}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            {u.id !== user.id && (
                              <button onClick={() => handleDeleteUser(u.id)} style={{ background: 'transparent', border: 'none', color: 'var(--method-delete)', cursor: 'pointer', padding: '4px' }}>
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card-panel">
                  <h4 className="card-title" style={{ marginBottom: '1rem' }}>Cadastrar Novo Usuário</h4>
                  <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Nome Completo</label>
                        <input id="new-user-name" name="newUserName" className="form-control" type="text" placeholder="Fulano Silva" required value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input id="new-user-email" name="newUserEmail" className="form-control" type="email" placeholder="fulano@email.com" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Senha Temporária</label>
                        <input id="new-user-password" name="newUserPassword" className="form-control" type="password" placeholder="Mínimo 6 caracteres" required value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Nível de Acesso</label>
                        <select id="new-user-role" name="newUserRole" className="form-control" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                          <option value="user">Usuário Padrão</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', width: 'fit-content' }}>Criar Usuário</button>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
