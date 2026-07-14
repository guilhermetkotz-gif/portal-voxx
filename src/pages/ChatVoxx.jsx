import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserList from '@/components/chat-voxx/UserList';
import MessageBubble from '@/components/chat-voxx/MessageBubble';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ChatVoxx({ user }) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['chatVoxxUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    enabled: !!user,
    staleTime: 60 * 1000
  });

  const VOXX_TIPOS = ['voxx_admin', 'voxx_operacao', 'voxx_manager', 'voxx_financeiro'];
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

  const conversationMap = useMemo(() => {
    const map = {};
    conversations.forEach(c => {
      const otherUserId = c.participantes?.find(p => p !== user?.id);
      if (otherUserId) map[otherUserId] = c;
    });
    return map;
  }, [conversations, user?.id]);

  useEffect(() => {
    if (!selectedUserId || !user?.id) return;

    const findOrCreate = async () => {
      const existing = conversations.find(c =>
        c.participantes?.includes(user.id) && c.participantes?.includes(selectedUserId)
      );

      if (existing) {
        setActiveConversation(existing);
      } else {
        const newConv = await base44.entities.ChatVoxxConversa.create({
          participantes: [user.id, selectedUserId],
          timestamp_ultima_atividade: new Date().toISOString(),
          ultima_mensagem_preview: ''
        });
        setActiveConversation(newConv);
        queryClient.invalidateQueries(['chatVoxxConversas']);
      }
    };

    findOrCreate();
  }, [selectedUserId, user?.id, conversations]);

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
          setMessages(prev => [...prev, event.data]);
        } else if (event.type === 'update') {
          setMessages(prev => prev.map(m => m.id === event.data.id ? event.data : m));
        } else if (event.type === 'delete') {
          setMessages(prev => prev.filter(m => m.id !== event.data.id));
        }
      }
    });

    return () => unsubscribe();
  }, [activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    const unread = messages.filter(m => !m.lida && m.remetente_id !== user.id);
    unread.forEach(async (msg) => {
      await base44.entities.ChatVoxxMensagem.update(msg.id, { lida: true });
    });
  }, [messages, activeConversation?.id, user?.id]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !activeConversation?.id || !user?.id) return;

    const content = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      await base44.entities.ChatVoxxMensagem.create({
        conversa_id: activeConversation.id,
        remetente_id: user.id,
        remetente_nome: user.full_name || user.email,
        conteudo: content,
        lida: false
      });

      await base44.entities.ChatVoxxConversa.update(activeConversation.id, {
        ultima_mensagem_preview: content.substring(0, 100),
        timestamp_ultima_atividade: new Date().toISOString(),
        remetente_ultima_mensagem: user.id
      });

      queryClient.invalidateQueries(['chatVoxxConversas']);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setInputMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedUser = contactList.find(u => u.id === selectedUserId);

  const getUserPreview = (userId) => {
    const conv = conversationMap[userId];
    if (!conv) return null;
    return {
      preview: conv.ultima_mensagem_preview || '',
      timestamp: conv.timestamp_ultima_atividade
    };
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        <UserList
          users={contactList}
          currentUserId={user?.id}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
          getUserPreview={getUserPreview}
        />
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600">Chat Voxx</h3>
              <p className="text-sm text-slate-400 mt-1">Selecione um contato para começar a conversar</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3 bg-white">
              {selectedUser?.profile_picture ? (
                <img src={selectedUser.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold">
                  {(selectedUser?.full_name || selectedUser?.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-slate-900">{selectedUser?.full_name || selectedUser?.email}</h3>
                {selectedUser?.cargo && (
                  <p className="text-xs text-slate-500">{selectedUser.cargo}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50">
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
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Digite sua mensagem..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || sending}
                  size="icon"
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}