import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle2, XCircle, X } from 'lucide-react';

export default function ModalEnvioMassa({ gruposSelecionados, gruposEnriquecidos, onClose }) {
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const gruposSelecionadosIds = new Set(gruposSelecionados);
  const grupos = gruposEnriquecidos.filter(g => gruposSelecionadosIds.has(g.id));

  const handleEnviar = async () => {
    if (!mensagem.trim()) return;
    setEnviando(true);
    setResultados(null);

    const grupoIds = grupos.map(g => g.grupo_id);
    const res = await base44.functions.invoke('enviarMensagemMassa', {
      grupoIds,
      mensagem: mensagem.trim(),
    });

    setResultados(res.data || { total: grupoIds.length, enviados: 0, erros: grupoIds.length, resultados: [] });
    setEnviando(false);
  };

  const pronto = resultados !== null && !enviando;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Envio em Massa</h2>
            <p className="text-xs text-slate-400 mt-0.5">{grupos.length} grupo(s) selecionado(s)</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista de grupos */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Destinatários</p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {grupos.map(g => (
              <Badge key={g.id} className="text-[10px] bg-slate-800 border-slate-700 text-slate-300">
                {g.cliente_nome || g.nome_grupo}
              </Badge>
            ))}
          </div>
        </div>

        {/* Mensagem */}
        <div className="px-5 py-3 flex-1">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Mensagem</p>
          <Textarea
            placeholder="Digite a mensagem que será enviada para todos os grupos..."
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            disabled={enviando || pronto}
            className="min-h-[120px] bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none text-sm"
          />
        </div>

        {/* Resultados */}
        {pronto && (
          <div className="px-5 py-3 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              {resultados.erros === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-sm text-slate-200">
                {resultados.enviados} enviado(s), {resultados.erros} erro(s)
              </span>
            </div>
            {resultados.erros > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {resultados.resultados
                  ?.filter(r => !r.success)
                  .map((r, i) => (
                    <p key={i} className="text-[11px] text-red-400">
                      {r.chatId}: {r.erro || r.error || 'Erro desconhecido'}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-800">
          {enviando ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando... aguarde
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {pronto ? 'Envio concluído.' : 'A assinatura da Voxx será incluída automaticamente.'}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={enviando}
              className="border-slate-700 text-slate-300 hover:bg-slate-800">
              {pronto ? 'Fechar' : 'Cancelar'}
            </Button>
            {!pronto && (
              <Button size="sm" onClick={handleEnviar} disabled={!mensagem.trim() || enviando}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Enviar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}