import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import LeadsChart from './LeadsChart';
import InsightAutomatico from './InsightAutomatico';
import { X, MapPin, User, TrendingUp, DollarSign, Zap, Activity, CheckCircle, Clock, AlertTriangle, Loader2, Target } from 'lucide-react';
import HistoricoReunioes from '@/components/agenda/HistoricoReunioes';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  saudavel: { label: 'Saudável', cls: 'bg-emerald-100 text-emerald-700' },
  atencao: { label: 'Atenção', cls: 'bg-amber-100 text-amber-700' },
  critico: { label: 'Crítico', cls: 'bg-red-100 text-red-700' },
};

const TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'acoes', label: 'Ações do Mês' },
  { id: 'demandas', label: 'Demandas' },
  { id: 'plano', label: 'Plano de Ação' },
  { id: 'reunioes', label: '📅 Reuniões' },
];

export default function UnidadeModal({ unidade, onClose, user }) {
  const [activeTab, setActiveTab] = useState('resumo');

  const { data: acoes = [], isLoading: loadingAcoes } = useQuery({
    queryKey: ['acoes_unidade', unidade.id],
    queryFn: () => base44.entities.MetaAdsOtimizacao.filter({ account_name: unidade.metaConta?.account_name || unidade.nome }, '-data_acao', 50),
    enabled: !!unidade.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: demandas = [], isLoading: loadingDemandas } = useQuery({
    queryKey: ['demandas_unidade', unidade.id],
    queryFn: () => base44.entities.Demanda.filter({ cliente_id: unidade.id }, '-created_date', 50),
    enabled: !!unidade.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: planosDeAcao = [] } = useQuery({
    queryKey: ['planos_unidade', unidade.id],
    queryFn: () => base44.entities.PlanoDeAcao.filter({ cliente_id: unidade.id }, '-created_date', 10),
    enabled: !!unidade.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: itensPlano = [] } = useQuery({
    queryKey: ['itens_plano_unidade', unidade.id],
    queryFn: async () => {
      const planos = await base44.entities.PlanoDeAcao.filter({ cliente_id: unidade.id }, '-created_date', 10);
      if (planos.length === 0) return [];
      const ids = planos.map(p => p.id);
      const allItems = await base44.entities.PlanoDeAcaoItem.filter({ cliente_id: unidade.id }, 'prazo', 50);
      return allItems;
    },
    enabled: !!unidade.id,
    staleTime: 5 * 60 * 1000,
  });

  const sc = STATUS_CONFIG[unidade.healthStatus] || STATUS_CONFIG.saudavel;

  const demandasEmAndamento = demandas.filter(d => !['concluida', 'finalizada'].includes(d.status));
  const demandasConcluidas = demandas.filter(d => ['concluida', 'finalizada'].includes(d.status));
  const demandasAtrasadas = demandas.filter(d => d.previsao_entrega && new Date(d.previsao_entrega) < new Date() && !['concluida', 'finalizada'].includes(d.status));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-3xl overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-10 bg-slate-900 text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sc.cls}`}>{sc.label}</span>
              </div>
              <h2 className="text-xl font-bold truncate">{unidade.nome}</h2>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{unidade.cidade}{unidade.estado ? `, ${unidade.estado}` : ''}</span>
                {unidade.responsavel_voxx_cs && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />CS: {unidade.responsavel_voxx_cs}</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="sticky top-[90px] z-10 bg-white border-b flex overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {/* RESUMO */}
          {activeTab === 'resumo' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Leads do Mês', value: unidade.leadsMes > 0 ? unidade.leadsMes : '—', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'CPL Meta', value: unidade.cpl > 0 ? `R$ ${unidade.cpl.toFixed(0)}` : '—', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Investimento Meta', value: unidade.investimentoMeta > 0 ? `R$ ${unidade.investimentoMeta.toFixed(0)}` : '—', icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Conversões Google', value: unidade.googleConta?.conversions > 0 ? unidade.googleConta.conversions.toFixed(0) : '—', icon: Zap, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: 'Frequência 7d', value: unidade.frequencia7d > 0 ? unidade.frequencia7d.toFixed(2) : '—', icon: Activity, color: unidade.frequencia7d > 2.5 ? 'text-amber-600' : 'text-slate-600', bg: unidade.frequencia7d > 2.5 ? 'bg-amber-50' : 'bg-slate-50' },
                  { label: 'Variação CPL', value: unidade.variacao !== 0 ? `${unidade.variacao > 0 ? '+' : ''}${unidade.variacao.toFixed(0)}%` : '—', icon: unidade.variacao > 0 ? TrendingUp : TrendingUp, color: unidade.variacao > 15 ? 'text-red-600' : 'text-emerald-600', bg: unidade.variacao > 15 ? 'bg-red-50' : 'bg-emerald-50' },
                ].map((kpi, i) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={i} className="p-4">
                      <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-2`}>
                        <Icon className={`w-4 h-4 ${kpi.color}`} />
                      </div>
                      <p className="text-xs text-slate-400">{kpi.label}</p>
                      <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    </Card>
                  );
                })}
              </div>

              {/* GRÁFICO */}
              {unidade.historicoLeads?.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold text-slate-800 mb-4 text-sm">Leads por Dia — Últimos 30 dias</h3>
                  <LeadsChart data={unidade.historicoLeads} />
                </Card>
              )}

              {/* INSIGHT AUTOMÁTICO */}
              <InsightAutomatico unidade={unidade} />
            </>
          )}

          {/* AÇÕES DO MÊS */}
          {activeTab === 'acoes' && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-4">Ações Realizadas no Mês</h3>
              {loadingAcoes ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
              ) : acoes.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma ação registrada para esta unidade.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {acoes.map(acao => (
                    <div key={acao.id} className="flex gap-4 p-4 border rounded-xl hover:bg-slate-50">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-violet-600" />
                        </div>
                        <div className="w-0.5 bg-slate-100 flex-1 mt-2" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Otimização</span>
                          {acao.data_acao && (
                            <span className="text-xs text-slate-400">{format(new Date(acao.data_acao), "dd/MM/yyyy", { locale: ptBR })}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800">{acao.objetivo}</p>
                        <p className="text-sm text-slate-600 mt-1">{acao.acoes_implementadas}</p>
                        {acao.problema && <p className="text-xs text-slate-400 mt-1">Problema: {acao.problema}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEMANDAS */}
          {activeTab === 'demandas' && (
            <div className="space-y-6">
              {loadingDemandas ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
              ) : (
                <>
                  {demandasAtrasadas.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="font-semibold text-red-700 text-sm">Atrasadas ({demandasAtrasadas.length})</h3>
                      </div>
                      <DemandaList items={demandasAtrasadas} colorClass="border-red-200 bg-red-50" />
                    </div>
                  )}
                  {demandasEmAndamento.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h3 className="font-semibold text-slate-700 text-sm">Em Andamento ({demandasEmAndamento.length})</h3>
                      </div>
                      <DemandaList items={demandasEmAndamento} colorClass="border-slate-200" />
                    </div>
                  )}
                  {demandasConcluidas.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <h3 className="font-semibold text-slate-700 text-sm">Concluídas ({demandasConcluidas.length})</h3>
                      </div>
                      <DemandaList items={demandasConcluidas} colorClass="border-slate-100 opacity-70" />
                    </div>
                  )}
                  {demandas.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma demanda registrada.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PLANO DE AÇÃO */}
          {activeTab === 'plano' && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-4">Plano de Ação Ativo</h3>
              {itensPlano.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum item de plano de ação cadastrado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensPlano.map(item => {
                    const isAtrasado = item.prazo && new Date(item.prazo) < new Date() && item.status_acao !== 'Concluída';
                    const statusColor = item.status_acao === 'Concluída' ? 'bg-emerald-100 text-emerald-700' :
                      item.status_acao === 'Em andamento' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
                    return (
                      <div key={item.id} className={`p-4 border rounded-xl ${isAtrasado ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{item.acao_proposta}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.problema_identificado}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{item.status_acao}</span>
                            {item.prazo && (
                              <span className={`text-xs ${isAtrasado ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                                {isAtrasado ? '⚠️ ' : ''}Prazo: {item.prazo}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-400">Responsável: {item.responsavel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* REUNIÕES */}
          {activeTab === 'reunioes' && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-4">Histórico de Reuniões</h3>
              <HistoricoReunioes unidadeId={unidade.id} />
            </div>
          )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-400">Responsável: {item.responsavel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemandaList({ items, colorClass }) {
  const STATUS_LABEL = {
    recebida: 'Recebida', em_triagem: 'Triagem', programada: 'Programada',
    em_execucao: 'Em Execução', aguardando_cliente: 'Aguardando', em_revisao: 'Revisão',
    concluida: 'Concluída', finalizada: 'Finalizada',
  };

  return (
    <div className="space-y-2">
      {items.slice(0, 10).map(d => (
        <div key={d.id} className={`p-3 border rounded-xl ${colorClass}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800 truncate">{d.titulo}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white border text-slate-600 flex-shrink-0">{STATUS_LABEL[d.status] || d.status}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400 capitalize">{d.setor?.replace(/_/g, ' ')}</span>
            {d.previsao_entrega && <span className="text-xs text-slate-400">Entrega: {d.previsao_entrega}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}