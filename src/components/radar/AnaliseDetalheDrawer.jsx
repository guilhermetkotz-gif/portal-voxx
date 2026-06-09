import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Play, Loader2, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import {
  STATUS_CONFIG, CHURN_CONFIG, CLIMA_CONFIG, TENDENCIA_CONFIG
} from './AbaAnalises';

const TZ = 'America/Sao_Paulo';

function ScoreBar({ label, score, color }) {
  const colors = {
    emerald: 'bg-emerald-500',
    green:   'bg-green-500',
    yellow:  'bg-yellow-500',
    orange:  'bg-orange-500',
    blue:    'bg-blue-500',
    violet:  'bg-violet-500',
  };
  const barColor = score >= 75 ? colors.emerald : score >= 60 ? colors.yellow : score >= 40 ? colors.orange : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-semibold text-white">{score ?? '—'}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${score || 0}%` }} />
      </div>
    </div>
  );
}

function Lista({ items, icon: Icon, color }) {
  if (!items?.length) return <p className="text-slate-500 text-xs">Nenhum item identificado.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${color}`} />
          <span className="text-slate-300">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AnaliseDetalheDrawer({ analise: a, grupo, analiseHistorico, onClose, onReanalisar, gerandoId }) {
  if (!a) return null;
  const statusCfg   = STATUS_CONFIG[a.status] || STATUS_CONFIG['sem_dados'];
  const churnCfg    = CHURN_CONFIG[a.risco_churn] || CHURN_CONFIG['moderado'];
  const climaCfg    = CLIMA_CONFIG[a.clima_emocional] || CLIMA_CONFIG['sem_dados'];
  const tendCfg     = TENDENCIA_CONFIG[a.tendencia] || TENDENCIA_CONFIG['sem_dados'];
  const TendIcon    = tendCfg.icon;
  const isGerando   = gerandoId === grupo?.grupo_id;

  const base = a.base_analisada || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-[10px] border ${statusCfg.color}`}>{statusCfg.label}</Badge>
              {a.score_geral != null && (
                <span className="text-2xl font-bold text-white">{a.score_geral}</span>
              )}
            </div>
            <h2 className="text-base font-bold text-white truncate">{a.cliente_nome || a.grupo_nome}</h2>
            <p className="text-slate-400 text-xs">{a.grupo_nome} · {a.periodo_label}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onReanalisar} disabled={isGerando}
              className="text-violet-400 hover:text-violet-300 h-8 gap-1 text-xs">
              {isGerando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Re-analisar
            </Button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* Card Executivo */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scores</h3>
              <div className="space-y-3">
                <ScoreBar label="Score Geral" score={a.score_geral} />
                <ScoreBar label="Atendimento VOXX (35%)" score={a.score_atendimento} />
                <ScoreBar label="Relacionamento (25%)" score={a.score_relacionamento} />
                <ScoreBar label="Operação (25%)" score={a.score_operacao} />
                <ScoreBar label="Tempo & Fluxo (15%)" score={a.score_tempo_fluxo} />
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <MetricPill label="Risco Churn" value={churnCfg.label} color={churnCfg.color} />
                <MetricPill label="Clima" value={climaCfg.label} color={climaCfg.color} />
                <MetricPill label="Tendência" value={tendCfg.label} color={tendCfg.color} icon={TendIcon} />
                <MetricPill label="Pressão"
                  value={{ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }[a.pressao_cliente] || '—'}
                  color={a.pressao_cliente === 'critica' ? 'text-red-400' : a.pressao_cliente === 'alta' ? 'text-orange-400' : 'text-slate-300'}
                />
              </div>
            </section>

            {/* Resumo Executivo */}
            {a.resumo_executivo && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Resumo Executivo</h3>
                <p className="text-slate-300 text-sm leading-relaxed bg-slate-800 rounded-xl p-4 border border-slate-700">
                  {a.resumo_executivo}
                </p>
              </section>
            )}

            {/* Diagnóstico */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Diagnóstico</h3>

              {a.pontos_positivos?.length > 0 && (
                <div>
                  <p className="text-xs text-emerald-400 mb-2 font-medium">Pontos positivos</p>
                  <Lista items={a.pontos_positivos} icon={CheckCircle2} color="text-emerald-400" />
                </div>
              )}

              {a.pontos_atencao?.length > 0 && (
                <div>
                  <p className="text-xs text-yellow-400 mb-2 font-medium">Pontos de atenção</p>
                  <Lista items={a.pontos_atencao} icon={AlertTriangle} color="text-yellow-400" />
                </div>
              )}

              {a.alertas?.length > 0 && (
                <div>
                  <p className="text-xs text-red-400 mb-2 font-medium">Alertas</p>
                  <Lista items={a.alertas} icon={AlertTriangle} color="text-red-400" />
                </div>
              )}

              {a.solicitacoes_sem_conclusao?.length > 0 && (
                <div>
                  <p className="text-xs text-orange-400 mb-2 font-medium">Solicitações sem conclusão</p>
                  <Lista items={a.solicitacoes_sem_conclusao} icon={AlertTriangle} color="text-orange-400" />
                </div>
              )}

              {a.principal_risco && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
                  <p className="text-xs text-red-400 font-medium mb-1">Principal risco</p>
                  <p className="text-sm text-red-300">{a.principal_risco}</p>
                </div>
              )}

              {a.prioridade_semana && (
                <div className="bg-violet-950/20 border border-violet-900/30 rounded-xl p-3">
                  <p className="text-xs text-violet-400 font-medium mb-1">Prioridade da semana</p>
                  <p className="text-sm text-violet-300">{a.prioridade_semana}</p>
                </div>
              )}
            </section>

            {/* Recomendações VOXX */}
            {a.recomendacoes_voxx?.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recomendações VOXX</h3>
                <Lista items={a.recomendacoes_voxx} icon={Star} color="text-violet-400" />
              </section>
            )}

            {/* Base analisada */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Base Analisada</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Período', base.periodo_dias ? `${base.periodo_dias} dias` : a.periodo_label],
                  ['Total mensagens', base.total_mensagens],
                  ['Mensagens VOXX', base.mensagens_voxx],
                  ['Mensagens cliente', base.mensagens_cliente],
                  ['Desconhecidas', base.mensagens_desconhecidas],
                  ['Sistema', base.mensagens_sistema],
                  ['Primeira mensagem', base.primeira_mensagem],
                  ['Última mensagem', base.ultima_mensagem],
                  ['Última VOXX', base.ultima_mensagem_voxx],
                  ['Última cliente', base.ultima_mensagem_cliente],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className="text-slate-200">{val ?? '—'}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Gerada em {moment(a.created_date).tz(TZ).format('DD/MM/YYYY HH:mm')} por {a.gerado_por_nome || a.gerado_por}
              </p>
            </section>

            {/* Histórico */}
            {analiseHistorico.length > 1 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Histórico de análises</h3>
                <div className="space-y-2">
                  {analiseHistorico.slice(0, 8).map((h, i) => {
                    const sCfg = STATUS_CONFIG[h.status || 'sem_dados'];
                    return (
                      <div key={h.id} className={`flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 text-xs ${i === 0 ? 'border border-violet-800/40' : ''}`}>
                        <span className="text-slate-400">{moment(h.created_date).tz(TZ).format('DD/MM/YYYY HH:mm')}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white">{h.score_geral ?? '—'}</span>
                          <Badge className={`text-[10px] border ${sCfg.color}`}>{sCfg.label}</Badge>
                          {h.risco_churn && <span className={`${CHURN_CONFIG[h.risco_churn]?.color || ''} text-[11px]`}>{CHURN_CONFIG[h.risco_churn]?.label}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function MetricPill({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-slate-800 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold flex items-center gap-1 ${color}`}>
        {Icon && <Icon className="w-3 h-3" />}{value}
      </p>
    </div>
  );
}