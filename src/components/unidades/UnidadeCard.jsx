import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, TrendingDown, Minus, ChevronRight, DollarSign, Zap } from 'lucide-react';

const STATUS_CONFIG = {
  saudavel: { label: 'Saudável', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', ring: 'border-l-emerald-500' },
  atencao: { label: 'Atenção', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200', ring: 'border-l-amber-500' },
  critico: { label: 'Crítico', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200', ring: 'border-l-red-500' },
};

const TAG_CONFIG = {
  alta_performance: { label: '🔥 Alta Performance', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  estavel: { label: '⚖️ Estável', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  em_risco: { label: '⚠️ Em Risco', cls: 'bg-red-100 text-red-700 border-red-200' },
};

function KPICell({ label, value, sub, highlight }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</span>
      <span className={`text-sm font-bold truncate ${highlight || 'text-slate-800'}`}>{value || '—'}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}

export default function UnidadeCard({ unidade, rank, onClick }) {
  const sc = STATUS_CONFIG[unidade.healthStatus] || STATUS_CONFIG.saudavel;
  const tagCfg = TAG_CONFIG[unidade.tag] || TAG_CONFIG.estavel;

  const variacaoColor = unidade.variacao > 15 ? 'text-red-600' : unidade.variacao < -10 ? 'text-emerald-600' : 'text-slate-600';
  const VarIcon = unidade.variacao > 5 ? TrendingUp : unidade.variacao < -5 ? TrendingDown : Minus;

  return (
    <Card
      onClick={onClick}
      className={`border-l-4 ${sc.ring} hover:shadow-md transition-all duration-200 cursor-pointer group`}
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-500">
            {rank}
          </div>

          {/* Identidade */}
          <div className="min-w-0 w-48 flex-shrink-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
              <h3 className="font-bold text-slate-900 text-sm truncate">{unidade.nome}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{unidade.cidade}{unidade.estado ? `, ${unidade.estado}` : ''}</span>
            </div>
          </div>

          {/* KPIs Meta */}
          <div className="hidden md:grid grid-cols-4 gap-6 flex-1">
            <KPICell
              label="Leads / Mês"
              value={unidade.leadsMes > 0 ? unidade.leadsMes.toString() : '—'}
              highlight={unidade.leadsMes > 20 ? 'text-emerald-600' : undefined}
            />
            <KPICell
              label="CPL"
              value={unidade.cpl > 0 ? `R$ ${unidade.cpl.toFixed(0)}` : '—'}
              highlight={unidade.cpl > 200 ? 'text-red-600' : unidade.cpl > 120 ? 'text-amber-600' : undefined}
            />
            <KPICell
              label="Leads Ontem"
              value={unidade.leadsOntem > 0 ? unidade.leadsOntem.toString() : '—'}
            />
            <KPICell
              label="Freq. 7d"
              value={unidade.frequencia7d > 0 ? unidade.frequencia7d.toFixed(2) : '—'}
              highlight={unidade.frequencia7d > 2.5 ? 'text-amber-600' : undefined}
            />
          </div>

          {/* KPIs Google */}
          <div className="hidden lg:grid grid-cols-2 gap-4 w-40 flex-shrink-0">
            <KPICell
              label="Google Invest."
              value={unidade.googleConta?.cost > 0 ? `R$ ${unidade.googleConta.cost.toFixed(0)}` : '—'}
            />
            <KPICell
              label="Conversões"
              value={unidade.googleConta?.conversions > 0 ? unidade.googleConta.conversions.toFixed(0) : '—'}
            />
          </div>

          {/* Variação CPL */}
          <div className="hidden md:flex flex-col items-center w-20 flex-shrink-0">
            <div className="flex items-center gap-1">
              <VarIcon className={`w-4 h-4 ${variacaoColor}`} />
              <span className={`text-sm font-bold ${variacaoColor}`}>
                {unidade.variacao !== 0 ? `${unidade.variacao > 0 ? '+' : ''}${unidade.variacao.toFixed(0)}%` : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">var. CPL</span>
          </div>

          {/* Tags */}
          <div className="hidden lg:flex flex-col gap-1.5 items-end flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.badge}`}>{sc.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tagCfg.cls}`}>{tagCfg.label}</span>
          </div>

          {/* Seta */}
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors ml-auto flex-shrink-0" />
        </div>
      </div>
    </Card>
  );
}