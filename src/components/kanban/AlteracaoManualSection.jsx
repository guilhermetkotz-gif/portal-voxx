import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Paperclip,
  X,
  Loader2,
  Send,
  Link as LinkIcon,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import moment from 'moment';
import 'moment-timezone';

const MAX_SIZE = 25 * 1024 * 1024;
const TIPOS_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const getAnexoIcon = (tipo) => {
  if (tipo?.startsWith('image/')) return ImageIcon;
  if (tipo?.startsWith('video/')) return Video;
  return FileText;
};

export default function AlteracaoManualSection({ demanda, user, showForm, onCloseForm }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [link, setLink] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: alteracoes = [] } = useQuery({
    queryKey: ['alteracoesManuais', demanda?.id],
    queryFn: () =>
      base44.entities.TimelineEvent.filter(
        { demanda_id: demanda?.id, tipo: 'alteracao_manual' },
        '-created_date',
        50
      ),
    enabled: !!demanda?.id,
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. O tamanho máximo é 25MB.');
      return;
    }
    if (!TIPOS_PERMITIDOS.includes(file.type) && !file.type.startsWith('image/')) {
      toast.error('Formato não suportado. Use imagem, vídeo, PDF ou documento Office.');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('URL do arquivo não retornada');
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      setAnexo({ name: file.name, url: file_url, isImage, isVideo, tipo: file.type });
      toast.success('Arquivo anexado!');
    } catch {
      toast.error('Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      let descricao = texto.trim();
      if (link.trim()) {
        descricao += (descricao ? '\n' : '') + `🔗 ${link.trim()}`;
      }
      if (anexo) {
        descricao += (descricao ? '\n' : '') + `[Arquivo: ${anexo.name}]`;
      }
      if (!descricao) throw new Error('Descreva a alteração ou anexe um arquivo.');

      await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: demanda.cliente_id,
        tipo: 'alteracao_manual',
        descricao,
        autor: user?.full_name || user?.email,
        autor_tipo: 'voxx',
        anexo_url: anexo?.url || null,
      });

      // Marca a tag ajuste-manual na demanda
      const currentTags = demanda.tags || [];
      if (!currentTags.includes('ajuste-manual')) {
        await base44.entities.Demanda.update(demanda.id, {
          tags: [...currentTags, 'ajuste-manual'],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alteracoesManuais', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['demanda', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      toast.success('Alteração registrada e demanda sinalizada!');
      setTexto('');
      setLink('');
      setAnexo(null);
      onCloseForm();
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const canSubmit = (texto.trim() || anexo || link.trim()) && !uploading && !salvarMutation.isPending;

  return (
    <>
      {/* Formulário de alteração */}
      {showForm && (
        <Card className="border-orange-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                Descrever Alteração
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCloseForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva a alteração solicitada..."
              className="min-h-[80px] border-orange-200 focus-visible:ring-orange-400"
            />

            {/* Link */}
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-orange-500 shrink-0" />
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Cole um link (Drive, Vimeo, etc.)"
                className="border-orange-200 focus-visible:ring-orange-400"
              />
            </div>

            {/* Anexo preview */}
            {anexo && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                {anexo.isImage ? (
                  <div className="space-y-2">
                    <img
                      src={anexo.url}
                      alt={anexo.name}
                      className="w-full max-w-xs rounded-md border border-orange-300"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-orange-700">{anexo.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAnexo(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {anexo.isVideo ? (
                        <Video className="h-4 w-4 text-orange-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-orange-600" />
                      )}
                      <span className="text-sm text-orange-700">{anexo.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAnexo(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => salvarMutation.mutate()}
                disabled={!canSubmit}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {salvarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Registrar Alteração
              </Button>
              <Button variant="outline" disabled={uploading} asChild>
                <label className="cursor-pointer flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4" />
                      Anexar
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/mp4,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de alterações registradas */}
      {alteracoes.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-4 w-4" />
              Alterações Sinalizadas ({alteracoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alteracoes.map((event) => {
              const desc = event.descricao || '';
              const linkMatch = desc.match(/🔗\s*(https?:\/\/[^\s]+)/);
              const linkUrl = linkMatch ? linkMatch[1] : null;
              const cleanDesc = desc
                .replace(/🔗\s*https?:\/\/[^\s]+/, '')
                .replace(/\[Arquivo:\s*[^\]]+\]/, '')
                .trim();

              return (
                <div
                  key={event.id}
                  className="border-l-2 border-orange-400 pl-3 py-1 text-sm"
                >
                  {cleanDesc && (
                    <p className="font-medium text-slate-800 whitespace-pre-wrap">{cleanDesc}</p>
                  )}
                  {linkUrl && (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-orange-600 hover:text-orange-700 text-xs"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {linkUrl}
                    </a>
                  )}
                  {event.anexo_url && (
                    <button
                      type="button"
                      onClick={() => window.open(event.anexo_url, '_blank')}
                      className="flex items-center gap-1 mt-1 text-orange-600 hover:text-orange-700"
                    >
                      <Paperclip className="h-3 w-3" />
                      Ver anexo
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{event.autor}</span>
                    <span>•</span>
                    <span>
                      {moment(event.created_date).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm')}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}