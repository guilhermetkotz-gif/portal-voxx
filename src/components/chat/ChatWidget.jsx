import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ChatWindow from './ChatWindow';
import { Badge } from '@/components/ui/badge';

export default function ChatWidget({ user, currentCliente }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [primeiraMsg, setPrimeiraMsg] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const queryClient = useQueryClient();

  // Don't show for Voxx users
  const isVoxx = user?.tipo_usuario?.startsWith('voxx') || user?.role === 'admin';

  const { data: conversations = [] } = useQuery({
    queryKey: ['chatConversations', currentCliente?.id],
    queryFn: () => base44.entities.ChatConversation.filter(
      { 
        cliente_id: currentCliente?.id,
        usuario_id: user.id
      },
      '-updated_date',
      50
    ),
    enabled: !!user && !!currentCliente,
    refetchInterval: 5000
  });

  const activeConversations = conversations.filter(c => c.status !== 'fechado');
  const totalUnread = activeConversations.reduce((sum, c) => sum + (c.nao_lidas_cliente || 0), 0);

  const createConversation = useMutation({
    mutationFn: async (data) => {
      const conv = await base44.entities.ChatConversation.create({
        cliente_id: currentCliente.id,
        cliente_nome: currentCliente.nome,
        usuario_id: user.id,
        usuario_nome: user.full_name,
        usuario_email: user.email,
        assunto: data.assunto,
        status: 'aberto',
        prioridade: 'normal',
        ultima_mensagem: data.mensagem.substring(0, 100),
        ultima_mensagem_em: new Date().toISOString(),
        nao_lidas_voxx: 1
      });

      // Create first message
      await base44.entities.ChatMessage.create({
        conversation_id: conv.id,
        remetente_id: user.id,
        remetente_nome: user.full_name,
        remetente_tipo: 'cliente',
        mensagem: data.mensagem
      });

      return conv;
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries(['chatConversations']);
      setSelectedConversation(conv);
      setShowNewChat(false);
      setAssunto('');
      setPrimeiraMsg('');
      setIsMinimized(false);
      toast.success('Conversa iniciada! Nossa equipe responderá em breve.');
    },
    onError: (error) => {
      toast.error('Erro ao criar conversa: ' + error.message);
    }
  });

  const handleStartChat = (e) => {
    e.preventDefault();
    if (!assunto.trim() || !primeiraMsg.trim()) {
      toast.error('Preencha o assunto e a mensagem');
      return;
    }
    createConversation.mutate({ assunto, mensagem: primeiraMsg });
  };

  // Auto-select most recent conversation if available
  useEffect(() => {
    if (activeConversations.length > 0 && !selectedConversation && !showNewChat) {
      setSelectedConversation(activeConversations[0]);
    }
  }, [activeConversations]);

  if (isVoxx) return null;

  if (selectedConversation && !isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 w-96 h-[600px] z-50 shadow-2xl">
        <ChatWindow
          conversation={selectedConversation}
          user={user}
          currentCliente={currentCliente}
          onClose={() => {
            setSelectedConversation(null);
            setIsOpen(false);
          }}
          onMinimize={() => setIsMinimized(true)}
        />
      </div>
    );
  }

  return (
    <>
      {/* Chat Button */}
      <Button
        onClick={() => {
          if (selectedConversation && isMinimized) {
            setIsMinimized(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-700 shadow-lg z-50"
      >
        <MessageCircle className="w-6 h-6" />
        {totalUnread > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white px-2 py-0.5 text-xs">
            {totalUnread}
          </Badge>
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && !selectedConversation && (
        <div className="fixed bottom-20 right-4 w-96 bg-white rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-4 flex items-center justify-between">
            <h3 className="font-semibold">💬 Suporte Voxx</h3>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {showNewChat ? (
              <form onSubmit={handleStartChat} className="space-y-4">
                <div>
                  <Label>Assunto</Label>
                  <Input
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    placeholder="Ex: Dúvida sobre saldo"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Mensagem</Label>
                  <Textarea
                    value={primeiraMsg}
                    onChange={(e) => setPrimeiraMsg(e.target.value)}
                    placeholder="Descreva sua dúvida ou solicitação..."
                    className="mt-1 h-24"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewChat(false)}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createConversation.isPending}
                    className="flex-1 bg-violet-600 hover:bg-violet-700"
                  >
                    Iniciar Chat
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 mb-4">
                  Como podemos ajudar você hoje?
                </p>
                
                {activeConversations.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-xs text-slate-500 mb-2 block">Conversas Ativas</Label>
                    <div className="space-y-2">
                      {activeConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {conv.assunto || 'Chat de Suporte'}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                {conv.ultima_mensagem}
                              </p>
                            </div>
                            {(conv.nao_lidas_cliente || 0) > 0 && (
                              <Badge className="bg-violet-600 text-white ml-2">
                                {conv.nao_lidas_cliente}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setShowNewChat(true)}
                  className="w-full bg-violet-600 hover:bg-violet-700"
                >
                  Iniciar Nova Conversa
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}