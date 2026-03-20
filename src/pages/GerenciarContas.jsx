import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Building2,
  Filter,
  Plus,
  Edit,
  TrendingUp,
  MapPin,
  Calendar,
  DollarSign,
  Trash2,
  Loader2,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isVoxxAdmin, isVoxxManager } from '@/components/utils/auth';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function GerenciarContas({ user }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [clienteParaDelete, setClienteParaDelete] = useState(null);
  const [clienteParaEditar, setClienteParaEditar] = useState(null);
  const [editForm, setEditForm] = useState({});
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['todosClientes'],
    queryFn: () => base44.entities.Cliente.list('nome', 500),
    staleTime: 2 * 60 * 1000
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cliente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosClientes'] });
      toast.success('Cliente atualizado com sucesso!');
      setClienteParaEditar(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar cliente: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (clienteId) => {
      await base44.entities.Cliente.delete(clienteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todosClientes'] });
      toast.success('Cliente deletado com sucesso!');
      setClienteParaDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao deletar cliente: ' + error.message);
    }
  });

  // Remover duplicatas baseado no nome (manter a mais recente)
  const clientesUnicos = React.useMemo(() => {
    const map = new Map();
    clientes.forEach(cliente => {
      const chave = cliente.nome?.toLowerCase().trim();
      if (chave) {
        const existente = map.get(chave);
        // Manter o registro com mais dados ou o mais recente
        if (!existente || new Date(cliente.updated_date) > new Date(existente.updated_date)) {
          map.set(chave, cliente);
        }
      }
    });
    return Array.from(map.values());
  }, [clientes]);

  const clientesFiltrados = clientesUnicos.filter(cliente => {
    const matchSearch = !search || 
      cliente.nome?.toLowerCase().includes(search.toLowerCase()) ||
      cliente.cidade?.toLowerCase().includes(search.toLowerCase()) ||
      cliente.marca?.toLowerCase().includes(search.toLowerCase()) ||
      cliente.estado?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'todos' || cliente.status === statusFilter;
    const matchTipo = tipoFilter === 'todos' || cliente.tipo_cliente === tipoFilter;

    return matchSearch && matchStatus && matchTipo;
  });

  const statusColors = {
    ativo: 'bg-emerald-100 text-emerald-700',
    pausado: 'bg-amber-100 text-amber-700',
    encerrado: 'bg-slate-100 text-slate-600'
  };

  const tipoClienteLabels = {
    oral_sin: 'Oral Sin',
    particular: 'Particular',
    franquia: 'Franquia',
    outro: 'Outro'
  };

  const planoLabels = {
    trafego: 'Tráfego',
    trafego_criacao: 'Tráfego + Criação',
    full: 'Full Service',
    personalizado: 'Personalizado'
  };

  if (!user || (user.role !== 'admin' && user.tipo_usuario !== 'voxx_admin' && user.tipo_usuario !== 'voxx_manager')) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-slate-500 mt-2">Você não tem permissão para acessar esta área.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Contas</h1>
          <p className="text-slate-500 mt-1">Gerenciamento de clientes e unidades</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Conta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total de Contas</p>
              <p className="text-2xl font-bold text-slate-900">{clientes.length}</p>
            </div>
            <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-violet-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Contas Ativas</p>
              <p className="text-2xl font-bold text-emerald-600">
                {clientes.filter(c => c.status === 'ativo').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Pausadas</p>
              <p className="text-2xl font-bold text-amber-600">
                {clientes.filter(c => c.status === 'pausado').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Encerradas</p>
              <p className="text-2xl font-bold text-slate-600">
                {clientes.filter(c => c.status === 'encerrado').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome, cidade, marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="todos">Todos Status</option>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="encerrado">Encerrado</option>
            </select>

            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="todos">Todos Tipos</option>
              <option value="oral_sin">Oral Sin</option>
              <option value="particular">Particular</option>
              <option value="franquia">Franquia</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Lista de Clientes */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card className="p-8 text-center">
            <p className="text-slate-500">Carregando contas...</p>
          </Card>
        ) : clientesFiltrados.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Nenhuma conta encontrada</p>
          </Card>
        ) : (
          clientesFiltrados.sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || '')).map(cliente => (
            <Card key={cliente.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{cliente.nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={statusColors[cliente.status || 'ativo']}>
                          {cliente.status || 'ativo'}
                        </Badge>
                        {cliente.tipo_cliente && (
                          <Badge variant="outline">
                            {tipoClienteLabels[cliente.tipo_cliente] || cliente.tipo_cliente}
                          </Badge>
                        )}
                        {cliente.plano_servico && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {planoLabels[cliente.plano_servico] || cliente.plano_servico}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">Localização</p>
                      <div className="flex items-center gap-1 text-slate-900">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{cliente.cidade}, {cliente.estado}</span>
                      </div>
                    </div>

                    {cliente.marca && (
                      <div>
                        <p className="text-slate-500 mb-1">Marca</p>
                        <p className="text-slate-900 font-medium">{cliente.marca}</p>
                      </div>
                    )}

                    {cliente.responsavel_voxx && (
                      <div>
                        <p className="text-slate-500 mb-1">Responsável</p>
                        <p className="text-slate-900">{cliente.responsavel_voxx}</p>
                      </div>
                    )}

                    {cliente.data_inicio && (
                      <div>
                        <p className="text-slate-500 mb-1">Início</p>
                        <p className="text-slate-900">
                          {new Date(cliente.data_inicio).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    )}

                    {cliente.health_score !== undefined && (
                      <div>
                        <p className="text-slate-500 mb-1">Health Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                cliente.health_score >= 80 ? 'bg-emerald-500' :
                                cliente.health_score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${cliente.health_score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900">
                            {cliente.health_score}
                          </span>
                        </div>
                      </div>
                    )}

                    {(cliente.leads_meta_mes || cliente.leads_google_cadastro) && (
                      <div>
                        <p className="text-slate-500 mb-1">Leads/mês</p>
                        <p className="text-slate-900 font-medium">
                          {(cliente.leads_meta_mes || 0) + (cliente.leads_google_cadastro || 0)}
                        </p>
                      </div>
                    )}

                    {cliente.investimento_meta_mes && (
                      <div>
                        <p className="text-slate-500 mb-1">Investimento Meta</p>
                        <p className="text-slate-900 font-medium">
                          R$ {cliente.investimento_meta_mes.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}

                    {cliente.investimento_google_mes && (
                      <div>
                        <p className="text-slate-500 mb-1">Investimento Google</p>
                        <p className="text-slate-900 font-medium">
                          R$ {cliente.investimento_google_mes.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>

                  {cliente.observacoes && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Observações:</p>
                      <p className="text-sm text-slate-600 mt-1">{cliente.observacoes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setClienteParaEditar(cliente); setEditForm(cliente); }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={() => setClienteParaDelete(cliente)}
                     className="text-red-600 hover:text-red-700 hover:bg-red-50"
                   >
                     <Trash2 className="w-4 h-4" />
                   </Button>
                 </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Edição */}
      {clienteParaEditar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-slate-900">Editar Cliente</h2>
              <button onClick={() => setClienteParaEditar(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={editForm.nome || ''} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Marca</Label>
                  <Input value={editForm.marca || ''} onChange={e => setEditForm({ ...editForm, marca: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Cidade *</Label>
                  <Input value={editForm.cidade || ''} onChange={e => setEditForm({ ...editForm, cidade: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estado *</Label>
                  <Input value={editForm.estado || ''} onChange={e => setEditForm({ ...editForm, estado: e.target.value })} maxLength={2} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editForm.status || 'ativo'} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                      <SelectItem value="implantacao">Implantação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de Cliente</Label>
                  <Select value={editForm.tipo_cliente || ''} onValueChange={v => setEditForm({ ...editForm, tipo_cliente: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oral_sin">Oral Sin</SelectItem>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="franquia">Franquia</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Plano de Serviço</Label>
                  <Select value={editForm.plano_servico || ''} onValueChange={v => setEditForm({ ...editForm, plano_servico: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trafego">Tráfego</SelectItem>
                      <SelectItem value="trafego_criacao">Tráfego + Criação</SelectItem>
                      <SelectItem value="full">Full Service</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Responsável Voxx</Label>
                  <Input value={editForm.responsavel_voxx || ''} onChange={e => setEditForm({ ...editForm, responsavel_voxx: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Data de Início</Label>
                  <Input type="date" value={editForm.data_inicio || ''} onChange={e => setEditForm({ ...editForm, data_inicio: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Responsável Cliente (Nome)</Label>
                  <Input value={editForm.responsavel_cliente_nome || ''} onChange={e => setEditForm({ ...editForm, responsavel_cliente_nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Telefone do Responsável</Label>
                  <Input value={editForm.responsavel_cliente_telefone || ''} onChange={e => setEditForm({ ...editForm, responsavel_cliente_telefone: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>E-mail do Responsável</Label>
                  <Input type="email" value={editForm.responsavel_cliente_email || ''} onChange={e => setEditForm({ ...editForm, responsavel_cliente_email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea rows={3} value={editForm.observacoes || ''} onChange={e => setEditForm({ ...editForm, observacoes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={() => setClienteParaEditar(null)}>Cancelar</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => updateMutation.mutate({ id: clienteParaEditar.id, data: editForm })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Diálogo de Confirmação de Deleção */}
      {clienteParaDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Deletar Cliente?</h2>
            <p className="text-slate-600 mb-4">
              Tem certeza que deseja deletar <strong>{clienteParaDelete.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setClienteParaDelete(null)}
              >
                Cancelar
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteMutation.mutate(clienteParaDelete.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deletando...' : 'Deletar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}