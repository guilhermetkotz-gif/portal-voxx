import React, { useState, useMemo } from 'react';
import { isVoxxAdmin, isVoxxOperacao } from '@/components/utils/auth';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Users, FileText, TrendingUp } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';

const statusColors = {
  recebida: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Recebida' },
  em_triagem: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Em Triagem' },
  em_execucao: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Em Execução' },
  aguardando_cliente: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Aguardando Cliente' },
  em_revisao: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Em Revisão' },
  concluida: { bg: 'bg-green-100', text: 'text-green-800', label: 'Concluída' }
};

const prioridades = {
  alta: { color: '#ef4444', label: 'Alta' },
  media: { color: '#f59e0b', label: 'Média' },
  baixa: { color: '#10b981', label: 'Baixa' }
};

const DEFAULT_SETORES = {
  ATENDIMENTO: 'Atendimento',
  TRAFEGO_META: 'Tráfego Meta Ads',
  TRAFEGO_GOOGLE: 'Tráfego Google Ads',
  TRAFEGO_TIKTOK: 'Tráfego TikTok Ads',
  ALTERACAO_CRIACAO: 'Alteração Criação',
  CRIACAO: 'Criação Artes & Peças',
  EDICAO: 'Edição de Vídeo',
  BI_RELATORIO: 'BI & Relatórios',
  IMPLANTACAO: 'Implantação/Acessos',
  FINANCEIRO: 'Financeiro/Administrativo',
  AUTOMACAO: 'Automação',
  SALDOS: 'Saldos'
};

