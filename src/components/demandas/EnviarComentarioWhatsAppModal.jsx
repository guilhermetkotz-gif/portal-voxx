import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Copy, RefreshCw, AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EnviarComentarioWhatsAppModal({
  open,
  onClose,
  demanda,
  comentarioOriginal,
  user,
}) {
  const [step, setStep] = useState('generating'); // generating | reviewing | confirming | sending | done | error
  const [mensagem, setMensagem] = useState('');
  const [tipoMensagem, setTipoMensagem] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [erroIa, setErroIa] = useState(false);

  const gerarMensagem = async () => {
    setStep('generating');
    setErroIa(false);
    try {
      const res = await base44.functions.invoke('gerarMensagemComentarioDemandaCliente', {
        demanda_id: demanda.id,
        cliente_id: demanda.cliente_id,
        cliente_nome: demanda.cliente_nome,
        titulo_demanda: demanda.titulo,
        setor_principal: demanda.setor_responsavel_original || demanda.setor,
        status_demanda: demanda.status,
        comentario_original: comentarioOriginal,
        resumo_cliente: demanda.resumo_cliente || '',
        tipo_entrega: demanda.tipo_entrega || '',
      });
      if (res.data?.error) {
        setErroIa(true);
        setStep('reviewing');
        setMensagem(comentarioOriginal);
        return;
      }
      setMensagem(res.data?.mensagem_sugerida || comentarioOriginal);
      setTipoMensagem(res.data?.tipo_mensagem || 'Atualização');
      setStep('reviewing');
    } catch (e) {
      setErroIa(true);
      setStep('reviewing');
      setMensagem(comentarioOriginal);
    }
  };

  React.useEffect(() => {
    if (open) {
      setStep('generating');
      setShowConfirm(false);
      setErroIa(false);
      gerarMensagem();
    }
  }, [open]);

  const handleRegenerate = () => {
    setErroIa(false);
    gerarMensagem();
  };

  const handleEnviar = async () => {
    setStep('sending');
    try {
      // Buscar grupo WhatsApp do cliente
      const clienteData = await base44.entities.Cliente.filter({ id: demanda.cliente_id });
      const cliente = clienteData[0];
      const grupoId = cliente?.whatsapp_grupo_id;

      if (!grupoId) {
        toast.error('Este cliente não possui grupo WhatsApp vinculado. Vincule o grupo no Radar WhatsApp antes de enviar.');
        setStep('reviewing');
        return;
      }

      // Verificar Z-API status
      const zapiRes = await base44.functions.invoke('zapiStatus', {});
      if (!zapiRes.data?.connected) {
        toast.error('Instância Z-API desconectada. Verifique a conexão antes de enviar.');
        setStep('reviewing');
        return;
      }

      // Enviar via WhatsApp (sem assinatura — a função enviarMensagemGeral já adiciona)
      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: grupoId,
        mensagem: mensagem,
        tipo: 'texto',
        incluirAssinatura: false,
        clienteId: demanda.cliente_id,
        clienteNome: demanda.cliente_nome,
        chatName: cliente?.whatsapp_grupo_nome || '',
        origem: 'comentario_demanda',
        demandaId: demanda.id,
        comentarioOriginal: comentarioOriginal,
      });

      if (res.data?.success) {
        // Registrar no histórico da demanda
        await base44.entities.TimelineEvent.create({
          demanda_id: demanda.id,
          cliente_id: demanda.cliente_id,
          tipo: 'comentario',
          descricao: `📱 Comentário enviado ao cliente via WhatsApp\n\nMensagem: ${mensagem}\n\nGrupo: ${cliente?.whatsapp_grupo_nome || grupoId}`,
          autor: user?.full_name || user?.email,
          autor_tipo: 'voxx',
        });

        setStep('done');
        toast.success('Mensagem enviada ao cliente!');
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar WhatsApp');
        setStep('reviewing');
      }
    } catch (e) {
      toast.error('Erro ao enviar: ' + (e.message || 'Desconhecido'));
      setStep('reviewing');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Enviar comentário por WhatsApp</h3>
            <p className="text-xs text-slate-500">{demanda.cliente_nome}</p>
          </div>
        </div>

        {/* Loading — Gerando */}
        {step === 'generating' && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-3" />
              <p className="text-sm text-slate-600">Gerando mensagem para o cliente...</p>
            </div>
          </div>
        )}

        {/* Erro IA — permite escrever manual */}
        {erroIa && step === 'reviewing' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Não foi possível gerar a mensagem automaticamente. Você pode escrever manualmente abaixo.
            </p>
          </div>
        )}

        {/* Review / Edit */}
        {(step === 'reviewing' || step === 'sending' || step === 'done') && (
          <div className="space-y-4">
            {/* Info cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Cliente</p>
                <p className="text-xs font-semibold text-slate-700 truncate">{demanda.cliente_nome}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Demanda</p>
                <p className="text-xs font-semibold text-slate-700 truncate">{demanda.titulo}</p>
              </div>
            </div>

            {/* Comentário original */}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Comentário original:</p>
              <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-600 italic max-h-24 overflow-y-auto">
                {comentarioOriginal}
              </div>
            </div>

            {/* Mensagem editável */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium text-slate-500">Mensagem para o cliente:</p>
                {tipoMensagem && (
                  <Badge variant="outline" className="text-[10px]">{tipoMensagem}</Badge>
                )}
              </div>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="min-h-[120px] text-sm"
                disabled={step === 'sending' || step === 'done'}
              />
            </div>

            {/* Actions */}
            {step !== 'done' ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={step === 'sending'}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(mensagem); toast.success('Copiado!'); }}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={onClose} disabled={step === 'sending'}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-1.5"
                  onClick={() => setShowConfirm(true)}
                  disabled={step === 'sending' || !mensagem.trim()}
                >
                  {step === 'sending' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar WhatsApp
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Enviado ao cliente</span>
                </div>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Confirmação */}
        {showConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
            <div className="relative bg-white rounded-xl shadow-xl p-5 max-w-sm w-full mx-4">
              <h4 className="font-semibold text-slate-900 mb-2">Confirmar envio</h4>
              <p className="text-sm text-slate-600 mb-5">
                Deseja enviar esta mensagem no grupo WhatsApp do cliente?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => { setShowConfirm(false); handleEnviar(); }}
                >
                  Confirmar envio
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}