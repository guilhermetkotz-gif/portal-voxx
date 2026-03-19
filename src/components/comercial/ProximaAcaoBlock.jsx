import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Calendar, FileText, Send, Phone, CheckSquare, Zap, AlertTriangle } from 'lucide-react';
import { avaliarTriggers } from '@/lib/comercial/inteligencia';

const ACOES_POR_ETAPA = {
  novo_lead: {
    titulo: 'Faça o primeiro contato',
    descricao: 'Este lead ainda não foi contactado. Inicie uma conversa para entender a necessidade.',
    acaoPrimaria: { label: 'Registrar 1º Contato', icon: Phone, tab: 'interacoes' },
    acoesSecundarias: [{ label: 'Agendar Reunião', icon: Calendar, tab: 'reunioes' }]
  },
  contato_iniciado: {
    titulo: 'Aprofunde o relacionamento',
    descricao: 'Contato feito! Hora de entender melhor o negócio e agendar um diagnóstico.',
    acaoPrimaria: { label: 'Agendar Diagnóstico', icon: Calendar, tab: 'reunioes' },
    acoesSecundarias: [{ label: 'Registrar Interação', icon: MessageSquare, tab: 'interacoes' }]
  },
  diagnostico_reuniao: {
    titulo: 'Preencha o briefing',
    descricao: 'Reunião realizada ou agendada. Registre o que foi levantado no briefing do cliente.',
    acaoPrimaria: { label: 'Preencher Briefing', icon: FileText, tab: 'briefing' },
    acoesSecundarias: [{ label: 'Registrar Ata da Reunião', icon: MessageSquare, tab: 'interacoes' }]
  },
  qualificado: {
    titulo: 'Defina o plano de serviços',
    descricao: 'Lead qualificado! Estruture o plano estratégico e prepare uma proposta de valor.',
    acaoPrimaria: { label: 'Montar Plano de Serviços', icon: Zap, tab: 'plano' },
    acoesSecundarias: [{ label: 'Registrar Follow-up', icon: MessageSquare, tab: 'interacoes' }]
  },
  proposta_enviada: {
    titulo: 'Faça o follow-up da proposta',
    descricao: 'Proposta enviada. Mantenha contato ativo para tirar dúvidas e conduzir ao fechamento.',
    acaoPrimaria: { label: 'Registrar Follow-up', icon: Phone, tab: 'interacoes' },
    acoesSecundarias: [{ label: 'Ajustar Proposta', icon: FileText, tab: 'proposta' }]
  },
  negociacao: {
    titulo: 'Negocie e feche',
    descricao: 'Etapa final! Mantenha o contato próximo e resolva as objeções com velocidade.',
    acaoPrimaria: { label: 'Registrar Negociação', icon: MessageSquare, tab: 'interacoes' },
    acoesSecundarias: [{ label: 'Atualizar Proposta', icon: Send, tab: 'proposta' }]
  },
  fechado_ganho: {
    titulo: 'Lead convertido! 🎉',
    descricao: 'Parabéns! Faça a passagem para o time de CS e crie o plano de ação.',
    acaoPrimaria: { label: 'Registrar Onboarding', icon: CheckSquare, tab: 'interacoes' },
    acoesSecundarias: []
  },
  fechado_perdido: {
    titulo: 'Lead perdido',
    descricao: 'Registre o motivo da perda para análise futura e aprendizado do time.',
    acaoPrimaria: { label: 'Registrar Motivo da Perda', icon: MessageSquare, tab: 'interacoes' },
    acoesSecundarias: []
  }
};

export default function ProximaAcaoBlock({ lead, onTabChange, onRegistrarInteracao, onAgendarReuniao }) {
  const triggers = avaliarTriggers(lead);
  const triggerCritico = triggers.find(t => ['critico', 'alto'].includes(t.nivel));

  // Override da ação se há trigger crítico
  let acao = ACOES_POR_ETAPA[lead.etapa] || ACOES_POR_ETAPA.novo_lead;

  if (triggerCritico?.tipo === 'proposta_sem_resposta') {
    acao = {
      ...acao,
      titulo: '📬 Proposta sem resposta — Aja agora!',
      descricao: triggerCritico.descricao,
      acaoPrimaria: { label: 'Registrar Follow-up Urgente', icon: Phone, tab: 'interacoes' },
    };
  } else if (triggerCritico?.tipo === 'inatividade_critica') {
    acao = {
      ...acao,
      titulo: '🔴 Lead parado — Reative agora!',
      descricao: triggerCritico.descricao,
      acaoPrimaria: { label: 'Registrar Contato', icon: Phone, tab: 'interacoes' },
    };
  } else if (triggerCritico?.tipo === 'travado') {
    acao = {
      ...acao,
      titulo: '🔒 Lead travado — Mude a abordagem',
      descricao: triggerCritico.descricao,
    };
  }

  const handleAcaoPrimaria = () => {
    if (acao.acaoPrimaria.tab === 'interacoes') onRegistrarInteracao();
    else if (acao.acaoPrimaria.tab === 'reunioes') onAgendarReuniao();
    else onTabChange(acao.acaoPrimaria.tab);
  };

  const handleAcaoSecundaria = (a) => {
    if (a.tab === 'interacoes') onRegistrarInteracao();
    else if (a.tab === 'reunioes') onAgendarReuniao();
    else onTabChange(a.tab);
  };

  return (
    <div className="p-4 bg-violet-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-0.5">Próxima Melhor Ação</p>
            <p className="font-semibold text-slate-900 text-sm">{acao.titulo}</p>
            <p className="text-xs text-slate-500 mt-0.5">{acao.descricao}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {acao.acoesSecundarias.map((a, i) => (
            <button
              key={i}
              onClick={() => handleAcaoSecundaria(a)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-violet-200 bg-white text-violet-700 rounded-lg hover:bg-violet-50 transition-colors"
            >
              <a.icon className="w-3.5 h-3.5" />
              {a.label}
            </button>
          ))}
          <Button
            size="sm"
            onClick={handleAcaoPrimaria}
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8"
          >
            <acao.acaoPrimaria.icon className="w-3.5 h-3.5 mr-1.5" />
            {acao.acaoPrimaria.label}
          </Button>
        </div>
      </div>
    </div>
  );
}