export default function MonitoramentoDemandas({ user, selectedClienteId }) {
  const [filterSetor, setFilterSetor] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch custom columns for mapping
  const { data: customColumns = [] } = useQuery({
    queryKey: ['kanbanColumns'],
    queryFn: () => base44.entities.KanbanColumn.filter({ active: true }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000
  });

  // Merge default and custom setores
  const setores = React.useMemo(() => {
    const merged = { ...DEFAULT_SETORES };
    customColumns.forEach(col => {
      merged[col.column_id] = col.name;
    });
    return merged;
  }, [customColumns]);

  // Fetch all demandas
  const { data: allDemandas = [], isLoading } = useQuery({
    queryKey: ['demandasMonitoramento', selectedClienteId, user?.id],
    queryFn: async () => {
      let queryFilters = {};
      if (!user || user.role !== 'admin') {
        if (selectedClienteId) {
          queryFilters.cliente_id = selectedClienteId;
        } else {
          return [];
        }
      }
      return base44.entities.Demanda.filter(queryFilters, '-created_date', 500);
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  // Filter demandas based on user type
  const demandas = useMemo(() => {
    if (!allDemandas) return [];
    
    // Voxx Operação users only see their assigned clients
    if (user?.tipo_usuario === 'voxx_operacao' && user?.clientes_atribuidos?.length > 0) {
      return allDemandas.filter(d => user.clientes_atribuidos.includes(d.cliente_id));
    }
    
    return allDemandas;
  }, [allDemandas, user]);

  // Fetch timeline events for completion time analysis
  const { data: events = [] } = useQuery({
    queryKey: ['timelineEventsMonitoramento', selectedClienteId, user?.id],
    queryFn: async () => {
      let queryFilters = {};
      if (!user || user.role !== 'admin') {
        if (selectedClienteId) {
          queryFilters.cliente_id = selectedClienteId;
        } else {
          return [];
        }
      }
      return base44.entities.TimelineEvent.filter(queryFilters, '-created_date', 1000);
    },
    enabled: !!user,
    staleTime: 60 * 1000
  });

  // filteredDemandas MUST be declared before any useMemo that depends on it
  const filteredDemandas = useMemo(() => {
    let result = filterSetor ? demandas.filter(d => d.setor === filterSetor) : demandas;
    if (dateFrom) {
      result = result.filter(d => new Date(d.created_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(d => new Date(d.created_date) <= toDate);
    }
    return result;
  }, [demandas, filterSetor, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!filteredDemandas || filteredDemandas.length === 0) {
      return {
        total: 0,
        abertas: 0,
        concluidas: 0,
        altaPrioridade: 0,
        avgCompletionBySetor: [],
        setorChart: [],
        statusChart: [],
        concluidasSetorChart: [],
        naoConcluidasSetorChart: []
      };
    }

    const total = filteredDemandas.length;
    const abertas = filteredDemandas.filter(d => ['recebida', 'em_triagem', 'em_execucao', 'aguardando_cliente', 'em_revisao'].includes(d.status)).length;
    const concluidas = filteredDemandas.filter(d => d.status === 'concluida').length;
    const altaPrioridade = filteredDemandas.filter(d => d.prioridade === 'alta').length;

    // Calculate average completion time by setor
    const completionBySetor = {};
    filteredDemandas.forEach(demanda => {
      if (demanda.status === 'concluida') {
        const created = new Date(demanda.created_date);
        const updated = new Date(demanda.updated_date);
        const days = differenceInDays(updated, created);
        
        if (!completionBySetor[demanda.setor]) {
          completionBySetor[demanda.setor] = { times: [], count: 0 };
        }
        completionBySetor[demanda.setor].times.push(days);
        completionBySetor[demanda.setor].count += 1;
      }
    });

    const avgCompletionBySetor = Object.entries(completionBySetor).map(([setor, data]) => ({
      setor: setores[setor] || setor,
      avgDias: Math.round(data.times.reduce((a, b) => a + b, 0) / data.times.length),
      total: data.count
    }));

    // Demandas por setor
    const demandaBySetor = {};
    filteredDemandas.forEach(d => {
      const setorName = setores[d.setor] || d.setor;
      demandaBySetor[setorName] = (demandaBySetor[setorName] || 0) + 1;
    });

    const setorChart = Object.entries(demandaBySetor).map(([setor, count]) => ({
      name: setor,
      value: count
    }));

    // Demandas por status
    const statusChart = Object.keys(statusColors).map(status => ({
      name: statusColors[status].label,
      value: filteredDemandas.filter(d => d.status === status).length
    })).filter(s => s.value > 0);

    // Demandas concluídas por setor
    const concluidasBySetor = {};
    filteredDemandas.forEach(d => {
      if (d.status === 'concluida') {
        const setorName = setores[d.setor] || d.setor;
        concluidasBySetor[setorName] = (concluidasBySetor[setorName] || 0) + 1;
      }
    });

    const concluidasSetorChart = Object.entries(concluidasBySetor).map(([setor, count]) => ({
      name: setor,
      value: count
    }));

    // Demandas não concluídas por setor
    const naoConcluidasBySetor = {};
    filteredDemandas.forEach(d => {
      if (d.status !== 'concluida') {
        const setorName = setores[d.setor] || d.setor;
        naoConcluidasBySetor[setorName] = (naoConcluidasBySetor[setorName] || 0) + 1;
      }
    });

    const naoConcluidasSetorChart = Object.entries(naoConcluidasBySetor).map(([setor, count]) => ({
      name: setor,
      value: count
    }));

    return {
      total,
      abertas,
      concluidas,
      altaPrioridade,
      avgCompletionBySetor: avgCompletionBySetor.sort((a, b) => a.avgDias - b.avgDias),
      setorChart,
      statusChart,
      concluidasSetorChart,
      naoConcluidasSetorChart
    };
  }, [filteredDemandas, setores]);

  // Demandas críticas (prazo vencendo em 3 dias)
  const demandasCriticas = useMemo(() => {
    return filteredDemandas
      .filter(d => ['recebida', 'em_triagem', 'em_execucao', 'aguardando_cliente', 'em_revisao'].includes(d.status))
      .filter(d => d.previsao_entrega)
      .map(d => ({
        ...d,
        diasParaVencimento: differenceInDays(new Date(d.previsao_entrega), new Date())
      }))
      .filter(d => d.diasParaVencimento <= 3 && d.diasParaVencimento >= 0)
      .sort((a, b) => a.diasParaVencimento - b.diasParaVencimento)
      .slice(0, 10);
  }, [filteredDemandas]);

  // Últimas demandas concluídas
  const ultimasConcluidas = useMemo(() => {
    return filteredDemandas
      .filter(d => d.status === 'concluida')
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
      .slice(0, 5);
  }, [filteredDemandas]);

  // Demandas por usuário (responsável)
  const demandasByUser = useMemo(() => {
    const users = {};
    filteredDemandas.forEach(d => {
      if (d.created_by) {
        users[d.created_by] = (users[d.created_by] || 0) + 1;
      }
    });
    return Object.entries(users)
      .map(([user, count]) => ({ user: user.split('@')[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filteredDemandas]);

  if (isLoading) {
    return <div className="text-center py-8">Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtro de Datas */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filtrar por período de criação:</span>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">De</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="h-8 text-slate-500 hover:text-slate-700"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            {(dateFrom || dateTo) && (
              <span className="text-xs text-violet-600 font-medium">
                Mostrando {filteredDemandas.length} de {demandas.length} demandas
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Demandas</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Abertas</p>
                <p className="text-3xl font-bold mt-2 text-orange-600">{stats.abertas}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Concluídas</p>
                <p className="text-3xl font-bold mt-2 text-green-600">{stats.concluidas}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Alta Prioridade</p>
                <p className="text-3xl font-bold mt-2 text-red-600">{stats.altaPrioridade}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demandas por Setor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demandas por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.setorChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={stats.statusChart} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {stats.statusChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#3b82f6', '#f59e0b', '#a855f7', '#f97316', '#06b6d4', '#10b981'][index % 6]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Demandas Concluídas por Setor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demandas Concluídas por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.concluidasSetorChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Demandas Não Concluídas por Setor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demandas Não Concluídas por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.naoConcluidasSetorChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tempo Médio de Conclusão e Demandas por Usuário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tempo Médio de Conclusão (dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.avgCompletionBySetor.length > 0 ? (
                stats.avgCompletionBySetor.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.setor}</p>
                      <p className="text-xs text-gray-500">{item.total} demandas concluídas</p>
                    </div>
                    <Badge className={item.avgDias <= 3 ? 'bg-green-100 text-green-800' : item.avgDias <= 7 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                      {item.avgDias}d
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma demanda concluída</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Demandantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {demandasByUser.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <p className="font-medium text-sm capitalize">{item.user}</p>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demandas Críticas */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Demandas com Prazo Crítico (próximas 3 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demandasCriticas.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {demandasCriticas.map(d => (
                <div key={d.id} className="flex items-start justify-between p-3 bg-white border border-red-200 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{d.titulo}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge className={statusColors[d.status].bg + ' ' + statusColors[d.status].text}>{statusColors[d.status].label}</Badge>
                      <Badge className={d.prioridade === 'alta' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>{prioridades[d.prioridade].label}</Badge>
                      {d.setor && <Badge variant="outline">{setores[d.setor] || d.setor}</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-red-100 text-red-800">
                      {d.diasParaVencimento === 0 ? 'Vence hoje!' : `${d.diasParaVencimento}d`}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">{format(new Date(d.previsao_entrega), 'dd/MM', { locale: ptBR })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Nenhuma demanda com prazo crítico</p>
          )}
        </CardContent>
      </Card>

      {/* Últimas Concluídas */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Últimas Demandas Concluídas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ultimasConcluidas.length > 0 ? (
            <div className="space-y-3">
              {ultimasConcluidas.map(d => (
                <div key={d.id} className="flex items-start justify-between p-3 bg-white border border-green-200 rounded">
                  <div>
                    <p className="font-medium text-sm">{d.titulo}</p>
                    <p className="text-xs text-gray-500 mt-1">{setores[d.setor] || d.setor}</p>
                  </div>
                  <p className="text-xs text-gray-500">{format(new Date(d.updated_date), 'dd/MM HH:mm', { locale: ptBR })}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Nenhuma demanda concluída</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}