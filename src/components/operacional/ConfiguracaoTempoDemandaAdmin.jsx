import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Timer, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

const SETORES = [
  { value: 'ATENDIMENTO', label: 'Atendimento' },
  { value: 'TRAFEGO_META', label: 'Tráfego Meta Ads' },
  { value: 'TRAFEGO_GOOGLE', label: 'Tráfego Google Ads' },
  { value: 'TRAFEGO_TIKTOK', label: 'Tráfego TikTok' },
  { value: 'CRIACAO', label: 'Criação' },
  { value: 'EDICAO', label: 'Edição' },
  { value: 'BI_RELATORIO', label: 'BI & Relatórios' },
  { value: 'IMPLANTACAO', label: 'Implantação' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'ALTERACAO_CRIACAO', label: 'Alteração Criação' },
  { value: 'AUTOMACAO', label: 'Automação' },
  { value: 'SALDOS', label: 'Saldos' },
];

const EMPTY_FORM = { setor_principal: '', subcategoria: '', tempo_horas: '', tempo_minutos: '', observacoes: '', ativo: true };

const formatMinutes = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
};

export default function ConfiguracaoTempoDemandaAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['configTempoDemanda'],
    queryFn: () => base44.entities.ConfiguracaoTempoDemanda.list('-created_date', 200),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const totalMin = (parseInt(data.tempo_horas || 0) * 60) + parseInt(data.tempo_minutos || 0);
      const payload = {
        setor_principal: data.setor_principal || null,
        subcategoria: data.subcategoria || null,
        tempo_limite_minutos: totalMin,
        observacoes: data.observacoes || null,
        ativo: data.ativo,
      };
      return editingId
        ? base44.entities.ConfiguracaoTempoDemanda.update(editingId, payload)
        : base44.entities.ConfiguracaoTempoDemanda.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configTempoDemanda'] });
      toast.success(editingId ? 'Configuração atualizada!' : 'Configuração criada!');
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfiguracaoTempoDemanda.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configTempoDemanda'] });
      toast.success('Configuração removida!');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.ConfiguracaoTempoDemanda.update(id, { ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['configTempoDemanda'] }),
  });

  const handleEdit = (config) => {
    setEditingId(config.id);
    setForm({
      setor_principal: config.setor_principal || '',
      subcategoria: config.subcategoria || '',
      tempo_horas: String(Math.floor((config.tempo_limite_minutos || 0) / 60)),
      tempo_minutos: String((config.tempo_limite_minutos || 0) % 60),
      observacoes: config.observacoes || '',
      ativo: config.ativo !== false,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const setor = (val) => SETORES.find(s => s.value === val)?.label || val || '—';

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-violet-600" />
            <CardTitle className="text-base">Configuração de Tempo por Demanda</CardTitle>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}>
              <Plus className="w-4 h-4 mr-1" /> Nova Configuração
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulário */}
        {showForm && (
          <div className="border border-violet-200 bg-violet-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-violet-800">{editingId ? 'Editar Configuração' : 'Nova Configuração'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Setor Principal</Label>
                <select
                  value={form.setor_principal}
                  onChange={e => setForm({ ...form, setor_principal: e.target.value })}
                  className="w-full h-9 mt-1 rounded-md border border-input bg-white px-3 py-1 text-sm"
                >
                  <option value="">Todos os setores</option>
                  {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Subcategoria (opcional)</Label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Arte Feed, Vídeo Reel..."
                  value={form.subcategoria}
                  onChange={e => setForm({ ...form, subcategoria: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Tempo Limite — Horas</Label>
                <Input type="number" min="0" className="mt-1" placeholder="0" value={form.tempo_horas} onChange={e => setForm({ ...form, tempo_horas: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Tempo Limite — Minutos</Label>
                <Input type="number" min="0" max="59" className="mt-1" placeholder="30" value={form.tempo_minutos} onChange={e => setForm({ ...form, tempo_minutos: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações (opcional)</Label>
                <Input className="mt-1" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nenhuma configuração cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {configs.map(config => (
              <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{setor(config.setor_principal)}</span>
                    {config.subcategoria && (
                      <Badge variant="outline" className="text-xs">{config.subcategoria}</Badge>
                    )}
                    <Badge className={config.ativo !== false ? 'bg-green-100 text-green-700 text-xs' : 'bg-slate-100 text-slate-500 text-xs'}>
                      {config.ativo !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Limite: <strong>{formatMinutes(config.tempo_limite_minutos)}</strong>
                    {config.observacoes && ` — ${config.observacoes}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => toggleMutation.mutate({ id: config.id, ativo: !(config.ativo !== false) })}>
                    {config.ativo !== false
                      ? <ToggleRight className="w-4 h-4 text-green-600" />
                      : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(config)}>
                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(config.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}