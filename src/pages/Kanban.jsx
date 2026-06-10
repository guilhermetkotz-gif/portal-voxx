import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanColumn from '@/components/kanban/KanbanColumn';
import KanbanFilters from '@/components/kanban/KanbanFilters';
import DemandaDetailModal from '@/components/kanban/DemandaDetailModal';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import moment from 'moment-timezone';
import ColumnManagerModal from '@/components/kanban/ColumnManagerModal';
import NovaDemandaCriacaoModal from '@/components/kanban/NovaDemandaCriacaoModal';

const DEFAULT_COLUMN_ORDER = [
  'ATENDIMENTO',
  'TRAFEGO_META',
  'TRAFEGO_GOOGLE',
  'TRAFEGO_TIKTOK',
  'ALTERACAO_CRIACAO',
  'CRIACAO',
  'EDICAO',
  'BI_RELATORIO',
  'IMPLANTACAO',
  'FINANCEIRO',
  'AUTOMACAO',
  'SALDOS'
];

// Coluna catch-all para demandas com setor inválido/nulo
const SEM_SETOR_KEY = '__SEM_SETOR__';

const COLUMN_DEFINITIONS = {
  ATENDIMENTO: { name: "Atendimento" },
  TRAFEGO_META: { name: "Tráfego Meta Ads" },
  TRAFEGO_GOOGLE: { name: "Tráfego Google Ads" },
  TRAFEGO_TIKTOK: { name: "Tráfego TikTok Ads" },
  ALTERACAO_CRIACAO: { name: "Alteração Criação" },
  CRIACAO: { name: "Criação Artes & Peças" },
  EDICAO: { name: "Edição de Vídeo" },
  BI_RELATORIO: { name: "BI & Relatórios" },
  IMPLANTACAO: { name: "Implantação/Acessos" },
  FINANCEIRO: { name: "Financeiro/Administrativo" },
  AUTOMACAO: { name: "Automação" },
  SALDOS: { name: "Saldos" },
  [SEM_SETOR_KEY]: { name: "⚠️ Sem Setor / Inválido" },
};

