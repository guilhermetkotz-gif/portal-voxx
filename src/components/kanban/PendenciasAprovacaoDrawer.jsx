import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, ExternalLink, Send, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment-timezone';

const TABS = [
  { key: 'aguardando', label: 'Aguardando cliente', icon: Clock, color: 'text-amber-600' },
  { key: 'alteracao', label: 'Alteração solicitada', icon: AlertTriangle, color: 'text-red-600' },
  { key: 'aprovadas', label: 'Aprovadas pelo cliente', icon: CheckCircle, color: 'text-green-600' },
  { key: 'todas', label: 'Todas', icon: Filter, color: 'text-slate-600' },
];

export default function PendenciasAprovacaoDrawer({ open, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('aguardando');
  const [filtroStatus, setFiltroStatus] = useState('nao_tratados');
  const [filtroCliente, setFiltroCliente] = useState('todos');

  // ── Busca todas as entregas ──
  const { data: entregas = [], isLoading: loadingEntregas } = useQuery({
    queryKey: ['entregasParaPendencias'],
    queryFn: () => base44.entities.EntregaDemanda.list('-updated_date', 500),
    enabled: open,
    refetchInterval: open ? 20000 : false,
  });

  // ── Busca envios WhatsApp (para link de aprovação) ──
  const { data: envios = [], isLoading: loadingEnvios } = useQuery({
    queryKey: ['enviosAprovacaoWhatsApp'],
    queryFn: () => base44.entities.EnvioAprovacaoWhatsApp.filter(
      { status_envio: 'enviado' },
      '-enviado_em',
      300
    ),
    enabled: open,
    refetchInterval: open ? 20000 : false,
  });

  // ── Busca notificações de aprovação (comentários do cliente, quem respondeu) ──
  const { data: notificacoes = [], isLoading: loadingNotifs } = useQuery({
    queryKey: ['notificacoesAprovacao', 'drawer'],
    queryFn: () => base44.entities.NotificacaoAprovacao.list('-created_date', 300),
    enabled: open,
    refetchInterval: open ? 20000 : false,
  });

  const isLoading = loadingEntregas || loadingEnvios || loadingNotifs;

  // ── Mapa entrega_id → envio WhatsApp ──
  const enviosMap = useMemo(() => {
    const map = {};
    envios.forEach(e => { if (!map[e.entrega_id]) map[e.entrega_id] = e; });
    return map;
  }, [envios]);

  // ── Mapa entrega_id → notificação mais recente do cliente ──
  const notificacaoMap = useMemo(() => {
    const map = {};
    notificacoes.forEach(n => {
      if (!map[n.entrega_id] || new Date(n.created_date) > new Date(map[n.entrega_id].created_date)) {
        map[n.entrega_id] = n;
      }
    });
    return map;
  }, [notificacoes]);

  // ── Categoriza as entregas ──
  const categorias = useMemo(() => {
    const aguardando = [];   // status enviado / em_aprovacao / reenviado
    const alteracao = [];    // status solicitacao_alteracao
    const aprovadas = [];    // status aprovado

    entregas.forEach(entrega => {
      const s = entrega.status_entrega;
      if (s === 'enviado' || s === 'em_aprovacao' || s === 'reenviado') {
        aguardando.push(entrega);
      } else if (s === 'solicitacao_alteracao') {
        alteracao.push(entrega);
      } else if (s === 'aprovado') {
        aprovadas.push(entrega);
      }
    });

    return { aguardando, alteracao, aprovadas };
  }, [entregas]);

  // ── Filtra por cliente ──
  const filtrarPorCliente = (lista) => {
    if (filtroCliente === 'todos') return lista;
    return lista.filter(e => e.cliente_id === filtroCliente);
  };

  const aguardandoFiltrado = filtrarPorCliente(categorias.aguardando);
  const alteracaoFiltrada = useMemo(() => {
    let lista = filtrarPorCliente(categorias.alteracao);
    if (filtroStatus === 'nao_tratados') lista = lista.filter(e => e.retorno_cliente_tratado === false || e.retorno_cliente_tratado == null);
    if (filtroStatus === 'tratados') lista = lista.filter(e => e.retorno_cliente_tratado === true);
    return lista;
  }, [categorias.alteracao, filtroCliente, filtroStatus]);
  const aprovadasFiltrada = useMemo(() => {
    let lista = filtrarPorCliente(categorias.aprovadas);
    if (filtroStatus === 'nao_tratados') lista = lista.filter(e => e.retorno_cliente_tratado === false || e.retorno_cliente_tratado == null);
    if (filtroStatus === 'tratados') lista = lista.filter(e => e.retorno_cliente_tratado === true);
    return lista;
  }, [categorias.aprovadas, filtroCliente, filtroStatus]);

  const todas = useMemo(() => {
    const all = [...categorias.alteracao, ...categorias.aprovadas, ...categorias.aguardando];
    // Ordenar: alteração primeiro, depois aprovadas não tratadas, depois aguardando mais antigo
    all.sort((a, b) => {
      const ordemStatus = {
        'solicitacao_alteracao': 0,
        'aprovado': 1,
        'enviado': 2,
        'em_aprovacao': 2,
        'reenviado': 3,
      };
      const ordemA = ordemStatus[a.status_entrega] ?? 9;
      const ordemB = ordemStatus[b.status_entrega] ?? 9;
      if (ordemA !== ordemB) return ordemA - ordemB;
      // Dentro do mesmo status, mais recente primeiro para alteração/aprovadas
      const dateA = new Date(a.updated_date || a.created_date);
      const dateB = new Date(b.updated_date || b.created_date);
      return dateB - dateA;
    });
    return filtrarPorCliente(all);
  }, [categorias, filtroCliente]);

  // ── Lista única de clientes para o filtro ──
  const clientesUnicos = useMemo(() => {
    const map = new Map();
    entregas.forEach(e => {
      if (e.cliente_id && !map.has(e.cliente_id)) {
        map.set(e.cliente_id, { id: e.cliente_id, nome: e.cliente_nome || e.cliente_id });
      }
    });
    return Array.from(map.values());
  }, [entregas]);

  // ── Contadores não tratados ──
  const naoTratadosAlteracao = categorias.alteracao.filter(e => e.retorno_cliente_tratado !== true).length;
  const naoTratadosAprovadas = categorias.aprovadas.filter(e => e.retorno_cliente_tratado !== true).length;
  const totalNaoTratados = naoTratadosAlteracao + naoTratadosAprovadas;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-5 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-violet-600" />
            Pendências de Aprovação
          </SheetTitle>
          <SheetDescription>
            Gerencie retornos de clientes sobre entregas enviadas para aprovação
          </SheetDescription>

          {/* Contadores resumo */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
              Aguardando: {aguardandoFiltrado.length}
            </span>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              Alteração: {alteracaoFiltrada.length}
            </span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              Aprovadas: {aprovadasFiltrada.length}
            </span>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-medium">
              Não tratados: {totalNaoTratados}
            </span>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 shrink-0 grid grid-cols-4 h-9">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const count = tab.key === 'aguardando' ? aguardandoFiltrado.length
                : tab.key === 'alteracao' ? alteracaoFiltrada.length
                : tab.key === 'aprovadas' ? aprovadasFiltrada.length
                : todas.length;
              return (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs gap-1 px-1">
                  <Icon className={`h-3 w-3 ${tab.color}`} />
                  <span className="hidden sm:inline">{tab.label.split(' ')[0]}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Filtros rápidos (não mostrar na aba Aguardando) */}
          {activeTab !== 'aguardando' && (
            <div className="flex items-center gap-2 px-5 mt-2 shrink-0">
              <Filter className="h-3 w-3 text-slate-400" />
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-7 text-xs w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_tratados">Não tratados</SelectItem>
                  <SelectItem value="tratados">Tratados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-7 text-xs w-[150px]">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientesUnicos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conteúdo das abas */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 mt-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <TabsContent value="aguardando" className="mt-0 space-y-3">
                  {aguardandoFiltrado.length === 0 ? (
                    <EmptyState message="Nenhuma entrega aguardando aprovação." />
                  ) : (
                    aguardandoFiltrado.map(entrega => (
                      <AguardandoCard
                        key={entrega.id}
                        entrega={entrega}
                        envio={enviosMap[entrega.id]}
                        onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="alteracao" className="mt-0 space-y-3">
                  {alteracaoFiltrada.length === 0 ? (
                    <EmptyState message="Nenhuma alteração solicitada no momento." />
                  ) : (
                    alteracaoFiltrada.map(entrega => (
                      <AlteracaoCard
                        key={entrega.id}
                        entrega={entrega}
                        notificacao={notificacaoMap[entrega.id]}
                        onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="aprovadas" className="mt-0 space-y-3">
                  {aprovadasFiltrada.length === 0 ? (
                    <EmptyState message="Nenhuma aprovação pendente de ação." />
                  ) : (
                    aprovadasFiltrada.map(entrega => (
                      <AprovadaCard
                        key={entrega.id}
                        entrega={entrega}
                        notificacao={notificacaoMap[entrega.id]}
                        onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="todas" className="mt-0 space-y-3">
                  {todas.length === 0 ? (
                    <EmptyState message="Nenhum registro de aprovação encontrado." />
                  ) : (
                    todas.map(entrega => {
                      const s = entrega.status_entrega;
                      if (s === 'solicitacao_alteracao') {
                        return <AlteracaoCard key={entrega.id} entrega={entrega} notificacao={notificacaoMap[entrega.id]} onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })} />;
                      }
                      if (s === 'aprovado') {
                        return <AprovadaCard key={entrega.id} entrega={entrega} notificacao={notificacaoMap[entrega.id]} onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })} />;
                      }
                      return <AguardandoCard key={entrega.id} entrega={entrega} envio={enviosMap[entrega.id]} onInvalidate={() => queryClient.invalidateQueries({ queryKey: ['entregasParaPendencias'] })} />;
                    })
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ── Empty State ──
function EmptyState({ message }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <Clock className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Card: Aguardando cliente ──
function AguardandoCard({ entrega, envio, onInvalidate }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleEnviarLembrete = async () => {
    if (!envio?.id) return;
    setEnviando(true);
    try {
      await base44.functions.invoke('enviarLembreteManual', { envio_id: envio.id });
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
      onInvalidate?.();
    } catch (e) {
      toast.error('Erro ao enviar lembrete');
    } finally {
      setEnviando(false);
    }
  };

  const linkAprovacao = envio?.link_aprovacao || entrega?.link_publico_aprovacao;
  const dataEnvio = envio?.enviado_em || entrega?.data_envio;

  return (
    <Card className="border-amber-200 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <p className="font-medium text-slate-900 truncate">{entrega.cliente_nome || 'Cliente'}</p>
        <p className="text-sm text-slate-600 truncate mt-0.5">{entrega.nome_entrega || 'Entrega'}</p>
        {entrega.demanda_titulo && (
          <p className="text-xs text-slate-400 truncate mt-0.5">Demanda: {entrega.demanda_titulo}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Em aprovação</Badge>
          {dataEnvio && (
            <span className="text-xs text-slate-500">
              Enviado {moment(dataEnvio).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {linkAprovacao && (
            <a href={linkAprovacao} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700">
              <ExternalLink className="h-3 w-3" /> Abrir link
            </a>
          )}
          {envio?.id && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={handleEnviarLembrete} disabled={enviando || enviado}>
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" />
                : enviado ? <span className="text-green-600">✓ Enviado</span>
                : <><Send className="h-3 w-3" /> Enviar lembrete</>}
            </Button>
          )}
          {entrega.demanda_id && (
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => window.open(`${window.location.origin}/Kanban?demanda=${entrega.demanda_id}`, '_self')}>
              Abrir demanda
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Card: Alteração solicitada ──
function AlteracaoCard({ entrega, notificacao, onInvalidate }) {
  const [marcando, setMarcando] = useState(false);
  const tratado = entrega.retorno_cliente_tratado === true;

  const handleMarcarTratado = async () => {
    setMarcando(true);
    try {
      await base44.entities.EntregaDemanda.update(entrega.id, { retorno_cliente_tratado: true });
      toast.success('Marcado como tratado');
      onInvalidate?.();
    } catch (e) {
      toast.error('Erro ao marcar como tratado');
    } finally {
      setMarcando(false);
    }
  };

  const comentario = notificacao?.comentario_cliente || entrega.observacao_cliente;
  const nomeResponsavel = notificacao?.status_aprovacao === 'solicitacao_alteracao'
    ? (entrega.historico_aprovacoes?.slice(-1)[0]?.nome_responsavel || 'Cliente')
    : 'Cliente';
  const dataResposta = notificacao?.data_resposta_cliente || entrega.data_aprovacao || entrega.updated_date;

  return (
    <Card className={`border-red-300 bg-red-50/30 hover:shadow-sm transition-shadow ${tratado ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{entrega.cliente_nome || 'Cliente'}</p>
            <p className="text-sm text-slate-600 truncate mt-0.5">{entrega.nome_entrega || 'Entrega'}</p>
            {entrega.demanda_titulo && (
              <p className="text-xs text-slate-400 truncate mt-0.5">Demanda: {entrega.demanda_titulo}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-red-100 text-red-700 border-red-200">Alteração solicitada</Badge>
              {tratado && <Badge variant="outline" className="bg-slate-100 text-slate-500">Tratado</Badge>}
              {dataResposta && (
                <span className="text-xs text-slate-500">
                  {moment(dataResposta).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')}
                </span>
              )}
            </div>
            {nomeResponsavel && (
              <p className="text-xs text-slate-500 mt-1">Solicitado por: {nomeResponsavel}</p>
            )}
            {comentario && (
              <div className="mt-2 p-2 bg-white rounded border border-red-200 text-xs text-slate-700 italic">
                "{comentario}"
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {entrega.demanda_id && (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => window.open(`${window.location.origin}/Kanban?demanda=${entrega.demanda_id}`, '_self')}>
                  Abrir demanda
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs border-orange-300 text-orange-700"
                onClick={() => window.open(`${window.location.origin}/Kanban?demanda=${entrega.demanda_id}`, '_self')}>
                Iniciar ajuste
              </Button>
              {!tratado && (
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={handleMarcarTratado} disabled={marcando}>
                  {marcando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Marcar como tratado'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Card: Aprovada pelo cliente ──
function AprovadaCard({ entrega, notificacao, onInvalidate }) {
  const [marcando, setMarcando] = useState(false);
  const tratado = entrega.retorno_cliente_tratado === true;

  const handleMarcarTratado = async () => {
    setMarcando(true);
    try {
      await base44.entities.EntregaDemanda.update(entrega.id, { retorno_cliente_tratado: true });
      toast.success('Marcado como tratado');
      onInvalidate?.();
    } catch (e) {
      toast.error('Erro ao marcar como tratado');
    } finally {
      setMarcando(false);
    }
  };

  const nomeResponsavel = entrega.historico_aprovacoes?.slice(-1)[0]?.nome_responsavel || 'Cliente';
  const dataAprovacao = entrega.data_aprovacao || notificacao?.data_resposta_cliente || entrega.updated_date;

  return (
    <Card className={`border-green-300 bg-green-50/30 hover:shadow-sm transition-shadow ${tratado ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{entrega.cliente_nome || 'Cliente'}</p>
            <p className="text-sm text-slate-600 truncate mt-0.5">{entrega.nome_entrega || 'Entrega'}</p>
            {entrega.demanda_titulo && (
              <p className="text-xs text-slate-400 truncate mt-0.5">Demanda: {entrega.demanda_titulo}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-green-100 text-green-700 border-green-200">Aprovado pelo cliente</Badge>
              {tratado && <Badge variant="outline" className="bg-slate-100 text-slate-500">Tratado</Badge>}
              {dataAprovacao && (
                <span className="text-xs text-slate-500">
                  {moment(dataAprovacao).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')}
                </span>
              )}
            </div>
            {nomeResponsavel && (
              <p className="text-xs text-slate-500 mt-1">Aprovado por: {nomeResponsavel}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {entrega.demanda_id && (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => window.open(`${window.location.origin}/Kanban?demanda=${entrega.demanda_id}`, '_self')}>
                  Abrir demanda
                </Button>
              )}
              {!tratado && (
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={handleMarcarTratado} disabled={marcando}>
                  {marcando ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Marcar como tratado'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}