import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Search, Clock, CheckCircle, XCircle, AlertCircle, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import ChatWindow from '@/components/chat/ChatWindow';
import { toast } from 'sonner';

export default function GerenciarChats({ user }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ['allChatConversations'],
    queryFn: () => base44.entities.ChatConversation.list('-updated_date', 200),
    refetchInterval: 5000
  });

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = base44.entities.ChatConversation.subscribe((event) => {
      queryClient.invalidateQueries(['allChatConversations']);
    });
    return unsubscribe;
  }, []);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, atendente }) => {
      const updates = { status };
      
      if (status === 'em_atendimento' && atendente) {
        updates.atendente_id = atendente.id;
        updates.atendente_nome = atendente.full_name;
      }
      
      return base44.entities.ChatConversation.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allChatConversations']);
      toast.success('Status atualizado');
    }
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const conversationId = draggableId;
    
    updateStatusMutation.mutate({ 
      id: conversationId, 
      status: newStatus,
      atendente: newStatus === 'em_atendimento' ? user : null
    });
  };

  const filteredConversations = conversations.filter(conv => {
    if (statusFilter !== 'all' && conv.status !== statusFilter) return false;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        conv.cliente_nome?.toLowerCase().includes(search) ||
        conv.usuario_nome?.toLowerCase().includes(search) ||
        conv.assunto?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const statusCounts = {
    all: conversations.length,
    aberto: conversations.filter(c => c.status === 'aberto').length,
    em_atendimento: conversations.filter(c => c.status === 'em_atendimento').length,
    resolvido: conversations.filter(c => c.status === 'resolvido').length,
    fechado: conversations.filter(c => c.status === 'fechado').length
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.nao_lidas_voxx || 0), 0);

  const statusIcons = {
    aberto: <Clock className="w-4 h-4 text-orange-500" />,
    em_atendimento: <MessageCircle className="w-4 h-4 text-blue-500" />,
    resolvido: <CheckCircle className="w-4 h-4 text-green-500" />,
    fechado: <XCircle className="w-4 h-4 text-slate-400" />
  };

  const statusColors = {
    aberto: 'bg-orange-100 text-orange-800',
    em_atendimento: 'bg-blue-100 text-blue-800',
    resolvido: 'bg-green-100 text-green-800',
    fechado: 'bg-slate-100 text-slate-600'
  };

  if (selectedConversation) {
    return (
      <div className="h-[calc(100vh-8rem)]">
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => setSelectedConversation(null)}
          >
            ← Voltar para Lista
          </Button>
        </div>
        <Card className="h-[calc(100%-4rem)]">
          <ChatWindow
            conversation={selectedConversation}
            user={user}
            onClose={() => setSelectedConversation(null)}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar Chats de Suporte</h1>
          <p className="text-slate-600 mt-1">
            {totalUnread > 0 && (
              <span className="text-violet-600 font-semibold">
                {totalUnread} {totalUnread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.aberto}</p>
                <p className="text-sm text-slate-600">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.em_atendimento}</p>
                <p className="text-sm text-slate-600">Em Atendimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.resolvido}</p>
                <p className="text-sm text-slate-600">Resolvidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold">{statusCounts.fechado}</p>
                <p className="text-sm text-slate-600">Fechados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, usuário ou assunto..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Coluna: Aberto */}
          <Card className="bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-orange-500" />
                Aberto ({statusCounts.aberto})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="aberto">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2 min-h-[200px]",
                      snapshot.isDraggingOver && "bg-orange-100 rounded-lg p-2"
                    )}
                  >
                    {conversations
                      .filter(c => c.status === 'aberto')
                      .filter(c => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          c.cliente_nome?.toLowerCase().includes(search) ||
                          c.usuario_nome?.toLowerCase().includes(search) ||
                          c.assunto?.toLowerCase().includes(search)
                        );
                      })
                      .map((conv, index) => (
                        <Draggable key={conv.id} draggableId={conv.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedConversation(conv)}
                              className={cn(
                                "p-3 rounded-lg border bg-white cursor-pointer transition-all hover:shadow-md",
                                (conv.nao_lidas_voxx || 0) > 0 && "ring-2 ring-violet-400",
                                snapshot.isDragging && "shadow-lg rotate-2"
                              )}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-slate-900 truncate">
                                    {conv.cliente_nome}
                                  </h4>
                                  {(conv.nao_lidas_voxx || 0) > 0 && (
                                    <Badge className="bg-violet-600 text-white text-xs mt-1">
                                      {conv.nao_lidas_voxx} nova{conv.nao_lidas_voxx > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 mb-1">
                                {conv.usuario_nome}
                              </p>
                              {conv.assunto && (
                                <p className="text-xs text-slate-500 font-medium mb-1 truncate">
                                  {conv.assunto}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {conv.ultima_mensagem}
                              </p>
                              <span className="text-xs text-slate-400 mt-2 block">
                                {conv.ultima_mensagem_em && format(new Date(conv.ultima_mensagem_em), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Coluna: Em Atendimento */}
          <Card className="bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                Em Atendimento ({statusCounts.em_atendimento})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="em_atendimento">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2 min-h-[200px]",
                      snapshot.isDraggingOver && "bg-blue-100 rounded-lg p-2"
                    )}
                  >
                    {conversations
                      .filter(c => c.status === 'em_atendimento')
                      .filter(c => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          c.cliente_nome?.toLowerCase().includes(search) ||
                          c.usuario_nome?.toLowerCase().includes(search) ||
                          c.assunto?.toLowerCase().includes(search)
                        );
                      })
                      .map((conv, index) => (
                        <Draggable key={conv.id} draggableId={conv.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedConversation(conv)}
                              className={cn(
                                "p-3 rounded-lg border bg-white cursor-pointer transition-all hover:shadow-md",
                                (conv.nao_lidas_voxx || 0) > 0 && "ring-2 ring-violet-400",
                                snapshot.isDragging && "shadow-lg rotate-2"
                              )}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-slate-900 truncate">
                                    {conv.cliente_nome}
                                  </h4>
                                  {(conv.nao_lidas_voxx || 0) > 0 && (
                                    <Badge className="bg-violet-600 text-white text-xs mt-1">
                                      {conv.nao_lidas_voxx} nova{conv.nao_lidas_voxx > 1 ? 's' : ''}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 mb-1">
                                {conv.usuario_nome}
                              </p>
                              {conv.atendente_nome && (
                                <p className="text-xs text-blue-600 mb-1">
                                  👤 {conv.atendente_nome}
                                </p>
                              )}
                              {conv.assunto && (
                                <p className="text-xs text-slate-500 font-medium mb-1 truncate">
                                  {conv.assunto}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {conv.ultima_mensagem}
                              </p>
                              <span className="text-xs text-slate-400 mt-2 block">
                                {conv.ultima_mensagem_em && format(new Date(conv.ultima_mensagem_em), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Coluna: Resolvido */}
          <Card className="bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Resolvido ({statusCounts.resolvido})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="resolvido">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2 min-h-[200px]",
                      snapshot.isDraggingOver && "bg-green-100 rounded-lg p-2"
                    )}
                  >
                    {conversations
                      .filter(c => c.status === 'resolvido')
                      .filter(c => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          c.cliente_nome?.toLowerCase().includes(search) ||
                          c.usuario_nome?.toLowerCase().includes(search) ||
                          c.assunto?.toLowerCase().includes(search)
                        );
                      })
                      .map((conv, index) => (
                        <Draggable key={conv.id} draggableId={conv.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedConversation(conv)}
                              className={cn(
                                "p-3 rounded-lg border bg-white cursor-pointer transition-all hover:shadow-md",
                                snapshot.isDragging && "shadow-lg rotate-2"
                              )}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-slate-900 truncate">
                                    {conv.cliente_nome}
                                  </h4>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 mb-1">
                                {conv.usuario_nome}
                              </p>
                              {conv.atendente_nome && (
                                <p className="text-xs text-green-600 mb-1">
                                  👤 {conv.atendente_nome}
                                </p>
                              )}
                              {conv.assunto && (
                                <p className="text-xs text-slate-500 font-medium mb-1 truncate">
                                  {conv.assunto}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {conv.ultima_mensagem}
                              </p>
                              <span className="text-xs text-slate-400 mt-2 block">
                                {conv.ultima_mensagem_em && format(new Date(conv.ultima_mensagem_em), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>

          {/* Coluna: Fechado */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-slate-400" />
                Fechado ({statusCounts.fechado})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="fechado">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2 min-h-[200px]",
                      snapshot.isDraggingOver && "bg-slate-100 rounded-lg p-2"
                    )}
                  >
                    {conversations
                      .filter(c => c.status === 'fechado')
                      .filter(c => {
                        if (!searchTerm) return true;
                        const search = searchTerm.toLowerCase();
                        return (
                          c.cliente_nome?.toLowerCase().includes(search) ||
                          c.usuario_nome?.toLowerCase().includes(search) ||
                          c.assunto?.toLowerCase().includes(search)
                        );
                      })
                      .map((conv, index) => (
                        <Draggable key={conv.id} draggableId={conv.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedConversation(conv)}
                              className={cn(
                                "p-3 rounded-lg border bg-white cursor-pointer transition-all hover:shadow-md opacity-75",
                                snapshot.isDragging && "shadow-lg rotate-2"
                              )}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm text-slate-900 truncate">
                                    {conv.cliente_nome}
                                  </h4>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 mb-1">
                                {conv.usuario_nome}
                              </p>
                              {conv.atendente_nome && (
                                <p className="text-xs text-slate-500 mb-1">
                                  👤 {conv.atendente_nome}
                                </p>
                              )}
                              {conv.assunto && (
                                <p className="text-xs text-slate-500 font-medium mb-1 truncate">
                                  {conv.assunto}
                                </p>
                              )}
                              <p className="text-xs text-slate-500 line-clamp-2">
                                {conv.ultima_mensagem}
                              </p>
                              <span className="text-xs text-slate-400 mt-2 block">
                                {conv.ultima_mensagem_em && format(new Date(conv.ultima_mensagem_em), 'dd/MM HH:mm')}
                              </span>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>
        </div>
      </DragDropContext>
    </div>
  );
}