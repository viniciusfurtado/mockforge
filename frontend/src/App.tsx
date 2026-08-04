import React, { useState, useEffect, useRef } from 'react';
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
  Server,
  SlidersHorizontal,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
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
  fieldOverrides?: string;
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

interface SchemaField {
  path: string;
  key: string;
  sampleValue: any;
  detectedType: string;
}

const API_BASE = '';

const PRESET_OPTIONS = [
  { value: 'auto', label: '🤖 Auto (Faker Inteligente)' },
  { value: 'cnpj_formatted', label: '🏢 CNPJ Formatado (00.000.000/0001-91)' },
  { value: 'cnpj_numeric', label: '🔢 CNPJ Numérico 14 Dígitos (00000000000191)' },
  { value: 'cpf_formatted', label: '🆔 CPF Formatado (000.000.000-00)' },
  { value: 'cpf_numeric', label: '🔢 CPF Numérico 11 Dígitos (00000000000)' },
  { value: 'numeric_string', label: '🔢 Apenas Números em String (Ex: "123456")' },
  { value: 'alphanumeric_code', label: '🔤 Código Alfanumérico (Ex: "PED123456")' },
  { value: 'uuid', label: '🔑 UUID v4 (Ex: "123e4567-e89b-12d3...")' },
  { value: 'integer', label: '🔢 Número Inteiro (Ex: 1001)' },
  { value: 'float', label: '💲 Número Decimal / Preço (Ex: 150.00)' },
  { value: 'email', label: '✉️ E-mail' },
  { value: 'full_name', label: '👤 Nome Completo' },
  { value: 'company', label: '🏢 Nome de Empresa' },
  { value: 'phone', label: '📞 Telefone' },
  { value: 'date_iso', label: '📅 Data Hora ISO 8601 (2026-08-01T10:00:00Z)' },
  { value: 'date_simple', label: '📅 Data Simples (2026-08-01)' },
  { value: 'boolean', label: '☑️ Boolean (true / false)' }
];

