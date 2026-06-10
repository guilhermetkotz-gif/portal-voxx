import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, AlertTriangle, Send, MessageSquare, ExternalLink, Settings } from 'lucide-react';
import ConfigLembretesPanel from '@/components/kanban/ConfigLembretesPanel';
import moment from 'moment-timezone';
import { calcularMinutosUteis } from '@/lib/minutosUteis';

const statusConfig = {
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  intervencao_humana: { label: 'Intervenção Humana', color: 'bg-red-100 text-red-700 border-red-200' },
};

const sequenciaLabel = {
  1: '1º Lembrete',
  2: '2º Lembrete',
};

export default function PendenciasAprovacaoDrawer({ open, onClose }) {
  const queryClient = useQueryClient();
  const [showConfig, setShowConfig] = useState(false);

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ['tarefasAcompanhamento'],
    queryFn: () => base44.entities.TarefaAcompanhamento.list('-updated_date', 100),
    enabled: open,
    refetchInterval: open ? 15000 : false,
  });

  const formatarTempoUteis = (dataIso) => {
    if (!dataIso) return '—';
    const mins = calcularMinutosUteis(dataIso, new Date().toISOString());
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const handleMarcarConcluida = async (id) => {
    await base44.entities.TarefaAcompanhamento.update(id, { status: 'concluida' });
    queryClient.invalidateQueries({ queryKey: ['tarefasAcompanhamento'] });
  };

  const handleMarcarIntervencao = async (id) => {
    await base44.entities.TarefaAcompanhamento.update(id, { status: 'intervencao_humana' });
    queryClient.invalidateQueries({ queryKey: ['tarefasAcompanhamento'] });
  };

  const pendentes = tarefas.filter(t => t.status === 'pendente');
  const intervencao = tarefas.filter(t => t.status === 'intervencao_humana');
  const concluidas = tarefas.filter(t => t.status === 'concluida');

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
            Acompanhe os lembretes automáticos de aprovação enviados aos clientes
          </SheetDescription>
        </SheetHeader>

        {showConfig && (
          <ConfigLembretesPanel onClose={() => setShowConfig(false)} />
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : tarefas.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Nenhuma pendência de aprovação no momento</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Aguardando Resposta ({pendentes.length})
                  </h3>
                  <div className="space-y-3">
                    {pendentes.map(t => (
                      <TarefaCard
                        key={t.id}
                        tarefa={t}
                        tempoFormatado={formatarTempoUteis(t.data_ultimo_lembrete)}
                        onConcluir={() => handleMarcarConcluida(t.id)}
                        onIntervencao={() => handleMarcarIntervencao(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Intervenção Humana */}
              {intervencao.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Precisa de Intervenção ({intervencao.length})
                  </h3>
                  <div className="space-y-3">
                    {intervencao.map(t => (
                      <TarefaCard
                        key={t.id}
                        tarefa={t}
                        tempoFormatado={formatarTempoUteis(t.data_ultimo_lembrete)}
                        onConcluir={() => handleMarcarConcluida(t.id)}
                        isIntervencao
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Concluídas */}
              {concluidas.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Resolvidas ({concluidas.length})
                  </h3>
                  <div className="space-y-3 opacity-70">
                    {concluidas.slice(0, 5).map(t => (
                      <TarefaCard
                        key={t.id}
                        tarefa={t}
                        tempoFormatado={formatarTempoUteis(t.data_ultimo_lembrete)}
                        isConcluida
                      />
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

function TarefaCard({ tarefa, tempoFormatado, onConcluir, onIntervencao, isIntervencao = false, isConcluida = false }) {
  const config = statusConfig[tarefa.status] || statusConfig.pendente;

  return (
    <Card className="border-slate-200 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{tarefa.cliente_nome || 'Cliente'}</p>
            <p className="text-sm text-slate-500 truncate mt-0.5">{tarefa.entrega_nome || 'Entrega'}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              {tarefa.sequencia_lembrete > 0 && (
                <Badge variant="outline" className="bg-slate-100 text-slate-600">
                  {sequenciaLabel[tarefa.sequencia_lembrete] || `${tarefa.sequencia_lembrete}º`}
                </Badge>
              )}
              <span className="text-xs text-slate-400">
                Último contato: {tempoFormatado} úteis atrás
              </span>
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

          {!isConcluida && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {!isIntervencao && onIntervencao && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                  onClick={onIntervencao}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Intervir
                </Button>
              )}
              {onConcluir && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 px-2"
                  onClick={onConcluir}
                >
                  Resolver
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}