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
import { Plus, Search, Upload, CheckCircle, Clock, FileText, X, Loader2, ArrowDownCircle, RefreshCw, Zap } from 'lucide-react';
import RecorrenciaForm from '@/components/financeiro/RecorrenciaForm';
import GerarLancamentosModal from '@/components/financeiro/GerarLancamentosModal';
import { format } from 'date-fns';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIAS = ['Infraestrutura', 'Marketing', 'Ferramentas/SaaS', 'Escritório', 'Impostos', 'Honorários', 'Ações Trabalhistas', 'Outros'];

const EMPTY = {
  nome: '', categoria: '', tipo: 'fixo', valor: '', recorrente: false,
  frequencia: 'mensal', data_inicio: '', data_fim: '',
  data_vencimento: '', status: 'pendente', data_pagamento: '',
  observacao_pagamento: '', comprovante_pagamento: '',
};

export default function FinanceiroCustos() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('all');
  const [filtroComp, setFiltroComp] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showGerar, setShowGerar] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: custos = [], isLoading } = useQuery({
    queryKey: ['fin-custos', mes],
    queryFn: () => base44.entities.FinanceiroCusto.filter({ mes_referencia: mes }, '-created_date', 200),
  });

  // Deduplicar por nome: prioriza lançamentos reais (is_previsto=false) sobre previstos
  const custosDeduplicados = (() => {
    const map = new Map();
    // Primeiro passa os reais (sem is_previsto)
    for (const c of custos) {
      if (!c.is_previsto) map.set(c.nome?.toLowerCase()?.trim(), c);
    }
    // Depois adiciona os previstos somente se não houver real com mesmo nome
    for (const c of custos) {
      if (c.is_previsto) {
        const key = c.nome?.toLowerCase()?.trim();
        if (!map.has(key)) map.set(key, c);
      }
    }
    return Array.from(map.values());
  })();

  const filtered = custosDeduplicados.filter(c => {
    const matchSearch = !search || c.nome?.toLowerCase().includes(search.toLowerCase()) || c.categoria?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || c.status === filtroStatus;
    const matchTipo = filtroTipo === 'all' || c.tipo === filtroTipo;
    const matchComp = filtroComp === 'all' ||
      (filtroComp === 'com' && c.comprovante_pagamento) ||
      (filtroComp === 'sem' && !c.comprovante_pagamento);
    return matchSearch && matchStatus && matchTipo && matchComp;
  });

  const totais = {
    total: custos.reduce((s, c) => s + (c.valor || 0), 0),
    fixo: custos.filter(c => c.tipo === 'fixo').reduce((s, c) => s + (c.valor || 0), 0),
    variavel: custos.filter(c => c.tipo === 'variavel').reduce((s, c) => s + (c.valor || 0), 0),
    pendente: custos.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.valor || 0), 0),
    semComp: custos.filter(c => c.status === 'pago' && !c.comprovante_pagamento).length,
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, valor: parseFloat(form.valor) || 0, mes_referencia: mes };
    if (form.id) {
      await base44.entities.FinanceiroCusto.update(form.id, data);
    } else {
      await base44.entities.FinanceiroCusto.create(data);
    }
    qc.invalidateQueries({ queryKey: ['fin-custos'] });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY);
  };

  const handleUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, comprovante_pagamento: file_url }));
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta despesa?')) return;
    await base44.entities.FinanceiroCusto.delete(id);
    qc.invalidateQueries({ queryKey: ['fin-custos'] });
  };

  const openEdit = (c) => {
    setForm({ ...c, valor: c.valor?.toString() || '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-xl">
            <ArrowDownCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Custos & Despesas</h1>
            <p className="text-slate-500 text-sm">Controle de gastos operacionais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGerar(true)}>
            <Zap className="w-4 h-4" /> Gerar lançamentos do mês
          </Button>
          <Button onClick={() => { setForm(EMPTY); setShowModal(true); }} className="bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4" /> Nova Despesa
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Total do Mês</p>
          <p className="text-xl font-bold text-slate-900">{fmt(totais.total)}</p>
        </Card>
        <Card className="p-4 border-orange-200 bg-orange-50">
          <p className="text-xs text-orange-600 mb-1">Custo Fixo</p>
          <p className="text-xl font-bold text-orange-700">{fmt(totais.fixo)}</p>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-600 mb-1">Custo Variável</p>
          <p className="text-xl font-bold text-red-700">{fmt(totais.variavel)}</p>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 mb-1">Pendente</p>
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
          <Input placeholder="Buscar despesa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-48" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pago">✅ Pago</SelectItem>
            <SelectItem value="pendente">🟡 Pendente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="variavel">Variável</SelectItem>
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
          <Card className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">Nenhuma despesa encontrada.</Card>
        ) : filtered.map(c => (
          <Card key={c.id} className={`p-4 hover:shadow-sm transition-shadow ${c.is_previsto ? 'opacity-70 border-dashed' : ''}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.status === 'pago' ? 'bg-emerald-100' : c.status === 'previsto' ? 'bg-slate-100' : 'bg-amber-100'}`}>
                  {c.status === 'pago' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : c.status === 'previsto' ? <RefreshCw className="w-4 h-4 text-slate-400" /> : <Clock className="w-4 h-4 text-amber-600" />}
                </div>
                <div>
                  <p className={`font-semibold ${c.is_previsto ? 'text-slate-400' : 'text-slate-900'}`}>{c.nome} {c.is_previsto && <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 ml-1">PREVISTO</span>}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.categoria && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.categoria}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.tipo === 'fixo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{c.tipo}</span>
                    {c.recorrente && <span className="text-xs flex items-center gap-0.5 text-slate-500"><RefreshCw className="w-3 h-3" /> Recorrente</span>}
                    {c.data_vencimento && <span className="text-xs text-slate-500">Venc: {format(new Date(c.data_vencimento + 'T12:00:00'), 'dd/MM')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-slate-900">{fmt(c.valor)}</span>
                <Badge className={c.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : c.status === 'previsto' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}>{c.status === 'pago' ? 'Pago' : c.status === 'previsto' ? 'Previsto' : 'Pendente'}</Badge>
                {c.comprovante_pagamento ? (
                  <a href={c.comprovante_pagamento} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 h-7 text-xs">
                      <FileText className="w-3 h-3" /> Comprovante
                    </Button>
                  </a>
                ) : c.status === 'pago' ? (
                  <span className="text-xs text-orange-500 flex items-center gap-1"><Upload className="w-3 h-3" /> Sem comprovante</span>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => openEdit(c)} className="h-7 text-xs">Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-400 h-7 px-2">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Nome da Despesa *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Assinatura Notion" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
              {form.status === 'pago' && (
                <div>
                  <Label>Data Pagamento</Label>
                  <Input type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
                </div>
              )}
            </div>
            <div>
              <Label>Observação</Label>
              <Input value={form.observacao_pagamento} onChange={e => setForm(f => ({ ...f, observacao_pagamento: e.target.value }))} placeholder="Observações..." />
            </div>
            <RecorrenciaForm form={form} setForm={setForm} />
            <div>
              <Label>Comprovante de Pagamento</Label>
              {form.comprovante_pagamento ? (
                <div className="flex items-center gap-2 mt-1">
                  <a href={form.comprovante_pagamento} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 underline">Ver comprovante</a>
                  <Button variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, comprovante_pagamento: '' }))} className="h-6 px-1 text-red-400">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-lg p-3 cursor-pointer hover:border-red-300 mt-1">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Upload className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm text-slate-500">{uploading ? 'Enviando...' : 'Anexar comprovante (imagem ou PDF)'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading}
                    onChange={e => e.target.files[0] && handleUpload(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GerarLancamentosModal
        open={showGerar}
        onClose={() => setShowGerar(false)}
        onDone={() => qc.invalidateQueries({ queryKey: ['fin-custos'] })}
      />
    </div>
  );
}