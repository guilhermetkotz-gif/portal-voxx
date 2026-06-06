import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Link2, LinkIcon, X, RefreshCw, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

const VINCULO_COLOR = {
  vinculado:              'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  nao_vinculado:          'bg-slate-700/40 text-slate-400 border-slate-600',
  possivel_correspondencia:'bg-blue-500/20 text-blue-400 border-blue-500/30',
  inativo:                'bg-slate-800 text-slate-500 border-slate-700',
};

export default function AbaGruposClientes({ grupos, clientes, onRefresh }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroVinculo, setFiltroVinculo] = useState('todos');
  const [modalGrupo, setModalGrupo] = useState(null); // grupo a vincular
  const [buscaCliente, setBuscaCliente] = useState('');

  const filtrados = grupos.filter(g => {
    if (filtroVinculo !== 'todos' && g.status_vinculo !== filtroVinculo) return false;
    if (busca) {
      const b = busca.toLowerCase();
      if (!g.nome_grupo?.toLowerCase().includes(b) && !g.grupo_id?.toLowerCase().includes(b) && !g.cliente_nome?.toLowerCase().includes(b)) return false;
    }
    return true;
  });

  const clientesFiltrados = clientes.filter(c =>
    !buscaCliente || c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())
  ).slice(0, 20);

  const vincularMutation = useMutation({
    mutationFn: async ({ grupo, cliente }) => {
      await base44.entities.WhatsappGrupo.update(grupo.id, {
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        status_vinculo: 'vinculado',
      });
      await base44.entities.Cliente.update(cliente.id, {
        whatsapp_grupo_id: grupo.grupo_id,
        whatsapp_grupo_nome: grupo.nome_grupo,
        whatsapp_envio_ativo: true,
      });
    },
    onSuccess: () => {
      toast.success('Grupo vinculado com sucesso!');
      setModalGrupo(null);
      setBuscaCliente('');
      queryClient.invalidateQueries({ queryKey: ['radarGrupos'] });
      queryClient.invalidateQueries({ queryKey: ['radarClientes'] });
      onRefresh();
    },
    onError: (e) => toast.error('Erro ao vincular: ' + e.message),
  });

  const desvinularMutation = useMutation({
    mutationFn: async (grupo) => {
      await base44.entities.WhatsappGrupo.update(grupo.id, {
        cliente_id: null,
        cliente_nome: null,
        status_vinculo: 'nao_vinculado',
      });
    },
    onSuccess: () => {
      toast.success('Vínculo removido.');
      queryClient.invalidateQueries({ queryKey: ['radarGrupos'] });
      onRefresh();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const marcarInativoMutation = useMutation({
    mutationFn: async (grupo) => {
      await base44.entities.WhatsappGrupo.update(grupo.id, { status_vinculo: 'inativo' });
    },
    onSuccess: () => {
      toast.success('Grupo marcado como inativo.');
      queryClient.invalidateQueries({ queryKey: ['radarGrupos'] });
      onRefresh();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleVincular = (cliente) => {
    if (modalGrupo?.status_vinculo === 'vinculado') {
      if (!confirm(`O grupo "${modalGrupo.nome_grupo}" já está vinculado a "${modalGrupo.cliente_nome}". Deseja trocar para "${cliente.nome}"?`)) return;
    }
    vincularMutation.mutate({ grupo: modalGrupo, cliente });
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar grupo..." value={busca} onChange={e => setBusca(e.target.value)}
            className="pl-8 w-52 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm" />
        </div>
        <Select value={filtroVinculo} onValueChange={setFiltroVinculo}>
          <SelectTrigger className="w-44 bg-slate-800 border-slate-700 text-slate-100 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="vinculado">Vinculados</SelectItem>
            <SelectItem value="nao_vinculado">Não vinculados</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-slate-500">{filtrados.length} grupos</span>
        <Button size="sm" variant="ghost" onClick={onRefresh} className="text-slate-400 hover:text-white gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nome do Grupo</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">ID Z-API</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Cliente</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Última atividade</th>
                <th className="text-left px-3 py-3 text-slate-500 font-medium">Última mensagem</th>
                <th className="px-3 py-3 text-slate-500 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhum grupo encontrado.</td></tr>
              ) : (
                filtrados.map(g => {
                  const vColor = VINCULO_COLOR[g.status_vinculo] || VINCULO_COLOR.nao_vinculado;
                  const vLabel = { vinculado: 'Vinculado', nao_vinculado: 'Não vinculado', possivel_correspondencia: 'Possível', inativo: 'Inativo' }[g.status_vinculo] || g.status_vinculo;
                  return (
                    <tr key={g.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-4 py-3 font-medium text-white">{g.nome_grupo}</td>
                      <td className="px-3 py-3 font-mono text-slate-500 text-[10px] max-w-[140px] truncate" title={g.grupo_id}>{g.grupo_id}</td>
                      <td className="px-3 py-3 text-slate-300">{g.cliente_nome || <span className="text-slate-600 italic">—</span>}</td>
                      <td className="px-3 py-3"><Badge className={`text-[10px] border ${vColor}`}>{vLabel}</Badge></td>
                      <td className="px-3 py-3 text-slate-400">
                        {g.ultima_atividade ? moment(g.ultima_atividade).tz(TZ).format('DD/MM HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-400 max-w-[180px] truncate" title={g.ultima_mensagem}>{g.ultima_mensagem || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setModalGrupo(g)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-[11px] gap-1 h-6 px-2">
                            <LinkIcon className="w-3 h-3" /> Vincular
                          </Button>
                          {g.status_vinculo === 'vinculado' && (
                            <Button size="sm" variant="ghost" onClick={() => desvinularMutation.mutate(g)}
                              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-[11px] gap-1 h-6 px-2">
                              <X className="w-3 h-3" /> Desvincular
                            </Button>
                          )}
                          {g.status_vinculo !== 'inativo' && (
                            <Button size="sm" variant="ghost" onClick={() => marcarInativoMutation.mutate(g)}
                              className="text-slate-500 hover:text-slate-300 hover:bg-slate-700 text-[11px] h-6 px-2">
                              Inativo
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal vincular */}
      <Dialog open={!!modalGrupo} onOpenChange={() => { setModalGrupo(null); setBuscaCliente(''); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Vincular cliente ao grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-lg p-3 text-sm">
              <p className="text-slate-400">Grupo:</p>
              <p className="font-medium text-white">{modalGrupo?.nome_grupo}</p>
              <p className="text-slate-500 text-xs font-mono mt-1">{modalGrupo?.grupo_id}</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
              <Input placeholder="Buscar cliente..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)}
                className="pl-8 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500" />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {clientesFiltrados.map(c => (
                <button key={c.id} onClick={() => handleVincular(c)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-between group">
                  <span className="text-sm text-slate-200">{c.nome}</span>
                  {vincularMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    : <Check className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100" />
                  }
                </button>
              ))}
              {clientesFiltrados.length === 0 && (
                <p className="text-center text-slate-500 py-4 text-sm">Nenhum cliente encontrado</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}