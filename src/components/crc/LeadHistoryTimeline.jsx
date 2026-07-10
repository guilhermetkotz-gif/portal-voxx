import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Calendar, CalendarCheck, CalendarClock, UserPlus,
  RefreshCw, Clock, AlertCircle, FileText, ArrowRight, History
} from 'lucide-react';
import { format } from 'date-fns';

const origemLabels = {
  whats_sem_origem: 'WhatsApp sem origem',
  facebook_whats: 'Facebook → WhatsApp',
  instagram_whats: 'Instagram → WhatsApp',
  meta_ads_cadastro: 'Meta Ads (cadastro)',
  google_cadastro: 'Google (cadastro)',
  google_ligacao: 'Google (ligação)',
  messenger_direct: 'Messenger / Direct'
};

const canalLabels = {
  whatsapp: 'WhatsApp',
  ligacao: 'Ligação',
  messenger: 'Messenger',
  direct: 'Direct',
  formulario: 'Formulário'
};

const resultadoConfig = {
  sem_resposta: { label: 'Sem Resposta', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: AlertCircle },
  contato_feito: { label: 'Contato Feito', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: Phone },
  retornar: { label: 'Retornar', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: RefreshCw },
  ocupado: { label: 'Ocupado', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: Clock },
  caixa_postal: { label: 'Caixa Postal', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: AlertCircle },
  outro: { label: 'Outro', color: 'bg-slate-100 text-slate-700 border-slate-300', icon: AlertCircle }
};

const canalConfig = {
  whatsapp: { label: 'WhatsApp', icon: Phone, color: 'text-green-600 bg-green-50' },
  ligacao: { label: 'Ligação', icon: Phone, color: 'text-blue-600 bg-blue-50' },
  messenger: { label: 'Messenger', icon: Phone, color: 'text-sky-600 bg-sky-50' },
  direct: { label: 'Direct', icon: Phone, color: 'text-purple-600 bg-purple-50' },
  outro: { label: 'Outro', icon: Phone, color: 'text-slate-600 bg-slate-50' }
};

function formatDateLabel(dateStr) {
  if (!dateStr) return null;
  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm");
  } catch {
    return null;
  }
}

/**
 * Constrói uma linha do tempo unificada e cronológica com todos os eventos do lead:
 * - Data de entrada (data_chegada ou external_created_at)
 * - Tentativas de contato (CrcTentativa)
 * - Data de agendamento
 * - Data de comparecimento
 * - Data de retorno
 * - Criação do registro (created_date)
 * - Última atualização (updated_date)
 */
export default function LeadHistoryTimeline({ lead, tentativas = [] }) {
  const events = useMemo(() => {
    const list = [];

    // 1. Criação do registro no sistema
    if (lead.created_date) {
      list.push({
        type: 'criacao',
        date: lead.created_date,
        title: 'Lead cadastrado no sistema',
        subtitle: lead.fonte_cadastro === 'google_sheet' ? 'Sincronizado via Google Sheets' : 'Cadastro manual',
        icon: UserPlus,
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600'
      });
    }

    // 2. Data de chegada / entrada do lead
    const dataChegada = lead.fonte_cadastro === 'google_sheet' && lead.external_created_at
      ? lead.external_created_at
      : lead.data_chegada;
    if (dataChegada && dataChegada !== lead.created_date) {
      list.push({
        type: 'entrada',
        date: dataChegada,
        title: 'Lead recebido',
        subtitle: origemLabels[lead.origem] || lead.origem,
        icon: ArrowRight,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600'
      });
    }

    // 3. Tentativas de contato
    tentativas.forEach((t) => {
      const cfg = resultadoConfig[t.resultado] || resultadoConfig.outro;
      const canal = canalConfig[t.canal] || canalConfig.outro;
      list.push({
        type: 'tentativa',
        date: t.data_hora,
        title: `Tentativa via ${canal.label}`,
        subtitle: cfg.label,
        nota: t.nota,
        icon: cfg.icon,
        iconBg: cfg.color.split(' ').find(c => c.startsWith('bg-')) || 'bg-slate-100',
        iconColor: cfg.color.split(' ').find(c => c.startsWith('text-')) || 'text-slate-600',
        badge: cfg
      });
    });

    // 4. Data de agendamento
    if (lead.data_agendamento) {
      list.push({
        type: 'agendamento',
        date: lead.data_agendamento,
        title: 'Agendamento realizado',
        subtitle: `Consulta agendada`,
        icon: Calendar,
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600'
      });
    }

    // 5. Data de comparecimento
    if (lead.data_comparecimento) {
      list.push({
        type: 'comparecimento',
        date: lead.data_comparecimento,
        title: 'Compareceu à consulta',
        subtitle: lead.status_agendamento === 'compareceu' ? 'Presença confirmada' : 'Data registrada',
        icon: CalendarCheck,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600'
      });
    }

    // 6. Data de retorno (interesse futuro)
    if (lead.data_retorno) {
      list.push({
        type: 'retorno',
        date: lead.data_retorno,
        title: 'Retorno programado',
        subtitle: 'Lead com interesse futuro',
        icon: CalendarClock,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600'
      });
    }

    // 7. Última atualização do registro
    if (lead.updated_date && lead.updated_date !== lead.created_date) {
      list.push({
        type: 'atualizacao',
        date: lead.updated_date,
        title: 'Registro atualizado',
        subtitle: 'Dados do lead foram modificados',
        icon: RefreshCw,
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-500'
      });
    }

    // Ordenar cronologicamente (mais antigo primeiro)
    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [lead, tentativas]);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-slate-900">Histórico Completo</h3>
        <Badge variant="secondary" className="text-xs ml-auto">{events.length} eventos</Badge>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Nenhum evento registrado</p>
      ) : (
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {events.map((event, idx) => {
              const Icon = event.icon;
              return (
                <div key={idx} className="relative flex gap-3 pl-0">
                  {/* Ícone na linha do tempo */}
                  <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${event.iconBg} flex items-center justify-center ring-4 ring-white`}>
                    <Icon className={`w-4 h-4 ${event.iconColor}`} />
                  </div>

                  {/* Conteúdo do evento */}
                  <div className="flex-1 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.title}</p>
                        {event.subtitle && (
                          <p className="text-xs text-slate-500 mt-0.5">{event.subtitle}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                        {format(new Date(event.date), "dd/MM/yyyy")}
                        <br />
                        <span className="text-slate-400">{format(new Date(event.date), "HH:mm")}</span>
                      </span>
                    </div>

                    {event.badge && (
                      <Badge className={`mt-1.5 text-xs border ${event.badge.color}`}>
                        {event.badge.label}
                      </Badge>
                    )}

                    {event.nota && (
                      <div className="mt-1.5 p-2 bg-slate-50 rounded text-sm text-slate-600 whitespace-pre-wrap">
                        {event.nota}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}