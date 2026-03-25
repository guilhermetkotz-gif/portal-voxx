import React, { useState, useMemo } from 'react';
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
import { Plus, Search, Upload, CheckCircle, Clock, AlertCircle, FileText, X, Loader2, ArrowUpCircle, RefreshCw, MessageSquare, List, AlertTriangle } from 'lucide-react';
import ClienteFinanceiroSelect from '@/components/financeiro/ClienteFinanceiroSelect';
import { format, differenceInDays, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/lib/AuthContext';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = format(new Date(), 'yyyy-MM-dd');

const STATUS_CONFIG = {
  a_vencer: { label: 'A Vencer', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, dot: 'bg-amber-400' },
  pago:     { label: 'Pago',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, dot: 'bg-emerald-500' },
  em_atraso:{ label: 'Em Atraso',color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle, dot: 'bg-red-500' },
  previsto: { label: 'Previsto', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock, dot: 'bg-slate-400' },
};

const EMPTY = { cliente_nome: '', cliente_financeiro_id: '', valor_mensal: '', tipo_contrato: 'mensal', data_cobranca: '', status: 'a_vencer', data_recebimento: '', observacao_recebimento: '', comprovante_recebimento: '', recorrente: false, frequencia: 'mensal', data_inicio: '', data_fim: '' };

function diasAtraso(data_cobranca) {
  if (!data_cobranca) return 0;
  const diff = differenceInDays(new Date(), parseISO(data_cobranca));
  return Math.max(0, diff);
}

function ObservacaoModal({ receita, user, onClose, onSaved }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(receita?.observacao_recebimento || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.FinanceiroReceita.update(receita.id, {
      observacao_recebimento: texto,
      observacao_data: format(new Date(), 'yyyy-MM-dd'),
      observacao_usuario: user?.full_name || user?.email || '',
    });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Observação — {receita?.cliente_nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {receita?.observacao_data && (
            <p className="text-xs text-slate-400">
              Última edição: {receita.observacao_data?.split('-').reverse().join('/')}
              {receita.observacao_usuario ? ` · ${receita.observacao_usuario}` : ''}
            </p>
          )}
          <textarea
            className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Adicione uma observação sobre esta receita (cobranças, acordos, contatos...)..."
            value={texto}
            onChange={e => setTexto(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function gerarPDFInadimplencia(inadimplentes) {
  const doc = new jsPDF();
  const hoje = format(new Date(), 'dd/MM/yyyy');
  const nomeArquivo = `relatorio_inadimplencia_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const totalValor = inadimplentes.reduce((s, r) => s + (r.valor_mensal || 0), 0);
  const qtd = inadimplentes.length;

  // Cabeçalho
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Inadimplência', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${hoje}`, 14, 21);

  // Resumo
  doc.setTextColor(30, 30, 30);
  doc.setFillColor(254, 242, 242);
  doc.rect(10, 33, 190, 22, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO', 14, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Inadimplente: ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 48);
  doc.text(`Unidades Inadimplentes: ${qtd}`, 110, 48);

  // Cabeçalho da tabela
  let y = 62;
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y - 5, 190, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Unidade', 14, y);
  doc.text('Valor', 80, y);
  doc.text('Vencimento', 108, y);
  doc.text('Atraso', 138, y);
  doc.text('Observação', 158, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  y += 7;

  inadimplentes.forEach((r, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(10, y - 4, 190, 7, 'F');
    }
    doc.setFontSize(8);
    const nome = r.cliente_nome?.length > 28 ? r.cliente_nome.substring(0, 26) + '...' : (r.cliente_nome || '—');
    const valor = (r.valor_mensal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = r.data_cobranca ? r.data_cobranca.split('-').reverse().join('/') : '—';
    const dias = r.dias > 0 ? `${r.dias} dia${r.dias !== 1 ? 's' : ''}` : '0 dias';
    const obs = r.observacao_recebimento ? (r.observacao_recebimento.length > 22 ? r.observacao_recebimento.substring(0, 20) + '...' : r.observacao_recebimento) : 'Sem observação';
    doc.text(nome, 14, y);
    doc.text(valor, 80, y);
    doc.text(venc, 108, y);
    // Colorir dias de atraso
    if (r.dias > 30) doc.setTextColor(185, 28, 28);
    else if (r.dias >= 8) doc.setTextColor(194, 65, 12);
    else doc.setTextColor(161, 98, 7);
    doc.text(dias, 138, y);
    doc.setTextColor(30, 30, 30);
    doc.text(obs, 158, y);
    y += 7;
  });

  // Rodapé
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 14, 290);
    doc.text('Documento gerado automaticamente — uso interno', 100, 290);
  }

  doc.save(nomeArquivo);
}

function InadimplenciaView() {
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');
  const [obsTarget, setObsTarget] = useState(null);
  const { user } = useAuth();

  const { data: todasReceitas = [], isLoading } = useQuery({
    queryKey: ['fin-receitas-inadimplencia'],
    queryFn: () => base44.entities.FinanceiroReceita.filter({}, '-created_date', 1000),
  });

  const inadimplentes = useMemo(() => {
    const mesAtual = format(new Date(), 'yyyy-MM');
    const limite30 = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

    return todasReceitas
      .filter(r => r.status === 'em_atraso')
      .map(r => ({ ...r, dias: diasAtraso(r.data_cobranca) }))
      .filter(r => {
        const matchUnidade = !filtroUnidade || r.cliente_nome?.toLowerCase().includes(filtroUnidade.toLowerCase());
        const matchPeriodo = filtroPeriodo === 'all'
          || (filtroPeriodo === 'mes_atual' && r.mes_referencia === mesAtual)
          || (filtroPeriodo === '30dias' && r.data_cobranca && r.data_cobranca >= limite30);
        return matchUnidade && matchPeriodo;
      })
      .sort((a, b) => b.dias - a.dias);
  }, [todasReceitas, filtroUnidade, filtroPeriodo]);

  const totalAtraso = inadimplentes.filter(r => r.status === 'em_atraso').reduce((s, r) => s + (r.valor_mensal || 0), 0);
  const totalPendente = inadimplentes.filter(r => r.status === 'a_vencer').reduce((s, r) => s + (r.valor_mensal || 0), 0);
  const qtdInadimplentes = inadimplentes.filter(r => r.status === 'em_atraso').length;
  const mediaDias = qtdInadimplentes > 0
    ? Math.round(inadimplentes.filter(r => r.status === 'em_atraso').reduce((s, r) => s + r.dias, 0) / qtdInadimplentes)
    : 0;

  const dist = {
    ate7: inadimplentes.filter(r => r.dias >= 0 && r.dias <= 7).length,
    ate30: inadimplentes.filter(r => r.dias >= 8 && r.dias <= 30).length,
    mais30: inadimplentes.filter(r => r.dias > 30).length,
  };

  // Agrupar por mes_referencia
  const porMes = useMemo(() => {
    const grupos = {};
    inadimplentes.forEach(r => {
      const key = r.mes_referencia || 'sem-mes';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(r);
    });
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
  }, [inadimplentes]);

  function labelMes(mesRef) {
    if (!mesRef || mesRef === 'sem-mes') return 'Sem mês';
    const [ano, mes] = mesRef.split('-');
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${nomes[parseInt(mes) - 1]} ${ano}`;
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-500 mb-1">Total em Atraso</p>
          <p className="text-xl font-bold text-red-700">{fmt(totalAtraso)}</p>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50">
          <p className="text-xs text-amber-600 mb-1">Total Pendente</p>
          <p className="text-xl font-bold text-amber-700">{fmt(totalPendente)}</p>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-500 mb-1">Clientes Inadimplentes</p>
          <p className="text-xl font-bold text-red-700">{qtdInadimplentes}</p>
        </Card>
        <Card className="p-4 border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Média de Dias em Atraso</p>
          <p className="text-xl font-bold text-slate-700">{mediaDias} dias</p>
        </Card>
      </div>

      {/* Distribuição de atraso */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Distribuição:</span>
        <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> 0–7 dias: <strong>{dist.ate7}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" /> 8–30 dias: <strong>{dist.ate30}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> +30 dias: <strong>{dist.mais30}</strong>
        </span>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Filtrar unidade..." value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className="pl-9 w-52" />
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{inadimplentes.length} registros</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => gerarPDFInadimplencia(inadimplentes)}
          disabled={inadimplentes.length === 0}
          className="ml-auto gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
        >
          <FileText className="w-4 h-4" /> Gerar relatório PDF
        </Button>
      </div>

      {/* Lista agrupada por mês */}
      {isLoading ? (
        <Card className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></Card>
      ) : porMes.length === 0 ? (
        <Card className="p-10 text-center text-slate-400">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          Nenhuma inadimplência encontrada.
        </Card>
      ) : (
        <div className="space-y-6">
          {porMes.map(([mesRef, itens]) => (
            <div key={mesRef}>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">{labelMes(mesRef)}</h3>
                <span className="text-xs text-slate-400">{itens.length} registro{itens.length !== 1 ? 's' : ''} · {fmt(itens.reduce((s, r) => s + (r.valor_mensal || 0), 0))}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="space-y-2">
                {itens.map(r => {
                  const isAtraso = r.status === 'em_atraso';
                  const faixaColor = r.dias > 30 ? 'bg-red-500' : r.dias >= 8 ? 'bg-orange-400' : 'bg-amber-400';
                  return (
                    <Card key={r.id} className={`p-4 border-l-4 ${isAtraso ? 'border-l-red-500' : 'border-l-amber-400'}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${faixaColor}`} />
                          <div>
                            <p className="font-semibold text-slate-900">{r.cliente_nome}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-sm font-bold text-slate-800">{fmt(r.valor_mensal)}</span>
                              <span className="text-xs text-slate-500">Venc.: {r.data_cobranca ? r.data_cobranca.split('-').reverse().join('/') : '—'}</span>
                              {isAtraso ? (
                                <Badge className={`text-xs ${r.dias > 30 ? 'bg-red-100 text-red-700 border-red-200' : r.dias >= 8 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                  {r.dias} {r.dias === 1 ? 'dia' : 'dias'} em atraso
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">A Vencer</Badge>
                              )}
                            </div>
                            {r.observacao_recebimento && (
                              <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                💬 {r.observacao_recebimento}
                                {r.observacao_data && <span className="text-slate-400 ml-1">· {r.observacao_data.split('-').reverse().join('/')}</span>}
                                {r.observacao_usuario && <span className="text-slate-400 ml-1">· {r.observacao_usuario}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setObsTarget(r)}
                          className={`h-7 text-xs gap-1 ${r.observacao_recebimento ? 'border-violet-200 text-violet-600' : 'text-slate-500'}`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          {r.observacao_recebimento ? 'Ver obs.' : 'Obs.'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {obsTarget && (
        <ObservacaoModal
          receita={obsTarget}
          user={user}
          onClose={() => setObsTarget(null)}
        />
      )}
    </div>
  );
}

export default function FinanceiroReceitas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [view, setView] = useState('lista'); // 'lista' | 'inadimplencia'
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [filtroComp, setFiltroComp] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [showConfirmGerar, setShowConfirmGerar] = useState(false);
  const [gerarResultado, setGerarResultado] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [obsTarget, setObsTarget] = useState(null);

  const { data: receitas = [], isLoading } = useQuery({
    queryKey: ['fin-receitas', mes],
    queryFn: () => base44.entities.FinanceiroReceita.filter({ mes_referencia: mes }, '-created_date', 200),
  });

  const filtered = receitas.filter(r => {
    const matchSearch = !search || r.cliente_nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || r.status === filtroStatus;
    const matchComp = filtroComp === 'all'
      || (filtroComp === 'com' && r.comprovante_recebimento)
      || (filtroComp === 'sem' && !r.comprovante_recebimento);
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
    setShowConfirmGerar(false);
    setGerando(true);
    const res = await base44.functions.invoke('gerarReceitasRecorrentes', { mes_referencia: mes });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setGerando(false);
    setGerarResultado(res.data?.message || 'Concluído!');
  };

  const handleDelete = async () => {
    await base44.entities.FinanceiroReceita.delete(deleteTarget.id);
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setDeleteTarget(null);
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
      {/* Header */}
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
          <Button variant="outline" onClick={() => setShowConfirmGerar(true)} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Gerar Recorrentes ({mes})
          </Button>
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nova Receita
          </Button>
        </div>
      </div>

      {/* Toggle de visualização */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('lista')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'lista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <List className="w-4 h-4" /> Lista
        </button>
        <button
          onClick={() => setView('inadimplencia')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'inadimplencia' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Inadimplência
          {receitas.filter(r => r.status === 'em_atraso').length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {receitas.filter(r => r.status === 'em_atraso').length}
            </span>
          )}
        </button>
      </div>

      {view === 'inadimplencia' ? (
        <InadimplenciaView />
      ) : (
        <>
          {/* KPIs */}
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

          {/* Filtros */}
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

          {/* Lista */}
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
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{r.cliente_nome}</p>
                          {r.observacao_recebimento && (
                            <span title={r.observacao_recebimento} className="text-violet-500 cursor-pointer" onClick={() => setObsTarget(r)}>
                              <MessageSquare className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {r.tipo_contrato} · Cobrança: {r.data_cobranca ? r.data_cobranca.split('-').reverse().join('/') : '—'}
                          {r.data_recebimento && ` · Recebido: ${r.data_recebimento.split('-').reverse().join('/')}`}
                        </p>
                        {r.observacao_recebimento && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">💬 {r.observacao_recebimento}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-bold text-slate-900">{fmt(r.valor_mensal)}</span>
                      <Badge className={sc.color}>{sc.label}</Badge>
                      {r.status === 'em_atraso' && r.data_cobranca && (
                        <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">{diasAtraso(r.data_cobranca)}d atraso</Badge>
                      )}
                      {r.comprovante_recebimento ? (
                        <a href={r.comprovante_recebimento} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 h-7 text-xs">
                            <FileText className="w-3 h-3" /> Comprovante
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Sem comprovante</span>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setObsTarget(r)} className={`h-7 text-xs gap-1 ${r.observacao_recebimento ? 'border-violet-200 text-violet-600' : ''}`}>
                        <MessageSquare className="w-3 h-3" /> Obs.
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="h-7 text-xs">Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} className="text-red-400 h-7 px-2">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Modal observação */}
      {obsTarget && (
        <ObservacaoModal
          receita={obsTarget}
          user={user}
          onClose={() => setObsTarget(null)}
        />
      )}

      {/* Confirm gerar recorrentes */}
      <AlertDialog open={showConfirmGerar} onOpenChange={setShowConfirmGerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-violet-600" />
              </div>
              <AlertDialogTitle className="text-lg">Gerar receitas recorrentes?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-slate-600">
              Serão gerados lançamentos recorrentes para o mês <strong className="text-slate-900">{mes}</strong>.<br />
              Lançamentos já existentes não serão duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarRecorrentes} className="bg-violet-600 hover:bg-violet-700 text-white">Sim, gerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resultado gerar recorrentes */}
      <AlertDialog open={!!gerarResultado} onOpenChange={open => !open && setGerarResultado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <AlertDialogTitle className="text-lg">Concluído!</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-slate-600">{gerarResultado}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogAction onClick={() => setGerarResultado(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm excluir */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-lg">Excluir receita?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-slate-600">
              Você está prestes a excluir a receita de <strong className="text-slate-900">{deleteTarget?.cliente_nome}</strong>{deleteTarget?.valor_mensal ? ` — ${fmt(deleteTarget.valor_mensal)}` : ''}.<br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="border-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Sim, excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal novo/editar receita */}
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
                    ? `${mes}-${String(cliente.dia_cobranca).padStart(2, '0')}`
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