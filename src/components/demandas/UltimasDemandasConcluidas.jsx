import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const setorLabels = {
  'TRAFEGO_META': 'Tráfego Meta',
  'TRAFEGO_GOOGLE': 'Tráfego Google',
  'TRAFEGO_TIKTOK': 'Tráfego TikTok',
  'CRIACAO': 'Criação',
  'EDICAO': 'Edição',
  'BI_RELATORIO': 'BI/Relatório',
  'IMPLANTACAO': 'Implantação',
  'FINANCEIRO': 'Financeiro',
  'ALTERACAO_CRIACAO': 'Alteração/Criação',
  'AUTOMACAO': 'Automação',
  'SALDOS': 'Saldos'
};

const setorColors = {
  'TRAFEGO_META': 'bg-blue-100 text-blue-800',
  'TRAFEGO_GOOGLE': 'bg-green-100 text-green-800',
  'TRAFEGO_TIKTOK': 'bg-purple-100 text-purple-800',
  'CRIACAO': 'bg-pink-100 text-pink-800',
  'EDICAO': 'bg-indigo-100 text-indigo-800',
  'BI_RELATORIO': 'bg-cyan-100 text-cyan-800',
  'IMPLANTACAO': 'bg-amber-100 text-amber-800',
  'FINANCEIRO': 'bg-red-100 text-red-800',
  'ALTERACAO_CRIACAO': 'bg-slate-100 text-slate-800',
  'AUTOMACAO': 'bg-teal-100 text-teal-800',
  'SALDOS': 'bg-orange-100 text-orange-800'
};

export default function UltimasDemandasConcluidas({ demandas = [] }) {
  const demandasConcluidas = demandas
    .filter(d => d.status === 'concluida')
    .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <CardTitle>Últimas Demandas Concluídas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {demandasConcluidas.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Nenhuma demanda concluída
            </p>
          ) : (
            demandasConcluidas.map(demanda => (
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
                <div className="flex flex-col items-end gap-2 text-right">
                  <Badge className={setorColors[demanda.setor]} variant="outline">
                    {setorLabels[demanda.setor]}
                  </Badge>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(demanda.updated_date), { 
                      locale: ptBR,
                      addSuffix: true 
                    })}
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