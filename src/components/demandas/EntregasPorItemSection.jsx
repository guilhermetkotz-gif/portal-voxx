import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronRight, Package, Plus, ExternalLink, Copy,
  Send, CheckCircle, AlertCircle, RotateCcw, History, Shield,
  Loader2, FileText, Image as ImageIcon, Video, Link as LinkIcon, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';
import EntregaItemModal from './EntregaItemModal';
import ItemEntregaV2Card from './ItemEntregaV2Card';
import { isFeatureEnabled, FEATURES } from '@/lib/featureFlags';

const DEMANDA_PILOTO_V2 = '6a5e51c1f77aa0ea68dd3e42';

const STATUS_APROV_LABELS = {
  nao_enviado: { label: 'Não enviado', cls: 'bg-slate-100 text-slate-600' },
  aguardando: { label: 'Aguardando', cls: 'bg-blue-100 text-blue-700' },
  ajustes_solicitados: { label: 'Ajustes solicitados', cls: 'bg-amber-100 text-amber-700' },
  reenviado: { label: 'Reenviado', cls: 'bg-violet-100 text-violet-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
};

const STATUS_ENTREGA_LABELS = {
  rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  enviado: { label: 'Enviado', cls: 'bg-blue-100 text-blue-700' },
  em_aprovacao: { label: 'Em aprovação', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
  solicitacao_alteracao: { label: 'Alteração solicitada', cls: 'bg-red-100 text-red-700' },
  reenviado: { label: 'Reenviado', cls: 'bg-violet-100 text-violet-700' },
  arquivado: { label: 'Arquivado', cls: 'bg-slate-100 text-slate-500' },
};

function VersaoBadge({ numero }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-medium">
      v{numero}
    </span>
  );
}

function ArquivoIcon({ tipo, url }) {
  const t = (tipo || '').toLowerCase();
  if (t.startsWith('image') || /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url || '')) return <ImageIcon className="w-3 h-3" />;
  if (t.startsWith('video') || /\.(mp4|webm|mov)/i.test(url || '')) return <Video className="w-3 h-3" />;
  return <FileText className="w-3 h-3" />;
}

