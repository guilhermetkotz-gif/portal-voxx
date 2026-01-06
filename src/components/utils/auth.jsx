// Utility functions for authentication and authorization
import { base44 } from '@/api/base44Client';

export function getUserClienteId(user) {
  return user?.cliente_id || null;
}

export function isVoxxUser(user) {
  return user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_operacao';
}

export function isVoxxAdmin(user) {
  return user?.tipo_usuario === 'voxx_admin';
}

export function isVoxxOperacao(user) {
  return user?.tipo_usuario === 'voxx_operacao';
}

export function isClienteAdmin(user) {
  return user?.tipo_usuario === 'cliente_admin';
}

export function isClienteUsuario(user) {
  return user?.tipo_usuario === 'cliente_usuario';
}

export function canViewAllClientes(user) {
  return isVoxxAdmin(user);
}

export function canViewCliente(user, clienteId) {
  if (isVoxxAdmin(user)) return true;
  if (isVoxxOperacao(user)) {
    return user?.clientes_atribuidos?.includes(clienteId) || false;
  }
  return user?.cliente_id === clienteId;
}

export function getAccessibleClienteIds(user) {
  if (isVoxxAdmin(user)) return 'all';
  if (isVoxxOperacao(user)) return user?.clientes_atribuidos || [];
  return user?.cliente_id ? [user.cliente_id] : [];
}

export function canManageUsers(user) {
  return isVoxxAdmin(user) || isClienteAdmin(user);
}

export function canCreateDemanda(user) {
  return user?.tipo_usuario !== 'cliente_usuario' || true; // configurável
}

export function canEditDemandaStatus(user) {
  return isVoxxUser(user);
}

export async function logAction(action, userId, userEmail, clienteId, details = {}) {
  try {
    await base44.entities.LogAuditoria.create({
      acao: action,
      usuario_id: userId,
      usuario_email: userEmail,
      cliente_id: clienteId,
      entidade: details.entidade || null,
      entidade_id: details.entidade_id || null,
      detalhes: details,
      ip: null, // Browser doesn't have access to IP
      user_agent: navigator?.userAgent || null
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}