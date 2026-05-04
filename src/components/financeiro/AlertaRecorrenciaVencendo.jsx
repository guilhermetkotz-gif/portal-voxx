import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { format, addMonths, parseISO, differenceInMonths } from 'date-fns';

/**
 * Exibe um aviso quando itens recorrentes têm data_fim dentro de 2 meses.
 * tipo: 'custo' | 'receita'
 */
export default function AlertaRecorrenciaVencendo({ tipo }) {
  const hoje = new Date();
  const limite = addMonths(hoje, 2);
  const limiteMes = format(limite, 'yyyy-MM');

  const { data: itens = [] } = useQuery({
    queryKey: ['alerta-recorrencia', tipo],
    queryFn: () => tipo === 'custo'
      ? base44.entities.FinanceiroCusto.filter({ recorrente: true }, '-created_date', 500)
      : base44.entities.FinanceiroReceita.filter({ recorrente: true }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const alertas = useMemo(() => {
    return itens.filter(item => {
      if (!item.data_fim) return false;
      const fimMes = item.data_fim.substring(0, 7); // yyyy-MM
      return fimMes >= format(hoje, 'yyyy-MM') && fimMes <= limiteMes;
    }).reduce((acc, item) => {
      // Deduplica por nome (custo) ou cliente_nome (receita)
      const key = tipo === 'custo' ? item.nome : item.cliente_nome;
      if (!acc.find(a => (tipo === 'custo' ? a.nome : a.cliente_nome) === key)) {
        acc.push(item);
      }
      return acc;
    }, []);
  }, [itens, limiteMes]);

  if (alertas.length === 0) return null;

  const label = tipo === 'custo' ? 'despesa' : 'receita';

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          {alertas.length} {label}{alertas.length !== 1 ? 's' : ''} recorrente{alertas.length !== 1 ? 's' : ''} vence{alertas.length === 1 ? '' : 'm'} em até 2 meses — verifique a renovação
        </p>
      </div>
      <div className="space-y-1">
        {alertas.map(item => {
          const nome = tipo === 'custo' ? item.nome : item.cliente_nome;
          const fim = item.data_fim ? item.data_fim.split('-').reverse().join('/') : '—';
          const mesesRestantes = item.data_fim
            ? differenceInMonths(parseISO(item.data_fim), hoje)
            : null;
          return (
            <div key={item.id} className="flex items-center gap-2 text-xs text-amber-700">
              <RefreshCw className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">{nome}</span>
              <span className="text-amber-500">·</span>
              <span>Fim: {fim}</span>
              {mesesRestantes !== null && (
                <span className={`px-1.5 py-0.5 rounded-full font-semibold ${mesesRestantes <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {mesesRestantes <= 0 ? 'Vence este mês' : `${mesesRestantes} mes${mesesRestantes !== 1 ? 'es' : ''} restante${mesesRestantes !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}