import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Edit3, Trash2, ChevronUp, ChevronDown, Copy,
  X, Calendar, ChevronDown as ChevronExpand, ChevronRight,
  AlertTriangle, CheckCircle2, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIPOS_MATERIAL = ['Arte', 'Vídeo', 'Copy', 'Landing Page', 'Relatório', 'Automação', 'Outro'];
const FORMATOS = ['Feed', 'Story', 'Reels', 'Carrossel', 'Documento', 'Link', 'Outro'];
const CANAIS = ['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'Google', 'Site', 'Outro'];

const EMPTY_ITEM = {
  titulo: '', descricao: '', tipo_material: '', formato: '',
  canal: '', data_prevista: '', prazo_data: '',
  responsavel_id: '', responsavel_nome: '',
};

let tempIdCounter = 0;
const genTempId = () => `temp_${Date.now()}_${++tempIdCounter}`;

const inputClass = "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function formatDate(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
  catch { return ''; }
}

/** Formulário de edição de uma entrega */
function ItemEditForm({ index, formData, setFormData, voxxUsers, onSave, onCancel }) {
  return (
    <div className="p-4 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-violet-700">Editando entrega {index + 1}</span>
        <button type="button" onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600">
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
        <Label className="text-xs">Descrição específica</Label>
        <Textarea
          value={formData.descricao}
          onChange={e => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Detalhes específicos desta entrega..."
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
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" onClick={onSave} className="bg-violet-600 hover:bg-violet-700">Salvar entrega</Button>
      </div>
    </div>
  );
}

/** Resumo recolhido/expandido de uma entrega */
function ItemSummary({ item, index, isValid, isExpanded, onToggleExpand, onEdit, onDuplicate, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  return (
    <>
      <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-50" onClick={onToggleExpand}>
        <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 truncate">
              {item.titulo || <span className="text-amber-600 italic">Sem título — clique para editar</span>}
            </p>
            {isValid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
          </div>
          {!isExpanded && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap mt-0.5">
              {item.data_prevista && (
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" /> {formatDate(item.data_prevista)}
                </span>
              )}
              {item.formato && <span>· {item.formato}</span>}
              {item.canal && <span>· {item.canal}</span>}
              {item.responsavel_nome && <span>· {item.responsavel_nome}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Mover para cima">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Mover para baixo">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onEdit} className="p-1 text-slate-400 hover:text-violet-600" title="Editar">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDuplicate} className="p-1 text-slate-400 hover:text-blue-600" title="Duplicar entrega">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRemove} className="p-1 text-slate-400 hover:text-red-600" title="Remover entrega">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onToggleExpand} className="p-1 text-slate-400" title={isExpanded ? "Recolher" : "Expandir"}>
            {isExpanded ? <ChevronExpand className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {item.descricao && (
              <div className="col-span-2">
                <span className="text-slate-400">Descrição: </span>
                <span className="text-slate-700">{item.descricao}</span>
              </div>
            )}
            {item.tipo_material && <div><span className="text-slate-400">Tipo: </span><span className="text-slate-700">{item.tipo_material}</span></div>}
            {item.formato && <div><span className="text-slate-400">Formato: </span><span className="text-slate-700">{item.formato}</span></div>}
            {item.canal && <div><span className="text-slate-400">Canal: </span><span className="text-slate-700">{item.canal}</span></div>}
            {item.responsavel_nome && <div><span className="text-slate-400">Responsável: </span><span className="text-slate-700">{item.responsavel_nome}</span></div>}
            {item.data_prevista && <div><span className="text-slate-400">Data prevista: </span><span className="text-slate-700">{formatDate(item.data_prevista)}</span></div>}
            {item.prazo_data && <div><span className="text-slate-400">Prazo final: </span><span className="text-slate-700">{formatDate(item.prazo_data)}</span></div>}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Construtor de entregas para demandas compostas.
 * Permite adicionar, editar, duplicar, remover, reordenar, recolher e expandir cada entrega.
 *
 * Props:
 *  - items: array de objetos (estado controlado pelo pai)
 *  - onChange: callback(items)
 *  - showValidation: exibe mensagens de validação (usado na etapa de revisão)
 */
export default function EntregasDemandaBuilder({ items, onChange, showValidation = false }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_ITEM });

  const { data: voxxUsers = [] } = useQuery({
    queryKey: ['voxxUsersForBuilder'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listVoxxUsers', {});
      return res.data?.users || res.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const validItems = items.filter(i => i.titulo?.trim());
  const hasIncomplete = items.length > validItems.length;

  const handleAdd = () => {
    const newItem = { ...EMPTY_ITEM, tempId: genTempId() };
    onChange([...items, newItem]);
    setEditingId(newItem.tempId);
    setFormData({ ...EMPTY_ITEM });
    setExpandedIds(prev => new Set([...prev, newItem.tempId]));
  };

  const handleStartEdit = (item) => {
    setEditingId(item.tempId);
    setFormData({
      titulo: item.titulo || '', descricao: item.descricao || '',
      tipo_material: item.tipo_material || '', formato: item.formato || '',
      canal: item.canal || '', data_prevista: item.data_prevista || '',
      prazo_data: item.prazo_data || '', responsavel_id: item.responsavel_id || '',
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
      item.tempId === editingId ? { ...item, ...formData, responsavel_nome } : item
    );
    onChange(updatedItems);
    setEditingId(null);
    setFormData({ ...EMPTY_ITEM });
  };

  const handleDuplicate = (item) => {
    const dup = {
      ...EMPTY_ITEM,
      tempId: genTempId(),
      descricao: item.descricao || '',
      tipo_material: item.tipo_material || '',
      formato: item.formato || '',
      canal: item.canal || '',
      responsavel_id: item.responsavel_id || '',
      responsavel_nome: item.responsavel_nome || '',
      titulo: '',
      data_prevista: '',
      prazo_data: '',
    };
    const idx = items.findIndex(i => i.tempId === item.tempId);
    const newItems = [...items];
    newItems.splice(idx + 1, 0, dup);
    onChange(newItems);
    setEditingId(dup.tempId);
    setFormData({ ...dup });
    setExpandedIds(prev => new Set([...prev, dup.tempId]));
    toast.info('Entrega duplicada. Ajuste o título e as datas.');
  };

  const handleRemove = (item) => {
    onChange(items.filter(i => i.tempId !== item.tempId));
    if (editingId === item.tempId) setEditingId(null);
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(item.tempId);
      return next;
    });
  };

  const handleMove = (index, direction) => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  const toggleExpand = (tempId) => {
    if (editingId === tempId) return;
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Entregas desta demanda</Label>
          <span className="ml-2 text-xs text-slate-500">
            {validItems.length} de {items.length} preenchida{validItems.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar entrega
        </Button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <p className="text-sm text-slate-400">Nenhuma entrega adicionada.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "+ Adicionar entrega" para começar.</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, index) => {
            const isEditing = editingId === item.tempId;
            const isExpanded = expandedIds.has(item.tempId) && !isEditing;
            const isValid = item.titulo?.trim();

            const containerClass = isEditing
              ? 'rounded-lg border overflow-hidden transition-all border-violet-300 ring-1 ring-violet-200'
              : !isValid
                ? 'rounded-lg border overflow-hidden transition-all border-amber-200'
                : 'rounded-lg border overflow-hidden transition-all border-slate-200';

            return (
              <div key={item.tempId} className={containerClass}>
                {isEditing ? (
                  <ItemEditForm
                    index={index}
                    formData={formData}
                    setFormData={setFormData}
                    voxxUsers={voxxUsers}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <ItemSummary
                    item={item}
                    index={index}
                    isValid={isValid}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(item.tempId)}
                    onEdit={() => handleStartEdit(item)}
                    onDuplicate={() => handleDuplicate(item)}
                    onRemove={() => handleRemove(item)}
                    onMoveUp={() => handleMove(index, 'up')}
                    onMoveDown={() => handleMove(index, 'down')}
                    canMoveUp={index > 0}
                    canMoveDown={index < items.length - 1}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {showValidation && validItems.length === 1 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Esta solicitação possui apenas uma entrega. Altere para "Uma entrega" ou adicione outra entrega independente.
          </p>
        </div>
      )}
      {showValidation && validItems.length === 0 && items.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            Adicione pelo menos 2 entregas com título preenchido para salvar como demanda composta.
          </p>
        </div>
      )}
      {showValidation && hasIncomplete && validItems.length >= 2 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Existem entregas sem título preenchido. Complete ou remova as entregas pendentes antes de continuar.
          </p>
        </div>
      )}
    </div>
  );
}