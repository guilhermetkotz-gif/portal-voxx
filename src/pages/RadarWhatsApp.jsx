import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Activity, Users, MessageSquare, AlertTriangle, Zap, Radio, Bell, BellOff, Volume2, MoonStar } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import AbaMonitoramento from '@/components/radar/AbaMonitoramento';
import AbaGruposClientes from '@/components/radar/AbaGruposClientes';
import AbaMensagensRadar from '@/components/radar/AbaMensagensRadar';
import AbaDiagnostico from '@/components/radar/AbaDiagnostico';
import AbaAnalises from '@/components/radar/AbaAnalises';
import AbaRemetentesVoxx from '@/components/radar/AbaRemetentesVoxx';
import AbaQualidadeVoxx from '@/components/radar/AbaQualidadeVoxx';
import { calcularMinutosUteis, nivelAlerta } from '@/lib/minutosUteis';
import { useAlertaSomRadar } from '@/hooks/useAlertaSomRadar';
import { Button } from '@/components/ui/button';

const TZ = 'America/Sao_Paulo';

export default function RadarWhatsApp() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('monitoramento');

  // ── Dados base ──────────────────────────────────────────────
  const { data: grupos = [], isLoading: loadingGrupos } = useQuery({
    queryKey: ['radarGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-ultima_atividade', 200),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: mensagens = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['radarMensagens'],
    queryFn: () => base44.entities.WhatsappMensagem.list('-received_at', 500),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['radarClientes'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rawWebhooks = [] } = useQuery({
    queryKey: ['radarRawWebhooks'],
    queryFn: () => base44.entities.WhatsappWebhookRaw.list('-received_at', 50),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  // ── Subscrições realtime ─────────────────────────────────────
  React.useEffect(() => {
    const unsub1 = base44.entities.WhatsappMensagem.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
    });
    const unsub2 = base44.entities.WhatsappGrupo.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['radarGrupos'] });
    });
    const unsub3 = base44.entities.WhatsappWebhookRaw.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['radarRawWebhooks'] });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [queryClient]);

  // ── Enriquecimento dos grupos ────────────────────────────────
  const gruposEnriquecidos = useMemo(() => {
    const agora = moment().tz(TZ);
    const inicioDia = agora.clone().startOf('day');

    // índices por grupo_id
    const msgsPorGrupo = {};
    mensagens.forEach(m => {
      const gId = m.grupo_id;
      if (!gId) return;
      if (!msgsPorGrupo[gId]) msgsPorGrupo[gId] = [];
      msgsPorGrupo[gId].push(m);
    });

    return grupos.map(g => {
      const msgs = msgsPorGrupo[g.grupo_id] || [];

      // últimas mensagens
      const ultimaGeral = msgs.reduce((acc, m) => {
        const t = m.received_at || m.timestamp_mensagem;
        if (!acc || t > acc.t) return { t, m };
        return acc;
      }, null)?.m || null;

      const ultimaCliente = msgs
        .filter(m => m.remetente_tipo === 'cliente' || m.origem === 'recebida')
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;

      const ultimaVoxx = msgs
        .filter(m => m.remetente_tipo === 'voxx' || m.origem === 'enviada')
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;

      // total hoje
      const msgsHoje = msgs.filter(m => {
        const t = moment(m.received_at || m.timestamp_mensagem).tz(TZ);
        return t.isAfter(inicioDia);
      });

      // tempo sem resposta VOXX (minutos úteis)
      let minutosSemResposta = 0;
      let alertaNivel = null;
      const ignorarTipos = ['sistema', 'atividade', 'sem_conteudo'];

      const ultimaClienteValida = msgs
        .filter(m => (m.remetente_tipo === 'cliente' || m.origem === 'recebida') && !ignorarTipos.includes(m.tipo_mensagem))
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;

      const ultimaVoxxValida = msgs
        .filter(m => (m.remetente_tipo === 'voxx' || m.origem === 'enviada') && !ignorarTipos.includes(m.tipo_mensagem))
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;

      if (ultimaClienteValida) {
        const tsCliente = ultimaClienteValida.received_at;
        const tsVoxx = ultimaVoxxValida?.received_at;
        // Só há pendência se a última msg do cliente for posterior à última da VOXX
        if (!tsVoxx || tsCliente > tsVoxx) {
          minutosSemResposta = calcularMinutosUteis(tsCliente, agora.toISOString());
          alertaNivel = nivelAlerta(minutosSemResposta);
        }
      }

      // inatividade total (sem nenhuma mensagem há +72h)
      const tsUltimaGeral = ultimaGeral?.received_at || ultimaGeral?.timestamp_mensagem || g.ultima_atividade;
      const horasSemMensagem = tsUltimaGeral
        ? moment().tz(TZ).diff(moment(tsUltimaGeral).tz(TZ), 'hours')
        : Infinity;
      const inativo72h = horasSemMensagem >= 72;

      // score de ordenação (1=mais urgente)
      let ordem = 6; // saudável
      if (g.status_vinculo === 'nao_vinculado') ordem = 5;
      if (alertaNivel === 'alarme')      ordem = 4;
      if (alertaNivel === 'alerta')      ordem = 3;
      if (alertaNivel === 'critico')     ordem = 2;
      if (alertaNivel === 'emergencial') ordem = 1;
      if (!ultimaGeral) ordem = 7;

      return {
        ...g,
        ultimaGeral,
        ultimaCliente,
        ultimaVoxx,
        ultimaClienteValida,
        msgsHoje: msgsHoje.length,
        totalMsgs: msgs.length,
        minutosSemResposta,
        alertaNivel,
        ordem,
        todasMsgs: msgs,
        inativo72h,
        horasSemMensagem: isFinite(horasSemMensagem) ? horasSemMensagem : null,
      };
    }).sort((a, b) => a.ordem - b.ordem || (b.ultimaGeral?.received_at || '') > (a.ultimaGeral?.received_at || '') ? 1 : -1);
  }, [grupos, mensagens]);

  // ── KPIs do topo ─────────────────────────────────────────────
  const kpis = useMemo(() => {
    const hoje = moment().tz(TZ).startOf('day');
    const msgsHoje = mensagens.filter(m => moment(m.received_at).tz(TZ).isAfter(hoje));
    const alarmes   = gruposEnriquecidos.filter(g => g.alertaNivel === 'alarme').length;
    const alertas   = gruposEnriquecidos.filter(g => g.alertaNivel === 'alerta').length;
    const criticos  = gruposEnriquecidos.filter(g => g.alertaNivel === 'critico').length;
    const emergs    = gruposEnriquecidos.filter(g => g.alertaNivel === 'emergencial').length;
    const inativos72 = gruposEnriquecidos.filter(g => g.inativo72h && g.status_vinculo === 'vinculado').length;
    const ultimoRaw = rawWebhooks[0];

    return {
      totalGrupos:    grupos.length,
      vinculados:     grupos.filter(g => g.status_vinculo === 'vinculado').length,
      naoVinculados:  grupos.filter(g => g.status_vinculo === 'nao_vinculado').length,
      msgsHoje:       msgsHoje.length,
      totalMsgs:      mensagens.length,
      alarmes, alertas, criticos, emergs, inativos72,
      ultimoRaw: ultimoRaw?.received_at,
    };
  }, [grupos, mensagens, gruposEnriquecidos, rawWebhooks]);

  // ── Alarme sonoro ─────────────────────────────────────────────
  const { somAtivo, toggleSom, audioBloqueado } = useAlertaSomRadar(gruposEnriquecidos);

  const loading = loadingGrupos || loadingMsgs;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 -m-4 lg:-m-8 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Radio className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Radar WhatsApp</h1>
            <p className="text-slate-400 text-sm">Monitoramento em tempo real dos grupos de atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Botão de som */}
          <Button
            onClick={toggleSom}
            variant="outline"
            size="sm"
            className={`gap-2 border ${somAtivo ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {somAtivo ? <Volume2 className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            <span className="text-xs">Som: {somAtivo ? 'Ativo' : 'Inativo'}</span>
          </Button>
          {audioBloqueado && (
            <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
              Navegador bloqueou áudio — clique em "Ativar som"
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Ao vivo</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3 mb-6">
        <KpiCard label="Grupos" value={kpis.totalGrupos} icon={Users} color="blue" />
        <KpiCard label="Vinculados" value={kpis.vinculados} icon={Wifi} color="emerald" />
        <KpiCard label="Não Vinculados" value={kpis.naoVinculados} icon={WifiOff} color="amber" />
        <KpiCard label="Msgs Hoje" value={kpis.msgsHoje} icon={MessageSquare} color="violet" />
        <KpiCard label="Msgs Total" value={kpis.totalMsgs} icon={Activity} color="slate" />
        <KpiCard label="+15min" value={kpis.alarmes} icon={Bell} color="amber" pulse={kpis.alarmes > 0} />
        <KpiCard label="+30min" value={kpis.alertas} icon={AlertTriangle} color="yellow" />
        <KpiCard label="+1h" value={kpis.criticos} icon={AlertTriangle} color="orange" />
        <KpiCard label="+2h" value={kpis.emergs} icon={Zap} color="red" />
        <KpiCard label="Inativos 72h+" value={kpis.inativos72} icon={MoonStar} color="purple" pulse={kpis.inativos72 > 0} />
        <KpiCard
          label="Último Webhook"
          value={kpis.ultimoRaw ? moment(kpis.ultimoRaw).tz(TZ).fromNow() : '—'}
          icon={Radio}
          color="slate"
          small
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 mb-6">
          <TabsTrigger value="monitoramento" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Monitoramento
          </TabsTrigger>
          <TabsTrigger value="grupos" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            {"Grupos & Clientes"}
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="diagnostico" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="analises" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Análises IA
          </TabsTrigger>
          <TabsTrigger value="remetentes" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400">
            Remetentes VOXX
          </TabsTrigger>
          <TabsTrigger value="qualidade" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400">
            ⭐ Qualidade VOXX
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoramento">
          <AbaMonitoramento gruposEnriquecidos={gruposEnriquecidos} clientes={clientes} loading={loading} kpis={kpis} />
        </TabsContent>

        <TabsContent value="grupos">
          <AbaGruposClientes grupos={grupos} clientes={clientes} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['radarGrupos'] })} />
        </TabsContent>

        <TabsContent value="mensagens">
          <AbaMensagensRadar mensagens={mensagens} clientes={clientes} loading={loadingMsgs} />
        </TabsContent>

        <TabsContent value="diagnostico">
          <AbaDiagnostico rawWebhooks={rawWebhooks} mensagens={mensagens} grupos={grupos} onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['radarRawWebhooks'] });
            queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
            queryClient.invalidateQueries({ queryKey: ['radarGrupos'] });
          }} />
        </TabsContent>

        <TabsContent value="analises">
          <AbaAnalises gruposEnriquecidos={gruposEnriquecidos} clientes={clientes} />
        </TabsContent>

        <TabsContent value="remetentes">
          <AbaRemetentesVoxx mensagens={mensagens} />
        </TabsContent>

        <TabsContent value="qualidade">
          <AbaQualidadeVoxx clientes={clientes} gruposEnriquecidos={gruposEnriquecidos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, small, pulse }) {
  const colors = {
    blue:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
    yellow:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    orange:  'text-orange-400 bg-orange-500/10 border-orange-500/20',
    red:     'text-red-400 bg-red-500/10 border-red-500/20',
    slate:   'text-slate-400 bg-slate-800 border-slate-700',
    purple:  'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  const cls = colors[color] || colors.slate;
  return (
    <div className={`rounded-xl border p-3 ${cls} ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 opacity-70" />
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <div className={`font-bold ${small ? 'text-xs' : 'text-xl'}`}>{value}</div>
    </div>
  );
}