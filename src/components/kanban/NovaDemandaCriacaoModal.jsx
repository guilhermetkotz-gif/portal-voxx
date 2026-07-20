import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CriacaoOralSinWizard from '@/components/demandas/CriacaoOralSinWizard';
import BriefingUniversalWizard from '@/components/demandas/BriefingUniversalWizard';
import { isFeatureEnabled, FEATURES } from '@/lib/featureFlags';

/**
 * Modal de criação de demanda de CRIAÇÃO (Artes & Peças) no Kanban.
 * 
 * GATE:
 *  - Oral Sin → CriacaoOralSinWizard (sem modificações)
 *  - Não Oral Sin → BriefingUniversalWizard (novo fluxo isolado)
 */
export default function NovaDemandaCriacaoModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  const [fase, setFase] = useState('selecionar'); // 'selecionar' | 'wizard_oral_sin' | 'wizard_universal'
  const [salvando, setSalvando] = useState(false);
  const [estruturaDemanda, setEstruturaDemanda] = useState('unitaria'); // 'unitaria' | 'composta'

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientesNovaDemanda'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
    enabled: open,
    staleTime: 2 * 60 * 1000
  });

  const clienteSelecionado = clientes.find(c => c.id === clienteSelecionadoId);

  const isOralSin = (cliente) => {
    if (!cliente) return false;
    const nome = (cliente.nome || '').toLowerCase();
    const tipo = (cliente.tipo_cliente || '').toLowerCase();
    return nome.includes('oral sin') || tipo === 'oral_sin';
  };

  const handleConfirmarCliente = () => {
    if (!clienteSelecionado) return;
    if (isOralSin(clienteSelecionado)) {
      setFase('wizard_oral_sin');
    } else {
      setFase('wizard_universal');
    }
  };

  const handleConcluir = async ({ camposAdicionais, descricao, titulo, urgente, previsao_entrega, anexos }) => {
    setSalvando(true);
    try {
      const demanda = await base44.entities.Demanda.create({
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome,
        setor: 'CRIACAO',
        titulo: titulo || 'Nova Arte',
        descricao: descricao || '',
        status: 'recebida',
        prioridade: urgente ? 'alta' : 'media',
        urgente: urgente || false,
        previsao_entrega: previsao_entrega || null,
        campos_adicionais: camposAdicionais,
        anexos: anexos || [],
        estrutura_demanda: isFeatureEnabled(FEATURES.ITENS_DEMANDA) ? estruturaDemanda : 'legada',
      });

      await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: clienteSelecionado.id,
        tipo: 'criacao',
        descricao: `Demanda criada via Briefing ${isOralSin(clienteSelecionado) ? 'Oral Sin' : 'Universal'}.`,
        autor: 'Sistema',
        autor_tipo: 'voxx'
      });

      queryClient.invalidateQueries(['demandasKanban']);
      toast.success('Demanda criada com sucesso!');
      handleClose();
    } catch (error) {
      toast.error('Erro ao criar demanda: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleClose = () => {
    setClienteSelecionadoId('');
    setFase('selecionar');
    setEstruturaDemanda('unitaria');
    onClose();
  };

  const titulo = fase === 'selecionar'
    ? 'Nova Demanda — Criação (Artes & Peças)'
    : fase === 'wizard_oral_sin'
    ? 'Briefing Oral Sin'
    : 'Briefing Universal – Criação de Artes';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {fase === 'selecionar' && (
            <DialogDescription>Selecione o cliente para definir o fluxo de criação.</DialogDescription>
          )}
          {fase === 'wizard_universal' && (
            <DialogDescription>
              Cliente: <strong>{clienteSelecionado?.nome}</strong>
            </DialogDescription>
          )}
          {fase === 'wizard_oral_sin' && (
            <DialogDescription>
              Cliente: <strong>{clienteSelecionado?.nome}</strong>
            </DialogDescription>
          )}
        </DialogHeader>

        {/* FASE: Selecionar cliente */}
        {fase === 'selecionar' && (
          <div className="space-y-4 py-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Cliente *</Label>
                  <Select value={clienteSelecionadoId} onValueChange={setClienteSelecionadoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {clienteSelecionado && (
                  <div className={`p-3 rounded-lg border text-sm ${isOralSin(clienteSelecionado) ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    {isOralSin(clienteSelecionado)
                      ? '🟣 Cliente Oral Sin — será aberto o Briefing Oral Sin padrão.'
                      : '🔵 Cliente não Oral Sin — será aberto o Briefing Universal de Criação de Artes.'}
                  </div>
                )}

                {clienteSelecionado && isFeatureEnabled(FEATURES.ITENS_DEMANDA) && (
                  <div className="space-y-2">
                    <Label>Estrutura da Demanda</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEstruturaDemanda('unitaria')}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${estruturaDemanda === 'unitaria' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-300' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <p className="font-medium text-slate-800">Unitária</p>
                        <p className="text-xs text-slate-500 mt-0.5">Uma única entrega (arte, vídeo, etc.)</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstruturaDemanda('composta')}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${estruturaDemanda === 'composta' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-300' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <p className="font-medium text-slate-800">Composta</p>
                        <p className="text-xs text-slate-500 mt-0.5">Cronograma ou conjunto de materiais independentes</p>
                      </button>
                    </div>
                    {estruturaDemanda === 'composta' && (
                      <p className="text-xs text-violet-600 bg-violet-50 p-2 rounded">
                        ℹ️ Os itens poderão ser adicionados e gerenciados após a criação do card, no detalhe da demanda.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
                  <Button
                    onClick={handleConfirmarCliente}
                    disabled={!clienteSelecionadoId}
                    className="flex-1 bg-violet-600 hover:bg-violet-700"
                  >
                    Continuar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* FASE: Wizard Oral Sin — SEM ALTERAÇÕES */}
        {fase === 'wizard_oral_sin' && (
          <CriacaoOralSinWizard
            cliente={clienteSelecionado}
            onComplete={handleConcluir}
            onCancel={() => setFase('selecionar')}
          />
        )}

        {/* FASE: Wizard Universal — novo fluxo isolado */}
        {fase === 'wizard_universal' && (
          <BriefingUniversalWizard
            cliente={clienteSelecionado}
            onComplete={handleConcluir}
            onCancel={() => setFase('selecionar')}
          />
        )}

        {salvando && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Salvando demanda...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}