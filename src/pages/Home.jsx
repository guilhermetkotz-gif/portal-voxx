import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import KPICard from '@/components/ui/KPICard';
import HealthScore from '@/components/ui/HealthScore';
import AlertsSection from '@/components/home/AlertsSection';
import RecentDemandas from '@/components/home/RecentDemandas';
import AcoesVoxxCard from '@/components/home/AcoesVoxxCard';
import DailyLeadsChart from '@/components/home/DailyLeadsChart';
import AguardandoAprovacao from '@/pages/AguardandoAprovacao';
import BoasVindas from '@/pages/BoasVindas';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Users, 
  DollarSign, 
  MousePointerClick,
  Wallet,
  Calendar,
  PlusCircle,
  Loader2,
  Eye,
  ThumbsUp,
  Radio,
  Target,
  RefreshCw,
  MessageCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Home({ currentCliente, selectedClienteId, user }) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  // User not authenticated → show BoasVindas
  if (!user) {
    return <BoasVindas />;
  }

  const { data: userRequest } = useQuery({
    queryKey: ['userRequestHome', user?.id],
    queryFn: () => base44.entities.AccessRequest.filter({ usuario_id: user?.id }, '-created_date', 1),
    enabled: !!user?.id,
    staleTime: 30 * 1000
  });

  // Check access status
  const hasRequest = userRequest && userRequest.length > 0;
  const hasPendingRequest = hasRequest && userRequest[0]?.status === 'pendente';

  // 1. User is pendente WITH pending request → show AguardandoAprovacao
  if (user?.status === 'pendente' && hasPendingRequest) {
    return <AguardandoAprovacao user={user} />;
  }

  // 2. User has no access (no cliente) and is not admin → show message
  const userType = user?.tipo_usuario || user?.tipo_acesso;
  if (!currentCliente && user?.role !== 'admin' && userType !== 'voxx_admin' && userType !== 'voxx_operacao' && userType !== 'voxx_manager') {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Aprovado!</h2>
          <p className="text-slate-600 mb-6">
            Seu acesso foi aprovado. Aguarde enquanto carregamos seus clientes atribuídos...
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recarregar Página
          </Button>
        </Card>
      </div>
    );
  }
  const { data: demandas = [] } = useQuery({
    queryKey: ['demandas', selectedClienteId],
    queryFn: () => base44.entities.Demanda.filter({ cliente_id: selectedClienteId, status: { $ne: 'concluida' } }, '-updated_date', 10),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ['acoes', selectedClienteId],
    queryFn: () => base44.entities.AcaoVoxx.filter({ cliente_id: selectedClienteId }, '-created_date', 5),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  const { data: otimizacoesMetaAds = [] } = useQuery({
    queryKey: ['otimizacoesMetaAds', currentCliente?.nome],
    queryFn: async () => {
      if (!currentCliente?.nome) return [];
      // Buscar otimizações pela conta Meta Ads do cliente
      return base44.entities.MetaAdsOtimizacao.filter(
        { account_name: currentCliente.nome },
        '-data_acao',
        5
      );
    },
    enabled: !!currentCliente?.nome,
    staleTime: 60 * 1000
  });

  const { data: demandasConcluidas = [] } = useQuery({
    queryKey: ['demandasConcluidas', selectedClienteId],
    queryFn: () => base44.entities.Demanda.filter(
      { cliente_id: selectedClienteId, status: 'concluida' },
      '-updated_date',
      10
    ),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  // Buscar todas as contas Meta Ads para cálculo do percentil e métricas atualizadas
  const { data: todasContasMetaAds = [] } = useQuery({
    queryKey: ['todasContasMetaAds'],
    queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
    staleTime: 0
  });

  // Buscar conta Google Ads atualizada do cliente
  const { data: googleAdsAccounts = [] } = useQuery({
    queryKey: ['googleAdsAccountHome', currentCliente?.google_ads_account_name, currentCliente?.nome],
    queryFn: () => base44.entities.GoogleAdsAccount.list('-data_atualizacao', 500),
    enabled: !!currentCliente,
    staleTime: 0
  });

  // Calcular percentil da unidade atual
  const calcularPercentil = () => {
    if (!currentCliente?.nome || todasContasMetaAds.length === 0) return null;
    
    const contaAtual = todasContasMetaAds.find(c => c.account_name === currentCliente.nome);
    if (!contaAtual || !contaAtual.nota_gpt) return null;

    const notaAtual = contaAtual.nota_gpt;
    const contasComNotaMenor = todasContasMetaAds.filter(c => c.nota_gpt < notaAtual).length;
    const totalContas = todasContasMetaAds.length;

    const percentil = Math.round((contasComNotaMenor / totalContas) * 100);
    return { percentil, nota: notaAtual };
  };

  const healthScoreData = calcularPercentil();

  const cliente = currentCliente;

  // Encontrar conta Meta Ads atualizada do cliente (para métricas de performance)
  const contaMetaAdsAtual = todasContasMetaAds.find(c =>
    c.account_name === currentCliente?.meta_ads_account_name ||
    c.account_name === currentCliente?.nome
  );

  // Encontrar conta Google Ads atualizada do cliente
  const contaGoogleAdsAtual = googleAdsAccounts.find(c =>
    c.account_name === currentCliente?.google_ads_account_name ||
    c.account_name === currentCliente?.nome
  );

  // Métricas Meta — prefere ContaMetaAds (dados da planilha), fallback para Cliente
  const metricsImpressions = contaMetaAdsAtual?.impressions ?? cliente?.impressions;
  const metricsEngagement = contaMetaAdsAtual?.page_engagement ?? cliente?.page_engagement;
  const metricsPageLikes = contaMetaAdsAtual?.page_likes ?? cliente?.page_likes;
  const metricsReach = contaMetaAdsAtual?.reach ?? cliente?.reach;
  const metricsClicksAll = contaMetaAdsAtual?.clicks_all ?? cliente?.clicks_all;

  // Métricas Google — prefere GoogleAdsAccount (dados da planilha), fallback para Cliente
  const googleClicks = contaGoogleAdsAtual?.clicks ?? null;
  const googleConversions = contaGoogleAdsAtual?.conversions ?? null;
  const googleCPC = contaGoogleAdsAtual?.avg_cpc ?? cliente?.cpc_google;
  const googleCost = contaGoogleAdsAtual?.cost ?? null;
  const demandasAbertas = demandas;

  // Buscar leads Google direto do banco (fonte_cadastro = 'google_sheet')
  const { data: googleLeadsData, dataUpdatedAt } = useQuery({
    queryKey: ['googleLeadsSheet', selectedClienteId],
    queryFn: async () => {
      const leads = await base44.entities.CrcLead.filter({
        unidade_id: selectedClienteId,
        fonte_cadastro: 'google_sheet'
      });
      return { leads: leads.length };
    },
    enabled: !!selectedClienteId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000
  });

  // Detect new Google leads
  const [previousLeadsCount, setPreviousLeadsCount] = useState(null);
  const [showNewLeadAlert, setShowNewLeadAlert] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [newLeadsData, setNewLeadsData] = useState([]);

  React.useEffect(() => {
    if (!googleLeadsData?.leads) return;
    
    const currentCount = googleLeadsData.leads;
    
    if (previousLeadsCount !== null && currentCount > previousLeadsCount) {
      const diff = currentCount - previousLeadsCount;
      setNewLeadsCount(diff);
      setNewLeadsData(googleLeadsData.lastLeads || []);
      setShowNewLeadAlert(true);
    }
    
    setPreviousLeadsCount(currentCount);
  }, [googleLeadsData?.leads, dataUpdatedAt]);

  // Fetch balance control for current month
  const currentDate = new Date();
  const currentMonth = format(currentDate, 'yyyy-MM-01');
  
  const { data: balanceControl } = useQuery({
    queryKey: ['metaAdsBalance', selectedClienteId, currentMonth],
    queryFn: () => base44.entities.MetaAdsBalanceControl.filter({ 
      client_id: selectedClienteId,
      month_year: currentMonth 
    }),
    enabled: !!selectedClienteId,
    staleTime: 60 * 1000
  });

  // Buscar gasto diário da planilha "ontem meta Ads"
  const { data: sheetData } = useQuery({
    queryKey: ['amountSpentFromSheet'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('getAmountSpentFromSheet', {});
        return response.data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  const diarioD1ByAccount = sheetData?.diarioD1ByAccount || {};

  const saldoMeta = balanceControl?.[0]?.saldo || cliente?.saldo_meta || 0;
  
  // Buscar gasto diário da planilha usando o nome do cliente
  let gastoDiarioMeta = 0;
  const nomeCliente = cliente?.nome?.trim();
  
  const normalizeNome = (nome) => {
    return nome?.toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, '')
      .trim() || '';
  };
  
  const clienteNormalizado = normalizeNome(nomeCliente);
  
  if (nomeCliente && diarioD1ByAccount[nomeCliente] !== undefined) {
    gastoDiarioMeta = diarioD1ByAccount[nomeCliente];
  } else {
    const matchingKey = Object.keys(diarioD1ByAccount).find(key => 
      normalizeNome(key) === clienteNormalizado
    );
    if (matchingKey) {
      gastoDiarioMeta = diarioD1ByAccount[matchingKey];
    }
  }

  const leadsGoogleSheet = googleLeadsData?.leads ?? 0;
  const leadsGoogleCliente = (cliente?.leads_google_cadastro || 0) + (cliente?.leads_google_ligacao || 0);
  const totalLeadsGoogle = leadsGoogleSheet > 0 ? leadsGoogleSheet : leadsGoogleCliente;
  const diasRestantesMeta = gastoDiarioMeta > 0 
    ? Math.floor(saldoMeta / gastoDiarioMeta) 
    : null;
  
  // Calcular próximo investimento = data de hoje + duração saldo - 2
  const dataProximoInvestimentoMeta = diasRestantesMeta !== null
    ? new Date(Date.now() + (diasRestantesMeta - 2) * 24 * 60 * 60 * 1000)
    : null;
  const diasRestantesGoogle = cliente?.investimento_dia_google > 0 
    ? Math.floor((cliente?.saldo_google || 0) / cliente.investimento_dia_google) 
    : null;

  return (
    <div className="space-y-6">
      {/* New Leads Alert */}
      {showNewLeadAlert && (
        <Alert className="bg-green-50 border-green-200 animate-in fade-in slide-in-from-top-4">
          <AlertDescription className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695d14d862b9c933054dfba4/9c0850cc4_image.png" 
                  alt="Google" 
                  className="w-5 h-5"
                />
                <span className="text-green-800 font-semibold">
                  🎉 {newLeadsCount} {newLeadsCount === 1 ? 'novo lead cadastrado' : 'novos leads cadastrados'} na planilha Google!
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewLeadAlert(false)}
                className="hover:bg-green-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {newLeadsData.length > 0 && (
              <div className="space-y-2 pl-7">
                {newLeadsData.slice(0, 3).map((lead, idx) => (
                  <div key={idx} className="text-sm text-green-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="font-medium">{lead.nome}</span>
                    <span className="text-green-600">•</span>
                    <span>{lead.telefone}</span>
                  </div>
                ))}
                {newLeadsData.length > 3 && (
                  <div className="text-xs text-green-600 pl-3.5">
                    + {newLeadsData.length - 3} mais {newLeadsData.length - 3 === 1 ? 'lead' : 'leads'}
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome & Health Score */}
      <div className="grid lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3 p-6 bg-gradient-to-br from-violet-600 to-violet-700 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Olá, {user?.full_name?.split(' ')[0] || 'Gestor'}! 👋
              </h2>
              <p className="text-violet-200 mt-1">
                {cliente ? `${cliente.nome} • ` : ''}
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-sm text-violet-200 mt-3 max-w-xl">
                Acompanhe a performance das suas campanhas e demandas em tempo real. 
                Qualquer dúvida, estamos aqui!
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleRefreshData}
                disabled={isRefreshing}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Link to={createPageUrl('Chat')}>
                <Button 
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Chat
                </Button>
              </Link>
              <Link to={createPageUrl('AbrirDemanda')}>
                <Button className="bg-white text-violet-700 hover:bg-violet-50 font-semibold">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Nova Demanda
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-slate-500 mb-3">Health Score</p>
          <HealthScore 
            score={healthScoreData?.nota || cliente?.health_score || 75} 
            percentil={healthScoreData?.percentil}
            size="md" 
          />
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Leads Meta"
          value={(contaMetaAdsAtual?.cadastros_whats ?? contaMetaAdsAtual?.new_messaging_connections ?? contaMetaAdsAtual?.messaging_conversations ?? cliente?.leads_meta_mes)?.toLocaleString('pt-BR') || '-'}
          subtitle="Este mês"
          icon={Users}
          variant="primary"
        />
        <KPICard
          title="CPL Meta"
          value={formatCurrency(contaMetaAdsAtual?.cost_per_new_messaging ?? contaMetaAdsAtual?.cost_per_messaging ?? cliente?.custo_por_lead_meta)}
          subtitle="Custo por lead"
          icon={DollarSign}
          variant={(contaMetaAdsAtual?.cost_per_new_messaging ?? contaMetaAdsAtual?.cost_per_messaging ?? cliente?.custo_por_lead_meta) > (cliente?.cpl_baseline_meta * 1.2) ? 'warning' : 'default'}
        />
        <KPICard
          title="Leads Google"
          value={totalLeadsGoogle.toLocaleString('pt-BR') || '-'}
          subtitle="Leads via Google Ads (planilha)"
          icon={Users}
          variant="success"
        />
        <KPICard
          title="CPC Google"
          value={formatCurrency(googleCPC)}
          subtitle={contaGoogleAdsAtual ? 'Custo por clique (Google Ads)' : 'Custo por clique'}
          icon={MousePointerClick}
          variant="default"
        />
      </div>

      {/* Métricas de Alcance e Engajamento */}
      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Métricas de Performance</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Eye className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsImpressions?.toLocaleString('pt-BR') || '-'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Impressions</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MousePointerClick className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsEngagement?.toLocaleString('pt-BR') || '-'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Page Engagement</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-pink-100 rounded-lg">
                <ThumbsUp className="w-5 h-5 text-pink-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsPageLikes?.toLocaleString('pt-BR') || '-'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Page Likes</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Radio className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsReach?.toLocaleString('pt-BR') || '-'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Reach</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Target className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {metricsClicksAll?.toLocaleString('pt-BR') || '-'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Clicks (All)</p>
          </div>
        </div>
      </Card>

      {/* Saldos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-900">Saldo Meta</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(saldoMeta)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              Próx. investimento: {dataProximoInvestimentoMeta 
                ? format(dataProximoInvestimentoMeta, "dd/MM") 
                : '-'}
            </div>
            {diasRestantesMeta !== null && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                diasRestantesMeta < 3 ? 'bg-red-100 text-red-700' : 
                diasRestantesMeta < 5 ? 'bg-amber-100 text-amber-700' : 
                'bg-emerald-100 text-emerald-700'
              }`}>
                ~{diasRestantesMeta} dias restantes
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-violet-100 rounded-lg">
                <DollarSign className="w-4 h-4 text-violet-600" />
              </div>
              <span className="font-semibold text-slate-900">Gasto Diário Meta</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(gastoDiarioMeta)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              Ontem (D-1)
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              Da planilha
            </span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <Wallet className="w-4 h-4 text-red-600" />
              </div>
              <span className="font-semibold text-slate-900">Saldo Google</span>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(cliente?.saldo_google)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              Próx. investimento: {cliente?.data_proximo_investimento_google 
                ? format(new Date(cliente.data_proximo_investimento_google), "dd/MM") 
                : '-'}
            </div>
            {diasRestantesGoogle !== null && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                diasRestantesGoogle < 3 ? 'bg-red-100 text-red-700' : 
                diasRestantesGoogle < 5 ? 'bg-amber-100 text-amber-700' : 
                'bg-emerald-100 text-emerald-700'
              }`}>
                ~{diasRestantesGoogle} dias restantes
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Histórico Diário de Leads */}
      <Card className="p-5">
        <DailyLeadsChart clienteId={selectedClienteId} clienteNome={cliente?.nome} />
      </Card>

      {/* Alerts, Demandas, Ações */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Alertas</h3>
          <AlertsSection 
            cliente={cliente} 
            saldoMeta={saldoMeta}
            gastoDiarioMeta={gastoDiarioMeta}
            contaMetaAdsAtual={contaMetaAdsAtual}
          />
        </div>
        <RecentDemandas demandas={demandasAbertas} />
        <AcoesVoxxCard acoes={acoes} otimizacoes={otimizacoesMetaAds} demandasConcluidas={demandasConcluidas} />
      </div>
    </div>
  );
}