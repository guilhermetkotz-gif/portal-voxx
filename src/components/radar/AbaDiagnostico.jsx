import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, RefreshCw, CheckCircle2, XCircle, Loader2, AlertCircle, Database, MessageSquare, Link2, Bug } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

const TZ = 'America/Sao_Paulo';

export default function AbaDiagnostico({ rawWebhooks, mensagens, grupos, onRefresh }) {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // ── KPIs das mensagens ────────────────────────────────────────
  const hoje = moment().tz(TZ).startOf('day').toISOString();
  const msgsHoje    = mensagens.filter(m => (m.received_at || '') >= hoje);
  const msgsErro    = mensagens.filter(m => m.status_processamento === 'erro');
  const msgsSemCli  = mensagens.filter(m => !m.cliente_id);
  const tiposCounts = mensagens.reduce((acc, m) => { acc[m.tipo_mensagem || 'texto'] = (acc[m.tipo_mensagem || 'texto'] || 0) + 1; return acc; }, {});

  // ── Grupos não vinculados ─────────────────────────────────────
  const gruposNaoVinc = grupos.filter(g => g.status_vinculo === 'nao_vinculado');

  // ── Webhooks com erro ou não processados ──────────────────────
  const rawErros = rawWebhooks.filter(r => !r.processed || r.processing_status === 'erro');

  // ── Testar fluxo ─────────────────────────────────────────────
  const handleTestar = async () => {
    setTestando(true);
    setResultado(null);
    const msgId = `teste-radar-${Date.now()}`;
    try {
      const res = await base44.functions.invoke('webhookZapiReceber', {
        isGroup: true,
        phone: "120363000000000000-group",
        participantPhone: "5544999999999",
        senderName: "Teste Participante",
        chatName: "Grupo Teste Radar",
        text: { message: "Mensagem de teste do Radar WhatsApp - " + new Date().toLocaleTimeString('pt-BR') },
        messageId: msgId,
        type: "ReceivedCallback",
        fromMe: false,
        momment: Math.floor(Date.now() / 1000),
      });

      const data = res.data;
      setResultado({
        rawOk: !!data.rawId,
        msgOk: data.ok === true && !data.duplicate,
        grupoOk: data.ok === true,
        rawId: data.rawId,
        clienteId: data.clienteId,
        statusProc: data.statusProc,
      });
      toast.success('Teste concluído!');
      onRefresh();
    } catch (e) {
      setResultado({ rawOk: false, msgOk: false, grupoOk: false, erro: e.message });
      toast.error('Erro no teste: ' + e.message);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Botão testar fluxo */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Bug className="w-4 h-4 text-violet-400" /> Testar Fluxo Manual
          </CardTitle>
          <p className="text-slate-400 text-xs mt-1">
            Simula um webhook Z-API de grupo e verifica se Raw, Mensagem e Grupo são criados corretamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleTestar} disabled={testando} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            {testando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Executar Teste
          </Button>

          {resultado && (
            <div className="grid grid-cols-3 gap-3">
              <ResultCard label="Webhook Raw" ok={resultado.rawOk} detail={resultado.rawId ? `ID: ${resultado.rawId.substring(0, 12)}...` : resultado.erro} />
              <ResultCard label="Mensagem Processada" ok={resultado.msgOk} detail={resultado.statusProc} />
              <ResultCard label="Grupo Atualizado" ok={resultado.grupoOk} detail={resultado.clienteId ? `Cliente: ${resultado.clienteId.substring(0, 12)}...` : 'Sem vínculo (normal)'} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs mensagens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={MessageSquare} label="Msgs hoje" value={msgsHoje.length} color="emerald" />
        <StatCard icon={XCircle} label="Com erro" value={msgsErro.length} color={msgsErro.length > 0 ? 'red' : 'slate'} />
        <StatCard icon={AlertCircle} label="Sem cliente" value={msgsSemCli.length} color={msgsSemCli.length > 0 ? 'amber' : 'slate'} />
        <StatCard icon={Link2} label="Grp. não vinc." value={gruposNaoVinc.length} color={gruposNaoVinc.length > 0 ? 'amber' : 'slate'} />
      </div>

      {/* Tipos de mensagem */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Mensagens por tipo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tiposCounts).map(([tipo, count]) => (
              <Badge key={tipo} className="bg-slate-800 border-slate-700 text-slate-300 text-xs">
                {tipo}: <span className="font-bold ml-1">{count}</span>
              </Badge>
            ))}
            {Object.keys(tiposCounts).length === 0 && <p className="text-slate-500 text-sm">Nenhuma mensagem.</p>}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Raw recentes */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" /> Webhook Raw (últimos 50)
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onRefresh} className="text-slate-400 hover:text-white h-7 gap-1">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-72">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-800 sticky top-0 bg-slate-900">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500">Recebido</th>
                  <th className="text-left px-3 py-2 text-slate-500">Phone</th>
                  <th className="text-left px-3 py-2 text-slate-500">Grupo?</th>
                  <th className="text-left px-3 py-2 text-slate-500">Remetente</th>
                  <th className="text-left px-3 py-2 text-slate-500">Chat</th>
                  <th className="text-left px-3 py-2 text-slate-500">Mensagem</th>
                  <th className="text-left px-3 py-2 text-slate-500">Status</th>
                  <th className="text-left px-3 py-2 text-slate-500">Erro</th>
                </tr>
              </thead>
              <tbody>
                {rawWebhooks.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Nenhum webhook recebido ainda.</td></tr>
                ) : rawWebhooks.map(r => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{moment(r.received_at).tz(TZ).format('DD/MM HH:mm:ss')}</td>
                    <td className="px-3 py-2 font-mono text-slate-500 text-[10px] max-w-[100px] truncate" title={r.phone}>{r.phone || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.is_group
                        ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Sim</Badge>
                        : <Badge className="bg-slate-700 text-slate-500 border-slate-600 text-[10px]">Não</Badge>
                      }
                    </td>
                    <td className="px-3 py-2 text-slate-300">{r.sender_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate" title={r.chat_name}>{r.chat_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-300 max-w-[160px] truncate" title={r.text_message}>{r.text_message || '—'}</td>
                    <td className="px-3 py-2">
                      {r.processing_status === 'processado' && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">✓ OK</Badge>}
                      {r.processing_status === 'erro'       && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">✗ Erro</Badge>}
                      {r.processing_status === 'ignorado'   && <Badge className="bg-slate-700 text-slate-500 border-slate-600 text-[10px]">— Ignorado</Badge>}
                      {r.processing_status === 'pendente'   && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">⏳ Pendente</Badge>}
                    </td>
                    <td className="px-3 py-2 text-red-400 max-w-[120px] truncate" title={r.processing_error}>{r.processing_error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Erros de processamento */}
      {rawErros.length > 0 && (
        <Card className="bg-red-950/20 border-red-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Erros de Processamento ({rawErros.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rawErros.slice(0, 10).map(r => (
                <div key={r.id} className="bg-slate-900 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400">{moment(r.received_at).tz(TZ).format('DD/MM HH:mm:ss')}</span>
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">{r.processing_status}</Badge>
                  </div>
                  <p className="text-red-300">{r.processing_error || 'Sem processamento registrado'}</p>
                  <p className="text-slate-500 font-mono mt-1">{r.phone}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grupos não vinculados */}
      {gruposNaoVinc.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Grupos não vinculados ({gruposNaoVinc.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gruposNaoVinc.slice(0, 10).map(g => (
                <div key={g.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-200 font-medium">{g.nome_grupo}</span>
                  <span className="text-slate-500 font-mono">{g.grupo_id}</span>
                  <span className="text-slate-400">{g.ultima_atividade ? moment(g.ultima_atividade).tz(TZ).format('DD/MM HH:mm') : '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultCard({ label, ok, detail }) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-red-950/30 border-red-800/50'}`}>
      <div className="flex items-center gap-2 mb-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
        <span className={`text-xs font-semibold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>{label}</span>
      </div>
      <p className={`text-[11px] font-bold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{ok ? 'OK' : 'Falha'}</p>
      {detail && <p className="text-[10px] text-slate-400 mt-1 truncate">{detail}</p>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    red:     'bg-red-500/10 border-red-500/20 text-red-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    slate:   'bg-slate-800 border-slate-700 text-slate-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.slate}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-[11px] opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}