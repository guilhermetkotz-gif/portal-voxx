import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Check, Loader2, Upload, X } from 'lucide-react';

const EMPTY_CF = {
  nome: '', unidade: '', valor_mensal: '', tipo_contrato: 'mensal',
  dia_cobranca: '', status: 'ativo', observacoes: '', recorrente: true,
  data_inicio: '', data_fim: '', anexos_contrato: []
};

export default function ClienteFinanceiroSelect({ value, onChange }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [form, setForm] = useState(EMPTY_CF);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const wrapRef = useRef(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-financeiros'],
    queryFn: () => base44.entities.ClienteFinanceiro.list('-created_date', 500),
    staleTime: 60 * 1000,
  });

  const filtered = clientes.filter(c =>
    c.status !== 'encerrado' &&
    (!query || c.nome?.toLowerCase().includes(query.toLowerCase()) || c.unidade?.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 8);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (cliente) => {
    setQuery(cliente.nome + (cliente.unidade ? ` — ${cliente.unidade}` : ''));
    setOpen(false);
    onChange(cliente);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange(null);
  };

  const handleUploadAnexo = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, anexos_contrato: [...(f.anexos_contrato || []), file_url] }));
    setUploading(false);
  };

  const handleSaveCadastro = async () => {
    setSaving(true);
    const data = { ...form, valor_mensal: parseFloat(form.valor_mensal) || 0, dia_cobranca: parseInt(form.dia_cobranca) || null };
    const novo = await base44.entities.ClienteFinanceiro.create(data);
    await qc.invalidateQueries({ queryKey: ['clientes-financeiros'] });
    setSaving(false);
    setShowCadastro(false);
    setForm(EMPTY_CF);
    handleSelect({ ...data, id: novo.id });
  };

  return (
    <>
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            placeholder="Buscar cliente financeiro..."
            className="pl-9"
          />
        </div>
        {open && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-2.5 text-sm text-slate-400">Nenhum cliente encontrado</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between group"
                  onMouseDown={() => handleSelect(c)}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                    {c.unidade && <p className="text-xs text-slate-400">{c.unidade}</p>}
                  </div>
                  <div className="text-right">
                    {c.valor_mensal ? <p className="text-xs text-emerald-600 font-semibold">{c.valor_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p> : null}
                    <p className="text-xs text-slate-400">{c.tipo_contrato}</p>
                  </div>
                </button>
              ))
            )}
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onMouseDown={() => { setOpen(false); setShowCadastro(true); }}
                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium w-full py-1"
              >
                <Plus className="w-4 h-4" /> Cadastrar novo cliente financeiro
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal cadastro rápido */}
      <Dialog open={showCadastro} onOpenChange={setShowCadastro}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Cliente Financeiro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cliente" />
              </div>
              <div>
                <Label>Unidade</Label>
                <Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="Ex: Matriz, SP, Filial 1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" value={form.valor_mensal} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Tipo de Contrato</Label>
                <Select value={form.tipo_contrato} onValueChange={v => setForm(f => ({ ...f, tipo_contrato: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="avulso">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia de Cobrança</Label>
                <Input type="number" min="1" max="31" value={form.dia_cobranca} onChange={e => setForm(f => ({ ...f, dia_cobranca: e.target.value }))} placeholder="Ex: 10" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início do Contrato</Label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Fim do Contrato</Label>
                <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas internas sobre o contrato" />
            </div>
            <div>
              <Label>Anexos de Contrato</Label>
              <label className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-lg p-3 cursor-pointer hover:border-violet-300 mt-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                <span className="text-sm text-slate-500">{uploading ? 'Enviando...' : 'Anexar contrato (PDF ou imagem)'}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading}
                  onChange={e => e.target.files[0] && handleUploadAnexo(e.target.files[0])} />
              </label>
              {(form.anexos_contrato || []).map((url, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 underline truncate max-w-xs">Anexo {i + 1}</a>
                  <button type="button" onClick={() => setForm(f => ({ ...f, anexos_contrato: f.anexos_contrato.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCadastro(false)}>Cancelar</Button>
            <Button onClick={handleSaveCadastro} disabled={saving || !form.nome} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}