export function App() {

  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const apiFetch = async (url: string, options: any = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      setToken('');
      localStorage.removeItem('token');
    }
    return res;
  };

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'overrides' | 'playground' | 'logs'>('config');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<Stats>({ totalEndpoints: 0, totalRequests: 0, simulatedErrors: 0, avgDelayMs: 0 });
  const [logs, setLogs] = useState<Log[]>([]);

  // UI State: Sidebar Collapsed
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Scroll Ref for Tabs
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Extracted Schema Fields & Overrides
  const [extractedFields, setExtractedFields] = useState<SchemaField[]>([]);
  const [fieldOverridesMap, setFieldOverridesMap] = useState<Record<string, string>>({});

  // Preview state
  const [previewData, setPreviewData] = useState<string>('');
  const [previewCount, setPreviewCount] = useState<number>(1);

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
    schema: JSON.stringify({
      cnpjEmpresa: "00000000000191",
      senhaConexao: "123e4567-e89b-12d3-a456-426614174000",
      numeroPedido: "PED-2026-0001",
      codigoAgenciaAtendimento: 1001,
      codigoPostoAtendimento: 501,
      codigoBdnAtendimento: 9876543,
      dataAtendimento: "2026-08-01T10:00:00.000Z",
      itens: [
        {
          codigoItem: "ITEM-001",
          valorItem: 150.00
        }
      ]
    }, null, 2),
    staticResponse: '{\n  "status": "success"\n}'
  });

  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ msg: string; onConfirm: () => void } | null>(null);

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchEndpoints = async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/_admin/endpoints`);
      if (!res.ok) return;
      const data = await res.json();
      setEndpoints(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !selectedEndpoint) {
        selectEndpointItem(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar endpoints:', err);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/_admin/stats`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Erro estatísticas:', err);
    }
  };

  const fetchLogs = async () => {
    if (!token) return;
    try {
      const res = await apiFetch(`${API_BASE}/_admin/logs`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro logs:', err);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    fetchEndpoints();
    fetchStats();
    fetchLogs();

    const interval = setInterval(() => {
      fetchStats();
      fetchLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [token]);

  const extractSchemaFields = async (schemaText: string, currentOverrides?: Record<string, string>) => {
    try {
      const res = await apiFetch(`${API_BASE}/_admin/extract-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: schemaText })
      });
      if (res.ok) {
        const fields: SchemaField[] = await res.json();
        setExtractedFields(fields);
        if (currentOverrides) {
          setFieldOverridesMap(currentOverrides);
        }
      }
    } catch (err) {
      console.error('Erro ao extrair campos do schema:', err);
    }
  };

  const selectEndpointItem = (ep: Endpoint) => {
    setSelectedEndpoint(ep);
    setFormData(ep);
    setTestMethod(ep.method === 'ALL' ? 'GET' : ep.method);

    let parsedOverrides = {};
    try {
      if (ep.fieldOverrides) parsedOverrides = JSON.parse(ep.fieldOverrides);
    } catch (e) {}

    setFieldOverridesMap(parsedOverrides);
    extractSchemaFields(ep.schema, parsedOverrides);
    generatePreview(ep.schema, previewCount, parsedOverrides);
  };

  const handleCreateNew = () => {
    const newSchema = JSON.stringify({
      id: "uuid",
      titulo: "Exemplo de Modelo",
      usuario: "Nome do Usuário",
      email: "usuario@dominio.com",
      valor: 150.75,
      ativo: true
    }, null, 2);

    const newEp: Partial<Endpoint> = {
      name: 'Novo Mock API',
      path: `/api/v1/mock-${Math.floor(Math.random() * 1000)}`,
      method: 'GET',
      mode: 'dynamic',
      statusCode: 200,
      delayMs: 150,
      errorRate: 0,
      schema: newSchema,
      staticResponse: '{\n  "status": "success"\n}',
      fieldOverrides: '{}'
    };
    setSelectedEndpoint(null);
    setFormData(newEp);
    setFieldOverridesMap({});
    setActiveTab('config');
    extractSchemaFields(newSchema, {});
    generatePreview(newSchema, 1, {});
  };

  const handleSave = async () => {
    if (!formData.name || !formData.path || !formData.schema) {
      showNotification('Preencha os campos obrigatórios!', 'error');
      return;
    }

    try {
      const method = selectedEndpoint?.id ? 'PUT' : 'POST';
      const url = selectedEndpoint?.id
        ? `${API_BASE}/_admin/endpoints/${selectedEndpoint.id}`
        : `${API_BASE}/_admin/endpoints`;

      const payload = {
        ...formData,
        fieldOverrides: JSON.stringify(fieldOverridesMap)
      };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Erro ao salvar endpoint');
      const saved = await res.json();

      showNotification(selectedEndpoint?.id ? 'Mock atualizado com sucesso! ⚡' : 'Novo Mock criado com sucesso! 🚀', 'success');
      await fetchEndpoints();
      selectEndpointItem(saved);
    } catch (err: any) {
      showNotification(`Erro: ${err.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedEndpoint) return;
    setConfirmDialog({
      msg: `Deseja realmente apagar o mock "${selectedEndpoint.name}"?`,
      onConfirm: async () => {
        try {
          await apiFetch(`${API_BASE}/_admin/endpoints/${selectedEndpoint.id}`, { method: 'DELETE' });
          showNotification('Mock removido!', 'success');
          setSelectedEndpoint(null);
          await fetchEndpoints();
        } catch (err: any) {
          showNotification(`Erro ao deletar: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleResetState = async () => {
    if (!selectedEndpoint) return;
    try {
      await apiFetch(`${API_BASE}/_admin/endpoints/${selectedEndpoint.id}/reset-state`, { method: 'POST' });
      showNotification('Massa de dados do SQLite resetada com sucesso! 🔄', 'success');
      fetchEndpoints();
    } catch (err: any) {
      showNotification(`Erro ao resetar: ${err.message}`, 'error');
    }
  };

  const generatePreview = async (schemaToUse?: string, count: number = previewCount, overridesToUse?: Record<string, string>) => {
    try {
      const rawSchema = schemaToUse || formData.schema;
      const rawOverrides = overridesToUse || fieldOverridesMap;
      const res = await apiFetch(`${API_BASE}/_admin/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: rawSchema, count, fieldOverrides: rawOverrides })
      });
      const data = await res.json();
      setPreviewData(JSON.stringify(data, null, 2));
    } catch (err) {
      setPreviewData('// Erro ao gerar preview do modelo');
    }
  };

  const updateFieldOverride = (fieldPath: string, preset: string) => {
    const updated = { ...fieldOverridesMap, [fieldPath]: preset };
    setFieldOverridesMap(updated);
    generatePreview(formData.schema, previewCount, updated);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      tabsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleClearLogs = async () => {
    const epId = selectedEndpoint?.id;
    const confirmMsg = epId
      ? `Deseja realmente limpar os logs do mock "${selectedEndpoint.name}"?`
      : 'Deseja realmente limpar TODOS os logs de telemetria?';

    setConfirmDialog({
      msg: confirmMsg,
      onConfirm: async () => {
        try {
          const url = epId ? `${API_BASE}/_admin/logs?endpointId=${epId}` : `${API_BASE}/_admin/logs`;
          await apiFetch(url, { method: 'DELETE' });
          showNotification('Logs de telemetria limpos com sucesso! 🧹', 'success');
          await fetchLogs();
          await fetchStats();
        } catch (err: any) {
          showNotification(`Erro ao limpar logs: ${err.message}`, 'error');
        }
      }
    });
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

      const res = await apiFetch(`${API_BASE}${formData.path}`, options);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/_admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no login');
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  if (!token) {
    return (
      <div style={{minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#fff', padding: '1rem'}}>
        <div style={{width: '100%', maxWidth: '400px', backgroundColor: '#171717', border: '1px solid #262626', padding: '2rem', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem', justifyContent: 'center'}}>
            <div style={{width: '40px', height: '40px', backgroundColor: '#6366f1', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Layers size={24} />
            </div>
            <h1 style={{fontSize: '1.5rem', fontWeight: 'bold'}}>MockForge</h1>
          </div>
          <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {loginError && (
              <div style={{backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem'}}>
                {loginError}
              </div>
            )}
            <div>
              <label style={{display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px'}}>E-mail</label>
              <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@mockforge.com" style={{width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', boxSizing: 'border-box'}} />
            </div>
            <div>
              <label style={{display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#a3a3a3', textTransform: 'uppercase', marginBottom: '4px'}}>Senha</label>
              <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" style={{width: '100%', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', boxSizing: 'border-box'}} />
            </div>
            <button type="submit" style={{width: '100%', backgroundColor: '#4f46e5', color: '#fff', fontWeight: '500', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
              <Server size={18} /> Entrar no Painel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-area">
          <button
            className="btn-icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expandir lista de mocks" : "Colapsar lista de mocks"}
          >
            {isSidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <div className="logo-icon">
            <Zap size={20} />
          </div>
          <span className="logo-title">MockForge Engine</span>
        </div>

        <div className="stats-bar">
          <div className="stat-pill">
            <Layers size={14} />
            <span>Mocks: <strong>{stats.totalEndpoints}</strong></span>
          </div>
          <div className="stat-pill">
            <Activity size={14} />
            <span>Requisições: <strong>{stats.totalRequests}</strong></span>
          </div>
          <div className="stat-pill">
            <Clock size={14} />
            <span>Latência Média: <strong>{stats.avgDelayMs}ms</strong></span>
          </div>
          <div className="stat-pill">
            <AlertTriangle size={14} style={{ color: stats.simulatedErrors > 0 ? '#EF4444' : undefined }} />
            <span>Erros Simulações: <strong>{stats.simulatedErrors}</strong></span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar Collapsible */}
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Buscar rota ou nome..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={handleCreateNew}>
              <Plus size={16} />
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
              top: '60px',
              right: '24px',
              background: notification.type === 'success' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #EF4444, #B91C1C)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
              zIndex: 100,
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {notification.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              {notification.msg}
            </div>
          )}

          {/* Confirm Dialog */}
          {confirmDialog && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                background: '#171717', border: '1px solid #262626',
                borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#f59e0b' }}>
                  <AlertTriangle size={24} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>Confirmação</h3>
                </div>
                <p style={{ color: '#a3a3a3', marginBottom: '24px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {confirmDialog.msg}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirmDialog(null)} style={{
                    padding: '8px 16px', background: 'transparent', border: '1px solid #404040',
                    color: '#e5e5e5', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
                  }}>Cancelar</button>
                  <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} style={{
                    padding: '8px 16px', background: '#dc2626', border: 'none',
                    color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
                  }}>Confirmar</button>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs Bar with Navigation Arrows */}
          <div className="tabs-container">
            <button className="tab-nav-arrow" onClick={() => scrollTabs('left')} title="Rolar abas para esquerda">
              <ChevronLeft size={16} />
            </button>

            <div className="tabs-scroll-area" ref={tabsScrollRef}>
              <button
                className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
                onClick={() => setActiveTab('config')}
              >
                <Server size={15} /> Configurações
              </button>
              <button
                className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
                onClick={() => setActiveTab('schema')}
              >
                <Code2 size={15} /> Modelo JSON & Schema
              </button>
              <button
                className={`tab-btn ${activeTab === 'overrides' ? 'active' : ''}`}
                onClick={() => setActiveTab('overrides')}
              >
                <SlidersHorizontal size={15} /> Tipagem & Overrides de Campos
              </button>
              <button
                className={`tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
                onClick={() => setActiveTab('playground')}
              >
                <Play size={15} /> Testador (Playground)
              </button>
              <button
                className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <Terminal size={15} /> Telemetria & Logs
              </button>
            </div>

            <button className="tab-nav-arrow" onClick={() => scrollTabs('right')} title="Rolar abas para direita">
              <ChevronRight size={16} />
            </button>

            <div style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}>
              {selectedEndpoint?.mode === 'stateful' && (
                <button className="btn-secondary btn-sm" onClick={handleResetState} title="Limpa a tabela SQLite deste endpoint">
                  <RotateCcw size={13} /> Resetar Dados
                </button>
              )}
              {selectedEndpoint && (
                <button className="btn-secondary btn-sm" onClick={handleDelete} style={{ color: '#EF4444' }}>
                  <Trash2 size={13} /> Apagar
                </button>
              )}
              <button className="btn-primary btn-sm" onClick={handleSave}>
                <Save size={13} /> Salvar Mock
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="editor-content">
            {/* TAB: CONFIGURAÇÕES */}
            {activeTab === 'config' && (
              <div className="card-panel">
                <h3 className="card-title"><Server size={17} /> Definições da Rota Mock</h3>

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

                <hr style={{ borderColor: 'var(--border-color)', margin: '6px 0' }} />

                <h4 className="card-title" style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1, minHeight: '480px' }}>
                {/* Lado Esquerdo: Editor Monaco do Modelo */}
                <div className="card-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title"><Code2 size={17} /> Modelo / Estrutura da Classe</h3>
                    <button className="btn-secondary btn-sm" onClick={() => generatePreview(formData.schema)}>
                      <RotateCcw size={13} /> Atualizar Preview
                    </button>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Cole o modelo da documentação. O MockForge infere os tipos automaticamente.
                  </p>
                  <div style={{ flex: 1, minHeight: '360px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      theme="vs-dark"
                      value={formData.schema || ''}
                      onChange={(val) => {
                        const newSchema = val || '';
                        setFormData({ ...formData, schema: newSchema });
                        extractSchemaFields(newSchema, fieldOverridesMap);
                      }}
                      options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>

                {/* Lado Direito: Live Preview */}
                <div className="card-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title"><Zap size={17} /> Visualização da Massa de Dados (Preview)</h3>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Qtde:</span>
                      <button className="btn-secondary btn-sm" onClick={() => { setPreviewCount(1); generatePreview(formData.schema, 1); }}>1</button>
                      <button className="btn-secondary btn-sm" onClick={() => { setPreviewCount(5); generatePreview(formData.schema, 5); }}>5</button>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Massa de dados que será devolvida pelo servidor para a aplicação cliente.
                  </p>
                  <div style={{ flex: 1, minHeight: '360px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
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

            {/* TAB: OVERRIDES & TIPAGEM DE CAMPOS */}
            {activeTab === 'overrides' && (
              <div className="card-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="card-title"><SlidersHorizontal size={17} /> Mapeador & Ajuste Fino de Tipagem de Campos</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Defina exatamente o formato e gerador de cada campo extraído do seu modelo. (Ex: Altere "cnpjEmpresa" para CNPJ Formatado ou "numeroGtv" para Apenas Números em String).
                    </p>
                  </div>
                  <button className="btn-secondary btn-sm" onClick={() => extractSchemaFields(formData.schema!, fieldOverridesMap)}>
                    <RotateCcw size={13} /> Re-extrair Campos
                  </button>
                </div>

                <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                  <table className="logs-table">
                    <thead>
                      <tr>
                        <th>Caminho do Campo (Field Path)</th>
                        <th>Tipo no Exemplo</th>
                        <th>Gerador / Preset Selecionado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedFields.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                            Nenhum campo estruturado detectado no modelo JSON. Cole uma estrutura válida na aba "Modelo JSON & Schema".
                          </td>
                        </tr>
                      ) : (
                        extractedFields.map((field) => (
                          <tr key={field.path}>
                            <td className="font-mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {field.path}
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                background: 'rgba(51, 65, 85, 0.5)',
                                color: 'var(--accent-cyan)',
                                fontFamily: 'monospace'
                              }}>
                                {field.detectedType}
                              </span>
                            </td>
                            <td>
                              <select
                                className="form-control"
                                style={{ height: '30px', fontSize: '0.78rem' }}
                                value={fieldOverridesMap[field.path] || 'auto'}
                                onChange={(e) => updateFieldOverride(field.path, e.target.value)}
                              >
                                {PRESET_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PLAYGROUND (TESTADOR INTEGRADO) */}
            {activeTab === 'playground' && (
              <div className="card-panel">
                <h3 className="card-title"><Play size={17} /> Testador de API (Playground estilo Postman)</h3>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    className="form-control"
                    style={{ width: '120px', fontWeight: 'bold' }}
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

                  <button className="btn-primary btn-sm" onClick={executeTestRequest} disabled={isTesting}>
                    {isTesting ? 'Enviando...' : 'Disparar Request 🚀'}
                  </button>
                </div>

                {['POST', 'PUT', 'PATCH'].includes(testMethod) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payload da Requisição (Request Body JSON)</label>
                    <div style={{ height: '130px', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
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

                <hr style={{ borderColor: 'var(--border-color)', margin: '10px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Resposta do Servidor (Response)</h4>
                  {testStatus !== null && (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem' }}>
                      <span>Status: <strong style={{ color: testStatus < 300 ? '#10B981' : '#EF4444' }}>{testStatus}</strong></span>
                      <span>Tempo: <strong>{testTime} ms</strong></span>
                    </div>
                  )}
                </div>

                <div style={{ height: '240px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 className="card-title"><Terminal size={17} /> Histórico de Chamadas e Telemetria</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Acompanhe as requisições recebidas pelo Mock Server em tempo real.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      className="form-control font-mono"
                      style={{ height: '30px', fontSize: '0.78rem' }}
                      value={selectedEndpoint?.id || ''}
                      onChange={(e) => {
                        const targetEp = endpoints.find(ep => ep.id === e.target.value);
                        if (targetEp) {
                          selectEndpointItem(targetEp);
                        } else {
                          setSelectedEndpoint(null);
                          fetchLogs();
                        }
                      }}
                    >
                      <option value="">🌐 Todos os Mocks</option>
                      {endpoints.map(ep => (
                        <option key={ep.id} value={ep.id}>
                          {ep.method} {ep.path} ({ep.name})
                        </option>
                      ))}
                    </select>

                    <button className="btn-secondary btn-sm" onClick={fetchLogs}>
                      <RotateCcw size={13} /> Atualizar Logs
                    </button>
                    <button className="btn-secondary btn-sm" onClick={handleClearLogs} style={{ color: '#EF4444' }} title="Limpar histórico de requisições">
                      <Trash2 size={13} /> Limpar Logs
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: '8px' }}>
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
                      {logs.filter(log => !selectedEndpoint?.id || log.endpointId === selectedEndpoint.id).length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                            Nenhum log registrado para este filtro.
                          </td>
                        </tr>
                      ) : (
                        logs
                          .filter(log => !selectedEndpoint?.id || log.endpointId === selectedEndpoint.id)
                          .map((log) => (
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
