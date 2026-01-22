import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, X, Minimize2, Paperclip, CheckCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ChatWindow({ conversation, onClose, onMinimize, user, currentCliente }) {
  const queryClient = useQueryClient();
  const [mensagem, setMensagem] = useState('');
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['chatMessages', conversation.id],
    queryFn: () => base44.entities.ChatMessage.filter(
      { conversation_id: conversation.id },
      'created_date',
      200
    ),
    enabled: !!conversation.id,
    refetchInterval: 3000
  });

  // Real-time subscription
  useEffect(() => {
    if (!conversation.id) return;

    const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
      if (event.type === 'create' && event.data?.conversation_id === conversation.id) {
        queryClient.invalidateQueries(['chatMessages', conversation.id]);
        queryClient.invalidateQueries(['chatConversations']);
        
        // Mark as read if I'm the recipient
        const isVoxx = user?.tipo_usuario?.startsWith('voxx') || user?.role === 'admin';
        const isMyMessage = event.data.remetente_id === user.id;
        
        if (!isMyMessage) {
          setTimeout(() => marcarComoLida(event.data.id), 500);
        }
      }
    });

    return unsubscribe;
  }, [conversation.id, user]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark unread messages as read
  useEffect(() => {
    if (messages.length === 0) return;
    
    const isVoxx = user?.tipo_usuario?.startsWith('voxx') || user?.role === 'admin';
    const unreadMessages = messages.filter(m => 
      !m.lida && 
      m.remetente_id !== user.id &&
      ((isVoxx && m.remetente_tipo === 'cliente') || (!isVoxx && m.remetente_tipo === 'voxx'))
    );

    unreadMessages.forEach(msg => marcarComoLida(msg.id));
  }, [messages, user]);

  const marcarComoLida = async (messageId) => {
    try {
      await base44.entities.ChatMessage.update(messageId, {
        lida: true,
        lida_em: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const enviarMutation = useMutation({
    mutationFn: async (data) => {
      const isVoxx = user?.tipo_usuario?.startsWith('voxx') || user?.role === 'admin';
      
      // Create message
      const msg = await base44.entities.ChatMessage.create({
        conversation_id: conversation.id,
        remetente_id: user.id,
        remetente_nome: user.full_name,
        remetente_tipo: isVoxx ? 'voxx' : 'cliente',
        mensagem: data.mensagem,
        lida: false
      });

      // Update conversation
      const updates = {
        ultima_mensagem: data.mensagem.substring(0, 100),
        ultima_mensagem_em: new Date().toISOString()
      };

      if (isVoxx) {
        updates.nao_lidas_cliente = (conversation.nao_lidas_cliente || 0) + 1;
        if (conversation.status === 'aberto') {
          updates.status = 'em_atendimento';
          updates.atendente_id = user.id;
          updates.atendente_nome = user.full_name;
        }
      } else {
        updates.nao_lidas_voxx = (conversation.nao_lidas_voxx || 0) + 1;
      }

      await base44.entities.ChatConversation.update(conversation.id, updates);

      return msg;
    },
    onSuccess: () => {
      setMensagem('');
      queryClient.invalidateQueries(['chatMessages']);
      queryClient.invalidateQueries(['chatConversations']);
    },
    onError: (error) => {
      toast.error('Erro ao enviar mensagem: ' + error.message);
    }
  });

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!mensagem.trim()) return;
    enviarMutation.mutate({ mensagem });
  };

  const isVoxx = user?.tipo_usuario?.startsWith('voxx') || user?.role === 'admin';

  return (
    <div className="flex flex-col h-full bg-white rounded-t-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 bg-white/20">
            <span className="text-sm font-semibold">
              {isVoxx ? conversation.usuario_nome?.charAt(0) : 'V'}
            </span>
          </Avatar>
          <div>
            <h3 className="font-semibold">
              {isVoxx ? conversation.usuario_nome : 'Suporte Voxx'}
            </h3>
            <p className="text-xs text-violet-100">
              {conversation.assunto || 'Chat de Suporte'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white">
            {conversation.status}
          </Badge>
          {onMinimize && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={onMinimize}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => {
            const isMe = msg.remetente_id === user.id;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  isMe ? "justify-end" : "justify-start"
                )}
              >
                {!isMe && (
                  <Avatar className="w-8 h-8 bg-slate-200 flex-shrink-0">
                    <span className="text-xs font-semibold text-slate-700">
                      {msg.remetente_nome?.charAt(0)}
                    </span>
                  </Avatar>
                )}
                <div className={cn("max-w-[75%]", isMe && "flex flex-col items-end")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2",
                      isMe
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-900"
                    )}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold mb-1 text-slate-600">
                        {msg.remetente_nome}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-xs text-slate-500">
                      {format(new Date(msg.created_date), 'HH:mm')}
                    </span>
                    {isMe && (
                      msg.lida ? (
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                      ) : (
                        <Check className="w-3 h-3 text-slate-400" />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleEnviar} className="p-4 border-t bg-slate-50">
        <div className="flex gap-2">
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="resize-none min-h-[44px] max-h-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEnviar(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!mensagem.trim() || enviarMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Pressione Enter para enviar, Shift+Enter para quebrar linha
        </p>
      </form>
    </div>
  );
}