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
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, CheckCircle, Clock, FileText, X, Loader2, Users, Zap, RefreshCw } from 'lucide-react';
import RecorrenciaForm from '@/components/financeiro/RecorrenciaForm';
import GerarLancamentosModal from '@/components/financeiro/GerarLancamentosModal';
import { format } from 'date-fns';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const EMPTY = {
  nome: '', tipo_vinculo: 'clt', salario: '', vale_alimentacao: '', vale_transporte: '',
  outros_beneficios: '', tipo_servico: '', valor_pj: '', data_pagamento: '',
  status: 'pendente', holerite_url: '', comprovante_pagamento_url: '', nota_fiscal_url: '',
  recorrente: false, frequencia: 'mensal', data_inicio: '', data_fim: '',
};

function DocUpload({ label, url, onUpload, onRemove, loading }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="flex items-center gap-2 mt-1">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 h-7 text-xs">
              <FileText className="w-3 h-3" /> Ver arquivo
            </Button>
          </a>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 px-1 text-red-400"><X className="w-3 h-3" /></Button>
        </div>
      ) : (
        <label className="flex items-center gap-2 border border-dashed border-slate-200 rounded-lg p-2 cursor-pointer hover:border-violet-300 mt-1">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Upload className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-xs text-slate-500">{loading ? 'Enviando...' : 'Anexar arquivo'}</span>
          <input type="file" accept="image/*,.pdf" className="hidden" disabled={loading}
            onChange={e => e.target.files[0] && onUpload(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

export default function FinanceiroFolha() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [showModal, setShowModal] = useState(false);
  const [showGerar, setShowGerar] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploadingField, setUploadingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [paymentConfirm, setPaymentConfirm] = useState(null);
  const [propagando, setPropagando] = useState(false);
  const [showConfirmPropagar, setShowConfirmPropagar] = useState(false);
  const [propagacaoResultado, setPropagacaoResultado] = useState(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const { data: folha = [], isLoading } = useQuery({
    queryKey: ['fin-folha', mes],
    queryFn: () => base44.entities.FinanceiroFolha.filter({ mes_referencia: mes }, '-created_date', 200),
  });

  const cltList = folha.filter(f => f.tipo_vinculo === 'clt');
  const pjList = folha.filter(f => f.tipo_vinculo === 'pj');

  const custoTotal = folha.reduce((s, f) => {
    if (f.tipo_vinculo === 'clt') return s + (f.salario || 0) + (f.vale_alimentacao || 0) + (f.vale_transporte || 0) + (f.outros_beneficios || 0);
    return s + (f.valor_pj || 0);
  }, 0);
  const custoCLT = cltList.reduce((s, f) => s + (f.salario || 0) + (f.vale_alimentacao || 0) + (f.vale_transporte || 0) + (f.outros_beneficios || 0), 0);
  const custoPJ = pjList.reduce((s, f) => s + (f.valor_pj || 0), 0);

  const addMeses = (mesStr, n) => {
    const [y, m] = mesStr.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const handlePropagarRecorrentes = async () => {
    setShowConfirmPropagar(false);
    setPropagando(true);
    const recorrentes = folha.filter(f => f.recorrente);
    const mesesFuturos = Array.from({ length: 11 }, (_, i) => addMeses(mes, i + 1));
    const existentes = await Promise.all(
      mesesFuturos.map(m => base44.entities.FinanceiroFolha.filter({ mes_referencia: m }, '-created_date', 200))
    );
    const existentesFlat = existentes.flat();
    let criados = 0;
    for (const item of recorrentes) {
      for (let i = 1; i <= 11; i++) {
        const mesFuturo = addMeses(mes, i);
        const jaExiste = existentesFlat.some(e => e.nome === item.nome && e.mes_referencia === mesFuturo && e.tipo_vinculo === item.tipo_vinculo);
        if (!jaExiste) {
          await base44.entities.FinanceiroFolha.create({
            nome: item.nome,
            tipo_vinculo: item.tipo_vinculo,
            salario: item.salario,
            vale_alimentacao: item.vale_alimentacao,
            vale_transporte: item.vale_transporte,
            outros_beneficios: item.outros_beneficios,
            tipo_servico: item.tipo_servico,
            valor_pj: item.valor_pj,
            recorrente: true,
            frequencia: item.frequencia,
            data_inicio: item.data_inicio,
            data_fim: item.data_fim,
            mes_referencia: mesFuturo,
            status: 'pendente',
          });
          criados++;
        }
      }
    }
    qc.invalidateQueries({ queryKey: ['fin-folha'] });
    setPropagando(false);
    setPropagacaoResultado({ recorrentes: recorrentes.length, criados });
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      salario: parseFloat(form.salario) || 0,
      vale_alimentacao: parseFloat(form.vale_alimentacao) || 0,
      vale_transporte: parseFloat(form.vale_transporte) || 0,
      outros_beneficios: parseFloat(form.outros_beneficios) || 0,
      valor_pj: parseFloat(form.valor_pj) || 0,
      mes_referencia: mes,
    };
    if (form.id) {
      await base44.entities.FinanceiroFolha.update(form.id, data);
    } else {
      await base44.entities.FinanceiroFolha.create(data);
      // Se recorrente, criar para os próximos 11 meses
      if (data.recorrente) {
        for (let i = 1; i <= 11; i++) {
          await base44.entities.FinanceiroFolha.create({
            ...data,
            mes_referencia: addMeses(mes, i),
            status: 'pendente',
            data_pagamento: '',
            comprovante_pagamento_url: '',
            holerite_url: '',
            nota_fiscal_url: '',
          });
        }
      }
    }
    qc.invalidateQueries({ queryKey: ['fin-folha'] });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY);
  };

  const handleUpload = async (file, field) => {
    setUploadingField(field);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, [field]: file_url }));
    setUploadingField(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.FinanceiroFolha.delete(id);
    qc.invalidateQueries({ queryKey: ['fin-folha'] });
  };

  const openEdit = (item) => {
    setForm({
      ...item,
      salario: item.salario?.toString() || '',
      vale_alimentacao: item.vale_alimentacao?.toString() || '',
      vale_transporte: item.vale_transporte?.toString() || '',
      outros_beneficios: item.outros_beneficios?.toString() || '',
      valor_pj: item.valor_pj?.toString() || '',
    });
    setShowModal(true);
  };

  const handleMarcarPago = (item) => {
    const isCLT = item.tipo_vinculo === 'clt';
    const valor = isCLT
      ? (item.salario || 0) + (item.vale_alimentacao || 0) + (item.vale_transporte || 0) + (item.outros_beneficios || 0)
      : (item.valor_pj || 0);
    setPaymentConfirm({ item, valor: valor.toString() });
  };

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true);
    const { item, valor } = paymentConfirm;
    const isCLT = item.tipo_vinculo === 'clt';
    const updateData = {
      status: 'pago',
      data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    };
    if (isCLT) {
      updateData.salario = parseFloat(valor) || 0;
    } else {
      updateData.valor_pj = parseFloat(valor) || 0;
    }
    await base44.entities.FinanceiroFolha.update(item.id, updateData);
    qc.invalidateQueries({ queryKey: ['fin-folha'] });
    setConfirmingPayment(false);
    setPaymentConfirm(null);
  };

  const FolhaCard = ({ item }) => {
    const isCLT = item.tipo_vinculo === 'clt';
    const isPrevisto = item.is_previsto;
    const valorTotal = isCLT
      ? (item.salario || 0) + (item.vale_alimentacao || 0) + (item.vale_transporte || 0) + (item.outros_beneficios || 0)
      : (item.valor_pj || 0);

    return (
      <Card className={`p-4 hover:shadow-sm transition-shadow ${isPrevisto ? 'opacity-70 border-dashed' : ''}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.status === 'pago' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {item.status === 'pago' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-amber-600" />}
            </div>
            <div>
              <p className={`font-semibold ${isPrevisto ? 'text-slate-400' : 'text-slate-900'}`}>{item.nome} {isPrevisto && <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 ml-1">PREVISTO</span>}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                {isCLT ? (
                  <>Salário: {fmt(item.salario)} · VA: {fmt(item.vale_alimentacao)} · VT: {fmt(item.vale_transporte)}</>
                ) : (
                  <>{item.tipo_servico} · {item.data_pagamento && `Pagamento: ${item.data_pagamento}`}</>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold text-slate-900">{fmt(valorTotal)}</span>
            <Badge className={item.status === 'pago' ? 'bg-emerald-100 text-emerald-700' : item.status === 'previsto' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}>
              {item.status === 'pago' ? 'Pago' : item.status === 'previsto' ? 'Previsto' : 'Pendente'}
            </Badge>
            {item.comprovante_pagamento_url ? (
              <a href={item.comprovante_pagamento_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 h-7 text-xs">
                  <FileText className="w-3 h-3" /> Comprovante
                </Button>
              </a>
            ) : (
              <span className="text-xs text-slate-400">Sem comprovante</span>
            )}
            {item.status !== 'pago' && (
              <Button variant="outline" size="sm" onClick={() => handleMarcarPago(item)} className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">Marcar Pago</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="h-7 text-xs">Editar</Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-red-400 h-7 px-2">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h1>
            <p className="text-slate-500 text-sm">CLT + PJ — gestão de equipe</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-white" />
            <Button onClick={() => { setForm(EMPTY); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowConfirmPropagar(true)} disabled={propagando}>
              {propagando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Propagar Recorrentes
            </Button>
            <Button variant="outline" onClick={() => setShowGerar(true)}>
              <Zap className="w-4 h-4" /> Gerar lançamentos do mês
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-blue-200 bg-blue-50">
          <p className="text-xs text-blue-600 mb-1">Custo Total Equipe</p>
          <p className="text-xl font-bold text-blue-700">{fmt(custoTotal)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{folha.length} pessoa(s)</p>
        </Card>
        <Card className="p-4 border-indigo-200 bg-indigo-50">
          <p className="text-xs text-indigo-600 mb-1">CLT ({cltList.length})</p>
          <p className="text-xl font-bold text-indigo-700">{fmt(custoCLT)}</p>
        </Card>
        <Card className="p-4 border-purple-200 bg-purple-50">
          <p className="text-xs text-purple-600 mb-1">PJ ({pjList.length})</p>
          <p className="text-xl font-bold text-purple-700">{fmt(custoPJ)}</p>
        </Card>
      </div>

      <Tabs defaultValue="clt">
        <TabsList>
          <TabsTrigger value="clt">CLT ({cltList.length})</TabsTrigger>
          <TabsTrigger value="pj">PJ ({pjList.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="clt" className="space-y-2 mt-4">
          {isLoading ? <Card className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></Card>
            : cltList.length === 0 ? <Card className="p-8 text-center text-slate-400">Nenhum colaborador CLT.</Card>
            : cltList.map(item => <FolhaCard key={item.id} item={item} />)}
        </TabsContent>
        <TabsContent value="pj" className="space-y-2 mt-4">
          {isLoading ? <Card className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></Card>
            : pjList.length === 0 ? <Card className="p-8 text-center text-slate-400">Nenhum prestador PJ.</Card>
            : pjList.map(item => <FolhaCard key={item.id} item={item} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Adicionar'} — Folha</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <Label>Vínculo *</Label>
                <Select value={form.tipo_vinculo} onValueChange={v => setForm(f => ({ ...f, tipo_vinculo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clt">CLT</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.tipo_vinculo === 'clt' ? (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Salário Base</Label><Input type="number" value={form.salario} onChange={e => setForm(f => ({ ...f, salario: e.target.value }))} placeholder="0,00" /></div>
                <div><Label>Vale Alimentação</Label><Input type="number" value={form.vale_alimentacao} onChange={e => setForm(f => ({ ...f, vale_alimentacao: e.target.value }))} placeholder="0,00" /></div>
                <div><Label>Vale Transporte</Label><Input type="number" value={form.vale_transporte} onChange={e => setForm(f => ({ ...f, vale_transporte: e.target.value }))} placeholder="0,00" /></div>
                <div><Label>Outros Benefícios</Label><Input type="number" value={form.outros_beneficios} onChange={e => setForm(f => ({ ...f, outros_beneficios: e.target.value }))} placeholder="0,00" /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo de Serviço</Label><Input value={form.tipo_servico} onChange={e => setForm(f => ({ ...f, tipo_servico: e.target.value }))} placeholder="Ex: Design, Dev..." /></div>
                <div><Label>Valor (R$)</Label><Input type="number" value={form.valor_pj} onChange={e => setForm(f => ({ ...f, valor_pj: e.target.value }))} placeholder="0,00" /></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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
                <Label>Data Pagamento</Label>
                <Input type="date" value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))} />
              </div>
            </div>

            <RecorrenciaForm form={form} setForm={setForm} />
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Documentos</p>
              {form.tipo_vinculo === 'clt' && (
                <DocUpload label="Holerite" url={form.holerite_url}
                  onUpload={f => handleUpload(f, 'holerite_url')}
                  onRemove={() => setForm(f => ({ ...f, holerite_url: '' }))}
                  loading={uploadingField === 'holerite_url'} />
              )}
              {form.tipo_vinculo === 'pj' && (
                <DocUpload label="Nota Fiscal" url={form.nota_fiscal_url}
                  onUpload={f => handleUpload(f, 'nota_fiscal_url')}
                  onRemove={() => setForm(f => ({ ...f, nota_fiscal_url: '' }))}
                  loading={uploadingField === 'nota_fiscal_url'} />
              )}
              <DocUpload label="Comprovante de Pagamento" url={form.comprovante_pagamento_url}
                onUpload={f => handleUpload(f, 'comprovante_pagamento_url')}
                onRemove={() => setForm(f => ({ ...f, comprovante_pagamento_url: '' }))}
                loading={uploadingField === 'comprovante_pagamento_url'} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GerarLancamentosModal
        open={showGerar}
        onClose={() => setShowGerar(false)}
        onDone={() => qc.invalidateQueries({ queryKey: ['fin-folha'] })}
      />

      {/* Confirm propagar */}
      <AlertDialog open={showConfirmPropagar} onOpenChange={setShowConfirmPropagar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Propagar registros recorrentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os registros marcados como recorrentes em <strong>{mes}</strong> serão propagados para os próximos 11 meses. Registros já existentes não serão duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePropagarRecorrentes} className="bg-blue-600 hover:bg-blue-700">
              {propagando && <Loader2 className="w-4 h-4 animate-spin" />} Sim, propagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resultado propagação */}
      <AlertDialog open={!!propagacaoResultado} onOpenChange={open => !open && setPropagacaoResultado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Propagação concluída ✓</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{propagacaoResultado?.recorrentes}</strong> registro(s) recorrente(s) processado(s).<br />
              <strong>{propagacaoResultado?.criados}</strong> novo(s) lançamento(s) criado(s) para os próximos 11 meses.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setPropagacaoResultado(null)} className="bg-blue-600 hover:bg-blue-700">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog confirmar pagamento */}
      <Dialog open={!!paymentConfirm} onOpenChange={open => !open && setPaymentConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">Confirme o valor pago para <strong>{paymentConfirm?.item?.nome}</strong>:</p>
            <div>
              <Label>Valor Pago (R$)</Label>
              <Input
                type="number"
                value={paymentConfirm?.valor || ''}
                onChange={e => setPaymentConfirm(p => ({ ...p, valor: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentConfirm(null)}>Cancelar</Button>
            <Button onClick={handleConfirmPayment} disabled={confirmingPayment} className="bg-emerald-600 hover:bg-emerald-700">
              {confirmingPayment && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}