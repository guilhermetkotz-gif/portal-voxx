import React, { useState, useRef, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Send, Paperclip, Mic, MicOff, Search, Plus, Users, User, Loader2, Download, FileText, MessageCircle, Phone, Building2, Image, Video, FileAudio, Bell, AlertTriangle, Zap, Smile, SmilePlus, Sticker, Trash2, Sun, Moon, Check, CheckCheck, Reply, Star, Pin, Forward, Copy, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ForwardMessageModal from '@/components/radar/ForwardMessageModal';
import AudioTranscription from '@/components/radar/AudioTranscription';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import TagLembreteButton from '@/components/radar/TagLembreteButton';
import GrupoDetalheDrawer from '@/components/radar/GrupoDetalheDrawer';
import { useChatTheme, chatTheme } from '@/hooks/useChatTheme';
import moment from 'moment';
import 'moment-timezone';
import { toast } from 'sonner';
import { calcularMinutosUteis, nivelAlerta } from '@/lib/minutosUteis';

const TZ = 'America/Sao_Paulo';

function renderizarTextoComLinks(texto, className, telefoneParaNome) {
  if (!texto) return null;
  const mapa = telefoneParaNome || {};
  const pattern = /(https?:\/\/[^\s]+)|@(\d{10,16})/g;

  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(texto)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: texto.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      segments.push({ type: 'url', content: match[1] });
    } else if (match[2]) {
      const phoneDigits = match[2];
      let nome = null;
      for (const [phoneKey, name] of Object.entries(mapa)) {
        if (phoneKey.includes(phoneDigits) || phoneDigits.includes(phoneKey)) {
          nome = name;
          break;
        }
      }
      segments.push({ type: 'mention', display: nome || phoneDigits, raw: match[0] });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < texto.length) {
    segments.push({ type: 'text', content: texto.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: texto });
  }

  return (
    <p className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'url') {
          return <a key={i} href={seg.content} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:decoration-solid break-all">{seg.content}</a>;
        }
        if (seg.type === 'mention') {
          return <span key={i} className="text-cyan-500 font-medium" title={seg.raw}>@{seg.display}</span>;
        }
        return <span key={i}>{seg.content}</span>;
      })}
    </p>
  );
}

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
    let txt = (m.mensagem || '');
    // Substituir menções @phone por @⋯ no preview
    txt = txt.replace(/@\d{10,16}/g, '@⋯');
    txt = txt.substring(0, 60);
    return txt + (txt.length >= 60 ? '...' : '');
  }
  const map = { imagem: '📷 Imagem', video: '🎬 Vídeo', audio: '🎤 Áudio', documento: '📎 Documento', sticker: '🎨 Figurinha' };
  return map[m.tipo_mensagem] || '';
}

