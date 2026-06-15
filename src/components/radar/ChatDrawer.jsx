import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { X, Send, Paperclip, Mic, MicOff, Image, FileText, Video, Loader2, Download, Play, Smile, SmilePlus, Sticker } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import TagLembreteButton from '@/components/radar/TagLembreteButton';

const TZ = 'America/Sao_Paulo';

function formatarDataHora(ts) {
  if (!ts) return '';
  const m = moment.utc(ts).tz(TZ);
  const agora = moment().tz(TZ);
  const inicioHoje = agora.clone().startOf('day');
  const inicioOntem = inicioHoje.clone().subtract(1, 'day');
  const inicioSemana = inicioHoje.clone().subtract(6, 'days');
  const hora = m.format('HH:mm');

  if (m.isSameOrAfter(inicioHoje)) return hora;
  if (m.isSameOrAfter(inicioOntem)) return `Ontem ${hora}`;
  if (m.isSameOrAfter(inicioSemana)) return `${m.format('dddd')} ${hora}`;
  return `${m.format('DD/MM')} ${hora}`;
}

export default function ChatDrawer({ chatId, chatName, clienteId, clienteNome, isGroup, onClose }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const stickerInputRef = useRef(null);
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

  // Reagir a uma mensagem
  const handleReaction = async (messageId, emoji) => {
    try {
      const res = await base44.functions.invoke('enviarReacaoWhatsApp', {
        chatId,
        messageId,
        reaction: emoji,
      });
      if (res.data?.success) {
        toast.success(`Reação ${emoji} enviada`);
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar reação');
      }
    } catch (e) {
      toast.error('Erro ao reagir: ' + (e.message || 'Desconhecido'));
    }
  };

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Enviar sticker (arquivo ou URL)
  const handleSendSticker = async (stickerUrl) => {
    if (!stickerUrl || enviando) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarStickerWhatsapp', {
        chatId,
        stickerUrl,
      });
      if (res.data?.success) {
        setStickerOpen(false);
        queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar sticker');
      }
    } catch (e) {
      toast.error('Erro ao enviar sticker: ' + (e.message || 'Desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  const handleStickerFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setEnviando(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      await handleSendSticker(uploadRes.file_url);
    } catch (e) {
      toast.error('Erro ao enviar sticker: ' + (e.message || 'Desconhecido'));
      setEnviando(false);
    }
  };

  // Stickers pré-definidos (URLs de emojis como sticker)
  const STICKER_PRESETS = [
    { emoji: '👍', url: 'https://em-content.zobj.net/thumbs/120/apple/325/thumbs-up_1f44d.png' },
    { emoji: '❤️', url: 'https://em-content.zobj.net/thumbs/120/apple/325/red-heart_2764-fe0f.png' },
    { emoji: '😂', url: 'https://em-content.zobj.net/thumbs/120/apple/325/face-with-tears-of-joy_1f602.png' },
    { emoji: '😍', url: 'https://em-content.zobj.net/thumbs/120/apple/325/smiling-face-with-heart-eyes_1f60d.png' },
    { emoji: '🙏', url: 'https://em-content.zobj.net/thumbs/120/apple/325/folded-hands_1f64f.png' },
    { emoji: '🔥', url: 'https://em-content.zobj.net/thumbs/120/apple/325/fire_1f525.png' },
    { emoji: '🎉', url: 'https://em-content.zobj.net/thumbs/120/apple/325/party-popper_1f389.png' },
    { emoji: '😢', url: 'https://em-content.zobj.net/thumbs/120/apple/325/crying-face_1f622.png' },
    { emoji: '😡', url: 'https://em-content.zobj.net/thumbs/120/apple/325/pouting-face_1f621.png' },
    { emoji: '🤔', url: 'https://em-content.zobj.net/thumbs/120/apple/325/thinking-face_1f914.png' },
    { emoji: '👏', url: 'https://em-content.zobj.net/thumbs/120/apple/325/clapping-hands_1f44f.png' },
    { emoji: '💪', url: 'https://em-content.zobj.net/thumbs/120/apple/325/flexed-biceps_1f4aa.png' },
  ];

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
          <div className="flex items-center gap-2">
            <TagLembreteButton
              grupoId={chatId}
              grupoNome={chatName || ''}
              clienteId={clienteId || ''}
              clienteNome={clienteNome || ''}
            />
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
          <div className="space-y-2">
            {loadingMsgs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : mensagens.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-12">Nenhuma mensagem ainda.</p>
            ) : (
              [...mensagens].reverse().map((m) => {
                const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
                const ts = m.received_at || m.timestamp_mensagem;
                const midiaUrl = m.midia_url;

                const renderContent = () => {
                  // Sticker
                  if (m.tipo_mensagem === 'sticker' && midiaUrl) {
                    return (
                      <div>
                        <img src={midiaUrl} alt="Sticker" className="max-w-[140px] max-h-[140px] object-contain" />
                      </div>
                    );
                  }
                  // Imagem
                  if (m.tipo_mensagem === 'imagem' && midiaUrl) {
                    return (
                      <div>
                        <img src={midiaUrl} alt="Imagem" className="rounded-lg max-w-full max-h-80 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(midiaUrl, '_blank')} />
                      </div>
                    );
                  }
                  // Vídeo
                  if (m.tipo_mensagem === 'video' && midiaUrl) {
                    return (
                      <div>
                        <video src={midiaUrl} controls className="rounded-lg max-w-full max-h-80" preload="metadata">
                          Seu navegador não suporta vídeo.
                        </video>
                      </div>
                    );
                  }
                  // Áudio
                  if (m.tipo_mensagem === 'audio' && midiaUrl) {
                    return (
                      <div>
                        <audio src={midiaUrl} controls className="w-full min-w-[200px] h-10" preload="metadata">
                          Seu navegador não suporta áudio.
                        </audio>
                      </div>
                    );
                  }
                  // Documento
                  if (m.tipo_mensagem === 'documento' && midiaUrl) {
                    const docName = m.midia_nome || 'Documento';
                    return (
                      <a href={midiaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group">
                        <div className="w-9 h-9 rounded-lg bg-slate-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{docName}</p>
                          <p className="text-[10px] text-slate-400">Clique para baixar</p>
                        </div>
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-white shrink-0" />
                      </a>
                    );
                  }
                  // Texto (fallback)
                  return <p className="whitespace-pre-wrap break-words">{m.mensagem || '[Sem conteúdo]'}</p>;
                };

                return (
                  <div key={m.id} className={`flex group ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isVoxx
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700'
                    }`}>
                      {m.citacao_texto && (
                        <div className={`mb-2 pl-3 py-1.5 rounded border-l-[3px] text-[11px] leading-tight ${
                          isVoxx
                            ? 'border-emerald-300/40 bg-emerald-700/40 text-emerald-100'
                            : 'border-blue-500/40 bg-slate-700/50 text-slate-300'
                        }`}>
                          {m.citacao_remetente && (
                            <p className={`font-semibold mb-0.5 ${isVoxx ? 'text-emerald-200' : 'text-blue-400'}`}>
                              {m.citacao_remetente}
                            </p>
                          )}
                          {m.citacao_tipo === 'imagem' && m.citacao_midia_url ? (
                            <div className="flex items-center gap-1.5">
                              <Image className="w-3 h-3 opacity-70" />
                              <span className="italic opacity-70">Imagem</span>
                            </div>
                          ) : m.citacao_tipo === 'video' ? (
                            <div className="flex items-center gap-1.5">
                              <Video className="w-3 h-3 opacity-70" />
                              <span className="italic opacity-70">Vídeo</span>
                            </div>
                          ) : m.citacao_tipo === 'audio' ? (
                            <span className="italic opacity-70">Mensagem de áudio</span>
                          ) : m.citacao_tipo === 'documento' ? (
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3 h-3 opacity-70" />
                              <span className="italic opacity-70 truncate">{m.citacao_texto}</span>
                            </div>
                          ) : m.citacao_tipo === 'sticker' ? (
                            <span className="italic opacity-70">Sticker</span>
                          ) : (
                            <p className="opacity-80 line-clamp-2">{m.citacao_texto}</p>
                          )}
                        </div>
                      )}
                      {!isVoxx && m.remetente_nome && (
                        <p className="text-[11px] font-medium text-blue-400 mb-1">{m.remetente_nome}</p>
                      )}
                      {isVoxx && m.remetente_nome && (
                        <p className="text-[11px] font-medium text-emerald-300 mb-1">{m.remetente_nome}</p>
                      )}
                      {renderContent()}
                      {/* Mostra legenda/caption abaixo da mídia se houver texto */}
                      {(m.tipo_mensagem === 'imagem' || m.tipo_mensagem === 'video') && m.mensagem && m.mensagem !== '[Imagem]' && m.mensagem !== '[Vídeo]' && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs opacity-90">{m.mensagem}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={`p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ${
                                isVoxx ? 'hover:bg-emerald-500/30' : 'hover:bg-slate-600'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SmilePlus className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side={isVoxx ? 'left' : 'right'}
                            align="end"
                            className="w-auto p-1.5 border border-slate-700 bg-slate-800 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex gap-0.5">
                              {REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-lg hover:bg-slate-700 transition-colors"
                                  onClick={() => handleReaction(m.message_id || m.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <p className={`text-[10px] ${isVoxx ? 'text-emerald-200' : 'text-slate-500'}`}>
                          {formatarDataHora(ts)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

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

            {/* Sticker */}
            <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
                  disabled={enviando}
                >
                  <Sticker className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-72 p-3 border border-slate-700 bg-slate-800 shadow-xl">
                <p className="text-[11px] text-slate-400 mb-2">Enviar sticker</p>
                {/* Grid de stickers pré-definidos */}
                <div className="grid grid-cols-6 gap-1.5 mb-3">
                  {STICKER_PRESETS.map((s) => (
                    <button
                      key={s.emoji}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-xl hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => handleSendSticker(s.url)}
                      disabled={enviando}
                      title={s.emoji}
                    >
                      <img src={s.url} alt={s.emoji} className="w-7 h-7 object-contain" />
                    </button>
                  ))}
                </div>
                {/* Upload de arquivo */}
                <input
                  type="file"
                  ref={stickerInputRef}
                  onChange={handleStickerFile}
                  className="hidden"
                  accept="image/webp,image/png"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => stickerInputRef.current?.click()}
                  disabled={enviando}
                >
                  <Paperclip className="w-3 h-3 mr-1.5" />
                  Enviar sticker do dispositivo
                </Button>
              </PopoverContent>
            </Popover>

            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0"
                  disabled={enviando}
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-0 border-0 shadow-2xl bg-transparent">
                <EmojiPicker
                  theme="dark"
                  onEmojiClick={(emojiData) => {
                    setMensagem(prev => prev + emojiData.emoji);
                    setEmojiOpen(false);
                  }}
                  width={320}
                  height={400}
                />
              </PopoverContent>
            </Popover>

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