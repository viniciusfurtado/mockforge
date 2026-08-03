import { FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/database';
import { generateMockFromTemplate, parseUserSchema } from './mockGenerator';
import { randomUUID } from 'crypto';

export async function handleMockRequest(request: FastifyRequest, reply: FastifyReply) {
  const db = await getDb();
  const reqMethod = request.method.toUpperCase();
  const rawPath = request.url.split('?')[0];

  const allEndpoints = await db.all('SELECT * FROM endpoints');

  let matchedEndpoint: any = null;
  let urlParams: Record<string, string> = {};

  for (const ep of allEndpoints) {
    const epPath = ep.path.trim();

    if (epPath === rawPath && (ep.method === 'ALL' || ep.method === reqMethod)) {
      matchedEndpoint = ep;
      break;
    }

    const epPattern = epPath.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)');
    const regex = new RegExp(`^${epPattern}$`);
    const match = rawPath.match(regex);

    if (match && (ep.method === 'ALL' || ep.method === reqMethod || ['GET', 'PUT', 'PATCH', 'DELETE'].includes(reqMethod))) {
      matchedEndpoint = ep;
      const paramNames = (epPath.match(/:[a-zA-Z0-9_]+/g) || []).map((p: string) => p.substring(1));
      paramNames.forEach((name: string, idx: number) => {
        urlParams[name] = match[idx + 1];
      });
      break;
    }
  }

  if (!matchedEndpoint) {
    return reply.status(404).send({
      error: 'Mock Endpoint Not Found',
      message: `Nenhum mock configurado para [${reqMethod}] ${rawPath}. Acesse o painel do MockForge para cadastrar esta rota.`,
      path: rawPath,
      method: reqMethod
    });
  }

  const shouldSimulateError = matchedEndpoint.errorRate > 0 && (Math.random() * 100) < matchedEndpoint.errorRate;

  if (matchedEndpoint.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, matchedEndpoint.delayMs));
  }

  const logId = randomUUID();
  const statusCodeToReturn = shouldSimulateError ? 500 : matchedEndpoint.statusCode;

  await db.run(`
    INSERT INTO request_logs (id, endpointId, path, method, statusCode, responseDelay, isSimulatedError)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [logId, matchedEndpoint.id, rawPath, reqMethod, statusCodeToReturn, matchedEndpoint.delayMs, shouldSimulateError ? 1 : 0]);

  if (shouldSimulateError) {
    return reply.status(500).send({
      error: 'Simulated Server Error (Chaos)',
      message: `Esta falha foi gerada artificialmente devido à taxa de erro configurada (${matchedEndpoint.errorRate}%).`,
      statusCode: 500
    });
  }

  const schemaObj = parseUserSchema(matchedEndpoint.schema);
  let fieldOverrides = {};
  try {
    if (matchedEndpoint.fieldOverrides) {
      fieldOverrides = JSON.parse(matchedEndpoint.fieldOverrides);
    }
  } catch (e) {}

  const resourceId = urlParams.id || urlParams[Object.keys(urlParams)[0]];

  // MODO ESTÁTICO
  if (matchedEndpoint.mode === 'static') {
    let staticBody = {};
    try {
      staticBody = JSON.parse(matchedEndpoint.staticResponse || '{}');
    } catch {
      staticBody = { message: matchedEndpoint.staticResponse || 'Static mock response' };
    }
    return reply.status(matchedEndpoint.statusCode).send(staticBody);
  }

  // MODO DINÂMICO
  if (matchedEndpoint.mode === 'dynamic') {
    const mockData = generateMockFromTemplate(schemaObj, fieldOverrides);
    return reply.status(matchedEndpoint.statusCode).send(mockData);
  }

  // MODO STATEFUL
  if (matchedEndpoint.mode === 'stateful') {
    if (reqMethod === 'POST') {
      const bodyData = (request.body as any) || {};
      const newRecordId = bodyData.id || bodyData.uuid || randomUUID();
      const recordPayload = { id: newRecordId, ...bodyData };

      await db.run(`
        INSERT INTO records (id, endpointId, recordId, data)
        VALUES (?, ?, ?, ?)
      `, [randomUUID(), matchedEndpoint.id, String(newRecordId), JSON.stringify(recordPayload)]);

      return reply.status(201).send(recordPayload);
    }

    if (reqMethod === 'GET' && resourceId) {
      const record = await db.get(`
        SELECT data FROM records WHERE endpointId = ? AND recordId = ?
      `, [matchedEndpoint.id, resourceId]);

      if (!record) {
        return reply.status(404).send({ error: 'Not Found', message: `Registro ID ${resourceId} não encontrado no Mock Stateful.` });
      }
      return reply.status(200).send(JSON.parse(record.data));
    }

    if (reqMethod === 'GET') {
      const records = await db.all(`
        SELECT data FROM records WHERE endpointId = ? ORDER BY createdAt DESC
      `, [matchedEndpoint.id]);

      if (records.length === 0) {
        const initialCount = 5;
        const initialItems: any[] = [];
        for (let i = 0; i < initialCount; i++) {
          const item = generateMockFromTemplate(Array.isArray(schemaObj) ? schemaObj[0] : schemaObj, fieldOverrides);
          if (!item.id) item.id = randomUUID();

          await db.run(`
            INSERT INTO records (id, endpointId, recordId, data)
            VALUES (?, ?, ?, ?)
          `, [randomUUID(), matchedEndpoint.id, String(item.id), JSON.stringify(item)]);

          initialItems.push(item);
        }
        return reply.status(200).send(initialItems);
      }

      const listData = records.map(r => JSON.parse(r.data));
      return reply.status(200).send(listData);
    }

    if ((reqMethod === 'PUT' || reqMethod === 'PATCH') && resourceId) {
      const existing = await db.get(`
        SELECT id, data FROM records WHERE endpointId = ? AND recordId = ?
      `, [matchedEndpoint.id, resourceId]);

      if (!existing) {
        return reply.status(404).send({ error: 'Not Found', message: `Registro ID ${resourceId} não encontrado para atualização.` });
      }

      const currentData = JSON.parse(existing.data);
      const updatedData = { ...currentData, ...(request.body as any) };

      await db.run(`
        UPDATE records SET data = ? WHERE id = ?
      `, [JSON.stringify(updatedData), existing.id]);

      return reply.status(200).send(updatedData);
    }

    if (reqMethod === 'DELETE' && resourceId) {
      const result = await db.run(`
        DELETE FROM records WHERE endpointId = ? AND recordId = ?
      `, [matchedEndpoint.id, resourceId]);

      if (!result.changes || result.changes === 0) {
        return reply.status(404).send({ error: 'Not Found', message: `Registro ID ${resourceId} não encontrado para exclusão.` });
      }

      return reply.status(200).send({ success: true, message: `Registro ID ${resourceId} removido.` });
    }
  }

  return reply.status(matchedEndpoint.statusCode).send(generateMockFromTemplate(schemaObj, fieldOverrides));
}
