import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, User, Clock, MessageSquare, Wifi, WifiOff, AlertTriangle, Zap, Link2 } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

const ALERTA_COLOR = {
  emergencial: 'bg-red-500/20 text-red-400 border-red-500/30',
  critico:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  alerta:      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function tempoFormatado(minutos) {
  if (!minutos) return null;
  if (minutos >= 60) return `${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? `${minutos % 60}m` : ''}`.trim();
  return `${minutos}m`;
}

export default function GrupoDetalheDrawer({ grupo, clientes, onClose }) {
  // Buscar histórico de mensagens do grupo (últimas 30)
  const { data: msgHistorico = [] } = useQuery({
    queryKey: ['radarMsgsGrupo', grupo.grupo_id],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ grupo_id: grupo.grupo_id }, '-received_at', 30),
    enabled: !!grupo.grupo_id,
    staleTime: 15 * 1000,
  });

  const vinculo = grupo.status_vinculo;
  const alertaNivel = grupo.alertaNivel;
  const alertaCfg = alertaNivel ? ALERTA_COLOR[alertaNivel] : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">{grupo.nome_grupo}</h2>
            <p className="text-slate-400 text-sm mt-0.5">{grupo.cliente_nome || 'Sem cliente vinculado'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-6 py-5">
          <div className="space-y-5">
            {/* Info do grupo */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informações</h3>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="ID do Grupo" value={<span className="font-mono text-[11px] text-slate-400">{grupo.grupo_id}</span>} />
                <InfoRow label="Status vínculo" value={
                  <Badge className={`text-[10px] border ${vinculo === 'vinculado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                    {vinculo === 'vinculado' ? <Wifi className="w-3 h-3 inline mr-1" /> : <WifiOff className="w-3 h-3 inline mr-1" />}
                    {vinculo === 'vinculado' ? 'Vinculado' : vinculo === 'nao_vinculado' ? 'Não vinculado' : vinculo}
                  </Badge>
                } />
                <InfoRow label="Última atividade" value={
                  grupo.ultima_atividade
                    ? moment(grupo.ultima_atividade).tz(TZ).format('DD/MM/YYYY HH:mm')
                    : '—'
                } />
                <InfoRow label="Total de mensagens" value={grupo.totalMsgs || 0} />
              </div>
            </div>

            {/* Últimas mensagens */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Últimas mensagens</h3>
              <div className="grid gap-2">
                <MsgCard label="Última geral" msg={grupo.ultimaGeral} />
                <MsgCard label="Última cliente" msg={grupo.ultimaCliente} color="blue" />
                <MsgCard label="Última VOXX" msg={grupo.ultimaVoxx} color="violet" />
              </div>
            </div>

            {/* Tempo sem resposta */}
            {grupo.minutosSemResposta > 0 && (
              <div className={`rounded-xl border p-4 ${alertaCfg || 'bg-slate-800 border-slate-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {alertaNivel === 'emergencial' ? <Zap className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="text-sm font-semibold">Sem resposta VOXX</span>
                </div>
                <p className="text-2xl font-bold">{tempoFormatado(grupo.minutosSemResposta)}</p>
                <p className="text-xs opacity-70 mt-1">Minutos úteis aguardando retorno</p>
              </div>
            )}

            {/* Histórico de mensagens recentes */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico recente (últimas 30)</h3>
              {msgHistorico.length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhuma mensagem registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {msgHistorico.map(m => {
                    const ts = m.received_at || m.timestamp_mensagem;
                    const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada';
                    return (
                      <div key={m.id} className={`rounded-lg px-3 py-2 text-xs ${isVoxx ? 'bg-violet-950/30 border border-violet-800/30' : 'bg-slate-800 border border-slate-700/50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${isVoxx ? 'text-violet-300' : 'text-blue-300'}`}>
                            {m.remetente_nome || (isVoxx ? 'VOXX' : 'Cliente')}
                          </span>
                          <span className="text-slate-500">{moment(ts).tz(TZ).format('DD/MM HH:mm')}</span>
                        </div>
                        <p className="text-slate-300">{m.mensagem}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function MsgCard({ label, msg, color }) {
  const colors = {
    blue:   'border-blue-800/30 bg-blue-950/20',
    violet: 'border-violet-800/30 bg-violet-950/20',
  };
  const cls = colors[color] || 'border-slate-700 bg-slate-800';
  if (!msg) return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <p className="text-slate-500 text-[11px] mb-1">{label}</p>
      <p className="text-slate-600">—</p>
    </div>
  );
  const ts = msg.received_at || msg.timestamp_mensagem;
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-slate-400 text-[11px]">{label}</p>
        <span className="text-slate-500">{moment(ts).tz(TZ).format('DD/MM HH:mm')}</span>
      </div>
      <p className="text-slate-200 font-medium">{msg.remetente_nome || '—'}</p>
      <p className="text-slate-400 mt-0.5 truncate">{msg.mensagem}</p>
    </div>
  );
}