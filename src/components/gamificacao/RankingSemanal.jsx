import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import moment from 'moment';

export default function RankingSemanal({ user }) {
  const semanaAtual = moment().format('GGGG-WW');

  const { data: ranking = [] } = useQuery({
    queryKey: ['rankingGamificacao', semanaAtual],
    queryFn: async () => {
      const progressos = await base44.entities.GamificacaoProgresso.filter({
        semana_atual: semanaAtual
      }, '-pontos_semana', 10);
      
      return progressos.map((p, index) => ({
        ...p,
        posicao: index + 1
      }));
    },
    staleTime: 2 * 60 * 1000
  });

  const getPosicaoIcon = (posicao) => {
    switch (posicao) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-slate-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600" />;
      default:
        return null;
    }
  };

  const minhaPos icao = ranking.findIndex(r => r.analista_id === user?.id) + 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Ranking Semanal
          </CardTitle>
          {minhaPosicao > 0 && (
            <Badge className="bg-violet-600 text-white">
              Você está em #{minhaPosicao}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Nenhum dado de ranking disponível</p>
        ) : (
          <div className="space-y-3">
            {ranking.map((analista) => {
              const euMesmo = analista.analista_id === user?.id;
              return (
                <div
                  key={analista.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    euMesmo ? "bg-violet-50 border-2 border-violet-300" : "bg-slate-50 border border-slate-200",
                    analista.posicao <= 3 && !euMesmo && "border-2"
                  )}
                >
                  <div className="w-8 flex justify-center">
                    {getPosicaoIcon(analista.posicao) || (
                      <span className="text-lg font-bold text-slate-400">#{analista.posicao}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "font-semibold",
                      euMesmo ? "text-violet-900" : "text-slate-900"
                    )}>
                      {analista.analista_nome}
                      {euMesmo && <span className="text-violet-600 ml-2">(Você)</span>}
                    </p>
                    <div className="flex gap-3 text-xs text-slate-600 mt-1">
                      <span>{analista.missoes_concluidas_semana || 0} missões</span>
                      <span>•</span>
                      <span>{analista.acoes_registradas_semana || 0} ações</span>
                      <span>•</span>
                      <span>Streak: {analista.streak_atual || 0}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-2xl font-bold",
                      euMesmo ? "text-violet-600" : "text-slate-900"
                    )}>
                      {analista.pontos_semana || 0}
                    </p>
                    <p className="text-xs text-slate-500">pontos</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            Ranking baseado em execução, consistência e registro de ações
          </p>
        </div>
      </CardContent>
    </Card>
  );
}