import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database';
import { generateMockFromTemplate, parseUserSchema, extractFieldsFromSchema } from '../engine/mockGenerator';
import { randomUUID } from 'crypto';

export async function adminRoutes(fastify: FastifyInstance) {
  // 🔑 1. Autenticação & Gestão de Perfil
  fastify.post('/_admin/auth/login', async (request, reply) => {
    const db = await getDb();
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return reply.status(401).send({ error: 'Credenciais inválidas.' });
    }

    const workspaces = await db.all(`
      SELECT w.*, wm.role as memberRole
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspaceId
      WHERE wm.userId = ?
      ORDER BY w.createdAt ASC
    `, [user.id]);

    const token = (fastify as any).jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }, { expiresIn: '7d' });

    return reply.send({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      workspaces
    });
  });

  fastify.get('/_admin/auth/me', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const user = await db.get('SELECT id, name, email, role, createdAt FROM users WHERE id = ?', [request.user.id]);
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado.' });

    const workspaces = await db.all(`
      SELECT w.*, wm.role as memberRole
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspaceId
      WHERE wm.userId = ?
      ORDER BY w.createdAt ASC
    `, [user.id]);

    return reply.send({ user, workspaces });
  });

  fastify.post('/_admin/auth/change-password', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const { currentPassword, newPassword } = request.body as any;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return reply.status(400).send({ error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [request.user.id]);
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return reply.status(400).send({ error: 'Senha atual incorreta.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, request.user.id]);

    return reply.send({ success: true, message: 'Senha alterada com sucesso.' });
  });

  // 👥 2. Gestão de Usuários (Apenas Admin)
  fastify.get('/_admin/users', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso negado. Requer perfil de Administrador.' });
    }

    const users = await db.all('SELECT id, name, email, role, createdAt FROM users ORDER BY createdAt DESC');
    return users;
  });

  fastify.post('/_admin/users', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso negado. Requer perfil de Administrador.' });
    }

    const { name, email, password, role = 'user' } = request.body as any;
    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return reply.status(400).send({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const userId = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(`
      INSERT INTO users (id, name, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, name, email.trim().toLowerCase(), hashedPassword, role]);

    const defaultWs = await db.get('SELECT id FROM workspaces ORDER BY createdAt ASC LIMIT 1');
    if (defaultWs) {
      await db.run(`
        INSERT OR IGNORE INTO workspace_members (id, workspaceId, userId, role)
        VALUES (?, ?, ?, ?)
      `, [randomUUID(), defaultWs.id, userId, 'member']);
    }

    const created = await db.get('SELECT id, name, email, role, createdAt FROM users WHERE id = ?', [userId]);
    return reply.status(201).send(created);
  });

  fastify.delete('/_admin/users/:id', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso negado. Requer perfil de Administrador.' });
    }

    const { id } = request.params as any;
    if (id === request.user.id) {
      return reply.status(400).send({ error: 'Não é possível remover o próprio usuário conectado.' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    return reply.send({ success: true, message: 'Usuário removido.' });
  });

  // 🏢 3. Gestão de Workspaces
  fastify.get('/_admin/workspaces', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const workspaces = await db.all(`
      SELECT w.*, wm.role as memberRole
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspaceId
      WHERE wm.userId = ?
      ORDER BY w.createdAt ASC
    `, [request.user.id]);
    return workspaces;
  });

  fastify.post('/_admin/workspaces', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const { name, description } = request.body as any;
    if (!name) return reply.status(400).send({ error: 'O nome do workspace é obrigatório.' });

    const wsId = randomUUID();
    await db.run(`
      INSERT INTO workspaces (id, name, description, ownerId)
      VALUES (?, ?, ?, ?)
    `, [wsId, name, description || '', request.user.id]);

    await db.run(`
      INSERT INTO workspace_members (id, workspaceId, userId, role)
      VALUES (?, ?, ?, ?)
    `, [randomUUID(), wsId, request.user.id, 'owner']);

    const created = await db.get('SELECT * FROM workspaces WHERE id = ?', [wsId]);
    return reply.status(201).send(created);
  });
  // Listar todos os endpoints
  fastify.get('/_admin/endpoints', async () => {
    const db = await getDb();
    const endpoints = await db.all('SELECT * FROM endpoints ORDER BY createdAt DESC');
    return endpoints;
  });

  // Buscar 1 endpoint por ID
  fastify.get('/_admin/endpoints/:id', async (request, reply) => {
    const db = await getDb();
    const { id } = request.params as any;
    const ep = await db.get('SELECT * FROM endpoints WHERE id = ?', [id]);
    if (!ep) return reply.status(404).send({ error: 'Endpoint not found' });
    return ep;
  });

  // Criar novo endpoint mockado
  fastify.post('/_admin/endpoints', async (request, reply) => {
    const db = await getDb();
    const body = request.body as any;
    const id = randomUUID();
    const {
      name,
      path,
      method = 'GET',
      mode = 'dynamic',
      statusCode = 200,
      delayMs = 0,
      errorRate = 0,
      schema,
      staticResponse = '',
      fieldOverrides = {}
    } = body;

    if (!name || !path || !schema) {
      return reply.status(400).send({ error: 'Os campos name, path e schema são obrigatórios.' });
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const schemaString = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
    const overridesString = typeof fieldOverrides === 'string' ? fieldOverrides : JSON.stringify(fieldOverrides);

    await db.run(`
      INSERT INTO endpoints (id, name, path, method, mode, statusCode, delayMs, errorRate, schema, staticResponse, fieldOverrides)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      name,
      normalizedPath,
      method.toUpperCase(),
      mode,
      Number(statusCode),
      Number(delayMs),
      Number(errorRate),
      schemaString,
      typeof staticResponse === 'string' ? staticResponse : JSON.stringify(staticResponse),
      overridesString
    ]);

    const created = await db.get('SELECT * FROM endpoints WHERE id = ?', [id]);
    return reply.status(201).send(created);
  });

  // Atualizar endpoint
  fastify.put('/_admin/endpoints/:id', async (request, reply) => {
    const db = await getDb();
    const { id } = request.params as any;
    const body = request.body as any;

    const existing = await db.get('SELECT * FROM endpoints WHERE id = ?', [id]);
    if (!existing) return reply.status(404).send({ error: 'Endpoint não encontrado.' });

    const {
      name = existing.name,
      path = existing.path,
      method = existing.method,
      mode = existing.mode,
      statusCode = existing.statusCode,
      delayMs = existing.delayMs,
      errorRate = existing.errorRate,
      schema = existing.schema,
      staticResponse = existing.staticResponse,
      fieldOverrides = existing.fieldOverrides
    } = body;

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const schemaString = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);
    const overridesString = typeof fieldOverrides === 'string' ? fieldOverrides : JSON.stringify(fieldOverrides);

    await db.run(`
      UPDATE endpoints
      SET name = ?, path = ?, method = ?, mode = ?, statusCode = ?, delayMs = ?, errorRate = ?, schema = ?, staticResponse = ?, fieldOverrides = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name,
      normalizedPath,
      method.toUpperCase(),
      mode,
      Number(statusCode),
      Number(delayMs),
      Number(errorRate),
      schemaString,
      typeof staticResponse === 'string' ? staticResponse : JSON.stringify(staticResponse),
      overridesString,
      id
    ]);

    const updated = await db.get('SELECT * FROM endpoints WHERE id = ?', [id]);
    return reply.send(updated);
  });

  // Deletar endpoint
  fastify.delete('/_admin/endpoints/:id', async (request, reply) => {
    const db = await getDb();
    const { id } = request.params as any;
    await db.run('DELETE FROM endpoints WHERE id = ?', [id]);
    await db.run('DELETE FROM records WHERE endpointId = ?', [id]);
    return reply.send({ success: true, message: 'Endpoint removido.' });
  });

  // Extrair campos do Schema
  fastify.post('/_admin/extract-fields', async (request, reply) => {
    const { schema } = request.body as any;
    if (!schema) return reply.status(400).send({ error: 'O campo schema é obrigatório.' });

    const parsed = parseUserSchema(schema);
    const fields = extractFieldsFromSchema(parsed);
    return reply.send(fields);
  });

  // Resetar estado de um endpoint Stateful
  fastify.post('/_admin/endpoints/:id/reset-state', async (request, reply) => {
    const db = await getDb();
    const { id } = request.params as any;
    await db.run('DELETE FROM records WHERE endpointId = ?', [id]);
    return reply.send({ success: true, message: 'Massa de dados persistida foi resetada com sucesso.' });
  });

  // Preview dinâmico
  fastify.post('/_admin/preview', async (request, reply) => {
    const { schema, count = 1, fieldOverrides = {} } = request.body as any;
    if (!schema) return reply.status(400).send({ error: 'O campo schema é obrigatório.' });

    const parsed = parseUserSchema(schema);

    if (Number(count) > 1) {
      const items = Array.from({ length: Number(count) }, () => generateMockFromTemplate(parsed, fieldOverrides));
      return reply.send(items);
    }

    const mock = generateMockFromTemplate(parsed, fieldOverrides);
    return reply.send(mock);
  });

  // Stats
  fastify.get('/_admin/stats', async () => {
    const db = await getDb();
    const totalEndpoints = (await db.get('SELECT COUNT(*) as count FROM endpoints')).count;
    const totalRequests = (await db.get('SELECT COUNT(*) as count FROM request_logs')).count;
    const simulatedErrors = (await db.get('SELECT COUNT(*) as count FROM request_logs WHERE isSimulatedError = 1')).count;
    const avgObj = await db.get('SELECT AVG(responseDelay) as avg FROM request_logs');
    const avgDelay = avgObj ? avgObj.avg : 0;

    return {
      totalEndpoints,
      totalRequests,
      simulatedErrors,
      avgDelayMs: Math.round(avgDelay || 0)
    };
  });

  // Logs
  fastify.get('/_admin/logs', async (request, reply) => {
    const db = await getDb();
    const { endpointId } = request.query as any;

    if (endpointId) {
      const logs = await db.all('SELECT * FROM request_logs WHERE endpointId = ? ORDER BY timestamp DESC LIMIT 50', [endpointId]);
      return logs;
    }

    const logs = await db.all('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT 50');
    return logs;
  });

  // Limpar Logs
  fastify.delete('/_admin/logs', async (request, reply) => {
    const db = await getDb();
    const { endpointId } = request.query as any;

    if (endpointId) {
      await db.run('DELETE FROM request_logs WHERE endpointId = ?', [endpointId]);
      return reply.send({ success: true, message: 'Logs do endpoint limpos com sucesso.' });
    }

    await db.run('DELETE FROM request_logs');
    return reply.send({ success: true, message: 'Todos os logs de telemetria foram limpos.' });
  });
}
