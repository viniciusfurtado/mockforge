import { FastifyInstance } from 'fastify';
import { getDb } from '../db/database';
import { generateMockFromTemplate, parseUserSchema } from '../engine/mockGenerator';
import { randomUUID } from 'crypto';

export async function adminRoutes(fastify: FastifyInstance) {
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
      staticResponse = ''
    } = body;

    if (!name || !path || !schema) {
      return reply.status(400).send({ error: 'Os campos name, path e schema são obrigatórios.' });
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const schemaString = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);

    await db.run(`
      INSERT INTO endpoints (id, name, path, method, mode, statusCode, delayMs, errorRate, schema, staticResponse)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      typeof staticResponse === 'string' ? staticResponse : JSON.stringify(staticResponse)
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
      staticResponse = existing.staticResponse
    } = body;

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const schemaString = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);

    await db.run(`
      UPDATE endpoints
      SET name = ?, path = ?, method = ?, mode = ?, statusCode = ?, delayMs = ?, errorRate = ?, schema = ?, staticResponse = ?, updatedAt = CURRENT_TIMESTAMP
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

  // Resetar estado de um endpoint Stateful
  fastify.post('/_admin/endpoints/:id/reset-state', async (request, reply) => {
    const db = await getDb();
    const { id } = request.params as any;
    await db.run('DELETE FROM records WHERE endpointId = ?', [id]);
    return reply.send({ success: true, message: 'Massa de dados persistida foi resetada com sucesso.' });
  });

  // Preview dinâmico
  fastify.post('/_admin/preview', async (request, reply) => {
    const { schema, count = 1 } = request.body as any;
    if (!schema) return reply.status(400).send({ error: 'O campo schema é obrigatório.' });

    const parsed = parseUserSchema(schema);

    if (Number(count) > 1) {
      const items = Array.from({ length: Number(count) }, () => generateMockFromTemplate(parsed));
      return reply.send(items);
    }

    const mock = generateMockFromTemplate(parsed);
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
  fastify.get('/_admin/logs', async () => {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT 50');
    return logs;
  });
}
