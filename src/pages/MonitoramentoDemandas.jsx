import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Users, FileText, TrendingUp } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const setores = {
  TRAFEGO_META: 'Tráfego Meta',
  TRAFEGO_GOOGLE: 'Tráfego Google',
  TRAFEGO_TIKTOK: 'Tráfego TikTok',
  CRIACAO: 'Criação',
  EDICAO: 'Edição',
  BI_RELATORIO: 'BI & Relatório',
  IMPLANTACAO: 'Implantação',
  FINANCEIRO: 'Financeiro',
  ALTERACAO_CRIACAO: 'Alteração Criação',
  AUTOMACAO: 'Automação',
  SALDOS: 'Saldos'
};

export default function MonitoramentoDemandas({ selectedClienteId }) {
  const [filterSetor, setFilterSetor] = useState(null);

  // Fetch all demandas
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas', selectedClienteId],
    queryFn: () => base44.entities.Demanda.filter({ cliente_id: selectedClienteId }, '-created_date', 500),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  // Fetch timeline events for completion time analysis
  const { data: events = [] } = useQuery({
    queryKey: ['timelineEvents', selectedClienteId],
    queryFn: () => base44.entities.TimelineEvent.filter({ cliente_id: selectedClienteId }, '-created_date', 1000),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const total = demandas.length;
    const abertas = demandas.filter(d => ['recebida', 'em_triagem', 'em_execucao', 'aguardando_cliente', 'em_revisao'].includes(d.status)).length;
    const concluidas = demandas.filter(d => d.status === 'concluida').length;
    const altaPrioridade = demandas.filter(d => d.prioridade === 'alta').length;

    // Calculate average completion time by setor
    const completionBySetor = {};
    demandas.forEach(demanda => {
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
    demandas.forEach(d => {
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
      value: demandas.filter(d => d.status === status).length
    })).filter(s => s.value > 0);

    return {
      total,
      abertas,
      concluidas,
      altaPrioridade,
      avgCompletionBySetor: avgCompletionBySetor.sort((a, b) => a.avgDias - b.avgDias),
      setorChart,
      statusChart
    };
  }, [demandas]);

  // Demandas críticas (prazo vencendo em 3 dias)
  const demandasCriticas = useMemo(() => {
    return demandas
      .filter(d => ['recebida', 'em_triagem', 'em_execucao', 'aguardando_cliente', 'em_revisao'].includes(d.status))
      .filter(d => d.previsao_entrega)
      .map(d => ({
        ...d,
        diasParaVencimento: differenceInDays(new Date(d.previsao_entrega), new Date())
      }))
      .filter(d => d.diasParaVencimento <= 3 && d.diasParaVencimento >= 0)
      .sort((a, b) => a.diasParaVencimento - b.diasParaVencimento)
      .slice(0, 10);
  }, [demandas]);

  // Últimas demandas concluídas
  const ultimasConcluidas = useMemo(() => {
    return demandas
      .filter(d => d.status === 'concluida')
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
      .slice(0, 5);
  }, [demandas]);

  // Demandas por usuário (responsável)
  const demandasByUser = useMemo(() => {
    const users = {};
    demandas.forEach(d => {
      if (d.created_by) {
        users[d.created_by] = (users[d.created_by] || 0) + 1;
      }
    });
    return Object.entries(users)
      .map(([user, count]) => ({ user: user.split('@')[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [demandas]);

  const filteredDemandas = filterSetor 
    ? demandas.filter(d => d.setor === filterSetor)
    : demandas;

  if (isLoading) {
    return <div className="text-center py-8">Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
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