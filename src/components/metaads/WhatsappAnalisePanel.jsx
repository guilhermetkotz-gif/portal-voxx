import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, X, CheckCircle2, AlertTriangle, Star, ShieldAlert, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_STYLES = {
  excelente:   { label: 'Excelente',   badge: 'bg-emerald-600 text-white' },
  saudavel:    { label: 'Saudável',    badge: 'bg-green-600 text-white' },
  atencao:     { label: 'Atenção',     badge: 'bg-yellow-600 text-white' },
  critico:     { label: 'Crítico',     badge: 'bg-orange-700 text-white' },
  emergencial: { label: 'Emergencial', badge: 'bg-red-700 text-white' },
  sem_dados:   { label: 'Sem dados',   badge: 'bg-slate-600 text-white' },
};

function scoreColor(score) {
  if (score == null) return 'text-slate-400';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function ListItems({ items, icon: Icon, iconColor }) {
  if (!items?.length) return <p className="text-slate-500 text-xs">Nenhum item identificado.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', iconColor)} />
          <span className="text-slate-200">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function WhatsappAnalisePanel({ clienteNome }) {
  const [reanalyzing, setReanalyzing] = useState(false);

  const { data: analises = [], isLoading } = useQuery({
    queryKey: ['whatsappAnaliseModal', clienteNome],
    queryFn: () => base44.entities.WhatsappAnaliseGrupo.filter(
      { cliente_nome: clienteNome },
      '-created_date',
      10
    ),
    enabled: !!clienteNome,
    staleTime: 60 * 1000,
  });

  const analise = analises[0] || null;

  const handleReanalyze = async () => {
    if (!analise?.grupo_id) {
      toast.error('Grupo WhatsApp não vinculado a esta análise.');
      return;
    }
    setReanalyzing(true);
    try {
      const resp = await base44.functions.invoke('gerarAnaliseGrupoWhatsapp', {
        grupo_id: analise.grupo_id,
        periodo_dias: 7,
      });
      if (resp.data?.ok === false) {
        toast.info(resp.data.mensagem || 'Não foi possível gerar a análise.');
      } else {
        toast.success('Análise do WhatsApp atualizada!');
      }
    } catch (error) {
      toast.error('Erro ao re-analisar: ' + (error.message || 'erro desconhecido'));
    } finally {
      setReanalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-[#0f1320] p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
        <span className="text-slate-400 text-sm ml-2">Carregando análise WhatsApp...</span>
      </div>
    );
  }

  if (!analise) {
    return (
      <div className="rounded-xl bg-[#0f1320] p-4 text-center">
        <p className="text-slate-500 text-sm">Nenhuma análise de WhatsApp Radar encontrada para este cliente.</p>
      </div>
    );
  }

  const statusCfg = STATUS_STYLES[analise.status] || STATUS_STYLES['sem_dados'];

  return (
    <div className="rounded-xl bg-[#0f1320] border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', statusCfg.badge)}>
              {statusCfg.label}
            </span>
            {analise.score_geral != null && (
              <span className={cn('text-2xl font-bold', scoreColor(analise.score_geral))}>
                {analise.score_geral}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white truncate">
            {analise.cliente_nome || analise.grupo_nome || clienteNome}
          </h3>
          <p className="text-slate-400 text-xs truncate">
            Radar WhatsApp · {analise.grupo_nome || '—'} · {analise.periodo_label || 'Últimos 7 dias'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-400 border border-violet-500/30 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
          >
            {reanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Re-analisar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-5">
        {/* RESUMO EXECUTIVO */}
        {analise.resumo_executivo && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resumo Executivo</h4>
            <div className="rounded-lg bg-[#1a2033] p-3">
              <p className="text-sm text-slate-100 leading-relaxed">{analise.resumo_executivo}</p>
            </div>
          </section>
        )}

        {/* DIAGNÓSTICO */}
        <section>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Diagnóstico</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-emerald-400 font-medium mb-1">Pontos positivos</p>
              <ListItems items={analise.pontos_positivos} icon={CheckCircle2} iconColor="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-1">Pontos de atenção</p>
              <ListItems items={analise.pontos_atencao} icon={AlertTriangle} iconColor="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-red-400 font-medium mb-1">Alertas</p>
              <ListItems items={analise.alertas} icon={AlertTriangle} iconColor="text-red-400" />
            </div>
          </div>
        </section>

        {/* SOLICITAÇÕES SEM CONCLUSÃO */}
        {analise.solicitacoes_sem_conclusao?.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Solicitações sem conclusão</h4>
            <ListItems items={analise.solicitacoes_sem_conclusao} icon={AlertTriangle} iconColor="text-orange-400" />
          </section>
        )}

        {/* PRINCIPAL RISCO + PRIORIDADE SEMANA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analise.principal_risco && (
            <div className="rounded-lg bg-[#4c0519] border border-red-900/50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Principal risco</p>
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">{analise.principal_risco}</p>
            </div>
          )}
          {analise.prioridade_semana && (
            <div className="rounded-lg bg-[#2e1065] border border-violet-900/50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Prioridade da semana</p>
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">{analise.prioridade_semana}</p>
            </div>
          )}
        </div>

        {/* RECOMENDAÇÕES VOXX */}
        {analise.recomendacoes_voxx?.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recomendações VOXX</h4>
            <ul className="space-y-1.5">
              {analise.recomendacoes_voxx.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Star className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500" />
                  <span className="text-slate-200">{rec}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}