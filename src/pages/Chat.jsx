import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import ChatWindow from '@/components/chat/ChatWindow';
import { MessageCircle, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Chat({ user, currentCliente }) {
  const [showNewChat, setShowNewChat] = useState(false);
  const [assunto, setAssunto] = useState('');
  const [primeiraMsg, setPrimeiraMsg] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['chatConversations', currentCliente?.id, user?.id],
    queryFn: () => {
      if (!currentCliente) {
        // Voxx users without cliente - show all their conversations
        return base44.entities.ChatConversation.filter(
          { usuario_id: user.id },
          '-updated_date',
          100
        );
      }
      // Regular users - filter by cliente
      return base44.entities.ChatConversation.filter(
        { 
          cliente_id: currentCliente.id,
          usuario_id: user.id
        },
        '-updated_date',
        100
      );
    },
    enabled: !!user,
    refetchInterval: 5000
  });

  const createConversation = useMutation({
    mutationFn: async (data) => {
      const conv = await base44.entities.ChatConversation.create({
        cliente_id: currentCliente?.id,
        cliente_nome: currentCliente?.nome || 'Sistema',
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
      toast.success('Conversa iniciada!');
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

  const activeConversations = conversations.filter(c => c.status !== 'fechado');
  const closedConversations = conversations.filter(c => c.status === 'fechado');

  if (selectedConversation) {
    return (
      <div className="max-w-5xl mx-auto">
        <Button
          variant="outline"
          onClick={() => setSelectedConversation(null)}
          className="mb-4"
        >
          ← Voltar para conversas
        </Button>
        <Card className="h-[calc(100vh-200px)]">
          <ChatWindow
            conversation={selectedConversation}
            user={user}
            currentCliente={currentCliente}
            onClose={() => setSelectedConversation(null)}
            fullPage={true}
          />
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-violet-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-7 h-7" />
              Chat & Suporte
            </h2>
            <p className="text-violet-200 mt-1">
              Entre em contato com nossa equipe para tirar dúvidas ou solicitar ajuda
            </p>
          </div>
          <Button
            onClick={() => setShowNewChat(!showNewChat)}
            className="bg-white text-violet-700 hover:bg-violet-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Conversa
          </Button>
        </div>
      </Card>

      {/* New Chat Form */}
      {showNewChat && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Iniciar Nova Conversa</h3>
          <form onSubmit={handleStartChat} className="space-y-4">
            <div>
              <Label>Assunto</Label>
              <Input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: Dúvida sobre campanhas, solicitação de ajuste..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={primeiraMsg}
                onChange={(e) => setPrimeiraMsg(e.target.value)}
                placeholder="Descreva sua dúvida ou solicitação em detalhes..."
                className="mt-1 h-32"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewChat(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createConversation.isPending}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {createConversation.isPending ? 'Enviando...' : 'Iniciar Chat'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Active Conversations */}
      {activeConversations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Conversas Ativas</h3>
          <div className="grid gap-4">
            {activeConversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-slate-900">
                        {conv.assunto || 'Chat de Suporte'}
                      </h4>
                      <Badge
                        variant={
                          conv.status === 'aberto' ? 'default' :
                          conv.status === 'em_atendimento' ? 'secondary' :
                          'outline'
                        }
                        className="text-xs"
                      >
                        {conv.status === 'aberto' ? 'Aberto' :
                         conv.status === 'em_atendimento' ? 'Em Atendimento' :
                         conv.status === 'resolvido' ? 'Resolvido' : conv.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                      {conv.ultima_mensagem}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        {conv.ultima_mensagem_em 
                          ? format(new Date(conv.ultima_mensagem_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '-'}
                      </span>
                      {conv.atendente_nome && (
                        <span>Atendente: {conv.atendente_nome}</span>
                      )}
                    </div>
                  </div>
                  {(conv.nao_lidas_cliente || 0) > 0 && (
                    <Badge className="bg-violet-600 text-white ml-4">
                      {conv.nao_lidas_cliente} nova{conv.nao_lidas_cliente > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Closed Conversations */}
      {closedConversations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-slate-600">Conversas Encerradas</h3>
          <div className="grid gap-4">
            {closedConversations.map((conv) => (
              <Card
                key={conv.id}
                className="p-5 opacity-75 hover:opacity-100 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-700 mb-2">
                      {conv.assunto || 'Chat de Suporte'}
                    </h4>
                    <p className="text-sm text-slate-600 line-clamp-1 mb-2">
                      {conv.ultima_mensagem}
                    </p>
                    <div className="text-xs text-slate-500">
                      {conv.ultima_mensagem_em 
                        ? format(new Date(conv.ultima_mensagem_em), "dd/MM/yyyy", { locale: ptBR })
                        : '-'}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {conversations.length === 0 && !showNewChat && (
        <Card className="p-12 text-center">
          <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Nenhuma conversa ainda
          </h3>
          <p className="text-slate-600 mb-6">
            Inicie uma nova conversa com nossa equipe de suporte
          </p>
          <Button
            onClick={() => setShowNewChat(true)}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Iniciar Primeira Conversa
          </Button>
        </Card>
      )}
    </div>
  );
}