import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Save, AlertTriangle, CheckCircle2, Settings2 } from 'lucide-react';

const SETOR_CONFIG = {
  ATENDIMENTO:       { label: 'Atendimento',                cor: '#6366f1' },
  TRAFEGO_META:      { label: 'Tráfego – Meta Ads',         cor: '#3b82f6' },
  TRAFEGO_GOOGLE:    { label: 'Tráfego – Google Ads',       cor: '#0ea5e9' },
  TRAFEGO_TIKTOK:    { label: 'Tráfego – TikTok Ads',       cor: '#06b6d4' },
  CRIACAO:           { label: 'Criação (Artes & Peças)',     cor: '#8b5cf6' },
  EDICAO:            { label: 'Edição de Vídeo',             cor: '#a855f7' },
  BI_RELATORIO:      { label: 'Relatórios / BI',             cor: '#ec4899' },
  IMPLANTACAO:       { label: 'Implantação / Acessos',       cor: '#f97316' },
  FINANCEIRO:        { label: 'Financeiro / Administrativo', cor: '#eab308' },
  ALTERACAO_CRIACAO: { label: 'Alteração Criação',           cor: '#84cc16' },
  AUTOMACAO:         { label: 'Automação',                   cor: '#22c55e' },
  SALDOS:            { label: 'Saldos',                      cor: '#14b8a6' },
};

function FieldInput({ label, value, onChange, placeholder, type = 'number' }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      <input
        type={type}
        min={0}
        step={type === 'number' ? 0.5 : undefined}
        value={value}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
}

export default function ConfiguracaoSetoresModal({ onClose, existingConfigs = [] }) {
  const queryClient = useQueryClient();

  const buildInitial = () => {
    const state = {};
    Object.keys(SETOR_CONFIG).forEach(key => {
      const existing = existingConfigs.find(c => c.setor_nome === key);
      state[key] = {
        id: existing?.id || null,
        horas_disponiveis_dia: existing?.horas_disponiveis_dia ?? '',
        custo_diario_setor: existing?.custo_diario_setor ?? '',
        meta_diaria_demandas: existing?.meta_diaria_demandas ?? '',
        observacoes: existing?.observacoes ?? '',
        ativo: existing?.ativo ?? true,
      };
    });
    return state;
  };

  const [forms, setForms] = useState(buildInitial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForms(buildInitial());
  }, [existingConfigs.length]);

  const updateField = (key, field, value) => {
    setForms(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, data] of Object.entries(forms)) {
        const payload = {
          setor_nome: key,
          horas_disponiveis_dia: data.horas_disponiveis_dia === '' ? null : Number(data.horas_disponiveis_dia),
          custo_diario_setor: data.custo_diario_setor === '' ? null : Number(data.custo_diario_setor),
          meta_diaria_demandas: data.meta_diaria_demandas === '' ? null : Number(data.meta_diaria_demandas),
          observacoes: data.observacoes || '',
          ativo: data.ativo,
        };
        if (data.id) {
          await base44.entities.ConfiguracaoSetorOperacional.update(data.id, payload);
        } else if (payload.horas_disponiveis_dia !== null || payload.custo_diario_setor !== null || payload.meta_diaria_demandas !== null) {
          await base44.entities.ConfiguracaoSetorOperacional.create(payload);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['config_setores'] });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1000);
    } finally {
      setSaving(false);
    }
  };

  const semConfig = (key) => {
    const f = forms[key];
    return f.horas_disponiveis_dia === '' && f.custo_diario_setor === '' && f.meta_diaria_demandas === '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">Configurar Setores Operacionais</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <p className="text-sm text-slate-500 px-5 pt-3 pb-1">
          Configure os parâmetros de cada setor para cálculo real de custo, eficiência e capacidade operacional.
        </p>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {Object.entries(SETOR_CONFIG).map(([key, meta]) => (
            <Card key={key} className={`p-4 border ${semConfig(key) ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: meta.cor }} />
                <span className="font-semibold text-slate-800 text-sm">{meta.label}</span>
                {semConfig(key) ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs ml-auto">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Sem configuração
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs ml-auto">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Configurado
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FieldInput
                  label="Horas disponíveis/dia"
                  value={forms[key].horas_disponiveis_dia}
                  onChange={v => updateField(key, 'horas_disponiveis_dia', v)}
                  placeholder="Ex: 8"
                />
                <FieldInput
                  label="Custo diário do setor (R$)"
                  value={forms[key].custo_diario_setor}
                  onChange={v => updateField(key, 'custo_diario_setor', v)}
                  placeholder="Ex: 450"
                />
                <FieldInput
                  label="Meta diária de demandas"
                  value={forms[key].meta_diaria_demandas}
                  onChange={v => updateField(key, 'meta_diaria_demandas', v)}
                  placeholder="Ex: 5"
                />
              </div>
              <div className="mt-2">
                <FieldInput
                  label="Observações"
                  value={forms[key].observacoes}
                  onChange={v => updateField(key, 'observacoes', v)}
                  placeholder="Notas internas sobre este setor..."
                  type="text"
                />
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t bg-slate-50 rounded-b-2xl">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
            {saved ? (
              <><CheckCircle2 className="w-4 h-4 mr-1" /> Salvo!</>
            ) : saving ? (
              <>Salvando...</>
            ) : (
              <><Save className="w-4 h-4 mr-1" /> Salvar Configurações</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}