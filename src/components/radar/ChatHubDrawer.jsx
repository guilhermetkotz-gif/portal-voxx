import React, { useState, useRef, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Send, Paperclip, Mic, MicOff, Search, Plus, Users, User, Loader2, Download, FileText, MessageCircle, Phone, Building2, Image, Video, FileAudio, Bell, AlertTriangle, Zap, Smile, SmilePlus, Sticker, Trash2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TagLembreteButton from '@/components/radar/TagLembreteButton';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import { calcularMinutosUteis, nivelAlerta } from '@/lib/minutosUteis';

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
  // Tenta múltiplos formatos de parse para máxima compatibilidade
  let m = null;
  try { m = moment.utc(ts, moment.ISO_8601); } catch (_) {}
  if (!m || !m.isValid()) {
    try { m = moment.utc(ts); } catch (_) {}
  }
  if (!m || !m.isValid()) {
    try { m = moment(ts); } catch (_) {}
  }
  if (!m || !m.isValid()) {
    const num = Number(ts);
    if (!isNaN(num) && num > 0) {
      try { m = moment(num); } catch (_) {}
    }
  }
  if (!m || !m.isValid()) return String(ts).slice(0, 16);
  try {
    m = m.tz(TZ);
    const agora = moment().tz(TZ);
    const inicioHoje = agora.clone().startOf('day');
    const inicioOntem = inicioHoje.clone().subtract(1, 'day');
    const inicioSemana = inicioHoje.clone().subtract(6, 'days');
    if (m.isSameOrAfter(inicioHoje)) return m.format('HH:mm');
    if (m.isSameOrAfter(inicioOntem)) return 'Ontem';
    if (m.isSameOrAfter(inicioSemana)) return m.format('dddd');
    return m.format('DD/MM');
  } catch (_) { return String(ts).slice(0, 16); }
}

// ── Helpers seguros para comparação de timestamps ───────────
function getMensagemTs(msg) {
  return msg.received_at || msg.timestamp_mensagem || msg.sent_at || msg.created_at || msg.created_date || msg.updated_at;
}

function getTimestampSeguro(msg) {
  const ts = getMensagemTs(msg);
  if (!ts) return null;
  const m = moment.utc(ts);
  return m.isValid() ? m.valueOf() : null;
}

