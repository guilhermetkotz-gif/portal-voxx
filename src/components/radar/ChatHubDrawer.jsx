import React, { useState, useRef, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Send, Paperclip, Mic, MicOff, Search, Plus, Users, User, Loader2, Download, FileText, MessageCircle, Phone, Building2 } from 'lucide-react';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';

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

function formatarDataRelativa(ts) {
  if (!ts) return null;
  const m = moment.utc(ts).tz(TZ);
  if (!m.isValid()) return null;
  const agora = moment().tz(TZ);
  const inicioHoje = agora.clone().startOf('day');
  const inicioOntem = inicioHoje.clone().subtract(1, 'day');
  const inicioSemana = inicioHoje.clone().subtract(6, 'days');

  if (m.isSameOrAfter(inicioHoje)) return m.format('HH:mm');
  if (m.isSameOrAfter(inicioOntem)) return 'Ontem';
  if (m.isSameOrAfter(inicioSemana)) return m.format('dddd');
  return m.format('DD/MM');
}

function formatarDataConversa(ts) {
  if (!ts) return '';
  try {
    const m = moment.utc(ts).tz(TZ);
    if (!m.isValid()) return '';
    const agora = moment().tz(TZ);
    const inicioHoje = agora.clone().startOf('day');
    const inicioOntem = inicioHoje.clone().subtract(1, 'day');
    const inicioSemana = inicioHoje.clone().subtract(6, 'days');
    if (m.isSameOrAfter(inicioHoje)) return m.format('HH:mm');
    if (m.isSameOrAfter(inicioOntem)) return 'Ontem';
    if (m.isSameOrAfter(inicioSemana)) return m.format('dddd');
    return m.format('DD/MM');
  } catch (_) { return ''; }
}

