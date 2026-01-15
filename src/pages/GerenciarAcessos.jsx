import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Shield, 
  UserCheck, 
  Clock,
  FileText,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EditarAcessoUsuario from '@/components/admin/EditarAcessoUsuario';
import AprovarSolicitacao from '@/components/admin/AprovarSolicitacao';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function GerenciarAcessos({ user }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);

  const { data: usuarios = [], refetch: refetchUsuarios } = useQuery({
    queryKey: ['todosUsuarios'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000
  });

  const { data: solicitacoes = [], refetch: refetchSolicitacoes } = useQuery({
    queryKey: ['solicitacoesAcesso'],
    queryFn: () => base44.entities.AccessRequest.filter({ status: 'pendente' }, '-created_date', 100),
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000
  });

  const { data: acessos = [] } = useQuery({
    queryKey: ['todosAcessos'],
    queryFn: () => base44.entities.UserClientAccess.list('-created_date', 1000),
    staleTime: 30 * 1000
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.LogAuditoria.filter({ 
      acao: { $in: ['ASSIGN_ACCESS', 'REVOKE_ACCESS', 'APPROVE_REQUEST', 'REJECT_REQUEST'] }
    }, '-created_date', 100),
    staleTime: 60 * 1000
  });

  const filteredUsuarios = usuarios.filter(u => 
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())) &&
    u.status !== 'excluido'
  );

  const getUsuarioAcessos = (usuarioId) => {
    return acessos.filter(a => a.usuario_id === usuarioId && a.status === 'ativo');
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      // Delete user access records
      const userAccess = await base44.entities.UserClientAccess.filter({ usuario_id: userId });
      for (const access of userAccess) {
        await base44.entities.UserClientAccess.delete(access.id);
      }

      // Delete access requests
      const accessRequests = await base44.entities.AccessRequest.filter({ usuario_id: userId });
      for (const request of accessRequests) {
        await base44.entities.AccessRequest.delete(request.id);
      }

      // Delete user notifications
      const userToDelete = usuarios.find(u => u.id === userId);
      if (userToDelete?.email) {
        const notifications = await base44.entities.Notificacao.filter({ user_email: userToDelete.email });
        for (const notif of notifications) {
          await base44.entities.Notificacao.delete(notif.id);
        }
      }

      // Mark user as deleted
      await base44.entities.User.update(userId, {
        status: 'excluido',
        tipo_usuario: 'excluido'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['todosUsuarios']);
      queryClient.invalidateQueries(['todosAcessos']);
      queryClient.invalidateQueries(['solicitacoesAcesso']);
      setDeleteUserId(null);
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir usuário: ' + error.message);
    }
  });

  const statusColors = {
    pendente: 'bg-amber-100 text-amber-700',
    ativo: 'bg-emerald-100 text-emerald-700',
    inativo: 'bg-slate-100 text-slate-600',
    bloqueado: 'bg-red-100 text-red-700'
  };

  const tipoUsuarioLabels = {
    voxx_admin: 'Voxx Admin',
    voxx_manager: 'Voxx Manager',
    cliente_admin: 'Cliente Admin',
    cliente_usuario: 'Cliente Usuário'
  };

  if (!user || (user.role !== 'admin' && user.tipo_usuario !== 'voxx_admin' && user.tipo_usuario !== 'voxx_manager')) {
    return (
      <Card className="p-8 text-center">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-slate-500 mt-2">Você não tem permissão para acessar esta área.</p>
      </Card>
    );
  }

  if (selectedUser) {
    return (
      <EditarAcessoUsuario 
        usuario={selectedUser}
        acessos={getUsuarioAcessos(selectedUser.id)}
        onClose={() => setSelectedUser(null)}
        currentUser={user}
      />
    );
  }

  if (selectedRequest) {
    return (
      <AprovarSolicitacao
        solicitacao={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        currentUser={user}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gerenciar Acessos</h1>
        <p className="text-slate-500 mt-1">Controle de quais contas cada usuário pode acessar</p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Buscar por nome, email ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => {
          refetchUsuarios();
          refetchSolicitacoes();
        }}>
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usuarios">
            <UserCheck className="w-4 h-4 mr-2" />
            Usuários ({filteredUsuarios.length})
          </TabsTrigger>
          <TabsTrigger value="solicitacoes">
            <Clock className="w-4 h-4 mr-2" />
            Solicitações ({solicitacoes.length})
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <FileText className="w-4 h-4 mr-2" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* Aba Usuários */}
        <TabsContent value="usuarios" className="space-y-4">
          {filteredUsuarios.map(usuario => {
            const acessosUsuario = getUsuarioAcessos(usuario.id);
            return (
              <Card key={usuario.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{usuario.full_name || 'Sem nome'}</h3>
                      <Badge className={statusColors[usuario.status || 'pendente']}>
                        {usuario.status || 'pendente'}
                      </Badge>
                      <Badge variant="outline">
                        {tipoUsuarioLabels[usuario.tipo_usuario] || usuario.tipo_usuario}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{usuario.email}</p>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>{acessosUsuario.length} conta(s) atribuída(s)</span>
                      {usuario.ultimo_acesso && (
                        <span>Último acesso: {formatDistanceToNow(new Date(usuario.ultimo_acesso), { addSuffix: true, locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedUser(usuario)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar Acesso
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteUserId(usuario.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {filteredUsuarios.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-slate-500">Nenhum usuário encontrado</p>
            </Card>
          )}
        </TabsContent>

        {/* Aba Solicitações */}
        <TabsContent value="solicitacoes" className="space-y-4">
          {solicitacoes.map(solicitacao => (
            <Card key={solicitacao.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{solicitacao.usuario_nome}</h3>
                    <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">{solicitacao.usuario_email}</p>
                  <div className="text-sm text-slate-700 mb-2">
                    <strong>Contas solicitadas:</strong> {solicitacao.contas_solicitadas_nomes?.join(', ') || 'N/A'}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <strong>Motivo:</strong> {solicitacao.motivo}
                  </div>
                  <p className="text-xs text-slate-400">
                    Solicitado {formatDistanceToNow(new Date(solicitacao.created_date), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedRequest(solicitacao)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Analisar
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {solicitacoes.length === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-500">Nenhuma solicitação pendente</p>
            </Card>
          )}
        </TabsContent>

        {/* Aba Auditoria */}
        <TabsContent value="auditoria" className="space-y-4">
          {logs.map(log => {
            const actionIcons = {
              ASSIGN_ACCESS: <CheckCircle className="w-4 h-4 text-emerald-600" />,
              REVOKE_ACCESS: <XCircle className="w-4 h-4 text-red-600" />,
              APPROVE_REQUEST: <CheckCircle className="w-4 h-4 text-blue-600" />,
              REJECT_REQUEST: <XCircle className="w-4 h-4 text-amber-600" />
            };

            const actionLabels = {
              ASSIGN_ACCESS: 'Acesso Atribuído',
              REVOKE_ACCESS: 'Acesso Revogado',
              APPROVE_REQUEST: 'Solicitação Aprovada',
              REJECT_REQUEST: 'Solicitação Rejeitada'
            };

            return (
              <Card key={log.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {actionIcons[log.acao] || <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{actionLabels[log.acao] || log.acao}</span>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(log.created_date), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Por: <strong>{log.usuario_email}</strong>
                    </p>
                    {log.detalhes && (
                      <pre className="text-xs bg-slate-50 p-2 rounded mt-2 text-slate-600">
                        {JSON.stringify(log.detalhes, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {logs.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-slate-500">Nenhum log de auditoria</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação irá remover todos os acessos, solicitações e notificações associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate(deleteUserId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}