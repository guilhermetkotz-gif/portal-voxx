import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

export default function ExecucaoComercialDashboard({ leads, interacoes = [], reunioes = [] }) {
  // Usa ultima_interacao ou created_date como referência de última atividade
  const diasSemAtividade = (l) => {
    const ref = l.ultima_interacao || l.created_date;
    if (!ref) return 999;
    return Math.floor((Date.now() - new Date(ref)) / (1000 * 60 * 60 * 24));
  };

  // Follow-ups pendentes (sem interação há 3+ dias)
  const followUpsPendentes = leads.filter(l => {
    if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
    return diasSemAtividade(l) >= 3;
  });

  // Follow-ups atrasados (7+ dias)
  const followUpsAtrasados = followUpsPendentes.filter(l => diasSemAtividade(l) >= 7);

  // Leads sem contato (nunca teve interação registrada)
  const semContato = leads.filter(l => !l.ultima_interacao && !['fechado_ganho', 'fechado_perdido'].includes(l.etapa));

  // Leads parados (7+ dias sem atividade)
  const leadsParados = leads.filter(l => {
    if (['fechado_ganho', 'fechado_perdido'].includes(l.etapa)) return false;
    return diasSemAtividade(l) >= 7;
  });

  // Interações realizadas (últimos 7 dias) — já filtradas no pai
  const interacoesUltimos7d = interacoes.length;

  // Reuniões agendadas (futuras)
  const reunioesAgendadas = reunioes.filter(r => r.data_hora && new Date(r.data_hora) >= new Date()).length;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">⚙️ EXECUÇÃO COMERCIAL</h3>
      
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Follow-ups */}
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Follow-ups</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-amber-50 rounded">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-slate-700">Pendentes</span>
              </div>
              <Badge className="bg-amber-100 text-amber-700 text-xs">{followUpsPendentes.length}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-red-50 rounded">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs text-slate-700">Atrasados</span>
              </div>
              <Badge className="bg-red-100 text-red-700 text-xs">{followUpsAtrasados.length}</Badge>
            </div>
          </div>
        </Card>

        {/* Atividade do Time */}
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Atividade do Time</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <span className="text-xs text-slate-700">Interações (7d)</span>
              <Badge className="bg-blue-100 text-blue-700 text-xs">{interacoesUltimos7d}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-indigo-50 rounded">
              <span className="text-xs text-slate-700">Reuniões</span>
              <Badge className="bg-indigo-100 text-indigo-700 text-xs">{reunioesAgendadas}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Leads sem contato e parados */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-700">Leads Sem Contato</p>
            <Badge className="bg-slate-100 text-slate-700">{semContato.length}</Badge>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {semContato.slice(0, 3).map(lead => (
              <p key={lead.id} className="text-xs text-slate-600 truncate">
                • {lead.nome_empresa}
              </p>
            ))}
            {semContato.length > 3 && (
              <p className="text-xs text-slate-500 italic">+ {semContato.length - 3} mais</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-slate-700">Leads Parados</p>
            <Badge className="bg-orange-100 text-orange-700">{leadsParados.length}</Badge>
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {leadsParados.slice(0, 3).map(lead => (
              <p key={lead.id} className="text-xs text-slate-600 truncate">
                • {lead.nome_empresa}
              </p>
            ))}
            {leadsParados.length > 3 && (
              <p className="text-xs text-slate-500 italic">+ {leadsParados.length - 3} mais</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}