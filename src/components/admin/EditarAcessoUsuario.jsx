import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Plus, 
  Trash2,
  Shield,
  Building2,
  CheckCircle,
  XCircle,
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function EditarAcessoUsuario({ usuario, acessos, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [nivelAcesso, setNivelAcesso] = useState('viewer');
  const [searchCliente, setSearchCliente] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState(usuario.tipo_usuario || 'cliente_usuario');
  const [statusUsuario, setStatusUsuario] = useState(usuario.status || 'pendente');

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 60 * 1000
  });

  const atribuirAcesso = useMutation({
    mutationFn: async ({ clienteIds, nivel }) => {
      const results = [];
      for (const clienteId of clienteIds) {
        const cliente = clientes.find(c => c.id === clienteId);
        const acesso = await base44.entities.UserClientAccess.create({
          usuario_id: usuario.id,
          usuario_email: usuario.email,
          cliente_id: clienteId,
          cliente_nome: cliente?.nome,
          nivel_acesso: nivel,
          status: 'ativo',
          data_atribuicao: new Date().toISOString(),
          atribuido_por_usuario_id: currentUser.id,
          atribuido_por_nome: currentUser.full_name
        });
        results.push(acesso);
      }

      // Get all active client accesses for this user
      const allUserAccesses = await base44.entities.UserClientAccess.filter({
        usuario_id: usuario.id,
        status: 'ativo'
      });
      const activeClientIds = allUserAccesses.map(a => a.cliente_id);

      // Update user with clientes_atribuidos and status
      await base44.entities.User.update(usuario.id, { 
        status: 'ativo',
        clientes_atribuidos: activeClientIds
      });

      // Log action
      await base44.entities.LogAuditoria.create({
        acao: 'ASSIGN_ACCESS',
        usuario_id: currentUser.id,
        usuario_email: currentUser.email,
        entidade: 'UserClientAccess',
        detalhes: {
          usuario_afetado: usuario.email,
          clientes: clienteIds,
          nivel_acesso: nivel
        }
      });

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosAcessos'] });
      queryClient.invalidateQueries({ queryKey: ['todosUsuarios'] });
      toast.success('Acesso atribuído com sucesso');
      setSelectedClientes([]);
    }
  });

  const revogarAcesso = useMutation({
    mutationFn: async (acessoId) => {
      await base44.entities.UserClientAccess.update(acessoId, {
        status: 'revogado',
        data_revogacao: new Date().toISOString(),
        revogado_por_usuario_id: currentUser.id
      });

      // Update user's clientes_atribuidos
      const allUserAccesses = await base44.entities.UserClientAccess.filter({
        usuario_id: usuario.id,
        status: 'ativo'
      });
      const activeClientIds = allUserAccesses.map(a => a.cliente_id);
      
      await base44.entities.User.update(usuario.id, {
        clientes_atribuidos: activeClientIds
      });

      await base44.entities.LogAuditoria.create({
        acao: 'REVOKE_ACCESS',
        usuario_id: currentUser.id,
        usuario_email: currentUser.email,
        entidade: 'UserClientAccess',
        entidade_id: acessoId,
        detalhes: {
          usuario_afetado: usuario.email
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosAcessos'] });
      toast.success('Acesso revogado');
    }
  });

  const alterarNivel = useMutation({
    mutationFn: async ({ acessoId, novoNivel }) => {
      await base44.entities.UserClientAccess.update(acessoId, {
        nivel_acesso: novoNivel
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosAcessos'] });
      toast.success('Nível de acesso atualizado');
    }
  });

  const atualizarTipoUsuario = useMutation({
    mutationFn: async (novoTipo) => {
      await base44.entities.User.update(usuario.id, {
        tipo_usuario: novoTipo
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosUsuarios'] });
      toast.success('Tipo de usuário atualizado');
    }
  });

  const atualizarStatusUsuario = useMutation({
    mutationFn: async (novoStatus) => {
      await base44.entities.User.update(usuario.id, {
        status: novoStatus
      });

      // Log action
      await base44.entities.LogAuditoria.create({
        acao: 'UPDATE_USER_STATUS',
        usuario_id: currentUser.id,
        usuario_email: currentUser.email,
        entidade: 'User',
        entidade_id: usuario.id,
        detalhes: {
          usuario_afetado: usuario.email,
          status_anterior: usuario.status,
          status_novo: novoStatus
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosUsuarios'] });
      toast.success('Status do usuário atualizado');
    }
  });

  const clientesNaoAtribuidos = clientes.filter(c => !acessos.some(a => a.cliente_id === c.id));
  
  const clientesDisponiveis = clientesNaoAtribuidos.filter(c => 
    c.nome?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.estado?.toLowerCase().includes(searchCliente.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Editar Acesso</h1>
          <p className="text-slate-500">{usuario.full_name} ({usuario.email})</p>
        </div>
      </div>

      {/* User Info */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Informações do Usuário</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Email</p>
              <p className="font-medium">{usuario.email}</p>
            </div>
            {usuario.cargo && (
              <div>
                <p className="text-slate-500 mb-1">Cargo</p>
                <p className="font-medium">{usuario.cargo}</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Status do Usuário</label>
              <Select 
                value={statusUsuario} 
                onValueChange={(v) => {
                  setStatusUsuario(v);
                  atualizarStatusUsuario.mutate(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de Usuário no Sistema</label>
              <Select 
                value={tipoUsuario} 
                onValueChange={(v) => {
                  setTipoUsuario(v);
                  atualizarTipoUsuario.mutate(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voxx_admin">voxx_admin</SelectItem>
                  <SelectItem value="voxx_manager">voxx_manager</SelectItem>
                  <SelectItem value="voxx_operacao">voxx_operacao</SelectItem>
                  <SelectItem value="cliente_admin">cliente_admin</SelectItem>
                  <SelectItem value="cliente_usuario">cliente_usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Acessos Atuais */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Contas Atribuídas ({acessos.length})</h3>
        
        {acessos.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>Nenhuma conta atribuída</p>
          </div>
        ) : (
          <div className="space-y-3">
            {acessos.map(acesso => (
              <div key={acesso.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">{acesso.cliente_nome}</p>
                    <p className="text-xs text-slate-500">
                      Atribuído {formatDistanceToNow(new Date(acesso.data_atribuicao), { addSuffix: true, locale: ptBR })}
                      {acesso.atribuido_por_nome && ` por ${acesso.atribuido_por_nome}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={acesso.nivel_acesso} 
                    onValueChange={(v) => alterarNivel.mutate({ acessoId: acesso.id, novoNivel: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => revogarAcesso.mutate(acesso.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Atribuir Nova Conta */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Atribuir Novo Acesso</h3>
        
        {clientesNaoAtribuidos.length === 0 ? (
          <p className="text-sm text-slate-500">Todas as contas já foram atribuídas</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Buscar Cliente</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, cidade ou estado..."
                  value={searchCliente}
                  onChange={(e) => setSearchCliente(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                <span>Selecionar Clientes</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedClientes.length === clientesDisponiveis.length) {
                      setSelectedClientes([]);
                    } else {
                      setSelectedClientes(clientesDisponiveis.map(c => c.id));
                    }
                  }}
                  className="h-7 text-xs"
                >
                  {selectedClientes.length === clientesDisponiveis.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </Button>
              </label>
              
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {clientesDisponiveis.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">Nenhum cliente encontrado</div>
                ) : (
                  <div className="divide-y">
                    {clientesDisponiveis.map(cliente => {
                      const isSelected = selectedClientes.includes(cliente.id);
                      return (
                        <div
                          key={cliente.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedClientes(selectedClientes.filter(id => id !== cliente.id));
                            } else {
                              setSelectedClientes([...selectedClientes, cliente.id]);
                            }
                          }}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-violet-600 flex-shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{cliente.nome}</p>
                            <p className="text-xs text-slate-500">{cliente.cidade}, {cliente.estado}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedClientes.length > 0 && (
                <div className="mt-2 text-sm text-slate-600">
                  {selectedClientes.length} cliente(s) selecionado(s)
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Nível de Acesso</label>
              <Select value={nivelAcesso} onValueChange={setNivelAcesso}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (apenas visualizar)</SelectItem>
                  <SelectItem value="editor">Editor (pode criar demandas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => atribuirAcesso.mutate({ clienteIds: selectedClientes, nivel: nivelAcesso })}
              disabled={selectedClientes.length === 0 || atribuirAcesso.isPending}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Atribuir Acesso
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}