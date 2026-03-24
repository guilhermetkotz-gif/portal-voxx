import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VersaoGeralDashboard from './VersaoGeralDashboard';
import PerformanceFunilDashboard from './PerformanceFunilDashboard';
import ExecucaoComercialDashboard from './ExecucaoComercialDashboard';
import InteligenciaRiscoDashboard from './InteligenciaRiscoDashboard';
import InsightsAutomaticos from './InsightsAutomaticos';
import { Plus, Zap, Calendar, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardComercialExecutivo({ leads, onNovoLead, onRegistrarInteracao, onAgendarReuniao }) {
  const [periodo, setPeriodo] = useState('todos');
  const [filtroResponsavel, setFiltroResponsavel] = useState('all');
  const [filtroOrigem, setFiltroOrigem] = useState('all');
  const [filtroEtapa, setFiltroEtapa] = useState('all');

  // Filtrar leads
  const leadsFiltrados = leads.filter(l => {
    const matchResp = filtroResponsavel === 'all' || l.responsavel_voxx === filtroResponsavel;
    const matchOrigem = filtroOrigem === 'all' || l.origem === filtroOrigem;
    const matchEtapa = filtroEtapa === 'all' || l.etapa === filtroEtapa;
    return matchResp && matchOrigem && matchEtapa;
  });

  const { data: interacoes = [] } = useQuery({
    queryKey: ['interacoesComercial7d'],
    queryFn: async () => {
      const sete = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const all = await base44.entities.InteracaoComercial.list('-created_date', 200);
      return all.filter(i => i.created_date >= sete);
    },
    staleTime: 60 * 1000
  });

  const { data: reunioes = [] } = useQuery({
    queryKey: ['reunioesComercialAgendadas'],
    queryFn: () => base44.entities.ReuniaoComercial.filter({ status: 'agendada' }, 'data_hora', 50),
    staleTime: 60 * 1000
  });

  const responsaveis = [...new Set(leads.map(l => l.responsavel_voxx).filter(Boolean))];
  const origens = [...new Set(leads.map(l => l.origem).filter(Boolean))];
  const etapas = [...new Set(leads.map(l => l.etapa).filter(Boolean))];

  const handleLimparFiltros = () => {
    setPeriodo('todos');
    setFiltroResponsavel('all');
    setFiltroOrigem('all');
    setFiltroEtapa('all');
  };

  return (
    <div className="space-y-5">
      {/* FILTROS GLOBAIS */}
      <Card className="p-4 bg-gradient-to-r from-violet-50 to-indigo-50">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-slate-700">⚙️ FILTROS GLOBAIS</p>
          <div className="flex flex-wrap gap-2 items-end">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="30d">Últimos 30d</SelectItem>
                <SelectItem value="90d">Últimos 90d</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {responsaveis.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {origens.map(o => <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos etapas</SelectItem>
                {etapas.map(e => <SelectItem key={e} value={e} className="text-xs">{e.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>

            {(periodo !== 'todos' || filtroResponsavel !== 'all' || filtroOrigem !== 'all' || filtroEtapa !== 'all') && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleLimparFiltros}>
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* AÇÕES RÁPIDAS */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onNovoLead} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Novo Lead
        </Button>
        <Button size="sm" variant="outline" onClick={onRegistrarInteracao} className="gap-1.5 text-xs">
          <Activity className="w-3.5 h-3.5" /> Registrar Interação
        </Button>
        <Button size="sm" variant="outline" onClick={onAgendarReuniao} className="gap-1.5 text-xs">
          <Calendar className="w-3.5 h-3.5" /> Agendar Reunião
        </Button>
      </div>

      {/* INSIGHTS AUTOMÁTICOS */}
      {leadsFiltrados.length > 0 && <InsightsAutomaticos leads={leadsFiltrados} />}

      {/* BLOCOS DO DASHBOARD */}
      <VersaoGeralDashboard leads={leadsFiltrados} periodo={periodo} />
      <PerformanceFunilDashboard leads={leadsFiltrados} />
      <ExecucaoComercialDashboard leads={leadsFiltrados} interacoes={interacoes} reunioes={reunioes} />
      <InteligenciaRiscoDashboard leads={leadsFiltrados} />
    </div>
  );
}