/** Card de uma entrega/versão ativa de um item */
function EntregaAtivaCard({ entrega, item, demanda, onNovaVersao, onEnviar, onAprovar, onReabrir }) {
  const queryClient = useQueryClient();
  const [showHistorico, setShowHistorico] = useState(false);

  const publicUrl = entrega.link_publico_aprovacao ||
    (entrega.token_publico ? `${window.location.origin}/aprovacao/${entrega.token_publico}` : null);

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    }
  };

  const statusAprov = STATUS_APROV_LABELS[item.status_aprovacao] || STATUS_APROV_LABELS.nao_enviado;
  const statusEntrega = STATUS_ENTREGA_LABELS[entrega.status_entrega] || STATUS_ENTREGA_LABELS.rascunho;

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
      {/* Header da versão */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <VersaoBadge numero={entrega.numero_versao_atual || 1} />
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusEntrega.cls)}>
              {statusEntrega.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate mt-1">{entrega.nome_entrega}</p>
          {entrega.data_envio && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Enviado em {moment(entrega.data_envio).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}
              {entrega.usuario_envio_nome ? ` por ${entrega.usuario_envio_nome}` : ''}
            </p>
          )}
        </div>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0', statusAprov.cls)}>
          {statusAprov.label}
        </span>
      </div>

      {/* Arquivos */}
      {(entrega.arquivos?.length > 0 || entrega.link_externo) && (
        <div className="space-y-1">
          {entrega.link_externo && (
            <a href={entrega.link_externo} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> {entrega.link_externo}
            </a>
          )}
          {entrega.arquivos?.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ArquivoIcon tipo={a.tipo} url={a.url} /> {a.nome || `Arquivo ${i + 1}`}
            </a>
          ))}
        </div>
      )}

      {/* Observação do cliente (se houver) */}
      {entrega.observacao_cliente && entrega.status_entrega === 'solicitacao_alteracao' && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <span className="font-medium">Obs. cliente:</span> {entrega.observacao_cliente}
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-100">
        {entrega.status_entrega === 'rascunho' && (
          <Button size="sm" className="h-7 text-xs gap-1 bg-violet-600 hover:bg-violet-700" onClick={onEnviar} disabled={true}>
            <Send className="w-3 h-3" /> Enviar para Aprovação
          </Button>
        )}
        {entrega.status_entrega !== 'rascunho' && entrega.status_entrega !== 'aprovado' && publicUrl && (
          <>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyLink}>
              <Copy className="w-3 h-3" /> Copiar Link
            </Button>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="w-3 h-3" /> Abrir
                </Button>
              </a>
            )}
          </>
        )}
        {entrega.status_entrega === 'aprovado' && publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <ExternalLink className="w-3 h-3" /> Ver entrega aprovada
            </Button>
          </a>
        )}

        {/* Nova versão — habilitado se ajustes solicitados ou aprovado (não em avaliação pelo cliente) */}
        {['solicitacao_alteracao', 'aprovado'].includes(entrega.status_entrega) && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onNovaVersao}>
            <RotateCcw className="w-3 h-3" /> Nova Versão
          </Button>
        )}

        {/* Aprovar (uso interno VOXX) */}
        {entrega.status_entrega !== 'aprovado' && entrega.status_entrega !== 'rascunho' && (
          <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={onAprovar}>
            <CheckCircle className="w-3 h-3" /> Aprovar
          </Button>
        )}

        {/* Reabrir aprovado */}
        {entrega.status_entrega === 'aprovado' && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700" onClick={onReabrir}>
            <Lock className="w-3 h-3" /> Reabrir
          </Button>
        )}
      </div>

      {/* Histórico de aprovações */}
      {entrega.historico_aprovacoes?.length > 0 && (
        <div>
          <button onClick={() => setShowHistorico(!showHistorico)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
            {showHistorico ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {entrega.historico_aprovacoes.length} registro(s)
          </button>
          {showHistorico && (
            <div className="mt-1 space-y-1">
              {entrega.historico_aprovacoes.map((h, i) => (
                <div key={i} className={cn('p-1.5 rounded text-[10px] border',
                  h.acao === 'aprovar' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                  <div className="flex items-center gap-1">
                    {h.acao === 'aprovar' ? <CheckCircle className="w-2.5 h-2.5 text-green-600" /> : <AlertCircle className="w-2.5 h-2.5 text-red-500" />}
                    <span className="font-medium">{h.nome_responsavel}</span>
                    <span className="text-slate-400">·</span>
                    <span>{moment(h.data).tz('America/Sao_Paulo').format('DD/MM HH:mm')}</span>
                  </div>
                  {h.observacao && <p className="mt-0.5 italic">"{h.observacao}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Bloco recolhível de um item com suas entregas/versões */
export function ItemEntregaBlock({ item, demanda, user, resumoMutations }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'criar' | 'nova_versao' | null

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['entregasItem', item.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('gerenciarEntregaItem', {
        action: 'listar_entregas_item',
        item_id: item.id,
        demanda_id: demanda.id,
      });
      return res.data?.entregas || [];
    },
    enabled: !!item?.id && expanded,
    refetchInterval: false,
  });

  const entregaAtiva = entregas.find(e => e.versao_ativa !== false) || entregas[0];
  // V2 (entidade_versao): versões anteriores vêm no campo versoes_anteriores da entrega agrupadora
  const versoesAnteriores = entregaAtiva?.versoes_anteriores?.length > 0
    ? entregaAtiva.versoes_anteriores
    : entregas.filter(e => e.versao_ativa === false);
  const statusAprov = STATUS_APROV_LABELS[item.status_aprovacao] || STATUS_APROV_LABELS.nao_enviado;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['entregasItem', item.id] });
    queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
  };

  // Enviar para aprovação
  const enviarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gerenciarEntregaItem', {
      action: 'enviar_para_aprovacao',
      entrega_id: entregaAtiva.id,
      demanda_id: demanda.id,
      item_id: item.id,
      idempotency_key: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-enviar`,
    }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Item enviado para aprovação!');
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  // Aprovar item (uso interno)
  const aprovarMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gerenciarEntregaItem', {
      action: 'aprovar_item',
      entrega_id: entregaAtiva.id,
      demanda_id: demanda.id,
      item_id: item.id,
      idempotency_key: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-aprovar`,
    }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Item aprovado!');
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  // Reabrir aprovado
  const reabrirMutation = useMutation({
    mutationFn: () => base44.functions.invoke('gerenciarEntregaItem', {
      action: 'reabrir_aprovado',
      entrega_id: entregaAtiva.id,
      demanda_id: demanda.id,
      item_id: item.id,
      confirmacao: 'confirmo_reabertura',
      idempotency_key: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-reabrir`,
    }),
    onSuccess: () => {
      invalidateAll();
      toast.success('Item reaberto para ajustes.');
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  });

  return (
    <div className={cn('rounded-lg border overflow-hidden transition-all',
      item.status_finalizacao === 'cancelado' ? 'border-red-200 bg-red-50/30 opacity-70'
      : item.status_aprovacao === 'aprovado' ? 'border-green-200 bg-green-50/30'
      : 'border-slate-200')}>
      {/* Header do item (sempre visível) */}
      <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center">
          {(item.ordem ?? 0) + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800 truncate">{item.titulo}</p>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusAprov.cls)}>
              {statusAprov.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap mt-0.5">
            {item.formato && <span>{item.formato}</span>}
            {item.canal && <span>· {item.canal}</span>}
            {entregaAtiva && <span>· v{entregaAtiva.numero_versao_atual}</span>}
            {versoesAnteriores.length > 0 && <span>· {versoesAnteriores.length} versão(ões) anterior(es)</span>}
          </div>
        </div>
        {item.status_finalizacao !== 'cancelado' && !entregaAtiva && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); setModalMode('criar'); }}>
            <Plus className="w-3 h-3" /> Criar entrega
          </Button>
        )}
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : entregaAtiva ? (
            <>
            {entregaAtiva.tem_concorrencia && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Conflito de versões detectado. Execute a reconciliação para resolver.
              </div>
            )}
            <EntregaAtivaCard
              entrega={entregaAtiva}
              item={item}
              demanda={demanda}
              onNovaVersao={() => setModalMode('nova_versao')}
              onEnviar={() => enviarMutation.mutate()}
              onAprovar={() => aprovarMutation.mutate()}
              onReabrir={() => {
                if (window.confirm('Reabrir este item aprovado? Uma nova versão deverá ser criada.')) {
                  reabrirMutation.mutate();
                }
              }}
            />
            </>
          ) : (
            <div className="text-center py-4">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-xs text-slate-400">Nenhuma entrega criada para este item.</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={() => setModalMode('criar')}>
                <Plus className="w-3 h-3" /> Criar primeira entrega
              </Button>
            </div>
          )}

          {/* Versões anteriores (arquivadas) */}
          {versoesAnteriores.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Versões anteriores ({versoesAnteriores.length})
              </p>
              <div className="space-y-1">
                {versoesAnteriores.map((v, idx) => {
                  const vStatus = v.versoes?.find(vv => vv.numero === v.numero_versao_atual)?.status_versao || v.status_canonico || 'arquivada';
                  return (
                    <div key={v.id || v.versao_uid || idx} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-[10px]">
                      <VersaoBadge numero={v.numero_versao_atual} />
                      <span className="text-slate-500">{v.nome_entrega}</span>
                      <span className="text-slate-400">· {vStatus}</span>
                      {v.status_entrega === 'aprovado' && <CheckCircle className="w-3 h-3 text-green-500" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de criar/nova versão */}
      {modalMode && (
        <EntregaItemModal
          mode={modalMode}
          item={item}
          demanda={demanda}
          entregaAtual={entregaAtiva}
          user={user}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            setModalMode(null);
            invalidateAll();
          }}
        />
      )}
    </div>
  );
}

/**
 * Seção de entregas por item para demandas compostas (Fase 2).
 * Substitui a EntregasSection tradicional quando a demanda é composta
 * e a feature flag entregasPorItem está ativa.
 */
export default function EntregasPorItemSection({ demanda, user, itens = [] }) {
  const isPilotoV2 = demanda?.id === DEMANDA_PILOTO_V2
    && demanda?.estrutura_demanda === 'composta'
    && isFeatureEnabled(FEATURES.ENTREGAS_POR_ITEM);

  const itensAtivos = itens.filter(i => i.status_finalizacao !== 'cancelado');
  const aprovados = itensAtivos.filter(i => i.status_aprovacao === 'aprovado').length;
  const reenviadas = itensAtivos.filter(i => i.status_aprovacao === 'reenviado').length;
  const aguardando = itensAtivos.filter(i => i.status_aprovacao === 'aguardando').length;
  const ajustes = itensAtivos.filter(i => i.status_aprovacao === 'ajustes_solicitados').length;
  const naoEnviado = itensAtivos.filter(i => !i.status_aprovacao || i.status_aprovacao === 'nao_enviado').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-semibold">Entregas por item</span>
          {itens.length > 0 && (
            <span className="text-xs text-slate-500">
              {itensAtivos.length} {itensAtivos.length === 1 ? 'entrega' : 'entregas'} · {aprovados} aprovada(s) · {reenviadas} reenviada(s) · {aguardando} aguardando · {ajustes} ajuste(s) · {naoEnviado} não enviada(s)
            </span>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-400">Nenhum item para exibir entregas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itens
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
            .map(item => (
              isPilotoV2 ? (
                <ItemEntregaV2Card
                  key={item.id}
                  item={item}
                  demanda={demanda}
                  user={user}
                  LegacyComponent={ItemEntregaBlock}
                />
              ) : (
                <ItemEntregaBlock
                  key={item.id}
                  item={item}
                  demanda={demanda}
                  user={user}
                />
              )
            ))}
        </div>
      )}
    </div>
  );
}