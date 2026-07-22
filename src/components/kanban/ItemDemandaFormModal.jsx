import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_MATERIAL = ['Arte', 'Vídeo', 'Copy', 'Landing Page', 'Relatório', 'Automação', 'Outro'];
const FORMATOS = ['Feed', 'Story', 'Reels', 'Carrossel', 'Documento', 'Link', 'Outro'];
const CANAIS = ['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'Google', 'Site', 'Outro'];
const STATUS_PRODUCAO = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_fila', label: 'Em fila' },
  { value: 'em_desenvolvimento', label: 'Em desenvolvimento' },
  { value: 'concluido', label: 'Concluído' },
];

/**
 * Modal de criação/edição de um ItemDemanda.
 * Responsável deve ser selecionado entre usuários reais (sem "manual").
 * Todas as operações passam pela função backend gerenciarItemDemanda.
 */
export default function ItemDemandaFormModal({ open, onClose, demandaId, item = null, nextOrdem = 0 }) {
  const queryClient = useQueryClient();
  const isEdit = !!item;

  // Busca usuários VOXX reais para seleção de responsável
  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxxUsersForItems'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listVoxxUsers', {});
      return res.data?.users || res.data || [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo_material: '',
    formato: '',
    canal: '',
    data_prevista: '',
    prazo_data: '',
    responsavel_id: '',
    status_producao: 'nao_iniciado',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        titulo: item.titulo || '',
        descricao: item.descricao || '',
        tipo_material: item.tipo_material || '',
        formato: item.formato || '',
        canal: item.canal || '',
        data_prevista: item.data_prevista ? item.data_prevista.slice(0, 16) : '',
        prazo_data: item.prazo_data ? item.prazo_data.slice(0, 16) : '',
        responsavel_id: item.responsavel_id || '',
        status_producao: item.status_producao || 'nao_iniciado',
      });
    } else {
      setFormData({
        titulo: '',
        descricao: '',
        tipo_material: '',
        formato: '',
        canal: '',
        data_prevista: '',
        prazo_data: '',
        responsavel_id: '',
        status_producao: 'nao_iniciado',
      });
    }
  }, [item, open]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Responsável real ou null (nunca "manual")
      let responsavel_id = null;
      let responsavel_nome = null;
      if (data.responsavel_id) {
        const selectedUser = voxxUsers.find(u => u.id === data.responsavel_id);
        responsavel_id = data.responsavel_id;
        responsavel_nome = selectedUser?.full_name || selectedUser?.email || null;
      }

      const payload = {
        titulo: data.titulo.trim(),
        descricao: data.descricao || null,
        tipo_material: data.tipo_material || null,
        formato: data.formato || null,
        canal: data.canal || null,
        data_prevista: data.data_prevista ? new Date(data.data_prevista).toISOString() : null,
        prazo_data: data.prazo_data ? new Date(data.prazo_data).toISOString() : null,
        responsavel_id,
        responsavel_nome,
        status_producao: data.status_producao,
      };

      if (isEdit) {
        return base44.functions.invoke('gerenciarItemDemanda', {
          action: 'update_item',
          item_id: item.id,
          updates: payload,
        });
      }
      return base44.functions.invoke('gerenciarItemDemanda', {
        action: 'create_item',
        demanda_id: demandaId,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itensDemanda', demandaId] });
      queryClient.invalidateQueries({ queryKey: ['itensDemandaKanban'] });
      queryClient.invalidateQueries({ queryKey: ['itensDemandaPiloto', demandaId] });
      toast.success(isEdit ? 'Item atualizado!' : 'Item criado!');
      onClose();
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error.message;
      toast.error('Erro ao salvar item: ' + msg);
    },
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) {
      toast.error('O título do item é obrigatório.');
      return;
    }
    saveMutation.mutate(formData);
  };

  const inputClass = "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold">{isEdit ? 'Editar Item' : 'Novo Item'}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Aniversário de Balneário Camboriú"
              autoFocus
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes do item..."
              className="min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Material</Label>
              <select
                value={formData.tipo_material}
                onChange={(e) => setFormData({ ...formData, tipo_material: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {TIPOS_MATERIAL.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Formato</Label>
              <select
                value={formData.formato}
                onChange={(e) => setFormData({ ...formData, formato: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <select
                value={formData.canal}
                onChange={(e) => setFormData({ ...formData, canal: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Status de Produção</Label>
              <select
                value={formData.status_producao}
                onChange={(e) => setFormData({ ...formData, status_producao: e.target.value })}
                className={inputClass}
              >
                {STATUS_PRODUCAO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Prevista</Label>
              <Input
                type="datetime-local"
                value={formData.data_prevista}
                onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
              />
            </div>
            <div>
              <Label>Prazo Final</Label>
              <Input
                type="datetime-local"
                value={formData.prazo_data}
                onChange={(e) => setFormData({ ...formData, prazo_data: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Responsável</Label>
            <select
              value={formData.responsavel_id}
              onChange={(e) => setFormData({ ...formData, responsavel_id: e.target.value })}
              className={inputClass}
            >
              <option value="">— Sem responsável —</option>
              {voxxUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Selecione um usuário da equipe. Quando vazio, o campo fica nulo.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isEdit ? 'Salvar' : 'Criar Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}