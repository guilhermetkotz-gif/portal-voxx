import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserList from '@/components/chat-voxx/UserList';
import MessageBubble from '@/components/chat-voxx/MessageBubble';
import MessageInput from '@/components/chat-voxx/MessageInput';
import CreateGroupModal from '@/components/chat-voxx/CreateGroupModal';
import { Loader2, MessageCircle, Users, ArrowLeft } from 'lucide-react';

export default function ChatVoxx({ user }) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const VOXX_TIPOS = ['voxx_admin', 'voxx_operacao', 'voxx_manager', 'voxx_financeiro'];

  const { data: users = [] } = useQuery({
    queryKey: ['chatVoxxUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    enabled: !!user,
    staleTime: 60 * 1000
  });

  const contactList = useMemo(() => {
    return users.filter(u =>
      u.id !== user?.id &&
      u.status === 'ativo' &&
      VOXX_TIPOS.includes(u.tipo_acesso || u.tipo_usuario)
    );
  }, [users, user?.id]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['chatVoxxConversas', user?.id],
    queryFn: () => base44.entities.ChatVoxxConversa.list('-timestamp_ultima_atividade', 200),
    enabled: !!user,
    staleTime: 10 * 1000
  });

  const myGroups = useMemo(() => {
    return conversations.filter(c => c.is_group && c.participantes?.includes(user?.id));
  }, [conversations, user?.id]);

  const directConvMap = useMemo(() => {
    const map = {};
    conversations.forEach(c => {
      if (!c.is_group && c.participantes?.includes(user?.id)) {
        const otherUserId = c.participantes.find(p => p !== user?.id);
        if (otherUserId) {
          map[otherUserId] = {
            preview: c.ultima_mensagem_preview || '',
            timestamp: c.timestamp_ultima_atividade,
            tipo: c.ultima_mensagem_tipo,
            convId: c.id
          };
        }
      }
    });
    return map;
  }, [conversations, user?.id]);

  // Find or create 1:1 conversation
  useEffect(() => {
    if (!selectedUserId || !user?.id) return;
    const existing = conversations.find(c =>
      !c.is_group && c.participantes?.includes(user.id) && c.participantes?.includes(selectedUserId)
    );
    if (existing) {
      setActiveConversation(existing);
    } else {
      base44.entities.ChatVoxxConversa.create({
        participantes: [user.id, selectedUserId],
        is_group: false,
        timestamp_ultima_atividade: new Date().toISOString(),
        ultima_mensagem_preview: ''
      }).then(newConv => {
        setActiveConversation(newConv);
        queryClient.invalidateQueries(['chatVoxxConversas']);
      });
    }
  }, [selectedUserId, user?.id, conversations]);

  useEffect(() => {
    if (selectedGroup) {
      setActiveConversation(selectedGroup);
    }
  }, [selectedGroup]);

  // Load messages + subscribe
  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      const msgs = await base44.entities.ChatVoxxMensagem.filter(
        { conversa_id: activeConversation.id },
        'created_date',
        500
      );
      setMessages(msgs);
    };

    loadMessages();

    const unsubscribe = base44.entities.ChatVoxxMensagem.subscribe((event) => {
      if (event.data?.conversa_id === activeConversation.id) {
        if (event.type === 'create') {
          setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]);
        } else if (event.type === 'update') {
          setMessages(prev => prev.map(m => m.id === event.data.id ? event.data : m));
        } else if (event.type === 'delete') {
          setMessages(prev => prev.filter(m => m.id !== event.data.id));
        }
      }
    });

    return () => unsubscribe();
  }, [activeConversation?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    const unread = messages.filter(m => !m.lida && m.remetente_id !== user.id);
    unread.forEach(async (msg) => {
      await base44.entities.ChatVoxxMensagem.update(msg.id, { lida: true });
    });
  }, [messages, activeConversation?.id, user?.id]);

  const updateConversationPreview = async (content, tipo) => {
    if (!activeConversation?.id) return;
    await base44.entities.ChatVoxxConversa.update(activeConversation.id, {
      ultima_mensagem_preview: content.substring(0, 100),
      ultima_mensagem_tipo: tipo,
      timestamp_ultima_atividade: new Date().toISOString(),
      remetente_ultima_mensagem: user.id
    });
    queryClient.invalidateQueries(['chatVoxxConversas']);
  };

  const handleSendText = async (text) => {
    if (!activeConversation?.id || !user?.id) return;
    try {
      await base44.entities.ChatVoxxMensagem.create({
        conversa_id: activeConversation.id,
        remetente_id: user.id,
        remetente_nome: user.full_name || user.email,
        conteudo: text,
        tipo_mensagem: 'texto',
        lida: false,
        resposta_id: replyingTo?.id || undefined,
        resposta_texto: replyingTo?.conteudo || replyingTo?.midia_nome || undefined,
        resposta_remetente_nome: replyingTo?.remetente_nome || undefined
      });
      await updateConversationPreview(text, 'texto');
      setReplyingTo(null);
    } catch (err) {
      console.error('Erro ao enviar:', err);
    }
  };

  const handleSendMedia = async (mediaData) => {
    if (!activeConversation?.id || !user?.id) return;
    try {
      await base44.entities.ChatVoxxMensagem.create({
        conversa_id: activeConversation.id,
        remetente_id: user.id,
        remetente_nome: user.full_name || user.email,
        conteudo: mediaData.conteudo || '',
        tipo_mensagem: mediaData.tipo_mensagem,
        midia_url: mediaData.midia_url,
        midia_nome: mediaData.midia_nome,
        midia_mimetype: mediaData.midia_mimetype,
        lida: false,
        resposta_id: replyingTo?.id || undefined,
        resposta_texto: replyingTo?.conteudo || replyingTo?.midia_nome || undefined,
        resposta_remetente_nome: replyingTo?.remetente_nome || undefined
      });
      const previewLabel = mediaData.tipo_mensagem === 'imagem' ? '📷 Foto' :
                           mediaData.tipo_mensagem === 'video' ? '🎥 Vídeo' :
                           mediaData.tipo_mensagem === 'audio' ? '🎵 Áudio' : '📄 Documento';
      await updateConversationPreview(previewLabel, mediaData.tipo_mensagem);
      setReplyingTo(null);
    } catch (err) {
      console.error('Erro ao enviar mídia:', err);
    }
  };

  const handleSendSticker = async (emoji) => {
    if (!activeConversation?.id || !user?.id) return;
    try {
      await base44.entities.ChatVoxxMensagem.create({
        conversa_id: activeConversation.id,
        remetente_id: user.id,
        remetente_nome: user.full_name || user.email,
        conteudo: emoji,
        tipo_mensagem: 'sticker',
        lida: false
      });
      await updateConversationPreview('🎨 Figurinha', 'sticker');
    } catch (err) {
      console.error('Erro ao enviar sticker:', err);
    }
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const newGroup = await base44.entities.ChatVoxxConversa.create({
        ...groupData,
        timestamp_ultima_atividade: new Date().toISOString(),
        ultima_mensagem_preview: ''
      });
      queryClient.invalidateQueries(['chatVoxxConversas']);
      setSelectedGroup(newGroup);
      setSelectedUserId(null);
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
    setSelectedGroup(null);
    setReplyingTo(null);
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setSelectedUserId(null);
    setReplyingTo(null);
  };

  const selectedUser = contactList.find(u => u.id === selectedUserId);
  const isGroupChat = activeConversation?.is_group;
  const groupParticipants = isGroupChat
    ? (activeConversation?.participantes || []).map(pid => users.find(u => u.id === pid)).filter(Boolean)
    : [];

  const headerTitle = isGroupChat
    ? activeConversation?.nome_grupo || 'Grupo'
    : selectedUser?.full_name || selectedUser?.email || '';
  const headerSubtitle = isGroupChat
    ? `${groupParticipants.length} participantes`
    : selectedUser?.cargo || '';

  const getUserPreview = (userId) => directConvMap[userId] || null;
  const selectedConvId = activeConversation?.id;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50 flex-shrink-0">
        <UserList
          users={contactList}
          groups={myGroups}
          currentUserId={user?.id}
          selectedConversationId={selectedConvId}
          onSelectUser={handleSelectUser}
          onSelectGroup={handleSelectGroup}
          getUserPreview={getUserPreview}
          onCreateGroup={() => setShowCreateGroup(true)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600">Chat Voxx</h3>
              <p className="text-sm text-slate-400 mt-1">Selecione um contato ou crie um grupo para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 bg-white flex-shrink-0">
              {isGroupChat ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              ) : selectedUser?.profile_picture ? (
                <img src={selectedUser.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(selectedUser?.full_name || selectedUser?.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{headerTitle}</h3>
                <p className="text-xs text-slate-500 truncate">{headerSubtitle}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">Nenhuma mensagem ainda. Envie a primeira!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isMine={msg.remetente_id === user?.id}
                      isGroup={isGroupChat}
                      currentUserId={user?.id}
                      onReply={setReplyingTo}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <MessageInput
              onSend={handleSendText}
              onSendMedia={handleSendMedia}
              onSendSticker={handleSendSticker}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              disabled={false}
            />
          </>
        )}
      </div>

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        users={contactList}
        currentUser={user}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}