import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X, TrendingUp, TrendingDown, Minus, Brain, AlertTriangle,
  MessageSquare, Clock, CheckCircle2, XCircle, ChevronRight,
  Activity, Shield, Heart, Zap, BarChart3, Eye
} from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';

const RISCO_CONFIG = {
  critico: { label: 'Crítico', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  alto: { label: 'Alto', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medio: { label: 'Médio', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  baixo: { label: 'Baixo', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  sem_dados: { label: 'Sem dados', color: 'bg-slate-700/50 text-slate-400 border-slate-600/30' }
};

const CLIMA_CONFIG = {
  otimo: { label: '😊 Ótimo', color: 'text-green-400' },
  bom: { label: '🙂 Bom', color: 'text-emerald-400' },
  neutro: { label: '😐 Neutro', color: 'text-slate-400' },
  tenso: { label: '😟 Tenso', color: 'text-amber-400' },
  critico: { label: '😡 Crítico', color: 'text-red-400' },
  sem_dados: { label: '—', color: 'text-slate-600' }
};

const TENDENCIA_CONFIG = {
  melhorando: { label: 'Melhorando', icon: TrendingUp, color: 'text-green-400' },
  estavel: { label: 'Estável', icon: Minus, color: 'text-slate-400' },
  piorando: { label: 'Piorando', icon: TrendingDown, color: 'text-red-400' },
  sem_dados: { label: '—', icon: Minus, color: 'text-slate-600' }
};

function ScoreGauge({ score, label, size = 'md' }) {
  const color = score == null ? '#475569' : score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const isLg = size === 'lg';
  const radius = isLg ? 36 : 24;
  const stroke = isLg ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const dash = (progress / 100) * circumference;
  const svgSize = (radius + stroke) * 2 + 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: svgSize, height: svgSize }}>
        <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth={stroke} />
          <circle
            cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <span className={`absolute font-bold font-mono tabular-nums`}
          style={{ color, fontSize: isLg ? '1.25rem' : '0.75rem' }}>
          {score ?? '—'}
        </span>
      </div>
      {label && <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border-b border-slate-700/50">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
        <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, valueClass = 'text-slate-300' }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/40 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${valueClass}`}>{value ?? '—'}</span>
    </div>
  );
}

function InfograficoDimension({ label, score, icon: Icon }) {
  const color = score == null ? '#475569' : score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const pct = score ?? 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-right shrink-0">
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-6 text-[10px] font-mono text-right shrink-0" style={{ color }}>{score ?? '—'}</span>
    </div>
  );
}

function HistoricoCard({ resumo, onVer }) {
  const score = resumo.score_geral || null;
  const color = score == null ? 'text-slate-500' : score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-slate-800/40 last:border-0">
      <span className="text-xs text-slate-500 w-28 shrink-0 tabular-nums">
        {moment(resumo.data).format('DD/MM/YY')}
      </span>
      <span className={`text-xs font-bold font-mono w-8 ${color}`}>{score ?? '—'}</span>
      <Badge className={`text-[10px] px-1.5 py-0 border ${
        resumo.status_envio === 'enviado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
        resumo.status_envio === 'erro' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
        'bg-slate-700/50 text-slate-400 border-slate-600/20'
      }`}>
        {resumo.status_envio || 'pendente'}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 truncate">
          {resumo.mensagem_editada || resumo.mensagem_gerada || '—'}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-5 w-5 p-0 text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 shrink-0"
        onClick={() => onVer(resumo)}
      >
        <Eye className="w-3 h-3" />
      </Button>
    </div>
  );
}

function ResumoVisualizador({ resumo, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div>
            <p className="text-sm font-semibold text-slate-100">Análise de {moment(resumo.data).format('DD/MM/YYYY')}</p>
            <p className="text-xs text-slate-500">Score: {resumo.score_geral ?? '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {resumo.mensagem_editada || resumo.mensagem_gerada || 'Nenhuma mensagem gerada.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClienteAnaliseDrawer({ cliente, clienteEnriquecido, onClose }) {
  const [resumoVisualizado, setResumoVisualizado] = useState(null);

  const risco = RISCO_CONFIG[clienteEnriquecido?.risco_churn] || RISCO_CONFIG.sem_dados;
  const clima = CLIMA_CONFIG[clienteEnriquecido?.clima_emocional] || CLIMA_CONFIG.sem_dados;
  const tendencia = TENDENCIA_CONFIG[clienteEnriquecido?.tendencia] || TENDENCIA_CONFIG.sem_dados;
  const TendIcon = tendencia.icon;

  // Buscar todos os resumos do cliente (histórico)
  const { data: historico = [] } = useQuery({
    queryKey: ['analisesHistorico', cliente.id],
    queryFn: () => base44.entities.ResumoDiarioCliente.filter({ cliente_id: cliente.id }, '-data', 30),
    staleTime: 30 * 1000,
    enabled: !!cliente.id
  });

  // Último resumo (mais recente)
  const ultimoResumo = historico[0] || null;
  const temAnalise = !!ultimoResumo;

  // Métricas base de mensagens (do último resumo ou mock)
  const score = clienteEnriquecido?.score ?? null;
  const hasSemAnalise = !temAnalise;

  // Dimensões do infográfico — derivadas do score e dados disponíveis
  const dims = [
    { label: 'Saúde Geral', score, icon: Activity },
    { label: 'Atend. VOXX', score: score != null ? Math.min(100, score + 5) : null, icon: Shield },
    { label: 'Relacionamento', score: clienteEnriquecido?.dias_sem_contato != null
        ? Math.max(0, 100 - clienteEnriquecido.dias_sem_contato * 3)
        : null, icon: Heart },
    { label: 'Operação', score: clienteEnriquecido?.pressao_cliente != null
        ? Math.max(0, 100 - clienteEnriquecido.pressao_cliente * 15)
        : null, icon: Zap },
    { label: 'Pressão Cliente', score: clienteEnriquecido?.pressao_cliente != null
        ? clienteEnriquecido.pressao_cliente * 20
        : null, icon: AlertTriangle },
  ];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col bg-slate-950 border-l border-slate-800 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">{cliente.nome}</p>
              <p className="text-xs text-slate-500">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</p>
            </div>
            {clienteEnriquecido?.qtd_alertas > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 shrink-0">
                <AlertTriangle className="w-3 h-3" /> {clienteEnriquecido.qtd_alertas} alertas
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors ml-3 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* CTA sem análise */}
          {hasSemAnalise && (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Brain className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm font-medium text-slate-300 mb-1">Nenhuma análise encontrada</p>
              <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                {clienteEnriquecido?._estado_sem_analise || 'Este cliente ainda não possui análises geradas.'}
              </p>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                <Brain className="w-4 h-4" /> Gerar primeira análise
              </Button>
            </div>
          )}

          {/* Card Executivo */}
          <Section title="Card Executivo" icon={Activity}>
            <div className="flex items-start gap-5">
              {/* Score gauges */}
              <div className="flex items-start gap-4 shrink-0">
                <ScoreGauge score={score} label="Score Geral" size="lg" />
                <ScoreGauge score={score != null ? Math.min(100, score + 5) : null} label="Atendimento" size="md" />
              </div>
              {/* Badges */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge className={`text-xs px-2 py-0.5 border ${
                    cliente.status === 'ativo' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    cliente.status === 'pausado' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-slate-700/50 text-slate-400 border-slate-600/20'
                  }`}>
                    {cliente.status || '—'}
                  </Badge>
                  <Badge className={`text-xs px-2 py-0.5 border ${risco.color}`}>{risco.label}</Badge>
                  <span className={`flex items-center gap-1 text-xs ${tendencia.color}`}>
                    <TendIcon className="w-3.5 h-3.5" /> {tendencia.label}
                  </span>
                  <span className={`text-xs ${clima.color}`}>{clima.label}</span>
                </div>
                {/* Resumo executivo */}
                {ultimoResumo?.mensagem_gerada && (
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-[11px] text-slate-500 font-medium mb-1 uppercase tracking-wide">Resumo executivo</p>
                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                      {ultimoResumo.mensagem_editada || ultimoResumo.mensagem_gerada}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* Relatório Infográfico */}
          <Section title="Relatório Infográfico" icon={BarChart3}>
            <div className="space-y-2">
              {dims.map(d => (
                <InfograficoDimension key={d.label} label={d.label} score={d.score} icon={d.icon} />
              ))}
            </div>
          </Section>

          {/* Diagnóstico Completo */}
          {ultimoResumo && (
            <Section title="Diagnóstico Completo" icon={Shield}>
              <div className="space-y-0">
                <MetricRow label="Status Geral" value={ultimoResumo.status_revisao} />
                <MetricRow
                  label="Evolução"
                  value={tendencia.label}
                  valueClass={tendencia.color}
                />
                <MetricRow
                  label="Principal Risco"
                  value={clienteEnriquecido?._estado_sem_analise || ultimoResumo.observacao_revisao || '—'}
                  valueClass="text-amber-400"
                />
                <MetricRow
                  label="Alertas ativos"
                  value={clienteEnriquecido?.qtd_alertas > 0 ? `${clienteEnriquecido.qtd_alertas} alertas` : 'Nenhum'}
                  valueClass={clienteEnriquecido?.qtd_alertas > 0 ? 'text-red-400' : 'text-green-400'}
                />
                <MetricRow
                  label="Solicitações pendentes"
                  value={clienteEnriquecido?.pressao_cliente > 0 ? `${clienteEnriquecido.pressao_cliente} demandas aguardando` : 'Nenhuma'}
                  valueClass={clienteEnriquecido?.pressao_cliente > 0 ? 'text-amber-400' : 'text-green-400'}
                />
                <MetricRow
                  label="Prioridade da semana"
                  value={risco.label === 'Crítico' || risco.label === 'Alto' ? 'Alta — requer atenção' : 'Normal'}
                  valueClass={risco.label === 'Crítico' ? 'text-red-400' : risco.label === 'Alto' ? 'text-amber-400' : 'text-slate-400'}
                />
              </div>
              {ultimoResumo.observacao_revisao && (
                <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                  <p className="text-[10px] text-slate-500 font-medium uppercase mb-1">Recomendações VOXX</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{ultimoResumo.observacao_revisao}</p>
                </div>
              )}
            </Section>
          )}

          {/* Base analisada */}
          {ultimoResumo && (
            <Section title="Base Analisada" icon={MessageSquare}>
              <div className="space-y-0">
                <MetricRow
                  label="Período analisado"
                  value={`${moment(ultimoResumo.data).subtract(30, 'days').format('DD/MM')} – ${moment(ultimoResumo.data).format('DD/MM/YY')}`}
                />
                <MetricRow label="Total de mensagens" value={ultimoResumo.total_mensagens ?? '—'} />
                <MetricRow label="Mensagens VOXX" value={ultimoResumo.mensagens_voxx ?? '—'} />
                <MetricRow label="Mensagens Cliente" value={ultimoResumo.mensagens_cliente ?? '—'} />
                <MetricRow label="Desconhecidas" value={ultimoResumo.mensagens_desconhecidas ?? '—'} />
                <MetricRow label="Importadas" value={ultimoResumo.mensagens_importadas ?? '—'} />
                <MetricRow label="Via webhook" value={ultimoResumo.mensagens_webhook ?? '—'} />
                <MetricRow
                  label="Última msg VOXX"
                  value={ultimoResumo.ultima_mensagem_voxx
                    ? moment(ultimoResumo.ultima_mensagem_voxx).tz('America/Sao_Paulo').format('DD/MM HH:mm')
                    : '—'}
                />
                <MetricRow
                  label="Última msg Cliente"
                  value={ultimoResumo.ultima_mensagem_cliente
                    ? moment(ultimoResumo.ultima_mensagem_cliente).tz('America/Sao_Paulo').format('DD/MM HH:mm')
                    : '—'}
                />
              </div>
            </Section>
          )}

          {/* Histórico de análises */}
          <Section title={`Histórico de Análises (${historico.length})`} icon={Clock}>
            {historico.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center py-4">Nenhum histórico encontrado</p>
            ) : (
              <div>
                {historico.map(r => (
                  <HistoricoCard key={r.id} resumo={r} onVer={setResumoVisualizado} />
                ))}
              </div>
            )}
          </Section>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-600">
            {temAnalise ? `Última análise: ${clienteEnriquecido?.ultima_analise}` : 'Sem análise disponível'}
          </p>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-2 h-7 text-xs">
            <Brain className="w-3.5 h-3.5" /> Gerar análise
          </Button>
        </div>
      </div>

      {/* Modal visualizador de resumo */}
      {resumoVisualizado && (
        <ResumoVisualizador resumo={resumoVisualizado} onClose={() => setResumoVisualizado(null)} />
      )}
    </>
  );
}