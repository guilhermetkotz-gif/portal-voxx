import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DemandaCard from '@/components/demandas/DemandaCard';
import DemandaDetail from '@/components/demandas/DemandaDetail';
import { Loader2, Search, PlusCircle, Filter, X } from 'lucide-react';

const statusOptions = [
  { value: 'all', label: 'Todos os status' },
  { value: 'recebida', label: 'Recebida' },
  { value: 'em_triagem', label: 'Em Triagem' },
  { value: 'em_execucao', label: 'Em Execução' },
  { value: 'aguardando_cliente', label: 'Aguardando Cliente' },
  { value: 'em_revisao', label: 'Em Revisão' },
  { value: 'concluida', label: 'Concluída' }
];

const setorOptions = [
  { value: 'all', label: 'Todos os setores' },
  { value: 'TRAFEGO_META', label: 'Tráfego Meta' },
  { value: 'TRAFEGO_GOOGLE', label: 'Tráfego Google' },
  { value: 'TRAFEGO_TIKTOK', label: 'Tráfego TikTok' },
  { value: 'CRIACAO', label: 'Criação' },
  { value: 'EDICAO', label: 'Edição' },
  { value: 'BI_RELATORIO', label: 'BI/Relatório' },
  { value: 'IMPLANTACAO', label: 'Implantação' },
  { value: 'FINANCEIRO', label: 'Financeiro' }
];

const prioridadeOptions = [
  { value: 'all', label: 'Todas as prioridades' },
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' }
];

export default function Demandas({ currentCliente, selectedClienteId, user }) {
  const [selectedDemanda, setSelectedDemanda] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [setorFilter, setSetorFilter] = useState('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('abertas');

  // Check URL for specific demanda
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demandaId = params.get('id');
    if (demandaId) {
      // Will be handled after demandas load
    }
  }, []);

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas', selectedClienteId, user?.tipo_usuario],
    queryFn: async () => {
      if (user?.tipo_usuario === 'voxx_admin') {
        return base44.entities.Demanda.list('-updated_date', 200);
      }
      if (user?.tipo_usuario === 'voxx_operacao' && user?.clientes_atribuidos?.length) {
        const all = await base44.entities.Demanda.list('-updated_date', 200);
        return all.filter(d => user.clientes_atribuidos.includes(d.cliente_id));
      }
      if (selectedClienteId) {
        return base44.entities.Demanda.filter({ cliente_id: selectedClienteId }, '-updated_date', 100);
      }
      return [];
    },
    enabled: !!user && !!selectedClienteId,
    staleTime: 30 * 1000
  });

  const { data: timelineEvents = [] } = useQuery({
    queryKey: ['timelineEvents', selectedDemanda?.id],
    queryFn: () => base44.entities.TimelineEvent.filter(
      { demanda_id: selectedDemanda.id }, 
      '-created_date', 
      50
    ),
    enabled: !!selectedDemanda?.id,
    staleTime: 30 * 1000
  });

  // Handle URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const demandaId = params.get('id');
    if (demandaId && demandas.length > 0) {
      const found = demandas.find(d => d.id === demandaId);
      if (found) setSelectedDemanda(found);
    }
  }, [demandas]);

  // Filter demandas
  const filteredDemandas = demandas.filter(demanda => {
    const matchSearch = !search || 
      demanda.titulo.toLowerCase().includes(search.toLowerCase()) ||
      demanda.descricao?.toLowerCase().includes(search.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || demanda.status === statusFilter;
    const matchSetor = setorFilter === 'all' || demanda.setor === setorFilter;
    const matchPrioridade = prioridadeFilter === 'all' || demanda.prioridade === prioridadeFilter;
    
    const matchTab = activeTab === 'abertas' 
      ? demanda.status !== 'concluida' 
      : demanda.status === 'concluida';

    return matchSearch && matchStatus && matchSetor && matchPrioridade && matchTab;
  });

  const hasActiveFilters = statusFilter !== 'all' || setorFilter !== 'all' || prioridadeFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setSetorFilter('all');
    setPrioridadeFilter('all');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="abertas">
              Em Aberto ({demandas.filter(d => d.status !== 'concluida').length})
            </TabsTrigger>
            <TabsTrigger value="concluidas">
              Concluídas ({demandas.filter(d => d.status === 'concluida').length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Link to={createPageUrl('AbrirDemanda')}>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Demanda
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar demandas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-violet-300 bg-violet-50' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-2 w-5 h-5 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center">
                {[statusFilter, setorFilter, prioridadeFilter].filter(f => f !== 'all').length}
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                {setorOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                {prioridadeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Demandas List */}
      {filteredDemandas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">
            {hasActiveFilters || search 
              ? 'Nenhuma demanda encontrada com os filtros aplicados.'
              : activeTab === 'abertas'
                ? 'Nenhuma demanda em aberto.'
                : 'Nenhuma demanda concluída.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDemandas.map(demanda => (
            <DemandaCard 
              key={demanda.id} 
              demanda={demanda} 
              onClick={setSelectedDemanda}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <DemandaDetail
        demanda={selectedDemanda}
        events={timelineEvents}
        open={!!selectedDemanda}
        onClose={() => setSelectedDemanda(null)}
        user={user}
      />
    </div>
  );
}