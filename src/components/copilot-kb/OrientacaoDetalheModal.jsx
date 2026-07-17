import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { labelCategoria, labelTipoOrientacao, descTipoOrientacao, escopoAlvoText, badgeEscopoVariant } from './constants';
import { cn } from '@/lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch { return '—'; }
}

function Row({ label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs font-medium text-slate-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 flex-1">{children}</span>
    </div>
  );
}

export default function OrientacaoDetalheModal({ open, onClose, orientacao }) {
  if (!orientacao) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{orientacao.titulo}</DialogTitle>
          <DialogDescription className="sr-only">Detalhes da orientação</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Row label="Conteúdo">
            <p className="whitespace-pre-wrap text-sm bg-slate-50 rounded-lg p-3 border border-slate-100">{orientacao.conteudo}</p>
          </Row>

          <Row label="Categoria">
            <Badge variant="outline">{labelCategoria(orientacao.categoria)}</Badge>
          </Row>

          <Row label="Tipo">
            <div>
              <Badge variant="outline">{labelTipoOrientacao(orientacao.tipo_orientacao)}</Badge>
              {descTipoOrientacao(orientacao.tipo_orientacao) && (
                <p className="text-xs text-slate-400 mt-1">{descTipoOrientacao(orientacao.tipo_orientacao)}</p>
              )}
            </div>
          </Row>

          <Row label="Escopo">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={badgeEscopoVariant(orientacao.escopo_tipo)}>{orientacao.escopo_tipo}</Badge>
              <span className="text-sm text-slate-600">{escopoAlvoText(orientacao)}</span>
            </div>
          </Row>

          <Row label="Prioridade">
            <span className="font-medium">{orientacao.prioridade || 5}</span>
          </Row>

          {orientacao.chave_tematica && (
            <Row label="Chave temática">
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{orientacao.chave_tematica}</code>
            </Row>
          )}

          {orientacao.palavras_chave?.length > 0 && (
            <Row label="Palavras-chave">
              <div className="flex flex-wrap gap-1">
                {orientacao.palavras_chave.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            </Row>
          )}

          <Row label="Flags">
            <div className="flex flex-wrap gap-1.5">
              <Badge className={cn('text-[10px]', orientacao.obrigatoria ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500')}>
                {orientacao.obrigatoria ? 'Obrigatória' : 'Não obrigatória'}
              </Badge>
              <Badge className={cn('text-[10px]', orientacao.exige_verificacao ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                {orientacao.exige_verificacao ? 'Exige verificação' : 'Sem exigência'}
              </Badge>
              <Badge className={cn('text-[10px]', orientacao.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                {orientacao.ativa ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
          </Row>

          <Row label="Versão atual">
            <span className="text-sm">v{orientacao.versao_atual || 1}</span>
          </Row>

          {orientacao.substituiu_orientacao_id && (
            <Row label="Substituiu">
              <Badge variant="outline" className="text-violet-600 border-violet-200">Orientação anterior substituída</Badge>
            </Row>
          )}

          <Separator className="my-2" />

          <Row label="Criado por">
            <span className="text-sm">{orientacao.criado_por_nome || '—'} {orientacao.criado_por_email && <span className="text-slate-400">({orientacao.criado_por_email})</span>}</span>
          </Row>

          <Row label="Atualizado por">
            <span className="text-sm">{orientacao.atualizado_por_nome || '—'} {orientacao.atualizado_por_email && <span className="text-slate-400">({orientacao.atualizado_por_email})</span>}</span>
          </Row>

          <Row label="Atualização">
            <span className="text-sm text-slate-500">{formatDate(orientacao.updated_date)}</span>
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}