import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Forward, Users, User } from 'lucide-react';
import { toast } from 'sonner';

export default function ForwardMessageModal({ open, onOpenChange, mensagem }) {
  const [search, setSearch] = useState('');
  const [enviandoPara, setEnviandoPara] = useState(null);

  // Buscar grupos
  const { data: grupos = [], isLoading: loadingGrupos } = useQuery({
    queryKey: ['forwardGrupos'],
    queryFn: () => base44.entities.WhatsappGrupo.list('-ultima_atividade', 200),
    enabled: open,
    staleTime: 30 * 1000,
  });

  // Buscar contatos diretos (mensagens de chats não-grupo)
  const { data: contatos = [], isLoading: loadingContatos } = useQuery({
    queryKey: ['forwardContatos'],
    queryFn: async () => {
      const msgs = await base44.entities.WhatsappMensagem.filter({ is_group: false }, '-received_at', 500);
      // Extrair contatos únicos
      const mapa = {};
      msgs.forEach(m => {
        const key = m.grupo_id || m.remetente_telefone;
        if (key && !mapa[key]) {
          mapa[key] = {
            id: key,
            nome: m.grupo_nome || m.remetente_nome || m.remetente_telefone || key,
            ultima_atividade: m.received_at,
            isGroup: false,
            cliente_id: m.cliente_id || '',
            cliente_nome: m.cliente_nome || '',
          };
        }
      });
      return Object.values(mapa).sort((a, b) => (b.ultima_atividade || '').localeCompare(a.ultima_atividade || ''));
    },
    enabled: open,
    staleTime: 30 * 1000,
  });

  // Combinar e filtrar
  const destinos = useMemo(() => {
    const items = [
      ...grupos.map(g => ({
        id: g.grupo_id,
        nome: g.nome_grupo || g.grupo_id,
        ultima_atividade: g.ultima_atividade,
        isGroup: true,
        cliente_id: g.cliente_id || '',
        cliente_nome: g.cliente_nome || '',
      })),
      ...contatos,
    ];

    if (!search.trim()) return items.slice(0, 30);

    const termo = search.toLowerCase();
    return items.filter(item =>
      item.nome.toLowerCase().includes(termo) ||
      item.cliente_nome.toLowerCase().includes(termo) ||
      item.id.includes(termo)
    ).slice(0, 20);
  }, [grupos, contatos, search]);

  const forwardMutation = useMutation({
    mutationFn: async (destino) => {
      setEnviandoPara(destino.id);

      let tipoMsg = 'texto';
      let midiaUrl = '';
      let fileName = '';

      if (mensagem.tipo_mensagem === 'imagem' && mensagem.midia_url) {
        tipoMsg = 'imagem';
        midiaUrl = mensagem.midia_url;
        fileName = mensagem.midia_nome || 'imagem.png';
      } else if (mensagem.tipo_mensagem === 'video' && mensagem.midia_url) {
        tipoMsg = 'video';
        midiaUrl = mensagem.midia_url;
        fileName = mensagem.midia_nome || 'video.mp4';
      } else if (mensagem.tipo_mensagem === 'audio' && mensagem.midia_url) {
        tipoMsg = 'audio';
        midiaUrl = mensagem.midia_url;
        fileName = mensagem.midia_nome || 'audio.webm';
      } else if (mensagem.tipo_mensagem === 'documento' && mensagem.midia_url) {
        tipoMsg = 'documento';
        midiaUrl = mensagem.midia_url;
        fileName = mensagem.midia_nome || 'documento';
      }

      const res = await base44.functions.invoke('enviarMensagemGeral', {
        chatId: destino.id,
        mensagem: mensagem.mensagem || '',
        tipo: tipoMsg,
        midiaUrl,
        fileName,
        incluirAssinatura: false,
        clienteId: destino.cliente_id || '',
        clienteNome: destino.cliente_nome || '',
        chatName: destino.nome,
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      if (data?.success) {
        toast.success(`Encaminhado para ${variables.nome}`);
      } else {
        toast.error(data?.erro || 'Erro ao encaminhar');
      }
      setEnviandoPara(null);
    },
    onError: (error) => {
      toast.error('Erro ao encaminhar: ' + error.message);
      setEnviandoPara(null);
    },
  });

  const isLoading = loadingGrupos || loadingContatos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5" />
            Encaminhar mensagem
          </DialogTitle>
          <DialogDescription>
            Selecione um grupo ou contato para encaminhar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Prévia da mensagem */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border">
            <p className="font-medium text-slate-500 mb-1">Mensagem:</p>
            {mensagem.tipo_mensagem === 'imagem' ? (
              <div className="flex items-center gap-2">
                <span>📷 Imagem</span>
                {mensagem.mensagem && <span className="text-slate-400">— {mensagem.mensagem.substring(0, 60)}</span>}
              </div>
            ) : mensagem.tipo_mensagem === 'video' ? (
              <span>🎬 Vídeo</span>
            ) : mensagem.tipo_mensagem === 'audio' ? (
              <span>🎵 Áudio</span>
            ) : mensagem.tipo_mensagem === 'documento' ? (
              <span>📄 {mensagem.midia_nome || 'Documento'}</span>
            ) : mensagem.tipo_mensagem === 'sticker' ? (
              <span>🌟 Sticker</span>
            ) : (
              <p className="line-clamp-2">{mensagem.mensagem?.substring(0, 120) || '[Sem conteúdo]'}</p>
            )}
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar grupo ou contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Lista */}
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : destinos.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">
                {search ? 'Nenhum resultado encontrado' : 'Nenhum grupo ou contato disponível'}
              </p>
            ) : (
              destinos.map((destino) => (
                <Button
                  key={destino.id}
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 h-auto text-sm"
                  onClick={() => forwardMutation.mutate(destino)}
                  disabled={enviandoPara === destino.id}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${destino.isGroup ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                    {enviandoPara === destino.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : destino.isGroup ? (
                      <Users className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{destino.nome}</p>
                    {destino.cliente_nome && (
                      <p className="text-xs text-slate-400 truncate">{destino.cliente_nome}</p>
                    )}
                  </div>
                  {enviandoPara === destino.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
                  ) : (
                    <Forward className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}