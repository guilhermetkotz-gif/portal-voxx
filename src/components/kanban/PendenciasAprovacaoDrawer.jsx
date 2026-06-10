import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, ExternalLink, Settings, Send } from 'lucide-react';
import ConfigLembretesPanel from '@/components/kanban/ConfigLembretesPanel';
import moment from 'moment-timezone';

const STATUS_NAO_APROVADO = ['em_aprovacao', 'enviado', 'solicitacao_alteracao', 'reenviado'];

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

  const isLoading = loadingEnvios || loadingEntregas;

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
      if (!entrega) return true; // se não achar a entrega, mostra mesmo assim
      return STATUS_NAO_APROVADO.includes(entrega.status_entrega);
    });
  }, [envios, entregasMap]);

  const formatarDataHora = (dataIso) => {
    if (!dataIso) return '—';
    return moment(dataIso).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm');
  };

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
          ) : pendencias.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhuma pendência de aprovação no momento</p>
            </div>
          ) : (
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
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EnvioCard({ envio, entrega }) {
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
          {envio.link_aprovacao && (
            <a
              href={envio.link_aprovacao}
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