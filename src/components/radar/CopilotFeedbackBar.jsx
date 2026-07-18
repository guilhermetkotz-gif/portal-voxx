import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const MOTIVOS = [
  { value: 'numeros_datas_incorretos', label: 'Números ou datas incorretos' },
  { value: 'historico_nao_considerado', label: 'Histórico não considerado' },
  { value: 'resposta_generica', label: 'Resposta muito genérica' },
  { value: 'tom_inadequado', label: 'Tom inadequado' },
  { value: 'informacao_inventada', label: 'Informação inventada' },
  { value: 'conclusao_incorreta', label: 'Conclusão incorreta' },
  { value: 'mensagem_muito_longa', label: 'Mensagem muito longa' },
  { value: 'mensagem_muito_curta', label: 'Mensagem muito curta' },
  { value: 'outro', label: 'Outro' },
];

/**
 * Barra de avaliação da sugestão do Copilot.
 *
 * - Vinculada a um sugestao_id único
 * - Perite avaliar positiva ou negativamente
 * - Avaliação negativa abre popover com motivos
 * - Permite alterar a avaliação a qualquer momento
 * - Não bloqueia edição nem envio
 */
export default function CopilotFeedbackBar({
  sugestaoId,
  grupoId,
  clienteId,
  usuarioId,
  textoOriginalGerado,
  textoAtual,
  quantidadeRegeneracoes,
  modeloUtilizado,
  themeStyles,
}) {
  const [avaliacao, setAvaliacao] = useState(null);
  const [feedbackId, setFeedbackId] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [motivosSelecionados, setMotivosSelecionados] = useState([]);
  const [comentario, setComentario] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Carregar feedback existente quando o sugestaoId muda
  useEffect(() => {
    if (!sugestaoId || !usuarioId) {
      setAvaliacao(null);
      setFeedbackId(null);
      setMotivosSelecionados([]);
      setComentario('');
      setPopoverOpen(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const existing = await base44.entities.CopilotFeedback.filter({
          sugestao_id: sugestaoId,
          usuario_id: usuarioId,
        });
        if (!cancelled && existing && existing.length > 0) {
          const fb = existing[0];
          setAvaliacao(fb.avaliacao || null);
          setFeedbackId(fb.id);
          setMotivosSelecionados(fb.motivos || []);
          setComentario(fb.comentario || '');
        } else if (!cancelled) {
          setAvaliacao(null);
          setFeedbackId(null);
          setMotivosSelecionados([]);
          setComentario('');
        }
      } catch (_) { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [sugestaoId, usuarioId]);

  const salvarFeedback = useCallback(async (novaAvaliacao, motivos, comment) => {
    if (!sugestaoId || !usuarioId) return;
    setSalvando(true);
    try {
      const foiEditada = (textoOriginalGerado || '').trim() !== (textoAtual || '').trim();
      const dados = {
        sugestao_id: sugestaoId,
        grupo_id: grupoId || '',
        cliente_id: clienteId || '',
        usuario_id: usuarioId,
        avaliacao: novaAvaliacao,
        motivos: novaAvaliacao === 'negativa' ? motivos : [],
        comentario: novaAvaliacao === 'negativa' ? (comment || '') : '',
        texto_original_gerado: textoOriginalGerado || '',
        texto_no_momento_da_avaliacao: textoAtual || '',
        data_avaliacao: new Date().toISOString(),
        modelo_utilizado: modeloUtilizado || 'automatic',
        quantidade_regeneracoes: quantidadeRegeneracoes || 0,
        foi_editada_antes_da_avaliacao: foiEditada,
      };
      if (feedbackId) {
        await base44.entities.CopilotFeedback.update(feedbackId, dados);
      } else {
        const created = await base44.entities.CopilotFeedback.create(dados);
        if (created?.id) setFeedbackId(created.id);
      }
      setAvaliacao(novaAvaliacao);
      if (novaAvaliacao === 'positiva') {
        setMotivosSelecionados([]);
        setComentario('');
      }
      toast.success('Obrigado pelo feedback!');
    } catch (_) {
      toast.error('Erro ao salvar feedback');
    } finally {
      setSalvando(false);
    }
  }, [sugestaoId, usuarioId, grupoId, clienteId, textoOriginalGerado, textoAtual, quantidadeRegeneracoes, modeloUtilizado, feedbackId]);

  const handlePositivo = () => {
    salvarFeedback('positiva', [], '');
  };

  const handleNegativoSubmit = () => {
    salvarFeedback('negativa', motivosSelecionados, comentario);
    setPopoverOpen(false);
  };

  const toggleMotivo = (value) => {
    setMotivosSelecionados(prev =>
      prev.includes(value) ? prev.filter(m => m !== value) : [...prev, value]
    );
  };

  if (!sugestaoId) return null;

  const btnBase = 'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50';
  const btnInactive = 'bg-black/5 hover:bg-black/10 text-slate-600';
  const btnPositiveActive = 'bg-emerald-500/20 text-emerald-600 ring-1 ring-emerald-500/30';
  const btnNegativeActive = 'bg-red-500/20 text-red-600 ring-1 ring-red-500/30';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-slate-500">
        {avaliacao === 'positiva' ? 'Obrigado pelo feedback!' :
         avaliacao === 'negativa' ? 'Feedback registrado.' :
         'Essa sugestão ajudou?'}
      </span>
      <button
        onClick={handlePositivo}
        disabled={salvando}
        className={cn(btnBase, avaliacao === 'positiva' ? btnPositiveActive : btnInactive)}
        title="Sim, ajudou"
      >
        {salvando && avaliacao !== 'negativa' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
        Sim
      </button>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={salvando}
            className={cn(btnBase, avaliacao === 'negativa' ? btnNegativeActive : btnInactive)}
            title="Não ajudou"
          >
            <ThumbsDown className="w-3 h-3" />
            Não
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className={cn('w-72 p-3 border shadow-xl rounded-xl', themeStyles?.popoverBorder, themeStyles?.popoverBg)}>
          <p className={cn('text-xs font-semibold mb-2', themeStyles?.textName)}>O que pode melhorar?</p>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {MOTIVOS.map(m => (
              <label
                key={m.value}
                className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 text-xs', themeStyles?.textName)}
              >
                <input
                  type="checkbox"
                  checked={motivosSelecionados.includes(m.value)}
                  onChange={() => toggleMotivo(m.value)}
                  className="w-3.5 h-3.5"
                />
                {m.label}
              </label>
            ))}
          </div>
          {motivosSelecionados.includes('outro') && (
            <textarea
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder="Conte rapidamente o que poderia melhorar."
              className={cn('w-full mt-2 px-2 py-1.5 rounded-lg border text-xs resize-none min-h-[50px] max-h-[80px]', themeStyles?.bgInput, themeStyles?.inputBorder, themeStyles?.textInput)}
              rows={2}
            />
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setPopoverOpen(false)}
              className={cn('px-3 py-1.5 rounded-lg text-xs', themeStyles?.textSecondary, 'hover:bg-black/5')}
            >
              Cancelar
            </button>
            <button
              onClick={handleNegativoSubmit}
              disabled={salvando || motivosSelecionados.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 flex items-center gap-1"
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Enviar avaliação
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}