import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from '@/components/kanban/KanbanColumn';
import KanbanFilters from '@/components/kanban/KanbanFilters';
import DemandaDetailModal from '@/components/kanban/DemandaDetailModal';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import moment from 'moment-timezone';

const Kanban = ({ user, selectedClienteId }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedDemanda, setSelectedDemanda] = useState(null);
  const [filters, setFilters] = useState({
    cliente_id: 'all',
    status: 'all',
    prioridade: 'all',
    prazo: 'all'
  });

  const [columns, setColumns] = useState({
    TRAFEGO_META: { name: "Tráfego Meta Ads", items: [] },
    TRAFEGO_GOOGLE: { name: "Tráfego Google Ads", items: [] },
    TRAFEGO_TIKTOK: { name: "Tráfego TikTok Ads", items: [] },
    CRIACAO: { name: "Criação Artes & Peças", items: [] },
    EDICAO: { name: "Edição de Vídeo", items: [] },
    BI_RELATORIO: { name: "BI & Relatórios", items: [] },
    IMPLANTACAO: { name: "Implantação/Acessos", items: [] },
    FINANCEIRO: { name: "Financeiro/Administrativo", items: [] },
    ALTERACAO_CRIACAO: { name: "Alteração Criação", items: [] },
    AUTOMACAO: { name: "Automação", items: [] },
    SALDOS: { name: "Saldos", items: [] },
  });

  const { data: demandas, isLoading, error } = useQuery({
    queryKey: ['demandasKanban', selectedClienteId, user?.id],
    queryFn: async () => {
      let queryFilters = {};
      if (!isVoxxAdmin(user) && !isVoxxOperacao(user)) {
        if (selectedClienteId) {
          queryFilters.cliente_id = selectedClienteId;
        } else {
          return [];
        }
      }
      return base44.entities.Demanda.filter(queryFilters, '-created_date', 500);
    },
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesKanban'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    enabled: !!user && (isVoxxAdmin(user) || isVoxxOperacao(user)),
  });

  useEffect(() => {
    if (demandas) {
      const newColumns = {
        TRAFEGO_META: { name: "Tráfego Meta Ads", items: [] },
        TRAFEGO_GOOGLE: { name: "Tráfego Google Ads", items: [] },
        TRAFEGO_TIKTOK: { name: "Tráfego TikTok Ads", items: [] },
        CRIACAO: { name: "Criação Artes & Peças", items: [] },
        EDICAO: { name: "Edição de Vídeo", items: [] },
        BI_RELATORIO: { name: "BI & Relatórios", items: [] },
        IMPLANTACAO: { name: "Implantação/Acessos", items: [] },
        FINANCEIRO: { name: "Financeiro/Administrativo", items: [] },
        ALTERACAO_CRIACAO: { name: "Alteração Criação", items: [] },
        AUTOMACAO: { name: "Automação", items: [] },
        SALDOS: { name: "Saldos", items: [] },
      };

      let filteredDemandas = demandas;

      if (isVoxxOperacao(user) && user.clientes_atribuidos?.length > 0) {
        filteredDemandas = demandas.filter(d => user.clientes_atribuidos.includes(d.cliente_id));
      }

      // Aplicar filtros
      if (filters.cliente_id !== 'all') {
        filteredDemandas = filteredDemandas.filter(d => d.cliente_id === filters.cliente_id);
      }
      
      if (filters.status !== 'all') {
        filteredDemandas = filteredDemandas.filter(d => d.status === filters.status);
      }
      
      if (filters.prioridade !== 'all') {
        filteredDemandas = filteredDemandas.filter(d => d.prioridade === filters.prioridade);
      }
      
      if (filters.prazo !== 'all') {
        const hoje = moment().tz('America/Sao_Paulo').startOf('day');
        filteredDemandas = filteredDemandas.filter(d => {
          if (filters.prazo === 'sem_prazo') {
            return !d.previsao_entrega;
          }
          if (!d.previsao_entrega) return false;
          
          const prazo = moment(d.previsao_entrega).tz('America/Sao_Paulo');
          if (filters.prazo === 'atrasado') {
            return prazo.isBefore(hoje);
          }
          if (filters.prazo === 'hoje') {
            return prazo.isSame(hoje, 'day');
          }
          if (filters.prazo === 'proximos_7_dias') {
            return prazo.isBetween(hoje, moment().tz('America/Sao_Paulo').add(7, 'days'), 'day', '[]');
          }
          return true;
        });
      }
      
      filteredDemandas.sort((a, b) => {
        if (a.urgente && !b.urgente) return -1;
        if (!a.urgente && b.urgente) return 1;
        const priorityOrder = { alta: 0, media: 1, baixa: 2 };
        return priorityOrder[a.prioridade] - priorityOrder[b.prioridade];
      });

      filteredDemandas.forEach(demanda => {
        if (newColumns[demanda.setor]) {
          newColumns[demanda.setor].items.push(demanda);
        }
      });
      
      setColumns(newColumns);
    }
  }, [demandas, selectedClienteId, user, filters]);

  const updateDemandaMutation = useMutation({
    mutationFn: ({ id, setor }) => base44.entities.Demanda.update(id, { setor }),
    onSuccess: () => {
      queryClient.invalidateQueries(['demandasKanban']);
      toast.success('Setor atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar setor: ' + error.message);
    },
  });

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    
    if (source.droppableId !== destination.droppableId) {
      const sourceItems = [...sourceColumn.items];
      const destItems = [...destColumn.items];
      const [removed] = sourceItems.splice(source.index, 1);
      destItems.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
        [destination.droppableId]: { ...destColumn, items: destItems },
      });

      updateDemandaMutation.mutate({ id: draggableId, setor: destination.droppableId });
    } else {
      const copiedItems = [...sourceColumn.items];
      const [removed] = copiedItems.splice(source.index, 1);
      copiedItems.splice(destination.index, 0, removed);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: copiedItems },
      });
    }
  };

  if (!user || (!isVoxxAdmin(user) && !isVoxxOperacao(user))) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-lg text-red-500">Acesso negado. Esta página é apenas para usuários Voxx.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-96">
        <p className="text-red-500">Erro ao carregar demandas: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kanban de Demandas</h1>
          <p className="text-sm text-slate-600 mt-1">Arraste e solte para reorganizar ou mover entre setores</p>
        </div>
        <Button onClick={() => navigate(createPageUrl('AbrirDemanda'))}>
          <Plus className="mr-2 h-4 w-4" /> Nova Demanda
        </Button>
      </div>

      <KanbanFilters filters={filters} setFilters={setFilters} clientes={clientes} />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Object.entries(columns).map(([columnId, column]) => (
            <KanbanColumn 
              key={columnId} 
              id={columnId} 
              title={column.name} 
              demands={column.items}
              onCardClick={setSelectedDemanda}
            />
          ))}
        </div>
      </DragDropContext>

      <DemandaDetailModal 
        demanda={selectedDemanda} 
        open={!!selectedDemanda} 
        onClose={() => setSelectedDemanda(null)} 
      />
    </div>
  );
};

export default Kanban;