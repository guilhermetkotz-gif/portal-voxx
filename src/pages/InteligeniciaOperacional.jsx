import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import KPICards from '../components/inteligencia/KPICards';
import TabelaClientes from '../components/inteligencia/TabelaClientes';
import GraficosOperacionais from '../components/inteligencia/GraficosOperacionais';
import { Calendar, Filter, RefreshCw } from 'lucide-react';

const PERIODO_OPTIONS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Ontem', value: 'ontem' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'mes' },
];

function getDateRange(periodo) {
  const now = new Date();
  switch (periodo) {
    case 'hoje': return { start: startOfDay(now), end: endOfDay(now) };
    case 'ontem': return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case '7d': return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case '30d': return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case 'mes': return { start: startOfMonth(now), end: endOfDay(now) };
    default: return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  }
}

export function getIntensidade(demandas, participacoes, setores, custoEstimado) {
  const score = demandas * 2 + participacoes * 0.5 + setores * 3 + custoEstimado / 80;
  if (score < 15) return { label: 'Leve', color: 'bg-green-100 text-green-700', level: 0 };
  if (score < 35) return { label: 'Moderado', color: 'bg-yellow-100 text-yellow-700', level: 1 };
  if (score < 70) return { label: 'Alto', color: 'bg-orange-100 text-orange-700', level: 2 };
  return { label: 'Crítico', color: 'bg-red-100 text-red-700', level: 3 };
}

