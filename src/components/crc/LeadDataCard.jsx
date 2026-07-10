import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import {
  Phone, Globe, User, Clock, AlertTriangle, Timer,
  Database, Calendar, CalendarCheck, CalendarClock, RefreshCw
} from 'lucide-react';

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

const fonteLabels = {
  manual: 'Manual',
  google_sheet: 'Google Sheets'
};

function DataRow({ icon: Icon, label, value, valueClass }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-500 flex-shrink-0 w-28">{label}</span>
      <span className={`text-sm font-medium ${valueClass || 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

export default function LeadDataCard({ lead }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 text-slate-900">Dados do Lead</h3>
      <div className="divide-y divide-slate-50">
        <DataRow icon={Globe} label="Origem" value={origemLabels[lead.origem] || lead.origem || '-'} />
        <DataRow icon={Phone} label="Canal" value={canalLabels[lead.canal] || lead.canal || '-'} />
        <DataRow icon={Database} label="Fonte" value={fonteLabels[lead.fonte_cadastro] || lead.fonte_cadastro || '-'} />
        {lead.responsavel_crc && (
          <DataRow icon={User} label="Responsável" value={lead.responsavel_crc} />
        )}
        {lead.qtd_tentativas != null && lead.qtd_tentativas > 0 && (
          <DataRow icon={RefreshCw} label="Tentativas" value={`${lead.qtd_tentativas}x`} />
        )}
        {lead.tempo_primeira_resposta_min != null && (
          <DataRow
            icon={Timer}
            label="1ª resposta"
            value={`${lead.tempo_primeira_resposta_min} min`}
          />
        )}
        {lead.sla_atrasado && (
          <DataRow
            icon={AlertTriangle}
            label="SLA"
            value="Atrasado"
            valueClass="text-red-600 font-bold"
          />
        )}
      </div>

      {/* Datas importantes */}
      {(lead.data_chegada || lead.data_agendamento || lead.data_comparecimento || lead.data_retorno || lead.ultima_tentativa_em) && (
        <>
          <div className="border-t border-slate-100 mt-3 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Datas</p>
            <div className="divide-y divide-slate-50">
              {lead.data_chegada && (
                <DataRow icon={Calendar} label="Entrada" value={format(new Date(lead.data_chegada), "dd/MM/yyyy 'às' HH:mm")} />
              )}
              {lead.external_created_at && lead.external_created_at !== lead.data_chegada && (
                <DataRow icon={Database} label="Origem ext." value={format(new Date(lead.external_created_at), "dd/MM/yyyy 'às' HH:mm")} />
              )}
              {lead.ultima_tentativa_em && (
                <DataRow icon={Phone} label="Última tent." value={format(new Date(lead.ultima_tentativa_em), "dd/MM/yyyy 'às' HH:mm")} />
              )}
              {lead.data_agendamento && (
                <DataRow icon={Calendar} label="Agendamento" value={format(new Date(lead.data_agendamento), "dd/MM/yyyy 'às' HH:mm")} />
              )}
              {lead.data_comparecimento && (
                <DataRow icon={CalendarCheck} label="Comparecimento" value={format(new Date(lead.data_comparecimento), "dd/MM/yyyy 'às' HH:mm")} />
              )}
              {lead.data_retorno && (
                <DataRow icon={CalendarClock} label="Retorno" value={format(new Date(lead.data_retorno), "dd/MM/yyyy")} />
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}