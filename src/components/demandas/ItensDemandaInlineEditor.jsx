import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Edit, Trash2, ChevronUp, ChevronDown, Copy, X, Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_MATERIAL = ['Arte', 'Vídeo', 'Copy', 'Landing Page', 'Relatório', 'Automação', 'Outro'];
const FORMATOS = ['Feed', 'Story', 'Reels', 'Carrossel', 'Documento', 'Link', 'Outro'];
const CANAIS = ['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'Google', 'Site', 'Outro'];

const EMPTY_ITEM = {
  titulo: '',
  descricao: '',
  tipo_material: '',
  formato: '',
  canal: '',
  data_prevista: '',
  prazo_data: '',
  responsavel_id: '',
  responsavel_nome: '',
};

let tempIdCounter = 0;
const genTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

/**
 * Editor inline de itens de demanda composta.
 * Gerencia estado local (não salva no backend — o pai cria os itens após criar a demanda).
 *
 * Props:
 *  - items: array de objetos { tempId, titulo, descricao, tipo_material, formato, canal, data_prevista, prazo_data, responsavel_id, responsavel_nome }
 *  - onChange: callback(items) para atualizar o estado no pai
 */
export default function ItensDemandaInlineEditor({ items, onChange }) {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_ITEM });

  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxxUsersForItems'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listVoxxUsers', {});
      return res.data?.users || res.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleAdd = () => {
    const newItem = { ...EMPTY_ITEM, tempId: genTempId() };
    onChange([...items, newItem]);
    setEditingId(newItem.tempId);
    setFormData({ ...EMPTY_ITEM });
  };

  const handleStartEdit = (item) => {
    setEditingId(item.tempId);
    setFormData({
      titulo: item.titulo || '',
      descricao: item.descricao || '',
      tipo_material: item.tipo_material || '',
      formato: item.formato || '',
      canal: item.canal || '',
      data_prevista: item.data_prevista || '',
      prazo_data: item.prazo_data || '',
      responsavel_id: item.responsavel_id || '',
      responsavel_nome: item.responsavel_nome || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_ITEM });
  };

  const handleSaveEdit = () => {
    if (!formData.titulo.trim()) {
      toast.error('O título da entrega é obrigatório.');
      return;
    }
    let responsavel_nome = '';
    if (formData.responsavel_id) {
      const user = voxxUsers.find(u => u.id === formData.responsavel_id);
      responsavel_nome = user?.full_name || user?.email || '';
    }
    const updatedItems = items.map(item =>
      item.tempId === editingId
        ? { ...item, ...formData, responsavel_nome }
        : item
    );
    onChange(updatedItems);
    setEditingId(null);
    setFormData({ ...EMPTY_ITEM });
  };

  const handleDuplicate = (item) => {
    const dup = { ...item, tempId: genTempId(), titulo: `${item.titulo || 'Item'} (cópia)` };
    const idx = items.findIndex(i => i.tempId === item.tempId);
    const newItems = [...items];
    newItems.splice(idx + 1, 0, dup);
    onChange(newItems);
  };

  const handleRemove = (item) => {
    onChange(items.filter(i => i.tempId !== item.tempId));
    if (editingId === item.tempId) setEditingId(null);
  };

  const handleMove = (index, direction) => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const inputClass = "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Entregas desta demanda — {items.length}
        </Label>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar entrega
        </Button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-sm text-slate-400">Nenhuma entrega adicionada.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Adicionar entrega" para começar.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => {
            const isEditing = editingId === item.tempId;
            return (
              <div
                key={item.tempId}
                className={`rounded-lg border overflow-hidden ${
                  isEditing ? 'border-violet-300 ring-1 ring-violet-200' : 'border-slate-200'
                }`}
              >
                {!isEditing ? (
                  <div className="flex items-center gap-2 p-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.titulo || 'Sem título'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        {item.data_prevista && (
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" /> {formatDate(item.data_prevista)}
                          </span>
                        )}
                        {item.formato && <span>· {item.formato}</span>}
                        {item.canal && <span>· {item.canal}</span>}
                        {item.responsavel_nome && <span>· {item.responsavel_nome}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button type="button" onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleStartEdit(item)} className="p-1 text-slate-400 hover:text-violet-600">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDuplicate(item)} className="p-1 text-slate-400 hover:text-blue-600">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleRemove(item)} className="p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-700">Editando entrega {index + 1}</span>
                      <button type="button" onClick={handleCancelEdit} className="p-1 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-xs">Título *</Label>
                      <Input
                        value={formData.titulo}
                        onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                        placeholder="Ex: Aniversário de Balneário Camboriú"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Textarea
                        value={formData.descricao}
                        onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                        placeholder="Detalhes da entrega..."
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Tipo de material</Label>
                        <select value={formData.tipo_material} onChange={e => setFormData({ ...formData, tipo_material: e.target.value })} className={inputClass}>
                          <option value="">—</option>
                          {TIPOS_MATERIAL.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Formato</Label>
                        <select value={formData.formato} onChange={e => setFormData({ ...formData, formato: e.target.value })} className={inputClass}>
                          <option value="">—</option>
                          {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Canal</Label>
                        <select value={formData.canal} onChange={e => setFormData({ ...formData, canal: e.target.value })} className={inputClass}>
                          <option value="">—</option>
                          {CANAIS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Data prevista</Label>
                        <Input type="datetime-local" value={formData.data_prevista} onChange={e => setFormData({ ...formData, data_prevista: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Prazo final</Label>
                        <Input type="datetime-local" value={formData.prazo_data} onChange={e => setFormData({ ...formData, prazo_data: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Responsável</Label>
                      <select value={formData.responsavel_id} onChange={e => setFormData({ ...formData, responsavel_id: e.target.value })} className={inputClass}>
                        <option value="">— Sem responsável —</option>
                        {voxxUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit}>Cancelar</Button>
                      <Button type="button" size="sm" onClick={handleSaveEdit} className="bg-violet-600 hover:bg-violet-700">Salvar entrega</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}