import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Upload, CheckCircle, Clock, AlertCircle, FileText, X, Loader2, ArrowUpCircle, RefreshCw } from 'lucide-react';
import ClienteFinanceiroSelect from '@/components/financeiro/ClienteFinanceiroSelect';
import { format } from 'date-fns';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG = {
  a_vencer: { label: 'A Vencer', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  pago: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  em_atraso: { label: 'Em Atraso', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
};

const EMPTY = { cliente_nome: '', cliente_financeiro_id: '', valor_mensal: '', tipo_contrato: 'mensal', data_cobranca: '', status: 'a_vencer', data_recebimento: '', observacao_recebimento: '', comprovante_recebimento: '', recorrente: false, frequencia: 'mensal', data_inicio: '', data_fim: '' };

export default function FinanceiroReceitas() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroComp, setFiltroComp] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);

  const { data: receitas = [], isLoading } = useQuery({
    queryKey: ['fin-receitas', mes],
    queryFn: () => base44.entities.FinanceiroReceita.filter({ mes_referencia: mes }, '-created_date', 200),
  });

  const filtered = receitas.filter(r => {
    const matchSearch = !search || r.cliente_nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || r.status === filtroStatus;
    const matchComp = filtroComp === 'all' ||
      (filtroComp === 'com' && r.comprovante_recebimento) ||
      (filtroComp === 'sem' && !r.comprovante_recebimento);
    return matchSearch && matchStatus && matchComp;
  }).sort((a, b) => {
    if (!a.data_cobranca && !b.data_cobranca) return 0;
    if (!a.data_cobranca) return 1;
    if (!b.data_cobranca) return -1;
    return a.data_cobranca.localeCompare(b.data_cobranca);
  });

  const totais = {
    total: receitas.reduce((s, r) => s + (r.valor_mensal || 0), 0),
    pago: receitas.filter(r => r.status === 'pago').reduce((s, r) => s + (r.valor_mensal || 0), 0),
    pendente: receitas.filter(r => r.status !== 'pago').reduce((s, r) => s + (r.valor_mensal || 0), 0),
    semComp: receitas.filter(r => r.status === 'pago' && !r.comprovante_recebimento).length,
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, valor_mensal: parseFloat(form.valor_mensal) || 0, mes_referencia: mes };
    if (form.id) {
      await base44.entities.FinanceiroReceita.update(form.id, data);
    } else {
      await base44.entities.FinanceiroReceita.create(data);
    }
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY);
  };

  const handleUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, comprovante_recebimento: file_url }));
    setUploading(false);
  };

  const handleGerarRecorrentes = async () => {
    if (!confirm(`Gerar receitas recorrentes para ${mes}? Lançamentos já existentes não serão duplicados.`)) return;
    setGerando(true);
    const res = await base44.functions.invoke('gerarReceitasRecorrentes', { mes_referencia: mes });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setGerando(false);
    alert(res.data?.message || 'Concluído!');
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta receita?')) return;
    await base44.entities.FinanceiroReceita.delete(id);
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
  };

  const openEdit = (r) => {
    setForm({ ...r, valor_mensal: r.valor_mensal?.toString() || '' });
    setShowModal(true);
  };

  const openNew = () => {
    setForm({ ...EMPTY });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Receitas</h1>
            <p className="text-slate-500 text-sm">Controle de faturamento por cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGerarRecorrentes} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Gerar Recorrentes ({mes})
          </Button>
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nova Receita
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Total MRR</p>
          <p className="text-xl font-bold text-slate-900">{fmt(totais.total)}</p>
        </Card>
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <p className="text-xs text-emerald-600 mb-1">Recebido</p>
          <p className="text-xl font-bold text-emerald-700">{fmt(totais.pago)}</p>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 mb-1">Pendente / Atraso</p>
          <p className="text-xl font-bold text-amber-700">{fmt(totais.pendente)}</p>
        </Card>
        <Card className={`p-4 ${totais.semComp > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
          <p className="text-xs text-slate-500 mb-1">Pagos sem comprovante</p>
          <p className={`text-xl font-bold ${totais.semComp > 0 ? 'text-orange-600' : 'text-slate-700'}`}>{totais.semComp}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="border border-input rounded-md px-3 py-1.5 text-sm bg-white" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pago">✅ Pago</SelectItem>
            <SelectItem value="a_vencer">🟡 A Vencer</SelectItem>
            <SelectItem value="em_atraso">🔴 Em Atraso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroComp} onValueChange={setFiltroComp}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Comprovante" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="com">Com comprovante</SelectItem>
            <SelectItem value="sem">Sem comprovante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <Card className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">Nenhuma receita encontrada. <br /><span className="text-sm">Clique em "Nova Receita" para começar.</span></Card>
        ) : filtered.map(r => {
          const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.a_vencer;
          const Icon = sc.icon;
          return (
            <Card key={r.id} className="p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${sc.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{r.cliente_nome}</p>
                    <p className="text-xs text-slate-500">{r.tipo_contrato} · Cobrança: {r.data_cobranca || '—'}{r.data_recebimento && ` · Recebido: ${r.data_recebimento}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-slate-900">{fmt(r.valor_mensal)}</span>
                  <Badge className={sc.color}>{sc.label}</Badge>
                  {r.comprovante_recebimento ? (
                    <a href={r.comprovante_recebimento} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 h-7 text-xs">
                        <FileText className="w-3 h-3" /> Comprovante
                      </Button>
                    </a>
                  ) : (
                    <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Sem comprovante</span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="h-7 text-xs">Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-red-400 h-7 px-2">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Receita' : 'Nova Receita'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Cliente *</Label>
              <ClienteFinanceiroSelect
                value={form.cliente_nome}
                onChange={(cliente) => {
                  if (!cliente) { setForm(f => ({ ...f, cliente_nome: '', cliente_financeiro_id: '' })); return; }
                  const dataCobranca = cliente.dia_cobranca
                    ? `${form.mes_referencia || new Date().toISOString().slice(0, 7)}-${String(cliente.dia_cobranca).padStart(2, '0')}`
                    : form.data_cobranca;
                  setForm(f => ({
                    ...f,
                    cliente_nome: cliente.nome + (cliente.unidade ? ` — ${cliente.unidade}` : ''),
                    cliente_financeiro_id: cliente.id,
                    valor_mensal: cliente.valor_mensal?.toString() || f.valor_mensal,
                    tipo_contrato: cliente.tipo_contrato || f.tipo_contrato,
                    data_cobranca: dataCobranca,
                  }));
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Mensal (R$) *</Label>
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
              <div>
                <Label>Data de Cobrança</Label>
                <Input type="date" value={form.data_cobranca} onChange={e => setForm(f => ({ ...f, data_cobranca: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="em_atraso">Em Atraso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === 'pago' && (
              <div>
                <Label>Data de Recebimento</Label>
                <Input type="date" value={form.data_recebimento} onChange={e => setForm(f => ({ ...f, data_recebimento: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="recorrente" checked={!!form.recorrente} onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} className="w-4 h-4" />
                <Label htmlFor="recorrente">Receita Recorrente</Label>
              </div>
              {form.recorrente && (
                <div>
                  <Label>Frequência</Label>
                  <Select value={form.frequencia || 'mensal'} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {form.recorrente && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Início Recorrência</Label>
                  <Input type="date" value={form.data_inicio || ''} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label>Data Fim Recorrência</Label>
                  <Input type="date" value={form.data_fim || ''} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <Label>Observação</Label>
              <Input value={form.observacao_recebimento} onChange={e => setForm(f => ({ ...f, observacao_recebimento: e.target.value }))} placeholder="Observações..." />
            </div>
            <div>
              <Label>Comprovante de Recebimento</Label>
              {form.comprovante_recebimento ? (
                <div className="flex items-center gap-2 mt-1">
                  <a href={form.comprovante_recebimento} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline">Ver comprovante</a>
                  <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, comprovante_recebimento: '' }))} className="h-6 px-1 text-red-400">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-lg p-3 cursor-pointer hover:border-violet-300 mt-1">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm text-slate-500">{uploading ? 'Enviando...' : 'Clique para anexar (imagem ou PDF)'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading}
                    onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}