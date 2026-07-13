import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Paperclip, X, Loader2, Send, Link as LinkIcon, FileText, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ALTERACAO_TAG = 'ajuste-manual';
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

export default function AlteracaoManualPopover({ demanda, onUpdateTags, hasAjusteManual }) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [link, setLink] = useState('');
  const [anexo, setAnexo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_SIZE) { toast.error('Arquivo muito grande. Máximo 25MB.'); return; }
    if (!TIPOS_PERMITIDOS.includes(file.type) && !file.type.startsWith('image/')) {
      toast.error('Formato não suportado.');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Sem URL');
      setAnexo({
        name: file.name,
        url: file_url,
        isImage: file.type.startsWith('image/'),
        isVideo: file.type.startsWith('video/'),
        tipo: file.type,
      });
      toast.success('Arquivo anexado!');
    } catch {
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      let descricao = texto.trim();
      if (link.trim()) descricao += (descricao ? '\n' : '') + `🔗 ${link.trim()}`;
      if (anexo) descricao += (descricao ? '\n' : '') + `[Arquivo: ${anexo.name}]`;
      if (!descricao) throw new Error('Descreva a alteração ou anexe um arquivo.');

      const user = await base44.auth.me();

      await base44.entities.TimelineEvent.create({
        demanda_id: demanda.id,
        cliente_id: demanda.cliente_id,
        tipo: 'alteracao_manual',
        descricao,
        autor: user?.full_name || user?.email,
        autor_tipo: 'voxx',
        anexo_url: anexo?.url || null,
      });

      const currentTags = demanda.tags || [];
      if (!currentTags.includes(ALTERACAO_TAG)) {
        await base44.entities.Demanda.update(demanda.id, {
          tags: [...currentTags, ALTERACAO_TAG],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alteracoesManuais', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['demandasKanban'] });
      queryClient.invalidateQueries({ queryKey: ['demanda', demanda.id] });
      toast.success('Alteração registrada e demanda sinalizada!');
      setTexto('');
      setLink('');
      setAnexo(null);
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const handleRemove = (e) => {
    e.stopPropagation();
    const currentTags = demanda.tags || [];
    onUpdateTags(currentTags.filter((t) => t !== ALTERACAO_TAG));
  };

  const canSubmit = (texto.trim() || anexo || link.trim()) && !uploading && !salvarMutation.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 text-xs',
            hasAjusteManual
              ? 'border-orange-500 text-orange-700 bg-orange-100 hover:bg-orange-200'
              : 'border-orange-300 text-orange-600 hover:bg-orange-50'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          {hasAjusteManual ? 'Sinalizada' : 'Sinalizar Alteração'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3 space-y-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Descrever Alteração
          </span>
          {hasAjusteManual && (
            <Button variant="ghost" size="sm" className="h-6 text-xs text-orange-600" onClick={handleRemove}>
              Remover
            </Button>
          )}
        </div>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva a alteração..."
          className="min-h-[60px] border-orange-200 focus-visible:ring-orange-400"
        />

        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-orange-500 shrink-0" />
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Cole um link"
            className="h-8 border-orange-200 focus-visible:ring-orange-400"
          />
        </div>

        {anexo && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
            {anexo.isImage ? (
              <div className="space-y-1.5">
                <img src={anexo.url} alt={anexo.name} className="w-full rounded border border-orange-300" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-orange-700 truncate">{anexo.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setAnexo(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {anexo.isVideo ? <Video className="h-3.5 w-3.5 text-orange-600" /> : <FileText className="h-3.5 w-3.5 text-orange-600" />}
                  <span className="text-xs text-orange-700 truncate">{anexo.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setAnexo(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => salvarMutation.mutate()}
            disabled={!canSubmit}
            className="bg-orange-600 text-white hover:bg-orange-700 flex-1"
          >
            {salvarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
          <Button variant="outline" size="sm" disabled={uploading} asChild className="border-orange-300 text-orange-700">
            <label className="cursor-pointer">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
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
      </PopoverContent>
    </Popover>
  );
}