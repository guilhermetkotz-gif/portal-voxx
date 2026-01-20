import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from '@/components/kanban/KanbanColumn';
import DemandaDetailModal from '@/components/kanban/DemandaDetailModal';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';

const Kanban = ({ user, selectedClienteId }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedDemanda, setSelectedDemanda] = useState(null);

  const [columns, setColumns] = useState({
    TRAFEGO_META: { name: "Tráfego Meta Ads", items: [] },
    TRAFEGO_GOOGLE: { name: "Tráfego Google Ads", items: [] },
    TRAFEGO_TIKTOK: { name: "Tráfego TikTok Ads", items: [] },
    CRIACAO: { name: "Criação Artes & Peças", items: [] },
    EDICAO: { name: "Edição de Vídeo", items: [] },
    BI_RELATORIO: { name: "BI & Relatórios", items: [] },
    IMPLANTACAO: { name: "Implantação/Acessos", items: [] },
    FINANCEIRO: { name: "Financeiro/Administrativo", items: [] },
  });

  const { data: demandas, isLoading, error } = useQuery({
    queryKey: ['demandasKanban', selectedClienteId, user?.id],
    queryFn: async () => {
      let filters = {};
      if (!isVoxxAdmin(user) && !isVoxxOperacao(user)) {
        if (selectedClienteId) {
          filters.cliente_id = selectedClienteId;
        } else {
          return [];
        }
      }
      return base44.entities.Demanda.filter(filters, '-created_date', 500);
    },
    enabled: !!user,
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
      };

      let filteredDemandas = demandas;

      if (isVoxxOperacao(user) && user.clientes_atribuidos?.length > 0) {
        filteredDemandas = demandas.filter(d => user.clientes_atribuidos.includes(d.cliente_id));
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
  }, [demandas, selectedClienteId, user]);

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