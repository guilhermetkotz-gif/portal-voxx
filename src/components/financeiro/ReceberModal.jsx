import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ReceberModal({ receita, recebimentos = [], onClose }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    valor_principal_pago: '',
    aplicar_juros: false,
    valor_juros: '',
    aplicar_desconto: false,
    valor_desconto: '',
    tipo_recebimento: 'integral',
    comprovante_url: '',
    comprovante_nome: '',
    observacao: '',
  });

  const totalRecebido = recebimentos.reduce((s, r) => s + (r.valor_total_recebido || 0), 0);
  const totalJuros = recebimentos.reduce((s, r) => s + (r.valor_juros || 0), 0);
  const totalDescontos = recebimentos.reduce((s, r) => s + (r.valor_desconto || 0), 0);
  const valorOriginal = receita?.valor_mensal || 0;
  const valorCorrigido = valorOriginal + totalJuros - totalDescontos;
  const saldoPendente = Math.max(0, valorCorrigido - totalRecebido);

  const principal = parseFloat(form.valor_principal_pago) || 0;
  const juros = form.aplicar_juros ? (parseFloat(form.valor_juros) || 0) : 0;
  const desconto = form.aplicar_desconto ? (parseFloat(form.valor_desconto) || 0) : 0;
  const totalEsteRecebimento = principal + juros - desconto;

  const handleUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, comprovante_url: file_url, comprovante_nome: file.name }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!principal || principal <= 0) return;
    setSaving(true);
    await base44.entities.RecebimentoReceita.create({
      receita_id: receita.id,
      data_pagamento: form.data_pagamento,
      valor_principal_pago: principal,
      valor_juros: juros,
      valor_desconto: desconto,
      valor_total_recebido: totalEsteRecebimento,
      tipo_recebimento: form.tipo_recebimento,
      comprovante_url: form.comprovante_url,
      comprovante_nome: form.comprovante_nome,
      observacao: form.observacao,
      registrado_por: user?.full_name || user?.email || '',
      mes_referencia: receita.mes_referencia,
    });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    qc.invalidateQueries({ queryKey: ['fin-recebimentos'] });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento — {receita?.cliente_nome}</DialogTitle>
        </DialogHeader>

        {/* Resumo financeiro */}
        <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-center text-xs mb-1">
          <div>
            <p className="text-slate-400">Valor original</p>
            <p className="font-bold text-slate-800">{fmt(valorOriginal)}</p>
          </div>
          <div>
            <p className="text-slate-400">Total recebido</p>
            <p className="font-bold text-emerald-600">{fmt(totalRecebido)}</p>
          </div>
          <div>
            <p className="text-slate-400">Saldo pendente</p>
            <p className={`font-bold ${saldoPendente > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(saldoPendente)}</p>
          </div>
        </div>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data do pagamento *</Label>
              <Input type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo de recebimento</Label>
              <Select value={form.tipo_recebimento} onValueChange={v => setForm(f => ({ ...f, tipo_recebimento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                  <SelectItem value="quitacao_juros">Quitação com juros</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Valor principal pago (R$) *</Label>
            <Input type="number" placeholder="0,00" value={form.valor_principal_pago}
              onChange={e => setForm(f => ({ ...f, valor_principal_pago: e.target.value }))} />
          </div>

          {/* Juros */}
          <div className="border border-orange-100 rounded-lg p-3 space-y-2 bg-orange-50">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="juros" checked={form.aplicar_juros}
                onChange={e => setForm(f => ({ ...f, aplicar_juros: e.target.checked, valor_juros: '' }))}
                className="w-4 h-4" />
              <Label htmlFor="juros" className="text-orange-700 font-medium">Aplicar juros / multa</Label>
            </div>
            {form.aplicar_juros && (
              <Input type="number" placeholder="Valor dos juros (R$)" value={form.valor_juros}
                onChange={e => setForm(f => ({ ...f, valor_juros: e.target.value }))} className="bg-white" />
            )}
          </div>

          {/* Desconto */}
          <div className="border border-emerald-100 rounded-lg p-3 space-y-2 bg-emerald-50">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="desconto" checked={form.aplicar_desconto}
                onChange={e => setForm(f => ({ ...f, aplicar_desconto: e.target.checked, valor_desconto: '' }))}
                className="w-4 h-4" />
              <Label htmlFor="desconto" className="text-emerald-700 font-medium">Aplicar desconto</Label>
            </div>
            {form.aplicar_desconto && (
              <Input type="number" placeholder="Valor do desconto (R$)" value={form.valor_desconto}
                onChange={e => setForm(f => ({ ...f, valor_desconto: e.target.value }))} className="bg-white" />
            )}
          </div>

          {/* Total calculado */}
          {principal > 0 && (
            <div className="bg-slate-900 text-white rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-slate-300">Total deste recebimento</span>
              <span className="text-lg font-bold">{fmt(totalEsteRecebimento)}</span>
            </div>
          )}

          {/* Comprovante */}
          <div>
            <Label>Comprovante</Label>
            {form.comprovante_url ? (
              <div className="flex items-center gap-2 mt-1">
                <a href={form.comprovante_url} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline truncate flex-1">
                  {form.comprovante_nome || 'Ver comprovante'}
                </a>
                <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, comprovante_url: '', comprovante_nome: '' }))} className="h-6 px-1 text-red-400">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-lg p-3 cursor-pointer hover:border-violet-300 mt-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-500">{uploading ? 'Enviando...' : 'Anexar comprovante (imagem ou PDF)'}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading}
                  onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} />
              </label>
            )}
          </div>

          <div>
            <Label>Observação</Label>
            <Input placeholder="Observação sobre este recebimento..." value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.valor_principal_pago} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}