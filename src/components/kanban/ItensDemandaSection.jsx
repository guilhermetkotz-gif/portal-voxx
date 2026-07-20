import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, ChevronUp, ChevronDown, Ban, Loader2, ListChecks, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';
import ItemDemandaFormModal from './ItemDemandaFormModal';

const STATUS_PROD_LABELS = {
  nao_iniciado: { label: 'Não iniciado', color: 'bg-slate-200 text-slate-700' },
  em_fila: { label: 'Em fila', color: 'bg-blue-100 text-blue-700' },
  em_desenvolvimento: { label: 'Em desenvolvimento', color: 'bg-purple-100 text-purple-700' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
};

const STATUS_FINAL_LABELS = {
  ativo: { label: 'Ativo', color: 'bg-slate-100 text-slate-600' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-700' },
  finalizado: { label: 'Finalizado', color: 'bg-indigo-100 text-indigo-700' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

/**
 * Seção de gestão de itens de uma demanda composta.
 * Permite criar, editar, reordenar, cancelar e excluir itens.
 * Fase 1: sem ações de aprovação, publicação ou entrega por item.
 */
export default function ItensDemandaSection({ demanda, user }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['itensDemanda', demanda.id],
    queryFn: () => base44.entities.ItemDemanda.filter({ demanda_id: demanda.id }, 'ordem', 100),
    enabled: !!demanda?.id,
    refetchInterval: 15000,
  });

  const nextOrdem = useMemo(() => {
    if (itens.length === 0) return 0;
    return Math.max(...itens.map(i => i.ordem ?? 0)) + 1;
  }, [itens]);

  const deleteMutation = useMutation({
    mutationFn: (itemId) => base44.entities.ItemDemanda.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['itensDemandaKanban'] });
      toast.success('Item excluído.');
    },
    onError: (error) => toast.error('Erro ao excluir: ' + error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ itemId, cancelar }) =>
      base44.entities.ItemDemanda.update(itemId, {
        status_finalizacao: cancelar ? 'cancelado' : 'ativo',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['itensDemandaKanban'] });
      toast.success('Item atualizado.');
    },
    onError: (error) => toast.error('Erro: ' + error.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ item, direction }) => {
      const sorted = [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      const idx = sorted.findIndex(i => i.id === item.id);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return;

      const current = sorted[idx];
      const target = sorted[targetIdx];
      await base44.entities.ItemDemanda.bulkUpdate([
        { id: current.id, ordem: target.ordem },
        { id: target.id, ordem: current.ordem },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
    },
    onError: (error) => toast.error('Erro ao reordenar: ' + error.message),
  });

  const handleStatusProducaoChange = async (item, newStatus) => {
    try {
      await base44.entities.ItemDemanda.update(item.id, { status_producao: newStatus });
      queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['itensDemandaKanban'] });
      toast.success('Status de produção atualizado.');
    } catch (error) {
      toast.error('Erro: ' + error.message);
    }
  };

  // Resumo agregado
  const resumo = useMemo(() => {
    const ativos = itens.filter(i => i.status_finalizacao !== 'cancelado');
    return {
      total: itens.length,
      ativos: ativos.length,
      concluidos: ativos.filter(i => i.status_producao === 'concluido').length,
      em_dev: ativos.filter(i => i.status_producao === 'em_desenvolvimento').length,
      nao_iniciado: ativos.filter(i => i.status_producao === 'nao_iniciado').length,
      em_fila: ativos.filter(i => i.status_producao === 'em_fila').length,
      cancelados: itens.filter(i => i.status_finalizacao === 'cancelado').length,
    };
  }, [itens]);

  const inputClass = "w-full h-7 rounded-md border border-input bg-transparent px-2 py-0.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-violet-600" />
            <CardTitle className="text-base">Itens da Demanda Composta</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingItem(null); setShowForm(true); }}
          >
            <Plus className="w-3 h-3 mr-1" />
            Novo Item
          </Button>
        </div>
        {itens.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-2">
            <Badge variant="outline" className="text-xs">{resumo.total} {resumo.total === 1 ? 'item' : 'itens'}</Badge>
            {resumo.concluidos > 0 && <Badge className="bg-green-100 text-green-700 text-xs">{resumo.concluidos} concluído(s)</Badge>}
            {resumo.em_dev > 0 && <Badge className="bg-purple-100 text-purple-700 text-xs">{resumo.em_dev} em desenvolvimento</Badge>}
            {resumo.em_fila > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs">{resumo.em_fila} em fila</Badge>}
            {resumo.nao_iniciado > 0 && <Badge className="bg-slate-100 text-slate-600 text-xs">{resumo.nao_iniciado} não iniciado(s)</Badge>}
            {resumo.cancelados > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{resumo.cancelados} cancelado(s)</Badge>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>Nenhum item criado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">Adicione itens para gerenciar entregas independentes dentro deste card.</p>
          </div>
        ) : (
          itens
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map((item, idx, arr) => {
              const isCancelado = item.status_finalizacao === 'cancelado';
              const prodLabel = STATUS_PROD_LABELS[item.status_producao] || STATUS_PROD_LABELS.nao_iniciado;
              const finalLabel = STATUS_FINAL_LABELS[item.status_finalizacao] || STATUS_FINAL_LABELS.ativo;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'border rounded-lg p-3 space-y-2',
                    isCancelado ? 'border-red-200 bg-red-50/50 opacity-60' : 'border-slate-200 bg-slate-50/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{item.titulo}</p>
                      {item.descricao && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === 0}
                        onClick={() => reorderMutation.mutate({ item, direction: 'up' })}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === arr.length - 1}
                        onClick={() => reorderMutation.mutate({ item, direction: 'down' })}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setEditingItem(item); setShowForm(true); }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500"
                        onClick={() => {
                          if (confirm(`Excluir o item "${item.titulo}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className={cn('text-xs', prodLabel.color)}>{prodLabel.label}</Badge>
                    <Badge className={cn('text-xs', finalLabel.color)}>{finalLabel.label}</Badge>
                    {item.tipo_material && <Badge variant="outline" className="text-xs">{item.tipo_material}</Badge>}
                    {item.formato && <Badge variant="outline" className="text-xs">{item.formato}</Badge>}
                    {item.canal && <Badge variant="outline" className="text-xs">{item.canal}</Badge>}
                  </div>

                  {(item.data_prevista || item.prazo_data || item.responsavel_nome) && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {item.data_prevista && (
                        <span>Previsto: {moment(item.data_prevista).format('DD/MM/YYYY HH:mm')}</span>
                      )}
                      {item.prazo_data && (
                        <span className="text-orange-600">Prazo: {moment(item.prazo_data).format('DD/MM/YYYY HH:mm')}</span>
                      )}
                      {item.responsavel_nome && <span>Resp: {item.responsavel_nome}</span>}
                    </div>
                  )}

                  {/* Fase 1: somente status de produção editável */}
                  {!isCancelado && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                      <span className="text-xs text-slate-400">Produção:</span>
                      <select
                        value={item.status_producao}
                        onChange={(e) => handleStatusProducaoChange(item, e.target.value)}
                        className={inputClass}
                      >
                        <option value="nao_iniciado">Não iniciado</option>
                        <option value="em_fila">Em fila</option>
                        <option value="em_desenvolvimento">Em desenvolvimento</option>
                        <option value="concluido">Concluído</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-500 hover:text-red-600"
                        onClick={() => cancelMutation.mutate({ itemId: item.id, cancelar: !isCancelado })}
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        {isCancelado ? 'Reativar' : 'Cancelar'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </CardContent>

      <ItemDemandaFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingItem(null); }}
        demandaId={demanda.id}
        item={editingItem}
        nextOrdem={nextOrdem}
      />
    </Card>
  );
}