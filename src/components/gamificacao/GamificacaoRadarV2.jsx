import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gamepad2, User, TrendingUp } from 'lucide-react';
import moment from 'moment';

import MinhasMissoesRadar from '@/components/gamificacao/MinhasMissoesRadar';
import HistoricoMissoesRadar from '@/components/gamificacao/HistoricoMissoesRadar';
import LeaderboardRadar from '@/components/gamificacao/LeaderboardRadar';
import ScoreProgresso from '@/components/gamificacao/ScoreProgresso';

export default function GamificacaoRadarV2({ user }) {
  const [periodo, setPeriodo] = useState('dia');
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(user?.email || '');

  const isVoxx = user?.role === 'admin' || user?.tipo_acesso?.startsWith('voxx_');
  const isGestor = user?.tipo_acesso === 'voxx_admin' || user?.tipo_acesso === 'voxx_manager';

  // Buscar todos os responsáveis únicos do RADAR META
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesRadar'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    enabled: isVoxx,
    staleTime: 5 * 60 * 1000
  });

  const responsaveisUnicos = React.useMemo(() => {
    const emails = new Set();
    clientes.forEach(c => {
      if (c.responsavel_voxx_trafego) {
        emails.add(c.responsavel_voxx_trafego);
      }
    });
    return Array.from(emails).sort();
  }, [clientes]);

  // Buscar dados dos usuários responsáveis
  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxxUsers'],
    queryFn: async () => {
      const response = await base44.functions.invoke('listVoxxUsers', {});
      return response.data?.users || [];
    },
    enabled: isVoxx,
    staleTime: 5 * 60 * 1000
  });

  const responsaveisComDados = React.useMemo(() => {
    return responsaveisUnicos
      .map(email => {
        const userData = voxxUsers.find(u => u.email === email);
        return {
          email,
          nome: userData?.full_name || email,
          id: userData?.id || email
        };
      })
      .filter(r => r.email);
  }, [responsaveisUnicos, voxxUsers]);

  if (!isVoxx) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-600">
          Gamificação disponível apenas para equipe Voxx
        </p>
      </Card>
    );
  }

  const visualizarComoGestor = isGestor && responsavelSelecionado !== user?.email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Gamepad2 className="w-6 h-6" />
            Gamificação RADAR META V2
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-violet-100">
            Missões geradas automaticamente com base no RADAR META. Complete ações, registre resultados e acompanhe sua performance.
          </p>
        </CardContent>
      </Card>

      {/* Seletor de Responsável (apenas para gestores) */}
      {isGestor && responsaveisComDados.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <User className="w-5 h-5 text-violet-600" />
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Visualizar como:
                </label>
                <Select value={responsavelSelecionado} onValueChange={setResponsavelSelecionado}>
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.email}>
                      {user?.full_name || user?.email} (Você)
                    </SelectItem>
                    {responsaveisComDados
                      .filter(r => r.email !== user?.email)
                      .map(resp => (
                        <SelectItem key={resp.email} value={resp.email}>
                          {resp.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score e Progresso */}
      <ScoreProgresso user={user} />

      {/* Tabs */}
      <Tabs defaultValue="missoes" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="missoes">Minhas Missões</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="leaderboard">Performance do Time</TabsTrigger>
        </TabsList>

        <TabsContent value="missoes" className="mt-6">
          <MinhasMissoesRadar 
            user={user} 
            responsavelEmail={responsavelSelecionado}
            visualizarComoGestor={visualizarComoGestor}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <HistoricoMissoesRadar 
            user={user}
            responsavelEmail={responsavelSelecionado}
            visualizarComoGestor={visualizarComoGestor}
          />
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-6">
          <LeaderboardRadar 
            responsaveis={responsaveisComDados}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}