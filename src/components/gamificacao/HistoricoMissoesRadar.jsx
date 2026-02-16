import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function HistoricoMissoesRadar({ user, responsavelEmail, visualizarComoGestor }) {
  const [periodo, setPeriodo] = useState('semana');
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas');

  const dataInicio = React.useMemo(() => {
    if (periodo === 'semana') return moment().subtract(7, 'days').format('YYYY-MM-DD');
    if (periodo === 'mes') return moment().subtract(30, 'days').format('YYYY-MM-DD');
    return moment().subtract(90, 'days').format('YYYY-MM-DD');
  }, [periodo]);

  const { data: missoes = [], isLoading } = useQuery({
    queryKey: ['historicoMissoesRadar', responsavelEmail, periodo, dataInicio],
    queryFn: async () => {
      const allMissoes = await base44.entities.GamificacaoMissaoRadar.filter({
        responsavel_email: responsavelEmail
      }, '-created_date', 200);
      
      return allMissoes.filter(m => m.data_missao >= dataInicio);
    },
    enabled: !!responsavelEmail,
    staleTime: 2 * 60 * 1000
  });

  const missoesFiltradas = React.useMemo(() => {
    let filtered = missoes;
    
    if (filtroStatus !== 'todas') {
      filtered = filtered.filter(m => m.status === filtroStatus);
    }
    
    if (filtroPrioridade !== 'todas') {
      filtered = filtered.filter(m => m.prioridade_radar === filtroPrioridade);
    }
    
    return filtered;
  }, [missoes, filtroStatus, filtroPrioridade]);

  const stats = React.useMemo(() => {
    const total = missoes.length;
    const concluidas = missoes.filter(m => m.status === 'concluida').length;
    const naoAplicaveis = missoes.filter(m => m.status === 'nao_aplicavel').length;
    const criticas = missoes.filter(m => m.prioridade_radar === 'critica').length;
    const criticasConcluidas = missoes.filter(m => m.prioridade_radar === 'critica' && m.status === 'concluida').length;
    const pontosTotais = missoes.reduce((sum, m) => sum + (m.pontos_ganhos || 0), 0);
    
    const temposMissoes = missoes
      .filter(m => m.tempo_conclusao_minutos > 0)
      .map(m => m.tempo_conclusao_minutos);
    const tempoMedio = temposMissoes.length > 0 
      ? temposMissoes.reduce((sum, t) => sum + t, 0) / temposMissoes.length
      : 0;

    return {
      total,
      concluidas,
      naoAplicaveis,
      taxaConclusao: total > 0 ? ((concluidas / total) * 100).toFixed(1) : 0,
      criticas,
      criticasConcluidas,
      taxaCriticasConcluidas: criticas > 0 ? ((criticasConcluidas / criticas) * 100).toFixed(1) : 0,
      pontosTotais,
      tempoMedio: tempoMedio.toFixed(0)
    };
  }, [missoes]);

  const getPrioridadeColor = (tipo) => {
    switch (tipo) {
      case 'critica': return 'bg-red-100 text-red-800';
      case 'alta': return 'bg-orange-100 text-orange-800';
      case 'media': return 'bg-yellow-100 text-yellow-800';
      case 'baixa': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'concluida': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'nao_aplicavel': return <XCircle className="w-4 h-4 text-slate-400" />;
      case 'em_execucao': return <Clock className="w-4 h-4 text-blue-600" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* KPIs do Período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 mb-1">Taxa de Conclusão</p>
            <p className="text-3xl font-bold text-violet-600">{stats.taxaConclusao}%</p>
            <p className="text-xs text-slate-600 mt-1">
              {stats.concluidas}/{stats.total} missões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 mb-1">Críticas Concluídas</p>
            <p className="text-3xl font-bold text-red-600">{stats.criticasConcluidas}</p>
            <p className="text-xs text-slate-600 mt-1">
              {stats.taxaCriticasConcluidas}% de {stats.criticas}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 mb-1">Pontos Ganhos</p>
            <p className="text-3xl font-bold text-amber-600">{stats.pontosTotais}</p>
            <p className="text-xs text-slate-600 mt-1">no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500 mb-1">Tempo Médio</p>
            <p className="text-3xl font-bold text-blue-600">{stats.tempoMedio}</p>
            <p className="text-xs text-slate-600 mt-1">minutos/missão</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Último Mês</SelectItem>
                <SelectItem value="trimestre">Último Trimestre</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos Status</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
                <SelectItem value="nao_aplicavel">Não Aplicável</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Prioridades</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Missões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-violet-600" />
            Histórico de Missões ({missoesFiltradas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-slate-500 py-8">Carregando...</p>
          ) : missoesFiltradas.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhuma missão encontrada</p>
          ) : (
            <div className="space-y-3">
              {missoesFiltradas.map((missao) => (
                <div
                  key={missao.id}
                  className={cn(
                    "p-4 rounded-lg border",
                    missao.status === 'concluida' ? 'bg-green-50 border-green-200' :
                    missao.status === 'nao_aplicavel' ? 'bg-slate-50 border-slate-200' :
                    'bg-white border-slate-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getStatusIcon(missao.status)}
                        <h4 className="font-semibold text-slate-900">{missao.unidade_nome}</h4>
                        <Badge className={cn("text-xs", getPrioridadeColor(missao.prioridade_radar))}>
                          {missao.prioridade_radar}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {moment(missao.data_missao).format('DD/MM/YYYY')}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-700 mb-2">{missao.motivo}</p>
                      
                      {missao.status === 'concluida' && (
                        <div className="mt-3 p-3 bg-white rounded border border-green-200">
                          <p className="text-xs font-medium text-green-900 mb-1">Ação Aplicada:</p>
                          <p className="text-sm text-slate-700">{missao.acao_aplicada}</p>
                          {missao.descricao_acao && (
                            <p className="text-xs text-slate-600 mt-2">{missao.descricao_acao}</p>
                          )}
                          {missao.tempo_conclusao_minutos > 0 && (
                            <p className="text-xs text-slate-500 mt-2">
                              ⏱ Tempo de conclusão: {missao.tempo_conclusao_minutos} min
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {missao.pontos_ganhos > 0 && (
                      <Badge className="bg-amber-500 text-white">
                        +{missao.pontos_ganhos} pts
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}