function previewMensagem(m) {
  if (m.tipo_mensagem === 'texto') {
    const txt = (m.mensagem || '').substring(0, 60);
    return txt + (txt.length >= 60 ? '...' : '');
  }
  const map = { imagem: '📷 Imagem', video: '🎬 Vídeo', audio: '🎤 Áudio', documento: '📎 Documento' };
  return map[m.tipo_mensagem] || '';
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const stickerInputRef = useRef(null);

  // ── Dados ─────────────────────────────────────────────────
  // Compartilha cache com RadarWhatsApp para alertas em tempo real
  const { data: grupos = [] } = useQuery({
    queryKey: ['radarGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-ultima_atividade', 200),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const { data: mensagensRecentes = [] } = useQuery({
    queryKey: ['radarMensagens'],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMensagem.list('-received_at', 500);
      return msgs.filter(m => !m.deletado);
    },
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  // ── Última mensagem por conversa (cobre TODAS, não só as 500 recentes) ──
  const { data: ultimaMsgPorChat = {} } = useQuery({
    queryKey: ['chatHubUltimaMsgPorChat'],
    queryFn: async () => {
      const todas = await base44.entities.WhatsappMensagem.list('-received_at', 2000);
      const mapa = {};
      todas.forEach(m => {
        if (!m.grupo_id) return;
        const tsMillis = getTimestampSeguro(m);
        if (tsMillis === null) return;
        const existing = mapa[m.grupo_id];
        if (!existing || tsMillis > existing.tsMillis) {
          mapa[m.grupo_id] = { ts: getMensagemTs(m), tsMillis, preview: previewMensagem(m) };
        }
      });
      return mapa;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['chatHubClientes'],
    queryFn: () => base44.entities.Cliente.list('-nome', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Tags ativas para indicador na lista
  const { data: tagsAtivas = [] } = useQuery({
    queryKey: ['chatHubTagsAtivas'],
    queryFn: () => base44.entities.TagConversa.filter({ status: 'ativa' }, '-created_date', 200),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const tagsAtivasMap = useMemo(() => {
    const map = {};
    tagsAtivas.forEach(t => { if (t.grupo_id) map[t.grupo_id] = t; });
    return map;
  }, [tagsAtivas]);

  // ── Mensagens do chat selecionado ─────────────────────────
  const { data: msgsChat = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['chatHubMsgs', selectedChat?.id],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMensagem.filter({ grupo_id: selectedChat?.id }, '-received_at', 100);
      return msgs.filter(m => !m.deletado);
    },
    enabled: !!selectedChat?.id,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });

  // ── Construir lista de conversas ──────────────────────────
  const conversas = useMemo(() => {
    const agora = moment().tz(TZ);
    const map = {};

    // Grupos (ultima_atividade como fallback, mensagens vão sobrescrever)
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
        _ultimaAtividade: g.ultima_atividade || null, // fallback de ordenação
        unreadCount: 0,
      };
    });

    // Mensagens diretas (não grupo)
    const directMsgs = mensagensRecentes.filter(m => !m.is_group && m.grupo_id);
    directMsgs.forEach(m => {
      const id = m.grupo_id;
      if (map[id]) return; // já existe como grupo
      const ts = m.received_at || m.timestamp_mensagem;
      map[id] = {
        id,
        name: m.grupo_nome || m.remetente_nome || id,
        isGroup: false,
        clienteId: m.cliente_id || '',
        clienteNome: m.cliente_nome || '',
        statusVinculo: 'nao_vinculado',
        lastMessage: '',
        lastMessageAt: ts || null,
        _ultimaAtividade: ts || null,
        unreadCount: 0,
      };
    });

    // Preencher lastMessageAt a partir de mensagens (prioridade absoluta sobre ultima_atividade)
    // Como mensagensRecentes já vem ordenado por -received_at, a primeira é a mais recente
    mensagensRecentes.forEach(m => {
      const cid = m.grupo_id;
      if (!cid || !map[cid]) return;
      const ts = m.received_at || m.timestamp_mensagem;
      if (ts && !map[cid]._temMensagem) {
        map[cid]._temMensagem = true;
        map[cid].lastMessageAt = ts; // sempre usa timestamp da mensagem, ignora ultima_atividade
        const preview = m.tipo_mensagem === 'texto' ? (m.mensagem || '') : 
                        m.tipo_mensagem === 'imagem' ? '📷 Imagem' :
                        m.tipo_mensagem === 'video' ? '🎬 Vídeo' :
                        m.tipo_mensagem === 'audio' ? '🎤 Áudio' :
                        m.tipo_mensagem === 'documento' ? '📎 Documento' : '';
        map[cid].lastMessage = preview.substring(0, 60) + (preview.length > 60 ? '...' : '');
      }
    });

    // Fallback: ultimaMsgPorChat cobre conversas sem mensagem no lote de 500
    Object.entries(ultimaMsgPorChat).forEach(([cid, data]) => {
      if (map[cid] && !map[cid]._temMensagem && data.ts) {
        map[cid].lastMessageAt = data.ts;
        map[cid].lastMessage = map[cid].lastMessage || data.preview || '';
      }
    });

    // Calcular não lidas e ordenar (sem tsLabel — será computado no render)
    return Object.values(map).map(c => {
      const msgs = mensagensRecentes.filter(m => m.grupo_id === c.id);
      const ultimaVoxx = msgs.filter(m => m.remetente_tipo === 'voxx' || m.origem === 'enviada')
        .sort((a, b) => (b.received_at || '').localeCompare(a.received_at || ''))[0];
      const unreadCount = msgs.filter(m =>
        (m.remetente_tipo === 'cliente' || m.origem === 'recebida') &&
        (!ultimaVoxx || (m.received_at || m.timestamp_mensagem) > (ultimaVoxx.received_at || ultimaVoxx.timestamp_mensagem))
      ).length;
      return { ...c, unreadCount };
    }).sort((a, b) => {
      const tsA = getTimestampSeguro({ received_at: a.lastMessageAt || a._ultimaAtividade });
      const tsB = getTimestampSeguro({ received_at: b.lastMessageAt || b._ultimaAtividade });
      if (tsA === null && tsB === null) return 0;
      if (tsA === null) return 1;
      if (tsB === null) return -1;
      return tsB - tsA;
    });
  }, [grupos, mensagensRecentes, ultimaMsgPorChat]);

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

    if (filtroTab === 'aguard_retorno') {
      result = result.filter(c => tagsAtivasMap[c.id]);
    }

    return result;
  }, [conversas, search, filtroTab, mensagensRecentes, user, tagsAtivasMap]);

  // ── Alertas de tempo de resposta (mesma lógica do Radar WhatsApp) ─────
  const alertasPorConversa = useMemo(() => {
    const agora = moment().tz(TZ);
    const ignorarTipos = ['sistema', 'atividade', 'sem_conteudo'];
    const map = {};

    // Índice de mensagens por grupo_id
    const msgsPorGrupo = {};
    mensagensRecentes.forEach(m => {
      const gId = m.grupo_id;
      if (!gId) return;
      if (!msgsPorGrupo[gId]) msgsPorGrupo[gId] = [];
      msgsPorGrupo[gId].push(m);
    });

    // Itera sobre todos os grupos (não sobre conversas — garante cobertura total)
    grupos.forEach(g => {
      const gId = g.grupo_id;
      if (!gId) return;
      const msgs = msgsPorGrupo[gId] || [];
      
      const ultimaClienteValida = msgs
        .filter(m => (m.remetente_tipo === 'cliente' || m.origem === 'recebida') && !ignorarTipos.includes(m.tipo_mensagem))
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;
      
      const ultimaVoxxValida = msgs
        .filter(m => (m.remetente_tipo === 'voxx' || m.origem === 'enviada') && !ignorarTipos.includes(m.tipo_mensagem))
        .sort((a, b) => (b.received_at > a.received_at ? 1 : -1))[0] || null;
      
      if (ultimaClienteValida) {
        const tsCliente = ultimaClienteValida.received_at;
        const tsVoxx = ultimaVoxxValida?.received_at;
        if (!tsVoxx || tsCliente > tsVoxx) {
          const minutos = calcularMinutosUteis(tsCliente, agora.toISOString());
          const nivel = nivelAlerta(minutos);
          if (nivel) {
            map[gId] = { nivel, minutos };
          }
        }
      }
    });

    return map;
  }, [grupos, mensagensRecentes]);

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
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
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
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
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
            queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
            queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
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

  // Reagir a uma mensagem
  const handleReaction = async (messageId, emoji) => {
    if (!selectedChat) return;
    try {
      const res = await base44.functions.invoke('enviarReacaoWhatsApp', {
        chatId: selectedChat.id,
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

  const handleDeleteMessage = async (m) => {
    if (!selectedChat) return;
    const modo = await new Promise((resolve) => {
      const confirmed = window.confirm('Excluir mensagem?\n\nOK = Excluir para todos\nCancelar = Apenas para mim');
      resolve(confirmed ? 'todos' : 'para_mim');
    });

    try {
      const res = await base44.functions.invoke('deletarMensagemWhatsApp', {
        messageId: m.message_id,
        chatId: selectedChat.id,
        modo,
      });
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
        toast.success(modo === 'todos' ? 'Mensagem excluída para todos' : 'Mensagem ocultada');
      } else {
        toast.error(res.data?.erro || 'Erro ao excluir mensagem');
      }
    } catch (e) {
      toast.error('Erro ao excluir: ' + (e.message || 'Desconhecido'));
    }
  };

  // Enviar sticker
  const handleSendSticker = async (stickerUrl) => {
    if (!stickerUrl || enviando || !selectedChat) return;
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('enviarStickerWhatsapp', {
        chatId: selectedChat.id,
        stickerUrl,
      });
      if (res.data?.success) {
        setStickerOpen(false);
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
              {['todas', 'naolidas', 'minhas', 'aguard_retorno'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFiltroTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTab === tab
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab === 'todas' ? 'Todas' : tab === 'naolidas' ? 'Não lidas' : tab === 'minhas' ? 'Minhas' : <Bell className="w-3.5 h-3.5" />}
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
          <div className="flex-1 overflow-y-auto">
            {conversasFiltradas.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-12">Nenhuma conversa encontrada.</p>
            ) : (
              conversasFiltradas.map(c => {
                const isSelected = selectedChat?.id === c.id;

                const tsRaw = c.lastMessageAt || c._ultimaAtividade || ultimaMsgPorChat[c.id]?.ts;
                const horarioLateral = formatarDataConversa(tsRaw);
                const horarioCompletoLateral = formatarDataHora(tsRaw);

                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChat(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-slate-800' : ''
                    } ${
                      (() => {
                        const alerta = alertasPorConversa[c.id];
                        if (alerta?.nivel === 'emergencial') return 'border-l-2 border-l-red-500';
                        if (alerta?.nivel === 'critico') return 'border-l-2 border-l-orange-500';
                        if (alerta?.nivel === 'alerta') return 'border-l-2 border-l-yellow-500';
                        if (alerta?.nivel === 'alarme') return 'border-l-2 border-l-amber-500';
                        if (isSelected) return 'border-l-2 border-l-emerald-500';
                        return '';
                      })()
                    }`}
                  >
                    {/* Linha 1: Nome + Horário */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                        {c.name}
                        {(() => {
                          const alerta = alertasPorConversa[c.id];
                          if (alerta?.nivel === 'emergencial') return <Zap className="w-3 h-3 text-red-400 shrink-0" title={`Sem resposta há ${alerta.minutos}min`} />;
                          if (alerta?.nivel === 'critico') return <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" title={`Sem resposta há ${alerta.minutos}min`} />;
                          if (alerta?.nivel === 'alerta') return <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" title={`Sem resposta há ${alerta.minutos}min`} />;
                          if (alerta?.nivel === 'alarme') return <Bell className="w-3 h-3 text-amber-400 shrink-0" title={`Sem resposta há ${alerta.minutos}min`} />;
                          return null;
                        })()}
                        {tagsAtivasMap[c.id] && !alertasPorConversa[c.id] && (
                          <Bell className="w-3 h-3 text-amber-400 shrink-0" title="AGUARD. RETORNO" />
                        )}
                      </p>
                      <span
                        className={`shrink-0 text-[11px] font-medium whitespace-nowrap leading-none ml-auto ${
                          c.unreadCount > 0 ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                        title={horarioCompletoLateral || ''}
                      >
                        {horarioLateral || ''}
                      </span>
                    </div>

                    {/* Linha 2: Preview + Badge não lidas */}
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400 truncate flex-1 min-w-0">
                        {c.lastMessage || (c.isGroup ? 'Grupo' : 'Contato')}
                      </p>
                      {c.unreadCount > 0 && (
                        <div className="bg-emerald-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center shrink-0">
                          {c.unreadCount > 99 ? '99+' : c.unreadCount}
                        </div>
                      )}
                    </div>

                    {/* Linha 3: Cliente + ícone */}
                    {c.clienteNome && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          c.isGroup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {c.isGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        </div>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-slate-700 text-slate-400 max-w-[180px] truncate">
                          {c.clienteNome}
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
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
                  <TagLembreteButton
                  grupoId={selectedChat.id}
                  grupoNome={selectedChat.name || ''}
                  clienteId={selectedChat.clienteId || ''}
                  clienteNome={selectedChat.clienteNome || ''}
                  />
              </div>

              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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
                        // Sticker
                        if (m.tipo_mensagem === 'sticker' && midiaUrl) {
                          return <img src={midiaUrl} alt="Sticker" className="max-w-[140px] max-h-[140px] object-contain" />;
                        }
                        // Imagem
                        if (m.tipo_mensagem === 'imagem') {
                          if (midiaUrl) {
                            return <img src={midiaUrl} alt="Imagem" className="rounded-lg max-w-full max-h-80 object-cover cursor-pointer" onClick={() => window.open(midiaUrl, '_blank')} />;
                          }
                          return (
                            <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                              <Image className="w-5 h-5 text-slate-400" />
                              <span className="text-xs text-slate-400">Imagem</span>
                            </div>
                          );
                        }
                        // Vídeo
                        if (m.tipo_mensagem === 'video') {
                          if (midiaUrl) {
                            return <video src={midiaUrl} controls className="rounded-lg max-w-full max-h-80" preload="metadata" />;
                          }
                          return (
                            <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                              <Video className="w-5 h-5 text-slate-400" />
                              <span className="text-xs text-slate-400">Vídeo</span>
                            </div>
                          );
                        }
                        // Áudio
                        if (m.tipo_mensagem === 'audio') {
                          if (midiaUrl) {
                            return <audio src={midiaUrl} controls className="w-full min-w-[200px] h-10" preload="metadata" />;
                          }
                          return (
                            <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                              <FileAudio className="w-5 h-5 text-slate-400" />
                              <span className="text-xs text-slate-400">Áudio</span>
                            </div>
                          );
                        }
                        // Documento
                        if (m.tipo_mensagem === 'documento') {
                          if (midiaUrl) {
                            return (
                              <a href={midiaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 bg-slate-700/50 rounded-lg hover:bg-slate-700">
                                <FileText className="w-4 h-4 text-slate-300" />
                                <span className="text-xs truncate">{m.midia_nome || 'Documento'}</span>
                                <Download className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
                              </a>
                            );
                          }
                          return (
                            <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                              <FileText className="w-5 h-5 text-slate-400" />
                              <span className="text-xs text-slate-400">Documento</span>
                            </div>
                          );
                        }
                        const textoLimpo = (m.mensagem || '').replace(/\n*— [^\n]+ \| Voxx\n*$/, '').trim();
                        return <p className="whitespace-pre-wrap break-words">{textoLimpo || '[Sem conteúdo]'}</p>;
                      };

                      return (
                        <div key={m.id} className={`flex group ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                            isVoxx ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-slate-800 text-slate-200 rounded-bl-md border border-slate-700'
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
                            {(m.tipo_mensagem === 'imagem' || m.tipo_mensagem === 'video') && m.mensagem && m.mensagem !== '[Imagem]' && m.mensagem !== '[Vídeo]' && (
                              <p className="mt-1.5 whitespace-pre-wrap break-words text-xs opacity-90">{m.mensagem}</p>
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
                  
                  {/* Sticker */}
                  <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0" disabled={enviando}>
                        <Sticker className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-72 p-3 border border-slate-700 bg-slate-800 shadow-xl">
                      <p className="text-[11px] text-slate-400 mb-2">Enviar sticker</p>
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
                      <input type="file" ref={stickerInputRef} onChange={handleStickerFile} className="hidden" accept="image/webp,image/png" />
                      <Button variant="outline" size="sm" className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-700" onClick={() => stickerInputRef.current?.click()} disabled={enviando}>
                        <Paperclip className="w-3 h-3 mr-1.5" />
                        Enviar sticker do dispositivo
                      </Button>
                    </PopoverContent>
                  </Popover>

                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={enviando}>
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  {/* Emoji Picker */}
                  <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700 shrink-0" disabled={enviando}>
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