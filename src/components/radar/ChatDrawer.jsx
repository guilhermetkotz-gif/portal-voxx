import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { X, Send, Paperclip, Mic, MicOff, Image, FileText, Video, Loader2, Download, Play, Smile, SmilePlus, Sticker, Trash2, Sun, Moon } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import TagLembreteButton from '@/components/radar/TagLembreteButton';
import { useChatTheme, chatTheme } from '@/hooks/useChatTheme';

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
  const { isLight, toggle: toggleTheme } = useChatTheme();
  const t = chatTheme(isLight);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [imagemColada, setImagemColada] = useState(null); // { file, previewUrl }
  const stickerInputRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Buscar mensagens do chat
  const { data: mensagens = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['chatMsgs', chatId],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMensagem.filter({ grupo_id: chatId }, '-received_at', 100);
      return msgs.filter(m => !m.deletado && m.tipo_mensagem !== 'sem_conteudo');
    },
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
    if (enviando) return;

    // Se tem imagem colada, envia a imagem (com texto opcional como legenda)
    if (imagemColada) {
      setEnviando(true);
      try {
        const uploadRes = await base44.integrations.Core.UploadFile({ file: imagemColada.file });
        const res = await base44.functions.invoke('enviarMensagemGeral', {
          chatId,
          tipo: 'imagem',
          mensagem: texto || '',
          midiaUrl: uploadRes.file_url,
          fileName: imagemColada.file.name || 'imagem.png',
          incluirAssinatura: false,
          clienteId: clienteId || '',
          clienteNome: clienteNome || '',
          chatName: chatName || '',
        });
        if (res.data?.success) {
          setMensagem('');
          setImagemColada(null);
          queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
          queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        } else {
          toast.error(res.data?.erro || 'Erro ao enviar imagem');
        }
      } catch (e) {
        toast.error('Erro ao enviar imagem: ' + (e.message || 'Desconhecido'));
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (!texto) return;
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

  // Colar imagem do clipboard — armazena preview, envia só ao clicar enviar
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const previewUrl = URL.createObjectURL(file);
        setImagemColada({ file, previewUrl });
        break;
      }
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

  // Excluir mensagem
  const handleDeleteMessage = async (m) => {
    const modo = await new Promise((resolve) => {
      const isLightTheme = localStorage.getItem('voxx_chat_theme') === 'light';
      const bg = isLightTheme ? '#ffffff' : '#1e293b';
      const border = isLightTheme ? '#e9edef' : '#334155';
      const textPrimary = isLightTheme ? '#111b21' : '#f1f5f9';
      const textSecondary = isLightTheme ? '#667781' : '#94a3b8';
      const textTertiary = isLightTheme ? '#8696a0' : '#64748b';
      const btnGhostBorder = isLightTheme ? '#e9edef' : '#475569';
      const btnGhostText = isLightTheme ? '#667781' : '#94a3b8';
      const shadow = isLightTheme ? '0 20px 60px rgba(0,0,0,0.15)' : '0 20px 60px rgba(0,0,0,0.5)';
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7)';
      div.innerHTML = `
        <div style="background:${bg};border:1px solid ${border};border-radius:16px;padding:24px;max-width:360px;width:90%;box-shadow:${shadow}">
          <p style="color:${textPrimary};font-size:15px;font-weight:600;margin:0 0 8px">Excluir mensagem?</p>
          <p style="color:${textSecondary};font-size:13px;margin:0 0 20px">Escolha como deseja excluir:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button id="del-todos" style="width:100%;padding:12px;border-radius:10px;border:none;background:#dc2626;color:white;font-size:13px;font-weight:600;cursor:pointer">🗑️ Excluir para todos</button>
            <button id="del-mim" style="width:100%;padding:10px;border-radius:10px;border:1px solid ${btnGhostBorder};background:transparent;color:${btnGhostText};font-size:12px;cursor:pointer">🙈 Ocultar só para mim</button>
            <button id="del-cancel" style="width:100%;padding:10px;border-radius:10px;border:none;background:transparent;color:${textTertiary};font-size:12px;cursor:pointer;margin-top:4px">Cancelar</button>
          </div>
        </div>`;
      document.body.appendChild(div);
      div.querySelector('#del-todos').onclick = () => { div.remove(); resolve('todos'); };
      div.querySelector('#del-mim').onclick = () => { div.remove(); resolve('para_mim'); };
      div.querySelector('#del-cancel').onclick = () => { div.remove(); resolve('cancelar'); };
      div.onclick = (e) => { if (e.target === div) { div.remove(); resolve('cancelar'); } };
    });
    if (modo === 'cancelar') return;

    try {
      const res = await base44.functions.invoke('deletarMensagemWhatsApp', {
        messageId: m.message_id,
        chatId,
        modo,
      });
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['chatMsgs', chatId] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        toast.success(modo === 'todos' ? 'Mensagem excluída para todos' : 'Mensagem ocultada');
      } else {
        toast.error(res.data?.erro || 'Erro ao excluir mensagem');
      }
    } catch (e) {
      toast.error('Erro ao excluir: ' + (e.message || 'Desconhecido'));
    }
  };

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
      <div className={`relative w-full max-w-lg ${t.bgPanel} ${t.border} border-l flex flex-col shadow-2xl`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.border} shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isGroup ? `${t.iconGreenBg} ${t.iconGreen}` : `${t.iconBlueBg} ${t.iconBlue}`}`}>
              {(chatName || chatId).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className={`text-sm font-bold ${t.textName}`}>{chatName || chatId}</h2>
              <p className={`text-[11px] ${t.textSecondary}`}>{isGroup ? 'Grupo' : 'Contato direto'}{clienteNome ? ` · ${clienteNome}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TagLembreteButton
              grupoId={chatId}
              grupoNome={chatName || ''}
              clienteId={clienteId || ''}
              clienteNome={clienteNome || ''}
            />
            <button onClick={toggleTheme} className={`p-1.5 ${t.textSecondary} ${t.textPrimary} ${t.bgHoverBtn} rounded-lg`} title={isLight ? 'Modo escuro' : 'Modo claro'}>
              {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className={`p-1.5 ${t.textSecondary} ${t.textPrimary} ${t.bgCloseBtnHover} rounded-lg`}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-3" ref={scrollRef}>
          <div className="space-y-2">
            {loadingMsgs ? (
              <div className="flex justify-center py-12">
                <Loader2 className={`w-5 h-5 animate-spin ${t.textTertiary}`} />
              </div>
            ) : mensagens.length === 0 ? (
              <p className={`text-center ${t.textTertiary} text-sm py-12`}>Nenhuma mensagem ainda.</p>
            ) : (
              [...mensagens].reverse().map((m) => {
                const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
                const ts = m.received_at || m.timestamp_mensagem;
                const midiaUrl = m.midia_url;

                const renderContent = () => {
                  // Sticker / Figurinha
                  if (m.tipo_mensagem === 'sticker') {
                    if (midiaUrl) {
                      return (
                        <div className="relative group/sticker inline-block">
                          <img src={midiaUrl} alt="Sticker" className="max-w-[140px] max-h-[140px] object-contain" />
                          <button
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 opacity-0 group-hover/sticker:opacity-100 hover:bg-black/70 transition-opacity"
                            onClick={() => { window.open(midiaUrl, '_blank'); }}
                            title="Salvar figurinha"
                          >
                            <Download className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      );
                    }
                    return <span className="text-xs italic opacity-60">[Sticker]</span>;
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
                  // Reação (tipo legado — se tiver texto do emoji)
                  if (m.tipo_mensagem === 'reacao') {
                    if (m.mensagem && m.mensagem !== '[Sem conteúdo]') {
                      return <span className="text-lg">{m.mensagem}</span>;
                    }
                    return <span className="text-xs italic opacity-40">Reação</span>;
                  }
                  // Texto (fallback)
                  return <p className="whitespace-pre-wrap break-words">{m.mensagem || '[Sem conteúdo]'}</p>;
                };

                return (
                  <div key={m.id} className={`flex group ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      isVoxx
                        ? `${t.bgBubbleOut} ${t.textBubbleOut} rounded-br-md`
                        : `${t.bgBubbleIn} ${t.textBubbleIn} rounded-bl-md border ${t.borderLight}`
                    }`}>
                      {m.citacao_texto && (
                        <div className={`mb-2 pl-3 py-1.5 rounded border-l-[3px] text-[11px] leading-tight ${
                          isVoxx
                            ? `${t.borderQuoteOut} ${t.bgQuoteOut} ${t.textQuoteOut}`
                            : `${t.borderQuoteIn} ${t.bgQuoteIn} ${t.textQuoteIn}`
                        }`}>
                          {m.citacao_remetente && (
                            <p className={`font-semibold mb-0.5 ${isVoxx ? t.textQuoteNameOut : t.textQuoteNameIn}`}>
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
                        <p className={`text-[11px] font-medium ${t.textNameIn} mb-1`}>{m.remetente_nome}</p>
                      )}
                      {isVoxx && m.remetente_nome && (
                        <p className={`text-[11px] font-medium ${t.textNameOut} mb-1`}>{m.remetente_nome}</p>
                      )}
                      {renderContent()}
                      {/* Mostra legenda/caption abaixo da mídia se houver texto */}
                      {(m.tipo_mensagem === 'imagem' || m.tipo_mensagem === 'video') && m.mensagem && m.mensagem !== '[Imagem]' && m.mensagem !== '[Vídeo]' && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs opacity-90">{m.mensagem}</p>
                      )}
                      {/* Reações */}
                      {m.reacoes && m.reacoes.length > 0 && (
                        <div className={`flex flex-wrap gap-0.5 mt-1.5 ${isVoxx ? 'justify-end' : ''}`}>
                          {/* Agrupar reações por emoji */}
                          {(() => {
                            const grupos = {};
                            m.reacoes.forEach(r => {
                              if (!grupos[r.emoji]) grupos[r.emoji] = { emoji: r.emoji, count: 0, remetentes: [] };
                              grupos[r.emoji].count++;
                              if (r.remetente) grupos[r.emoji].remetentes.push(r.remetente);
                            });
                            return Object.values(grupos).map((g, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${t.bgReaction} text-[11px] leading-none`}
                                title={g.remetentes.join(', ')}
                              >
                                <span className="text-xs">{g.emoji}</span>
                                {g.count > 1 && <span className="text-[10px] text-slate-400">{g.count}</span>}
                              </span>
                            ));
                          })()}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        {isVoxx && (
                          <button
                            className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/30 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(m); }}
                            title="Excluir mensagem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className={`p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ${
                                isVoxx ? 'hover:bg-emerald-500/30' : t.popoverHover
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SmilePlus className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side={isVoxx ? 'left' : 'right'}
                            align="end"
                            className={`w-auto p-1.5 border ${t.popoverBorder} ${t.popoverBg} shadow-xl`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex gap-0.5">
                              {REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full text-lg ${t.popoverHover} transition-colors`}
                                  onClick={() => handleReaction(m.message_id || m.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <p className={`text-[10px] ${isVoxx ? t.textTimestamp : t.textTimestampIn}`}>
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

        {/* Input WhatsApp-style */}
        <div className={`px-3 py-2 ${t.bgBarraInput} shrink-0`}>
          {gravando && (
            <div className={`flex items-center justify-center gap-2 py-2 mb-2 ${t.bgRecording} rounded-lg border ${t.borderRecording}`}>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 text-xs font-medium">Gravando áudio...</span>
            </div>
          )}
          {imagemColada && (
            <div className="mb-2 relative inline-block">
              <img src={imagemColada.previewUrl} alt="Preview" className={`max-h-32 rounded-lg border ${t.borderLight}`} />
              <button
                onClick={() => { URL.revokeObjectURL(imagemColada.previewUrl); setImagemColada(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Anexo + menu */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={`w-10 h-10 flex items-center justify-center rounded-full ${t.inputIconColor} hover:bg-black/5 transition-colors shrink-0`}
                  disabled={enviando}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className={`w-56 p-2 border ${t.popoverBorder} ${t.popoverBg} shadow-xl rounded-xl`}>
                <div className="space-y-0.5">
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`}
                    onClick={() => { fileInputRef.current?.click(); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Image className="w-4 h-4 text-blue-500" />
                    </div>
                    Fotos e vídeos
                  </button>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`}
                    onClick={() => { fileInputRef.current?.click(); }}
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-orange-500" />
                    </div>
                    Documento
                  </button>
                  <button
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`}
                    onClick={startRecording}
                    disabled={enviando || gravando}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-red-500" />
                    </div>
                    Áudio
                  </button>
                  
                  {/* Sticker */}
                  <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`}
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Sticker className="w-4 h-4 text-purple-500" />
                        </div>
                        Figurinha
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="right" align="start" className={`w-72 p-3 border ${t.popoverBorder} ${t.popoverBg} shadow-xl`}>
                      <p className={`text-[11px] ${t.textSecondary} mb-2`}>Enviar sticker</p>
                      <div className="grid grid-cols-6 gap-1.5 mb-3">
                        {STICKER_PRESETS.map((s) => (
                          <button
                            key={s.emoji}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg text-xl ${t.popoverHover} transition-colors`}
                            onClick={() => handleSendSticker(s.url)}
                            disabled={enviando}
                          >
                            <img src={s.url} alt={s.emoji} className="w-7 h-7 object-contain" />
                          </button>
                        ))}
                      </div>
                      <input type="file" ref={stickerInputRef} onChange={handleStickerFile} className="hidden" accept="image/webp,image/png" />
                      <Button variant="outline" size="sm" className={`w-full text-xs ${t.borderLight} ${t.textSecondary} ${t.bgHoverGhost}`} onClick={() => stickerInputRef.current?.click()} disabled={enviando}>
                        <Paperclip className="w-3 h-3 mr-1.5" /> Sticker do dispositivo
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </PopoverContent>
            </Popover>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            />

            {/* Campo de texto com emoji dentro */}
            <div className={`flex-1 flex items-center rounded-full ${t.bgCampoInput} border ${t.inputFieldBorder} shadow-sm`}>
              <Input
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Mensagem"
                className={`flex-1 border-0 bg-transparent ${t.textInput} ${t.textPlaceholder} text-sm h-10 px-4 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-full`}
                disabled={enviando}
              />
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={`w-10 h-10 flex items-center justify-center rounded-full ${t.inputIconColor} hover:bg-black/5 transition-colors shrink-0`}
                    disabled={enviando}
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-auto p-0 border-0 shadow-2xl bg-transparent">
                  <EmojiPicker
                    theme={t.emojiPickerTheme}
                    onEmojiClick={(emojiData) => {
                      setMensagem(prev => prev + emojiData.emoji);
                      setEmojiOpen(false);
                    }}
                    width={320}
                    height={400}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Microfone ou Enviar */}
            {gravando ? (
              <button
                className="w-10 h-10 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 shrink-0"
                onClick={stopRecording}
              >
                <MicOff className="w-5 h-5" />
              </button>
            ) : (mensagem.trim() || imagemColada) ? (
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-full text-white ${t.sendBtnBg} shrink-0 transition-colors`}
                onClick={handleSend}
                disabled={enviando}
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            ) : (
              <button
                className={`w-10 h-10 flex items-center justify-center rounded-full ${t.inputIconColor} hover:bg-black/5 transition-colors shrink-0`}
                onClick={startRecording}
                disabled={enviando}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}