export default function ChatHubDrawer({ onClose, user }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filtroTab, setFiltroTab] = useState('todas'); // todas | naolidas | minhas
  const [selectedChat, setSelectedChat] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [showNovaConversa, setShowNovaConversa] = useState(false);
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoClienteId, setNovoClienteId] = useState('');
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ── Dados ─────────────────────────────────────────────────
  const { data: grupos = [] } = useQuery({
    queryKey: ['chatHubGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-ultima_atividade', 200),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: mensagensRecentes = [] } = useQuery({
    queryKey: ['chatHubMsgsRecentes'],
    queryFn: () => base44.entities.WhatsappMensagem.list('-received_at', 500),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['chatHubClientes'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  // ── Mensagens do chat selecionado ─────────────────────────
  const { data: msgsChat = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['chatHubMsgs', selectedChat?.id],
    queryFn: () => base44.entities.WhatsappMensagem.filter({ grupo_id: selectedChat?.id }, '-received_at', 100),
    enabled: !!selectedChat?.id,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });

  // ── Construir lista de conversas ──────────────────────────
  const conversas = useMemo(() => {
    const agora = moment().tz(TZ);
    const map = {};

    // Grupos
    grupos.forEach(g => {
      const id = g.grupo_id;
      if (!id) return;
      map[id] = {
        id,
        name: g.nome_grupo || g.grupo_id,
        isGroup: true,
        clienteId: g.cliente_id || '',
        clienteNome: g.cliente_nome || '',
        statusVinculo: g.status_vinculo,
        lastMessage: '',
        lastMessageAt: g.ultima_atividade || null,
        lastMessageLabel: formatarDataConversa(g.ultima_atividade || null),
        unreadCount: 0,
      };
    });

    // Mensagens diretas (não grupo)
    const directMsgs = mensagensRecentes.filter(m => !m.is_group && m.grupo_id);
    directMsgs.forEach(m => {
      const id = m.grupo_id;
      if (map[id]) return; // já existe como grupo
      if (!map[id]) {
        map[id] = {
          id,
          name: m.grupo_nome || m.remetente_nome || id,
          isGroup: false,
          clienteId: m.cliente_id || '',
          clienteNome: m.cliente_nome || '',
          statusVinculo: 'nao_vinculado',
          lastMessage: '',
          lastMessageAt: null,
          lastMessageLabel: '',
          unreadCount: 0,
        };
      }
    });

    // Última mensagem por conversa
    mensagensRecentes.forEach(m => {
      const cid = m.grupo_id;
      if (!cid || !map[cid]) return;
      const ts = m.received_at || m.timestamp_mensagem;
      if (!map[cid].lastMessageAt || ts > map[cid].lastMessageAt) {
        map[cid].lastMessageAt = ts;
        map[cid].lastMessageLabel = formatarDataConversa(ts);
        const preview = m.tipo_mensagem === 'texto' ? (m.mensagem || '') : 
                        m.tipo_mensagem === 'imagem' ? '📷 Imagem' :
                        m.tipo_mensagem === 'video' ? '🎬 Vídeo' :
                        m.tipo_mensagem === 'audio' ? '🎤 Áudio' :
                        m.tipo_mensagem === 'documento' ? '📎 Documento' : '';
        map[cid].lastMessage = preview.substring(0, 60) + (preview.length > 60 ? '...' : '');
      }
    });

    // Calcular não lidas e ordenar
    return Object.values(map).map(c => {
      const msgs = mensagensRecentes.filter(m => m.grupo_id === c.id);
      const ultimaVoxx = msgs.filter(m => m.remetente_tipo === 'voxx' || m.origem === 'enviada')
        .sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''))[0];
      const unreadCount = msgs.filter(m =>
        (m.remetente_tipo === 'cliente' || m.origem === 'recebida') &&
        (!ultimaVoxx || (m.received_at || m.timestamp_mensagem) > (ultimaVoxx.received_at || ultimaVoxx.timestamp_mensagem))
      ).length;
      return { ...c, unreadCount };
    }).sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  }, [grupos, mensagensRecentes]);

  // ── Filtrar conversas ─────────────────────────────────────
  const conversasFiltradas = useMemo(() => {
    let result = conversas;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(s) || c.clienteNome.toLowerCase().includes(s));
    }

    const agoraMin = moment().tz(TZ).subtract(24, 'hours');
    if (filtroTab === 'naolidas') {
      result = result.filter(c => {
        const msgs = mensagensRecentes.filter(m => m.grupo_id === c.id);
        const ultimaCliente = msgs.filter(m => m.remetente_tipo === 'cliente' || m.origem === 'recebida')
          .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0];
        const ultimaVoxx = msgs.filter(m => m.remetente_tipo === 'voxx' || m.origem === 'enviada')
          .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0];
        if (!ultimaCliente) return false;
        if (!ultimaVoxx) return true;
        return ultimaCliente.received_at > ultimaVoxx.received_at;
      });
    }

    if (filtroTab === 'minhas') {
      const userEmail = user?.email || '';
      result = result.filter(c => {
        return mensagensRecentes.some(m => 
          m.grupo_id === c.id && 
          (m.remetente_tipo === 'voxx' || m.origem === 'enviada') &&
          m.remetente_nome === (user?.full_name || userEmail)
        );
      });
    }

    return result;
  }, [conversas, search, filtroTab, mensagensRecentes, user]);

  // ── Envio ─────────────────────────────────────────────────
  const handleSend = async () => {
    const texto = mensagem.trim();
    if (!texto || enviando || !selectedChat) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: selectedChat.id,
        mensagem: texto,
        tipo: 'texto',
        incluirAssinatura: true,
        clienteId: selectedChat.clienteId || '',
        clienteNome: selectedChat.clienteNome || '',
        chatName: selectedChat.name || '',
      });
      if (res.data?.success) {
        setMensagem('');
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgsRecentes'] });
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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    e.target.value = '';
    setEnviando(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      let tipo = 'documento';
      if (file.type.startsWith('image/')) tipo = 'imagem';
      else if (file.type.startsWith('video/')) tipo = 'video';

      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: selectedChat.id,
        tipo,
        midiaUrl: uploadRes.file_url,
        fileName: file.name,
        incluirAssinatura: false,
        clienteId: selectedChat.clienteId || '',
        clienteNome: selectedChat.clienteNome || '',
        chatName: selectedChat.name || '',
      });
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgsRecentes'] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar arquivo');
      }
    } catch (e) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setEnviando(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setGravando(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100 || !selectedChat) return;
        setEnviando(true);
        try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
          const res = await base44.functions.invoke('enviarMensagemGeral', {
            chatId: selectedChat.id,
            tipo: 'audio',
            midiaUrl: uploadRes.file_url,
            fileName: 'audio.webm',
            incluirAssinatura: false,
            clienteId: selectedChat.clienteId || '',
            clienteNome: selectedChat.clienteNome || '',
            chatName: selectedChat.name || '',
          });
          if (res.data?.success) {
            queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
            queryClient.invalidateQueries({ queryKey: ['chatHubMsgsRecentes'] });
            queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
          }
        } catch (e) {
          toast.error('Erro ao enviar áudio');
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

  // ── Nova conversa direta ──────────────────────────────────
  const handleNovaConversa = () => {
    const tel = novoTelefone.replace(/\D/g, '');
    if (!tel || tel.length < 8) { toast.error('Telefone inválido'); return; }
    const chatId = tel.includes('@') ? tel : `${tel}@c.us`;
    const clienteSelecionado = clientes.find(c => c.id === novoClienteId);
    setSelectedChat({
      id: chatId,
      name: novoNome || tel,
      isGroup: false,
      clienteId: novoClienteId || '',
      clienteNome: clienteSelecionado?.nome || '',
    });
    setShowNovaConversa(false);
    setNovoTelefone('');
    setNovoNome('');
    setNovoClienteId('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const viewport = scrollRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [msgsChat]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full h-full bg-slate-950 flex shadow-2xl">

        {/* ── Painel Esquerdo: Lista de Conversas ── */}
        <div className="w-80 lg:w-96 shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/80">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white">Mensagens</h2>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className="bg-slate-800 border-slate-700 text-slate-100 pl-9 placeholder:text-slate-500 rounded-xl text-sm h-9"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {['todas', 'naolidas', 'minhas'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFiltroTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTab === tab
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab === 'todas' ? 'Todas' : tab === 'naolidas' ? 'Não lidas' : 'Minhas'}
                </button>
              ))}
              <div className="flex-1" />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={() => setShowNovaConversa(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Lista */}
          <ScrollArea className="flex-1">
            {conversasFiltradas.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-12">Nenhuma conversa encontrada.</p>
            ) : (
              conversasFiltradas.map(c => {
                const isSelected = selectedChat?.id === c.id;

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChat(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-slate-800 border-l-2 border-l-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                        c.isGroup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {c.isGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {c.lastMessage || (c.isGroup ? 'Grupo' : 'Contato')}
                        </p>
                        {c.clienteNome && (
                          <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5 border-slate-700 text-slate-400 w-fit">
                            {c.clienteNome}
                          </Badge>
                        )}
                      </div>
                      <div className="shrink-0 min-w-[48px] flex flex-col items-end gap-1">
                        <span className="text-[11px] text-emerald-400 font-medium whitespace-nowrap">{c.lastMessageLabel || ''}</span>
                        {c.unreadCount > 0 && (
                          <div className="bg-emerald-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                            {c.unreadCount > 99 ? '99+' : c.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* ── Painel Direito: Chat ── */}
        <div className="flex-1 flex flex-col bg-slate-950">
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Selecione uma conversa para começar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    selectedChat.isGroup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {selectedChat.isGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedChat.name}</h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedChat.isGroup ? 'Grupo' : 'Contato direto'}
                      {selectedChat.clienteNome ? ` · ${selectedChat.clienteNome}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div ref={scrollRef} className="space-y-2">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
                  ) : msgsChat.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-12">Nenhuma mensagem ainda.</p>
                  ) : (
                    [...msgsChat].reverse().map((m) => {
                      const isVoxx = m.remetente_tipo === 'voxx' || m.origem === 'enviada' || m.from_me;
                      const ts = m.received_at || m.timestamp_mensagem;
                      const midiaUrl = m.midia_url;

                      const renderContent = () => {
                        if (m.tipo_mensagem === 'imagem' && midiaUrl) {
                          return <img src={midiaUrl} alt="Imagem" className="rounded-lg max-w-full max-h-80 object-cover cursor-pointer" onClick={() => window.open(midiaUrl, '_blank')} />;
                        }
                        if (m.tipo_mensagem === 'video' && midiaUrl) {
                          return <video src={midiaUrl} controls className="rounded-lg max-w-full max-h-80" preload="metadata" />;
                        }
                        if (m.tipo_mensagem === 'audio' && midiaUrl) {
                          return <audio src={midiaUrl} controls className="w-full min-w-[200px] h-10" preload="metadata" />;
                        }
                        if (m.tipo_mensagem === 'documento' && midiaUrl) {
                          return (
                            <a href={midiaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 bg-slate-700/50 rounded-lg hover:bg-slate-700">
                              <FileText className="w-4 h-4 text-slate-300" />
                              <span className="text-xs truncate">{m.midia_nome || 'Documento'}</span>
                              <Download className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
                            </a>
                          );
                        }
                        return <p className="whitespace-pre-wrap break-words">{m.mensagem || '[Sem conteúdo]'}</p>;
                      };

                      return (
                        <div key={m.id} className={`flex ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isVoxx ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700'
                          }`}>
                            {!isVoxx && m.remetente_nome && (
                              <p className="text-[11px] font-medium text-blue-400 mb-1">{m.remetente_nome}</p>
                            )}
                            {isVoxx && m.remetente_nome && (
                              <p className="text-[11px] font-medium text-emerald-300 mb-1">{m.remetente_nome}</p>
                            )}
                            {renderContent()}
                            {(m.tipo_mensagem === 'imagem' || m.tipo_mensagem === 'video') && m.mensagem && m.mensagem !== '[Imagem]' && m.mensagem !== '[Vídeo]' && (
                              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs opacity-90">{m.mensagem}</p>
                            )}
                            <p className={`text-[10px] mt-1 ${isVoxx ? 'text-emerald-200' : 'text-slate-500'}`}>
                              {formatarDataHora(ts)}
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
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={enviando}>
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  {gravando ? (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-300 shrink-0" onClick={stopRecording}>
                      <MicOff className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0" onClick={startRecording} disabled={enviando}>
                      <Mic className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="flex-1 relative">
                    <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite sua mensagem..." className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 pr-10 rounded-xl text-sm min-h-[36px]" disabled={enviando} />
                  </div>
                  <Button size="icon" className="h-9 w-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shrink-0" onClick={handleSend} disabled={!mensagem.trim() || enviando}>
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Modal: Nova Conversa ── */}
        {showNovaConversa && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowNovaConversa(false)} />
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">Nova Conversa</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Número do WhatsApp</label>
                  <Input
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="bg-slate-800 border-slate-700 text-slate-100 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Vincular a um cliente (opcional)</label>
                  <Select value={novoClienteId || undefined} onValueChange={(v) => setNovoClienteId(v === 'none' ? '' : v)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <SelectValue placeholder="Selecionar cliente..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                      <SelectItem value="none" className="text-slate-400">Nenhum (contato sem vínculo)</SelectItem>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-slate-300">{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nome do contato (opcional)</label>
                  <Input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Nome"
                    className="bg-slate-800 border-slate-700 text-slate-100 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={() => { setShowNovaConversa(false); setNovoClienteId(''); }} className="text-slate-400">Cancelar</Button>
                <Button onClick={handleNovaConversa} className="bg-emerald-600 hover:bg-emerald-500">
                  <Phone className="w-4 h-4 mr-2" /> Iniciar Chat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}