import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Loader2, Upload, Link, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = ['Imagem', 'Vídeo', 'Landing Page', 'Documento', 'PDF', 'Link', 'Relatório', 'Automação', 'Outro'];

const gerarToken = () => Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

export default function NovaEntregaModal({ demanda, user, onClose, entregaExistente }) {
  const queryClient = useQueryClient();
  const isEdit = !!entregaExistente;

  const [form, setForm] = useState({
    nome_entrega: entregaExistente?.nome_entrega || '',
    descricao: entregaExistente?.descricao || '',
    tipo_entrega: entregaExistente?.tipo_entrega || 'Imagem',
    link_externo: entregaExistente?.link_externo || '',
    observacao_interna: entregaExistente?.observacao_interna || '',
  });
  const [arquivos, setArquivos] = useState(entregaExistente?.arquivos || []);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const novos = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      novos.push({ url: file_url, nome: file.name, tipo: file.type });
    }
    setArquivos(prev => [...prev, ...novos]);
    setUploading(false);
    toast.success(`${novos.length} arquivo(s) enviado(s)!`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const agora = new Date().toISOString();
      if (isEdit) {
        // Nova versão: arquivar versão atual e incrementar número
        const versoes = [...(entregaExistente.versoes || [])];
        const numeroAtual = entregaExistente.numero_versao_atual || 1;
        versoes.push({
          numero: numeroAtual,
          arquivos: entregaExistente.arquivos || [],
          link_externo: entregaExistente.link_externo || '',
          data_upload: entregaExistente.data_envio || entregaExistente.created_date,
          usuario_nome: entregaExistente.usuario_envio_nome || '',
          observacao: entregaExistente.observacao_interna || ''
        });
        const updates = {
          ...form,
          arquivos,
          versoes,
          numero_versao_atual: numeroAtual + 1,
          status_entrega: 'reenviado',
          data_envio: agora,
          usuario_envio: user?.email,
          usuario_envio_nome: user?.full_name || user?.email
        };
        await base44.entities.EntregaDemanda.update(entregaExistente.id, updates);
        // Timeline
        await base44.entities.TimelineEvent.create({
          demanda_id: demanda.id,
          cliente_id: demanda.cliente_id,
          tipo: 'entrega',
          descricao: `📦 Nova versão enviada: ${form.nome_entrega} (v${numeroAtual + 1})`,
          autor: user?.full_name || user?.email,
          autor_tipo: 'voxx'
        });
      } else {
        const token = gerarToken();
        const novaEntrega = await base44.entities.EntregaDemanda.create({
          ...form,
          arquivos,
          demanda_id: demanda.id,
          demanda_titulo: demanda.titulo,
          cliente_id: demanda.cliente_id,
          cliente_nome: demanda.cliente_nome,
          status_entrega: 'enviado',
          data_envio: agora,
          usuario_envio: user?.email,
          usuario_envio_nome: user?.full_name || user?.email,
          token_publico: token,
          numero_versao_atual: 1,
          versoes: []
        });
        // Timeline
        await base44.entities.TimelineEvent.create({
          demanda_id: demanda.id,
          cliente_id: demanda.cliente_id,
          tipo: 'entrega',
          descricao: `📦 Material enviado para aprovação: ${form.nome_entrega}`,
          autor: user?.full_name || user?.email,
          autor_tipo: 'voxx'
        });
        return novaEntrega;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas', demanda.id] });
      queryClient.invalidateQueries({ queryKey: ['timeline', demanda.id] });
      toast.success(isEdit ? 'Nova versão enviada!' : 'Entrega criada!');
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{isEdit ? `Nova Versão — ${entregaExistente.nome_entrega}` : 'Nova Entrega'}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-4">
          {!isEdit && (
            <>
              <div>
                <Label>Nome da Entrega *</Label>
                <Input value={form.nome_entrega} onChange={e => set('nome_entrega', e.target.value)} placeholder="Ex: Arte Feed 01" />
              </div>
              <div>
                <Label>Tipo</Label>
                <select value={form.tipo_entrega} onChange={e => set('tipo_entrega', e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <Label>Descrição / Observação Interna</Label>
            <Textarea value={form.observacao_interna} onChange={e => set('observacao_interna', e.target.value)}
              placeholder="Instruções internas..." className="min-h-[70px]" />
          </div>

          <div>
            <Label className="flex items-center gap-1"><Link className="w-3.5 h-3.5" /> Link Externo</Label>
            <Input value={form.link_externo} onChange={e => set('link_externo', e.target.value)}
              placeholder="Drive, Dropbox, Vimeo, YouTube..." />
          </div>

          <div>
            <Label className="flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload de Arquivos</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center">
              <input type="file" multiple id="entrega-upload" className="hidden" onChange={handleUpload} disabled={uploading} />
              <label htmlFor="entrega-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                    <span className="text-sm text-slate-500">Enviando...</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Clique para enviar arquivos</p>
                )}
              </label>
            </div>
            {arquivos.length > 0 && (
              <div className="mt-2 space-y-1">
                {arquivos.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                    <span className="flex items-center gap-1 text-slate-600 truncate"><Paperclip className="w-3 h-3" />{a.nome}</span>
                    <button onClick={() => setArquivos(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 ml-2">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || (!form.nome_entrega && !isEdit)}
              className="bg-violet-600 hover:bg-violet-700 flex-1">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Enviar Nova Versão' : 'Criar Entrega'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}