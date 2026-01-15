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
  Search
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function EditarAcessoUsuario({ usuario, acessos, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [nivelAcesso, setNivelAcesso] = useState('viewer');
  const [searchCliente, setSearchCliente] = useState('');

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

  const clientesDisponiveis = clientes
    .filter(c => !acessos.some(a => a.cliente_id === c.id))
    .filter(c => 
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
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Informações do Usuário</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Email:</strong> {usuario.email}</p>
              <p><strong>Tipo:</strong> {usuario.tipo_usuario}</p>
              <p><strong>Status:</strong> <Badge className={usuario.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{usuario.status}</Badge></p>
              {usuario.cargo && <p><strong>Cargo:</strong> {usuario.cargo}</p>}
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
        
        {clientesDisponiveis.length === 0 ? (
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
              <label className="text-sm font-medium text-slate-700 mb-2 block">Selecionar Clientes</label>
              <Select 
                value={selectedClientes.length > 0 ? selectedClientes[0] : ''}
                onValueChange={(v) => {
                  if (v && !selectedClientes.includes(v)) {
                    setSelectedClientes([...selectedClientes, v]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesDisponiveis.map(cliente => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {cliente.cidade}, {cliente.estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedClientes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedClientes.map(cId => {
                    const c = clientes.find(cl => cl.id === cId);
                    return (
                      <Badge key={cId} variant="outline" className="flex items-center gap-1">
                        {c?.nome}
                        <button onClick={() => setSelectedClientes(selectedClientes.filter(id => id !== cId))}>
                          <XCircle className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
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