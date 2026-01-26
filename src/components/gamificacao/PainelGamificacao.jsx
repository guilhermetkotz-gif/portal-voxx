import React from 'react';
import MissoesDoDia from './MissoesDoDia';
import ChecklistRotina from './ChecklistRotina';
import ScoreProgresso from './ScoreProgresso';
import RankingSemanal from './RankingSemanal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, Info } from 'lucide-react';

export default function PainelGamificacao({ user }) {
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6" />
            Painel de Gamificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-violet-100">
            Complete missões, registre ações e ganhe pontos para subir no ranking.
            Missões são geradas automaticamente com base nas contas prioritárias.
          </p>
        </CardContent>
      </Card>

      {/* Score e Progresso */}
      <ScoreProgresso user={user} />

      {/* Missões e Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MissoesDoDia user={user} />
        <ChecklistRotina user={user} />
      </div>

      {/* Ranking */}
      <RankingSemanal user={user} />

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 space-y-1">
              <p><strong>Como funciona:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Missões críticas valem mais pontos (50 pts)</li>
                <li>Complete o checklist diário para ganhar bônus (+20 pts)</li>
                <li>Mantenha uma sequência de dias ativos (streak) para ganhar badges</li>
                <li>O ranking prioriza consistência e execução, não apenas resultados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}