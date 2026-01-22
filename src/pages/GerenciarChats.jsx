import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Search, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
    mutationFn: ({ id, status }) => {
      const updates = { status };
      
      if (status === 'em_atendimento' && !selectedConversation?.atendente_id) {
        updates.atendente_id = user.id;
        updates.atendente_nome = user.full_name;
      }
      
      return base44.entities.ChatConversation.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allChatConversations']);
      toast.success('Status atualizado');
    }
  });

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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cliente, usuário ou assunto..."
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle>Conversas ({filteredConversations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                  (conv.nao_lidas_voxx || 0) > 0 ? "bg-violet-50 border-violet-200" : "bg-white border-slate-200"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-slate-900">
                        {conv.cliente_nome}
                      </h4>
                      <Badge className={statusColors[conv.status]}>
                        {conv.status}
                      </Badge>
                      {(conv.nao_lidas_voxx || 0) > 0 && (
                        <Badge className="bg-violet-600 text-white">
                          {conv.nao_lidas_voxx} nova{conv.nao_lidas_voxx > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      <span className="font-medium">{conv.usuario_nome}</span>
                      {conv.assunto && ` • ${conv.assunto}`}
                    </p>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {conv.ultima_mensagem}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-slate-500">
                      {conv.ultima_mensagem_em && format(new Date(conv.ultima_mensagem_em), 'dd/MM HH:mm')}
                    </span>
                    {conv.atendente_nome && (
                      <span className="text-xs text-slate-600">
                        👤 {conv.atendente_nome}
                      </span>
                    )}
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: conv.id, status: 'em_atendimento' });
                        }}
                        disabled={conv.status === 'em_atendimento'}
                      >
                        Atender
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatusMutation.mutate({ id: conv.id, status: 'resolvido' });
                        }}
                        disabled={conv.status === 'resolvido'}
                      >
                        Resolver
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredConversations.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Nenhuma conversa encontrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}