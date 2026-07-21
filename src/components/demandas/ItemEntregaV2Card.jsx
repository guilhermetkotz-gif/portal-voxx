import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronRight, Package, Plus, ExternalLink, Copy,
  AlertCircle, Loader2, FileText, Image as ImageIcon, Video, History,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';
import EntregaItemModal from './EntregaItemModal';
import { ItemEntregaBlock } from './EntregasPorItemSection';

const STATUS_APROV_LABELS = {
  nao_enviado: { label: 'Não enviado', cls: 'bg-slate-100 text-slate-600' },
  aguardando: { label: 'Aguardando aprovação', cls: 'bg-blue-100 text-blue-700' },
  ajustes_solicitados: { label: 'Ajustes solicitados', cls: 'bg-amber-100 text-amber-700' },
  reenviado: { label: 'Reenviado ao cliente', cls: 'bg-violet-100 text-violet-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
};

const ERRO_MAP = {
  REENVIADO_JA_ESTA_EM_AVALIACAO: 'Esta versão já foi reenviada e está aguardando a avaliação do cliente.',
  VERSAO_SUBSTITUIDA: 'Este link pertence a uma versão anterior que já foi substituída.',
  STATUS_NAO_PERMITE_ENVIO: 'Esta entrega não pode ser enviada no estado atual.',
  MODELO_VERSIONAMENTO_NAO_AUTORIZADO: 'O versionamento por item ainda não está habilitado para esta demanda.',
  REABERTURA_APROVADO_REQUER_CONFIRMACAO: 'A versão atual está aprovada. Criar uma nova versão reabrirá a aprovação.',
  JA_APROVADO: 'Este item já está aprovado.',
  STATUS_NAO_PERMITE_APROVACAO: 'O status atual não permite aprovação.',
  SEM_VERSAO_ATIVA: 'Não existe versão ativa para este item.',
  ENTREGA_EXISTENTE: 'Já existe uma entrega para este item. Use criar nova versão.',
  VERSAO_ATIVA_EXISTENTE: 'Já existe uma versão ativa para este item.',
  CONFLITO_VERSAO: 'Conflito de versão detectado. Tente novamente.',
  TEM_HISTORICO: 'Não é possível excluir esta entrega pois possui histórico.',
  OPERACAO_EM_ANDAMENTO: 'Operação em andamento. Aguarde.',
  NAO_APROVADO: 'Apenas itens aprovados podem ser reabertos.',
  REABERTURA_REQUER_CONFIRMACAO: 'Confirmação necessária para reabrir item aprovado.',
};

export function traduzirErroEntrega(error) {
  const code = error?.response?.data?.code || error?.code;
  if (code && ERRO_MAP[code]) return ERRO_MAP[code];
  return error?.response?.data?.error || error?.message || 'Erro inesperado.';
}

function ArquivoIcon({ tipo, url }) {
  const t = (tipo || '').toLowerCase();
  if (t.startsWith('image') || /\.(png|jpg|jpeg|gif|webp|svg)/i.test(url || '')) return <ImageIcon className="w-3 h-3" />;
  if (t.startsWith('video') || /\.(mp4|webm|mov)/i.test(url || '')) return <Video className="w-3 h-3" />;
  return <FileText className="w-3 h-3" />;
}

/**
 * Card V2 (entidade_versao) para um ItemDemanda.
 *
 * Mostra a versão canônica atual com arquivos, link público, histórico
 * e ações visuais condicionadas ao status_aprovacao.
 *
 * Não realiza mutações diretamente — apenas abre o modal existente
 * (EntregaItemModal) e link actions (copiar/abrir link).
 */
export default function ItemEntregaV2Card({ item, demanda, user }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [modalMode, setModalMode] = useState(null);

  const { data: entregas = [], isLoading, error: queryError } = useQuery({
    queryKey: ['entregasItemV2', item.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('gerenciarEntregaItem', {
        action: 'listar_entregas_item',
        item_id: item.id,
        demanda_id: demanda.id,
      });
      return res.data?.entregas || [];
    },
    enabled: !!item?.id && !!demanda?.id,
    refetchInterval: false,
  });

  const entrega = entregas[0];
  const isV2 = entrega?.modelo_versionamento === 'entidade_versao';
  const versoesAnteriores = entrega?.versoes_anteriores || [];
  const totalVersoes = (entrega ? 1 : 0) + versoesAnteriores.length;

  const { data: ultimaResposta } = useQuery({
    queryKey: ['ultimaRespostaVersao', entrega?.versao_uid],
    queryFn: async () => {
      if (!entrega?.versao_uid) return null;
      const respostas = await base44.entities.RespostaAprovacaoEntrega.filter(
        { versao_uid: entrega.versao_uid, status_aplicacao: 'aplicada', tipo_resposta: 'solicitou_alteracao' },
        '-created_date', 1
      );
      return respostas[0] || null;
    },
    enabled: !!entrega?.versao_uid && item.status_aprovacao === 'ajustes_solicitados',
    refetchInterval: false,
  });

  const status = item.status_aprovacao || 'nao_enviado';
  const statusAprov = STATUS_APROV_LABELS[status] || STATUS_APROV_LABELS.nao_enviado;

  const publicUrl = entrega?.link_publico_aprovacao ||
    (entrega?.token_publico ? `${window.location.origin}/aprovacao/${entrega.token_publico}` : null);

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    }
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['entregasItemV2', item.id] });
    queryClient.invalidateQueries({ queryKey: ['itensDemanda', demanda.id] });
  };

  const podeAdicionar = status === 'nao_enviado' && !entrega && item.status_finalizacao !== 'cancelado';

  return (
    <div className={cn('rounded-lg border overflow-hidden transition-all',
      item.status_finalizacao === 'cancelado' ? 'border-red-200 bg-red-50/30 opacity-70'
      : status === 'aprovado' ? 'border-green-200 bg-green-50/30'
      : status === 'ajustes_solicitados' ? 'border-amber-200 bg-amber-50/30'
      : status === 'aguardando' || status === 'reenviado' ? 'border-blue-200 bg-blue-50/30'
      : 'border-slate-200')}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(!expanded)}>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
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
            {entrega && <span>· v{entrega.numero_versao_atual}</span>}
            {totalVersoes > 1 && <span>· {totalVersoes} versões</span>}
          </div>
        </div>
        {podeAdicionar && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={(e) => { e.stopPropagation(); setModalMode('criar'); }}>
            <Plus className="w-3 h-3" /> Adicionar entrega
          </Button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            </div>
          ) : queryError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {traduzirErroEntrega(queryError)}
            </div>
          ) : entrega && isV2 ? (
            <>
              {entrega.tem_concorrencia && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Conflito de versões detectado. Execute a reconciliação para resolver.
                </div>
              )}

              {/* Versão canônica atual */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-medium">
                        v{entrega.numero_versao_atual}
                      </span>
                      {(entrega.data_envio || entrega.criada_em || entrega.created_date) && (
                        <span className="text-[10px] text-slate-400">
                          {entrega.data_envio
                            ? `Enviado em ${moment(entrega.data_envio).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}`
                            : `Criado em ${moment(entrega.criada_em || entrega.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate mt-1">{entrega.nome_entrega}</p>
                  </div>
                </div>

                {/* Arquivos e link externo */}
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

                {/* Observação VOXX */}
                {entrega.observacao_voxx && (
                  <div className="p-2 bg-violet-50 border border-violet-200 rounded text-xs text-violet-700">
                    <span className="font-medium">Obs. VOXX:</span> {entrega.observacao_voxx}
                  </div>
                )}

                {/* Observação do cliente (apenas ajustes_solicitados) */}
                {status === 'ajustes_solicitados' && ultimaResposta && (ultimaResposta.observacao_cliente || ultimaResposta.comentario_cliente) && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    <span className="font-medium">Obs. cliente:</span> {ultimaResposta.observacao_cliente || ultimaResposta.comentario_cliente}
                  </div>
                )}

                {/* Ações por status */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-100">
                  {status === 'nao_enviado' && !entrega && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => setModalMode('criar')}>
                      <Plus className="w-3 h-3" /> Adicionar entrega
                    </Button>
                  )}
                  {(status === 'aguardando' || status === 'reenviado') && publicUrl && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyLink}>
                        <Copy className="w-3 h-3" /> Copiar link
                      </Button>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <ExternalLink className="w-3 h-3" /> Abrir aprovação
                        </Button>
                      </a>
                    </>
                  )}
                  {status === 'ajustes_solicitados' && (
                    <Button size="sm" className="h-7 text-xs gap-1 bg-violet-600 hover:bg-violet-700"
                      onClick={() => setModalMode('nova_versao')}>
                      <RotateCcw className="w-3 h-3" /> Criar nova versão
                    </Button>
                  )}
                  {status === 'aprovado' && publicUrl && (
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <ExternalLink className="w-3 h-3" /> Visualizar entrega
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Histórico resumido de versões */}
              {versoesAnteriores.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <History className="w-3 h-3" /> Histórico de versões ({totalVersoes})
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 p-1.5 bg-violet-50 rounded text-[10px] border border-violet-200">
                      <span className="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded font-medium">v{entrega.numero_versao_atual}</span>
                      <span className="text-slate-600 font-medium">Atual</span>
                      <span className="text-slate-400">· {entrega.status_entrega}</span>
                      {entrega.data_envio && (
                        <span className="text-slate-400">· {moment(entrega.data_envio).tz('America/Sao_Paulo').format('DD/MM HH:mm')}</span>
                      )}
                    </div>
                    {versoesAnteriores.map((v, idx) => (
                      <div key={v.versao_uid || v.id || idx} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded text-[10px]">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded font-medium">v{v.numero_versao_atual}</span>
                        <span className="text-slate-500 truncate">{v.nome_entrega || '—'}</span>
                        <span className="text-slate-400">· {v.status_entrega}</span>
                        {v.data_envio && (
                          <span className="text-slate-400">· {moment(v.data_envio).tz('America/Sao_Paulo').format('DD/MM HH:mm')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : entrega && !isV2 ? (
            <ItemEntregaBlock item={item} demanda={demanda} user={user} />
          ) : (
            <div className="text-center py-4">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-xs text-slate-400">Nenhuma entrega criada para este item.</p>
              {status === 'nao_enviado' && (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1" onClick={() => setModalMode('criar')}>
                  <Plus className="w-3 h-3" /> Criar primeira entrega
                </Button>
              )}
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
          entregaAtual={entrega}
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