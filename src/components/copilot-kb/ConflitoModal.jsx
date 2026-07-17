import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, ArrowLeft, Replace } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { labelCategoria, labelEscopo, escopoAlvoText } from './constants';
import { cn } from '@/lib/utils';

export default function ConflitoModal({ open, onClose, conflitanteId, onSubstituir, loadingAcao }) {
  const [conflitante, setConflitante] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('info');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!open || !conflitanteId) return;
    setConflitante(null);
    setStep('info');
    setMotivo('');
    setLoading(true);
    base44.functions.invoke('gerenciarConhecimentoCopilot', { acao: 'consultar', orientacao_id: conflitanteId })
      .then(res => setConflitante(res.data?.orientacao || null))
      .catch(() => setConflitante(null))
      .finally(() => setLoading(false));
  }, [open, conflitanteId]);

  const handleSubstituir = () => {
    setStep('confirm');
  };

  const handleConfirmSubstituir = () => {
    onSubstituir(motivo || 'Substituição por nova orientação');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" /> Conflito detectado
          </DialogTitle>
          <DialogDescription>
            Já existe uma orientação ativa com a mesma chave temática, categoria, escopo e prioridade.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && conflitante && step === 'info' && (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
              <div>
                <p className="text-xs text-slate-400">Título</p>
                <p className="text-sm font-medium text-slate-900">{conflitante.titulo}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Categoria</p>
                  <p className="text-sm text-slate-700">{labelCategoria(conflitante.categoria)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Escopo</p>
                  <p className="text-sm text-slate-700">{labelEscopo(conflitante.escopo_tipo)} — {escopoAlvoText(conflitante)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Prioridade</p>
                  <p className="text-sm text-slate-700">{conflitante.prioridade || 5}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Chave temática</p>
                  <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">{conflitante.chave_tematica}</code>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <Badge className={cn('text-[10px]', conflitante.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                    {conflitante.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={onClose} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Voltar e ajustar
              </Button>
              <Button onClick={handleSubstituir} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                <Replace className="w-4 h-4" /> Substituir orientação existente
              </Button>
            </DialogFooter>
          </div>
        )}

        {!loading && conflitante && step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                Esta ação desativará a orientação atual e registrará a nova orientação como substituta. Os históricos serão preservados.
              </p>
            </div>
            <div>
              <Label htmlFor="motivo-substituicao">Motivo da substituição</Label>
              <Textarea
                id="motivo-substituicao"
                placeholder="Explique o motivo da substituição..."
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep('info')} className="gap-1.5">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
              <Button onClick={handleConfirmSubstituir} disabled={loadingAcao} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                {loadingAcao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
                Confirmar substituição
              </Button>
            </DialogFooter>
          </div>
        )}

        {!loading && !conflitante && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500">Não foi possível carregar os detalhes da orientação conflitante.</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}