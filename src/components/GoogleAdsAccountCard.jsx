import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle, CheckCircle, Pause } from 'lucide-react';

export default function GoogleAdsAccountCard({ account }) {
  const cpa = account.conversions > 0 ? (account.cost / account.conversions).toFixed(2) : 0;
  
  const getScoreBadge = (score) => {
    if (score >= 80) return <Badge className="bg-green-600">Excelente</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-600">Bom</Badge>;
    return <Badge className="bg-red-600">Crítico</Badge>;
  };

  const getStatusIcon = () => {
    if (account.conta_sem_dados) {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    if (account.account_status === 'Pausada') {
      return <Pause className="w-4 h-4 text-orange-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">{account.unidade_nome}</CardTitle>
            <p className="text-xs text-gray-500">{account.account_name}</p>
          </div>
          {getStatusIcon()}
        </div>
        {account.conta_sem_dados && (
          <Badge variant="outline" className="mt-2 bg-gray-100">Sem Dados</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Clicks</p>
            <p className="text-lg font-semibold">{account.clicks.toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Conversões</p>
            <p className="text-lg font-semibold">{account.conversions}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Investimento</p>
            <p className="text-lg font-semibold">R$ {account.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Cost/Conv.</p>
            <p className="text-lg font-semibold text-violet-600">
              {account.cost_per_conversion > 0 ? `R$ ${account.cost_per_conversion.toFixed(2)}` : '-'}
            </p>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Optimization Score</span>
            {getScoreBadge(account.optimization_score)}
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                account.optimization_score >= 80 ? 'bg-green-600' :
                account.optimization_score >= 70 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${account.optimization_score}%` }}
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500">CPC Médio</span>
          <span className="font-semibold">R$ {account.avg_cpc.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}