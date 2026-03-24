import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UnidadeCard from '@/components/unidades/UnidadeCard';
import UnidadeModal from '@/components/unidades/UnidadeModal';
import RedeKPIs from '@/components/unidades/RedeKPIs';
import RankingPanel from '@/components/unidades/RankingPanel';
import { Loader2, Search, Zap, Network } from 'lucide-react';

export default function InteligenicaUnidades({ user }) {
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [selectedUnidade, setSelectedUnidade] = useState(null);

  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  
  // Trusted user types that don't need permission lookup
  const trustedUserTypes = ['oral_sin_franqueadora'];
  const isTrustedUser = trustedUserTypes.includes(tipoUsuario);
  
  const { data: userPermissions, isLoading: loadingPermissions } = useQuery({
    queryKey: ['userTypePermissions', tipoUsuario],
    queryFn: async () => {
      if (!tipoUsuario || isTrustedUser) return null;
      const perms = await base44.entities.UserTypePermissions.filter({ tipo_usuario: tipoUsuario });
      return perms[0] || null;
    },
    enabled: !!tipoUsuario && !isTrustedUser,
    staleTime: 5 * 60 * 1000
  });

  const hasAccess = user?.role === 'admin' || isTrustedUser || (
    userPermissions?.paginas_permitidas
      ? userPermissions.paginas_permitidas.includes('InteligenicaUnidades')
      : !tipoUsuario
  );

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes_unidades'],
    queryFn: () => base44.entities.Cliente.filter({ tipo_cliente: 'oral_sin' }, 'nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: contasMeta = [] } = useQuery({
    queryKey: ['contasMeta_unidades'],
    queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: contasGoogle = [] } = useQuery({
    queryKey: ['contasGoogle_unidades'],
    queryFn: () => base44.entities.GoogleAdsAccount.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: radarData = [] } = useQuery({
    queryKey: ['radarMeta_unidades'],
    queryFn: () => base44.entities.RadarMetaData.list('-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: historicoLeads = [] } = useQuery({
    queryKey: ['historicoLeads_unidades'],
    queryFn: () => base44.entities.HistoricoLeadsDiario.list('-data_snapshot', 2000),
    staleTime: 5 * 60 * 1000,
  });

  // Enriquecer cada cliente com dados de ads
  const unidades = useMemo(() => {
    return clientes.map(c => {
      const metaConta = contasMeta.find(m =>
        m.account_name?.toLowerCase().includes(c.nome?.toLowerCase()) ||
        c.meta_ads_account_name?.toLowerCase() === m.account_name?.toLowerCase()
      );
      const googleConta = contasGoogle.find(g =>
        g.account_name?.toLowerCase().includes(c.nome?.toLowerCase()) ||
        c.google_ads_account_name?.toLowerCase() === g.account_name?.toLowerCase()
      );
      const radar = radarData.find(r =>
        r.account_name?.toLowerCase().includes(c.nome?.toLowerCase())
      );

      const historicoDaUnidade = historicoLeads.filter(h => h.cliente_id === c.id);
      // Usar dados diretos da ContaMetaAds: cadastros_whats = cadastro + whats (fonte correta)
      const leadsMes = metaConta?.cadastros_whats
        || ((metaConta?.leads || 0) + (metaConta?.new_messaging_connections || 0))
        || c.leads_meta_mes
        || 0;

      const cpl = radar?.cpl_7d || radar?.cpl_ontem || c.custo_por_lead_meta || 0;
      const investimentoMetaTotal = metaConta?.amount_spent || 0;
      const variacao = radar?.variacao_cpl || 0;

      let healthStatus = 'saudavel';
      if (cpl > 200 || variacao > 30) healthStatus = 'critico';
      else if (cpl > 120 || variacao > 15 || (radar?.frequencia_7d || 0) > 2.8) healthStatus = 'atencao';

      let tag = 'estavel';
      if (healthStatus === 'saudavel' && leadsMes > 20) tag = 'alta_performance';
      if (healthStatus === 'critico') tag = 'em_risco';

      return {
        ...c,
        metaConta,
        googleConta,
        radar,
        leadsMes,
        investimentoMeta: investimentoMetaTotal,
        cpl,
        variacao,
        healthStatus,
        tag,
        leadsOntem: radar?.leads_ontem || 0,
        frequencia7d: radar?.frequencia_7d || 0,
        investimentoDiario: c.investimento_dia_meta || 0,
        historicoLeads: historicoDaUnidade.slice(0, 30).reverse(),
      };
    });
  }, [clientes, contasMeta, contasGoogle, radarData, historicoLeads]);

  const filtered = useMemo(() => {
    return unidades.filter(u => {
      const matchSearch = !search || u.nome?.toLowerCase().includes(search.toLowerCase()) || u.cidade?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'all' || u.healthStatus === filtroStatus;
      return matchSearch && matchStatus;
    });
  }, [unidades, search, filtroStatus]);

  // Ordenar: críticos primeiro, depois atenção, depois saudáveis
  const sorted = useMemo(() => {
    const order = { critico: 0, atencao: 1, saudavel: 2 };
    return [...filtered].sort((a, b) => (order[a.healthStatus] ?? 3) - (order[b.healthStatus] ?? 3));
  }, [filtered]);

  if (loadingPermissions && !isTrustedUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!hasAccess && user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-xl font-semibold text-slate-700 mb-2">Acesso não autorizado</p>
          <p className="text-slate-500">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (loadingClientes) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-violet-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-violet-600/30 rounded-xl border border-violet-500/30">
              <Network className="w-6 h-6 text-violet-300" />
            </div>
            <div>
              <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Oral Sin · Rede de Franquias</p>
              <h1 className="text-2xl font-bold">Inteligência de Performance — Unidades</h1>
            </div>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Visão consolidada das unidades com base em dados de tráfego, conversão e execução estratégica.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 rounded-lg px-3 py-1.5">
            <Zap className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-xs text-violet-200 font-medium">"A Voxx não roda tráfego. A Voxx gerencia performance da rede."</span>
          </div>
        </div>
      </div>

      {/* KPIs DA REDE */}
      <RedeKPIs unidades={unidades} contasMeta={contasMeta} />

      {/* RANKING */}
      <RankingPanel unidades={unidades} onSelectUnidade={setSelectedUnidade} />

      {/* FILTROS + LISTA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">Todas as Unidades</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar unidade ou cidade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="saudavel">🟢 Saudável</SelectItem>
                <SelectItem value="atencao">🟡 Atenção</SelectItem>
                <SelectItem value="critico">🔴 Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <Card className="p-16 text-center">
            <p className="text-slate-400">Nenhuma unidade encontrada.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sorted.map((unidade, idx) => (
              <UnidadeCard
                key={unidade.id}
                unidade={unidade}
                rank={idx + 1}
                onClick={() => setSelectedUnidade(unidade)}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODAL */}
      {selectedUnidade && (
        <UnidadeModal
          unidade={selectedUnidade}
          onClose={() => setSelectedUnidade(null)}
          user={user}
        />
      )}
    </div>
  );
}