import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

async function invokeKB(acao, payload = {}) {
  try {
    const res = await base44.functions.invoke('gerenciarConhecimentoCopilot', { acao, ...payload });
    return res.data;
  } catch (e) {
    const data = e?.response?.data || {};
    const err = new Error(data.error || e?.message || 'Erro na operação.');
    if (data.conflito) {
      err.conflito = true;
      err.conflitante_id = data.conflitante_id;
      err.mensagem = data.mensagem;
    }
    throw err;
  }
}

export function useConhecimentoCopilot(user) {
  const queryClient = useQueryClient();
  const [loadingAcao, setLoadingAcao] = useState(false);

  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  const isPlatformAdmin = user?.role === 'admin';

  const { data: userPerms, isLoading: loadingUserPerms } = useQuery({
    queryKey: ['userTypePermissions', tipoUsuario],
    queryFn: async () => {
      if (!tipoUsuario) return null;
      const perms = await base44.entities.UserTypePermissions.filter({ tipo_usuario: tipoUsuario });
      return perms[0] || null;
    },
    enabled: !!tipoUsuario,
    staleTime: 5 * 60 * 1000,
  });

  const { data: permissoes, isLoading: loadingPerms } = useQuery({
    queryKey: ['copilotPermissao', tipoUsuario],
    queryFn: async () => {
      if (!tipoUsuario) return null;
      const perms = await base44.entities.CopilotPermissao.filter({ tipo_usuario: tipoUsuario });
      return perms[0] || null;
    },
    enabled: !!tipoUsuario,
    staleTime: 5 * 60 * 1000,
  });

  const hasPageAccess = isPlatformAdmin || (userPerms?.paginas_permitidas?.includes('BaseConhecimentoCopilot') ?? false);
  const loadingAccess = loadingUserPerms || loadingPerms;
  const denied = !loadingAccess && (!hasPageAccess || !permissoes);

  const { data: orientacoes = [], isLoading: loadingOrientacoes, error, refetch } = useQuery({
    queryKey: ['copilotOrientacoes'],
    queryFn: async () => {
      const res = await invokeKB('listar');
      return res?.orientacoes || [];
    },
    enabled: !!permissoes?.pode_visualizar && !denied,
    staleTime: 30 * 1000,
  });

  const executarAcao = async (acao, payload) => {
    setLoadingAcao(true);
    try {
      const result = await invokeKB(acao, payload);
      await queryClient.invalidateQueries({ queryKey: ['copilotOrientacoes'] });
      return result;
    } finally {
      setLoadingAcao(false);
    }
  };

  const consultarOrientacao = async (orientacaoId) => {
    const res = await invokeKB('consultar', { orientacao_id: orientacaoId });
    return res?.orientacao || null;
  };

  const carregarHistorico = async (orientacaoId) => {
    const res = await invokeKB('historico', { orientacao_id: orientacaoId });
    return { orientacao: res?.orientacao, versoes: res?.versoes || [] };
  };

  return {
    permissoes,
    loadingAccess,
    denied,
    orientacoes,
    loadingOrientacoes,
    error,
    refetch,
    loadingAcao,
    executarAcao,
    consultarOrientacao,
    carregarHistorico,
  };
}