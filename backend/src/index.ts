import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { adminRoutes } from './routes/adminRoutes';
import { handleMockRequest } from './engine/routeHandler';
import { getDb } from './db/database';
import { randomUUID } from 'crypto';

const fastify = Fastify({
  logger: true
});

const PORT = Number(process.env.PORT || 3001);

async function bootstrap() {
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  });

  await seedInitialData();

  await fastify.register(adminRoutes);

  const publicPath = path.join(__dirname, '../public');
  if (fs.existsSync(publicPath)) {
    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/'
    });
  }

  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/_admin')) {
      return reply.status(404).send({ error: 'Admin route not found' });
    }

    return handleMockRequest(request, reply);
  });

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 MockForge Server running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function seedInitialData() {
  const db = await getDb();
  const countObj = await db.get('SELECT COUNT(*) as count FROM endpoints');
  if (countObj && countObj.count > 0) return;

  console.log('🌱 Populando mocks de exemplo para primeiros testes...');

  await db.run(`
    INSERT INTO endpoints (id, name, path, method, mode, statusCode, delayMs, errorRate, schema)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    randomUUID(),
    'API de Usuários (Stateful / CRUD)',
    '/api/v1/usuarios',
    'GET',
    'stateful',
    200,
    150,
    0,
    JSON.stringify({
      id: "uuid",
      nome: "João da Silva",
      email: "joao.silva@empresa.com",
      cargo: "Desenvolvedor Full Stack",
      departamento: "Tecnologia",
      salario: 8500.50,
      ativo: true,
      dataAdmissao: "2024-03-15T08:00:00.000Z"
    }, null, 2)
  ]);

  await db.run(`
    INSERT INTO endpoints (id, name, path, method, mode, statusCode, delayMs, errorRate, schema)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    randomUUID(),
    'Catálogo de Produtos (Dinâmico)',
    '/api/v1/produtos',
    'GET',
    'dynamic',
    200,
    300,
    0,
    JSON.stringify([{
      id: "uuid",
      titulo: "Smartphone Galaxy S24 Ultra 512GB",
      categoria: "Eletrônicos",
      preco: 5999.99,
      emEstoque: true,
      imagemUrl: "https://via.placeholder.com/300",
      avaliacoes: 4.8
    }], null, 2)
  ]);

  await db.run(`
    INSERT INTO endpoints (id, name, path, method, mode, statusCode, delayMs, errorRate, schema)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    randomUUID(),
    'Processar Pedido (Simulação de Chaos/Lentidão)',
    '/api/v1/pedidos',
    'POST',
    'dynamic',
    201,
    800,
    15,
    JSON.stringify({
      pedidoId: "uuid",
      status: "APROVADO",
      valorTotal: 450.90,
      mensagem: "Pedido processado com sucesso na gateway.",
      processadoEm: "2026-08-03T15:30:00.000Z"
    }, null, 2)
  ]);
}

bootstrap();
