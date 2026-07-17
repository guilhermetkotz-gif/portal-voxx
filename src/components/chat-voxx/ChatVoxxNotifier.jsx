import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { useChatVoxxSound } from '@/hooks/useChatVoxxSound';

export default function ChatVoxxNotifier({ user }) {
  const navigate = useNavigate();
  const seenIdsRef = useRef(new Set());
  const conversationsRef = useRef([]);
  const { tocarSom } = useChatVoxxSound();

  const { data: conversations = [] } = useQuery({
    queryKey: ['chatVoxxConversas', user?.id],
    queryFn: () => base44.entities.ChatVoxxConversa.list('-timestamp_ultima_atividade', 200),
    enabled: !!user?.id,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = base44.entities.ChatVoxxMensagem.subscribe((event) => {
      if (event.type !== 'create') return;
      const msg = event.data;
      if (!msg || msg.remetente_id === user.id) return;

      // Only notify for conversations the user is part of
      const conv = conversationsRef.current.find(c => c.id === msg.conversa_id);
      if (!conv || !conv.participantes?.includes(user.id)) return;

      // Avoid duplicate notifications
      if (seenIdsRef.current.has(msg.id)) return;
      seenIdsRef.current.add(msg.id);

      // Skip if user is already on the ChatVoxx page
      if (window.location.pathname === '/ChatVoxx') return;

      // Som de notificação
      tocarSom();

      const senderName = msg.remetente_nome || 'Usuário';

      let preview = msg.conteudo || '';
      if (msg.tipo_mensagem === 'imagem') preview = '📷 Foto';
      else if (msg.tipo_mensagem === 'video') preview = '🎥 Vídeo';
      else if (msg.tipo_mensagem === 'audio') preview = '🎵 Áudio';
      else if (msg.tipo_mensagem === 'documento') preview = '📄 Documento';
      else if (msg.tipo_mensagem === 'sticker') preview = '🎨 Figurinha';

      const title = conv.is_group
        ? `${conv.nome_grupo || 'Grupo'} — ${senderName}`
        : senderName;

      toast.custom((t) => (
        <button
          onClick={() => {
            navigate(`/ChatVoxx?convId=${msg.conversa_id}`);
            toast.dismiss(t);
          }}
          className="w-full flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-left hover:bg-slate-50 transition-colors max-w-sm"
        >
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white flex-shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{title}</p>
            <p className="text-sm text-slate-500 truncate">{preview}</p>
          </div>
        </button>
      ), { duration: 6000 });
    });

    return () => unsubscribe();
  }, [user?.id, navigate, tocarSom]);

  return null;
}