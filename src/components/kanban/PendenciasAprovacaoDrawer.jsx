import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, ExternalLink, Settings, Send, AlertTriangle, Bell } from 'lucide-react';
import ConfigLembretesPanel from '@/components/kanban/ConfigLembretesPanel';
import moment from 'moment-timezone';

// Apenas entregas sem retorno do cliente (aprovação ou solicitação de alteração já respondida sai do drawer)
const STATUS_NAO_APROVADO = ['em_aprovacao', 'enviado', 'reenviado'];

export default function PendenciasAprovacaoDrawer({ open, onClose }) {
  const [showConfig, setShowConfig] = useState(false);

  // Busca todos os envios de WhatsApp com status "enviado"
  const { data: envios = [], isLoading: loadingEnvios } = useQuery({
    queryKey: ['enviosAprovacaoWhatsApp'],
    queryFn: () => base44.entities.EnvioAprovacaoWhatsApp.filter(
      { status_envio: 'enviado' },
      '-enviado_em',
      200
    ),
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });

  // Busca todas as entregas para cruzar status
  const { data: entregas = [], isLoading: loadingEntregas } = useQuery({
    queryKey: ['entregasParaPendencias'],
    queryFn: () => base44.entities.EntregaDemanda.list('-updated_date', 500),
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  // Busca lembretes automáticos (TarefaAcompanhamento)
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ['tarefasAcompanhamento'],
    queryFn: () => base44.entities.TarefaAcompanhamento.list('-updated_date', 200),
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });

  const isLoading = loadingEnvios || loadingEntregas || loadingTarefas;

  // Mapa de entrega_id → entrega
  const entregasMap = useMemo(() => {
    const map = {};
    entregas.forEach(e => { map[e.id] = e; });
    return map;
  }, [entregas]);

  // Filtra: apenas envios cuja entrega vinculada NÃO está aprovada
  const pendencias = useMemo(() => {
    return envios.filter(envio => {
      const entrega = entregasMap[envio.entrega_id];
      if (!entrega) return true;
      return STATUS_NAO_APROVADO.includes(entrega.status_entrega);
    });
  }, [envios, entregasMap]);

  // Agrupa lembretes por status
  const lembretesPendentes = useMemo(() => tarefas.filter(t => t.status === 'pendente'), [tarefas]);
  const lembretesIntervencao = useMemo(() => tarefas.filter(t => t.status === 'intervencao_humana'), [tarefas]);

  const temConteudo = pendencias.length > 0 || lembretesPendentes.length > 0 || lembretesIntervencao.length > 0;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-amber-500" />
            Pendências de Aprovação
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </SheetTitle>
          <SheetDescription>
            Entregas enviadas para aprovação que ainda não foram aprovadas
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {showConfig && (
            <ConfigLembretesPanel onClose={() => setShowConfig(false)} />
          )}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : !temConteudo ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhuma pendência de aprovação no momento</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Envios originais (WhatsApp) */}
              {pendencias.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Aguardando Aprovação ({pendencias.length})
                  </h3>
                  <div className="space-y-3">
                    {pendencias.map(envio => {
                      const entrega = entregasMap[envio.entrega_id];
                      return (
                        <EnvioCard
                          key={envio.id}
                          envio={envio}
                          entrega={entrega}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lembretes automáticos pendentes */}
              {lembretesPendentes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Lembretes Automáticos ({lembretesPendentes.length})
                  </h3>
                  <div className="space-y-3">
                    {lembretesPendentes.map(t => (
                      <LembreteCard key={t.id} tarefa={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* Intervenção humana */}
              {lembretesIntervencao.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Precisa de Intervenção ({lembretesIntervencao.length})
                  </h3>
                  <div className="space-y-3">
                    {lembretesIntervencao.map(t => (
                      <LembreteCard key={t.id} tarefa={t} isIntervencao />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const SEQUENCIA_LABEL = { 1: '1º Lembrete', 2: '2º Lembrete', 3: '3º Lembrete', 4: '4º Lembrete', 5: '5º Lembrete' };

function LembreteCard({ tarefa, isIntervencao = false }) {
  return (
    <Card className={`border-slate-200 hover:shadow-sm transition-shadow ${isIntervencao ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-blue-400'}`}>
      <CardContent className="p-4">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {tarefa.cliente_nome || 'Cliente'}
          </p>
          <p className="text-sm text-slate-500 truncate mt-0.5">
            {tarefa.entrega_nome || 'Entrega'}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className={
              isIntervencao
                ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-blue-100 text-blue-700 border-blue-200'
            }>
              {isIntervencao ? 'Intervenção' : 'Pendente'}
            </Badge>
            {tarefa.sequencia_lembrete > 0 && (
              <Badge variant="outline" className="bg-slate-100 text-slate-600">
                {SEQUENCIA_LABEL[tarefa.sequencia_lembrete] || `${tarefa.sequencia_lembrete}º`}
              </Badge>
            )}
            {tarefa.data_ultimo_lembrete && (
              <span className="text-xs text-slate-500">
                Último lembrete: {moment(tarefa.data_ultimo_lembrete).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')}
              </span>
            )}
          </div>
          {tarefa.link_aprovacao && (
            <a
              href={tarefa.link_aprovacao}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-violet-600 hover:text-violet-700"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir link de aprovação
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EnvioCard({ envio, entrega }) {
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);

  const handleEnviarLembrete = async () => {
    setEnviando(true);
    try {
      await base44.functions.invoke('enviarLembreteManual', { envio_id: envio.id });
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
    } finally {
      setEnviando(false);
    }
  };

  const statusEntrega = entrega?.status_entrega || 'em_aprovacao';
  const statusLabel = {
    em_aprovacao: 'Em Aprovação',
    enviado: 'Enviado',
    solicitacao_alteracao: 'Alteração Solicitada',
    reenviado: 'Reenviado',
  }[statusEntrega] || statusEntrega;

  const statusColor = {
    em_aprovacao: 'bg-amber-100 text-amber-700 border-amber-200',
    enviado: 'bg-blue-100 text-blue-700 border-blue-200',
    solicitacao_alteracao: 'bg-orange-100 text-orange-700 border-orange-200',
    reenviado: 'bg-violet-100 text-violet-700 border-violet-200',
  }[statusEntrega] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <Card className="border-slate-200 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {envio.cliente_nome || 'Cliente'}
          </p>
          <p className="text-sm text-slate-500 truncate mt-0.5">
            {envio.entrega_nome || 'Entrega'}
          </p>
          {envio.demanda_titulo && (
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Demanda: {envio.demanda_titulo}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className={statusColor}>
              {statusLabel}
            </Badge>
            {envio.enviado_em && (
              <span className="text-xs text-slate-500">
                Enviado em {moment(envio.enviado_em).tz('America/Sao_Paulo').format('DD/MM/YYYY [às] HH:mm')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {envio.link_aprovacao && (
              <a
                href={envio.link_aprovacao}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700"
              >
                <ExternalLink className="h-3 w-3" />
                Abrir link
              </a>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={handleEnviarLembrete}
              disabled={enviando || enviado}
            >
              {enviando ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : enviado ? (
                <span className="text-green-600">✓ Enviado</span>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Enviar lembrete
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}