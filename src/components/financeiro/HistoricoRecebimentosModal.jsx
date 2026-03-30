import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_LABELS = {
  parcial: { label: 'Parcial', color: 'bg-amber-100 text-amber-700' },
  integral: { label: 'Integral', color: 'bg-emerald-100 text-emerald-700' },
  quitacao_juros: { label: 'Quitação c/ juros', color: 'bg-orange-100 text-orange-700' },
  ajuste: { label: 'Ajuste', color: 'bg-slate-100 text-slate-700' },
};

export default function HistoricoRecebimentosModal({ receita, onClose, onAddRecebimento }) {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ['recebimentos-receita', receita?.id],
    queryFn: () => base44.entities.RecebimentoReceita.filter({ receita_id: receita?.id }, 'data_pagamento', 100),
    enabled: !!receita?.id,
  });

  const totalRecebido = recebimentos.reduce((s, r) => s + (r.valor_total_recebido || 0), 0);
  const totalJuros = recebimentos.reduce((s, r) => s + (r.valor_juros || 0), 0);
  const totalDescontos = recebimentos.reduce((s, r) => s + (r.valor_desconto || 0), 0);
  const valorCorrigido = (receita?.valor_mensal || 0) + totalJuros - totalDescontos;
  const saldoPendente = Math.max(0, valorCorrigido - totalRecebido);
  const semComprovante = recebimentos.filter(r => !r.comprovante_url).length;

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.RecebimentoReceita.delete(deleteTarget.id);
    qc.invalidateQueries({ queryKey: ['recebimentos-receita', receita?.id] });
    qc.invalidateQueries({ queryKey: ['fin-recebimentos'] });
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Recebimentos — {receita?.cliente_nome}</DialogTitle>
          </DialogHeader>

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-xs text-slate-400">Valor original</p>
              <p className="font-bold text-slate-800 text-sm">{fmt(receita?.valor_mensal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Total recebido</p>
              <p className="font-bold text-emerald-600 text-sm">{fmt(totalRecebido)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Juros acumulados</p>
              <p className={`font-bold text-sm ${totalJuros > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{fmt(totalJuros)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Saldo pendente</p>
              <p className={`font-bold text-sm ${saldoPendente > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(saldoPendente)}</p>
            </div>
          </div>

          {semComprovante > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {semComprovante} recebimento{semComprovante > 1 ? 's' : ''} sem comprovante
            </div>
          )}

          {/* Lista */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>
            ) : recebimentos.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Nenhum recebimento registrado ainda.</div>
            ) : recebimentos.map(r => {
              const tipo = TIPO_LABELS[r.tipo_recebimento] || TIPO_LABELS.integral;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3 border border-slate-100 rounded-lg bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{fmt(r.valor_total_recebido)}</span>
                      <Badge className={`text-xs ${tipo.color}`}>{tipo.label}</Badge>
                      {r.valor_juros > 0 && <Badge className="text-xs bg-orange-100 text-orange-700">+{fmt(r.valor_juros)} juros</Badge>}
                      {r.valor_desconto > 0 && <Badge className="text-xs bg-emerald-100 text-emerald-700">-{fmt(r.valor_desconto)} desconto</Badge>}
                      {r.comprovante_url ? (
                        <a href={r.comprovante_url} target="_blank" rel="noopener noreferrer">
                          <Badge className="text-xs bg-violet-100 text-violet-700 cursor-pointer hover:bg-violet-200">
                            <FileText className="w-3 h-3 mr-1" />comprovante
                          </Badge>
                        </a>
                      ) : (
                        <Badge className="text-xs bg-amber-100 text-amber-600">sem comprovante</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {r.data_pagamento?.split('-').reverse().join('/')}
                      {r.registrado_por && ` · por ${r.registrado_por}`}
                      {r.observacao && ` · ${r.observacao}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} className="text-red-400 h-7 px-2 flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={onAddRecebimento} className="bg-emerald-600 hover:bg-emerald-700">
              + Adicionar recebimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Recebimento de <strong>{fmt(deleteTarget?.valor_total_recebido)}</strong> em {deleteTarget?.data_pagamento?.split('-').reverse().join('/')} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}