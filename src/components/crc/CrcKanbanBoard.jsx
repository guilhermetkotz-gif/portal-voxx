import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Phone, Calendar, AlertTriangle, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  sem_contato: {
    label: 'Sem Contato',
    color: 'bg-slate-100 border-slate-300',
    textColor: 'text-slate-700',
    badgeColor: 'bg-slate-600'
  },
  em_tratativa: {
    label: 'Em Tratativa',
    color: 'bg-blue-100 border-blue-300',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-600'
  },
  agendou: {
    label: 'Agendou',
    color: 'bg-purple-100 border-purple-300',
    textColor: 'text-purple-700',
    badgeColor: 'bg-purple-600'
  },
  compareceu: {
    label: 'Compareceu',
    color: 'bg-green-100 border-green-300',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-600'
  },
  interesse_futuro: {
    label: 'Interesse Futuro',
    color: 'bg-amber-100 border-amber-300',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-600'
  },
  perda: {
    label: 'Perda',
    color: 'bg-red-100 border-red-300',
    textColor: 'text-red-700',
    badgeColor: 'bg-red-600'
  }
};

const origemLabels = {
  whats_sem_origem: 'WhatsApp',
  facebook_whats: 'Facebook → WhatsApp',
  instagram_whats: 'Instagram → WhatsApp',
  meta_ads_cadastro: 'Meta Ads - Cadastro',
  google_cadastro: 'Google - Cadastro',
  google_ligacao: 'Google - Ligação',
  messenger_direct: 'Messenger'
};

const tratamentoLabels = {
  implante: 'Implante',
  protese: 'Prótese',
  protese_protocolo: 'Prótese Protocolo',
  zigomatico: 'Zigomático',
  tratamento_clinico: 'Tratamento Clínico',
  lentes_de_contato: 'Lentes de Contato',
  ortodontia: 'Ortodontia',
  rof: 'ROF',
  nao_informado: 'Não informado'
};

function LeadCard({ lead, index, onClick }) {
  const config = statusConfig[lead.status];
  
  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(lead)}
          className={`mb-2 ${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: config.badgeColor.replace('bg-', '#') }}>
            <div className="space-y-2">
              {/* Nome e Badges */}
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-slate-900 flex-1">
                  {lead.nome || 'Sem nome'}
                </h4>
                {lead.sla_atrasado && (
                  <Badge className="bg-red-600 text-white text-xs h-5">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    SLA
                  </Badge>
                )}
              </div>

              {/* Telefone */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Phone className="w-3 h-3" />
                <span className="font-mono">{lead.telefone}</span>
              </div>

              {/* Tratamento e Origem */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  {tratamentoLabels[lead.tratamento] || lead.tratamento}
                </Badge>
                <Badge variant="outline" className="text-xs bg-slate-50">
                  {origemLabels[lead.origem] || lead.origem}
                </Badge>
              </div>

              {/* Tentativas */}
              {lead.qtd_tentativas > 0 && (
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">{lead.qtd_tentativas}</span> tentativa{lead.qtd_tentativas !== 1 ? 's' : ''}
                </div>
              )}

              {/* Data de chegada */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                {format(new Date(lead.data_chegada), 'dd/MM HH:mm', { locale: ptBR })}
              </div>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

function KanbanColumn({ status, leads, onLeadClick }) {
  const config = statusConfig[status];
  
  return (
    <div className="flex-shrink-0 w-80">
      <div className={`rounded-lg border-2 ${config.color} h-full flex flex-col`}>
        {/* Column Header */}
        <div className="p-3 border-b border-current/20">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold ${config.textColor}`}>
              {config.label}
            </h3>
            <Badge className={`${config.badgeColor} text-white`}>
              {leads.length}
            </Badge>
          </div>
        </div>

        {/* Droppable Area */}
        <Droppable droppableId={status}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-3 flex-1 overflow-y-auto min-h-[200px] ${snapshot.isDraggingOver ? 'bg-white/50' : ''}`}
            >
              {leads.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  onClick={onLeadClick}
                />
              ))}
              {provided.placeholder}
              {leads.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Nenhum lead
                </div>
              )}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
}

export default function CrcKanbanBoard({ leads, onLeadClick, onStatusChange }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId;
    
    if (result.source.droppableId !== newStatus) {
      onStatusChange(leadId, newStatus);
    }
  };

  // Agrupar leads por status
  const leadsByStatus = {
    sem_contato: leads.filter(l => l.status === 'sem_contato'),
    em_tratativa: leads.filter(l => l.status === 'em_tratativa'),
    agendou: leads.filter(l => l.status === 'agendou'),
    compareceu: leads.filter(l => l.status === 'compareceu'),
    interesse_futuro: leads.filter(l => l.status === 'interesse_futuro'),
    perda: leads.filter(l => l.status === 'perda')
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        <KanbanColumn status="sem_contato" leads={leadsByStatus.sem_contato} onLeadClick={onLeadClick} />
        <KanbanColumn status="em_tratativa" leads={leadsByStatus.em_tratativa} onLeadClick={onLeadClick} />
        <KanbanColumn status="agendou" leads={leadsByStatus.agendou} onLeadClick={onLeadClick} />
        <KanbanColumn status="compareceu" leads={leadsByStatus.compareceu} onLeadClick={onLeadClick} />
        <KanbanColumn status="interesse_futuro" leads={leadsByStatus.interesse_futuro} onLeadClick={onLeadClick} />
        <KanbanColumn status="perda" leads={leadsByStatus.perda} onLeadClick={onLeadClick} />
      </div>
    </DragDropContext>
  );
}