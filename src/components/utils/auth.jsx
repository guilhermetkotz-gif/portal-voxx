// Utility functions for authentication and authorization
import { base44 } from '@/api/base44Client';

export function getUserClienteId(user) {
  return user?.cliente_id || null;
}

export function isVoxxUser(user) {
  return user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_operacao' || user?.tipo_usuario === 'voxx_manager';
}

export function isVoxxAdmin(user) {
  return user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin';
}

export function isVoxxManager(user) {
  return user?.tipo_usuario === 'voxx_manager';
}

export function isVoxxOperacao(user) {
  return user?.tipo_usuario === 'voxx_operacao' || user?.tipo_usuario === 'voxx_manager';
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

export async function getAccessibleClienteIds(user) {
  if (isVoxxAdmin(user)) return 'all';
  
  if (isVoxxOperacao(user)) {
    return user?.clientes_atribuidos || [];
  }
  
  // For client users, get from UserClientAccess
  try {
    const access = await base44.entities.UserClientAccess.filter({
      usuario_id: user.id,
      status: 'ativo'
    });
    return access.map(a => a.cliente_id);
  } catch (error) {
    console.error('Error fetching user access:', error);
    return [];
  }
}

export function hasAccessToCliente(userAccess, clienteId) {
  if (userAccess === 'all') return true;
  if (!Array.isArray(userAccess)) return false;
  return userAccess.some(a => a.cliente_id === clienteId);
}

export function getAccessLevel(userAccess, clienteId) {
  if (!Array.isArray(userAccess)) return null;
  const access = userAccess.find(a => a.cliente_id === clienteId);
  return access?.nivel_acesso || null;
}

export function canManageUsers(user) {
  return isVoxxAdmin(user) || isVoxxManager(user) || isClienteAdmin(user);
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