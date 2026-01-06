import React from 'react';
import { Card } from "@/components/ui/card";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatusBadge from '@/components/ui/StatusBadge';
import { ArrowRight, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RecentDemandas({ demandas = [] }) {
  const statusCount = {
    recebida: demandas.filter(d => d.status === 'recebida').length,
    em_triagem: demandas.filter(d => d.status === 'em_triagem').length,
    em_execucao: demandas.filter(d => d.status === 'em_execucao').length,
    aguardando_cliente: demandas.filter(d => d.status === 'aguardando_cliente').length,
    em_revisao: demandas.filter(d => d.status === 'em_revisao').length,
  };

  const totalAbertas = Object.values(statusCount).reduce((a, b) => a + b, 0);
  const recentDemandas = demandas.slice(0, 3);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Demandas em Aberto</h3>
        <Link 
          to={createPageUrl('Demandas')}
          className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
        >
          Ver todas <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-bold text-blue-600">{statusCount.recebida}</p>
          <p className="text-[10px] text-slate-500">Recebidas</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-600">{statusCount.em_triagem}</p>
          <p className="text-[10px] text-slate-500">Em Triagem</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-violet-600">{statusCount.em_execucao}</p>
          <p className="text-[10px] text-slate-500">Em Execução</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-amber-600">{statusCount.aguardando_cliente}</p>
          <p className="text-[10px] text-slate-500">Aguardando</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-cyan-600">{statusCount.em_revisao}</p>
          <p className="text-[10px] text-slate-500">Em Revisão</p>
        </div>
      </div>

      {/* Recent Updates */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-500 uppercase">Últimas atualizações</p>
        {recentDemandas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Nenhuma demanda em aberto</p>
        ) : (
          recentDemandas.map((demanda) => (
            <Link 
              key={demanda.id}
              to={createPageUrl(`Demandas?id=${demanda.id}`)}
              className="block p-3 rounded-lg border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{demanda.titulo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge type="setor" value={demanda.setor} size="xs" />
                    <StatusBadge type="status" value={demanda.status} size="xs" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(demanda.updated_date || demanda.created_date), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}