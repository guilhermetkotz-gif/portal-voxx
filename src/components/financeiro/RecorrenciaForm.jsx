import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RecorrenciaForm({ form, setForm }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
      <div>
        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Recorrência</Label>
        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recorrente"
              checked={!form.recorrente}
              onChange={() => setForm(f => ({ ...f, recorrente: false, quantidade_meses: '' }))}
              className="accent-violet-600"
            />
            <span className="text-sm text-slate-700">Não recorrente (lançamento único)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="recorrente"
              checked={!!form.recorrente}
              onChange={() => setForm(f => ({ ...f, recorrente: true }))}
              className="accent-violet-600"
            />
            <span className="text-sm text-slate-700">Recorrente</span>
          </label>
        </div>
      </div>

      {form.recorrente && (
        <div className="grid grid-cols-1 gap-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frequência</Label>
              <Select value={form.frequencia || 'mensal'} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Quantidade de meses *</Label>
              <Input
                type="number"
                min="1"
                max="120"
                placeholder="Ex: 12"
                value={form.quantidade_meses || ''}
                onChange={e => setForm(f => ({ ...f, quantidade_meses: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Data de Início *</Label>
            <Input type="date" value={form.data_inicio || ''} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className="mt-1" />
          </div>
          <p className="text-[11px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-3 py-2">
            💡 Ao salvar, os lançamentos serão gerados automaticamente como <strong>Previsto</strong> para os próximos <strong>{form.quantidade_meses || '?'} meses</strong> a partir da data de início.
          </p>
        </div>
      )}
    </div>
  );
}