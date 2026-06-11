import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Paperclip, Mic, MicOff, Image, FileText, Video, Loader2 } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';

const TZ = 'America/Sao_Paulo';

export default function ChatDrawer({ chatId, chatName, clienteId, clienteNome, isGroup, onClose }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Buscar mensagens do chat
  const { data: mensagens = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['chatMsgs', chatId],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ grupo_id: chatId }, '-received_at', 100),
    enabled: !!chatId,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });

  // Auto-scroll para baixo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Enviar texto
  const handleSend = async () => {
    const texto = mensagem.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId,
        mensagem: texto,
        tipo: 'texto',
        incluirAssinatura: true,
        clienteId: clienteId || '',
        clienteNome: clienteNome || '',
        chatName: chatName || '',
      });
      if (res.data?.success) {
        setMensagem('');
        queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar mensagem');
      }
    } catch (e) {
      toast.error('Erro ao enviar: ' + (e.message || 'Desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  // Enviar mídia (imagem/vídeo/documento)
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setEnviando(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      let tipo = 'documento';
      if (file.type.startsWith('image/')) tipo = 'imagem';
      else if (file.type.startsWith('video/')) tipo = 'video';

      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId,
        mensagem: '',
        tipo,
        midiaUrl: fileUrl,
        fileName: file.name,
        incluirAssinatura: false,
        clienteId: clienteId || '',
        clienteNome: clienteNome || '',
        chatName: chatName || '',
      });

      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar arquivo');
      }
    } catch (e) {
      toast.error('Erro ao enviar arquivo: ' + (e.message || 'Desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  // Gravação de áudio nativo
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setGravando(false);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return; // muito curto

        setEnviando(true);
        try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
          const res = await base44.functions.invoke('enviarMensagemGeral', {
            chatId,
            tipo: 'audio',
            midiaUrl: uploadRes.file_url,
            fileName: 'audio.webm',
            incluirAssinatura: false,
            clienteId: clienteId || '',
            clienteNome: clienteNome || '',
            chatName: chatName || '',
          });

          if (res.data?.success) {
            queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
            queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
          } else {
            toast.error(res.data?.erro || 'Erro ao enviar áudio');
          }
        } catch (e) {
          toast.error('Erro ao enviar áudio: ' + (e.message || 'Desconhecido'));
        } finally {
          setEnviando(false);
        }
      };

      recorder.start();
      setGravando(true);
    } catch (e) {
      toast.error('Microfone não disponível');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isGroup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {(chatName || chatId).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{chatName || chatId}</h2>
              <p className="text-[11px] text-slate-400">{isGroup ? 'Grupo' : 'Contato direto'}{clienteNome ? ` · ${clienteNome}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens */}
        <ScrollArea className="flex-1 px-4 py-3">
          <div ref={scrollRef} className="space-y-2 max-h-full">
            {loadingMsgs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : mensagens.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-12">Nenhuma mensagem ainda.</p>
            ) : (
              mensagens.map((m) => {
                const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
                const ts = m.received_at || m.timestamp_mensagem;
                return (
                  <div key={m.id} className={`flex ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isVoxx
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700'
                    }`}>
                      {!isVoxx && m.remetente_nome && (
                        <p className="text-[11px] font-medium text-blue-400 mb-0.5">{m.remetente_nome}</p>
                      )}
                      {isVoxx && m.remetente_nome && (
                        <p className="text-[11px] font-medium text-emerald-300 mb-0.5">{m.remetente_nome}</p>
                      )}
                      {m.tipo_mensagem === 'imagem' && m.mensagem ? (
                        <div>
                          <img src={m.mensagem} alt="Imagem" className="rounded-lg max-w-full max-h-60 object-cover mb-1" />
                        </div>
                      ) : m.tipo_mensagem === 'video' && m.mensagem ? (
                        <div>
                          <video src={m.mensagem} controls className="rounded-lg max-w-full max-h-60 mb-1" />
                        </div>
                      ) : m.tipo_mensagem === 'audio' ? (
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          <span className="text-xs">Áudio</span>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${isVoxx ? 'text-emerald-200' : 'text-slate-500'}`}>
                        {ts ? moment(ts).tz(TZ).format('HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80 shrink-0">
          {gravando && (
            <div className="flex items-center justify-center gap-2 py-2 mb-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-medium">Gravando áudio...</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={enviando}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {gravando ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                onClick={stopRecording}
              >
                <MicOff className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
                onClick={startRecording}
                disabled={enviando}
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}

            <div className="flex-1 relative">
              <Input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 pr-10 rounded-xl text-sm min-h-[36px]"
                disabled={enviando}
              />
            </div>

            <Button
              size="icon"
              className="h-9 w-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shrink-0"
              onClick={handleSend}
              disabled={!mensagem.trim() || enviando}
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}