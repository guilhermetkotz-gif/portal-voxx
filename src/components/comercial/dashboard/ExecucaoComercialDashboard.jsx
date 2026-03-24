import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Zap, Thermometer } from 'lucide-react';

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

  // Temperatura do Scanner Voxx
  const tempCount = (temp) => leads.filter(l => l.temperatura_lead === temp).length;
  const comScanner = leads.filter(l => l.score_oportunidade != null);
  const topOportunidades = [...comScanner].sort((a, b) => (b.score_oportunidade || 0) - (a.score_oportunidade || 0)).slice(0, 3);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">⚙️ EXECUÇÃO COMERCIAL</h3>

      {/* Temperatura Scanner */}
      {comScanner.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-violet-500" /> Scanner Voxx — Temperatura</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[['Fervendo','🔥','bg-red-100 text-red-700'],['Quente','🌡️','bg-orange-100 text-orange-700'],['Morno','☕','bg-amber-100 text-amber-700'],['Frio','❄️','bg-blue-100 text-blue-700']].map(([t, e, cls]) => (
              <div key={t} className={`p-2 rounded-lg text-center ${cls}`}>
                <p className="text-base">{e}</p>
                <p className="text-xs font-bold">{tempCount(t)}</p>
                <p className="text-[10px]">{t}</p>
              </div>
            ))}
          </div>
          {topOportunidades.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-400 mb-1.5">Top oportunidades</p>
              {topOportunidades.map(l => (
                <div key={l.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="text-slate-700 truncate">{l.nome_empresa}</span>
                  <Badge className="bg-violet-100 text-violet-700 text-[10px] ml-2">{l.score_oportunidade}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Follow-ups */}
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