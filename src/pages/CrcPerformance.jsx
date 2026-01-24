import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Phone, Calendar, TrendingUp, Clock, 
  AlertTriangle, CheckCircle, XCircle, Loader2 
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import KPICard from '@/components/ui/KPICard';

export default function CrcPerformance({ currentCliente, user }) {
  const [dateRange, setDateRange] = useState(30);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crcLeads', currentCliente?.id],
    queryFn: () => base44.entities.CrcLead.filter({ 
      unidade_id: currentCliente?.id 
    }, '-data_chegada', 1000),
    enabled: !!currentCliente?.id
  });

  const { data: tentativas = [] } = useQuery({
    queryKey: ['allCrcTentativas', currentCliente?.id],
    queryFn: async () => {
      const allLeadIds = leads.map(l => l.id);
      if (allLeadIds.length === 0) return [];
      
      const allTentativas = await Promise.all(
        allLeadIds.map(id => base44.entities.CrcTentativa.filter({ lead_id: id }, '-data_hora', 100))
      );
      return allTentativas.flat();
    },
    enabled: leads.length > 0
  });

  const { data: config } = useQuery({
    queryKey: ['crcConfig', currentCliente?.id],
    queryFn: async () => {
      const configs = await base44.entities.CrcConfig.filter({ 
        unidade_id: currentCliente?.id 
      });
      return configs[0] || { max_tentativas_recomendado: 6 };
    },
    enabled: !!currentCliente?.id
  });

  if (!currentCliente) {
    return <div className="text-center py-12 text-slate-500">Selecione uma unidade</div>;
  }

  const startDate = subDays(new Date(), dateRange);
  const filteredLeads = leads.filter(l => new Date(l.data_chegada) >= startDate);

  // KPIs
  const totalLeads = filteredLeads.length;
  const manuais = filteredLeads.filter(l => l.fonte_cadastro === 'manual').length;
  const google = filteredLeads.filter(l => l.fonte_cadastro === 'google_sheet').length;
  const semContato = filteredLeads.filter(l => l.status === 'sem_contato').length;
  const contatados = filteredLeads.filter(l => (l.qtd_tentativas || 0) > 0).length;
  const agendados = filteredLeads.filter(l => l.status === 'agendou').length;
  const compareceram = filteredLeads.filter(l => l.status === 'compareceu').length;
  const perdas = filteredLeads.filter(l => l.status === 'perda').length;

  const percSemContato = totalLeads > 0 ? ((semContato / totalLeads) * 100).toFixed(1) : 0;
  const percContatados = totalLeads > 0 ? ((contatados / totalLeads) * 100).toFixed(1) : 0;
  const percAgendou = totalLeads > 0 ? ((agendados / totalLeads) * 100).toFixed(1) : 0;
  const percCompareceu = totalLeads > 0 ? ((compareceram / totalLeads) * 100).toFixed(1) : 0;
  const percPerda = totalLeads > 0 ? ((perdas / totalLeads) * 100).toFixed(1) : 0;

  // Tempo médio 1ª tentativa
  const leadsComTempo = filteredLeads.filter(l => l.tempo_primeira_resposta_min);
  const tempoMedio = leadsComTempo.length > 0 
    ? Math.round(leadsComTempo.reduce((acc, l) => acc + l.tempo_primeira_resposta_min, 0) / leadsComTempo.length)
    : 0;

  // Tentativas por lead
  const mediaTentativas = totalLeads > 0 
    ? (filteredLeads.reduce((acc, l) => acc + (l.qtd_tentativas || 0), 0) / totalLeads).toFixed(1)
    : 0;

  // Backlog crítico
  const backlogCritico = filteredLeads.filter(l => l.status === 'sem_contato' && l.sla_atrasado);
  const muitasTentativas = filteredLeads.filter(l => (l.qtd_tentativas || 0) > (config?.max_tentativas_recomendado || 6));

  // Perdas por motivo
  const perdasPorMotivo = filteredLeads
    .filter(l => l.status === 'perda' && l.motivo_perda)
    .reduce((acc, l) => {
      acc[l.motivo_perda] = (acc[l.motivo_perda] || 0) + 1;
      return acc;
    }, {});

  // Agendados para confirmar (próximos 2 dias)
  const hoje = new Date();
  const doisDias = new Date();
  doisDias.setDate(doisDias.getDate() + 2);
  const agendadosProximos = filteredLeads.filter(l => 
    l.status === 'agendou' && 
    l.data_agendamento && 
    new Date(l.data_agendamento) <= doisDias && 
    new Date(l.data_agendamento) >= hoje
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">CRC - Performance</h2>
          <p className="text-sm text-slate-600 mt-1">Indicadores e gestão operacional</p>
        </div>
        <div className="flex gap-2">
          <Button variant={dateRange === 7 ? 'default' : 'outline'} onClick={() => setDateRange(7)}>
            7 dias
          </Button>
          <Button variant={dateRange === 30 ? 'default' : 'outline'} onClick={() => setDateRange(30)}>
            30 dias
          </Button>
          <Button variant={dateRange === 90 ? 'default' : 'outline'} onClick={() => setDateRange(90)}>
            90 dias
          </Button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Leads Recebidos"
          value={totalLeads}
          subtitle={`${manuais} manuais • ${google} Google`}
          icon={Users}
          variant="primary"
        />
        <KPICard
          title="Taxa de Contato"
          value={`${percContatados}%`}
          subtitle={`${contatados} de ${totalLeads} contatados`}
          icon={Phone}
          variant={percContatados >= 70 ? 'success' : 'warning'}
        />
        <KPICard
          title="Taxa de Agendamento"
          value={`${percAgendou}%`}
          subtitle={`${agendados} agendados`}
          icon={Calendar}
          variant="default"
        />
        <KPICard
          title="Taxa de Comparecimento"
          value={`${percCompareceu}%`}
          subtitle={`${compareceram} compareceram`}
          icon={CheckCircle}
          variant={percCompareceu >= 60 ? 'success' : 'warning'}
        />
      </div>

      {/* Métricas Operacionais */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-slate-900">Tempo Médio 1ª Tentativa</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{tempoMedio} min</p>
          <p className="text-sm text-slate-600 mt-1">
            {leadsComTempo.length} leads com registro
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-slate-900">Tentativas por Lead</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{mediaTentativas}x</p>
          <p className="text-sm text-slate-600 mt-1">Média geral</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-slate-900">Taxa de Perda</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{percPerda}%</p>
          <p className="text-sm text-slate-600 mt-1">{perdas} leads perdidos</p>
        </Card>
      </div>

      {/* Funil de Conversão */}
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Funil de Conversão</h3>
        <div className="space-y-3">
          <FunilStep label="Recebidos" count={totalLeads} percentage={100} />
          <FunilStep label="Contatados" count={contatados} percentage={percContatados} />
          <FunilStep label="Agendados" count={agendados} percentage={percAgendou} />
          <FunilStep label="Compareceram" count={compareceram} percentage={percCompareceu} />
        </div>
      </Card>

      {/* Listas Operacionais */}
      <Tabs defaultValue="backlog">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="backlog">
            Backlog Crítico {backlogCritico.length > 0 && `(${backlogCritico.length})`}
          </TabsTrigger>
          <TabsTrigger value="tentativas">
            Muitas Tentativas {muitasTentativas.length > 0 && `(${muitasTentativas.length})`}
          </TabsTrigger>
          <TabsTrigger value="perdas">
            Perdas por Motivo
          </TabsTrigger>
          <TabsTrigger value="agendados">
            Agendados Próximos {agendadosProximos.length > 0 && `(${agendadosProximos.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backlog" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Leads Sem Contato (SLA Atrasado)</h3>
            {backlogCritico.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum lead no backlog crítico</p>
            ) : (
              <div className="space-y-2">
                {backlogCritico.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium">{lead.nome || lead.telefone}</p>
                      <p className="text-sm text-slate-600">
                        {format(new Date(lead.data_chegada), "dd/MM 'às' HH:mm")} • {lead.origem?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="tentativas" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">
              Leads com Mais de {config?.max_tentativas_recomendado || 6} Tentativas
            </h3>
            {muitasTentativas.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum lead com tentativas excessivas</p>
            ) : (
              <div className="space-y-2">
                {muitasTentativas.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium">{lead.nome || lead.telefone}</p>
                      <p className="text-sm text-slate-600">
                        {lead.qtd_tentativas} tentativas • Status: {lead.status}
                      </p>
                    </div>
                    <Badge variant="outline">{lead.qtd_tentativas}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="perdas" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Ranking de Motivos de Perda</h3>
            {Object.keys(perdasPorMotivo).length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhuma perda registrada</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(perdasPorMotivo)
                  .sort(([, a], [, b]) => b - a)
                  .map(([motivo, count]) => (
                    <div key={motivo} className="flex items-center justify-between">
                      <span className="text-slate-700 capitalize">{motivo.replace(/_/g, ' ')}</span>
                      <Badge variant="outline">{count} leads ({((count / perdas) * 100).toFixed(1)}%)</Badge>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="agendados" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Agendados para Confirmar (Próximos 2 Dias)</h3>
            {agendadosProximos.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum agendamento próximo</p>
            ) : (
              <div className="space-y-2">
                {agendadosProximos.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium">{lead.nome || lead.telefone}</p>
                      <p className="text-sm text-slate-600">
                        Agendado: {format(new Date(lead.data_agendamento), "dd/MM 'às' HH:mm")}
                      </p>
                    </div>
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FunilStep({ label, count, percentage }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-3">
        <div 
          className="bg-gradient-to-r from-violet-600 to-purple-600 h-3 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}