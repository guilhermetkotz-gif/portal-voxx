import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Star, AlertTriangle, CheckCircle, Lightbulb, Copy, RotateCcw, CheckCheck } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';

const TZ = 'America/Sao_Paulo';

const CLASSIF_CONFIG = {
  excelente: { label: 'Excelente',  color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  boa:       { label: 'Boa',        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  atencao:   { label: 'Atenção',    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  fraca:     { label: 'Fraca',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  critica:   { label: 'Crítica',    color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const CRITERIOS = [
  { key: 'clareza_score',          label: 'Clareza',           desc: 'Facilidade de entendimento' },
  { key: 'tom_score',              label: 'Tom Profissional',  desc: 'Cordialidade e postura consultiva' },
  { key: 'especificidade_score',   label: 'Especificidade',    desc: 'Respostas concretas, não genéricas' },
  { key: 'resolucao_score',        label: 'Resolução',         desc: 'Próximo passo, prazo ou encaminhamento' },
  { key: 'valor_percebido_score',  label: 'Valor Percebido',   desc: 'Demonstra presença e expertise VOXX' },
  { key: 'risco_ruido_score',      label: 'Risco de Ruído',    desc: 'Potencial de gerar interpretação negativa', invertido: true },
  { key: 'padrao_voxx_score',      label: 'Padrão VOXX',       desc: 'Alinhamento ao padrão da agência' },
];

function ScoreBar({ score, invertido }) {
  const pct = (score / 10) * 100;
  let barColor;
  if (invertido) {
    barColor = score <= 3 ? 'bg-emerald-500' : score <= 6 ? 'bg-yellow-500' : 'bg-red-500';
  } else {
    barColor = score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-blue-500' : score >= 4 ? 'bg-yellow-500' : 'bg-red-500';
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right text-slate-300">{score?.toFixed(0) ?? '—'}</span>
    </div>
  );
}

function ScoreCircle({ score }) {
  const cfg = CLASSIF_CONFIG[
    score >= 90 ? 'excelente' : score >= 75 ? 'boa' : score >= 60 ? 'atencao' : score >= 40 ? 'fraca' : 'critica'
  ];
  return (
    <div className={`w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center ${cfg.color}`}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70">pts</span>
    </div>
  );
}

export default function AvaliacaoDetalheDrawer({ avaliacao, onClose, onReavaliar, onResolver }) {
  if (!avaliacao) return null;

  const classif = CLASSIF_CONFIG[avaliacao.classificacao] || CLASSIF_CONFIG.atencao;

  const copiarSugestao = () => {
    navigator.clipboard.writeText(avaliacao.versao_sugerida || avaliacao.sugestao_melhoria || '');
    toast.success('Sugestão copiada!');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-slate-900 border-l border-slate-700 h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-400" />
            <h2 className="text-white font-semibold">Avaliação de Qualidade</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score + Classificação */}
          <div className="flex items-center gap-5 bg-slate-800 rounded-xl p-4 border border-slate-700">
            <ScoreCircle score={avaliacao.score_qualidade ?? 0} />
            <div className="flex-1">
              <Badge className={`text-xs border ${classif.color} mb-2`}>{classif.label}</Badge>
              <p className="text-slate-300 text-sm leading-relaxed">{avaliacao.avaliacao_resumo || '—'}</p>
              {avaliacao.contexto_limitado && (
                <span className="text-[10px] text-slate-500 mt-1 block">⚠️ Contexto limitado — avaliado isoladamente.</span>
              )}
            </div>
          </div>

          {/* Mensagem original */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mensagem Original</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold text-slate-300">{avaliacao.remetente_nome || '—'}</span>
                  <span className="text-[10px] text-slate-500 ml-2">
                    {avaliacao.data_mensagem ? moment(avaliacao.data_mensagem).tz(TZ).format('DD/MM/YY HH:mm') : ''}
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <div>{avaliacao.cliente_nome}</div>
                  <div>{avaliacao.grupo_nome}</div>
                </div>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 rounded-lg px-3 py-2">
                "{avaliacao.mensagem_original}"
              </p>
            </div>
          </div>

          {/* Critérios */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Critérios de Avaliação</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              {CRITERIOS.map(c => (
                <div key={c.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-300 font-medium">{c.label}</span>
                    <span className="text-[10px] text-slate-500">{c.desc}</span>
                  </div>
                  <ScoreBar score={avaliacao[c.key] ?? 0} invertido={c.invertido} />
                </div>
              ))}
            </div>
          </div>

          {/* Pontos positivos */}
          {avaliacao.pontos_positivos?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pontos Positivos</h3>
              <ul className="space-y-1.5">
                {avaliacao.pontos_positivos.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pontos de atenção */}
          {avaliacao.pontos_atencao?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pontos de Atenção</h3>
              <ul className="space-y-1.5">
                {avaliacao.pontos_atencao.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-yellow-300">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risco detectado */}
          {avaliacao.risco_detectado && (
            <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Risco Detectado</h3>
              <p className="text-sm text-red-300">{avaliacao.risco_detectado}</p>
            </div>
          )}

          {/* Sugestão de melhoria */}
          {avaliacao.sugestao_melhoria && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Como Melhorar</h3>
              <p className="text-sm text-slate-300">{avaliacao.sugestao_melhoria}</p>
            </div>
          )}

          {/* Versão sugerida */}
          {avaliacao.versao_sugerida && (
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" /> Versão Sugerida
                </h3>
                <Button size="sm" variant="ghost" onClick={copiarSugestao}
                  className="text-emerald-400 hover:text-white text-[11px] h-6 gap-1">
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
              </div>
              <p className="text-sm text-emerald-200 leading-relaxed italic">"{avaliacao.versao_sugerida}"</p>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-2 pb-4">
            {onReavaliar && (
              <Button variant="outline" size="sm" onClick={onReavaliar}
                className="gap-1.5 border-slate-700 text-slate-300 hover:bg-slate-800">
                <RotateCcw className="w-3.5 h-3.5" /> Reavaliar
              </Button>
            )}
            {onResolver && !avaliacao.resolvido && (
              <Button variant="outline" size="sm" onClick={onResolver}
                className="gap-1.5 border-emerald-700 text-emerald-400 hover:bg-emerald-950/30">
                <CheckCheck className="w-3.5 h-3.5" /> Marcar como Resolvido
              </Button>
            )}
            {avaliacao.resolvido && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <CheckCheck className="w-3 h-3 mr-1" /> Resolvido
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}