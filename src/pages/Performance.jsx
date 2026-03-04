import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import KPICard from '@/components/ui/KPICard';
import { Loader2, HelpCircle, TrendingUp, Target, Users, DollarSign, MousePointerClick, Phone, MessageCircle, Eye, Radio, ThumbsUp } from 'lucide-react';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const MetricTooltip = ({ term, children }) => {
  const definitions = {
    CPL: "Custo Por Lead - quanto você paga em média por cada lead gerado.",
    CPC: "Custo Por Clique - valor médio pago por cada clique no anúncio.",
    Leads: "Pessoas que demonstraram interesse e deixaram contato.",
    Saldo: "Valor disponível para investimento na plataforma.",
    Investimento: "Valor já gasto na plataforma no mês atual."
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <HelpCircle className="w-3 h-3 text-slate-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{definitions[term] || term}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function Performance({ currentCliente, selectedClienteId, user }) {
  const [activeTab, setActiveTab] = useState('meta');

  // Buscar gasto diário da planilha "ontem meta Ads"
  const { data: sheetData } = useQuery({
    queryKey: ['amountSpentFromSheet'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getAmountSpentFromSheet', {});
      return response.data;
    },
    staleTime: 2 * 60 * 1000
  });

  const diarioD1ByAccount = sheetData?.diarioD1ByAccount || {};
  const amountSpentByAccount = sheetData?.amountSpentByAccount || {};

  // Buscar planejamento do mês atual
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const currentMonth = `${ano}-${String(mes).padStart(2, '0')}`;

  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentosPerformance', currentMonth, currentCliente?.id],
    queryFn: () => base44.entities.PlanejamentoEstrategico.filter({
      mes_referencia: `${currentMonth}-01`,
      cliente_id: currentCliente?.id
    }),
    enabled: !!currentCliente?.id,
    staleTime: 30 * 1000
  });

  // Calcular budget restante
  const budgetRestante = useMemo(() => {
    const planejamento = planejamentos[0];
    if (!planejamento || !currentCliente) return 0;

    const investimentoTotal = (planejamento.meta_faturamento * planejamento.percentual_investimento_marketing) / 100;
    const totalMetaAds = investimentoTotal - (planejamento.investimento_google || 0) - (planejamento.investimento_tiktok || 0);
    const valorImpostos = (totalMetaAds * planejamento.percentual_impostos) / 100;
    const investimentoLeads = totalMetaAds - valorImpostos - (planejamento.investimento_feed || 0);
    
    const budgetMensal = investimentoLeads;
    
    // Buscar valor investido
    let valorInvestido = 0;
    const nomeCliente = currentCliente.nome?.trim();
    
    const normalizeNome = (nome) => {
      return nome?.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '')
        .trim() || '';
    };
    
    const clienteNormalizado = normalizeNome(nomeCliente);
    
    if (nomeCliente && amountSpentByAccount[nomeCliente] !== undefined) {
      valorInvestido = amountSpentByAccount[nomeCliente];
    } else {
      const matchingKey = Object.keys(amountSpentByAccount).find(key => 
        normalizeNome(key) === clienteNormalizado
      );
      
      if (matchingKey) {
        valorInvestido = amountSpentByAccount[matchingKey];
      }
    }
    
    return budgetMensal - valorInvestido;
  }, [planejamentos, currentCliente, amountSpentByAccount]);

  // Buscar conta Meta Ads atualizada
  const { data: todasContasMetaAds = [] } = useQuery({
    queryKey: ['contasMetaAdsPerformance'],
    queryFn: () => base44.entities.ContaMetaAds.list('-created_date', 500),
    staleTime: 2 * 60 * 1000
  });

  // Buscar conta Google Ads atualizada
  const { data: googleAdsAccounts = [] } = useQuery({
    queryKey: ['googleAdsAccountsPerformance'],
    queryFn: () => base44.entities.GoogleAdsAccount.list('-data_atualizacao', 500),
    staleTime: 2 * 60 * 1000
  });

  const cliente = currentCliente;
  const tipoUsuario = user?.tipo_usuario || user?.tipo_acesso;
  const isVoxx = tipoUsuario === 'voxx_admin' || tipoUsuario === 'voxx_operacao' || tipoUsuario === 'voxx_manager' || user?.role === 'admin';

  // Conta Meta Ads atualizada do cliente
  const contaMetaAds = todasContasMetaAds.find(c =>
    c.account_name === cliente?.meta_ads_account_name ||
    c.account_name === cliente?.nome
  );

  // Conta Google Ads atualizada do cliente
  const contaGoogleAds = googleAdsAccounts.find(c =>
    c.account_name === cliente?.google_ads_account_name ||
    c.account_name === cliente?.nome
  );

  // Buscar gasto diário do cliente atual
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="meta" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Meta Ads
          </TabsTrigger>
          <TabsTrigger value="google" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            Google Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6 mt-6">
          {/* Meta KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Leads Entregues"
              value={(contaMetaAds?.messaging_conversations ?? contaMetaAds?.new_messaging_connections ?? cliente?.leads_meta_mes)?.toLocaleString('pt-BR') || '-'}
              subtitle="Este mês"
              icon={Users}
              variant="primary"
            />
            <KPICard
              title="CPL"
              value={formatCurrency(contaMetaAds?.cost_per_new_messaging ?? contaMetaAds?.cost_per_messaging ?? cliente?.custo_por_lead_meta)}
              subtitle="Custo por lead"
              icon={DollarSign}
              variant={(contaMetaAds?.cost_per_new_messaging ?? cliente?.custo_por_lead_meta) > (cliente?.cpl_baseline_meta * 1.2) ? 'warning' : 'default'}
            />
            <KPICard
              title="Gasto Diário (D-1)"
              value={formatCurrency(gastoDiarioMeta)}
              subtitle="Da planilha ontem"
              icon={TrendingUp}
              variant="default"
            />
            <KPICard
              title="Investimento no Mês"
              value={formatCurrency(cliente?.investimento_meta_mes)}
              subtitle={`Total acumulado`}
              icon={TrendingUp}
            />
            <KPICard
              title="BUDGET RESTANTE META ADS"
              value={formatCurrency(budgetRestante)}
              subtitle={`Mês ${mes}/${ano}`}
              icon={Target}
              variant={budgetRestante < (gastoDiarioMeta * 3) ? 'danger' : 'success'}
            />
          </div>



          {/* Métricas Detalhadas Meta */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Métricas Detalhadas</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Eye className="w-5 h-5 text-violet-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Impressions</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.impressions?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Radio className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Reach</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.reach?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MousePointerClick className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Page Engagement</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.page_engagement?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-pink-100 rounded-lg">
                    <ThumbsUp className="w-5 h-5 text-pink-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Page Likes</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.page_likes?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Target className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Clicks (All)</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.clicks_all?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">CPC (Link Click)</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(cliente?.cpc_link_click)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-teal-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">CPC (All)</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(cliente?.cpc_all)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Cost per Unique Link Click</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(cliente?.cost_per_unique_link)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">New Messaging Connections</p>
                <p className="text-lg font-bold text-slate-900">
                  {cliente?.new_messaging_connections?.toLocaleString('pt-BR') || '-'}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">Cost per New Messaging</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCurrency(cliente?.cost_per_new_messaging)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-1">% Leads Repetidos</p>
                <p className="text-lg font-bold text-slate-900">
                  {(() => {
                    const leads = cliente?.leads_meta_mes || 0;
                    const newConnections = cliente?.new_messaging_connections || 0;
                    if (leads === 0) return '-';
                    const diff = leads - newConnections;
                    const percentage = ((diff / leads) * 100).toFixed(1);
                    return `${percentage}%`;
                  })()}
                </p>
              </div>
            </div>
          </Card>

          {/* Recommendations */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">💡 Ações Recomendadas</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <strong>Se o CPL subir:</strong> Revisamos segmentação de público, testamos novos criativos e ajustamos a frequência de exibição.
              </p>
              <p>
                <strong>Se os leads estiverem fora de perfil:</strong> Ajustamos idade, localização e interesses do público-alvo.
              </p>
              <p>
                <strong>Para melhorar resultados:</strong> Envie vídeos de depoimentos e antes/depois para usarmos nos criativos.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="space-y-6 mt-6">
          {/* Google KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Leads Cadastro"
              value={cliente?.leads_google_cadastro?.toLocaleString('pt-BR') || '-'}
              subtitle="Formulários preenchidos"
              icon={Users}
              variant="success"
            />
            <KPICard
              title="Leads Ligação"
              value={cliente?.leads_google_ligacao?.toLocaleString('pt-BR') || '-'}
              subtitle="Ligações recebidas"
              icon={Phone}
            />
            <KPICard
              title="Cliques WhatsApp"
              value={cliente?.cliques_google_whatsapp?.toLocaleString('pt-BR') || '-'}
              subtitle="Cliques no botão"
              icon={MessageCircle}
            />
            <KPICard
              title="CPC"
              value={formatCurrency(cliente?.cpc_google)}
              subtitle="Custo por clique"
              icon={MousePointerClick}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <KPICard
              title="Investimento no Mês"
              value={formatCurrency(cliente?.investimento_google_mes)}
              subtitle={`${formatCurrency(cliente?.investimento_dia_google)}/dia`}
              icon={TrendingUp}
            />
            <KPICard
              title="Saldo Disponível"
              value={formatCurrency(cliente?.saldo_google)}
              icon={Target}
              variant={cliente?.saldo_google < (cliente?.investimento_dia_google * 3) ? 'danger' : 'success'}
            />
          </div>

          {/* Google Table - hidden for non-voxx; voxx sees aggregated view in MonitoramentoContas */}
          {false && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold">Visão Geral - Google Ads</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Cadastros</TableHead>
                      <TableHead className="text-right">Ligações</TableHead>
                      <TableHead className="text-right">WhatsApp</TableHead>
                      <TableHead className="text-right"><MetricTooltip term="CPC">CPC</MetricTooltip></TableHead>
                      <TableHead className="text-right"><MetricTooltip term="Saldo">Saldo</MetricTooltip></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((c) => (
                      <TableRow key={c.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-right">{c.leads_google_cadastro || '-'}</TableCell>
                        <TableCell className="text-right">{c.leads_google_ligacao || '-'}</TableCell>
                        <TableCell className="text-right">{c.cliques_google_whatsapp || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(c.cpc_google)}</TableCell>
                        <TableCell className="text-right">
                          <span className={c.saldo_google < (c.investimento_dia_google * 3) ? 'text-red-600 font-semibold' : ''}>
                            {formatCurrency(c.saldo_google)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Recommendations */}
          <Card className="p-5">
            <h3 className="font-semibold text-slate-900 mb-3">💡 Ações Recomendadas</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <strong>Se poucas ligações:</strong> Verificamos extensões de chamada e horários de exibição.
              </p>
              <p>
                <strong>Se CPC alto:</strong> Otimizamos palavras-chave negativas e ajustamos lances.
              </p>
              <p>
                <strong>Para melhorar conversões:</strong> Garanta que o time comercial atenda rapidamente os leads.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}