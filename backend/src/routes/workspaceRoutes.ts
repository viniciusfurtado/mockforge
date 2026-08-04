import { FastifyInstance } from 'fastify';
import { getDb } from '../db/database';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export async function workspaceRoutes(fastify: FastifyInstance) {
  // Members of a workspace
  fastify.get('/_admin/workspaces/:wsId/members', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const { wsId } = request.params as any;
    
    // Check if user is in workspace
    const membership = await db.get('SELECT role FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, request.user.id]);
    if (!membership && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso negado a este workspace.' });
    }

    const members = await db.all(`
      SELECT u.id, u.name, u.email, wm.role, wm.joinedAt 
      FROM workspace_members wm 
      JOIN users u ON wm.userId = u.id 
      WHERE wm.workspaceId = ?
    `, [wsId]);
    return members;
  });

  // Add member to workspace
  fastify.post('/_admin/workspaces/:wsId/members', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const { wsId } = request.params as any;
    const { email, role = 'member' } = request.body as any;

    const membership = await db.get('SELECT role FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, request.user.id]);
    if ((!membership || membership.role !== 'owner') && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas donos do workspace ou administradores podem adicionar membros.' });
    }

    const user = await db.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado com este e-mail. Cadastre-o primeiro.' });
    }

    const existing = await db.get('SELECT id FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, user.id]);
    if (existing) {
      return reply.status(400).send({ error: 'Usuário já é membro deste workspace.' });
    }

    await db.run('INSERT INTO workspace_members (id, workspaceId, userId, role) VALUES (?, ?, ?, ?)', [randomUUID(), wsId, user.id, role]);
    return reply.send({ success: true, message: 'Membro adicionado com sucesso.' });
  });

  // Remove member from workspace
  fastify.delete('/_admin/workspaces/:wsId/members/:userId', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    const { wsId, userId } = request.params as any;

    const membership = await db.get('SELECT role FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, request.user.id]);
    if ((!membership || membership.role !== 'owner') && request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas donos do workspace podem remover membros.' });
    }

    if (userId === request.user.id && request.user.role !== 'admin') {
       return reply.status(400).send({ error: 'Você não pode remover a si próprio.' });
    }

    const memberToRemove = await db.get('SELECT role FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, userId]);
    if (memberToRemove && memberToRemove.role === 'owner') {
      return reply.status(400).send({ error: 'Não é possível remover o dono do workspace.' });
    }

    await db.run('DELETE FROM workspace_members WHERE workspaceId = ? AND userId = ?', [wsId, userId]);
    return reply.send({ success: true, message: 'Membro removido.' });
  });

  // Admin resets user password
  fastify.put('/_admin/users/:id/password', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply) => {
    const db = await getDb();
    if (request.user.role !== 'admin') {
      return reply.status(403).send({ error: 'Apenas administradores podem redefinir senhas.' });
    }
    const { id } = request.params as any;
    const { newPassword } = request.body as any;

    if (!newPassword || newPassword.length < 6) {
       return reply.status(400).send({ error: 'A senha deve possuir no mínimo 6 caracteres.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, id]);
    return reply.send({ success: true, message: 'Senha do usuário atualizada com sucesso.' });
  });
}
