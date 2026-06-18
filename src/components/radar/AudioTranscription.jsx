import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export default function AudioTranscription({ mensagem }) {
  const [expanded, setExpanded] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [transcricaoLocal, setTranscricaoLocal] = useState(null);

  const transcricao = transcricaoLocal || mensagem.transcricao_audio;
  const status = mensagem.transcricao_status;
  const isVoxx = mensagem.remetente_tipo === 'voxx' || mensagem.origem === 'enviada' || mensagem.from_me;

  const handleTranscrever = async (e) => {
    e.stopPropagation();
    if (transcrevendo || !mensagem.midia_url) return;
    setTranscrevendo(true);
    try {
      const res = await base44.functions.invoke('transcreverAudio', { mensagem_id: mensagem.id });
      if (res.data?.transcricao) {
        setTranscricaoLocal(res.data.transcricao);
        setExpanded(true);
        toast.success('Áudio transcrito!');
      } else {
        toast.error('Não foi possível transcrever');
      }
    } catch {
      toast.error('Erro ao transcrever áudio');
    } finally {
      setTranscrevendo(false);
    }
  };

  // Processando
  if (status === 'processando' || transcrevendo) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] opacity-60">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Transcrevendo...</span>
      </div>
    );
  }

  // Sem transcrição — botão para solicitar
  if (!transcricao) {
    return (
      <button
        onClick={handleTranscrever}
        className={`flex items-center gap-1.5 mt-1.5 text-[11px] font-medium transition-colors opacity-60 hover:opacity-100 ${
          isVoxx ? 'text-emerald-200' : 'text-blue-500'
        }`}
      >
        <FileText className="w-3 h-3" />
        <span>Ver transcrição</span>
      </button>
    );
  }

  // Com transcrição — toggle expandir
  return (
    <div className="mt-1.5">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors opacity-70 hover:opacity-100 ${
          isVoxx ? 'text-emerald-200' : 'text-blue-500'
        }`}
      >
        <FileText className="w-3 h-3" />
        <span>Transcrição</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className={`mt-1 p-2 rounded-lg text-[12px] leading-relaxed italic ${
          isVoxx ? 'bg-black/15' : 'bg-black/5 text-slate-600'
        }`}>
          {transcricao}
        </div>
      )}
    </div>
  );
}