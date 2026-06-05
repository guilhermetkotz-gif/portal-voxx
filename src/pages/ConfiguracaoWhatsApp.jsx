import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Smartphone, CheckCircle2, XCircle, Loader2, Plus, Link, Unlink,
  RefreshCw, Trash2, AlertTriangle, Wifi, WifiOff, Users, MessageCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';
import 'moment-timezone';

function StatusCard({ status, loading, onVerificar }) {
  if (loading) return (
    <Card className="p-6 flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
      <span className="text-sm text-slate-600">Verificando conexão...</span>
    </Card>
  );

  if (!status) return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg"><Smartphone className="w-5 h-5 text-slate-500" /></div>
          <div>
            <p className="font-semibold text-slate-800">Instância Z-API</p>
            <p className="text-sm text-slate-500">Clique em Verificar Conexão para checar o status</p>
          </div>
        </div>
        <Button onClick={onVerificar} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Verificar Conexão
        </Button>
      </div>
    </Card>
  );

  if (!status.configurado) return (
    <Card className="p-6 border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-900">Secrets não configurados</p>
          <p className="text-sm text-amber-700 mt-1">{status.mensagem}</p>
          <p className="text-xs text-amber-600 mt-2">Acesse: Dashboard → Code → Functions → Settings</p>
        </div>
      </div>
    </Card>
  );

  const connected = status.connected && status.smartphoneConnected;

  return (
    <Card className={`p-6 border-2 ${connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${connected ? 'bg-green-100' : 'bg-red-100'}`}>
            {connected ? <Wifi className="w-6 h-6 text-green-600" /> : <WifiOff className="w-6 h-6 text-red-600" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">Z-API</p>
              <Badge className={connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {connected ? '● Conectado' : '● Desconectado'}
              </Badge>
            </div>
            <div className="flex gap-4 mt-1 text-xs text-slate-500">
              <span>Instância: <strong className="font-mono">{status.instance_id}</strong></span>
              <span>WhatsApp App: {status.smartphoneConnected ? '✅ Conectado' : '❌ Desconectado'}</span>
            </div>
            {status.device && (
              <p className="text-xs text-slate-500 mt-0.5">
                Dispositivo: {status.device.deviceModel || status.device.platform || '—'}
                {status.device.phoneNumber && ` · ${status.device.phoneNumber}`}
              </p>
            )}
            {status.error && <p className="text-xs text-red-600 mt-1">{status.error}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            <Clock className="w-3 h-3 inline mr-1" />
            {moment(status.verificado_em).tz('America/Sao_Paulo').format('HH:mm:ss')}
          </span>
          <Button onClick={onVerificar} variant="outline" size="sm" className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ConfiguracaoWhatsApp({ user }) {
  const queryClient = useQueryClient();
  const [zapiStatus, setZapiStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showAddGrupo, setShowAddGrupo] = useState(false);
  const [novoGrupo, setNovoGrupo] = useState({ grupo_id: '', nome_grupo: '' });
  const [vinculandoId, setVinculandoId] = useState(null);
  const [clienteSelecionado, setClienteSelecionado] = useState('');

  const { data: grupos = [], isLoading: loadingGrupos } = useQuery({
    queryKey: ['whatsappGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-created_date', 200),
    staleTime: 30 * 1000
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesAtivosWA'],
    queryFn: () => base44.entities.Cliente.filter({ status: 'ativo' }, '-nome', 300),
    staleTime: 60 * 1000
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['whatsappEnvioLogs'],
    queryFn: () => base44.entities.WhatsappEnvioLog.list('-enviado_em', 100),
    staleTime: 30 * 1000
  });

  const handleVerificar = async () => {
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

  const addGrupoMutation = useMutation({
    mutationFn: () => base44.entities.WhatsappGrupo.create({
      ...novoGrupo,
      status_vinculo: 'nao_vinculado',
      origem: 'manual'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsappGrupos'] });
      setNovoGrupo({ grupo_id: '', nome_grupo: '' });
      setShowAddGrupo(false);
      toast.success('Grupo adicionado!');
    }
  });

  const vincularMutation = useMutation({
    mutationFn: async ({ grupo, clienteId }) => {
      const cliente = clientes.find(c => c.id === clienteId);
      if (!cliente) throw new Error('Cliente não encontrado');
      // Check if group is already linked to another client
      const jaVinculado = grupos.find(g => g.id !== grupo.id && g.cliente_id === clienteId);
      if (jaVinculado) throw new Error(`Cliente já está vinculado ao grupo "${jaVinculado.nome_grupo}"`);

      await base44.entities.WhatsappGrupo.update(grupo.id, {
        cliente_id: clienteId,
        cliente_nome: cliente.nome,
        status_vinculo: 'vinculado'
      });
      await base44.entities.Cliente.update(clienteId, {
        whatsapp_grupo_id: grupo.grupo_id,
        whatsapp_grupo_nome: grupo.nome_grupo,
        whatsapp_envio_ativo: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsappGrupos'] });
      queryClient.invalidateQueries({ queryKey: ['clientesAtivosWA'] });
      setVinculandoId(null);
      setClienteSelecionado('');
      toast.success('Grupo vinculado ao cliente com sucesso!');
    },
    onError: (e) => toast.error(e.message)
  });

  const desvinculatMutation = useMutation({
    mutationFn: async (grupo) => {
      await base44.entities.WhatsappGrupo.update(grupo.id, {
        cliente_id: null,
        cliente_nome: null,
        status_vinculo: 'nao_vinculado'
      });
      if (grupo.cliente_id) {
        await base44.entities.Cliente.update(grupo.cliente_id, {
          whatsapp_grupo_id: null,
          whatsapp_grupo_nome: null,
          whatsapp_envio_ativo: false
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsappGrupos'] });
      queryClient.invalidateQueries({ queryKey: ['clientesAtivosWA'] });
      toast.success('Vínculo removido.');
    }
  });

  const deleteGrupoMutation = useMutation({
    mutationFn: (id) => base44.entities.WhatsappGrupo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsappGrupos'] });
      toast.success('Grupo removido.');
    }
  });

  const clientesSemGrupo = clientes.filter(c => c.whatsapp_envio_ativo && !c.whatsapp_grupo_id);
  const gruposVinculados = grupos.filter(g => g.status_vinculo === 'vinculado').length;

  const statusVinculoBadge = (sv) => {
    const map = {
      vinculado: 'bg-green-100 text-green-700',
      nao_vinculado: 'bg-slate-100 text-slate-500',
      possivel_correspondencia: 'bg-amber-100 text-amber-700',
      inativo: 'bg-red-100 text-red-500'
    };
    const labels = {
      vinculado: 'Vinculado', nao_vinculado: 'Não Vinculado',
      possivel_correspondencia: 'Possível Match', inativo: 'Inativo'
    };
    return <Badge className={map[sv] || map.nao_vinculado}>{labels[sv] || sv}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <div className="p-2 bg-green-100 rounded-xl"><Smartphone className="w-6 h-6 text-green-600" /></div>
          WhatsApp Clientes
        </h1>
        <p className="text-slate-500 mt-1">Configure a instância Z-API, gerencie grupos e vincule-os aos clientes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Grupos cadastrados</p>
          <p className="text-2xl font-bold text-slate-900">{grupos.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Grupos vinculados</p>
          <p className="text-2xl font-bold text-green-700">{gruposVinculados}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Clientes sem grupo</p>
          <p className="text-2xl font-bold text-amber-600">{clientesSemGrupo.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Envios registrados</p>
          <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
        </Card>
      </div>

      {/* Section 1: Z-API Status */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-green-600" /> Status da Instância Z-API
        </h2>
        <StatusCard status={zapiStatus} loading={loadingStatus} onVerificar={handleVerificar} />
      </div>

      {/* Section 2: Grupos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" /> Grupos de WhatsApp
          </h2>
          <Button size="sm" onClick={() => setShowAddGrupo(true)} className="gap-1 bg-violet-600 hover:bg-violet-700">
            <Plus className="w-3.5 h-3.5" /> Adicionar Grupo
          </Button>
        </div>

        {showAddGrupo && (
          <Card className="p-4 mb-3 border-violet-200 bg-violet-50">
            <p className="text-sm font-medium text-violet-900 mb-3">Novo grupo (cadastro manual)</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="ID do grupo (ex: 5511999999999-1234567890@g.us)"
                value={novoGrupo.grupo_id}
                onChange={e => setNovoGrupo(p => ({ ...p, grupo_id: e.target.value }))}
                className="flex-1 min-w-48 h-8 text-sm"
              />
              <Input
                placeholder="Nome do grupo"
                value={novoGrupo.nome_grupo}
                onChange={e => setNovoGrupo(p => ({ ...p, nome_grupo: e.target.value }))}
                className="flex-1 min-w-48 h-8 text-sm"
              />
              <Button size="sm" onClick={() => addGrupoMutation.mutate()}
                disabled={!novoGrupo.grupo_id || !novoGrupo.nome_grupo || addGrupoMutation.isPending}>
                {addGrupoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddGrupo(false)}>Cancelar</Button>
            </div>
            <p className="text-xs text-violet-600 mt-2">O ID do grupo é fornecido pela Z-API via webhook ou pode ser copiado do painel Z-API.</p>
          </Card>
        )}

        {loadingGrupos ? (
          <Card className="p-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
          </Card>
        ) : grupos.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Nenhum grupo cadastrado.</p>
            <p className="text-xs text-slate-400 mt-1">Adicione grupos manualmente ou aguarde o webhook da Z-API.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Nome do Grupo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">ID do Grupo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente Vinculado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => (
                  <tr key={grupo.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{grupo.nome_grupo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-xs truncate">{grupo.grupo_id}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {vinculandoId === grupo.id ? (
                        <div className="flex items-center gap-2">
                          <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                            <SelectTrigger className="h-7 text-xs w-48">
                              <SelectValue placeholder="Selecionar cliente" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientes.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                            disabled={!clienteSelecionado || vincularMutation.isPending}
                            onClick={() => vincularMutation.mutate({ grupo, clienteId: clienteSelecionado })}>
                            {vincularMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setVinculandoId(null); setClienteSelecionado(''); }}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        grupo.cliente_nome || <span className="text-slate-400 italic">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusVinculoBadge(grupo.status_vinculo)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {grupo.status_vinculo !== 'vinculado' ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => { setVinculandoId(grupo.id); setClienteSelecionado(grupo.cliente_id || ''); }}>
                            <Link className="w-3 h-3" /> Vincular
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-orange-600 border-orange-200"
                            onClick={() => { if (confirm(`Desvincular grupo "${grupo.nome_grupo}" do cliente "${grupo.cliente_nome}"?`)) desvinculatMutation.mutate(grupo); }}>
                            <Unlink className="w-3 h-3" /> Desvincular
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => { if (confirm('Remover este grupo?')) deleteGrupoMutation.mutate(grupo.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Section 3: Clients without group */}
      {clientesSemGrupo.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Clientes com envio ativo sem grupo vinculado ({clientesSemGrupo.length})
          </h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-amber-800">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-800">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-amber-800">Situação</th>
                </tr>
              </thead>
              <tbody>
                {clientesSemGrupo.map(c => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                    <td className="px-4 py-3"><Badge className="bg-green-100 text-green-700">Envio ativo</Badge></td>
                    <td className="px-4 py-3"><span className="text-xs text-amber-600">⚠️ Sem grupo WhatsApp — os resumos não serão enviados</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Section 4: Send Logs */}
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-600" /> Log de Envios
        </h2>
        {logs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-400 text-sm">Nenhum envio registrado ainda.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Grupo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Origem</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {log.enviado_em ? moment(log.enviado_em).tz('America/Sao_Paulo').format('DD/MM HH:mm') : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{log.cliente_nome}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-xs">{log.grupo_nome || log.grupo_id}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-violet-100 text-violet-700 text-xs">{log.origem}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {log.status_envio === 'enviado'
                        ? <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Enviado</Badge>
                        : log.status_envio === 'erro'
                          ? <Badge className="bg-red-100 text-red-700" title={log.erro}><XCircle className="w-3 h-3 mr-1" />Erro</Badge>
                          : <Badge className="bg-slate-100 text-slate-500">{log.status_envio}</Badge>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}