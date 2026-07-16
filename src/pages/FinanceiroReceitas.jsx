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
import { Plus, Search, Upload, CheckCircle, Clock, AlertCircle, FileText, X, Loader2, ArrowUpCircle, RefreshCw, MessageSquare, List, AlertTriangle, DollarSign, History, Database, StopCircle } from 'lucide-react';
import ClienteFinanceiroSelect from '@/components/financeiro/ClienteFinanceiroSelect';
import AlertaRecorrenciaVencendo from '@/components/financeiro/AlertaRecorrenciaVencendo';
import ReceberModal from '@/components/financeiro/ReceberModal';
import HistoricoRecebimentosModal from '@/components/financeiro/HistoricoRecebimentosModal';
import { format, differenceInDays, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/lib/AuthContext';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function diasAtraso(data_cobranca) {
  if (!data_cobranca) return 0;
  return Math.max(0, differenceInDays(new Date(), parseISO(data_cobranca)));
}

// Calcula status com base nos recebimentos vinculados
function calcularStatus(receita, recebimentos) {
  const recs = (recebimentos || []).filter(r => r.receita_id === receita.id);
  const totalRecebido = recs.reduce((s, r) => s + (r.valor_total_recebido || 0), 0);
  const totalJuros = recs.reduce((s, r) => s + (r.valor_juros || 0), 0);
  const totalDescontos = recs.reduce((s, r) => s + (r.valor_desconto || 0), 0);
  const valorCorrigido = (receita.valor_mensal || 0) + totalJuros - totalDescontos;
  const saldoPendente = Math.max(0, valorCorrigido - totalRecebido);
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const atrasado = receita.data_cobranca && receita.data_cobranca < hoje;

  let status;
  if (saldoPendente <= 0 && totalRecebido > 0) status = 'pago';
  else if (totalRecebido > 0 && saldoPendente > 0) status = 'parcial';
  else if (atrasado) status = 'em_atraso';
  else status = 'a_vencer';

  return { status, totalRecebido, totalJuros, totalDescontos, valorCorrigido, saldoPendente, recs };
}

