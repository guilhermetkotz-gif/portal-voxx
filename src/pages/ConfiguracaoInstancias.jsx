import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings2, Wifi, WifiOff, RefreshCw, Loader2, Save, AlertTriangle,
  MessageSquare, Search, X, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

export default function ConfiguracaoInstancias({ user }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(null);
  const [zapiStatus, setZapiStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [registroAtivo, setRegistroAtivo] = useState(true);
  const [buscaLog, setBuscaLog] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Carregar configurações
  const { data: configs = [] } = useQuery({
    queryKey: ['configuracaoZapi'],
    queryFn: () => base44.entities.ConfiguracaoZapi.list('-created_date', 1),
    staleTime: 60 * 1000
  });

  // Carregar logs de recebimento
  const { data: logs = [], isLoading: loadingLogsQuery } = useQuery({
    queryKey: ['webhookLogs'],
    queryFn: () => base44.entities.WhatsappEnvioLog.filter({ origem: 'recebida' }, '-enviado_em', 200),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000
  });

  useEffect(() => {
    if (configs && configs.length > 0) {
      setConfig(configs[0]);
    } else {
      // Criar config padrão com webhook URL automático
      const webhookUrl = `${window.location.origin}/functions/webhookZapiReceber`;
      setConfig({
        instance_id: '',
        token_instancia: '',
        token_global: '',
        webhook_url_receber: webhookUrl
      });
    }
  }, [configs]);

  // Salvar configurações
  const saveConfigMutation = useMutation({
    mutationFn: async (data) => {
      if (config && config.id) {
        await base44.entities.ConfiguracaoZapi.update(config.id, data);
      } else {
        await base44.entities.ConfiguracaoZapi.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracaoZapi'] });
      toast.success('Configurações salvas!');
    },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message)
  });

  // Toggle registro
  const toggleRegistroMutation = useMutation({
    mutationFn: async (ativo) => {
      // Aqui você poderia salvar uma flag global ou usar uma secret
      setRegistroAtivo(ativo);
    },
    onSuccess: (_, variables) => {
      toast.success(variables ? 'Registro de mensagens ativado' : 'Registro de mensagens desativado');
    }
  });

  // Verificar status Z-API
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

  // Filtrar logs
  const logsFiltrados = logs.filter(log => {
    if (!buscaLog) return true;
    const busca = buscaLog.toLowerCase();
    return (
      log.cliente_nome?.toLowerCase().includes(busca) ||
      log.grupo_nome?.toLowerCase().includes(busca) ||
      log.remetente_nome?.toLowerCase().includes(busca) ||
      log.mensagem?.toLowerCase().includes(busca)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <div className="p-2 bg-violet-100 rounded-xl"><Settings2 className="w-6 h-6 text-violet-600" /></div>
          Configuração de Instâncias Z-API
        </h1>
        <p className="text-slate-500 mt-1">Gerencie credenciais, webhook e visualize logs de mensagens recebidas</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="configuracao" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configuracao" className="gap-2">
            <Settings2 className="w-4 h-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Logs de Recebimento
          </TabsTrigger>
        </TabsList>

        {/* Tab: Configurações */}
        <TabsContent value="configuracao" className="space-y-6">
          {/* Status da Instância */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-600" /> Status da Conexão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleVerificarStatus} disabled={loadingStatus} variant="outline" className="gap-2">
                {loadingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Verificar Conexão
              </Button>

              {zapiStatus && (
                <div className={`mt-4 p-4 rounded-lg border-2 ${
                  zapiStatus.connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {zapiStatus.connected ? (
                        <Wifi className="w-6 h-6 text-green-600" />
                      ) : (
                        <WifiOff className="w-6 h-6 text-red-600" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">
                          {zapiStatus.connected ? 'Instância Conectada' : 'Instância Desconectada'}
                        </p>
                        <p className="text-sm text-slate-600">
                          ID: <code className="font-mono">{zapiStatus.instance_id}</code>
                        </p>
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

          {/* Formulário de Configuração */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-violet-600" /> Credenciais Z-API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="instance_id">Instance ID</Label>
                <Input
                  id="instance_id"
                  placeholder="Ex: 3F3C18AB700BE1E9503B6E531F01401A"
                  value={config?.instance_id || ''}
                  onChange={(e) => setConfig({ ...config, instance_id: e.target.value })}
                  className="font-mono"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token_instancia">Token da Instância</Label>
                <Input
                  id="token_instancia"
                  placeholder="Ex: 1CAB1A4439B9D454B1EF9FA1"
                  value={config?.token_instancia || ''}
                  onChange={(e) => setConfig({ ...config, token_instancia: e.target.value })}
                  className="font-mono"
                  type="password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="token_global">Token Global (Client-Token)</Label>
                <Input
                  id="token_global"
                  placeholder="Ex: Fc4a077d5b0cb4f038ae76606fa7053adS"
                  value={config?.token_global || ''}
                  onChange={(e) => setConfig({ ...config, token_global: e.target.value })}
                  className="font-mono"
                  type="password"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="webhook_url">Webhook URL (Recebimento)</Label>
                <Input
                  id="webhook_url"
                  placeholder="https://..."
                  value={config?.webhook_url_receber || ''}
                  onChange={(e) => setConfig({ ...config, webhook_url_receber: e.target.value })}
                  className="font-mono text-xs"
                  readOnly
                />
                <p className="text-xs text-slate-500">
                  Esta URL deve ser configurada no painel da Z-API para receber mensagens.
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    id="registro-ativo"
                    checked={registroAtivo}
                    onCheckedChange={(v) => toggleRegistroMutation.mutate(v)}
                  />
                  <Label htmlFor="registro-ativo" className="cursor-pointer">
                    Registrar mensagens recebidas
                  </Label>
                </div>
                <Button onClick={handleSalvar} disabled={saveConfigMutation.isPending} className="gap-2">
                  {saveConfigMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configurações
                </Button>
              </div>

              {zapiStatus && !zapiStatus.configurado && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Secrets não configurados</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Configure as variáveis de ambiente em: Dashboard → Code → Functions → Settings
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Logs de Recebimento */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filtros e Stats */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Buscar logs..."
                  value={buscaLog}
                  onChange={(e) => setBuscaLog(e.target.value)}
                  className="pl-8 w-64"
                />
                {buscaLog && (
                  <button
                    onClick={() => setBuscaLog('')}
                    className="absolute right-2.5 text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {logsFiltrados.length} logs
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className={`w-4 h-4 ${loadingLogsQuery ? 'animate-spin' : ''}`} />
                Atualização: 30s
              </span>
            </div>
          </div>

          {/* Lista de Logs */}
          <Card className="overflow-hidden">
            <ScrollArea className="h-[600px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Data/Hora</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Grupo</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Remetente</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Mensagem</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLogsQuery ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-violet-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Carregando logs...</p>
                      </td>
                    </tr>
                  ) : logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                          {buscaLog ? 'Nenhum log encontrado para esta busca.' : 'Nenhuma mensagem recebida ainda.'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          As mensagens do webhook aparecerão aqui automaticamente.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {moment(log.enviado_em).tz('America/Sao_Paulo').format('DD/MM HH:mm:ss')}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {log.cliente_nome || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                          {log.grupo_nome || log.grupo_id || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700">{log.remetente_nome || 'Desconhecido'}</span>
                            <Badge className={log.remetente_tipo === 'voxx' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}>
                              {log.remetente_tipo === 'voxx' ? 'VOXX' : 'Cliente'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs max-w-md truncate">
                          {log.mensagem}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={
                            log.tipo_envio === 'imagem' ? 'bg-green-100 text-green-700' :
                            log.tipo_envio === 'video' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }>
                            {log.tipo_envio}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}