const Kanban = ({ user, selectedClienteId }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedDemanda, setSelectedDemanda] = useState(null);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [showNovaCriacaoModal, setShowNovaCriacaoModal] = useState(false);
  const [viewMode, setViewMode] = useState('ativas'); // 'ativas' ou 'concluidas'
  const [filters, setFilters] = useState({
    cliente_id: 'all',
    status: [],
    prioridade: 'all',
    prazo: 'all',
    tags: []
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('kanban_column_order');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMN_ORDER;
  });

  const [minimizedColumns, setMinimizedColumns] = useState(() => {
    const saved = localStorage.getItem('kanban_minimized_columns');
    return saved ? JSON.parse(saved) : {};
  });

  const [columns, setColumns] = useState(() => {
    const cols = {};
    DEFAULT_COLUMN_ORDER.forEach(key => {
      cols[key] = { name: COLUMN_DEFINITIONS[key].name, items: [] };
    });
    return cols;
  });

  // Fetch custom columns
  const { data: customColumns = [] } = useQuery({
    queryKey: ['kanbanColumns'],
    queryFn: () => base44.entities.KanbanColumn.filter({ active: true }, 'order'),
    enabled: !!user,
  });

  // Merge default and custom columns
  const allColumnDefinitions = React.useMemo(() => {
    const merged = { ...COLUMN_DEFINITIONS };
    customColumns.forEach(col => {
      merged[col.column_id] = { name: col.name, is_custom: col.is_custom };
    });
    return merged;
  }, [customColumns]);

  const allColumnOrder = React.useMemo(() => {
    // columnOrder (localStorage) is the source of truth for ordering
    const savedSet = new Set(columnOrder);
    // Add custom columns not yet in saved order
    const customNotSaved = customColumns
      .filter(c => !savedSet.has(c.column_id))
      .sort((a, b) => a.order - b.order)
      .map(c => c.column_id);
    // Add default columns not yet in saved order
    const defaultsNotSaved = DEFAULT_COLUMN_ORDER.filter(id => !savedSet.has(id));
    // SEM_SETOR_KEY always at the end (never in localStorage order)
    return [...columnOrder, ...customNotSaved, ...defaultsNotSaved, SEM_SETOR_KEY];
  }, [customColumns, columnOrder]);

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
    refetchInterval: 10000,
  });

  // Busca entregas para colorir os cards por status de aprovação WhatsApp
  const { data: todasEntregas = [] } = useQuery({
    queryKey: ['entregasKanban'],
    queryFn: () => base44.entities.EntregaDemanda.list('-updated_date', 1000),
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Mapeia demanda_id → status de aprovação mais crítico
  const aprovacaoStatusMap = React.useMemo(() => {
    const map = {};
    todasEntregas.forEach(e => {
      if (!e.demanda_id) return;
      const s = e.status_entrega;
      const current = map[e.demanda_id];
      // Prioridade: solicitacao_alteracao > aprovado > em_aprovacao/enviado
      if (s === 'solicitacao_alteracao') {
        map[e.demanda_id] = 'solicitacao_alteracao';
      } else if (s === 'aprovado' && current !== 'solicitacao_alteracao') {
        map[e.demanda_id] = 'aprovado';
      } else if ((s === 'em_aprovacao' || s === 'enviado') && !current) {
        map[e.demanda_id] = 'pendente';
      }
    });
    return map;
  }, [todasEntregas]);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesKanban'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    enabled: !!user && (isVoxxAdmin(user) || isVoxxOperacao(user)),
  });

  useEffect(() => {
    if (demandas) {
      const newColumns = {};
      Object.keys(allColumnDefinitions).forEach(key => {
        newColumns[key] = { name: allColumnDefinitions[key].name, items: [] };
      });
      // Garantir coluna catch-all sempre inicializada
      if (!newColumns[SEM_SETOR_KEY]) {
        newColumns[SEM_SETOR_KEY] = { name: '⚠️ Sem Setor / Inválido', items: [] };
      }

      let filteredDemandas = demandas;

      // Filtrar por modo de visualização
      if (viewMode === 'ativas') {
        filteredDemandas = filteredDemandas.filter(d => d.status !== 'finalizada' && d.status !== 'concluida');
      } else if (viewMode === 'concluidas') {
        filteredDemandas = filteredDemandas.filter(d => d.status === 'concluida');
      } else {
        filteredDemandas = filteredDemandas.filter(d => d.status === 'finalizada');
      }

      // Aplicar filtros
      if (filters.cliente_id !== 'all') {
        filteredDemandas = filteredDemandas.filter(d => d.cliente_id === filters.cliente_id);
      }
      
      if (Array.isArray(filters.status) && filters.status.length > 0) {
        filteredDemandas = filteredDemandas.filter(d => filters.status.includes(d.status));
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

      if (Array.isArray(filters.tags) && filters.tags.length > 0) {
        filteredDemandas = filteredDemandas.filter(d => {
          const demandaTags = d.tags || [];
          return filters.tags.some(tag => demandaTags.includes(tag));
        });
      }
      
      filteredDemandas.sort((a, b) => {
        if (a.urgente && !b.urgente) return -1;
        if (!a.urgente && b.urgente) return 1;
        const priorityOrder = { alta: 0, media: 1, baixa: 2 };
        return priorityOrder[a.prioridade] - priorityOrder[b.prioridade];
      });

      filteredDemandas.forEach(demanda => {
        const targetCol = demanda.setor && newColumns[demanda.setor]
          ? demanda.setor
          : SEM_SETOR_KEY;
        newColumns[targetCol].items.push(demanda);
      });
      
      setColumns(newColumns);
    }
  }, [demandas, selectedClienteId, user, filters, allColumnDefinitions, viewMode]);

  const updateDemandaMutation = useMutation({
    mutationFn: async ({ id, setor, setorAnterior }) => {
      await base44.entities.Demanda.update(id, { setor, ultima_atividade_kanban: new Date().toISOString() });
      // Registrar movimentação no histórico
      base44.functions.invoke('registrarMovimentacaoSetor', {
        demanda_id: id,
        setor_novo: setor,
        setor_anterior: setorAnterior || null,
        usuario_id: user?.id || null,
        usuario_nome: user?.full_name || user?.email || 'Sistema'
      }).catch(() => {}); // fire-and-forget, não bloquear UX
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['demandasKanban']);
      toast.success('Setor atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar setor: ' + error.message);
    },
  });

  const toggleMinimize = (columnId) => {
    const newMinimized = { ...minimizedColumns, [columnId]: !minimizedColumns[columnId] };
    setMinimizedColumns(newMinimized);
    localStorage.setItem('kanban_minimized_columns', JSON.stringify(newMinimized));
  };

  const handleSaveColumns = async (editedColumns) => {
    try {
      // Delete removed custom columns
      const editedIds = editedColumns.map(c => c.column_id);
      const removedColumns = customColumns.filter(c => !editedIds.includes(c.column_id));
      
      for (const col of removedColumns) {
        await base44.entities.KanbanColumn.delete(col.id);
      }

      // Update or create columns
      for (const col of editedColumns) {
        const existingCol = customColumns.find(c => c.column_id === col.column_id);
        
        const data = {
          column_id: col.column_id,
          name: col.name,
          order: col.order,
          is_custom: col.is_custom !== false,
          active: true
        };

        if (existingCol) {
          await base44.entities.KanbanColumn.update(existingCol.id, data);
        } else {
          await base44.entities.KanbanColumn.create(data);
        }
      }

      queryClient.invalidateQueries(['kanbanColumns']);
      toast.success('Colunas atualizadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar colunas: ' + error.message);
    }
  };

  const columnsForManager = React.useMemo(() => {
    return allColumnOrder.map((colId, index) => ({
      column_id: colId,
      name: allColumnDefinitions[colId]?.name || colId,
      order: index,
      is_custom: allColumnDefinitions[colId]?.is_custom || false,
      active: true
    }));
  }, [allColumnOrder, allColumnDefinitions]);

  // Contagem de demandas do mês vigente por modo
  const mesVigenteCounts = React.useMemo(() => {
    if (!demandas) return { ativas: 0, concluidas: 0, finalizadas: 0 };
    const inicioMes = moment().tz('America/Sao_Paulo').startOf('month').toISOString();
    const doMes = demandas.filter(d => d.created_date >= inicioMes);
    return {
      ativas: doMes.filter(d => d.status !== 'finalizada' && d.status !== 'concluida').length,
      concluidas: doMes.filter(d => d.status === 'concluida').length,
      finalizadas: doMes.filter(d => d.status === 'finalizada').length,
    };
  }, [demandas]);

  // Get all unique tags from demandas
  const allTags = React.useMemo(() => {
    if (!demandas) return [];
    const tagsSet = new Set();
    demandas.forEach(d => {
      (d.tags || []).forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [demandas]);

  const handleUpdateTags = (demandaId, newTags) => {
    base44.entities.Demanda.update(demandaId, { tags: newTags })
      .then(() => {
        queryClient.invalidateQueries(['demandasKanban']);
        toast.success('Tags atualizadas!');
      })
      .catch((error) => {
        toast.error('Erro ao atualizar tags: ' + error.message);
      });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId, type } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Arrastar coluna
    if (type === 'COLUMN') {
      const newColumnOrder = Array.from(allColumnOrder);
      const [removed] = newColumnOrder.splice(source.index, 1);
      newColumnOrder.splice(destination.index, 0, removed);

      // Update local state immediately so UI doesn't revert on DB refetch
      setColumnOrder(newColumnOrder);
      localStorage.setItem('kanban_column_order', JSON.stringify(newColumnOrder));

      // Update DB for columns that have records
      newColumnOrder.forEach((colId, index) => {
        const existingCol = customColumns.find(c => c.column_id === colId);
        if (existingCol) {
          base44.entities.KanbanColumn.update(existingCol.id, { order: index });
        }
      });

      queryClient.invalidateQueries({ queryKey: ['kanbanColumns'] });
      toast.success('Ordem das colunas atualizada!');
      return;
    }

    // Arrastar card
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

      updateDemandaMutation.mutate({ id: draggableId, setor: destination.droppableId, setorAnterior: source.droppableId });
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

  if (!user) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!isVoxxAdmin(user) && !isVoxxOperacao(user)) {
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
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Kanban de Demandas</h1>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('ativas')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'ativas'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demandas Ativas
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {mesVigenteCounts.ativas}
                </span>
              </button>
              <button
                onClick={() => setViewMode('concluidas')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'concluidas'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demandas Concluídas
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {mesVigenteCounts.concluidas}
                </span>
              </button>
              <button
                onClick={() => setViewMode('finalizadas')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  viewMode === 'finalizadas'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Demandas Finalizadas
                <span className="bg-slate-200 text-slate-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {mesVigenteCounts.finalizadas}
                </span>
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {viewMode === 'ativas' 
              ? 'Arraste e solte para reorganizar ou mover entre setores'
              : viewMode === 'concluidas'
                ? 'Visualização de demandas concluídas organizadas por setor'
                : 'Visualização de demandas finalizadas organizadas por setor'}
            <span className="ml-2 text-xs text-slate-400">(badges = abertas no mês vigente)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowColumnManager(true)}>
            <Settings className="mr-2 h-4 w-4" /> Gerenciar Colunas
          </Button>
          <Button onClick={() => navigate(createPageUrl('AbrirDemanda'))}>
            <Plus className="mr-2 h-4 w-4" /> Nova Demanda
          </Button>
        </div>
      </div>

      <KanbanFilters filters={filters} setFilters={setFilters} clientes={clientes} availableTags={allTags} />

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-columns" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div 
              className="flex gap-4 overflow-x-auto pb-4"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {allColumnOrder.map((columnId, index) => {
                const column = columns[columnId];
                if (!column) return null;
                // Esconder coluna "Sem Setor" quando vazia
                if (columnId === SEM_SETOR_KEY && column.items.length === 0) return null;
                
                return (
                  <Draggable key={columnId} draggableId={columnId} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <KanbanColumn 
                          id={columnId} 
                          title={column.name} 
                          demands={column.items}
                          onCardClick={setSelectedDemanda}
                          dragHandleProps={provided.dragHandleProps}
                          isMinimized={minimizedColumns[columnId]}
                          onToggleMinimize={() => toggleMinimize(columnId)}
                          allTags={allTags}
                          aprovacaoStatusMap={aprovacaoStatusMap}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Modal sempre montado para evitar conflito de removeChild com portais Radix UI durante refetch */}
      <DemandaDetailModal 
        demanda={selectedDemanda} 
        open={!!selectedDemanda} 
        onClose={() => setSelectedDemanda(null)} 
      />

      <ColumnManagerModal
        open={showColumnManager}
        onClose={() => setShowColumnManager(false)}
        columns={columnsForManager}
        onSave={handleSaveColumns}
      />

      <NovaDemandaCriacaoModal
        open={showNovaCriacaoModal}
        onClose={() => setShowNovaCriacaoModal(false)}
      />
    </div>
  );
};

export default Kanban;