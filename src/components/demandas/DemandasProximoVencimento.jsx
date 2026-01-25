import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DemandasProximoVencimento({ demandas = [] }) {
  const agora = new Date();
  const demandasVencimento = demandas
    .filter(d => d.previsao_entrega && d.status !== 'concluida')
    .map(d => ({
      ...d,
      diasRestantes: differenceInDays(new Date(d.previsao_entrega), agora)
    }))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const getPriorityColor = (dias) => {
    if (dias < 0) return 'destructive';
    if (dias <= 2) return 'destructive';
    if (dias <= 7) return 'amber';
    return 'secondary';
  };

  const getPriorityLabel = (dias) => {
    if (dias < 0) return `Vencido há ${Math.abs(dias)} dias`;
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return `Vence em ${dias} dias`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <CardTitle>Próximos Vencimentos</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {demandasVencimento.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Nenhuma demanda com prazo próximo
            </p>
          ) : (
            demandasVencimento.map(demanda => (
              <div 
                key={demanda.id}
                className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {demanda.titulo}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {demanda.cliente_nome}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge 
                    variant={demanda.diasRestantes < 0 ? 'destructive' : demanda.diasRestantes <= 2 ? 'destructive' : 'secondary'}
                    className="whitespace-nowrap"
                  >
                    {getPriorityLabel(demanda.diasRestantes)}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {format(new Date(demanda.previsao_entrega), 'dd/MM', { locale: ptBR })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}