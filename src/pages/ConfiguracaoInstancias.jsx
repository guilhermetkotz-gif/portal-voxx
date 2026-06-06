import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings2, Wifi, WifiOff, RefreshCw, Loader2, Save, AlertTriangle,
  MessageSquare, Search, X, Clock, CheckCircle2, XCircle, AlertCircle,
  Bug, Link2, Play, Database
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

// ────────────────────────────────────────────────────────────
// Aba: Configuração Z-API
// ────────────────────────────────────────────────────────────
function AbaConfiguracao({ config, setConfig, zapiStatus, loadingStatus, onVerificarStatus, onSalvar, saving }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-green-600" /> Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onVerificarStatus} disabled={loadingStatus} variant="outline" className="gap-2">
            {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Verificar Conexão
          </Button>
          {zapiStatus && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${zapiStatus.connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {zapiStatus.connected ? <Wifi className="w-6 h-6 text-green-600" /> : <WifiOff className="w-6 h-6 text-red-600" />}
                  <div>
                    <p className="font-semibold text-slate-900">{zapiStatus.connected ? 'Instância Conectada' : 'Instância Desconectada'}</p>
                    <p className="text-sm text-slate-600">ID: <code className="font-mono">{zapiStatus.instance_id}</code></p>
                    {zapiStatus.device && (
                      <p className="text-xs text-slate-500 mt-1">
                        {zapiStatus.device.deviceModel || zapiStatus.device.platform}
                        {zapiStatus.device.phoneNumber && ` · ${zapiStatus.device.phoneNumber}`}
                      </p>
                    )}
                  </div>
                </div>
                <Badge className={zapiStatus.connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                  {zapiStatus.connected ? '● Online' : '● Offline'}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-violet-600" /> Credenciais Z-API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Instance ID</Label>
            <Input placeholder="Ex: 3F3C18AB700BE1E9503B6E531F01401A" value={config?.instance_id || ''}
              onChange={(e) => setConfig({ ...config, instance_id: e.target.value })} className="font-mono" />
          </div>
          <div className="grid gap-2">
            <Label>Token da Instância</Label>
            <Input type="password" placeholder="Ex: 1CAB1A4439B9D454B1EF9FA1" value={config?.token_instancia || ''}
              onChange={(e) => setConfig({ ...config, token_instancia: e.target.value })} className="font-mono" />
          </div>
          <div className="grid gap-2">
            <Label>Token Global (Client-Token)</Label>
            <Input type="password" placeholder="Ex: Fc4a077d..." value={config?.token_global || ''}
              onChange={(e) => setConfig({ ...config, token_global: e.target.value })} className="font-mono" />
          </div>
          <div className="grid gap-2">
            <Label>Webhook URL (Recebimento)</Label>
            <Input readOnly value={config?.webhook_url_receber || ''} className="font-mono text-xs" />
            <p className="text-xs text-slate-500">Configure esta URL no painel Z-API para receber mensagens.</p>
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button onClick={onSalvar} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Aba: Webhook Raw
// ────────────────────────────────────────────────────────────
function AbaWebhookRaw() {
  const [busca, setBusca] = useState('');
  const { data: raws = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['webhookRaw'],
    queryFn: () => base44.entities.WhatsappWebhookRaw.list('-received_at', 200),
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });

  const filtrados = raws.filter(r => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return r.phone?.toLowerCase().includes(b) || r.chat_name?.toLowerCase().includes(b) || r.sender_name?.toLowerCase().includes(b) || r.event_type?.toLowerCase().includes(b);
  });

  const statusBadge = (s) => {
    if (s === 'processado') return <Badge className="bg-green-100 text-green-700">✓ Processado</Badge>;
    if (s === 'erro') return <Badge className="bg-red-100 text-red-700">✗ Erro</Badge>;
    if (s === 'ignorado') return <Badge className="bg-slate-100 text-slate-500">— Ignorado</Badge>;
    return <Badge className="bg-amber-100 text-amber-700">⏳ Pendente</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar por grupo, remetente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 w-64" />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-2.5 text-slate-500"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{filtrados.length} registros</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <ScrollArea className="h-[580px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Recebido em</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Phone</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Grupo?</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Participant</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Remetente</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Chat Name</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Tipo Evento</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Erro</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600" /></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nenhum webhook raw encontrado. Os payloads aparecerão aqui assim que chegarem.</td></tr>
              ) : (
                filtrados.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {moment(r.received_at).tz('America/Sao_Paulo').format('DD/MM HH:mm:ss')}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700 max-w-[120px] truncate" title={r.phone}>{r.phone || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.is_group ? <Badge className="bg-blue-100 text-blue-700">Grupo</Badge> : <Badge className="bg-slate-100 text-slate-500">Direto</Badge>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{r.participant_phone || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{r.sender_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate" title={r.chat_name}>{r.chat_name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{r.event_type || '—'}</td>
                    <td className="px-3 py-2">{statusBadge(r.processing_status)}</td>
                    <td className="px-3 py-2 text-red-600 max-w-[160px] truncate" title={r.processing_error}>{r.processing_error || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Aba: Mensagens Processadas
// ────────────────────────────────────────────────────────────
function AbaMensagens() {
  const [busca, setBusca] = useState('');
  const { data: msgs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['whatsappMensagensInst'],
    queryFn: () => base44.entities.WhatsappMensagem.list('-received_at', 200),
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });

  const filtrados = msgs.filter(m => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return m.cliente_nome?.toLowerCase().includes(b) || m.grupo_nome?.toLowerCase().includes(b) || m.remetente_nome?.toLowerCase().includes(b) || m.mensagem?.toLowerCase().includes(b);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
          <Input placeholder="Buscar mensagem..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 w-64" />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-2.5 text-slate-500"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{filtrados.length} mensagens</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <ScrollArea className="h-[580px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Recebido em</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Cliente</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Grupo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Remetente</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Origem</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-violet-600" /></td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nenhuma mensagem processada ainda.</td></tr>
              ) : (
                filtrados.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                      {moment(m.received_at).tz('America/Sao_Paulo').format('DD/MM HH:mm:ss')}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {m.cliente_nome || <span className="text-amber-600 font-normal">Sem vínculo</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate" title={m.grupo_nome}>{m.grupo_nome || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-slate-700">{m.remetente_nome || '—'}</span>
                      {m.remetente_tipo === 'voxx' && <Badge className="ml-1 bg-violet-100 text-violet-700">VOXX</Badge>}
                      {m.remetente_tipo === 'cliente' && <Badge className="ml-1 bg-blue-100 text-blue-700">Cliente</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className="bg-slate-100 text-slate-600">{m.tipo_mensagem || 'texto'}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={m.origem === 'recebida' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                        {m.origem || '—'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600 max-w-[220px] truncate" title={m.mensagem}>{m.mensagem}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Aba: Grupos Não Vinculados
// ────────────────────────────────────────────────────────────
function AbaGruposNaoVinculados() {
  const { data: grupos = [], isLoading, refetch } = useQuery({
    queryKey: ['gruposNaoVinculados'],
    queryFn: () => base44.entities.WhatsappGrupo.filter({ status_vinculo: 'nao_vinculado' }, '-ultima_atividade', 100),
    staleTime: 30 * 1000,
  });

  // Grupos de WhatsappMensagem sem cliente
  const { data: msgsSemCliente = [] } = useQuery({
    queryKey: ['msgsSemCliente'],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ cliente_id: null }, '-received_at', 50),
    staleTime: 30 * 1000,
  });

  const gruposDeMsg = {};
  msgsSemCliente.forEach(m => {
    if (m.grupo_id && !gruposDeMsg[m.grupo_id]) {
      gruposDeMsg[m.grupo_id] = { grupo_id: m.grupo_id, grupo_nome: m.grupo_nome, ultima: m.received_at, msgs: 0 };
    }
    if (m.grupo_id) gruposDeMsg[m.grupo_id].msgs++;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Grupos que receberam mensagens mas ainda não estão vinculados a um cliente.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {Object.values(gruposDeMsg).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" /> Grupos com mensagens sem vínculo</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Grupo ID</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Nome</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Msgs recebidas</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(gruposDeMsg).map(g => (
                  <tr key={g.grupo_id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{g.grupo_id}</td>
                    <td className="px-3 py-2 text-slate-700">{g.grupo_nome || '—'}</td>
                    <td className="px-3 py-2"><Badge className="bg-amber-100 text-amber-700">{g.msgs}</Badge></td>
                    <td className="px-3 py-2 text-slate-500">{moment(g.ultima).tz('America/Sao_Paulo').format('DD/MM HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-slate-500" /> Grupos não vinculados ({grupos.length})</CardTitle></CardHeader>
        <ScrollArea className="h-[400px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Grupo ID</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Nome</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Última mensagem</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Origem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : grupos.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nenhum grupo não vinculado encontrado.</td></tr>
              ) : (
                grupos.map(g => (
                  <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-600 text-[11px]">{g.grupo_id}</td>
                    <td className="px-3 py-2 text-slate-700">{g.nome_grupo}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {g.ultima_atividade ? moment(g.ultima_atividade).tz('America/Sao_Paulo').format('DD/MM HH:mm') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className="bg-slate-100 text-slate-500">{g.origem || 'manual'}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Aba: Teste Webhook Manual
// ────────────────────────────────────────────────────────────
function AbaTeste() {
  const queryClient = useQueryClient();
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(JSON.stringify({
    isGroup: true,
    phone: "120363000000000000-group",
    participantPhone: "5544999999999",
    senderName: "Teste Participante",
    chatName: "Grupo Teste Webhook",
    text: { message: "Mensagem de teste manual" },
    messageId: `teste-${Date.now()}`,
    type: "ReceivedCallback",
    fromMe: false,
    momment: Math.floor(Date.now() / 1000)
  }, null, 2));

  const handleTestar = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const body = JSON.parse(payload);
      const res = await base44.functions.invoke('webhookZapiReceber', body);
      setResultado({ success: true, data: res.data });
      toast.success('Webhook testado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['webhookRaw'] });
      queryClient.invalidateQueries({ queryKey: ['whatsappMensagensInst'] });
      queryClient.invalidateQueries({ queryKey: ['gruposNaoVinculados'] });
    } catch (e) {
      setResultado({ success: false, error: e.message });
      toast.error('Erro no teste: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPayload = () => {
    setPayload(JSON.stringify({
      isGroup: true,
      phone: "120363000000000000-group",
      participantPhone: "5544999999999",
      senderName: "Teste Participante",
      chatName: "Grupo Teste Webhook",
      text: { message: "Mensagem de teste manual " + new Date().toLocaleTimeString('pt-BR') },
      messageId: `teste-${Date.now()}`,
      type: "ReceivedCallback",
      fromMe: false,
      momment: Math.floor(Date.now() / 1000)
    }, null, 2));
    setResultado(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-violet-600" /> Testar Webhook Manual
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Simula um payload Z-API para validar o fluxo completo: Raw → Mensagem → Grupo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Payload JSON</Label>
            <textarea
              className="w-full h-72 font-mono text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleTestar} disabled={loading} className="gap-2 bg-violet-600 hover:bg-violet-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Executar Teste
            </Button>
            <Button variant="outline" onClick={resetPayload} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Resetar Payload
            </Button>
          </div>

          {resultado && (
            <div className={`p-4 rounded-lg border-2 ${resultado.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {resultado.success
                  ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-red-600" />}
                <span className={`font-semibold ${resultado.success ? 'text-green-800' : 'text-red-800'}`}>
                  {resultado.success ? 'Teste bem-sucedido' : 'Erro no teste'}
                </span>
              </div>
              <pre className="text-xs font-mono bg-white/70 rounded p-2 overflow-auto max-h-40">
                {JSON.stringify(resultado.success ? resultado.data : { error: resultado.error }, null, 2)}
              </pre>
              {resultado.success && (
                <div className="mt-3 text-xs text-green-700 space-y-1">
                  <p>✓ Verifique a aba <strong>Webhook Raw</strong> para ver o registro bruto</p>
                  <p>✓ Verifique a aba <strong>Mensagens Processadas</strong> para ver a mensagem</p>
                  <p>✓ Se grupo não vinculado, verifique <strong>Grupos Não Vinculados</strong></p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────
export default function ConfiguracaoInstancias({ user }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(null);
  const [zapiStatus, setZapiStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['configuracaoZapi'],
    queryFn: () => base44.entities.ConfiguracaoZapi.list('-created_date', 1),
    staleTime: 60 * 1000
  });

  useEffect(() => {
    if (configs.length > 0) {
      setConfig(configs[0]);
    } else {
      const webhookUrl = `${window.location.origin}/functions/webhookZapiReceber`;
      setConfig({ instance_id: '', token_instancia: '', token_global: '', webhook_url_receber: webhookUrl });
    }
  }, [configs]);

  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      if (config?.id) await base44.entities.ConfiguracaoZapi.update(config.id, data);
      else await base44.entities.ConfiguracaoZapi.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['configuracaoZapi'] }); toast.success('Configurações salvas!'); },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message)
  });

  const handleVerificarStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await base44.functions.invoke('zapiStatus', {});
      setZapiStatus(res.data);
    } catch (e) {
      toast.error('Erro ao verificar: ' + e.message);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSalvar = () => {
    if (!config?.instance_id || !config?.token_instancia) {
      toast.error('Preencha pelo menos Instance ID e Token da Instância');
      return;
    }
    saveConfigMutation.mutate(config);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <div className="p-2 bg-violet-100 rounded-xl"><Settings2 className="w-6 h-6 text-violet-600" /></div>
          Configuração de Instâncias Z-API
        </h1>
        <p className="text-slate-500 mt-1">Gerencie credenciais, monitore webhooks e diagnostique o fluxo de mensagens</p>
      </div>

      <Tabs defaultValue="configuracao" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="configuracao" className="gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="raw" className="gap-1.5 text-xs">
            <Database className="w-3.5 h-3.5" /> Webhook Raw
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-1.5 text-xs">
            <MessageSquare className="w-3.5 h-3.5" /> Mensagens
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1.5 text-xs">
            <Link2 className="w-3.5 h-3.5" /> Não Vinculados
          </TabsTrigger>
          <TabsTrigger value="teste" className="gap-1.5 text-xs">
            <Bug className="w-3.5 h-3.5" /> Testar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuracao" className="mt-6">
          <AbaConfiguracao
            config={config}
            setConfig={setConfig}
            zapiStatus={zapiStatus}
            loadingStatus={loadingStatus}
            onVerificarStatus={handleVerificarStatus}
            onSalvar={handleSalvar}
            saving={saveConfigMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="raw" className="mt-6">
          <AbaWebhookRaw />
        </TabsContent>

        <TabsContent value="mensagens" className="mt-6">
          <AbaMensagens />
        </TabsContent>

        <TabsContent value="grupos" className="mt-6">
          <AbaGruposNaoVinculados />
        </TabsContent>

        <TabsContent value="teste" className="mt-6">
          <AbaTeste />
        </TabsContent>
      </Tabs>
    </div>
  );
}