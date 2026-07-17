import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, RotateCcw, ChevronDown, ChevronRight, History as HistoryIcon } from 'lucide-react';
import { labelCategoria, labelTipoOrientacao, escopoAlvoText } from './constants';
import { cn } from '@/lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch { return '—'; }
}

function VersaoRow({ versao, permissoes, onRestaurar, loadingAcao }) {
  const [expanded, setExpanded] = useState(false);
  const canRestore = permissoes?.pode_restaurar_versao;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 text-sm">v{versao.versao}</span>
            <Badge className={cn('text-[9px] py-0 px-1.5', versao.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
              {versao.ativa ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {formatDate(versao.data_alteracao)} — {versao.alterado_por_nome || '—'}
          </p>
        </div>
        {versao.campos_alterados?.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1">
            {versao.campos_alterados.slice(0, 3).map((c, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] py-0 px-1.5">{c}</Badge>
            ))}
            {versao.campos_alterados.length > 3 && (
              <Badge variant="secondary" className="text-[9px] py-0 px-1.5">+{versao.campos_alterados.length - 3}</Badge>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 bg-slate-50/50">
          {versao.motivo_edicao && (
            <div>
              <p className="text-xs font-medium text-slate-400">Motivo</p>
              <p className="text-sm text-slate-700">{versao.motivo_edicao}</p>
            </div>
          )}
          {versao.campos_alterados?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400">Campos alterados</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {versao.campos_alterados.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
                ))}
              </div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">Título:</span> <span className="text-slate-700">{versao.titulo || '—'}</span></div>
            <div><span className="text-slate-400">Categoria:</span> <span className="text-slate-700">{labelCategoria(versao.categoria)}</span></div>
            <div><span className="text-slate-400">Tipo:</span> <span className="text-slate-700">{labelTipoOrientacao(versao.tipo_orientacao)}</span></div>
            <div><span className="text-slate-400">Escopo:</span> <span className="text-slate-700">{escopoAlvoText(versao)}</span></div>
            <div><span className="text-slate-400">Prioridade:</span> <span className="text-slate-700">{versao.prioridade || 5}</span></div>
            <div><span className="text-slate-400">Obrigatória:</span> <span className="text-slate-700">{versao.obrigatoria ? 'Sim' : 'Não'}</span></div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mt-2">Conteúdo</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-2 border border-slate-100 mt-1">{versao.conteudo}</p>
          </div>

          {canRestore && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5"
              onClick={() => onRestaurar(versao)}
              disabled={loadingAcao}
            >
              {loadingAcao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Restaurar esta versão
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HistoricoModal({ open, onClose, orientacaoId, permissoes, onRestaurar, loadingAcao }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restaurarVersao, setRestaurarVersao] = useState(null);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open || !orientacaoId) return;
    setData(null);
    setLoading(true);
    import('@/api/base44Client').then(({ base44 }) => {
      base44.functions.invoke('gerenciarConhecimentoCopilot', { acao: 'historico', orientacao_id: orientacaoId })
        .then(res => setData({ orientacao: res.data?.orientacao, versoes: res.data?.versoes || [] }))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    });
  }, [open, orientacaoId]);

  const handleConfirmRestaurar = () => {
    onRestaurar(orientacaoId, restaurarVersao.id, motivo || `Restauração para versão ${restaurarVersao.versao}`);
    setRestaurarVersao(null);
    setMotivo('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            {data?.orientacao?.titulo || 'Carregando...'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && data && (
          <div className="space-y-2">
            {data.versoes.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Nenhuma versão anterior registrada.</p>
            ) : (
              data.versoes.map(v => (
                <VersaoRow
                  key={v.id}
                  versao={v}
                  permissoes={permissoes}
                  onRestaurar={setRestaurarVersao}
                  loadingAcao={loadingAcao}
                />
              ))
            )}
          </div>
        )}

        {/* Confirmação de restauração */}
        {restaurarVersao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRestaurarVersao(null)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Restaurar versão {restaurarVersao.versao}?</h3>
                <p className="text-sm text-slate-500 mt-2">
                  A versão atual será preservada no histórico. A versão selecionada será copiada como nova versão atual. O número de versão continuará aumentando. Nenhuma versão será apagada.
                </p>
              </div>
              <div>
                <Label htmlFor="motivo-restauracao">Motivo da restauração</Label>
                <Textarea
                  id="motivo-restauracao"
                  placeholder="Explique o motivo da restauração..."
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestaurarVersao(null)}>Cancelar</Button>
                <Button onClick={handleConfirmRestaurar} disabled={loadingAcao} className="gap-1.5">
                  {loadingAcao && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar restauração
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}