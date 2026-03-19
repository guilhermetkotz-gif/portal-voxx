import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FitScoreDisplay } from './FitScoreCalculator';
import { CheckCircle, AlertTriangle, Clock, DollarSign, FileText, Calendar } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PROPOSTA_STATUS = {
  nao_enviada: { label: 'Não enviada', color: 'text-slate-500 bg-slate-100' },
  enviada: { label: 'Enviada', color: 'text-blue-600 bg-blue-100' },
  em_negociacao: { label: 'Em negociação', color: 'text-amber-600 bg-amber-100' },
  aceita: { label: 'Aceita ✓', color: 'text-emerald-600 bg-emerald-100' },
  recusada: { label: 'Recusada', color: 'text-red-600 bg-red-100' },
};

const ETAPA_LABELS = {
  novo_lead: 'Novo Lead', contato_iniciado: 'Contato Iniciado',
  diagnostico_reuniao: 'Diagnóstico/Reunião', qualificado: 'Qualificado',
  proposta_enviada: 'Proposta Enviada', negociacao: 'Negociação',
  fechado_ganho: 'Fechado (Ganho)', fechado_perdido: 'Fechado (Perdido)'
};

export default function LeadVisaoGeral({ lead, tarefas = [], reunioes = [] }) {
  const diasSemInteracao = lead.ultima_interacao
    ? differenceInDays(new Date(), parseISO(lead.ultima_interacao))
    : 999;

  const alertas = [];
  if (diasSemInteracao > 7 && !['fechado_ganho','fechado_perdido'].includes(lead.etapa))
    alertas.push({ tipo: 'danger', msg: `Sem interação há ${diasSemInteracao} dias` });
  if (lead.proposta?.status === 'enviada' && diasSemInteracao > 5)
    alertas.push({ tipo: 'warning', msg: 'Proposta enviada sem retorno há mais de 5 dias' });
  if (!lead.fit_score)
    alertas.push({ tipo: 'info', msg: 'Qualificação Fit Score não preenchida' });

  const tarefasPendentes = tarefas.filter(t => t.status === 'pendente');
  const proximaReuniao = reunioes.find(r => r.status === 'agendada');
  const propostaStatus = PROPOSTA_STATUS[lead.proposta?.status || 'nao_enviada'];

  return (
    <div className="p-5 space-y-5">
      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              a.tipo === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' :
              a.tipo === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Grid de status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 mb-1">Etapa Atual</p>
          <p className="font-semibold text-slate-800 text-sm">{ETAPA_LABELS[lead.etapa]}</p>
        </div>
        <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 mb-1">Fit Score</p>
          {lead.fit_score > 0
            ? <FitScoreDisplay score={lead.fit_score} classificacao={lead.fit_classificacao} size="sm" />
            : <p className="text-sm text-slate-400 italic">Não avaliado</p>
          }
        </div>
        <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 mb-1">Valor Estimado</p>
          <p className="font-semibold text-slate-800 text-sm">
            {lead.valor_estimado > 0 ? `R$ ${lead.valor_estimado?.toLocaleString('pt-BR')}` : '—'}
          </p>
        </div>
        <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 mb-1">Proposta</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${propostaStatus.color}`}>
            {propostaStatus.label}
          </span>
        </div>
      </div>

      {/* Próxima reunião */}
      {proximaReuniao && (
        <div className="flex items-center gap-3 p-3 border border-violet-100 bg-violet-50 rounded-xl">
          <Calendar className="w-5 h-5 text-violet-600 flex-shrink-0" />
          <div>
            <p className="text-xs text-violet-500 font-medium">Próxima Reunião</p>
            <p className="text-sm font-semibold text-violet-900">{proximaReuniao.titulo}</p>
            <p className="text-xs text-violet-600">
              {proximaReuniao.data_hora ? format(parseISO(proximaReuniao.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
            </p>
          </div>
        </div>
      )}

      {/* Resumo do briefing */}
      {lead.briefing?.principais_dores && (
        <div className="p-3 border rounded-xl bg-slate-50">
          <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Briefing — Principais Dores
          </p>
          <p className="text-sm text-slate-700">{lead.briefing.principais_dores}</p>
        </div>
      )}

      {/* Tarefas pendentes */}
      {tarefasPendentes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Tarefas Pendentes ({tarefasPendentes.length})
          </p>
          <div className="space-y-1.5">
            {tarefasPendentes.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                <span className="text-slate-700 flex-1">{t.titulo}</span>
                <span className="text-xs text-slate-400">{t.data_prazo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leitura estratégica */}
      {lead.leitura_estrategica && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-1">🔒 Leitura Estratégica Voxx</p>
          <p className="text-sm text-amber-800">{lead.leitura_estrategica}</p>
        </div>
      )}
    </div>
  );
}