export default function InteligeniciaOperacional({ user }) {
  const [periodo, setPeriodo] = useState('30d');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroIntensidade, setFiltroIntensidade] = useState('todos');

  const { start, end } = getDateRange(periodo);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-intel'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: demandas = [], isLoading: loadingDemandas, refetch } = useQuery({
    queryKey: ['demandas-intel', periodo],
    queryFn: async () => {
      const all = await base44.entities.Demanda.list('-created_date', 2000);
      return all.filter(d => {
        const dt = parseISO(d.created_date);
        return isWithinInterval(dt, { start, end });
      });
    },
    staleTime: 3 * 60 * 1000,
  });

  const { data: historicoSetores = [] } = useQuery({
    queryKey: ['historico-setores-intel', periodo],
    queryFn: async () => {
      const all = await base44.entities.DemandaHistoricoSetor.list('-data_entrada', 5000);
      return all.filter(h => {
        const dt = parseISO(h.data_entrada);
        return isWithinInterval(dt, { start, end });
      });
    },
    staleTime: 3 * 60 * 1000,
  });

  const { data: otimizacoesMeta = [] } = useQuery({
    queryKey: ['otimizacoes-meta-intel', periodo],
    queryFn: async () => {
      const all = await base44.entities.MetaAdsOtimizacao.list('-data_acao', 2000);
      return all.filter(o => {
        const dt = parseISO(o.data_acao);
        return isWithinInterval(dt, { start, end });
      });
    },
    staleTime: 3 * 60 * 1000,
  });

  const { data: configSetores = [] } = useQuery({
    queryKey: ['config-setores'],
    queryFn: () => base44.entities.ConfiguracaoSetorOperacional.list(),
    staleTime: 10 * 60 * 1000,
  });

  // Build sector cost map: setor_nome -> custo por hora
  const setorCustoMap = useMemo(() => {
    const map = {};
    configSetores.forEach(s => {
      const horas = s.horas_disponiveis_dia || 8;
      const custo = s.custo_diario_setor || 0;
      map[s.setor_nome] = custo / horas; // R$/hora
    });
    return map;
  }, [configSetores]);

  // Default hourly cost if no config
  const DEFAULT_HOURLY_COST = 35;
  const DEFAULT_MINUTES_PER_DEMANDA = 90;

  // Build client map
  const clienteMap = useMemo(() => {
    const map = {};
    clientes.forEach(c => { map[c.id] = c; });
    return map;
  }, [clientes]);

  // Map account_name -> cliente_id (via meta_ads_account_name)
  const accountNameToClienteId = useMemo(() => {
    const map = {};
    clientes.forEach(c => {
      if (c.meta_ads_account_name) map[c.meta_ads_account_name.trim().toLowerCase()] = c.id;
    });
    return map;
  }, [clientes]);

  // Compute operational data per client
  const dadosOperacionais = useMemo(() => {
    const clienteData = {};

    demandas.forEach(d => {
      if (!d.cliente_id) return;
      if (!clienteData[d.cliente_id]) {
        clienteData[d.cliente_id] = {
          cliente_id: d.cliente_id,
          cliente_nome: d.cliente_nome || clienteMap[d.cliente_id]?.nome || 'Desconhecido',
          demandas: [],
          setores: new Set(),
          usuarios: new Set(),
          participacoes: 0,
          minutos_total: 0,
          custo_estimado: 0,
        };
      }
      const cd = clienteData[d.cliente_id];
      cd.demandas.push(d);
      if (d.setor) cd.setores.add(d.setor);

      // Sum work minutes
      const minutos = d.tempo_trabalho_minutos || DEFAULT_MINUTES_PER_DEMANDA;
      cd.minutos_total += minutos;

      // Users from historico_tempo_trabalho
      if (d.historico_tempo_trabalho) {
        d.historico_tempo_trabalho.forEach(h => {
          if (h.usuario_nome) cd.usuarios.add(h.usuario_nome);
          cd.participacoes++;
        });
      }

      // Estimate cost
      const custoHora = setorCustoMap[d.setor] || DEFAULT_HOURLY_COST;
      cd.custo_estimado += (minutos / 60) * custoHora;
    });

    // Add setor info from historico
    historicoSetores.forEach(h => {
      if (!h.cliente_id || !clienteData[h.cliente_id]) return;
      if (h.setor) clienteData[h.cliente_id].setores.add(h.setor);
    });

    // Add Meta Ads otimizações as TRAFEGO_META actions
    const MINUTOS_POR_OTIMIZACAO = 45;
    otimizacoesMeta.forEach(o => {
      const clienteId = accountNameToClienteId[o.account_name?.trim().toLowerCase()];
      if (!clienteId) return;
      if (!clienteData[clienteId]) {
        const cliente = clienteMap[clienteId];
        clienteData[clienteId] = {
          cliente_id: clienteId,
          cliente_nome: cliente?.nome || o.account_name,
          demandas: [],
          setores: new Set(),
          usuarios: new Set(),
          participacoes: 0,
          minutos_total: 0,
          custo_estimado: 0,
        };
      }
      const cd = clienteData[clienteId];
      cd.setores.add('TRAFEGO_META');
      cd.minutos_total += MINUTOS_POR_OTIMIZACAO;
      cd.participacoes++;
      if (o.created_by) cd.usuarios.add(o.created_by);
      const custoHora = setorCustoMap['TRAFEGO_META'] || DEFAULT_HOURLY_COST;
      cd.custo_estimado += (MINUTOS_POR_OTIMIZACAO / 60) * custoHora;
      // Count in setor breakdown via a synthetic marker on demandas_raw
      cd.demandas.push({
        titulo: o.resumo_acao || 'Otimização Meta Ads',
        setor: 'TRAFEGO_META',
        status: 'finalizada',
        _tipo: 'otimizacao_meta',
      });
    });

    // Compute totals for % calc
    const totalCusto = Object.values(clienteData).reduce((s, c) => s + c.custo_estimado, 0);
    const totalDemandas = demandas.length;

    return Object.values(clienteData).map(cd => {
      const qtdDemandas = cd.demandas.length;
      const setoresArr = Array.from(cd.setores);
      const usuariosArr = Array.from(cd.usuarios);
      const participacoes = cd.participacoes || qtdDemandas;
      const custo = cd.custo_estimado;
      const intensidade = getIntensidade(qtdDemandas, participacoes, setoresArr.length, custo);
      const percentual = totalCusto > 0 ? (custo / totalCusto) * 100 : 0;
      const mediaDiaria = qtdDemandas / 30; // approximate
      const custoPorDemanda = qtdDemandas > 0 ? custo / qtdDemandas : 0;

      // Sector breakdown for this client
      const setorBreakdown = {};
      cd.demandas.forEach(d => {
        if (d.setor) setorBreakdown[d.setor] = (setorBreakdown[d.setor] || 0) + 1;
      });

      return {
        cliente_id: cd.cliente_id,
        cliente_nome: cd.cliente_nome,
        qtd_demandas: qtdDemandas,
        participacoes,
        setores: setoresArr,
        usuarios: usuariosArr,
        custo_estimado: custo,
        custo_por_demanda: custoPorDemanda,
        intensidade,
        percentual,
        media_diaria: mediaDiaria,
        minutos_total: cd.minutos_total,
        demandas_raw: cd.demandas,
        setor_breakdown: setorBreakdown,
      };
    }).sort((a, b) => b.custo_estimado - a.custo_estimado);
  }, [demandas, historicoSetores, otimizacoesMeta, clienteMap, accountNameToClienteId, setorCustoMap]);

  // Compute global KPIs
  const kpis = useMemo(() => {
    const totalCusto = dadosOperacionais.reduce((s, c) => s + c.custo_estimado, 0);
    const totalDemandas = dadosOperacionais.reduce((s, c) => s + c.qtd_demandas, 0);
    const totalParticipacoes = dadosOperacionais.reduce((s, c) => s + c.participacoes, 0);
    const clientesAtivos = dadosOperacionais.length;
    const mediaPorCliente = clientesAtivos > 0 ? totalCusto / clientesAtivos : 0;
    const custoPorDemanda = totalDemandas > 0 ? totalCusto / totalDemandas : 0;
    return { totalCusto, totalDemandas, totalParticipacoes, clientesAtivos, mediaPorCliente, custoPorDemanda };
  }, [dadosOperacionais]);

  // Alertas
  const alertas = useMemo(() => {
    return dadosOperacionais.filter(c => c.intensidade.level >= 2).slice(0, 5);
  }, [dadosOperacionais]);

  // Filtered data
  const dadosFiltrados = useMemo(() => {
    return dadosOperacionais.filter(c => {
      if (filtroCliente && !c.cliente_nome.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      if (filtroSetor !== 'todos' && !c.setores.includes(filtroSetor)) return false;
      if (filtroIntensidade !== 'todos' && c.intensidade.label !== filtroIntensidade) return false;
      return true;
    });
  }, [dadosOperacionais, filtroCliente, filtroSetor, filtroIntensidade]);

  const todosSetores = useMemo(() => {
    const set = new Set();
    dadosOperacionais.forEach(c => c.setores.forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [dadosOperacionais]);

  const SETOR_LABELS = {
    ATENDIMENTO: 'Atendimento', TRAFEGO_META: 'Tráfego Meta', TRAFEGO_GOOGLE: 'Tráfego Google',
    TRAFEGO_TIKTOK: 'Tráfego TikTok', CRIACAO: 'Criação', EDICAO: 'Edição',
    BI_RELATORIO: 'BI/Relatório', IMPLANTACAO: 'Implantação', FINANCEIRO: 'Financeiro',
    ALTERACAO_CRIACAO: 'Alt. Criação', AUTOMACAO: 'Automação', SALDOS: 'Saldos',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inteligência Operacional</h1>
          <p className="text-slate-500 text-sm mt-1">Consumo e carga operacional por cliente — estimativa inteligente</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PERIODO_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              variant={periodo === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(opt.value)}
              className={periodo === opt.value ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              {opt.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 font-semibold text-sm mb-2">⚠️ Alertas Operacionais</p>
          <div className="flex flex-wrap gap-2">
            {alertas.map(a => (
              <Badge key={a.cliente_id} className={`${a.intensidade.color} border-0 text-xs`}>
                {a.cliente_nome} — {a.intensidade.label} ({a.qtd_demandas} demandas)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      <KPICards kpis={kpis} loading={loadingDemandas} />

      {/* Gráficos */}
      <GraficosOperacionais dados={dadosOperacionais} setorLabels={SETOR_LABELS} />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border p-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar cliente..."
          value={filtroCliente}
          onChange={e => setFiltroCliente(e.target.value)}
          className="w-48 h-8 text-sm"
        />
        <Select value={filtroSetor} onValueChange={setFiltroSetor}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {todosSetores.map(s => (
              <SelectItem key={s} value={s}>{SETOR_LABELS[s] || s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroIntensidade} onValueChange={setFiltroIntensidade}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Intensidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="Leve">Leve</SelectItem>
            <SelectItem value="Moderado">Moderado</SelectItem>
            <SelectItem value="Alto">Alto</SelectItem>
            <SelectItem value="Crítico">Crítico</SelectItem>
          </SelectContent>
        </Select>
        {(filtroCliente || filtroSetor !== 'todos' || filtroIntensidade !== 'todos') && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltroCliente(''); setFiltroSetor('todos'); setFiltroIntensidade('todos'); }}>
            Limpar
          </Button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{dadosFiltrados.length} clientes</span>
      </div>

      {/* Tabela */}
      <TabelaClientes
        dados={dadosFiltrados}
        loading={loadingDemandas}
        setorLabels={SETOR_LABELS}
        periodo={periodo}
      />
    </div>
  );
}