import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  Layers,
  Plus,
  Play,
  Save,
  Trash2,
  RotateCcw,
  Zap,
  Activity,
  Code2,
  Clock,
  AlertTriangle,
  Terminal,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Server
} from 'lucide-react';

interface Endpoint {
  id: string;
  name: string;
  path: string;
  method: string;
  mode: 'dynamic' | 'stateful' | 'static';
  statusCode: number;
  delayMs: number;
  errorRate: number;
  schema: string;
  staticResponse?: string;
  createdAt?: string;
}

interface Stats {
  totalEndpoints: number;
  totalRequests: number;
  simulatedErrors: number;
  avgDelayMs: number;
}

interface Log {
  id: string;
  path: string;
  method: string;
  statusCode: number;
  responseDelay: number;
  isSimulatedError: number;
  timestamp: string;
}

const API_BASE = ''; // Relativo para rodar perfeitamente via proxy ou mesmo host

export function App() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'playground' | 'logs'>('config');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<Stats>({ totalEndpoints: 0, totalRequests: 0, simulatedErrors: 0, avgDelayMs: 0 });
  const [logs, setLogs] = useState<Log[]>([]);

  // Preview state
  const [previewData, setPreviewData] = useState<string>('');
  const [previewCount, setPreviewCount] = useState<number>(1);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Playground state
  const [testMethod, setTestMethod] = useState('GET');
  const [testBody, setTestBody] = useState('{\n  "nome": "Novo Teste"\n}');
  const [testResponse, setTestResponse] = useState<string>('');
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testTime, setTestTime] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Endpoint>>({
    name: '',
    path: '/api/v1/custom',
    method: 'GET',
    mode: 'dynamic',
    statusCode: 200,
    delayMs: 0,
    errorRate: 0,
    schema: JSON.stringify({ id: "uuid", name: "Exemplo", email: "teste@email.com", ativo: true }, null, 2),
    staticResponse: '{\n  "message": "Sucesso"\n}'
  });

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchEndpoints = async () => {
    try {
      const res = await fetch(`${API_BASE}/_admin/endpoints`);
      const data = await res.json();
      setEndpoints(data);
      if (data.length > 0 && !selectedEndpoint) {
        selectEndpointItem(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar endpoints:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/_admin/stats`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Erro estatísticas:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/_admin/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Erro logs:', err);
    }
  };

  useEffect(() => {
    fetchEndpoints();
    fetchStats();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStats();
      fetchLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const selectEndpointItem = (ep: Endpoint) => {
    setSelectedEndpoint(ep);
    setFormData(ep);
    setTestMethod(ep.method === 'ALL' ? 'GET' : ep.method);
    generatePreview(ep.schema);
  };

  const handleCreateNew = () => {
    const newEp: Partial<Endpoint> = {
      name: 'Novo Mock API',
      path: `/api/v1/mock-${Math.floor(Math.random() * 1000)}`,
      method: 'GET',
      mode: 'dynamic',
      statusCode: 200,
      delayMs: 150,
      errorRate: 0,
      schema: JSON.stringify({
        id: "uuid",
        titulo: "Exemplo de Modelo",
        usuario: "Nome do Usuário",
        email: "usuario@dominio.com",
        valor: 150.75,
        ativo: true,
        criadoEm: "2026-08-03T15:00:00.000Z"
      }, null, 2),
      staticResponse: '{\n  "status": "success"\n}'
    };
    setSelectedEndpoint(null);
    setFormData(newEp);
    setActiveTab('config');
    generatePreview(newEp.schema!);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.path || !formData.schema) {
      showNotification('Preencha os campos obrigatórios!');
      return;
    }

    try {
      const method = selectedEndpoint?.id ? 'PUT' : 'POST';
      const url = selectedEndpoint?.id
        ? `${API_BASE}/_admin/endpoints/${selectedEndpoint.id}`
        : `${API_BASE}/_admin/endpoints`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Erro ao salvar endpoint');
      const saved = await res.json();
      
      showNotification(selectedEndpoint?.id ? 'Mock atualizado com sucesso! ⚡' : 'Novo Mock criado com sucesso! 🚀');
      await fetchEndpoints();
      selectEndpointItem(saved);
    } catch (err: any) {
      showNotification(`Erro: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedEndpoint) return;
    if (!confirm(`Deseja realmente apagar o mock "${selectedEndpoint.name}"?`)) return;

    try {
      await fetch(`${API_BASE}/_admin/endpoints/${selectedEndpoint.id}`, { method: 'DELETE' });
      showNotification('Mock removido!');
      setSelectedEndpoint(null);
      await fetchEndpoints();
    } catch (err: any) {
      showNotification(`Erro ao deletar: ${err.message}`);
    }
  };

  const handleResetState = async () => {
    if (!selectedEndpoint) return;
    try {
      await fetch(`${API_BASE}/_admin/endpoints/${selectedEndpoint.id}/reset-state`, { method: 'POST' });
      showNotification('Massa de dados do SQLite resetada com sucesso! 🔄');
    } catch (err: any) {
      showNotification(`Erro ao resetar: ${err.message}`);
    }
  };

  const generatePreview = async (schemaToUse?: string, count: number = previewCount) => {
    setIsLoadingPreview(true);
    try {
      const rawSchema = schemaToUse || formData.schema;
      const res = await fetch(`${API_BASE}/_admin/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: rawSchema, count })
      });
      const data = await res.json();
      setPreviewData(JSON.stringify(data, null, 2));
    } catch (err) {
      setPreviewData('// Erro ao gerar preview do modelo');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const executeTestRequest = async () => {
    if (!formData.path) return;
    setIsTesting(true);
    const startTime = performance.now();
    try {
      const options: RequestInit = {
        method: testMethod,
        headers: { 'Content-Type': 'application/json' }
      };
      if (['POST', 'PUT', 'PATCH'].includes(testMethod)) {
        options.body = testBody;
      }

      const res = await fetch(`${API_BASE}${formData.path}`, options);
      const endTime = performance.now();
      setTestTime(Math.round(endTime - startTime));
      setTestStatus(res.status);

      const resData = await res.json().catch(() => ({ message: 'No JSON body returned' }));
      setTestResponse(JSON.stringify(resData, null, 2));
      fetchStats();
      fetchLogs();
    } catch (err: any) {
      setTestStatus(500);
      setTestResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsTesting(false);
    }
  };

  const filteredEndpoints = endpoints.filter(ep =>
    ep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ep.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-area">
          <div className="logo-icon">
            <Zap size={22} />
          </div>
          <span className="logo-title">MockForge Engine</span>
        </div>

        <div className="stats-bar">
          <div className="stat-pill">
            <Layers size={15} />
            <span>Mocks: <strong>{stats.totalEndpoints}</strong></span>
          </div>
          <div className="stat-pill">
            <Activity size={15} />
            <span>Requisições: <strong>{stats.totalRequests}</strong></span>
          </div>
          <div className="stat-pill">
            <Clock size={15} />
            <span>Latência Média: <strong>{stats.avgDelayMs}ms</strong></span>
          </div>
          <div className="stat-pill">
            <AlertTriangle size={15} style={{ color: stats.simulatedErrors > 0 ? '#EF4444' : undefined }} />
            <span>Erros Simulações: <strong>{stats.simulatedErrors}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar rota ou nome..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={handleCreateNew}>
              <Plus size={18} />
              <span>Novo Mock</span>
            </button>
          </div>

          <div className="endpoint-list">
            {filteredEndpoints.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Nenhum endpoint encontrado.
              </div>
            ) : (
              filteredEndpoints.map((ep) => (
                <div
                  key={ep.id}
                  className={`endpoint-card ${selectedEndpoint?.id === ep.id ? 'active' : ''}`}
                  onClick={() => selectEndpointItem(ep)}
                >
                  <div className="endpoint-card-header">
                    <span className="endpoint-title">{ep.name}</span>
                    <span className={`method-badge ${ep.method.toLowerCase()}`}>
                      {ep.method}
                    </span>
                  </div>
                  <span className="endpoint-path">{ep.path}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span className="mode-badge">
                      {ep.mode === 'dynamic' ? '🎲 Dynamic Faker' : ep.mode === 'stateful' ? '💾 SQLite Stateful' : '📌 Estático'}
                    </span>
                    {ep.delayMs > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>⏱️ {ep.delayMs}ms</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Editor & Content Panel */}
        <main className="editor-section">
          {/* Notification Toast */}
          {notification && (
            <div style={{
              position: 'absolute',
              top: '75px',
              right: '24px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              zIndex: 100,
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={18} />
              {notification}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="tabs-bar">
            <button
              className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
              onClick={() => setActiveTab('config')}
            >
              <Server size={16} /> Configurações
            </button>
            <button
              className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
              onClick={() => setActiveTab('schema')}
            >
              <Code2 size={16} /> Modelo & Faker Schema
            </button>
            <button
              className={`tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
              onClick={() => setActiveTab('playground')}
            >
              <Play size={16} /> Testador (Playground)
            </button>
            <button
              className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Terminal size={16} /> Telemetria & Logs
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
              {selectedEndpoint?.mode === 'stateful' && (
                <button className="btn-secondary" onClick={handleResetState} title="Limpa a tabela SQLite deste endpoint">
                  <RotateCcw size={15} /> Resetar Dados
                </button>
              )}
              {selectedEndpoint && (
                <button className="btn-secondary" onClick={handleDelete} style={{ color: '#EF4444' }}>
                  <Trash2 size={15} /> Apagar
                </button>
              )}
              <button className="btn-primary" onClick={handleSave}>
                <Save size={16} /> Salvar Mock
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="editor-content">
            {/* TAB: CONFIGURAÇÕES */}
            {activeTab === 'config' && (
              <div className="card-panel">
                <h3 className="card-title"><Server size={18} /> Definições da Rota Mock</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Nome do Serviço / Recurso</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: API de Clientes VIP"
                    />
                  </div>

                  <div className="form-group">
                    <label>Caminho (Path URL)</label>
                    <input
                      type="text"
                      className="form-control font-mono"
                      value={formData.path || ''}
                      onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                      placeholder="/api/v1/clientes"
                    />
                  </div>

                  <div className="form-group">
                    <label>Método HTTP</label>
                    <select
                      className="form-control"
                      value={formData.method || 'GET'}
                      onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    >
                      <option value="GET">GET (Listar / Buscar)</option>
                      <option value="POST">POST (Criar)</option>
                      <option value="PUT">PUT (Atualizar)</option>
                      <option value="PATCH">PATCH (Modificar)</option>
                      <option value="DELETE">DELETE (Remover)</option>
                      <option value="ALL">ANY (Todos Métodos)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Modo de Funcionamento</label>
                    <select
                      className="form-control"
                      value={formData.mode || 'dynamic'}
                      onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
                    >
                      <option value="dynamic">🎲 Dynamic Faker (Gera dados novos a cada GET)</option>
                      <option value="stateful">💾 Stateful SQLite (POST salva, GET lista/busca salvos)</option>
                      <option value="static">📌 Estático (Retorna JSON fixo configurado)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Código Status HTTP</label>
                    <select
                      className="form-control"
                      value={formData.statusCode || 200}
                      onChange={(e) => setFormData({ ...formData, statusCode: Number(e.target.value) })}
                    >
                      <option value={200}>200 OK</option>
                      <option value={201}>201 Created</option>
                      <option value={204}>204 No Content</option>
                      <option value={400}>400 Bad Request</option>
                      <option value={401}>401 Unauthorized</option>
                      <option value={404}>404 Not Found</option>
                      <option value={500}>500 Internal Server Error</option>
                    </select>
                  </div>
                </div>

                <hr style={{ borderColor: 'var(--border-color)', margin: '12px 0' }} />

                <h4 className="card-title" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  ⚡ Simulação de Latência e Resiliência (Caos)
                </h4>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Latência / Delay Artificial: <strong>{formData.delayMs || 0} ms</strong></label>
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="50"
                      className="range-slider"
                      value={formData.delayMs || 0}
                      onChange={(e) => setFormData({ ...formData, delayMs: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Taxa de Falha / Instabilidade Simulada: <strong>{formData.errorRate || 0}%</strong></label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      className="range-slider"
                      value={formData.errorRate || 0}
                      onChange={(e) => setFormData({ ...formData, errorRate: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SCHEMA & PREVIEW */}
            {activeTab === 'schema' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: '500px' }}>
                {/* Lado Esquerdo: Editor Monaco do Modelo */}
                <div className="card-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title"><Code2 size={18} /> Modelo / Estrutura da Classe</h3>
                    <button className="btn-secondary" onClick={() => generatePreview(formData.schema)}>
                      <RotateCcw size={14} /> Atualizar Preview
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Cole o modelo da documentação (JSON Exemplo ou Estrutura). O MockForge infere automaticamente os campos (email, cpf, datas, nomes, preços) e gera dados realistas via Faker.
                  </p>
                  <div style={{ flex: 1, minHeight: '400px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      theme="vs-dark"
                      value={formData.schema || ''}
                      onChange={(val) => {
                        setFormData({ ...formData, schema: val || '' });
                      }}
                      options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>

                {/* Lado Direito: Live Preview dos Dados Gerados */}
                <div className="card-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title"><Zap size={18} /> Visualização da Massa de Dados (Preview)</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Qtde:</span>
                      <button className="btn-secondary btn-sm" onClick={() => { setPreviewCount(1); generatePreview(formData.schema, 1); }}>1</button>
                      <button className="btn-secondary btn-sm" onClick={() => { setPreviewCount(5); generatePreview(formData.schema, 5); }}>5</button>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Massa de dados que será devolvida pelo servidor para o aplicativo cliente.
                  </p>
                  <div style={{ flex: 1, minHeight: '400px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      theme="vs-dark"
                      value={previewData}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PLAYGROUND (TESTADOR INTEGRADO) */}
            {activeTab === 'playground' && (
              <div className="card-panel">
                <h3 className="card-title"><Play size={18} /> Testador de API (Playground estilo Postman)</h3>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    className="form-control"
                    style={{ width: '130px', fontWeight: 'bold' }}
                    value={testMethod}
                    onChange={(e) => setTestMethod(e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <input
                    type="text"
                    className="form-control font-mono"
                    style={{ flex: 1 }}
                    value={formData.path || ''}
                    readOnly
                  />

                  <button className="btn-primary" onClick={executeTestRequest} disabled={isTesting}>
                    {isTesting ? 'Enviando...' : 'Disparar Request 🚀'}
                  </button>
                </div>

                {['POST', 'PUT', 'PATCH'].includes(testMethod) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Payload da Requisição (Request Body JSON)</label>
                    <div style={{ height: '160px', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                      <Editor
                        height="100%"
                        defaultLanguage="json"
                        theme="vs-dark"
                        value={testBody}
                        onChange={(v) => setTestBody(v || '')}
                        options={{ minimap: { enabled: false }, fontSize: 13 }}
                      />
                    </div>
                  </div>
                )}

                <hr style={{ borderColor: 'var(--border-color)', margin: '16px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Resposta do Servidor (Response)</h4>
                  {testStatus !== null && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                      <span>Status: <strong style={{ color: testStatus < 300 ? '#10B981' : '#EF4444' }}>{testStatus}</strong></span>
                      <span>Tempo: <strong>{testTime} ms</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ height: '300px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={testResponse || '// Clique em Disparar Request para testar o mock'}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            {/* TAB: LOGS DE REQUISIÇÕES */}
            {activeTab === 'logs' && (
              <div className="card-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title"><Terminal size={18} /> Historico de Chamadas em Tempo Real</h3>
                  <button className="btn-secondary" onClick={fetchLogs}>
                    <RotateCcw size={14} /> Atualizar Logs
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Horário</th>
                        <th>Método</th>
                        <th>Path</th>
                        <th>Status</th>
                        <th>Latência</th>
                        <th>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                            Nenhum log registrado até o momento.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id}>
                            <td className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td><span className={`method-badge ${log.method.toLowerCase()}`}>{log.method}</span></td>
                            <td className="font-mono">{log.path}</td>
                            <td>
                              <span style={{ color: log.statusCode < 300 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                                {log.statusCode}
                              </span>
                            </td>
                            <td>{log.responseDelay}ms</td>
                            <td>
                              {log.isSimulatedError === 1 ? (
                                <span style={{ color: '#EF4444', fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                  ⚠️ Simulated Chaos
                                </span>
                              ) : (
                                <span style={{ color: '#10B981', fontSize: '0.75rem' }}>Success</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