const STATUS_CONFIG = {
  a_vencer:  { label: 'A Vencer',  color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400'  },
  pago:      { label: 'Pago',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  em_atraso: { label: 'Em Atraso', color: 'bg-red-100 text-red-700 border-red-200',          dot: 'bg-red-500'    },
  parcial:   { label: 'Parcial',   color: 'bg-blue-100 text-blue-700 border-blue-200',       dot: 'bg-blue-500'   },
  previsto:  { label: 'Previsto',  color: 'bg-slate-100 text-slate-600 border-slate-200',    dot: 'bg-slate-400'  },
};

const EMPTY = {
  cliente_nome: '', cliente_id: '', valor_mensal: '', tipo_contrato: 'mensal',
  data_cobranca: '', observacao_recebimento: '', recorrente: false,
  frequencia: 'mensal', data_inicio: '', data_fim: ''
};

// ─────────────── MODAL OBSERVAÇÃO ───────────────
function ObservacaoModal({ receita, user, onClose }) {
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
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Observação — {receita?.cliente_nome}</DialogTitle></DialogHeader>
        <div className="space-y-2 py-2">
          {receita?.observacao_data && (
            <p className="text-xs text-slate-400">Última edição: {receita.observacao_data.split('-').reverse().join('/')}{receita.observacao_usuario ? ` · ${receita.observacao_usuario}` : ''}</p>
          )}
          <textarea className="w-full border border-input rounded-md px-3 py-2 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Adicione uma observação..." value={texto} onChange={e => setTexto(e.target.value)} />
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

// ─────────────── INADIMPLÊNCIA ───────────────
function gerarPDFInadimplencia(lista) {
  const doc = new jsPDF();
  const hoje = format(new Date(), 'dd/MM/yyyy');
  const totalValor = lista.reduce((s, r) => s + (r.saldoPendente || 0), 0);

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Inadimplência', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${hoje}`, 14, 21);

  doc.setTextColor(30, 30, 30);
  doc.setFillColor(254, 242, 242);
  doc.rect(10, 33, 190, 22, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO', 14, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`Saldo Total Inadimplente: ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 48);
  doc.text(`Unidades: ${lista.length}`, 140, 48);

  let y = 62;
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y - 5, 190, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Unidade', 14, y);
  doc.text('V. Original', 72, y);
  doc.text('Recebido', 100, y);
  doc.text('Saldo', 128, y);
  doc.text('Atraso', 152, y);
  doc.text('Observação', 170, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  y += 7;

  lista.forEach((r, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(10, y - 4, 190, 7, 'F'); }
    doc.setFontSize(7.5);
    const nome = (r.cliente_nome || '—').substring(0, 24);
    const vo = (r.valor_mensal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const rec = (r.totalRecebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const sal = (r.saldoPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dias = `${r.dias || 0}d`;
    const obs = r.observacao_recebimento ? r.observacao_recebimento.substring(0, 18) : 'Sem observação';
    doc.text(nome, 14, y);
    doc.text(vo, 72, y);
    doc.text(rec, 100, y);
    if ((r.dias || 0) > 30) doc.setTextColor(185, 28, 28);
    else if ((r.dias || 0) >= 8) doc.setTextColor(194, 65, 12);
    else doc.setTextColor(161, 98, 7);
    doc.text(sal, 128, y);
    doc.text(dias, 152, y);
    doc.setTextColor(30, 30, 30);
    doc.text(obs, 170, y);
    y += 7;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, 14, 290);
    doc.text('Documento gerado automaticamente — uso interno', 100, 290);
  }
  doc.save(`relatorio_inadimplencia_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

function InadimplenciaView({ allRecebimentos }) {
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('all');

  const { data: todasReceitas = [], isLoading } = useQuery({
    queryKey: ['fin-receitas-inadimplencia'],
    queryFn: () => base44.entities.FinanceiroReceita.filter({}, '-created_date', 5000),
  });

  const inadimplentes = useMemo(() => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    const mesAtual = format(new Date(), 'yyyy-MM');
    const limite30 = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

    // Deduplicar: para cada cliente_nome + mes_referencia, manter apenas o mais recente
    const mapa = new Map();
    for (const r of todasReceitas) {
      const key = `${(r.cliente_nome || '').toLowerCase().trim()}|${r.mes_referencia || ''}`;
      const existente = mapa.get(key);
      if (!existente) {
        mapa.set(key, r);
      } else {
        const dtR = r.updated_date || r.created_date || '';
        const dtE = existente.updated_date || existente.created_date || '';
        if (dtR > dtE) mapa.set(key, r);
      }
    }
    const receitasDedup = Array.from(mapa.values());

    return receitasDedup
      .map(r => {
        const calc = calcularStatus(r, allRecebimentos);
        return { ...r, ...calc, dias: diasAtraso(r.data_cobranca) };
      })
      .filter(r => (r.status === 'em_atraso' || r.status === 'parcial') && r.data_cobranca < hoje)
      .filter(r => {
        const matchUnidade = !filtroUnidade || r.cliente_nome?.toLowerCase().includes(filtroUnidade.toLowerCase());
        const matchPeriodo = filtroPeriodo === 'all'
          || (filtroPeriodo === 'mes_atual' && r.mes_referencia === mesAtual)
          || (filtroPeriodo === '30dias' && r.data_cobranca && r.data_cobranca >= limite30);
        return matchUnidade && matchPeriodo;
      })
      .sort((a, b) => b.dias - a.dias);
  }, [todasReceitas, allRecebimentos, filtroUnidade, filtroPeriodo]);

  const totalPendente = inadimplentes.reduce((s, r) => s + (r.saldoPendente || 0), 0);
  const inadTotal = inadimplentes.filter(r => r.status === 'em_atraso').length;
  const inadParcial = inadimplentes.filter(r => r.status === 'parcial').length;
  const dist = {
    ate7: inadimplentes.filter(r => r.dias <= 7).length,
    ate30: inadimplentes.filter(r => r.dias >= 8 && r.dias <= 30).length,
    mais30: inadimplentes.filter(r => r.dias > 30).length,
  };

  const porMes = useMemo(() => {
    const grupos = {};
    inadimplentes.forEach(r => {
      const key = r.mes_referencia || 'sem-mes';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(r);
    });
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
  }, [inadimplentes]);

  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function labelMes(mesRef) {
    if (!mesRef || mesRef === 'sem-mes') return 'Sem mês';
    const [ano, mes] = mesRef.split('-');
    return `${nomes[parseInt(mes) - 1]} ${ano}`;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-500 mb-1">Saldo Total Inadimplente</p>
          <p className="text-xl font-bold text-red-700">{fmt(totalPendente)}</p>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-xs text-red-500 mb-1">Inadimplência Total</p>
          <p className="text-xl font-bold text-red-700">{inadTotal}</p>
        </Card>
        <Card className="p-4 border-orange-200 bg-orange-50">
          <p className="text-xs text-orange-600 mb-1">Inadimplência Parcial</p>
          <p className="text-xl font-bold text-orange-700">{inadParcial}</p>
        </Card>
        <Card className="p-4 border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Total registros</p>
          <p className="text-xl font-bold text-slate-700">{inadimplentes.length}</p>
        </Card>
      </div>

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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Filtrar unidade..." value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)} className="pl-9 w-52" />
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="30dias">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{inadimplentes.length} registros</span>
        <Button variant="outline" size="sm" onClick={() => gerarPDFInadimplencia(inadimplentes)}
          disabled={inadimplentes.length === 0}
          className="ml-auto gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
          <FileText className="w-4 h-4" /> Gerar relatório PDF
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></Card>
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
                <span className="text-xs text-slate-400">{itens.length} registro{itens.length !== 1 ? 's' : ''} · {fmt(itens.reduce((s, r) => s + (r.saldoPendente || 0), 0))} pendente</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="space-y-2">
                {itens.map(r => {
                  const faixaColor = r.dias > 30 ? 'border-l-red-500' : r.dias >= 8 ? 'border-l-orange-400' : 'border-l-amber-400';
                  const isParcial = r.status === 'parcial';
                  return (
                    <Card key={r.id} className={`p-4 border-l-4 ${faixaColor}`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{r.cliente_nome}</p>
                            {isParcial
                              ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Parcial</Badge>
                              : <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Em Atraso</Badge>
                            }
                            <Badge className={`text-xs ${r.dias > 30 ? 'bg-red-100 text-red-700' : r.dias >= 8 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                              {r.dias}d atraso
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-slate-500">
                            <span>Venc.: {r.data_cobranca?.split('-').reverse().join('/')}</span>
                            <span>Original: <strong className="text-slate-700">{fmt(r.valor_mensal)}</strong></span>
                            {isParcial && <span>Recebido: <strong className="text-emerald-600">{fmt(r.totalRecebido)}</strong></span>}
                            <span>Saldo: <strong className="text-red-600">{fmt(r.saldoPendente)}</strong></span>
                            {r.totalJuros > 0 && <span className="text-orange-600">Juros: {fmt(r.totalJuros)}</span>}
                            {r.recs?.length > 0 && <span>Último pg.: {r.recs[r.recs.length - 1]?.data_pagamento?.split('-').reverse().join('/')}</span>}
                          </div>
                          {r.observacao_recebimento && (
                            <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded px-2 py-1 border border-slate-100">
                              💬 {r.observacao_recebimento}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────── PÁGINA PRINCIPAL ───────────────
export default function FinanceiroReceitas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [view, setView] = useState('lista');
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [showConfirmGerar, setShowConfirmGerar] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [migracaoResultado, setMigracaoResultado] = useState(null);
  const [gerarResultado, setGerarResultado] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [obsTarget, setObsTarget] = useState(null);
  const [showConfirmAdd12, setShowConfirmAdd12] = useState(false);
  const [adicionando12, setAdicionando12] = useState(false);
  const [add12Resultado, setAdd12Resultado] = useState(null);
  const [showFinalizarRecorrencia, setShowFinalizarRecorrencia] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [receberTarget, setReceberTarget] = useState(null);
  const [historicoTarget, setHistoricoTarget] = useState(null);

  const { data: receitas = [], isLoading } = useQuery({
    queryKey: ['fin-receitas', mes],
    queryFn: () => base44.entities.FinanceiroReceita.filter({ mes_referencia: mes }, '-created_date', 200),
  });

  const { data: allRecebimentos = [] } = useQuery({
    queryKey: ['fin-recebimentos', mes],
    queryFn: () => base44.entities.RecebimentoReceita.filter({}, '-created_date', 5000),
  });

  // Deduplicar: para cada cliente_nome + mes_referencia, manter apenas o mais recente
  const receitasDedupadas = useMemo(() => {
    const mapa = new Map();
    for (const r of receitas) {
      const key = `${(r.cliente_nome || '').toLowerCase().trim()}|${r.mes_referencia || ''}`;
      const existente = mapa.get(key);
      if (!existente) {
        mapa.set(key, r);
      } else {
        // Manter o com updated_date mais recente; em empate, manter o com mais dados (recebido)
        const dtR = r.updated_date || r.created_date || '';
        const dtE = existente.updated_date || existente.created_date || '';
        if (dtR > dtE) mapa.set(key, r);
      }
    }
    return Array.from(mapa.values());
  }, [receitas]);

  // Enrich receitas com cálculos
  const receitasEnriquecidas = useMemo(() => {
    return receitasDedupadas.map(r => {
      const calc = calcularStatus(r, allRecebimentos);
      return { ...r, ...calc };
    });
  }, [receitasDedupadas, allRecebimentos]);

  const filtered = receitasEnriquecidas.filter(r => {
    const matchSearch = !search || r.cliente_nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'all' || r.status === filtroStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    if (!a.data_cobranca && !b.data_cobranca) return 0;
    if (!a.data_cobranca) return 1;
    if (!b.data_cobranca) return -1;
    return a.data_cobranca.localeCompare(b.data_cobranca);
  });

  const totais = {
    mrr: receitasDedupadas.reduce((s, r) => s + (r.valor_mensal || 0), 0),
    recebido: receitasEnriquecidas.reduce((s, r) => s + (r.totalRecebido || 0), 0),
    pendente: receitasEnriquecidas.reduce((s, r) => s + (r.saldoPendente || 0), 0),
    juros: allRecebimentos.reduce((s, r) => s + (r.valor_juros || 0), 0),
    parciais: receitasEnriquecidas.filter(r => r.status === 'parcial').length,
    semComp: allRecebimentos.filter(r => !r.comprovante_url).length,
    atrasadas: receitasEnriquecidas.filter(r => r.status === 'em_atraso' || r.status === 'parcial').length,
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

  const handleMigrar = async () => {
    setMigrando(true);
    const res = await base44.functions.invoke('migrarRecebimentosReceitas', {});
    qc.invalidateQueries({ queryKey: ['fin-recebimentos'] });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setMigrando(false);
    setMigracaoResultado(res.data?.message || 'Concluído!');
  };

  const handleGerarRecorrentes = async () => {
    setShowConfirmGerar(false);
    setGerando(true);
    const res = await base44.functions.invoke('gerarReceitasRecorrentes', { mes_referencia: mes });
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setGerando(false);
    const d = res.data;
    let msg = d?.message || 'Concluído!';
    if (d?.duplicatasRemovidas > 0) msg += ` (${d.duplicatasRemovidas} duplicata(s) removida(s))`;
    setGerarResultado(msg);
  };

  const handleDelete = async () => {
    // Excluir também duplicatas do mesmo cliente_nome + mes_referencia (que estavam ocultas pela deduplicação)
    const duplicates = receitas.filter(r =>
      r.id !== deleteTarget.id &&
      (r.cliente_nome || '').toLowerCase().trim() === (deleteTarget.cliente_nome || '').toLowerCase().trim() &&
      r.mes_referencia === deleteTarget.mes_referencia
    );
    await base44.entities.FinanceiroReceita.delete(deleteTarget.id);
    for (const r of duplicates) {
      await base44.entities.FinanceiroReceita.delete(r.id);
    }
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setDeleteTarget(null);
  };

  const openEdit = (r) => {
    setForm({ ...r, valor_mensal: r.valor_mensal?.toString() || '', quantidade_meses: r.quantidade_meses ? parseInt(r.quantidade_meses) : '' });
    setGerarRecorrentesModalResultado(null);
    setShowModal(true);
  };

  const openNew = () => {
    setForm({ ...EMPTY });
    setGerarRecorrentesModalResultado(null);
    setShowModal(true);
  };

  const handleFinalizarRecorrencia = async () => {
    setFinalizando(true);
    // Busca todos os lançamentos futuros do mesmo cliente recorrente (mês > atual)
    const todos = await base44.entities.FinanceiroReceita.filter({ cliente_nome: form.cliente_nome, recorrente: true }, '-created_date', 500);
    const futuros = todos.filter(r => r.id !== form.id && r.mes_referencia > mes);
    for (const r of futuros) {
      await base44.entities.FinanceiroReceita.delete(r.id);
    }
    // Atualiza o registro atual e quaisquer duplicatas do mesmo cliente/mês (encerrando a recorrência)
    const atuais = await base44.entities.FinanceiroReceita.filter({
      cliente_nome: form.cliente_nome,
      mes_referencia: mes,
    }, '-created_date', 50);
    for (const r of atuais) {
      await base44.entities.FinanceiroReceita.update(r.id, { recorrente: false, data_fim: mes + '-28' });
    }
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setFinalizando(false);
    setShowFinalizarRecorrencia(false);
    setShowModal(false);
    setForm(EMPTY);
  };

  const [add12Progress, setAdd12Progress] = useState(0);
  const [gerandoRecorrentesModal, setGerandoRecorrentesModal] = useState(false);
  const [gerarRecorrentesModalResultado, setGerarRecorrentesModalResultado] = useState(null);

  const handleGerarRecorrentesParaReceita = async () => {
    if (!form.cliente_nome || !form.data_inicio) return;
    // Calcula quantidade de meses: usa campo direto ou deriva de data_fim
    let qtd = parseInt(form.quantidade_meses) || 0;
    if (!qtd && form.data_fim) {
      const inicio = new Date(form.data_inicio + 'T12:00:00');
      const fim = new Date(form.data_fim + 'T12:00:00');
      qtd = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()) + 1;
    }
    if (!qtd) return;

    setGerandoRecorrentesModal(true);
    setGerarRecorrentesModalResultado(null);
    let criadas = 0;
    // Pega o dia de cobrança da receita atual (ex: 01, 10, 15)
    const diaCobranca = form.data_cobranca ? form.data_cobranca.split('-')[2] : '01';
    const inicio = new Date(form.data_inicio + 'T12:00:00');

    for (let i = 0; i < qtd; i++) {
      const d = new Date(inicio);
      d.setMonth(d.getMonth() + i);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const mesRef = `${ano}-${mes}`;
      const dataCobranca = `${ano}-${mes}-${diaCobranca}`;

      // Verifica se já existe lançamento para este cliente/mês
      const existentes = await base44.entities.FinanceiroReceita.filter({
        cliente_nome: form.cliente_nome,
        mes_referencia: mesRef,
      }, '-created_date', 5);
      if (existentes.length === 0) {
        await base44.entities.FinanceiroReceita.create({
          cliente_nome: form.cliente_nome,
          cliente_id: form.cliente_id || '',
          valor_mensal: parseFloat(form.valor_mensal) || 0,
          tipo_contrato: form.tipo_contrato || 'mensal',
          mes_referencia: mesRef,
          data_cobranca: dataCobranca,
          recorrente: true,
          frequencia: 'mensal',
          data_inicio: form.data_inicio,
          data_fim: form.data_fim || '',
          quantidade_meses: qtd,
          is_previsto: true,
          status: 'previsto',
        });
        criadas++;
      }
      await new Promise(r => setTimeout(r, 150));
    }
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setGerandoRecorrentesModal(false);
    setGerarRecorrentesModalResultado(`${criadas} lançamento(s) criado(s) (${qtd - criadas} já existiam).`);
  };

  const handleAdicionarQuantidadeMeses = async () => {
    setAdicionando12(true);
    setAdd12Progress(0);
    let totalAtualizadas = 0;
    let temMais = true;
    let tentativas = 0;
    while (temMais && tentativas < 100) {
      try {
        const res = await base44.functions.invoke('adicionarQuantidadeMesesRecorrentes', {});
        const d = res?.data;
        totalAtualizadas += d?.atualizadas ?? 0;
        setAdd12Progress(totalAtualizadas);
        temMais = !!d?.temMais;
        tentativas++;
        if (temMais) await new Promise(r => setTimeout(r, 2000)); // pausa entre chamadas
      } catch {
        // Rate limit — aguarda 5s e tenta novamente
        await new Promise(r => setTimeout(r, 5000));
        tentativas++;
      }
    }
    qc.invalidateQueries({ queryKey: ['fin-receitas'] });
    setAdicionando12(false);
    setAdd12Resultado(`${totalAtualizadas} receita(s) atualizada(s) com 12 meses de recorrência.`);
  };

  // Recebimentos da receita selecionada no ReceberModal
  const recebimentosDoTarget = useMemo(() => {
    if (!receberTarget && !historicoTarget) return [];
    const id = (receberTarget || historicoTarget)?.id;
    return allRecebimentos.filter(r => r.receita_id === id);
  }, [receberTarget, historicoTarget, allRecebimentos]);

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
          <Button variant="outline" onClick={handleMigrar} disabled={migrando} className="border-violet-200 text-violet-600 hover:bg-violet-50" title="Migrar pagamentos antigos para a nova estrutura de recebimentos">
            {migrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Migrar Dados
          </Button>
          <Button variant="outline" onClick={() => setShowConfirmGerar(true)} disabled={gerando}>
            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Gerar Recorrentes ({mes})
          </Button>
          <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nova Receita
          </Button>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setView('lista')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'lista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <List className="w-4 h-4" /> Lista
        </button>
        <button onClick={() => setView('inadimplencia')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'inadimplencia' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <AlertTriangle className="w-4 h-4" /> Inadimplência
          {totais.atrasadas > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{totais.atrasadas}</span>
          )}
        </button>
      </div>

      {view === 'inadimplencia' ? (
        <InadimplenciaView allRecebimentos={allRecebimentos} />
      ) : (
        <>
          <AlertaRecorrenciaVencendo tipo="receita" />

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4 border-slate-200">
              <p className="text-xs text-slate-500 mb-1">MRR Total</p>
              <p className="text-lg font-bold text-slate-900">{fmt(totais.mrr)}</p>
            </Card>
            <Card className="p-4 border-emerald-200 bg-emerald-50">
              <p className="text-xs text-emerald-600 mb-1">Recebido</p>
              <p className="text-lg font-bold text-emerald-700">{fmt(totais.recebido)}</p>
            </Card>
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-xs text-red-500 mb-1">Saldo Pendente</p>
              <p className="text-lg font-bold text-red-700">{fmt(totais.pendente)}</p>
            </Card>
            <Card className={`p-4 ${totais.juros > 0 ? 'border-orange-200 bg-orange-50' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Juros Recebidos</p>
              <p className={`text-lg font-bold ${totais.juros > 0 ? 'text-orange-600' : 'text-slate-700'}`}>{fmt(totais.juros)}</p>
            </Card>
            <Card className={`p-4 ${totais.parciais > 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Parciais</p>
              <p className={`text-lg font-bold ${totais.parciais > 0 ? 'text-blue-700' : 'text-slate-700'}`}>{totais.parciais}</p>
            </Card>
            <Card className={`p-4 ${totais.semComp > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Sem comprovante</p>
              <p className={`text-lg font-bold ${totais.semComp > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{totais.semComp}</p>
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
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pago">✅ Pago</SelectItem>
                <SelectItem value="parcial">🔵 Parcial</SelectItem>
                <SelectItem value="a_vencer">🟡 A Vencer</SelectItem>
                <SelectItem value="em_atraso">🔴 Em Atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {isLoading ? (
              <Card className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></Card>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-slate-400">Nenhuma receita encontrada.</Card>
            ) : filtered.map(r => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.a_vencer;
              const diasAtr = r.status === 'em_atraso' || r.status === 'parcial' ? diasAtraso(r.data_cobranca) : 0;
              return (
                <Card key={r.id} className="p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full mt-2 flex-shrink-0 ${sc.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{r.cliente_nome}</p>
                          <Badge className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                          {!r.recorrente && <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300">⚠ Sem recorrência</Badge>}
                          {r.totalJuros > 0 && <Badge className="text-xs bg-orange-100 text-orange-700">c/ juros</Badge>}
                          {r.recs?.some(rec => !rec.comprovante_url) && <Badge className="text-xs bg-amber-100 text-amber-600">sem comprovante</Badge>}
                          {diasAtr > 0 && <Badge className="text-xs bg-red-50 text-red-600 border-red-200">{diasAtr}d atraso</Badge>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-slate-500">
                          <span>{r.tipo_contrato}</span>
                          {r.data_cobranca && <span>Venc.: {r.data_cobranca.split('-').reverse().join('/')}</span>}
                          <span>Original: <strong className="text-slate-700">{fmt(r.valor_mensal)}</strong></span>
                          {r.totalRecebido > 0 && <span>Recebido: <strong className="text-emerald-600">{fmt(r.totalRecebido)}</strong></span>}
                          {r.saldoPendente > 0 && <span>Saldo: <strong className="text-red-600">{fmt(r.saldoPendente)}</strong></span>}
                        </div>
                        {r.observacao_recebimento && (
                          <p className="text-xs text-slate-400 mt-1 truncate max-w-sm">💬 {r.observacao_recebimento}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="h-7 text-xs gap-1">
                        <FileText className="w-3 h-3" /> Cobrança
                      </Button>
                      <Button size="sm" onClick={() => setReceberTarget(r)}
                        className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <DollarSign className="w-3 h-3" /> Receber
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setHistoricoTarget(r)} className="h-7 text-xs gap-1">
                        <History className="w-3 h-3" /> Histórico
                        {r.recs?.length > 0 && <span className="bg-slate-200 text-slate-700 rounded-full px-1 text-xs leading-none">{r.recs.length}</span>}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setObsTarget(r)} className={`h-7 text-xs px-2 ${r.observacao_recebimento ? 'border-violet-200 text-violet-600' : ''}`}>
                        <MessageSquare className="w-3 h-3" />
                      </Button>
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

      {/* Modais */}
      {obsTarget && <ObservacaoModal receita={obsTarget} user={user} onClose={() => setObsTarget(null)} />}

      {receberTarget && (
        <ReceberModal
          receita={receberTarget}
          recebimentos={recebimentosDoTarget}
          onClose={() => setReceberTarget(null)}
        />
      )}

      {historicoTarget && (
        <HistoricoRecebimentosModal
          receita={historicoTarget}
          onClose={() => setHistoricoTarget(null)}
          onAddRecebimento={() => { setReceberTarget(historicoTarget); setHistoricoTarget(null); }}
        />
      )}

      {/* Finalizar Recorrência — Receitas */}
      <AlertDialog open={showFinalizarRecorrencia} onOpenChange={setShowFinalizarRecorrencia}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Os lançamentos futuros de <strong>{form.cliente_nome}</strong> (meses posteriores a <strong>{mes}</strong>) serão excluídos permanentemente e a recorrência será encerrada. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalizarRecorrencia} disabled={finalizando} className="bg-orange-600 hover:bg-orange-700">
              {finalizando && <Loader2 className="w-4 h-4 animate-spin" />} Sim, finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm adicionar 12 meses */}
      <AlertDialog open={showConfirmAdd12} onOpenChange={setShowConfirmAdd12}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar 12 meses de recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as receitas marcadas como recorrentes que <strong>não possuem quantidade de meses definida</strong> serão atualizadas com 12 meses a partir da data de início. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowConfirmAdd12(false);
                setTimeout(() => handleAdicionarQuantidadeMeses(), 50);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Sim, atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!add12Resultado} onOpenChange={open => !open && setAdd12Resultado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualização Concluída</AlertDialogTitle>
            <AlertDialogDescription>{add12Resultado}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAdd12Resultado(null)} className="bg-emerald-600 hover:bg-emerald-700">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm gerar recorrentes */}
      <AlertDialog open={showConfirmGerar} onOpenChange={setShowConfirmGerar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar receitas recorrentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão gerados lançamentos recorrentes para o mês <strong>{mes}</strong>. Lançamentos já existentes não serão duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGerarRecorrentes} className="bg-violet-600 hover:bg-violet-700">Sim, gerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!gerarResultado} onOpenChange={open => !open && setGerarResultado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Geração Concluída</AlertDialogTitle>
            <AlertDialogDescription>{gerarResultado}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setGerarResultado(null)} className="bg-emerald-600 hover:bg-emerald-700">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!migracaoResultado} onOpenChange={open => !open && setMigracaoResultado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Migração Concluída</AlertDialogTitle>
            <AlertDialogDescription>{migracaoResultado}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMigracaoResultado(null)} className="bg-violet-600 hover:bg-violet-700">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir a receita de <strong>{deleteTarget?.cliente_nome}</strong>{deleteTarget?.valor_mensal ? ` — ${fmt(deleteTarget.valor_mensal)}` : ''}. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal cobrança */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar Cobrança' : 'Nova Receita'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Cliente *</Label>
              <ClienteFinanceiroSelect
                value={form.cliente_nome}
                onChange={(cliente) => {
                  if (!cliente) { setForm(f => ({ ...f, cliente_nome: '', cliente_id: '' })); return; }
                  const dataCobranca = cliente.dia_cobranca
                    ? `${mes}-${String(cliente.dia_cobranca).padStart(2, '0')}` : form.data_cobranca;
                  setForm(f => ({
                    ...f,
                    cliente_nome: cliente.nome + (cliente.unidade ? ` — ${cliente.unidade}` : ''),
                    cliente_id: cliente.id,
                    valor_mensal: cliente.valor_mensal?.toString() || f.valor_mensal,
                    tipo_contrato: cliente.tipo_contrato || f.tipo_contrato,
                    data_cobranca: dataCobranca,
                  }));
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Original (R$) *</Label>
                <Input type="number" value={form.valor_mensal}
                  onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} placeholder="0,00" />
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
                <Input type="date" value={form.data_cobranca}
                  onChange={e => setForm(f => ({ ...f, data_cobranca: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="recorrente" checked={!!form.recorrente}
                  onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} className="w-4 h-4" />
                <Label htmlFor="recorrente">Receita Recorrente</Label>
              </div>
            </div>
            {form.recorrente && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Início</Label>
                  <Input type="date" value={form.data_inicio || ''} onChange={e => {
                    const newInicio = e.target.value;
                    let data_fim = form.data_fim || '';
                    if (newInicio && form.quantidade_meses) {
                      const d = new Date(newInicio);
                      d.setMonth(d.getMonth() + form.quantidade_meses - 1);
                      data_fim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    }
                    setForm(f => ({ ...f, data_inicio: newInicio, data_fim }));
                  }} />
                </div>
                <div>
                  <Label>Qtd. de Meses</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 12"
                    value={form.quantidade_meses || ''}
                    onChange={e => {
                      const qtd = parseInt(e.target.value) || '';
                      let data_fim = '';
                      if (qtd && form.data_inicio) {
                        const d = new Date(form.data_inicio);
                        d.setMonth(d.getMonth() + qtd - 1);
                        data_fim = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      }
                      setForm(f => ({ ...f, quantidade_meses: qtd, data_fim, frequencia: 'mensal' }));
                    }}
                  />
                </div>
                {form.data_fim && (
                  <p className="col-span-2 text-xs text-slate-500">
                    Recorrência mensal até {form.data_fim.split('-').reverse().join('/')}
                  </p>
                )}
                {form.data_inicio && (parseInt(form.quantidade_meses) > 0 || form.data_fim) && (
                  <div className="col-span-2 border-t pt-3 mt-1 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={gerandoRecorrentesModal}
                      onClick={handleGerarRecorrentesParaReceita}
                      className="w-full border-violet-200 text-violet-600 hover:bg-violet-50"
                    >
                      {gerandoRecorrentesModal
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando lançamentos...</>
                        : <><RefreshCw className="w-4 h-4" /> Gerar lançamentos recorrentes{parseInt(form.quantidade_meses) > 0 ? ` (${parseInt(form.quantidade_meses)} meses)` : ''}</>
                      }
                    </Button>
                    {gerarRecorrentesModalResultado && (
                      <p className="text-xs text-emerald-600 text-center">{gerarRecorrentesModalResultado}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {form.id && form.recorrente && (
              <Button variant="outline" onClick={() => setShowFinalizarRecorrencia(true)}
                className="border-orange-200 text-orange-600 hover:bg-orange-50 mr-auto">
                <StopCircle className="w-4 h-4" /> Finalizar Recorrência
              </Button>
            )}
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