import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from 'react-markdown';
import { 
  Loader2, 
  TrendingUp, 
  Lightbulb, 
  Megaphone, 
  Sparkles,
  BookOpen,
  Calendar,
  Plus,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CriarNewsletterModal from '@/components/newsletter/CriarNewsletterModal';

const categoriaConfig = {
  otimizacao: { label: 'Otimização', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700' },
  boas_praticas: { label: 'Boas Práticas', icon: Lightbulb, color: 'bg-amber-100 text-amber-700' },
  tendencias: { label: 'Tendências', icon: Sparkles, color: 'bg-purple-100 text-purple-700' },
  comunicado: { label: 'Comunicado', icon: Megaphone, color: 'bg-blue-100 text-blue-700' },
  novidade: { label: 'Novidade', icon: Sparkles, color: 'bg-pink-100 text-pink-700' }
};

function NewsletterCard({ newsletter, onClick, onEdit, isAdmin }) {
  const config = categoriaConfig[newsletter.categoria] || categoriaConfig.comunicado;
  const Icon = config.icon;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick?.(newsletter)}
    >
      {newsletter.imagem_url && (
        <div className="h-40 bg-slate-100 overflow-hidden">
          <img 
            src={newsletter.imagem_url} 
            alt={newsletter.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
          <span className="text-xs text-slate-400">
            {format(new Date(newsletter.data_publicacao || newsletter.created_date), "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>
        <h3 className="font-semibold text-slate-900 text-lg mb-2">{newsletter.titulo}</h3>
        <p className="text-sm text-slate-500 line-clamp-3">
          {newsletter.conteudo?.replace(/[#*_]/g, '').substring(0, 150)}...
        </p>
        
        {isAdmin && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(newsletter);
              }}
              className="w-full"
            >
              <Edit className="w-3 h-3 mr-2" />
              Editar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function NewsletterModal({ newsletter, open, onClose }) {
  if (!open || !newsletter) return null;

  const config = categoriaConfig[newsletter.categoria] || categoriaConfig.comunicado;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {newsletter.imagem_url && (
          <div className="h-48 bg-slate-100 overflow-hidden">
            <img 
              src={newsletter.imagem_url} 
              alt={newsletter.titulo}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Badge className={config.color}>
              <Icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            <span className="text-sm text-slate-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(newsletter.data_publicacao || newsletter.created_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{newsletter.titulo}</h1>
          
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown>{newsletter.conteudo}</ReactMarkdown>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-6 w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Newsletter() {
  const [selectedNewsletter, setSelectedNewsletter] = useState(null);
  const [categoriaFilter, setCategoriaFilter] = useState('all');
  const [criarModalOpen, setCriarModalOpen] = useState(false);
  const [editingNewsletter, setEditingNewsletter] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000
  });

  const isAdmin = user?.role === 'admin' || user?.tipo_usuario === 'voxx_admin' || user?.tipo_usuario === 'voxx_manager';

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', user?.cliente_id],
    queryFn: () => base44.entities.Cliente.filter({ id: user?.cliente_id }),
    enabled: !!user?.cliente_id,
    staleTime: 60 * 1000
  });

  const cliente = clientes[0];

  const { data: newsletters = [], isLoading } = useQuery({
    queryKey: ['newsletters'],
    queryFn: () => {
      if (isAdmin) {
        return base44.entities.Newsletter.list('-created_date', 100);
      }
      return base44.entities.Newsletter.filter({ publicado: true }, '-created_date', 50);
    },
    staleTime: 5 * 60 * 1000
  });

  // Filter by cliente segment
  const filteredNewsletters = newsletters
    .filter(n => {
      if (!n.segmento?.length) return true;
      if (!cliente?.tipo_cliente) return true;
      return n.segmento.includes(cliente.tipo_cliente) || n.segmento.includes('todos');
    })
    .filter(n => categoriaFilter === 'all' || n.categoria === categoriaFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-slate-500">
            Fique por dentro das novidades, otimizações e boas práticas do tráfego pago.
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setCriarModalOpen(true)}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Newsletter
          </Button>
        )}
      </div>

      {/* Filters */}
      <Tabs value={categoriaFilter} onValueChange={setCategoriaFilter}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="otimizacao">Otimizações</TabsTrigger>
          <TabsTrigger value="boas_praticas">Boas Práticas</TabsTrigger>
          <TabsTrigger value="tendencias">Tendências</TabsTrigger>
          <TabsTrigger value="comunicado">Comunicados</TabsTrigger>
          <TabsTrigger value="novidade">Novidades</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {filteredNewsletters.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Nenhuma publicação encontrada.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNewsletters.map(newsletter => (
            <NewsletterCard 
              key={newsletter.id} 
              newsletter={newsletter}
              onClick={setSelectedNewsletter}
              onEdit={setEditingNewsletter}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modal de Visualização */}
      <NewsletterModal 
        newsletter={selectedNewsletter}
        open={!!selectedNewsletter}
        onClose={() => setSelectedNewsletter(null)}
      />

      {/* Modal de Criação */}
      <CriarNewsletterModal
        open={criarModalOpen}
        onOpenChange={setCriarModalOpen}
      />

      {/* Modal de Edição */}
      <CriarNewsletterModal
        open={!!editingNewsletter}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingNewsletter(null);
        }}
        newsletter={editingNewsletter}
      />
    </div>
  );
}