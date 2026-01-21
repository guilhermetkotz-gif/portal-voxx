import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, Users, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Math.round(value).toLocaleString('pt-BR');
};

export default function InfograficoExecutivo({ planejamento, clienteNome }) {
  if (!planejamento) return null;

  // Cálculos
  const investimentoTotal = (planejamento.meta_faturamento * planejamento.percentual_investimento_marketing) / 100;
  const valorImpostos = (planejamento.meta_faturamento * planejamento.percentual_impostos) / 100;
  const investimentoLeads = investimentoTotal - planejamento.investimento_feed - planejamento.investimento_google - planejamento.investimento_tiktok;
  const totalMetaAds = planejamento.investimento_feed + investimentoLeads;
  
  const projecaoLeads = planejamento.cpl_planejado > 0 ? investimentoLeads / planejamento.cpl_planejado : 0;
  const projecaoContatos = projecaoLeads * (planejamento.conversao_leads_contatos / 100);
  const projecaoAgendamentos = projecaoContatos * (planejamento.conversao_contatos_agendamento / 100);
  const projecaoComparecimentos = projecaoAgendamentos * (planejamento.conversao_agendamento_comparecimento / 100);
  const projecaoFechamentos = projecaoComparecimentos * (planejamento.conversao_comparecimento_fechamento / 100);
  
  const metaOnline = projecaoFechamentos * planejamento.ticket_medio;
  const participacaoDigital = planejamento.meta_faturamento > 0 ? (metaOnline / planejamento.meta_faturamento) * 100 : 0;

  const alertaInvestimento = (planejamento.investimento_feed + planejamento.investimento_google + planejamento.investimento_tiktok) > investimentoTotal;

  const getParticipacaoColor = (perc) => {
    if (perc >= 60) return 'bg-green-600';
    if (perc >= 40) return 'bg-yellow-500';
    return 'bg-red-600';
  };

  const getParticipacaoStatus = (perc) => {
    if (perc >= 60) return 'Saudável';
    if (perc >= 40) return 'Atenção';
    return 'Crítico';
  };

  const mesReferencia = planejamento.mes_referencia ? new Date(planejamento.mes_referencia) : new Date();

  // Distribuição de investimento
  const canais = [
    { nome: 'Meta Ads - Leads', valor: investimentoLeads, cor: 'bg-violet-500', perc: (investimentoLeads / investimentoTotal) * 100 },
    { nome: 'Meta Ads - Feed', valor: planejamento.investimento_feed, cor: 'bg-blue-500', perc: (planejamento.investimento_feed / investimentoTotal) * 100 },
    { nome: 'Google Ads', valor: planejamento.investimento_google, cor: 'bg-green-500', perc: (planejamento.investimento_google / investimentoTotal) * 100 },
    { nome: 'TikTok Ads', valor: planejamento.investimento_tiktok, cor: 'bg-pink-500', perc: (planejamento.investimento_tiktok / investimentoTotal) * 100 }
  ].filter(c => c.valor > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold">V</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  Planejamento Estratégico — {format(mesReferencia, "MMMM 'de' yyyy", { locale: ptBR }).charAt(0).toUpperCase() + format(mesReferencia, "MMMM 'de' yyyy", { locale: ptBR }).slice(1)}
                </h1>
                <p className="text-slate-400 text-sm">Unidade: {clienteNome}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metas Financeiras */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-800/50 border-slate-700 group cursor-help">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-slate-400 text-xs mb-1">Meta de Faturamento</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(planejamento.meta_faturamento)}</p>
            <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Valor alvo de receita mensal
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 group cursor-help">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-slate-400 text-xs mb-1">Investimento Total</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(investimentoTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">{planejamento.percentual_investimento_marketing}% da meta</p>
            <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Meta × {planejamento.percentual_investimento_marketing}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 group cursor-help">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-slate-400 text-xs mb-1">Ticket Médio (TKM)</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(planejamento.ticket_medio)}</p>
            <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Valor médio por fechamento
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 group cursor-help">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-slate-400 text-xs mb-1">Meta Online</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(metaOnline)}</p>
            <p className="text-xs text-slate-400 mt-1">{participacaoDigital.toFixed(1)}% digital</p>
            <div className="mt-2 text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Fechamentos × TKM
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-12 gap-6">
        {/* Distribuição de Investimento */}
        <div className="col-span-4 space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                <DollarSign className="w-5 h-5 text-violet-400" />
                Distribuição de Investimento
              </h3>

              {/* Barra de distribuição */}
              <div className="mb-4">
                <div className="flex h-8 rounded-lg overflow-hidden">
                  {canais.map((canal, idx) => (
                    <div
                      key={idx}
                      className={`${canal.cor} flex items-center justify-center text-xs font-semibold cursor-help`}
                      style={{ width: `${canal.perc}%` }}
                      title={`${canal.nome}: ${canal.perc.toFixed(1)}%`}
                    >
                      {canal.perc > 10 && `${canal.perc.toFixed(0)}%`}
                    </div>
                  ))}
                </div>
              </div>

              {alertaInvestimento && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-300">Investimentos excedem o total planejado</span>
                </div>
              )}

              {/* Cards por canal */}
              <div className="space-y-3">
                <div className="p-3 bg-violet-900/20 border border-violet-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-violet-300">Meta Ads — Leads</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(investimentoLeads)}</p>
                  </div>
                  <p className="text-xs text-slate-400">CPL Planejado: {formatCurrency(planejamento.cpl_planejado)}</p>
                </div>

                {planejamento.investimento_feed > 0 && (
                  <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-blue-300">Meta Ads — Feed</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(planejamento.investimento_feed)}</p>
                    </div>
                    <p className="text-xs text-slate-400">Engajamento</p>
                  </div>
                )}

                {planejamento.investimento_google > 0 && (
                  <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-green-300">Google Ads</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(planejamento.investimento_google)}</p>
                    </div>
                    <p className="text-xs text-slate-400">Performance</p>
                  </div>
                )}

                {planejamento.investimento_tiktok > 0 && (
                  <div className="p-3 bg-pink-900/20 border border-pink-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-pink-300">TikTok Ads</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(planejamento.investimento_tiktok)}</p>
                    </div>
                    <p className="text-xs text-slate-400">Performance</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funil de Projeção */}
        <div className="col-span-3 flex flex-col items-center justify-center">
          <h3 className="text-xl font-bold mb-6 text-center">Funil de Projeção de Entrega</h3>
          
          <div className="w-full space-y-3">
            {/* Leads */}
            <div className="w-full bg-gradient-to-r from-violet-600 to-violet-500 p-4 rounded-t-2xl shadow-lg group cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-90">LEADS</p>
                  <p className="text-xs opacity-75">CPL: {formatCurrency(planejamento.cpl_planejado)}</p>
                </div>
                <p className="text-3xl font-bold">{formatNumber(projecaoLeads)}</p>
              </div>
              <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                {formatCurrency(investimentoLeads)} ÷ {formatCurrency(planejamento.cpl_planejado)}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-slate-700 px-3 py-1 rounded text-xs font-semibold">
                ↓ {planejamento.conversao_leads_contatos}%
              </div>
            </div>

            {/* Contatos */}
            <div className="w-11/12 mx-auto bg-gradient-to-r from-blue-600 to-blue-500 p-4 rounded-xl shadow-lg group cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-90">CONTATOS ÚNICOS</p>
                  <p className="text-xs opacity-75">Conv. Leads → Contatos</p>
                </div>
                  <p className="text-2xl font-bold">{formatNumber(projecaoContatos)}</p>
              </div>
              <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                {formatNumber(projecaoLeads)} × {planejamento.conversao_leads_contatos}%
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-slate-700 px-3 py-1 rounded text-xs font-semibold">
                ↓ {planejamento.conversao_contatos_agendamento}%
              </div>
            </div>

            {/* Agendamentos */}
            <div className="w-10/12 mx-auto bg-gradient-to-r from-green-600 to-green-500 p-4 rounded-xl shadow-lg group cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-90">AGENDAMENTOS</p>
                  <p className="text-xs opacity-75">Conv. Contatos → Agendamento</p>
                </div>
                  <p className="text-2xl font-bold">{formatNumber(projecaoAgendamentos)}</p>
              </div>
              <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                {formatNumber(projecaoContatos)} × {planejamento.conversao_contatos_agendamento}%
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-slate-700 px-3 py-1 rounded text-xs font-semibold">
                ↓ {planejamento.conversao_agendamento_comparecimento}%
              </div>
            </div>

            {/* Comparecimentos */}
            <div className="w-9/12 mx-auto bg-gradient-to-r from-amber-600 to-amber-500 p-4 rounded-xl shadow-lg group cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-90">COMPARECIMENTOS</p>
                  <p className="text-xs opacity-75">Conv. Agendamento → Comparecimento</p>
                </div>
                  <p className="text-2xl font-bold">{formatNumber(projecaoComparecimentos)}</p>
              </div>
              <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                {formatNumber(projecaoAgendamentos)} × {planejamento.conversao_agendamento_comparecimento}%
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-slate-700 px-3 py-1 rounded text-xs font-semibold">
                ↓ {planejamento.conversao_comparecimento_fechamento}%
              </div>
            </div>

            {/* Fechamentos */}
            <div className="w-8/12 mx-auto bg-gradient-to-r from-emerald-600 to-emerald-500 p-4 rounded-b-2xl shadow-lg group cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold opacity-90">FECHAMENTOS</p>
                  <p className="text-xs opacity-75">Conv. Comparecimento → Fechamento</p>
                </div>
                  <p className="text-2xl font-bold">{formatNumber(projecaoFechamentos)}</p>
              </div>
              <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                {formatNumber(projecaoComparecimentos)} × {planejamento.conversao_comparecimento_fechamento}%
              </div>
            </div>
          </div>
        </div>

        {/* Resultado e Impacto Digital */}
        <div className="col-span-5 space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Resultado Projetado</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-violet-600 to-violet-700 rounded-lg group cursor-help">
                  <p className="text-xs opacity-90 mb-1">Faturamento Digital Projetado</p>
                  <p className="text-xl font-bold break-words">{formatCurrency(metaOnline)}</p>
                  <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity">
                    {formatNumber(projecaoFechamentos)} fechamentos × {formatCurrency(planejamento.ticket_medio)}
                  </div>
                </div>

                <div className={`p-4 ${getParticipacaoColor(participacaoDigital)} rounded-lg group cursor-help`}>
                  <p className="text-xs opacity-90 mb-1">Participação Digital</p>
                  <p className="text-3xl font-bold">{participacaoDigital.toFixed(1)}%</p>
                  <p className="text-xs opacity-90 mt-2">{getParticipacaoStatus(participacaoDigital)}</p>
                  <div className="mt-2 text-xs opacity-0 group-hover:opacity-75 transition-opacity border-t border-white/20 pt-2">
                    {formatCurrency(metaOnline)} ÷ {formatCurrency(planejamento.meta_faturamento)}
                  </div>
                </div>

                <div className="p-3 bg-slate-700/50 rounded-lg text-xs">
                  <p className="font-semibold mb-2">Status:</p>
                  <ul className="space-y-1 text-slate-300">
                    <li>≥ 60% — Saudável ✓</li>
                    <li>40-59% — Atenção ⚠</li>
                    <li>&lt; 40% — Crítico ✗</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-8 pt-6 border-t border-slate-700 text-center">
        <p className="text-xs text-slate-400">
          Este planejamento é uma projeção estratégica baseada nos dados informados. Os resultados dependem da execução, operação da unidade e contexto de mercado.
        </p>
      </div>
    </div>
  );
}