export default function ChatHubDrawer({ onClose, user }) {
  const queryClient = useQueryClient();
  const { isLight, toggle: toggleTheme } = useChatTheme();
  const t = chatTheme(isLight);
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
  const [imagemColada, setImagemColada] = useState(null); // { file, previewUrl }
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null); // { file, previewUrl, tipo }
  const [respondendoA, setRespondendoA] = useState(null); // mensagem sendo respondida
  const [forwardMsg, setForwardMsg] = useState(null); // mensagem a encaminhar
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const stickerInputRef = useRef(null);
  const [showGrupoDetalhe, setShowGrupoDetalhe] = useState(false);
  const [grupoDetalheData, setGrupoDetalheData] = useState(null);
  const [loadingGrupoDetalhe, setLoadingGrupoDetalhe] = useState(false);

  const handleOpenGrupoDetalhe = async () => {
    if (!selectedChat?.isGroup || !selectedChat?.id) return;
    setLoadingGrupoDetalhe(true);
    try {
      const grupos = await base44.entities.WhatsappGrupo.filter({ grupo_id: selectedChat.id });
      const g = grupos[0];
      if (g) {
        setGrupoDetalheData(g);
        setShowGrupoDetalhe(true);
      } else {
        toast.error('Grupo não encontrado');
      }
    } catch (e) {
      toast.error('Erro ao buscar dados do grupo');
    } finally {
      setLoadingGrupoDetalhe(false);
    }
  };

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
      return msgs.filter(m => !m.deletado && m.tipo_mensagem !== 'sem_conteudo');
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
        if (m.tipo_mensagem === 'sem_conteudo') return;
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
      return msgs
        .filter(m => !m.deletado && m.tipo_mensagem !== 'sem_conteudo')
        .sort((a, b) => {
          const ta = a.received_at || a.timestamp_mensagem || '';
          const tb = b.received_at || b.timestamp_mensagem || '';
          return tb.localeCompare(ta);
        });
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
      const userFullName = user?.full_name || '';
      const userFirstName = userFullName.split(' ')[0] || '';
      const nomesUsuario = [userFullName, userFirstName, userEmail].filter(Boolean);
      result = result.filter(c => {
        return mensagensRecentes.some(m => 
          m.grupo_id === c.id && 
          (m.remetente_tipo === 'voxx' || m.origem === 'enviada') &&
          nomesUsuario.some(nome => m.remetente_nome === nome)
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
    if (enviando || !selectedChat) return;

    const midiaParaEnviar = imagemColada || arquivoSelecionado;

    // Se tem imagem colada ou arquivo selecionado, envia a mídia (com texto opcional como legenda)
    if (midiaParaEnviar) {
      setEnviando(true);
      const file = midiaParaEnviar.file;
      const previewUrl = midiaParaEnviar.previewUrl;
      const tipoMidia = midiaParaEnviar.tipo || 'imagem';
      setMensagem('');
      setImagemColada(null);
      setArquivoSelecionado(null);
      try {
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        const res = await base44.functions.invoke('enviarMensagemGeral', {
          chatId: selectedChat.id,
          tipo: tipoMidia,
          mensagem: texto || '',
          midiaUrl: uploadRes.file_url,
          fileName: file.name || (tipoMidia === 'imagem' ? 'imagem.png' : tipoMidia === 'video' ? 'video.mp4' : 'documento'),
          incluirAssinatura: false,
          clienteId: selectedChat.clienteId || '',
          clienteNome: selectedChat.clienteNome || '',
          chatName: selectedChat.name || '',
        });
        if (res.data?.success) {
          queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
          queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
          queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
          concluirTagsAtivas();
        } else {
          toast.error(res.data?.erro || 'Erro ao enviar arquivo');
        }
      } catch (e) {
        toast.error('Erro ao enviar arquivo: ' + (e.message || 'Desconhecido'));
      } finally {
        setEnviando(false);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      }
      return;
    }

    if (!texto) return;
    setEnviando(true);
    // Limpa input e reply IMEDIATAMENTE
    setMensagem('');
    const citacao = respondendoA ? {
      citacaoId: respondendoA.message_id || respondendoA.id,
      citacaoTexto: respondendoA.mensagem || '',
      citacaoRemetente: respondendoA.remetente_nome || '',
      citacaoTipo: respondendoA.tipo_mensagem || 'texto',
      citacaoMidiaUrl: respondendoA.midia_url || '',
    } : null;
    setRespondendoA(null);

    // Otimistic update: adiciona a mensagem ao cache instantaneamente
    const tempId = 'opt-' + Date.now();
    const agoraIso = new Date().toISOString();
    const nomeRemetente = user?.full_name?.split(' ')[0] || 'Você';
    const optimisticMsg = {
      id: tempId,
      message_id: null,
      mensagem: texto,
      tipo_mensagem: 'texto',
      remetente_nome: nomeRemetente,
      remetente_tipo: 'voxx',
      origem: 'enviada',
      from_me: true,
      received_at: agoraIso,
      timestamp_mensagem: agoraIso,
      status_entrega: 'pendente',
      midia_url: null,
      midia_nome: null,
      midia_mimetype: null,
      reacoes: [],
      deletado: false,
      is_group: selectedChat.isGroup,
      grupo_id: selectedChat.id,
      grupo_nome: selectedChat.name || null,
      cliente_id: selectedChat.clienteId || null,
      cliente_nome: selectedChat.clienteNome || null,
      ...(citacao && {
        citacao_id: citacao.citacaoId,
        citacao_texto: citacao.citacaoTexto,
        citacao_remetente: citacao.citacaoRemetente,
        citacao_tipo: citacao.citacaoTipo,
        citacao_midia_url: citacao.citacaoMidiaUrl,
      }),
    };
    queryClient.setQueryData(['chatHubMsgs', selectedChat.id], (old) => {
      if (!old) return [optimisticMsg];
      return [optimisticMsg, ...old];
    });
    queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
    queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });

    try {
      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: selectedChat.id,
        mensagem: texto,
        tipo: 'texto',
        incluirAssinatura: true,
        clienteId: selectedChat.clienteId || '',
        clienteNome: selectedChat.clienteNome || '',
        chatName: selectedChat.name || '',
        ...(citacao && { citacao }),
      });
      if (!res.data?.success) {
        toast.error(res.data?.erro || 'Erro ao enviar mensagem');
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
      } else {
        // Invalida para sincronizar com a mensagem real do banco
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
        concluirTagsAtivas();
      }
    } catch (e) {
      toast.error('Erro ao enviar: ' + (e.message || 'Desconhecido'));
      queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
    } finally {
      setEnviando(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    e.target.value = '';

    let tipo = 'documento';
    let previewUrl = null;
    if (file.type.startsWith('image/')) {
      tipo = 'imagem';
      previewUrl = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      tipo = 'video';
      previewUrl = URL.createObjectURL(file);
    }

    if (imagemColada) {
      URL.revokeObjectURL(imagemColada.previewUrl);
      setImagemColada(null);
    }
    if (arquivoSelecionado?.previewUrl) {
      URL.revokeObjectURL(arquivoSelecionado.previewUrl);
    }

    setArquivoSelecionado({ file, previewUrl, tipo });
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
        const audioFile = new File([blob], 'audio.webm', { type: 'audio/webm' });
        setEnviando(true);
        try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: audioFile });
          // Invalida antes da resposta — backend salva msg antes de chamar Z-API
          queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
          queryClient.invalidateQueries({ queryKey: ['radarMensagens'] });
          queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });

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
          if (!res.data?.success) {
            toast.error(res.data?.erro || 'Erro ao enviar áudio');
            queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
          } else {
            concluirTagsAtivas();
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

  // Conclui tags "AGUARD. RETORNO" ativas da conversa atual
  const concluirTagsAtivas = async () => {
    if (!selectedChat?.id) return;
    try {
      const tags = await base44.entities.TagConversa.filter({ grupo_id: selectedChat.id, status: 'ativa' });
      for (const tag of tags) {
        await base44.entities.TagConversa.update(tag.id, { status: 'concluida' });
      }
      if (tags.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['chatHubTagsAtivas'] });
      }
    } catch (_) { /* silencioso */ }
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
        concluirTagsAtivas();
        queryClient.invalidateQueries({ queryKey: ['chatHubMsgs', selectedChat.id] });
        queryClient.invalidateQueries({ queryKey: ['chatHubUltimaMsgPorChat'] });
      } else {
        toast.error(res.data?.erro || 'Erro ao enviar reação');
      }
    } catch (e) {
      toast.error('Erro ao reagir: ' + (e.message || 'Desconhecido'));
    }
  };

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const handleCopyMessage = (msg) => {
    navigator.clipboard.writeText(msg.mensagem || '');
    toast.success('Mensagem copiada');
  };

  const handleFavoriteMessage = (msg) => {
    const favoritas = JSON.parse(localStorage.getItem('chat_favoritas') || '{}');
    const key = msg.id;
    if (favoritas[key]) { delete favoritas[key]; toast.success('Removido dos favoritos'); }
    else { favoritas[key] = true; toast.success('Adicionado aos favoritos'); }
    localStorage.setItem('chat_favoritas', JSON.stringify(favoritas));
  };

  const handlePinMessage = (msg) => {
    const fixadas = JSON.parse(localStorage.getItem('chat_fixadas') || '{}');
    const key = msg.id;
    if (fixadas[key]) { delete fixadas[key]; toast.success('Mensagem desafixada'); }
    else { fixadas[key] = { texto: msg.mensagem?.substring(0, 80) || 'Mídia', ts: msg.received_at }; toast.success('Mensagem fixada'); }
    localStorage.setItem('chat_fixadas', JSON.stringify(fixadas));
  };

  const handleDeleteMessage = async (m) => {
    if (!selectedChat) return;
    const modo = await new Promise((resolve) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7)';
      div.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
          <p style="color:#f1f5f9;font-size:15px;font-weight:600;margin:0 0 8px">Excluir mensagem?</p>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 20px">Escolha como deseja excluir:</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button id="del-todos" style="width:100%;padding:12px;border-radius:10px;border:none;background:#dc2626;color:white;font-size:13px;font-weight:600;cursor:pointer">🗑️ Excluir para todos</button>
            <button id="del-mim" style="width:100%;padding:10px;border-radius:10px;border:1px solid #475569;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer">🙈 Ocultar só para mim</button>
            <button id="del-cancel" style="width:100%;padding:10px;border-radius:10px;border:none;background:transparent;color:#64748b;font-size:12px;cursor:pointer;margin-top:4px">Cancelar</button>
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
        concluirTagsAtivas();
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

  // Mapa telefone → nome para resolver menções (@phone)
  const telefoneParaNome = useMemo(() => {
    const map = {};
    msgsChat.forEach(m => {
      if (m.remetente_telefone && m.remetente_nome) {
        const telNorm = m.remetente_telefone.replace(/\D/g, '');
        if (telNorm) map[telNorm] = m.remetente_nome;
      }
    });
    return map;
  }, [msgsChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgsChat]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className={`absolute inset-0 ${t.bgModalOverlay}`} onClick={onClose} />
      <div className={`relative w-full h-full ${t.bg} flex shadow-2xl`}>

        {/* ── Painel Esquerdo: Lista de Conversas ── */}
        <div className={`w-80 lg:w-96 shrink-0 border-r ${t.border} flex flex-col ${t.bgPanelAlpha}`}>
          {/* Header */}
          <div className={`p-4 border-b ${t.border} shrink-0`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-base font-bold ${t.textName}`}>Mensagens</h2>
              <div className="flex items-center gap-1">
                <button onClick={toggleTheme} className={`p-1 ${t.textSecondary} ${t.textPrimary} ${t.bgHoverBtn} rounded-lg`} title={isLight ? 'Modo escuro' : 'Modo claro'}>
                  {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button onClick={onClose} className={`p-1 ${t.textSecondary} ${t.textPrimary} ${t.bgCloseBtnHover} rounded-lg`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="relative mb-3">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${t.textTertiary}`} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className={`${t.bgInput} ${t.inputBorder} ${t.textInput} pl-9 ${t.textPlaceholder} rounded-xl text-sm h-9`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {['todas', 'naolidas', 'minhas', 'aguard_retorno'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFiltroTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtroTab === tab
                      ? t.tabActive
                      : t.tabInactive
                  }`}
                >
                  {tab === 'todas' ? 'Todas' : tab === 'naolidas' ? 'Não lidas' : tab === 'minhas' ? 'Minhas' : <Bell className="w-3.5 h-3.5" />}
                </button>
              ))}
              <div className="flex-1" />
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${t.textSecondary} ${t.textPrimary} ${t.bgHoverGhost}`}
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
                    className={`w-full text-left px-4 py-3 border-b ${t.borderSubtle} ${t.bgCardHover} transition-colors ${
                      isSelected ? t.bgCardSelected : ''
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
                      <p className={`text-sm font-medium ${t.textName} truncate flex items-center gap-1.5`}>
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
                          c.unreadCount > 0 ? t.iconGreen : t.textTertiary
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
        <div className={`flex-1 flex flex-col ${t.bg}`}>
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full ${t.bgIconCircle} flex items-center justify-center mx-auto mb-4`}>
                  <MessageCircle className={`w-8 h-8 ${t.textTertiary}`} />
                </div>
                <p className={`${t.textTertiary} text-sm`}>Selecione uma conversa para começar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <div className={`flex items-center justify-between px-5 py-3 border-b ${t.border} shrink-0`}>
                <div
                  className={`flex items-center gap-3 ${selectedChat.isGroup ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                  onClick={handleOpenGrupoDetalhe}
                  title={selectedChat.isGroup ? 'Ver detalhes do grupo' : ''}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    selectedChat.isGroup ? `${t.iconGreenBg} ${t.iconGreen}` : `${t.iconBlueBg} ${t.iconBlue}`
                  }`}>
                    {selectedChat.isGroup ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${t.textName}`}>{selectedChat.name}</h3>
                    <p className={`text-[11px] ${t.textSecondary}`}>
                      {selectedChat.isGroup ? 'Grupo' : 'Contato direto'}
                      {selectedChat.clienteNome ? ` · ${selectedChat.clienteNome}` : ''}
                    </p>
                  </div>
                  {loadingGrupoDetalhe && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>
                  <TagLembreteButton
                  grupoId={selectedChat.id}
                  grupoNome={selectedChat.name || ''}
                  clienteId={selectedChat.clienteId || ''}
                  clienteNome={selectedChat.clienteNome || ''}
                  />
              </div>

              {/* Mensagens */}
              <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-3 space-y-2 ${t.bgMensagens}`} style={t.bgMensagensStyle}>
                  {loadingMsgs ? (
                    <div className="flex justify-center py-12"><Loader2 className={`w-5 h-5 animate-spin ${t.textTertiary}`} /></div>
                  ) : msgsChat.length === 0 ? (
                    <p className={`text-center ${t.textTertiary} text-sm py-12`}>Nenhuma mensagem ainda.</p>
                  ) : (
                    [...msgsChat].reverse().map((m) => {
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
                            return (
                              <div>
                                <audio src={midiaUrl} controls className="w-full min-w-[200px] h-10" preload="metadata" />
                                <AudioTranscription mensagem={m} />
                              </div>
                            );
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
                        return renderizarTextoComLinks(textoLimpo || '[Sem conteúdo]', 'whitespace-pre-wrap break-words', telefoneParaNome);
                      };

                      return (
                        <div key={m.id} className={`flex group ${isVoxx ? 'justify-end' : 'justify-start'}`}>
                          <div className="relative max-w-[75%]">
                            <div className={`rounded-2xl px-4 py-2.5 text-sm ${
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
                            {['imagem', 'video', 'documento'].includes(m.tipo_mensagem) && m.mensagem && !['[Imagem]', '[Vídeo]', '[Documento]'].includes(m.mensagem) && !m.mensagem.startsWith('[Documento:') && (
                              renderizarTextoComLinks(m.mensagem, 'mt-1.5 whitespace-pre-wrap break-words text-xs opacity-90', telefoneParaNome)
                            )}
                            {/* Reações */}
                            {m.reacoes && m.reacoes.length > 0 && (
                              <div className={`flex flex-wrap gap-0.5 mt-1.5 ${isVoxx ? 'justify-end' : ''}`}>
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
                            {/* Timestamp + checks no canto inferior direito (estilo WhatsApp) */}
                            <div className="flex items-center gap-1 mt-1 relative">
                              <div className="flex-1">
                                {isVoxx && (
                                  <button
                                    className="p-0.5 rounded-full opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-red-500/30 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMessage(m); }}
                                    title="Excluir mensagem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
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
                              <span className="flex items-center gap-0.5 ml-auto">
                                <span className={`text-[10px] ${isVoxx ? t.textTimestamp : t.textTimestampIn}`}>
                                  {formatarDataHora(ts)}
                                </span>
                                {isVoxx && (
                                  m.status_entrega === 'erro' ? (
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                  ) : m.status_entrega === 'lido' ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                                  ) : m.status_entrega === 'entregue' ? (
                                    <CheckCheck className="w-3.5 h-3.5 opacity-50" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 opacity-40" />
                                  )
                                )}
                              </span>
                            </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={`absolute top-2 ${isVoxx ? 'left-1' : 'right-1'} p-1 rounded-full opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity z-10 ${isVoxx ? 'hover:bg-emerald-600/30' : 'hover:bg-black/10'}`}>
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                side={isVoxx ? 'left' : 'right'}
                                align={isVoxx ? 'end' : 'start'}
                                className={`w-48 p-1.5 border ${t.popoverBorder} ${t.popoverBg} shadow-xl rounded-xl`}
                              >
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer" onClick={() => setRespondendoA(m)}>
                              <Reply className="w-4 h-4" /> Responder
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-default" onSelect={(e) => e.preventDefault()}>
                              <SmilePlus className="w-4 h-4" /> Reagir
                            </DropdownMenuItem>
                            <div className="flex gap-0.5 px-3 pb-2">
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
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer" onClick={() => handleFavoriteMessage(m)}>
                              <Star className="w-4 h-4" /> Favoritar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer" onClick={() => handlePinMessage(m)}>
                              <Pin className="w-4 h-4" /> Fixar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer" onClick={() => setForwardMsg(m)}>
                              <Forward className="w-4 h-4" /> Encaminhar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer" onClick={() => handleCopyMessage(m)}>
                              <Copy className="w-4 h-4" /> Copiar
                            </DropdownMenuItem>
                            {isVoxx && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-3 px-3 py-2.5 text-sm rounded-lg cursor-pointer text-red-500" onClick={() => handleDeleteMessage(m)}>
                                  <Trash2 className="w-4 h-4" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })
                  )}
              </div>

              {/* Input WhatsApp-style */}
              <div className={`px-3 py-2 ${t.bgBarraInput} shrink-0`}>
                {/* Barra de resposta (reply) */}
                {respondendoA && (
                  <div className={`flex items-center gap-3 px-3 py-2 mb-2 ${t.bgQuoteIn} rounded-lg border ${t.borderLight}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold ${t.textNameIn} mb-0.5`}>
                        Respondendo a {respondendoA.remetente_nome || 'mensagem'}
                      </p>
                      <p className={`text-[11px] ${t.textSecondary} truncate`}>
                        {respondendoA.tipo_mensagem === 'imagem' ? '📷 Imagem' :
                         respondendoA.tipo_mensagem === 'video' ? '🎬 Vídeo' :
                         respondendoA.tipo_mensagem === 'audio' ? '🎵 Áudio' :
                         respondendoA.tipo_mensagem === 'documento' ? '📄 Documento' :
                         respondendoA.tipo_mensagem === 'sticker' ? '🌟 Sticker' :
                         respondendoA.mensagem?.substring(0, 80) || 'Mensagem'}
                      </p>
                    </div>
                    <button onClick={() => setRespondendoA(null)} className={`p-1 rounded-full ${t.popoverHover}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
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
                {arquivoSelecionado && (
                  <div className="mb-2 relative inline-block">
                    {arquivoSelecionado.tipo === 'imagem' && arquivoSelecionado.previewUrl ? (
                      <img src={arquivoSelecionado.previewUrl} alt="Preview" className={`max-h-32 rounded-lg border ${t.borderLight}`} />
                    ) : arquivoSelecionado.tipo === 'video' && arquivoSelecionado.previewUrl ? (
                      <video src={arquivoSelecionado.previewUrl} className={`max-h-32 rounded-lg border ${t.borderLight}`} controls />
                    ) : (
                      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${t.borderLight} ${t.bg}`}>
                        <FileText className="w-5 h-5 text-slate-400" />
                        <span className={`text-xs ${t.textSecondary} truncate max-w-[200px]`}>{arquivoSelecionado.file.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (arquivoSelecionado.previewUrl) URL.revokeObjectURL(arquivoSelecionado.previewUrl);
                        setArquivoSelecionado(null);
                      }}
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
                        <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`} onClick={() => { fileInputRef.current?.click(); }}>
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Image className="w-4 h-4 text-blue-500" /></div>
                          Fotos e vídeos
                        </button>
                        <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`} onClick={() => { fileInputRef.current?.click(); }}>
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><FileText className="w-4 h-4 text-orange-500" /></div>
                          Documento
                        </button>
                        <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`} onClick={startRecording} disabled={enviando || gravando}>
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Mic className="w-4 h-4 text-red-500" /></div>
                          Áudio
                        </button>
                        <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                          <PopoverTrigger asChild>
                            <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${t.textName} hover:bg-black/5 transition-colors`}>
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><Sticker className="w-4 h-4 text-purple-500" /></div>
                              Figurinha
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="right" align="start" className={`w-72 p-3 border ${t.popoverBorder} ${t.popoverBg} shadow-xl`}>
                            <p className={`text-[11px] ${t.textSecondary} mb-2`}>Enviar sticker</p>
                            <div className="grid grid-cols-6 gap-1.5 mb-3">
                              {STICKER_PRESETS.map((s) => (
                                <button key={s.emoji} className={`w-9 h-9 flex items-center justify-center rounded-lg text-xl ${t.popoverHover} transition-colors`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setStickerOpen(false); handleSendSticker(s.url); }} disabled={enviando}>
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

                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" />

                  {/* Campo de texto com emoji dentro */}
                  <div className={`flex-1 flex items-center rounded-2xl ${t.bgCampoInput} border ${t.inputFieldBorder} shadow-sm`}>
                    <Textarea
                      value={mensagem}
                      onChange={(e) => {
                        setMensagem(e.target.value);
                        const el = e.target;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      placeholder="Mensagem"
                      rows={1}
                      className={`flex-1 border-0 bg-transparent ${t.textInput} ${t.textPlaceholder} text-sm min-h-[40px] max-h-[120px] px-4 py-2 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-2xl resize-none`}
                      disabled={enviando}
                    />
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                      <PopoverTrigger asChild>
                        <button className={`w-10 h-10 flex items-center justify-center rounded-full ${t.inputIconColor} hover:bg-black/5 transition-colors shrink-0`} disabled={enviando}>
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
                    <button className="w-10 h-10 flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 shrink-0" onClick={stopRecording}>
                      <MicOff className="w-5 h-5" />
                    </button>
                  ) : (mensagem.trim() || imagemColada || arquivoSelecionado) ? (
                    <button className={`w-10 h-10 flex items-center justify-center rounded-full text-white ${t.sendBtnBg} shrink-0 transition-colors`} onClick={handleSend} disabled={enviando}>
                      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button className={`w-10 h-10 flex items-center justify-center rounded-full ${t.inputIconColor} hover:bg-black/5 transition-colors shrink-0`} onClick={startRecording} disabled={enviando}>
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Drawer: Detalhes do Grupo ── */}
        {showGrupoDetalhe && grupoDetalheData && (
          <GrupoDetalheDrawer
            grupo={grupoDetalheData}
            clientes={[]}
            onClose={() => setShowGrupoDetalhe(false)}
          />
        )}

        {/* ── Modal: Encaminhamento ── */}
        {forwardMsg && (
          <ForwardMessageModal
            open={!!forwardMsg}
            onOpenChange={(isOpen) => { if (!isOpen) setForwardMsg(null); }}
            mensagem={forwardMsg}
          />
        )}

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