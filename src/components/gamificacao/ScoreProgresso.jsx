import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Zap, Target, Award, TrendingUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const BADGES_CONFIG = {
  consistente_7: { icon: Flame, label: 'Consistente', desc: '7 dias seguidos', color: 'bg-orange-100 text-orange-800' },
  consistente_14: { icon: Flame, label: 'Super Consistente', desc: '14 dias seguidos', color: 'bg-orange-100 text-orange-800' },
  executor_20: { icon: Zap, label: 'Executor', desc: '20 missões/semana', color: 'bg-blue-100 text-blue-800' },
  executor_40: { icon: Zap, label: 'Super Executor', desc: '40 missões/semana', color: 'bg-blue-100 text-blue-800' },
  recuperacao: { icon: TrendingUp, label: 'Recuperação', desc: 'Virou crítica em média', color: 'bg-green-100 text-green-800' },
  organizado: { icon: Target, label: 'Organizado', desc: '100% checklist 5 dias', color: 'bg-purple-100 text-purple-800' }
};

export default function ScoreProgresso({ user }) {
  const { data: progresso } = useQuery({
    queryKey: ['progressoGamificacao', user?.id],
    queryFn: async () => {
      const progressos = await base44.entities.GamificacaoProgresso.filter({
        analista_id: user?.id
      });
      return progressos[0] || {
        pontos_dia: 0,
        pontos_semana: 0,
        pontos_total: 0,
        streak_atual: 0,
        badges: []
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000
  });

  const badgesConquistados = progresso?.badges || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Card Principal de Pontos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            Score & Progresso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600">Pontos Hoje</p>
                <p className="text-3xl font-bold text-violet-600">{progresso?.pontos_dia || 0}</p>
              </div>
              <Trophy className="w-10 h-10 text-violet-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">Semana</p>
                <p className="text-2xl font-bold text-slate-900">{progresso?.pontos_semana || 0}</p>
                <p className="text-xs text-slate-500">pontos</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-slate-900">{progresso?.pontos_total || 0}</p>
                <p className="text-xs text-slate-500">pontos</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <Flame className="w-6 h-6 text-orange-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900">Streak Atual</p>
                <p className="text-xs text-orange-700">{progresso?.streak_atual || 0} dias consecutivos</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">{progresso?.streak_atual || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Badges Conquistados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {badgesConquistados.length === 0 ? (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nenhum badge conquistado ainda</p>
              <p className="text-xs text-slate-400 mt-1">Complete missões para ganhar badges!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {badgesConquistados.map((badgeKey) => {
                const badge = BADGES_CONFIG[badgeKey];
                if (!badge) return null;
                
                const Icon = badge.icon;
                return (
                  <div
                    key={badgeKey}
                    className={cn(
                      "p-3 rounded-lg border-2 flex flex-col items-center text-center",
                      badge.color
                    )}
                  >
                    <Icon className="w-8 h-8 mb-2" />
                    <p className="font-semibold text-sm">{badge.label}</p>
                    <p className="text-xs opacity-80 mt-1">{badge.desc}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Próximos Badges */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-600 mb-2">Próximos Badges:</p>
            <div className="space-y-2">
              {Object.entries(BADGES_CONFIG)
                .filter(([key]) => !badgesConquistados.includes(key))
                .slice(0, 3)
                .map(([key, badge]) => {
                  const Icon = badge.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                      <Icon className="w-4 h-4 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-700">{badge.label}</p>
                        <p className="text-xs text-slate-500">{badge.desc}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}