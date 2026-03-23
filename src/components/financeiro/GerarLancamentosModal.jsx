import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { format, addMonths, parseISO, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function mesInRange(item, mes) {
  const [year, month] = mes.split('-').map(Number);
  const targetDate = new Date(year, month - 1, 1);
  if (item.data_inicio && isAfter(new Date(item.data_inicio), targetDate)) return false;
  if (item.data_fim && isBefore(new Date(item.data_fim), targetDate)) return false;
  return true;
}

export default function GerarLancamentosModal({ open, onClose, onDone }) {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const gerar = async () => {
    setLoading(true);
    setResult(null);
    let gerados = 0;
    let pulados = 0;

    // Load recorrentes
    const [receitas, custos, folha] = await Promise.all([
      base44.entities.FinanceiroReceita.filter({ recorrente: true }),
      base44.entities.FinanceiroCusto.filter({ recorrente: true }),
      base44.entities.FinanceiroFolha.filter({ recorrente: true }),
    ]);

    // Load existing for this month to avoid duplicates
    const [recExist, cusExist, folExist] = await Promise.all([
      base44.entities.FinanceiroReceita.filter({ mes_referencia: mes }),
      base44.entities.FinanceiroCusto.filter({ mes_referencia: mes }),
      base44.entities.FinanceiroFolha.filter({ mes_referencia: mes }),
    ]);

    // Receitas
    for (const item of receitas) {
      if (!mesInRange(item, mes)) { pulados++; continue; }
      const exists = recExist.some(e => e.cliente_nome === item.cliente_nome);
      if (exists) { pulados++; continue; }
      await base44.entities.FinanceiroReceita.create({
        cliente_nome: item.cliente_nome,
        cliente_id: item.cliente_id,
        valor_mensal: item.valor_mensal,
        tipo_contrato: item.tipo_contrato,
        status: 'previsto',
        is_previsto: true,
        recorrente: false,
        mes_referencia: mes,
      });
      gerados++;
    }

    // Custos
    for (const item of custos) {
      if (!mesInRange(item, mes)) { pulados++; continue; }
      const exists = cusExist.some(e => e.nome === item.nome);
      if (exists) { pulados++; continue; }
      await base44.entities.FinanceiroCusto.create({
        nome: item.nome,
        categoria: item.categoria,
        tipo: item.tipo,
        valor: item.valor,
        status: 'previsto',
        is_previsto: true,
        recorrente: false,
        mes_referencia: mes,
      });
      gerados++;
    }

    // Folha
    for (const item of folha) {
      if (!mesInRange(item, mes)) { pulados++; continue; }
      const exists = folExist.some(e => e.nome === item.nome);
      if (exists) { pulados++; continue; }
      await base44.entities.FinanceiroFolha.create({
        nome: item.nome,
        tipo_vinculo: item.tipo_vinculo,
        salario: item.salario,
        vale_alimentacao: item.vale_alimentacao,
        vale_transporte: item.vale_transporte,
        outros_beneficios: item.outros_beneficios,
        tipo_servico: item.tipo_servico,
        valor_pj: item.valor_pj,
        status: 'previsto',
        is_previsto: true,
        recorrente: false,
        mes_referencia: mes,
      });
      gerados++;
    }

    setResult({ gerados, pulados });
    setLoading(false);
    if (gerados > 0) onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-600" />
            Gerar Lançamentos do Mês
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Gera lançamentos <strong>previstos</strong> para todos os itens marcados como recorrentes, sem duplicar os que já existem.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Mês de referência</label>
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-white"
            />
          </div>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle className="w-4 h-4" />
                <span><strong>{result.gerados}</strong> lançamento(s) gerado(s) como previsto</span>
              </div>
              {result.pulados > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4" />
                  <span><strong>{result.pulados}</strong> item(ns) pulado(s) (já existia ou fora do período)</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={gerar} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : <><Zap className="w-4 h-4" /> Gerar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}