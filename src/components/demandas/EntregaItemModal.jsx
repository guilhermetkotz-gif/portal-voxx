import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, Loader2, Upload, Link as LinkIcon, Paperclip, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = ['Imagem', 'Vídeo', 'Landing Page', 'Documento', 'PDF', 'Link', 'Relatório', 'Automação', 'Outro'];

/**
 * Modal para criar primeira entrega de um item ou nova versão.
 * Toda a operação passa pelo backend gerenciarEntregaItem.
 *
 * Props:
 *  - mode: 'criar' | 'nova_versao'
 *  - item: ItemDemanda
 *  - demanda: Demanda
 *  - entregaAtual: EntregaDemanda ativa (para nova_versao)
 *  - onClose: callback
 *  - onSaved: callback após salvar
 */
export default function EntregaItemModal({ mode, item, demanda, entregaAtual, user, onClose, onSaved }) {
  const isNovaVersao = mode === 'nova_versao';

  // idempotency_key criada UMA VEZ e preservada em todos os retries
  const [idempotencyKey] = useState(() =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2)}`
  );

  const [form, setForm] = useState({
    nome_entrega: isNovaVersao ? entregaAtual?.nome_entrega || '' : item?.titulo || '',
    descricao: isNovaVersao ? entregaAtual?.descricao || '' : '',
    tipo_entrega: isNovaVersao ? entregaAtual?.tipo_entrega || 'Imagem' : 'Imagem',
    link_externo: '',
    observacao_interna: '',
    observacao_voxx: '',
  });
  const [arquivos, setArquivos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmarReabertura, setConfirmarReabertura] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const exigeConfirmacao = isNovaVersao && entregaAtual?.status_entrega === 'aprovado';

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
      const action = isNovaVersao ? 'criar_nova_versao' : 'criar_entrega_item';
      // idempotencyKey preservada entre retries (definida no useState)
      // Fase 2A: modelo entidade_versao ativo apenas para "Cronograma de testes Fase 2"
      const isTesteFase2 = demanda?.titulo === 'Cronograma de testes Fase 2';
      const payload = {
        action,
        item_id: item.id,
        demanda_id: demanda.id,
        nome_entrega: form.nome_entrega,
        descricao: form.descricao || null,
        tipo_entrega: form.tipo_entrega,
        arquivos: arquivos.length > 0 ? arquivos : (isNovaVersao ? entregaAtual?.arquivos || [] : []),
        link_externo: form.link_externo || null,
        observacao_interna: form.observacao_interna || null,
        observacao_voxx: form.observacao_voxx || null,
        idempotency_key: idempotencyKey,
        ...(isTesteFase2 ? { modelo_versionamento: 'entidade_versao' } : {}),
      };
      if (exigeConfirmacao && confirmarReabertura) {
        payload.confirmar_reabertura = true;
      }
      const res = await base44.functions.invoke('gerenciarEntregaItem', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(isNovaVersao ? 'Nova versão criada!' : 'Entrega criada!');
      onSaved();
    },
    onError: (error) => {
      const errData = error?.response?.data;
      // Se exige confirmação de reabertura, mostrar o aviso
      if (errData?.code === 'REABERTURA_APROVADO_REQUER_CONFIRMACAO') {
        setConfirmarReabertura(true);
        toast.warning('A versão atual está aprovada. Confirme a reabertura abaixo.');
      } else {
        toast.error(errData?.error || error.message);
      }
    },
  });

  const podeSalvar = form.nome_entrega?.trim() && form.tipo_entrega &&
    (arquivos.length > 0 || (isNovaVersao && (entregaAtual?.arquivos?.length > 0 || form.link_externo))) &&
    (!exigeConfirmacao || confirmarReabertura);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">
            {isNovaVersao ? `Nova Versão — ${item.titulo}` : `Nova Entrega — ${item.titulo}`}
            {isNovaVersao && entregaAtual && (
              <span className="ml-2 text-xs text-slate-400">(versão atual: v{entregaAtual.numero_versao_atual})</span>
            )}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-4">
          {/* Aviso de reabertura */}
          {exigeConfirmacao && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Reabertura de aprovação</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A versão atual (v{entregaAtual.numero_versao_atual}) está aprovada. Criar uma nova versão reabrirá a aprovação deste item.
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmarReabertura}
                    onChange={e => setConfirmarReabertura(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-amber-800 font-medium">Confirmo a reabertura da aprovação</span>
                </label>
              </div>
            </div>
          )}

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

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)}
              placeholder="Descrição da entrega..." className="min-h-[60px]" />
          </div>

          <div>
            <Label>Observação para o Cliente (visível na página de aprovação)</Label>
            <Textarea value={form.observacao_voxx} onChange={e => set('observacao_voxx', e.target.value)}
              placeholder="Ex: Fizemos ajuste no tom de azul conforme solicitado..." className="min-h-[60px]" />
          </div>

          <div>
            <Label className="flex items-center gap-1"><LinkIcon className="w-3.5 h-3.5" /> Link Externo</Label>
            <Input value={form.link_externo} onChange={e => set('link_externo', e.target.value)}
              placeholder="Drive, Dropbox, Vimeo, YouTube..." />
          </div>

          {!isNovaVersao || arquivos.length > 0 ? (
            <div>
              <Label className="flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload de Arquivos</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center">
                <input type="file" multiple id="entrega-item-upload" className="hidden" onChange={handleUpload} disabled={uploading} />
                <label htmlFor="entrega-item-upload" className="cursor-pointer">
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
          ) : (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500">
                <Paperclip className="w-3 h-3 inline mr-1" />
                A nova versão herda os arquivos da versão anterior por padrão. Para substituí-los, faça upload dos novos arquivos.
              </p>
              <div className="mt-2">
                <input type="file" multiple id="entrega-item-upload" className="hidden" onChange={handleUpload} disabled={uploading} />
                <label htmlFor="entrega-item-upload" className="cursor-pointer text-xs text-violet-600 hover:underline">
                  {uploading ? 'Enviando...' : 'Substituir arquivos'}
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !podeSalvar}
              className="bg-violet-600 hover:bg-violet-700 flex-1">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isNovaVersao ? 'Criar Nova Versão' : 'Criar Entrega'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}