import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ExternalLink, Copy, Package, CheckCircle, AlertCircle, Link, RotateCcw, ChevronDown, ChevronUp, Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';
import NovaEntregaModal from './NovaEntregaModal';

const STATUS_CONFIG = {
  rascunho:             { label: 'Rascunho',              color: 'bg-slate-100 text-slate-600' },
  enviado:              { label: 'Enviado',               color: 'bg-blue-100 text-blue-700' },
  em_aprovacao:         { label: 'Em Aprovação',          color: 'bg-amber-100 text-amber-700' },
  aprovado:             { label: 'Aprovado ✓',            color: 'bg-green-100 text-green-700' },
  solicitacao_alteracao:{ label: 'Alteração Solicitada',  color: 'bg-red-100 text-red-700' },
  reenviado:            { label: 'Reenviado',             color: 'bg-indigo-100 text-indigo-700' },
  publicado:            { label: 'Publicado',             color: 'bg-emerald-100 text-emerald-700' },
  arquivado:            { label: 'Arquivado',             color: 'bg-slate-100 text-slate-500' },
};

function EntregaCard({ entrega, demanda, user }) {
  const queryClient = useQueryClient();
  const [showNovaVersao, setShowNovaVersao] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  const gerarToken = () => Math.random().toString(36).substring(2, 10) + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const publicUrl = entrega.token_publico ? `${window.location.origin}/aprovacao/${entrega.token_publico}` : null;
  const status = STATUS_CONFIG[entrega.status_entrega] || STATUS_CONFIG.rascunho;

  const updateStatus = useMutation({
    mutationFn: (novoStatus) => base44.entities.EntregaDemanda.update(entrega.id, { status_entrega: novoStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas', demanda.id] });
      toast.success('Status atualizado!');
    }
  });

  const gerarLink = useMutation({
    mutationFn: async () => {
      const token = entrega.token_publico || gerarToken();
      const link = `${window.location.origin}/aprovacao/${token}`;
      await base44.entities.EntregaDemanda.update(entrega.id, {
        token_publico: token,
        link_publico_aprovacao: link,
        link_ativo: true,
        status_entrega: entrega.status_entrega === 'rascunho' ? 'enviado' : entrega.status_entrega
      });
      return link;
    },
    onSuccess: (link) => {
      queryClient.invalidateQueries({ queryKey: ['entregas', demanda.id] });
      navigator.clipboard.writeText(link);
      toast.success('Link gerado e copiado!');
    }
  });

  const toggleLink = useMutation({
    mutationFn: (ativo) => base44.entities.EntregaDemanda.update(entrega.id, { link_ativo: ativo }),
    onSuccess: (_, ativo) => {
      queryClient.invalidateQueries({ queryKey: ['entregas', demanda.id] });
      toast.success(ativo ? 'Link ativado!' : 'Link desativado!');
    }
  });

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{entrega.nome_entrega}</p>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', status.color)}>{status.label}</span>
            {(entrega.numero_versao_atual || 1) > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                v{entrega.numero_versao_atual}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{entrega.tipo_entrega}</p>
          {entrega.observacao_interna && (
            <p className="text-xs text-slate-500 mt-1 italic">{entrega.observacao_interna}</p>
          )}
          {entrega.observacao_cliente && entrega.status_entrega === 'solicitacao_alteracao' && (
            <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <span className="font-medium">Obs. cliente:</span> {entrega.observacao_cliente}
            </div>
          )}
        </div>
      </div>

      {/* Arquivos / Link */}
      {(entrega.arquivos?.length > 0 || entrega.link_externo) && (
        <div className="mt-2 space-y-1">
          {entrega.link_externo && (
            <a href={entrega.link_externo} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> {entrega.link_externo}
            </a>
          )}
          {entrega.arquivos?.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> {a.nome}
            </a>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
        {/* Gerar / gerenciar link */}
        {!entrega.link_ativo ? (
          <Button size="sm" className="h-7 text-xs gap-1 bg-violet-600 hover:bg-violet-700" onClick={() => gerarLink.mutate()} disabled={gerarLink.isPending}>
            <Link className="w-3 h-3" /> Gerar Link de Aprovação
          </Button>
        ) : (
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
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-slate-400 hover:text-red-500" onClick={() => toggleLink.mutate(false)}>
              <ShieldOff className="w-3 h-3" /> Desativar
            </Button>
          </>
        )}
        {(entrega.status_entrega === 'solicitacao_alteracao' || entrega.status_entrega === 'reenviado') && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNovaVersao(true)}>
            <RotateCcw className="w-3 h-3" /> Nova Versão
          </Button>
        )}
        <select
          value={entrega.status_entrega}
          onChange={e => updateStatus.mutate(e.target.value)}
          className="h-7 text-xs rounded border border-slate-200 bg-white px-2 focus:outline-none"
        >
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Histórico de aprovações */}
      {entrega.historico_aprovacoes?.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowHistorico(!showHistorico)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            {showHistorico ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {entrega.historico_aprovacoes.length} registro(s) de aprovação
          </button>
          {showHistorico && (
            <div className="mt-1.5 space-y-1.5">
              {entrega.historico_aprovacoes.map((h, i) => (
                <div key={i} className={cn('p-2 rounded text-xs border', h.acao === 'aprovado' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                  <div className="flex items-center gap-1.5">
                    {h.acao === 'aprovado' ? <CheckCircle className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                    <span className="font-medium">{h.nome_responsavel}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{moment(h.data).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}</span>
                  </div>
                  {h.observacao && <p className="mt-0.5 text-slate-600 italic">"{h.observacao}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico de versões */}
      {entrega.versoes?.length > 0 && (
        <div className="mt-1.5">
          <p className="text-[10px] text-slate-400">{entrega.versoes.length} versão(ões) anterior(es) arquivada(s)</p>
        </div>
      )}

      {showNovaVersao && (
        <NovaEntregaModal demanda={demanda} user={user} entregaExistente={entrega} onClose={() => setShowNovaVersao(false)} />
      )}
    </div>
  );
}

export default function EntregasSection({ demanda, user }) {
  const [showModal, setShowModal] = useState(false);

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas', demanda?.id],
    queryFn: () => base44.entities.EntregaDemanda.filter({ demanda_id: demanda.id }, '-created_date', 50),
    enabled: !!demanda?.id,
  });

  const pendentes = entregas.filter(e => ['solicitacao_alteracao', 'em_aprovacao', 'enviado', 'reenviado'].includes(e.status_entrega)).length;
  const aprovados = entregas.filter(e => e.status_entrega === 'aprovado' || e.status_entrega === 'publicado').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-600" />
            Entregas
            {entregas.length > 0 && (
              <span className="text-xs font-normal text-slate-500">({entregas.length})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {pendentes > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                {pendentes} pendente{pendentes > 1 ? 's' : ''}
              </span>
            )}
            {aprovados > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                {aprovados} aprovado{aprovados > 1 ? 's' : ''}
              </span>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowModal(true)}>
              <Plus className="w-3 h-3" /> Nova
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {entregas.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            Nenhuma entrega registrada ainda
          </div>
        ) : (
          entregas.map(e => <EntregaCard key={e.id} entrega={e} demanda={demanda} user={user} />)
        )}
      </CardContent>

      {showModal && (
        <NovaEntregaModal demanda={demanda} user={user} onClose={() => setShowModal(false)} />
      )}
    </Card>
  );
}