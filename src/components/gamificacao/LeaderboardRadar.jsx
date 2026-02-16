import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Target, Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function LeaderboardRadar({ responsaveis }) {
  const [periodo, setPeriodo] = useState('semana');

  const dataInicio = React.useMemo(() => {
    if (periodo === 'semana') return moment().subtract(7, 'days').format('YYYY-MM-DD');
    if (periodo === 'mes') return moment().subtract(30, 'days').format('YYYY-MM-DD');
    return moment().startOf('year').format('YYYY-MM-DD');
  }, [periodo]);

  const { data: todasMissoes = [] } = useQuery({
    queryKey: ['todasMissoesRadar', periodo, dataInicio],
    queryFn: async () => {
      const missoes = await base44.entities.GamificacaoMissaoRadar.list('-created_date', 1000);
      return missoes.filter(m => m.data_missao >= dataInicio);
    },
    staleTime: 2 * 60 * 1000
  });

  const { data: progressos = [] } = useQuery({
    queryKey: ['progressosGamificacao'],
    queryFn: () => base44.entities.GamificacaoProgresso.list('-pontos_semana', 50),
    staleTime: 2 * 60 * 1000
  });

  const ranking = React.useMemo(() => {
    // Agrupar missões por responsável
    const statsPorResponsavel = {};

    todasMissoes.forEach(missao => {
      const email = missao.responsavel_email;
      if (!statsPorResponsavel[email]) {
        statsPorResponsavel[email] = {
          email,
          nome: missao.responsavel_nome || email,
          total: 0,
          concluidas: 0,
          criticas: 0,
          criticasConcluidas: 0,
          naoAplicaveis: 0,
          pontosGanhos: 0,
          tempos: []
        };
      }

      const stats = statsPorResponsavel[email];
      stats.total++;
      
      if (missao.status === 'concluida') {
        stats.concluidas++;
        stats.pontosGanhos += missao.pontos_ganhos || 0;
        if (missao.tempo_conclusao_minutos > 0) {
          stats.tempos.push(missao.tempo_conclusao_minutos);
        }
      }
      
      if (missao.status === 'nao_aplicavel') {
        stats.naoAplicaveis++;
      }
      
      if (missao.prioridade_radar === 'critica') {
        stats.criticas++;
        if (missao.status === 'concluida') {
          stats.criticasConcluidas++;
        }
      }
    });

    // Buscar streak e badges do progresso
    const rankingArray = Object.values(statsPorResponsavel).map(stats => {
      const progresso = progressos.find(p => p.analista_id === stats.email || p.analista_nome === stats.nome);
      
      return {
        ...stats,
        taxaConclusao: stats.total > 0 ? (stats.concluidas / stats.total) * 100 : 0,
        taxaNaoAplicavel: stats.total > 0 ? (stats.naoAplicaveis / stats.total) * 100 : 0,
        taxaCriticasConcluidas: stats.criticas > 0 ? (stats.criticasConcluidas / stats.criticas) * 100 : 0,
        tempoMedio: stats.tempos.length > 0 
          ? stats.tempos.reduce((sum, t) => sum + t, 0) / stats.tempos.length
          : 0,
        streak: progresso?.streak_atual || 0,
        badges: progresso?.badges?.length || 0
      };
    });

    // Ordenar por:
    // 1. Taxa de conclusão (mínimo 5 missões)
    // 2. Missões críticas concluídas
    // 3. Consistência (streak)
    rankingArray.sort((a, b) => {
      // Critério 1: Taxa de conclusão (se tiver pelo menos 5 missões)
      if (a.total >= 5 && b.total >= 5) {
        if (Math.abs(a.taxaConclusao - b.taxaConclusao) > 5) {
          return b.taxaConclusao - a.taxaConclusao;
        }
      }
      
      // Critério 2: Missões críticas concluídas (absoluto)
      if (a.criticasConcluidas !== b.criticasConcluidas) {
        return b.criticasConcluidas - a.criticasConcluidas;
      }
      
      // Critério 3: Streak (consistência)
      if (a.streak !== b.streak) {
        return b.streak - a.streak;
      }
      
      // Critério 4: Pontos totais
      return b.pontosGanhos - a.pontosGanhos;
    });

    return rankingArray.map((r, index) => ({ ...r, posicao: index + 1 }));
  }, [todasMissoes, progressos]);

  const getPosicaoIcon = (posicao) => {
    switch (posicao) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-slate-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return <span className="text-lg font-bold text-slate-400">#{posicao}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtro de Período */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Período:</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Última Semana</SelectItem>
                <SelectItem value="mes">Último Mês</SelectItem>
                <SelectItem value="ano">Ano Atual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Performance do Time - {periodo === 'semana' ? 'Semana' : periodo === 'mes' ? 'Mês' : 'Ano'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhum dado disponível</p>
          ) : (
            <div className="space-y-3">
              {ranking.map((analista) => (
                <div
                  key={analista.email}
                  className={cn(
                    "p-4 rounded-lg transition-all",
                    analista.posicao === 1 ? "bg-yellow-50 border-2 border-yellow-300" :
                    analista.posicao === 2 ? "bg-slate-50 border-2 border-slate-300" :
                    analista.posicao === 3 ? "bg-orange-50 border-2 border-orange-300" :
                    "bg-white border border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 flex justify-center">
                      {getPosicaoIcon(analista.posicao)}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{analista.nome}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-xs">
                        <div>
                          <p className="text-slate-500">Taxa Conclusão</p>
                          <p className={cn(
                            "font-bold text-lg",
                            analista.taxaConclusao >= 80 ? "text-green-600" :
                            analista.taxaConclusao >= 60 ? "text-yellow-600" :
                            "text-red-600"
                          )}>
                            {analista.taxaConclusao.toFixed(0)}%
                          </p>
                          <p className="text-slate-400">{analista.concluidas}/{analista.total}</p>
                        </div>

                        <div>
                          <p className="text-slate-500">Críticas ✅</p>
                          <p className="font-bold text-lg text-red-600">
                            {analista.criticasConcluidas}
                          </p>
                          <p className="text-slate-400">
                            {analista.taxaCriticasConcluidas.toFixed(0)}% de {analista.criticas}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500">Streak</p>
                          <p className="font-bold text-lg text-orange-600 flex items-center gap-1">
                            <Flame className="w-4 h-4" />
                            {analista.streak}
                          </p>
                          <p className="text-slate-400">dias</p>
                        </div>

                        <div>
                          <p className="text-slate-500">Tempo Médio</p>
                          <p className="font-bold text-lg text-blue-600">
                            {analista.tempoMedio.toFixed(0)}
                          </p>
                          <p className="text-slate-400">minutos</p>
                        </div>

                        <div>
                          <p className="text-slate-500">Pontos</p>
                          <p className="font-bold text-lg text-violet-600">
                            {analista.pontosGanhos}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      {analista.badges > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Award className="w-4 h-4 text-amber-500" />
                          <span className="text-xs text-slate-600">{analista.badges} badges</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alerta de qualidade */}
                  {analista.taxaNaoAplicavel > 30 && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      ⚠️ Taxa de "não aplicável" alta ({analista.taxaNaoAplicavel.toFixed(0)}%) - revisar critério de missões
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Ranking baseado em: <strong>Taxa de Conclusão</strong> → <strong>Missões Críticas</strong> → <strong>Consistência (Streak)</strong> → <strong>Pontos</strong>
            </p>
            <p className="text-xs text-slate-400 text-center mt-1">
              Não considera faturamento ou leads para garantir justiça entre diferentes portfolios
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}